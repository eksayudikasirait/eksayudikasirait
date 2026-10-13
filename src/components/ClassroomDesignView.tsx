import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { motion, AnimatePresence } from 'motion/react';
import {
  StudentSubmission,
  EXAM_INFO,
  getCleanKelas,
  getSemesterFromSub,
  firestoreDb,
  firestoreRestReadDoc,
  firestoreRestWriteDoc,
  DEFAULT_OFFICIAL_STUDENT_SHARE_URL,
  getStoredStudentShareUrl,
  saveStudentShareUrl,
  STUDENT_SHARE_URL_EVENT,
} from '../data/examData';
import { detectStudentDeviceSync } from '../utils/deviceDetector';
import {
  getPhotoForStudentIdentity,
  loadStoredStudentProfile,
  saveStoredStudentProfile,
  StudentCameraProfileModal,
  getStudentInitials,
  generateFormalStudentAvatarDataUrl,
} from './StudentCameraProfileModal';
import {
  googleSignIn,
  getCurrentGoogleUser,
  initAuth,
} from '../services/gmailAuthService';
import {
  STORAGE_KEY_STUDENTS,
  STORAGE_KEY_ACTIVE_SYNC,
  CLASSROOM_SYNC_EVENT,
  getStoredActiveSync,
  ActiveClassroomStudentSyncData,
} from '../utils/classroomSync';
import {
  Users,
  UserPlus,
  LayoutGrid,
  Monitor,
  Smartphone,
  Laptop,
  Tablet,
  Edit3,
  Trash2,
  CheckCircle2,
  Search,
  RefreshCw,
  Play,
  Sparkles,
  ArrowLeft,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Move,
  DoorOpen,
  Award,
  Layers,
  PlusCircle,
  Save,
  X,
  FileSpreadsheet,
  Check,
  Lock,
  Unlock,
  ShieldCheck,
  Copy,
  MessageSquare,
  Send,
  Reply,
  Globe,
  ArrowRightLeft,
  Megaphone,
  KeyRound,
  Camera,
  Eye,
  EyeOff,
  Cpu,
  QrCode,
} from 'lucide-react';
import {
  SyncDataDateModal,
  SyncDateFilter,
} from './SyncDataDateModal';

export interface ClassroomSeatStudent {
  id: string;
  seatNumber: number;
  namaSiswa: string;
  nisNisn: string;
  kelas: string;
  semester: 'Ganjil' | 'Genap';
  deviceCategory: string;
  deviceBrand: string;
  deviceModel: string;
  deviceInfo: string;
  photoUrl?: string;
  attendanceStatus: 'Hadir - Siap Ujian' | 'Sedang Ujian' | 'Selesai Ujian' | 'Izin / Sakit';
  skorBenar: number;
  totalSoal: number;
  nilaiAkhir: number;
  statusKecurangan: string;
  lulusTidakLulus: string;
  includeInRekap: boolean;
  updatedAt: string;
}

export type ClassroomLayoutMode = 'CBT_LAB' | 'PAIRED_DESK' | 'EXAM_GRID' | 'U_SHAPE';

interface ClassroomRoomConfig {
  kelas: string;
  capacity: number;
  columns: number;
  layoutMode: ClassroomLayoutMode;
  roomName: string;
}

interface ClassroomDesignViewProps {
  submissions: StudentSubmission[];
  onUpdateSubmissions: (updated: StudentSubmission[]) => void;
  onSelectStudentForExam: (student: {
    namaSiswa: string;
    nisNisn: string;
    kelas: string;
    semester: 'Ganjil' | 'Genap';
  }) => void;
  onBackToHome: () => void;
  onOpenStudentDashboard: () => void;
  darkMode: boolean;
  isTeacherAuthenticated?: boolean;
  googleUserEmail?: string | null;
  isSyncingLoginSheet?: boolean;
  isLoginRekapSyncAnimated?: boolean;
  loginSheetSyncTime?: string | null;
  loginSheetSyncToast?: string | null;
  onSyncAllToGoogleSheets?: () => void;
  onSyncDeviceToGoogleSheets?: () => void;
  isDetectingDevice?: boolean;
  isDeviceRedetectAnimated?: boolean;
  deviceRedetectToast?: string | null;
  onRefreshDeviceDetection?: () => void;
  isLoginDeviceSyncAnimated?: boolean;
  syncTriggerSource?: string | null;
  effectiveDeviceModel?: string;
  customDeviceModelOverride?: string;
  onChangeCustomDeviceModelOverride?: (val: string) => void;
  onOpenQrScanner?: () => void;
  isQrCameraActive?: boolean;
}

const ALL_KELAS_LIST = [
  'VII-1',
  'VII-2',
  'VII-3',
  'VII-4',
  'VII-5',
  'VIII-1',
  'VIII-2',
  'VIII-3',
  'VIII-4',
  'VIII-5',
  'VIII-6',
];

const KELAS_VII_LIST = ['VII-1', 'VII-2', 'VII-3', 'VII-4', 'VII-5'];
const KELAS_VIII_LIST = ['VIII-1', 'VIII-2', 'VIII-3', 'VIII-4', 'VIII-5', 'VIII-6'];
const TEACHER_VERIFIED_SESSION_KEY = 'anbk_teacher_verified_session_v1';

const STORAGE_KEY_CONFIGS = 'anbk_classroom_room_configs_v1';
const STORAGE_KEY_CLASSROOM_CHAT_BY_ROOM = 'anbk_classroom_chat_by_room_v2';
const FIRESTORE_CHAT_COLLECTION = 'classroomChats';
const getFirestoreChatDocIdForKelas = (kelas: string) =>
  `room_${getCleanKelas(kelas).replace(/[^A-Za-z0-9_-]/g, '_')}`;
const getFirestoreRoomDocId = getFirestoreChatDocIdForKelas;
const getBackupSyncDocId = (kelas: string) => `classroomChat_${getCleanKelas(kelas)}`;

export interface ClassroomChatMessage {
  id: string;
  senderName: string;
  senderNis?: string;
  senderKelas: string;
  senderSemester?: 'Ganjil' | 'Genap';
  senderSeatNumber?: number;
  senderDevice?: string;
  senderPhotoUrl?: string;
  senderRole: 'SISWA' | 'GURU';
  targetRoom: string; // 'SEMUA_KELAS' atau kode kelas 'VII-1' .. 'VIII-6'
  recipientName?: string;
  recipientNis?: string;
  recipientKelas?: string;
  recipientSeatNumber?: number;
  text: string;
  timestamp: string;
  createdAtMs: number;
  isBroadcast?: boolean;
  broadcastScopeLabel?: string;
  broadcastCategory?: string;
  verifiedTeacherIdentity?: string;
  replyTo?: {
    id: string;
    senderName: string;
    senderNis?: string;
    senderKelas: string;
    senderSeatNumber?: number;
    text: string;
  };
  reactions?: Record<string, number>;
}

const DEFAULT_STUDENT_REPRESENTATIVES_BY_KELAS: Record<
  string,
  {
    nama: string;
    nis: string;
    seat: number;
    device: string;
    semester: 'Ganjil' | 'Genap';
    partnerNama: string;
    partnerNis: string;
  }
> = {
  'VII-1': {
    nama: 'Dimas Pratama Putra',
    nis: '0114582901',
    seat: 1,
    device: 'HP Android · Samsung Galaxy A15',
    semester: 'Ganjil',
    partnerNama: 'Nadia Putri Siregar',
    partnerNis: '0114582911',
  },
  'VII-2': {
    nama: 'Aulia Rahmadani',
    nis: '0114582902',
    seat: 2,
    device: 'HP Android · Xiaomi Redmi Note 13',
    semester: 'Ganjil',
    partnerNama: 'Reza Pahlevi Lubis',
    partnerNis: '0114582912',
  },
  'VII-3': {
    nama: 'Fajar Nugroho',
    nis: '0114582903',
    seat: 3,
    device: 'HP Android · OPPO A58',
    semester: 'Ganjil',
    partnerNama: 'Intan Permata Sari',
    partnerNis: '0114582913',
  },
  'VII-4': {
    nama: 'Siti Nurhaliza Siregar',
    nis: '0114582904',
    seat: 1,
    device: 'HP Android · Vivo Y27',
    semester: 'Ganjil',
    partnerNama: 'Kevin Pratama Sinaga',
    partnerNis: '0114582914',
  },
  'VII-5': {
    nama: 'Bagas Adi Saputra',
    nis: '0114582905',
    seat: 4,
    device: 'Laptop Windows · ASUS VivoBook 14',
    semester: 'Ganjil',
    partnerNama: 'Melisa Anggraini',
    partnerNis: '0114582915',
  },
  'VIII-1': {
    nama: 'Andi Pratama Sinaga',
    nis: '0108823411',
    seat: 1,
    device: 'HP Android · Samsung Galaxy A15',
    semester: 'Ganjil',
    partnerNama: 'Bunga Citra Sitorus',
    partnerNis: '0108823421',
  },
  'VIII-2': {
    nama: 'Citra Lestari Hasibuan',
    nis: '0108823412',
    seat: 2,
    device: 'HP Android · Xiaomi Redmi Note 13',
    semester: 'Ganjil',
    partnerNama: 'Daffa Alfarizi Nasution',
    partnerNis: '0108823422',
  },
  'VIII-3': {
    nama: 'Rizky Ramadhan Panjaitan',
    nis: '0108823413',
    seat: 1,
    device: 'Chromebook Sekolah · Zyrex Chromebook ANBK',
    semester: 'Ganjil',
    partnerNama: 'Tiara Maharani Harahap',
    partnerNis: '0108823423',
  },
  'VIII-4': {
    nama: 'Nabila Putri Tanjung',
    nis: '0108823414',
    seat: 3,
    device: 'HP Android · Realme C55',
    semester: 'Ganjil',
    partnerNama: 'Gilang Saputra Pasaribu',
    partnerNis: '0108823424',
  },
  'VIII-5': {
    nama: 'Muhammad Farhan Lubis',
    nis: '0108823415',
    seat: 2,
    device: 'Laptop Windows · Acer Aspire 5',
    semester: 'Ganjil',
    partnerNama: 'Syifa Aulia Manurung',
    partnerNis: '0108823425',
  },
  'VIII-6': {
    nama: 'Putri Ayu Maharani Sitorus',
    nis: '0108823416',
    seat: 1,
    device: 'HP Android · Samsung Galaxy A15',
    semester: 'Ganjil',
    partnerNama: 'Rafael Valentino Siahaan',
    partnerNis: '0108823426',
  },
};

function buildInitialMessagesForRoom(kelas: string): ClassroomChatMessage[] {
  const cleanKls = getCleanKelas(kelas);
  const rep = DEFAULT_STUDENT_REPRESENTATIVES_BY_KELAS[cleanKls] || {
    nama: `Andi Pratama (${cleanKls})`,
    nis: '0108823400',
    seat: 1,
    device: 'HP Android · Samsung Galaxy A15',
    semester: 'Ganjil' as const,
  };

  return [
    {
      id: `chat-init-proktor-${cleanKls}`,
      senderName: 'Meja Guru & Proktor · Eksa Yudika Sirait S.T',
      senderNis: 'NIP/Meja-Guru-ANBK',
      senderKelas: cleanKls,
      senderSemester: rep.semester,
      senderDevice: 'Konsol Meja Guru Utama CBT (Terhubung 11 Kelas)',
      senderRole: 'GURU',
      targetRoom: cleanKls,
      recipientName: `Seluruh Siswa Ruang Kelas ${cleanKls}`,
      recipientKelas: cleanKls,
      text: `📢 [KONEKSI MEJA GURU ➔ KELAS ${cleanKls}] Selamat datang di Ruang Diskusi Aman Kelas ${cleanKls}! Meja Guru terhubung langsung secara real-time ke setiap ruang kelas (VII-1 s/d VIII-6). Siswa Kelas ${cleanKls} dapat berdiskusi dengan teman sekelas maupun bertanya langsung ke Meja Guru di ruang ini.`,
      timestamp: '07:30 · Hari Ini',
      createdAtMs: 1700000001000,
      reactions: { '👍': 4, '✅': 3 },
    },
    {
      id: `chat-init-rep-${cleanKls}`,
      senderName: rep.nama,
      senderNis: rep.nis,
      senderKelas: cleanKls,
      senderSemester: rep.semester,
      senderSeatNumber: rep.seat,
      senderDevice: rep.device,
      senderRole: 'SISWA',
      targetRoom: cleanKls,
      recipientName: `Meja Guru & Teman Sekelas Ruang ${cleanKls}`,
      recipientKelas: cleanKls,
      text: `Halo Pak Guru di Meja Guru dan teman-teman satu kelas ${cleanKls}! Saya ${rep.nama} (Meja #${rep.seat}) sudah siap mengikuti ujian ANBK Informatika di Ruang Kelas ${cleanKls}. 🔥`,
      timestamp: '07:32 · Hari Ini',
      createdAtMs: 1700000002000,
      reactions: { '🔥': 4, '👏': 3 },
    },
  ];
}

function buildInitialMessagesByRoomMap(): Record<string, ClassroomChatMessage[]> {
  const out: Record<string, ClassroomChatMessage[]> = {};
  ALL_KELAS_LIST.forEach((kls) => {
    out[kls] = buildInitialMessagesForRoom(kls);
  });
  return out;
}

const QUICK_CHAT_TEMPLATES = [
  '👋 Halo teman-teman satu kelas, semangat ujian ANBK Informatika hari ini!',
  '🙋 Pak Guru di Meja Guru, izin bertanya untuk ruang kelas kami apakah token sudah aktif?',
  '✅ Saya sudah mengisi bangku ujian di kelas kita!',
  '🤝 Mari kita berdiskusi kisi-kisi materi Informatika sebelum ujian dimulai!',
];

const TEACHER_DESK_QUICK_TEMPLATES = [
  '📢 [INSTRUKSI MEJA GURU] Seluruh siswa harap menempati nomor bangku masing-masing dan menyiapkan perangkat.',
  '🔑 [MEJA GURU] Token ujian ANBK Informatika sudah aktif, silakan mulai mengerjakan dengan tertib & jujur.',
  '⏰ [PERINGATAN MEJA GURU] Waktu ujian tersisa 15 menit, periksa kembali seluruh jawaban sebelum klik Selesai.',
  '✅ [APRESIASI MEJA GURU] Terima kasih kepada seluruh siswa di ruang kelas ini yang telah tertib mengerjakan ujian!',
];

const DEVICE_PRESETS = [
  {
    label: 'Deteksi Otomatis Perangkat Ini',
    category: 'AUTO',
    brand: 'AUTO',
    model: 'AUTO',
  },
  {
    label: 'HP Android · Samsung Galaxy A15',
    category: 'HP Android',
    brand: 'Samsung',
    model: 'Samsung Galaxy A15',
  },
  {
    label: 'HP Android · Xiaomi Redmi Note 13',
    category: 'HP Android',
    brand: 'Xiaomi / Redmi',
    model: 'Xiaomi Redmi Note 13',
  },
  {
    label: 'HP Android · OPPO A58',
    category: 'HP Android',
    brand: 'OPPO',
    model: 'OPPO A58',
  },
  {
    label: 'HP Android · Vivo Y27',
    category: 'HP Android',
    brand: 'Vivo',
    model: 'Vivo Y27',
  },
  {
    label: 'HP Android · Realme C55',
    category: 'HP Android',
    brand: 'Realme',
    model: 'Realme C55',
  },
  {
    label: 'HP Android · Infinix Hot 40i',
    category: 'HP Android',
    brand: 'Infinix',
    model: 'Infinix Hot 40i',
  },
  {
    label: 'HP iPhone · Apple iPhone 13',
    category: 'HP iPhone (iOS)',
    brand: 'Apple',
    model: 'Apple iPhone 13',
  },
  {
    label: 'Laptop Windows · ASUS VivoBook 14',
    category: 'Laptop / PC Windows',
    brand: 'ASUS',
    model: 'ASUS VivoBook 14 (Windows 11)',
  },
  {
    label: 'Laptop Windows · Acer Aspire 5',
    category: 'Laptop / PC Windows',
    brand: 'Acer',
    model: 'Acer Aspire 5 (Windows 11)',
  },
  {
    label: 'Laptop Windows · Lenovo IdeaPad Slim 3',
    category: 'Laptop / PC Windows',
    brand: 'Lenovo',
    model: 'Lenovo IdeaPad Slim 3',
  },
  {
    label: 'Chromebook Sekolah · Zyrex Chromebook ANBK',
    category: 'Laptop Chromebook',
    brand: 'Zyrex',
    model: 'Zyrex Chromebook ANBK (ChromeOS)',
  },
  {
    label: 'PC Lab Komputer · All-in-One Desktop CBT',
    category: 'Laptop / PC Windows',
    brand: 'HP / Dell Lab CBT',
    model: 'PC Desktop Lab Komputer CBT',
  },
  {
    label: 'Tablet Android · Samsung Galaxy Tab A9',
    category: 'Tablet Android',
    brand: 'Samsung',
    model: 'Samsung Galaxy Tab A9',
  },
];

export const ClassroomDesignView: React.FC<ClassroomDesignViewProps> = ({
  submissions,
  onUpdateSubmissions,
  onSelectStudentForExam,
  onBackToHome,
  onOpenStudentDashboard,
  darkMode = true,
  isTeacherAuthenticated = false,
  googleUserEmail = null,
  isSyncingLoginSheet = false,
  isLoginRekapSyncAnimated = false,
  loginSheetSyncTime = null,
  loginSheetSyncToast = null,
  onSyncAllToGoogleSheets,
  onSyncDeviceToGoogleSheets,
  isDetectingDevice = false,
  isDeviceRedetectAnimated = false,
  deviceRedetectToast = null,
  onRefreshDeviceDetection,
  isLoginDeviceSyncAnimated = false,
  syncTriggerSource = null,
  effectiveDeviceModel,
  customDeviceModelOverride = '',
  onChangeCustomDeviceModelOverride,
  onOpenQrScanner,
  isQrCameraActive = false,
}) => {
  const detectedDevice = useMemo(() => detectStudentDeviceSync(), []);

  // Kelas aktif yang sedang didesain (Otomatis menyesuaikan jika ada siswa yang baru disinkronkan dari Formulir Ujian)
  const [selectedKelas, setSelectedKelas] = useState<string>(() => {
    const active = getStoredActiveSync();
    return active?.kelas ? getCleanKelas(active.kelas) : 'VIII-1';
  });
  const [selectedSemester, setSelectedSemester] = useState<'Ganjil' | 'Genap'>(() => {
    const active = getStoredActiveSync();
    return active?.semester || 'Ganjil';
  });

  // State sinkronisasi aktif dari Formulir Login Siswa
  const [activeSyncedStudentBanner, setActiveSyncedStudentBanner] = useState<ActiveClassroomStudentSyncData | null>(
    () => getStoredActiveSync()
  );

  // Konfigurasi tata letak per kelas
  const [roomConfigs, setRoomConfigs] = useState<Record<string, ClassroomRoomConfig>>(() => {
    const initial: Record<string, ClassroomRoomConfig> = {};
    ALL_KELAS_LIST.forEach((k) => {
      initial[k] = {
        kelas: k,
        capacity: 32,
        columns: 4,
        layoutMode: 'CBT_LAB',
        roomName: `Ruang Kelas ${k} (Lab CBT ANBK)`,
      };
    });
    try {
      const raw = localStorage.getItem(STORAGE_KEY_CONFIGS);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          return { ...initial, ...parsed };
        }
      }
    } catch {
      // ignore
    }
    return initial;
  });

  // Daftar siswa yang diinput di dalam Design Classroom (Tersinkron dengan Submissions)
  // HANYA siswa yang sudah menyelesaikan semua soal ujian dan dinyatakan LULUS UJIAN (minimal KKM 75) yang dapat masuk ke denah kelas & mengisi bangku kosong
  const [classroomStudents, setClassroomStudents] = useState<ClassroomSeatStudent[]>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_STUDENTS);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const validPassedList = parsed.filter(
            (st: ClassroomSeatStudent) =>
              st &&
              typeof st.nilaiAkhir === 'number' &&
              st.nilaiAkhir >= EXAM_INFO.kkm &&
              !String(st.lulusTidakLulus || '').toLowerCase().includes('tidak') &&
              !String(st.statusKecurangan || '').toLowerCase().includes('diskualifikasi')
          );
          if (validPassedList.length > 0) {
            return validPassedList;
          }
        }
      }
    } catch {
      // ignore
    }

    // Inisialisasi awal dari submissions yang sudah ada (HANYA siswa yang LULUS UJIAN minimal KKM 75)
    const seatCounterByKelas: Record<string, number> = {};
    const passedSubs = submissions.filter(
      (sub) =>
        sub.isCompleted !== false &&
        (sub.nilaiAkhir ?? 0) >= EXAM_INFO.kkm &&
        !String(sub.lulusTidakLulus || '').toLowerCase().includes('tidak') &&
        !String(sub.statusKecurangan || '').toLowerCase().includes('diskualifikasi')
    );
    return passedSubs.map((sub, idx) => {
      const cleanKls = getCleanKelas(sub.kelas) || 'VIII-1';
      seatCounterByKelas[cleanKls] = (seatCounterByKelas[cleanKls] || 0) + 1;
      const resolvedSubPhoto =
        sub.photoUrl || getPhotoForStudentIdentity(sub.namaSiswa, sub.nisNisn, false) || undefined;
      return {
        id: sub.id || `CLS-INIT-${idx + 1}`,
        seatNumber: seatCounterByKelas[cleanKls],
        namaSiswa: sub.namaSiswa,
        nisNisn: sub.nisNisn,
        kelas: cleanKls,
        semester: getSemesterFromSub(sub),
        deviceCategory: sub.deviceCategory || 'HP Android',
        deviceBrand: sub.deviceBrand || 'Samsung',
        deviceModel: sub.deviceModel || sub.deviceInfo || 'HP Android Siswa',
        deviceInfo:
          sub.deviceInfo ||
          [sub.deviceCategory, sub.deviceModel, sub.deviceOsBrowser].filter(Boolean).join(' - ') ||
          'HP Android - Chrome Mobile',
        photoUrl: resolvedSubPhoto,
        attendanceStatus: 'Selesai Ujian',
        skorBenar: sub.skorBenar ?? 20,
        totalSoal: sub.totalSoal ?? (EXAM_INFO.totalSoal ?? 25),
        nilaiAkhir: sub.nilaiAkhir ?? 80,
        statusKecurangan: sub.statusKecurangan || 'Tidak Ada Kecurangan (Jujur / Bersih)',
        lulusTidakLulus: 'Lulus Ujian',
        includeInRekap: true,
        updatedAt: sub.timestamp || new Date().toLocaleString('id-ID'),
      };
    });
  });

  // Simpan perubahan konfigurasi ruangan ke localStorage (lewati mount awal agar tidak memblokir main thread)
  const isInitialConfigsMountRef = useRef(true);
  useEffect(() => {
    if (isInitialConfigsMountRef.current) {
      isInitialConfigsMountRef.current = false;
      return;
    }
    try {
      localStorage.setItem(STORAGE_KEY_CONFIGS, JSON.stringify(roomConfigs));
    } catch {
      // ignore
    }
  }, [roomConfigs]);

  // Simpan perubahan daftar siswa ruangan ke localStorage & sinkronkan ke Firestore per kelas
  const isInitialStudentsMountRef = useRef(true);
  useEffect(() => {
    if (isInitialStudentsMountRef.current) {
      isInitialStudentsMountRef.current = false;
      return;
    }
    const localTimer = window.setTimeout(() => {
      try {
        localStorage.setItem(STORAGE_KEY_STUDENTS, JSON.stringify(classroomStudents));
      } catch {
        // ignore
      }
    }, 100);

    const cleanRoom = getCleanKelas(selectedKelas);
    const roomSeats = classroomStudents
      .filter((s) => getCleanKelas(s.kelas) === cleanRoom)
      .slice(0, 60);
    if (roomSeats.length === 0) {
      return () => window.clearTimeout(localTimer);
    }

    const seatDocId = `seats_${cleanRoom.replace(/[^A-Za-z0-9_-]/g, '_')}`;
    const syncTimer = window.setTimeout(() => {
      firestoreRestWriteDoc(
        'classroomSeats',
        seatDocId,
        {
          kelas: cleanRoom,
          seats: roomSeats,
          updatedAt: Date.now(),
        },
        3500
      ).catch(() => {
        // ignore offline/fallback
      });
    }, 600);

    return () => {
      window.clearTimeout(localTimer);
      window.clearTimeout(syncTimer);
    };
  }, [classroomStudents, selectedKelas]);

  // Sinkronkan foto terbaru dari submissions ke bangku siswa yang cocok agar foto dari perangkat lain / Google Sheets / Server ikut muncul di bangku
  useEffect(() => {
    if (!submissions || submissions.length === 0) return;
    setClassroomStudents((prev) => {
      let changed = false;
      const next = prev.map((seatSt) => {
        const matchedSub = submissions.find(
          (sub) =>
            (sub.id && sub.id === seatSt.id) ||
            (getCleanKelas(sub.kelas) === getCleanKelas(seatSt.kelas) &&
              ((seatSt.nisNisn &&
                seatSt.nisNisn !== '-' &&
                sub.nisNisn.trim().toLowerCase() === seatSt.nisNisn.trim().toLowerCase()) ||
                (seatSt.namaSiswa &&
                  sub.namaSiswa.trim().toLowerCase() === seatSt.namaSiswa.trim().toLowerCase())))
        );
        const identityPhoto = getPhotoForStudentIdentity(seatSt.namaSiswa, seatSt.nisNisn, false);
        const bestPhoto = identityPhoto || seatSt.photoUrl || matchedSub?.photoUrl || undefined;
        if (bestPhoto && bestPhoto !== seatSt.photoUrl) {
          changed = true;
          return {
            ...seatSt,
            photoUrl: bestPhoto,
          };
        }
        return seatSt;
      });
      return changed ? next : prev;
    });
  }, [submissions]);

  // State Modal Kamera & Pratinjau Wajah Siswa di Bangku Kelas
  const [showSeatCameraModal, setShowSeatCameraModal] = useState<boolean>(false);
  const [zoomedSeatPhotoStudent, setZoomedSeatPhotoStudent] = useState<{
    seatNumber: number;
    namaSiswa: string;
    nisNisn: string;
    kelas: string;
    semester: 'Ganjil' | 'Genap';
    deviceInfo: string;
    attendanceStatus: string;
    nilaiAkhir: number;
    photoUrl: string;
  } | null>(null);
  const [seatPhotoInput, setSeatPhotoInput] = useState<string>(() => {
    const active = getStoredActiveSync();
    const prof = loadStoredStudentProfile();
    if (active?.photoUrl) return active.photoUrl;
    if (active?.namaSiswa) {
      const p = getPhotoForStudentIdentity(active.namaSiswa, active.nisNisn, true);
      if (p) return p;
    }
    return prof.photoDataUrl || '';
  });

  // Helper akurat untuk mendapatkan Foto Wajah Siswa yang duduk di bangkunya
  const resolveSeatStudentPhoto = useCallback(
    (
      student?: ClassroomSeatStudent | null
    ): {
      url: string;
      hasCustomCameraPhoto: boolean;
    } => {
      if (!student) {
        return { url: '', hasCustomCameraPhoto: false };
      }

      if (student.photoUrl && student.photoUrl.trim()) {
        return { url: student.photoUrl, hasCustomCameraPhoto: true };
      }

      const fromIdentityMap = getPhotoForStudentIdentity(
        student.namaSiswa,
        student.nisNisn,
        false
      );
      if (fromIdentityMap) {
        return { url: fromIdentityMap, hasCustomCameraPhoto: true };
      }

      // Cek apakah bangku ini adalah bangku aktif dari profil siswa yang sedang login di perangkat ini
      const storedProf = loadStoredStudentProfile();
      if (storedProf.photoDataUrl) {
        const cleanStName = (student.namaSiswa || '').trim().toLowerCase();
        const cleanStNis = (student.nisNisn || '').trim().toLowerCase();
        const cleanProfName = (storedProf.namaSiswa || '').trim().toLowerCase();
        const cleanProfNis = (storedProf.nisNisn || '').trim().toLowerCase();
        const isSameActiveSeat =
          activeSyncedStudentBanner &&
          getCleanKelas(activeSyncedStudentBanner.kelas) === getCleanKelas(student.kelas) &&
          activeSyncedStudentBanner.seatNumber === student.seatNumber;

        if (
          isSameActiveSeat ||
          (cleanStName && cleanProfName && cleanStName === cleanProfName) ||
          (cleanStNis && cleanProfNis && cleanStNis !== '-' && cleanStNis === cleanProfNis)
        ) {
          return { url: storedProf.photoDataUrl, hasCustomCameraPhoto: true };
        }
      }

      const matchedSub = submissions.find(
        (sub) =>
          (sub.id && sub.id === student.id) ||
          (getCleanKelas(sub.kelas) === getCleanKelas(student.kelas) &&
            ((student.nisNisn &&
              student.nisNisn !== '-' &&
              sub.nisNisn.trim().toLowerCase() === student.nisNisn.trim().toLowerCase()) ||
              (student.namaSiswa &&
                sub.namaSiswa.trim().toLowerCase() === student.namaSiswa.trim().toLowerCase())))
      );
      if (matchedSub?.photoUrl) {
        return { url: matchedSub.photoUrl, hasCustomCameraPhoto: true };
      }

      const fallbackAvatar = generateFormalStudentAvatarDataUrl(
        student.namaSiswa || 'Siswa',
        getCleanKelas(student.kelas) || 'VIII-1',
        'putra',
        student.seatNumber % 2 === 0 ? 'biru' : 'merah'
      );
      return {
        url: fallbackAvatar,
        hasCustomCameraPhoto: false,
      };
    },
    [submissions, activeSyncedStudentBanner]
  );

  const currentRoomConfig: ClassroomRoomConfig = roomConfigs[selectedKelas] || {
    kelas: selectedKelas,
    capacity: 32,
    columns: 4,
    layoutMode: 'CBT_LAB',
    roomName: `Ruang Kelas ${selectedKelas} (Lab CBT ANBK)`,
  };

  const studentsInSelectedKelas = useMemo(
    () =>
      classroomStudents
        .filter((s) => getCleanKelas(s.kelas) === selectedKelas)
        .sort((a, b) => a.seatNumber - b.seatNumber),
    [classroomStudents, selectedKelas]
  );

  // Cari nomor kursi kosong pertama di kelas aktif
  const findFirstEmptySeat = (kls: string, cap: number, list = classroomStudents): number => {
    const occupied = new Set(
      list.filter((s) => getCleanKelas(s.kelas) === kls).map((s) => s.seatNumber)
    );
    for (let i = 1; i <= cap; i++) {
      if (!occupied.has(i)) return i;
    }
    return cap + 1;
  };

  // State Form Input Manual Siswa
  const [editingStudentId, setEditingStudentId] = useState<string | null>(() => {
    const active = getStoredActiveSync();
    if (active && active.namaSiswa) {
      try {
        const raw = localStorage.getItem(STORAGE_KEY_STUDENTS);
        if (raw) {
          const list = JSON.parse(raw);
          if (Array.isArray(list)) {
            const found = list.find(
              (s: any) =>
                getCleanKelas(s.kelas) === getCleanKelas(active.kelas) &&
                (s.seatNumber === active.seatNumber ||
                  (s.namaSiswa && s.namaSiswa.trim().toLowerCase() === active.namaSiswa.trim().toLowerCase()))
            );
            if (found) return found.id;
          }
        }
      } catch {}
    }
    return null;
  });
  const [seatNumberInput, setSeatNumberInput] = useState<number>(() => {
    const active = getStoredActiveSync();
    if (active?.seatNumber) return active.seatNumber;
    return findFirstEmptySeat('VIII-1', 32);
  });
  const [namaSiswaInput, setNamaSiswaInput] = useState<string>(() => {
    const active = getStoredActiveSync();
    return active?.namaSiswa || '';
  });
  const [nisNisnInput, setNisNisnInput] = useState<string>(() => {
    const active = getStoredActiveSync();
    const storedProf = loadStoredStudentProfile();
    const rawNis = (active?.nisNisn || '').trim();
    // Jangan tampilkan angka acak 00xxxxxxxx yang ter-generate otomatis tanpa diinput siswa
    if (/^00\d{8}$/.test(rawNis) && (!storedProf.nisNisn || !storedProf.nisNisn.trim())) {
      return '';
    }
    return rawNis;
  });
  const [devicePresetIndex, setDevicePresetIndex] = useState<number>(0);
  const [customDeviceCategory, setCustomDeviceCategory] = useState<string>(
    detectedDevice.deviceCategory
  );
  const [customDeviceBrand, setCustomDeviceBrand] = useState<string>(detectedDevice.brand);
  const [customDeviceModel, setCustomDeviceModel] = useState<string>(detectedDevice.modelType);
  const [attendanceStatusInput, setAttendanceStatusInput] = useState<
    'Hadir - Siap Ujian' | 'Sedang Ujian' | 'Selesai Ujian' | 'Izin / Sakit'
  >('Selesai Ujian');
  const [skorBenarInput, setSkorBenarInput] = useState<number>(20);
  const [totalSoalInput, setTotalSoalInput] = useState<number>(EXAM_INFO.totalSoal ?? 25);
  const [statusKecuranganInput, setStatusKecuranganInput] = useState<string>(
    'Tidak Ada Kecurangan (Jujur / Bersih)'
  );
  const [syncToRekapChecked, setSyncToRekapChecked] = useState<boolean>(true);

  // Status Auto-Save Otomatis Tanpa Perlu Tekan Tombol Simpan Bangku
  const [autoSaveStatus, setAutoSaveStatus] = useState<'IDLE' | 'SAVING' | 'SAVED'>('SAVED');
  const [lastAutoSavedTime, setLastAutoSavedTime] = useState<string>('');

  // Mode Input Massal (Bulk Input Manual)
  const [showBulkModal, setShowBulkModal] = useState<boolean>(false);
  const [bulkTextInput, setBulkTextInput] = useState<string>('');

  // Mode Tukar / Pindah Bangku (Swap Seat)
  const [swapSourceSeat, setSwapSourceSeat] = useState<number | null>(null);

  // Filter & Pencarian Tabel Siswa di Kelas
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Modal Pilihan Data Sinkronisasi (Tanggal, Bulan, Tahun)
  const [showSyncDateModal, setShowSyncDateModal] = useState<boolean>(false);

  const handleConfirmClassroomSyncFromModal = (
    _filter: SyncDateFilter,
    _filteredSubs: StudentSubmission[]
  ) => {
    setShowSyncDateModal(false);
    handleSyncAllClassroomToRekap();
    onSyncAllToGoogleSheets?.();
  };

  // Proteksi Link Siswa: Perbaharui otomatis & tersimpan otomatis ke sistem (localStorage, cloudConfig, & Firestore)
  // 1) Murid TIDAK BISA menghapus bangku siswa lain, bangku satu kelas, maupun denah kelas lain/sama
  // 2) Murid TIDAK BISA menambah ke kelas lainnya maupun kelas yang sama setelah mengisi 1 kali
  // 3) Setiap siswa HANYA berhak mengisi data HANYA 1 KALI setiap siswa
  // 4) Fitur Delete Bangku Siswa TIDAK BISA diakses oleh siswa
  const [studentShareUrl, setStudentShareUrl] = useState<string>(() =>
    getStoredStudentShareUrl()
  );
  const [isEditingShareUrl, setIsEditingShareUrl] = useState<boolean>(false);
  const [shareUrlInput, setShareUrlInput] = useState<string>(() =>
    getStoredStudentShareUrl()
  );
  const [shareUrlSavedToast, setShareUrlSavedToast] = useState<string | null>(null);

  // Pantau perubahan link otomatis dari Broadcast / tab lain / Firestore
  useEffect(() => {
    const handleUrlUpdated = (e: Event) => {
      const customEvt = e as CustomEvent<string>;
      const freshUrl = customEvt.detail || getStoredStudentShareUrl();
      if (freshUrl && freshUrl !== studentShareUrl) {
        setStudentShareUrl(freshUrl);
        setShareUrlInput(freshUrl);
      }
    };
    window.addEventListener(STUDENT_SHARE_URL_EVENT, handleUrlUpdated);
    window.addEventListener('storage', handleUrlUpdated);
    return () => {
      window.removeEventListener(STUDENT_SHARE_URL_EVENT, handleUrlUpdated);
      window.removeEventListener('storage', handleUrlUpdated);
    };
  }, [studentShareUrl]);

  // Perbaharui otomatis link: setiap kali diubah, link yang dirubah langsung tersimpan otomatis ke sistem
  const handleAutoUpdateShareUrl = async (newUrl: string) => {
    const clean = newUrl.trim();
    setShareUrlInput(clean);
    if (!clean) return;
    setStudentShareUrl(clean);
    await saveStudentShareUrl(clean);
    setShareUrlSavedToast('✓ Tersimpan di Sistem!');
    setTimeout(() => {
      setShareUrlSavedToast(null);
    }, 2500);
  };

  const handleUseCurrentOriginUrl = async () => {
    let currentOrigin = '';
    if (typeof window !== 'undefined' && window.location) {
      currentOrigin = window.location.origin;
    }
    const target =
      currentOrigin && !currentOrigin.includes('localhost')
        ? currentOrigin
        : DEFAULT_OFFICIAL_STUDENT_SHARE_URL;
    setShareUrlInput(target);
    await handleAutoUpdateShareUrl(target);
    triggerToast(`✓ Link diperbarui ke URL saat ini & tersimpan otomatis: ${target}`);
  };

  const STUDENT_ONCE_LOCK_KEY = 'anbk_student_seat_once_lock_v1';

  const [studentSubmittedSeatLock, setStudentSubmittedSeatLock] = useState<{
    id: string;
    namaSiswa: string;
    nisNisn: string;
    kelas: string;
    semester: 'Ganjil' | 'Genap';
    seatNumber: number;
    submittedAt: string;
  } | null>(() => {
    try {
      const raw = localStorage.getItem('anbk_student_seat_once_lock_v1');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && parsed.namaSiswa && parsed.kelas) {
          return parsed;
        }
      }
    } catch {
      // ignore
    }
    return null;
  });

  const [isTeacherSeatDeleteUnlocked, setIsTeacherSeatDeleteUnlocked] = useState<boolean>(() => {
    if (isTeacherAuthenticated) return true;
    try {
      const stored = sessionStorage.getItem(TEACHER_VERIFIED_SESSION_KEY);
      return stored === 'true';
    } catch {
      return false;
    }
  });
  const [liveGoogleTeacherEmail, setLiveGoogleTeacherEmail] = useState<string | null>(() => {
    const u = getCurrentGoogleUser();
    return u?.email || googleUserEmail || null;
  });
  const [isVerifyingGoogleTeacher, setIsVerifyingGoogleTeacher] = useState<boolean>(false);
  const [showTeacherSeatLockModal, setShowTeacherSeatLockModal] = useState<boolean>(false);
  const [teacherSeatPasswordInput, setTeacherSeatPasswordInput] = useState<string>('');
  const [showSeatPass, setShowSeatPass] = useState<boolean>(false);
  const [teacherSeatPasswordError, setTeacherSeatPasswordError] = useState<string | null>(null);
  const [lockedSeatActionReason, setLockedSeatActionReason] = useState<string>(
    'Mengirim pesan siaran atau membalas pesan di ruang chat masing-masing kelas sebagai Guru'
  );
  const [shareUrlCopied, setShareUrlCopied] = useState<boolean>(false);

  // Pantau status otentikasi Google resmi (jika email cocok dengan EXAM_INFO.teacherEmail, otomatis teridentifikasi sebagai Guru)
  useEffect(() => {
    if (googleUserEmail) {
      setLiveGoogleTeacherEmail(googleUserEmail);
    }
    const unsub = initAuth(
      (user) => {
        if (user?.email) {
          setLiveGoogleTeacherEmail(user.email);
        }
      },
      () => {
        // tetap pertahankan jika sudah login via password guru
      }
    );
    return () => unsub();
  }, [googleUserEmail]);

  const isGoogleEmailIdentifiedAsTeacher = useMemo(() => {
    const cleanEmail = (liveGoogleTeacherEmail || googleUserEmail || '').trim().toLowerCase();
    return Boolean(
      cleanEmail && cleanEmail === EXAM_INFO.teacherEmail.trim().toLowerCase()
    );
  }, [liveGoogleTeacherEmail, googleUserEmail]);

  // IDENTIFIKASI PENGGUNA SEBAGAI GURU: Hanya bernilai true jika terverifikasi via Sandi Guru, Mode Guru, atau Email Resmi Guru (eksayudikasirait@gmail.com)
  const isIdentifiedAsTeacher = Boolean(
    isTeacherSeatDeleteUnlocked || isTeacherAuthenticated || isGoogleEmailIdentifiedAsTeacher
  );

  const teacherIdentificationBadgeLabel = useMemo(() => {
    if (!isIdentifiedAsTeacher) {
      return 'Belum Teridentifikasi Sebagai Guru (Mode Siswa)';
    }
    if (isGoogleEmailIdentifiedAsTeacher && isTeacherSeatDeleteUnlocked) {
      return `Teridentifikasi Sebagai Guru (${EXAM_INFO.teacherEmail} & Sandi Guru)`;
    }
    if (isGoogleEmailIdentifiedAsTeacher) {
      return `Teridentifikasi Sebagai Guru (${EXAM_INFO.teacherEmail})`;
    }
    return `Teridentifikasi Sebagai Guru (${EXAM_INFO.guruMapel} · Sandi Terverifikasi)`;
  }, [isIdentifiedAsTeacher, isGoogleEmailIdentifiedAsTeacher, isTeacherSeatDeleteUnlocked]);

  useEffect(() => {
    if (isGoogleEmailIdentifiedAsTeacher && !isTeacherSeatDeleteUnlocked) {
      setIsTeacherSeatDeleteUnlocked(true);
    }
  }, [isGoogleEmailIdentifiedAsTeacher, isTeacherSeatDeleteUnlocked]);

  // Pastikan form input siswa tidak terkunci otomatis agar input manual siswa bebas kendala
  const isStudentLockedByOneTimeQuota = false;

  // Dengarkan sinkronisasi otomatis data siswa & foto profil kamera dari Formulir Login Siswa maupun Modal Kamera Profil
  useEffect(() => {
    const handleClassroomSync = (ev?: Event) => {
      try {
        const customEv = ev as CustomEvent<{
          internalSave?: boolean;
        }>;
        // Abaikan event internal yang dipicu oleh saveStudentDataCore sendiri agar tidak memicu loop berkedip (flickering)
        if (customEv?.detail?.internalSave) {
          return;
        }

        const raw = localStorage.getItem(STORAGE_KEY_STUDENTS);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setClassroomStudents((prev) => {
              if (JSON.stringify(prev) === JSON.stringify(parsed)) return prev;
              return parsed;
            });
          }
        }
        const active = getStoredActiveSync();
        if (active && active.namaSiswa) {
          // Bersihkan angka NISN acak otomatis lama (jika siswa belum menginput NISN asli di profilnya)
          const storedProf = loadStoredStudentProfile();
          const isAutoGeneratedRandomNis =
            Boolean(active.nisNisn) &&
            /^00\d{8}$/.test(active.nisNisn.trim()) &&
            (!storedProf.nisNisn || storedProf.nisNisn.trim() === '');
          const cleanSyncedNis = isAutoGeneratedRandomNis ? '' : active.nisNisn || '';

          const cleanedActive = isAutoGeneratedRandomNis
            ? { ...active, nisNisn: '' }
            : active;

          setActiveSyncedStudentBanner((prev) => {
            if (prev && JSON.stringify(prev) === JSON.stringify(cleanedActive)) return prev;
            return cleanedActive;
          });
          setSelectedKelas((prev) => {
            const nextKls = getCleanKelas(cleanedActive.kelas);
            return prev === nextKls ? prev : nextKls;
          });
          setSelectedSemester((prev) =>
            prev === cleanedActive.semester ? prev : cleanedActive.semester
          );
          setNamaSiswaInput((prev) =>
            prev === cleanedActive.namaSiswa ? prev : cleanedActive.namaSiswa
          );
          setNisNisnInput((prev) => (prev === cleanSyncedNis ? prev : cleanSyncedNis));
          setSeatNumberInput((prev) =>
            prev === cleanedActive.seatNumber ? prev : cleanedActive.seatNumber
          );
          if (cleanedActive.photoUrl) {
            setSeatPhotoInput((prev) =>
              prev === cleanedActive.photoUrl ? prev : cleanedActive.photoUrl!
            );
          } else {
            const idPhoto = getPhotoForStudentIdentity(
              cleanedActive.namaSiswa,
              cleanSyncedNis,
              true
            );
            if (idPhoto) {
              setSeatPhotoInput((prev) => (prev === idPhoto ? prev : idPhoto));
            }
          }
        }
      } catch {
        // ignore
      }
    };

    const handleStudentProfileUpdated = (ev: Event) => {
      try {
        const customEv = ev as CustomEvent<{
          namaSiswa?: string;
          nisNisn?: string;
          kelasSiswa?: string;
          semesterSiswa?: 'Ganjil' | 'Genap';
          photoDataUrl?: string;
        }>;
        const prof = customEv?.detail || loadStoredStudentProfile();
        const pPhoto = prof.photoDataUrl || '';
        const pName = (prof.namaSiswa || '').trim();
        const pNis = (prof.nisNisn || '').trim();
        const pKelas = getCleanKelas(prof.kelasSiswa || selectedKelas);

        setSeatPhotoInput(pPhoto);

        // Otomatis perbarui foto wajah di bangku siswa yang sedang aktif atau memiliki identitas yang sama
        setClassroomStudents((prev) => {
          const active = getStoredActiveSync();
          let updatedAny = false;
          const next = prev.map((st) => {
            const sameName =
              pName && st.namaSiswa.trim().toLowerCase() === pName.toLowerCase();
            const sameNis =
              pNis && pNis !== '-' && st.nisNisn.trim().toLowerCase() === pNis.toLowerCase();
            const sameActiveSeat =
              active &&
              getCleanKelas(st.kelas) === getCleanKelas(active.kelas) &&
              st.seatNumber === active.seatNumber;

            if (sameName || sameNis || sameActiveSeat) {
              updatedAny = true;
              return {
                ...st,
                photoUrl: pPhoto || undefined,
              };
            }
            return st;
          });

          if (updatedAny) {
            try {
              localStorage.setItem(STORAGE_KEY_STUDENTS, JSON.stringify(next));
              if (active) {
                const nextActive = {
                  ...active,
                  photoUrl: pPhoto || undefined,
                };
                localStorage.setItem(STORAGE_KEY_ACTIVE_SYNC, JSON.stringify(nextActive));
                setActiveSyncedStudentBanner(nextActive);
              }
            } catch {
              // ignore
            }
          }
          return updatedAny ? next : prev;
        });
      } catch {
        // ignore
      }
    };

    window.addEventListener(CLASSROOM_SYNC_EVENT, handleClassroomSync);
    window.addEventListener('anbk-student-profile-updated', handleStudentProfileUpdated);
    window.addEventListener('storage', handleClassroomSync);

    return () => {
      window.removeEventListener(CLASSROOM_SYNC_EVENT, handleClassroomSync);
      window.removeEventListener('anbk-student-profile-updated', handleStudentProfileUpdated);
      window.removeEventListener('storage', handleClassroomSync);
    };
  }, [selectedKelas]);

  // Sinkronisasi Real-Time Denah Bangku & Foto Wajah Siswa Antar Perangkat (Guru & Siswa) via Firestore
  useEffect(() => {
    const cleanRoom = getCleanKelas(selectedKelas);
    const seatDocId = `seats_${cleanRoom.replace(/[^A-Za-z0-9_-]/g, '_')}`;
    let disposed = false;

    let unsub: (() => void) | null = null;
    try {
      const seatDocRef = doc(firestoreDb, 'classroomSeats', seatDocId);
      unsub = onSnapshot(
        seatDocRef,
        (snap) => {
          if (disposed || !snap.exists()) return;
          const data = snap.data() as {
            kelas?: string;
            seats?: ClassroomSeatStudent[];
            updatedAt?: number;
          };
          if (Array.isArray(data?.seats) && data.seats.length > 0) {
            setClassroomStudents((prev) => {
              const otherClasses = prev.filter((s) => getCleanKelas(s.kelas) !== cleanRoom);
              const localInRoom = prev.filter((s) => getCleanKelas(s.kelas) === cleanRoom);
              const mergedRoomMap = new Map<number, ClassroomSeatStudent>();
              localInRoom.forEach((s) => mergedRoomMap.set(s.seatNumber, s));
              data.seats!.forEach((remoteSeat) => {
                if (!remoteSeat || !remoteSeat.seatNumber) return;
                const existingLocal = mergedRoomMap.get(remoteSeat.seatNumber);
                const resolvedPhoto =
                  remoteSeat.photoUrl ||
                  existingLocal?.photoUrl ||
                  getPhotoForStudentIdentity(remoteSeat.namaSiswa, remoteSeat.nisNisn, false) ||
                  undefined;
                mergedRoomMap.set(remoteSeat.seatNumber, {
                  ...(existingLocal || {}),
                  ...remoteSeat,
                  kelas: cleanRoom,
                  photoUrl: resolvedPhoto,
                });
              });
              const mergedRoomList = Array.from(mergedRoomMap.values()).sort(
                (a, b) => a.seatNumber - b.seatNumber
              );
              if (
                mergedRoomList.length === localInRoom.length &&
                mergedRoomList.every(
                  (m, idx) =>
                    m.seatNumber === localInRoom[idx]?.seatNumber &&
                    m.namaSiswa === localInRoom[idx]?.namaSiswa &&
                    m.photoUrl === localInRoom[idx]?.photoUrl
                )
              ) {
                return prev;
              }
              return [...otherClasses, ...mergedRoomList];
            });
          }
        },
        () => {
          // ignore offline/permission fallback
        }
      );
    } catch {
      // ignore
    }

    return () => {
      disposed = true;
      if (unsub) unsub();
    };
  }, [selectedKelas]);

  // ============================================================================
  // STATE & SINKRONISASI REAL-TIME FITUR OBROLAN (CHAT) PER RUANG KELAS TERISOLASI (FIRESTORE)
  // ============================================================================
  const [chatMessagesByRoom, setChatMessagesByRoom] = useState<
    Record<string, ClassroomChatMessage[]>
  >(() => {
    const initialMap = buildInitialMessagesByRoomMap();
    try {
      const saved = localStorage.getItem(STORAGE_KEY_CLASSROOM_CHAT_BY_ROOM);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === 'object') {
          ALL_KELAS_LIST.forEach((kls) => {
            if (Array.isArray(parsed[kls]) && parsed[kls].length > 0) {
              initialMap[kls] = parsed[kls];
            }
          });
        }
      }
    } catch {
      // ignore
    }
    return initialMap;
  });

  // Ruang kelas obrolan yang sedang dibuka (terpisah per kelas: 'VIII-1', 'VIII-2', ..., 'VIII-6', 'VII-1', dst)
  const [activeChatChannel, setActiveChatChannel] = useState<string>(() =>
    studentSubmittedSeatLock?.kelas
      ? getCleanKelas(studentSubmittedSeatLock.kelas)
      : selectedKelas
  );
  const [isStrictClassLockEnabled, setIsStrictClassLockEnabled] = useState<boolean>(true);
  const [chatSearchText, setChatSearchText] = useState<string>('');
  const [chatSenderName, setChatSenderName] = useState<string>(() => {
    if (studentSubmittedSeatLock?.namaSiswa) return studentSubmittedSeatLock.namaSiswa;
    return '';
  });
  const [chatSenderNis, setChatSenderNis] = useState<string>(() => {
    if (studentSubmittedSeatLock?.nisNisn) return studentSubmittedSeatLock.nisNisn;
    return '';
  });
  const [chatSenderKelas, setChatSenderKelas] = useState<string>(() => {
    if (studentSubmittedSeatLock?.kelas) return getCleanKelas(studentSubmittedSeatLock.kelas);
    return selectedKelas;
  });
  const [chatSenderSeat, setChatSenderSeat] = useState<number>(() => {
    if (studentSubmittedSeatLock?.seatNumber) return studentSubmittedSeatLock.seatNumber;
    return 1;
  });
  const [chatRecipientStudentKey, setChatRecipientStudentKey] = useState<string>('ALL_IN_TARGET');
  const [isTeacherDeskChatMode, setIsTeacherDeskChatMode] = useState<boolean>(() =>
    Boolean(isTeacherAuthenticated)
  );
  const [teacherChatActionType, setTeacherChatActionType] = useState<'BROADCAST' | 'CLASS_REPLY'>(
    'BROADCAST'
  );
  const [teacherDeskTargetScope, setTeacherDeskTargetScope] = useState<string>('ALL_11_ROOMS');
  const [selectedBroadcastRooms, setSelectedBroadcastRooms] = useState<string[]>([
    ...ALL_KELAS_LIST,
  ]);
  const [teacherBroadcastCategory, setTeacherBroadcastCategory] = useState<string>(
    '📢 Pengumuman Resmi Guru'
  );
  const [inlineTeacherReplyMsgId, setInlineTeacherReplyMsgId] = useState<string | null>(null);
  const [inlineTeacherReplyText, setInlineTeacherReplyText] = useState<string>('');
  const [chatInputText, setChatInputText] = useState<string>('');
  const [replyingToMessage, setReplyingToMessage] = useState<ClassroomChatMessage | null>(null);
  const [isSyncingChat, setIsSyncingChat] = useState<boolean>(false);
  const [chatSyncSuccessBadge, setChatSyncSuccessBadge] = useState<boolean>(false);
  const [chatSentSuccessBadge, setChatSentSuccessBadge] = useState<boolean>(false);
  const [firestoreLiveConnected, setFirestoreLiveConnected] = useState<boolean>(true);
  const chatMessagesEndRef = useRef<HTMLDivElement | null>(null);

  // Pastikan fitur obrolan Guru (Siaran & Balas Pesan Guru) HANYA aktif jika pengguna teridentifikasi sebagai Guru
  useEffect(() => {
    if (!isIdentifiedAsTeacher) {
      if (isTeacherDeskChatMode) setIsTeacherDeskChatMode(false);
      if (inlineTeacherReplyMsgId) setInlineTeacherReplyMsgId(null);
    }
  }, [isIdentifiedAsTeacher, isTeacherDeskChatMode, inlineTeacherReplyMsgId]);

  const handleRequestAccessTeacherDesk = (
    preferredAction: 'BROADCAST' | 'CLASS_REPLY' = 'BROADCAST'
  ) => {
    if (!isIdentifiedAsTeacher) {
      requireTeacherSeatUnlock(
        preferredAction === 'BROADCAST'
          ? 'Mengirim Pesan Siaran (Broadcast) ke Ruang Kelas (Hanya Jika Pengguna Teridentifikasi Sebagai Guru)'
          : `Membalas Pesan sebagai Guru di Ruang Chat Kelas ${activeChatChannel} (Hanya Jika Pengguna Teridentifikasi Sebagai Guru)`
      );
      return;
    }
    setIsTeacherDeskChatMode(true);
    setTeacherChatActionType(preferredAction);
    if (preferredAction === 'CLASS_REPLY') {
      setTeacherDeskTargetScope(getCleanKelas(activeChatChannel));
    }
    triggerToast(
      preferredAction === 'BROADCAST'
        ? `📢 Mode Pesan Siaran Guru Aktif (${teacherIdentificationBadgeLabel})! Siap mengirim siaran ke ruang kelas.`
        : `↩️ Mode Balas Pesan Guru Aktif di Ruang Kelas ${getCleanKelas(activeChatChannel)}!`
    );
  };

  const handleLockBackTeacherIdentity = () => {
    setIsTeacherSeatDeleteUnlocked(false);
    setIsTeacherDeskChatMode(false);
    setInlineTeacherReplyMsgId(null);
    setInlineTeacherReplyText('');
    try {
      sessionStorage.removeItem(TEACHER_VERIFIED_SESSION_KEY);
    } catch {
      // ignore
    }
    triggerToast(
      '🔒 Sesi Identitas Guru telah dikunci kembali. Mode obrolan kini kembali ke Mode Siswa.'
    );
  };

  // Pastikan activeRoom selalu merupakan salah satu dari ALL_KELAS_LIST
  const currentIsolatedRoom = useMemo(() => {
    const clean = getCleanKelas(activeChatChannel);
    return ALL_KELAS_LIST.includes(clean) ? clean : selectedKelas;
  }, [activeChatChannel, selectedKelas]);

  // ============================================================================
  // ANIMASI TRANSISI MULUS & INTUITIF ANTAR RUANG KELAS OBROLAN
  // ============================================================================
  const [roomTransitionDirection, setRoomTransitionDirection] = useState<1 | -1>(1);
  const [roomTransitionPortal, setRoomTransitionPortal] = useState<{
    fromRoom: string;
    toRoom: string;
    direction: 1 | -1;
    docId: string;
  } | null>(null);
  const prevRoomRef = useRef<string>(currentIsolatedRoom);
  const roomTransitionTimerRef = useRef<number | null>(null);

  // Deteksi perubahan currentIsolatedRoom secara otomatis (baik dari tab atas maupun tab obrolan)
  useEffect(() => {
    const prevRoom = prevRoomRef.current;
    if (prevRoom && prevRoom !== currentIsolatedRoom) {
      const prevIdx = ALL_KELAS_LIST.indexOf(prevRoom);
      const nextIdx = ALL_KELAS_LIST.indexOf(currentIsolatedRoom);
      const dir: 1 | -1 = nextIdx >= prevIdx ? 1 : -1;
      setRoomTransitionDirection(dir);
      setRoomTransitionPortal({
        fromRoom: prevRoom,
        toRoom: currentIsolatedRoom,
        direction: dir,
        docId: getFirestoreChatDocIdForKelas(currentIsolatedRoom),
      });
      if (roomTransitionTimerRef.current) {
        window.clearTimeout(roomTransitionTimerRef.current);
      }
      roomTransitionTimerRef.current = window.setTimeout(() => {
        setRoomTransitionPortal(null);
      }, 1400);
      prevRoomRef.current = currentIsolatedRoom;
    }
  }, [currentIsolatedRoom]);

  const handleSwitchChatClassroom = (targetKelasRaw: string) => {
    const targetKelas = getCleanKelas(targetKelasRaw);
    if (!ALL_KELAS_LIST.includes(targetKelas)) return;

    const isLockedOtherRoom =
      Boolean(studentSubmittedSeatLock) &&
      isStrictClassLockEnabled &&
      !isIdentifiedAsTeacher &&
      getCleanKelas(studentSubmittedSeatLock!.kelas) !== targetKelas;

    if (isLockedOtherRoom) {
      triggerToast(
        `🔒 Keamanan Diskusi Kelas Aktif: Anda terdaftar di Kelas ${getCleanKelas(
          studentSubmittedSeatLock!.kelas
        )}. Klik tombol "Terkunci Aman di Kelas" di kanan atas untuk membuka navigasi antar ruang kelas.`
      );
      return;
    }

    if (targetKelas !== currentIsolatedRoom) {
      const prevIdx = ALL_KELAS_LIST.indexOf(currentIsolatedRoom);
      const nextIdx = ALL_KELAS_LIST.indexOf(targetKelas);
      const dir: 1 | -1 = nextIdx >= prevIdx ? 1 : -1;
      setRoomTransitionDirection(dir);
      setRoomTransitionPortal({
        fromRoom: currentIsolatedRoom,
        toRoom: targetKelas,
        direction: dir,
        docId: getFirestoreChatDocIdForKelas(targetKelas),
      });
      if (roomTransitionTimerRef.current) {
        window.clearTimeout(roomTransitionTimerRef.current);
      }
      roomTransitionTimerRef.current = window.setTimeout(() => {
        setRoomTransitionPortal(null);
      }, 1400);
      prevRoomRef.current = targetKelas;
    }

    setActiveChatChannel(targetKelas);
    setSelectedKelas(targetKelas);
    setReplyingToMessage(null);
    setInlineTeacherReplyMsgId(null);
    if (isIdentifiedAsTeacher && isTeacherDeskChatMode && teacherChatActionType === 'CLASS_REPLY') {
      setTeacherDeskTargetScope(targetKelas);
    }
  };

  const handleStepAdjacentChatRoom = (step: -1 | 1) => {
    const currentIdx = ALL_KELAS_LIST.indexOf(currentIsolatedRoom);
    if (currentIdx === -1) return;
    const nextIdx = (currentIdx + step + ALL_KELAS_LIST.length) % ALL_KELAS_LIST.length;
    const nextRoom = ALL_KELAS_LIST[nextIdx];
    handleSwitchChatClassroom(nextRoom);
  };

  // Sinkronkan kelas pengirim dengan ruang kelas yang sedang aktif agar pesan tidak bocor ke kelas lain
  useEffect(() => {
    if (studentSubmittedSeatLock && isStrictClassLockEnabled && !isTeacherSeatDeleteUnlocked) {
      const lockedKls = getCleanKelas(studentSubmittedSeatLock.kelas);
      if (activeChatChannel !== lockedKls) {
        setActiveChatChannel(lockedKls);
      }
      if (chatSenderKelas !== lockedKls) {
        setChatSenderKelas(lockedKls);
      }
      return;
    }
    if (chatSenderKelas !== currentIsolatedRoom) {
      setChatSenderKelas(currentIsolatedRoom);
      setChatRecipientStudentKey('ALL_IN_TARGET');
    }
  }, [
    currentIsolatedRoom,
    studentSubmittedSeatLock,
    isStrictClassLockEnabled,
    isTeacherSeatDeleteUnlocked,
  ]);

  // Cari data siswa yang duduk di bangku pengirim saat ini (jika sudah terdaftar di Denah Kelas)
  const matchedSeatStudentForSender = useMemo(() => {
    return classroomStudents.find(
      (s) =>
        getCleanKelas(s.kelas) === getCleanKelas(currentIsolatedRoom) &&
        s.seatNumber === chatSenderSeat
    );
  }, [classroomStudents, currentIsolatedRoom, chatSenderSeat]);

  // Otomatis isi Nama & NISN jika pengguna memilih Kelas & Nomor Meja yang sudah ada siswanya di Denah Kelas
  useEffect(() => {
    if (
      studentSubmittedSeatLock &&
      getCleanKelas(studentSubmittedSeatLock.kelas) === currentIsolatedRoom
    ) {
      setChatSenderName(studentSubmittedSeatLock.namaSiswa);
      setChatSenderNis(studentSubmittedSeatLock.nisNisn);
      setChatSenderKelas(getCleanKelas(studentSubmittedSeatLock.kelas));
      setChatSenderSeat(studentSubmittedSeatLock.seatNumber);
      return;
    }
    if (isTeacherSeatDeleteUnlocked) {
      if (!chatSenderName.trim()) {
        setChatSenderName(`${EXAM_INFO.guruMapel} (Guru & Proktor)`);
      }
      return;
    }
    if (matchedSeatStudentForSender) {
      setChatSenderName(matchedSeatStudentForSender.namaSiswa);
      setChatSenderNis(matchedSeatStudentForSender.nisNisn);
    } else {
      const defaultRep = DEFAULT_STUDENT_REPRESENTATIVES_BY_KELAS[currentIsolatedRoom];
      if (defaultRep && !namaSiswaInput.trim()) {
        setChatSenderName(defaultRep.nama);
        setChatSenderNis(defaultRep.nis);
      } else if (namaSiswaInput.trim() && !chatSenderName.trim()) {
        setChatSenderName(namaSiswaInput.trim());
        if (nisNisnInput.trim()) setChatSenderNis(nisNisnInput.trim());
      }
    }
  }, [
    studentSubmittedSeatLock,
    isTeacherSeatDeleteUnlocked,
    matchedSeatStudentForSender,
    currentIsolatedRoom,
    namaSiswaInput,
    nisNisnInput,
  ]);

  // Daftar identitas siswa khusus di dalam ruang kelas aktif (satu kelas yang sama) agar diskusi aman & terisolasi
  const sameClassChatStudents = useMemo(() => {
    const map = new Map<
      string,
      {
        key: string;
        namaSiswa: string;
        nisNisn: string;
        kelas: string;
        semester: 'Ganjil' | 'Genap';
        seatNumber: number;
        deviceInfo: string;
      }
    >();

    classroomStudents
      .filter((s) => getCleanKelas(s.kelas) === currentIsolatedRoom)
      .forEach((s) => {
        const cleanK = getCleanKelas(s.kelas);
        const k = `${cleanK}#${s.seatNumber}#${s.namaSiswa}`;
        map.set(k, {
          key: k,
          namaSiswa: s.namaSiswa,
          nisNisn: s.nisNisn,
          kelas: cleanK,
          semester: s.semester || 'Ganjil',
          seatNumber: s.seatNumber,
          deviceInfo: s.deviceModel || s.deviceCategory || 'HP Android Siswa',
        });
      });

    const rep = DEFAULT_STUDENT_REPRESENTATIVES_BY_KELAS[currentIsolatedRoom];
    if (rep) {
      const repKey = `${currentIsolatedRoom}#${rep.seat}#${rep.nama}`;
      if (!map.has(repKey)) {
        map.set(repKey, {
          key: repKey,
          namaSiswa: rep.nama,
          nisNisn: rep.nis,
          kelas: currentIsolatedRoom,
          semester: rep.semester,
          seatNumber: rep.seat,
          deviceInfo: rep.device,
        });
      }
      const partnerSeat = rep.seat === 1 ? 2 : 1;
      const partnerKey = `${currentIsolatedRoom}#${partnerSeat}#${rep.partnerNama}`;
      if (!map.has(partnerKey)) {
        map.set(partnerKey, {
          key: partnerKey,
          namaSiswa: rep.partnerNama,
          nisNisn: rep.partnerNis,
          kelas: currentIsolatedRoom,
          semester: rep.semester,
          seatNumber: partnerSeat,
          deviceInfo: 'Smartphone Android Siswa',
        });
      }
    }

    return Array.from(map.values()).sort((a, b) => a.seatNumber - b.seatNumber);
  }, [classroomStudents, currentIsolatedRoom]);

  // Fungsi untuk meresolusi Identitas Lengkap Siswa Pengirim & Lawan Bicara Satu Kelas
  const resolveMessageFullIdentity = (msg: ClassroomChatMessage) => {
    const roomKls = getCleanKelas(msg.targetRoom || msg.senderKelas || currentIsolatedRoom);
    if (msg.senderRole === 'GURU') {
      return {
        isGuru: true,
        namaLengkap: msg.senderName || `${EXAM_INFO.guruMapel} (Guru & Proktor ANBK)`,
        nisNisn: msg.senderNis || 'NIP/Proktor-ANBK',
        kelas: roomKls,
        semester: msg.senderSemester || selectedSemester,
        seatNumber: undefined,
        deviceInfo: msg.senderDevice || 'Server Proktor Utama CBT',
        photoUrl: undefined,
        partnerLabel:
          msg.recipientName || `Seluruh Siswa Ruang Kelas ${roomKls}`,
        partnerNis: msg.recipientNis || msg.replyTo?.senderNis || '',
        partnerKelas: roomKls,
        partnerSeat: msg.recipientSeatNumber || msg.replyTo?.senderSeatNumber,
      };
    }

    const cleanSenderKelas = getCleanKelas(msg.senderKelas || roomKls);
    const seatNum = msg.senderSeatNumber || 1;

    const seatMatch =
      classroomStudents.find(
        (s) =>
          getCleanKelas(s.kelas) === cleanSenderKelas &&
          s.seatNumber === seatNum
      ) ||
      classroomStudents.find(
        (s) =>
          s.namaSiswa.trim().toLowerCase() === (msg.senderName || '').trim().toLowerCase()
      );

    const isGenericSenderName =
      !msg.senderName ||
      /^Siswa Kelas\b/i.test(msg.senderName.trim()) ||
      /^Perwakilan Siswa\b/i.test(msg.senderName.trim());

    const fallbackRep = DEFAULT_STUDENT_REPRESENTATIVES_BY_KELAS[cleanSenderKelas] || {
      nama: `Andi Pratama (${cleanSenderKelas})`,
      nis: '0108823400',
      seat: seatNum,
      device: `${detectedDevice.deviceCategory} · ${detectedDevice.modelType}`,
      semester: selectedSemester,
    };

    const resolvedName = !isGenericSenderName
      ? msg.senderName.trim()
      : seatMatch?.namaSiswa || fallbackRep.nama;

    const resolvedNis =
      msg.senderNis ||
      seatMatch?.nisNisn ||
      fallbackRep.nis;

    const resolvedSemester =
      msg.senderSemester || seatMatch?.semester || fallbackRep.semester || 'Ganjil';

    const resolvedDevice =
      msg.senderDevice ||
      (seatMatch
        ? `${seatMatch.deviceCategory} · ${seatMatch.deviceModel}`
        : fallbackRep.device);

    const resolvedPhoto =
      msg.senderPhotoUrl ||
      getPhotoForStudentIdentity(resolvedName, resolvedNis) ||
      undefined;

    let partnerLabel = '';
    let partnerNis = msg.recipientNis || '';
    const partnerKelas = cleanSenderKelas;
    let partnerSeat = msg.recipientSeatNumber;

    if (msg.replyTo) {
      partnerLabel = msg.replyTo.senderName;
      partnerNis = msg.replyTo.senderNis || '';
      partnerSeat = msg.replyTo.senderSeatNumber;
    } else if (msg.recipientName) {
      partnerLabel = msg.recipientName;
    } else {
      partnerLabel = `Teman Sekelas Ruang ${cleanSenderKelas}`;
    }

    return {
      isGuru: false,
      namaLengkap: resolvedName,
      nisNisn: resolvedNis,
      kelas: cleanSenderKelas,
      semester: resolvedSemester,
      seatNumber: seatNum,
      deviceInfo: resolvedDevice,
      photoUrl: resolvedPhoto,
      partnerLabel,
      partnerNis,
      partnerKelas,
      partnerSeat,
    };
  };

  // Saat pengguna memilih tab kelas di atas, sinkronkan ruang chat ke kelas tersebut
  useEffect(() => {
    if (studentSubmittedSeatLock && isStrictClassLockEnabled && !isTeacherSeatDeleteUnlocked) {
      return;
    }
    setActiveChatChannel(selectedKelas);
  }, [selectedKelas]);

  // Simpan pesan chat per ruang kelas ke localStorage setiap kali berubah (lewati mount awal & debounce agar ringan)
  const isInitialChatStorageMountRef = useRef(true);
  useEffect(() => {
    if (isInitialChatStorageMountRef.current) {
      isInitialChatStorageMountRef.current = false;
      return;
    }
    const timer = window.setTimeout(() => {
      try {
        localStorage.setItem(
          STORAGE_KEY_CLASSROOM_CHAT_BY_ROOM,
          JSON.stringify(chatMessagesByRoom)
        );
      } catch {
        // ignore
      }
    }, 200);
    return () => window.clearTimeout(timer);
  }, [chatMessagesByRoom]);

  const mergeRoomChatMessageLists = (
    roomKelas: string,
    localList: ClassroomChatMessage[],
    remoteList: ClassroomChatMessage[]
  ): ClassroomChatMessage[] => {
    const cleanRoom = getCleanKelas(roomKelas);
    const seedList = buildInitialMessagesForRoom(cleanRoom);
    const map = new Map<string, ClassroomChatMessage>();

    [...seedList, ...localList, ...remoteList].forEach((m) => {
      if (!m || !m.id || !m.text) return;
      // Pastikan hanya pesan milik kelas ini yang masuk ke dokumen ruang kelas ini (isolasi ketat)
      const msgRoom = getCleanKelas(m.targetRoom || m.senderKelas || cleanRoom);
      if (msgRoom !== cleanRoom) return;

      const existing = map.get(m.id);
      if (!existing) {
        map.set(m.id, {
          ...m,
          senderKelas: cleanRoom,
          targetRoom: cleanRoom,
        });
      } else {
        const mergedReactions: Record<string, number> = {
          ...(existing.reactions || {}),
        };
        if (m.reactions) {
          Object.entries(m.reactions).forEach(([emoji, count]) => {
            mergedReactions[emoji] = Math.max(mergedReactions[emoji] || 0, Number(count) || 0);
          });
        }
        map.set(m.id, {
          ...existing,
          ...m,
          senderKelas: cleanRoom,
          targetRoom: cleanRoom,
          reactions: mergedReactions,
        });
      }
    });

    return Array.from(map.values())
      .sort((a, b) => a.createdAtMs - b.createdAtMs)
      .slice(-120);
  };

  const pushRoomChatMessagesToFirestore = async (
    roomKelas: string,
    messagesToSave: ClassroomChatMessage[]
  ) => {
    const cleanRoom = getCleanKelas(roomKelas);
    const docId = getFirestoreChatDocIdForKelas(cleanRoom);
    const isolatedMessages = messagesToSave
      .filter((m) => getCleanKelas(m.targetRoom || m.senderKelas) === cleanRoom)
      .slice(-100);

    try {
      if (typeof BroadcastChannel !== 'undefined') {
        const bc = new BroadcastChannel(`anbk_classroom_chat_${docId}`);
        bc.postMessage({
          type: 'room-chat-updated',
          kelas: cleanRoom,
          messages: isolatedMessages,
          updatedAt: Date.now(),
        });
        bc.close();
      }
    } catch {
      // ignore
    }

    try {
      await firestoreRestWriteDoc(
        FIRESTORE_CHAT_COLLECTION,
        docId,
        {
          kelas: cleanRoom,
          messages: isolatedMessages,
          updatedAt: Date.now(),
        },
        3500
      );
      setFirestoreLiveConnected(true);
    } catch {
      // ignore
    }
  };

  // Real-Time Listener Firestore Terpisah Berdasarkan Ruang Kelas (classroomChats/room_VIII_1, room_VIII_2, dst.)
  // Dengarkan ruang kelas aktif secara instan & tunda pembukaan koneksi ke kelas lain agar perpindahan tab terasa sangat ringan
  useEffect(() => {
    let disposed = false;
    const roomsToWatch = isTeacherDeskChatMode ? ALL_KELAS_LIST : [currentIsolatedRoom];

    const applyIncomingRoomMessages = (
      targetKelas: string,
      incoming?: ClassroomChatMessage[],
      deletedIds?: string[]
    ) => {
      if (disposed || !Array.isArray(incoming)) return;
      const delSet = new Set(Array.isArray(deletedIds) ? deletedIds : []);
      setChatMessagesByRoom((prevMap) => {
        const prevRoomList = prevMap[targetKelas] || buildInitialMessagesForRoom(targetKelas);
        const merged = mergeRoomChatMessageLists(targetKelas, prevRoomList, incoming).filter(
          (m) => !delSet.has(m.id)
        );
        if (
          merged.length === prevRoomList.length &&
          merged.every(
            (m, i) =>
              m.id === prevRoomList[i]?.id &&
              JSON.stringify(m.reactions || {}) ===
                JSON.stringify(prevRoomList[i]?.reactions || {})
          )
        ) {
          return prevMap;
        }
        return {
          ...prevMap,
          [targetKelas]: merged,
        };
      });
    };

    // 1. Firestore onSnapshot untuk dokumen ruang kelas yang dipantau (ditunda 200ms setelah render pertama agar UI langsung tampil instan)
    const unsubList: Array<() => void> = [];
    const cleanRoom = currentIsolatedRoom;
    const roomDocId = getFirestoreChatDocIdForKelas(cleanRoom);
    let pollTimer: number | null = null;

    const fetchActiveRoomChatFromCloud = async () => {
      if (disposed) return;
      try {
        const data = await firestoreRestReadDoc<{
          kelas?: string;
          messages?: ClassroomChatMessage[];
          deletedIds?: string[];
        }>(FIRESTORE_CHAT_COLLECTION, roomDocId, 2500);
        if (data && Array.isArray(data.messages)) {
          setFirestoreLiveConnected(true);
          applyIncomingRoomMessages(cleanRoom, data.messages, data.deletedIds);
        }
      } catch {
        // ignore
      }
    };

    const deferTimer = window.setTimeout(() => {
      if (disposed) return;
      roomsToWatch.forEach((kls) => {
        const cleanKls = getCleanKelas(kls);
        const docId = getFirestoreChatDocIdForKelas(cleanKls);
        try {
          const roomDocRef = doc(firestoreDb, FIRESTORE_CHAT_COLLECTION, docId);
          const unsub = onSnapshot(
            roomDocRef,
            (snap) => {
              setFirestoreLiveConnected(true);
              if (!snap.exists()) return;
              const d = snap.data() as {
                kelas?: string;
                messages?: ClassroomChatMessage[];
                deletedIds?: string[];
              };
              if (Array.isArray(d?.messages)) {
                applyIncomingRoomMessages(cleanKls, d.messages, d.deletedIds);
              }
            },
            () => {
              // fallback REST handles offline/error gracefully
            }
          );
          unsubList.push(unsub);
        } catch {
          // ignore
        }
      });

      fetchActiveRoomChatFromCloud();
      pollTimer = window.setInterval(fetchActiveRoomChatFromCloud, 8000);
    }, 200);

    // 3. BroadcastChannel khusus ruang kelas aktif (terisolasi per kelas)
    let bc: BroadcastChannel | null = null;
    try {
      if (typeof BroadcastChannel !== 'undefined') {
        bc = new BroadcastChannel(`anbk_classroom_chat_${roomDocId}`);
        bc.onmessage = (ev) => {
          if (
            ev.data &&
            ev.data.kelas === cleanRoom &&
            Array.isArray(ev.data.messages)
          ) {
            applyIncomingRoomMessages(cleanRoom, ev.data.messages, ev.data.deletedIds);
          }
        };
      }
    } catch {
      // ignore
    }

    return () => {
      disposed = true;
      window.clearTimeout(deferTimer);
      unsubList.forEach((u) => u());
      if (pollTimer !== null) window.clearInterval(pollTimer);
      if (bc) bc.close();
    };
  }, [currentIsolatedRoom, isTeacherDeskChatMode]);

  const handleManualSyncClassroomChat = async () => {
    setIsSyncingChat(true);
    const cleanRoom = currentIsolatedRoom;
    const roomDocId = getFirestoreChatDocIdForKelas(cleanRoom);
    try {
      const cloudData = await firestoreRestReadDoc<{
        kelas?: string;
        messages?: ClassroomChatMessage[];
        deletedIds?: string[];
      }>(FIRESTORE_CHAT_COLLECTION, roomDocId, 3000);
      const delSet = new Set(Array.isArray(cloudData?.deletedIds) ? cloudData!.deletedIds : []);
      const currentRoomList =
        chatMessagesByRoom[cleanRoom] || buildInitialMessagesForRoom(cleanRoom);
      const nextMerged = mergeRoomChatMessageLists(
        cleanRoom,
        currentRoomList,
        Array.isArray(cloudData?.messages) ? cloudData!.messages : []
      ).filter((m) => !delSet.has(m.id));

      setChatMessagesByRoom((prev) => ({
        ...prev,
        [cleanRoom]: nextMerged,
      }));
      await pushRoomChatMessagesToFirestore(cleanRoom, nextMerged);
      setChatSyncSuccessBadge(true);
      setTimeout(() => setChatSyncSuccessBadge(false), 3500);
      triggerToast(
        `✓ Ruang Chat Firestore Kelas ${cleanRoom} (${nextMerged.length} Pesan) berhasil disinkronkan secara aman & terisolasi!`
      );
    } finally {
      setIsSyncingChat(false);
    }
  };

  // Fungsi Resolusi Daftar Ruang Kelas Target Siaran Guru
  const resolveTeacherBroadcastTargetRooms = (): {
    rooms: string[];
    scopeLabel: string;
  } => {
    if (teacherChatActionType === 'CLASS_REPLY') {
      const targetKls = ALL_KELAS_LIST.includes(getCleanKelas(teacherDeskTargetScope))
        ? getCleanKelas(teacherDeskTargetScope)
        : currentIsolatedRoom;
      return {
        rooms: [targetKls],
        scopeLabel: `Balasan Resmi Guru di Ruang Kelas ${targetKls}`,
      };
    }

    if (teacherDeskTargetScope === 'ALL_11_ROOMS') {
      return {
        rooms: [...ALL_KELAS_LIST],
        scopeLabel: 'Siaran Serentak Seluruh 11 Ruang Kelas (VII-1 s/d VIII-6)',
      };
    }
    if (teacherDeskTargetScope === 'JENJANG_VIII') {
      return {
        rooms: [...KELAS_VIII_LIST],
        scopeLabel: 'Siaran Jenjang Kelas VIII (VIII-1 s/d VIII-6 · 6 Kelas)',
      };
    }
    if (teacherDeskTargetScope === 'JENJANG_VII') {
      return {
        rooms: [...KELAS_VII_LIST],
        scopeLabel: 'Siaran Jenjang Kelas VII (VII-1 s/d VII-5 · 5 Kelas)',
      };
    }
    if (teacherDeskTargetScope === 'CUSTOM_MULTI_ROOMS') {
      const validCustom = selectedBroadcastRooms.filter((r) => ALL_KELAS_LIST.includes(r));
      const finalRooms = validCustom.length > 0 ? validCustom : [currentIsolatedRoom];
      return {
        rooms: finalRooms,
        scopeLabel: `Siaran Guru ke ${finalRooms.length} Kelas (${finalRooms.join(', ')})`,
      };
    }
    const singleKls = ALL_KELAS_LIST.includes(getCleanKelas(teacherDeskTargetScope))
      ? getCleanKelas(teacherDeskTargetScope)
      : currentIsolatedRoom;
    return {
      rooms: [singleKls],
      scopeLabel: `Siaran Resmi Guru Khusus Ruang Kelas ${singleKls}`,
    };
  };

  // Handler Balasan Cepat Guru Langsung pada Kartu Pesan Siswa di Ruang Chat Masing-Masing Kelas (Hanya Jika Teridentifikasi Sebagai Guru)
  const handleSendInlineTeacherReply = async (targetMsg: ClassroomChatMessage) => {
    if (!isIdentifiedAsTeacher) {
      requireTeacherSeatUnlock(
        `Membalas pesan siswa di Ruang Chat Kelas ${currentIsolatedRoom} sebagai Guru (Hanya Jika Pengguna Teridentifikasi Sebagai Guru)`
      );
      return;
    }
    const cleanReplyText = inlineTeacherReplyText.trim();
    if (!cleanReplyText) {
      triggerToast('Ketik isi balasan Guru terlebih dahulu!');
      return;
    }

    const roomKls = getCleanKelas(targetMsg.targetRoom || targetMsg.senderKelas || currentIsolatedRoom);
    const targetIdentity = resolveMessageFullIdentity(targetMsg);
    const nowDate = new Date();
    const timeStr = nowDate.toLocaleTimeString('id-ID', {
      hour: '2-digit',
      minute: '2-digit',
    });
    const dateStr = nowDate.toLocaleDateString('id-ID', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });

    const teacherReplyMsg: ClassroomChatMessage = {
      id: `chat-gurureply-${roomKls}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      senderName: `Meja Guru & Proktor · ${EXAM_INFO.guruMapel}`,
      senderNis: 'NIP/Meja-Guru-ANBK',
      senderKelas: roomKls,
      senderSemester: selectedSemester,
      senderDevice: `Konsol Resmi Guru (Balasan Kelas ${roomKls})`,
      senderRole: 'GURU',
      targetRoom: roomKls,
      recipientName: targetIdentity.namaLengkap,
      recipientNis: targetIdentity.nisNisn,
      recipientKelas: roomKls,
      recipientSeatNumber: targetIdentity.seatNumber,
      text: cleanReplyText,
      timestamp: `${timeStr} · ${dateStr}`,
      createdAtMs: Date.now(),
      isBroadcast: false,
      verifiedTeacherIdentity: teacherIdentificationBadgeLabel,
      replyTo: {
        id: targetMsg.id,
        senderName: targetIdentity.namaLengkap,
        senderNis: targetIdentity.nisNisn,
        senderKelas: roomKls,
        senderSeatNumber: targetIdentity.seatNumber,
        text: targetMsg.text.slice(0, 140),
      },
      reactions: {},
    };

    const prevRoomList = chatMessagesByRoom[roomKls] || buildInitialMessagesForRoom(roomKls);
    const nextRoomList = [...prevRoomList, teacherReplyMsg].slice(-120);

    setChatMessagesByRoom((prev) => ({
      ...prev,
      [roomKls]: nextRoomList,
    }));
    setInlineTeacherReplyMsgId(null);
    setInlineTeacherReplyText('');
    setChatSentSuccessBadge(true);
    setTimeout(() => setChatSentSuccessBadge(false), 2800);

    await pushRoomChatMessagesToFirestore(roomKls, nextRoomList);
    triggerToast(
      `✓ Balasan resmi Guru untuk ${targetIdentity.namaLengkap} di Ruang Kelas ${roomKls} berhasil dikirim!`
    );
  };

  const handleSendClassroomChatMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanText = chatInputText.trim();
    if (!cleanText) {
      triggerToast('Ketik isi pesan diskusi terlebih dahulu sebelum mengirim!');
      return;
    }

    // Proteksi Ketat: Mengirim Pesan Siaran atau Membalas sebagai Guru HANYA diizinkan jika pengguna teridentifikasi sebagai Guru
    if (isTeacherDeskChatMode && !isIdentifiedAsTeacher) {
      setIsTeacherDeskChatMode(false);
      requireTeacherSeatUnlock(
        'Mengirim Pesan Siaran atau Membalas Pesan di Ruang Chat Kelas sebagai Guru (Hanya Jika Pengguna Teridentifikasi Sebagai Guru)'
      );
      return;
    }

    const nowDate = new Date();
    const timeStr = nowDate.toLocaleTimeString('id-ID', {
      hour: '2-digit',
      minute: '2-digit',
    });
    const dateStr = nowDate.toLocaleDateString('id-ID', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });

    // MODE OBROLAN KHUSUS GURU (HANYA JIKA PENGGUNA TERIDENTIFIKASI SEBAGAI GURU):
    // 1) Mengirim Pesan Siaran (Broadcast) ke seluruh/beberapa kelas, ATAU
    // 2) Membalas pesan siswa di ruang chat masing-masing kelas
    if (isIdentifiedAsTeacher && isTeacherDeskChatMode) {
      const isBroadcastMode = teacherChatActionType === 'BROADCAST' && !replyingToMessage;
      const { rooms: targetRooms, scopeLabel } = resolveTeacherBroadcastTargetRooms();

      const updatedMap: Record<string, ClassroomChatMessage[]> = { ...chatMessagesByRoom };

      targetRooms.forEach((roomKls) => {
        const isReplyingInSingleRoom = Boolean(
          replyingToMessage && targetRooms.length === 1
        );
        const replyIdentity =
          isReplyingInSingleRoom && replyingToMessage
            ? resolveMessageFullIdentity(replyingToMessage)
            : null;

        const msgForRoom: ClassroomChatMessage = {
          id: `chat-mejaguru-${roomKls}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          senderName: `Meja Guru & Proktor · ${EXAM_INFO.guruMapel}`,
          senderNis: 'NIP/Meja-Guru-ANBK',
          senderKelas: roomKls,
          senderSemester: selectedSemester,
          senderDevice: isBroadcastMode
            ? `Konsol Siaran Guru (${scopeLabel})`
            : `Konsol Meja Guru ➔ Ruang Kelas ${roomKls}`,
          senderRole: 'GURU',
          targetRoom: roomKls,
          recipientName: replyIdentity
            ? replyIdentity.namaLengkap
            : `Seluruh Siswa Ruang Kelas ${roomKls}`,
          recipientNis: replyIdentity ? replyIdentity.nisNisn : undefined,
          recipientKelas: roomKls,
          recipientSeatNumber: replyIdentity ? replyIdentity.seatNumber : undefined,
          text: cleanText,
          timestamp: `${timeStr} · ${dateStr}`,
          createdAtMs: Date.now(),
          isBroadcast: isBroadcastMode,
          broadcastScopeLabel: isBroadcastMode ? scopeLabel : undefined,
          broadcastCategory: isBroadcastMode ? teacherBroadcastCategory : undefined,
          verifiedTeacherIdentity: teacherIdentificationBadgeLabel,
          ...(replyIdentity && replyingToMessage
            ? {
                replyTo: {
                  id: replyingToMessage.id,
                  senderName: replyIdentity.namaLengkap,
                  senderNis: replyIdentity.nisNisn,
                  senderKelas: roomKls,
                  senderSeatNumber: replyIdentity.seatNumber,
                  text: replyingToMessage.text.slice(0, 140),
                },
              }
            : {}),
          reactions: {},
        };

        const prevRoomList =
          updatedMap[roomKls] || buildInitialMessagesForRoom(roomKls);
        updatedMap[roomKls] = [...prevRoomList, msgForRoom].slice(-120);
      });

      setChatMessagesByRoom(updatedMap);
      setChatInputText('');
      setReplyingToMessage(null);
      setChatSentSuccessBadge(true);
      setTimeout(() => setChatSentSuccessBadge(false), 2800);

      await Promise.all(
        targetRooms.map((roomKls) =>
          pushRoomChatMessagesToFirestore(roomKls, updatedMap[roomKls])
        )
      );

      if (targetRooms.length === 1 && targetRooms[0] !== currentIsolatedRoom) {
        setActiveChatChannel(targetRooms[0]);
        setSelectedKelas(targetRooms[0]);
      }

      triggerToast(
        isBroadcastMode
          ? `📢 Pesan Siaran Guru berhasil dikirim ke ${targetRooms.length} Ruang Kelas (${targetRooms.join(', ')}) secara real-time!`
          : `↩️ Balasan resmi Guru berhasil dikirim ke Ruang Chat Kelas ${targetRooms[0]}!`
      );

      setTimeout(() => {
        chatMessagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }, 80);
      return;
    }

    // MODE SISWA: Pastikan pengiriman terisolasi ke ruang kelas aktif
    const cleanRoomKls = currentIsolatedRoom;
    const defaultRep = DEFAULT_STUDENT_REPRESENTATIVES_BY_KELAS[cleanRoomKls];

    const effectiveSenderName =
      chatSenderName.trim() ||
      (studentSubmittedSeatLock &&
      getCleanKelas(studentSubmittedSeatLock.kelas) === cleanRoomKls
        ? studentSubmittedSeatLock.namaSiswa
        : '') ||
      matchedSeatStudentForSender?.namaSiswa ||
      namaSiswaInput.trim() ||
      defaultRep?.nama ||
      `Andi Pratama (${cleanRoomKls})`;

    const effectiveSenderNis =
      chatSenderNis.trim() ||
      (studentSubmittedSeatLock &&
      getCleanKelas(studentSubmittedSeatLock.kelas) === cleanRoomKls
        ? studentSubmittedSeatLock.nisNisn
        : '') ||
      matchedSeatStudentForSender?.nisNisn ||
      nisNisnInput.trim() ||
      defaultRep?.nis ||
      '0108823400';

    const effectiveSenderDevice = matchedSeatStudentForSender
      ? `${matchedSeatStudentForSender.deviceCategory} · ${matchedSeatStudentForSender.deviceModel}`
      : `${customDeviceCategory || detectedDevice.deviceCategory} · ${
          customDeviceModel || detectedDevice.modelType
        }`;

    const isMessagingTeacherDesk = chatRecipientStudentKey === 'TEACHER_DESK';

    // Cari identitas teman sekelas ("Ngobrol Sama Siapa") di ruang kelas yang sama
    const selectedPartnerObj =
      chatRecipientStudentKey !== 'ALL_IN_TARGET' && !isMessagingTeacherDesk
        ? sameClassChatStudents.find((st) => st.key === chatRecipientStudentKey)
        : undefined;

    const newMsg: ClassroomChatMessage = {
      id: `chat-${cleanRoomKls}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      senderName: effectiveSenderName,
      senderNis: effectiveSenderNis,
      senderKelas: cleanRoomKls,
      senderSemester: selectedSemester,
      senderSeatNumber: chatSenderSeat,
      senderDevice: effectiveSenderDevice,
      senderPhotoUrl:
        getPhotoForStudentIdentity(effectiveSenderName, effectiveSenderNis) || undefined,
      senderRole: 'SISWA',
      targetRoom: cleanRoomKls,
      recipientName: replyingToMessage
        ? resolveMessageFullIdentity(replyingToMessage).namaLengkap
        : isMessagingTeacherDesk
        ? `Meja Guru & Proktor (${EXAM_INFO.guruMapel})`
        : selectedPartnerObj
        ? selectedPartnerObj.namaSiswa
        : `Teman Sekelas & Meja Guru Ruang ${cleanRoomKls}`,
      recipientNis: replyingToMessage?.senderNis
        ? replyingToMessage.senderNis
        : isMessagingTeacherDesk
        ? 'NIP/Meja-Guru-ANBK'
        : selectedPartnerObj?.nisNisn,
      recipientKelas: cleanRoomKls,
      recipientSeatNumber:
        replyingToMessage?.senderSeatNumber || selectedPartnerObj?.seatNumber,
      text: cleanText,
      timestamp: `${timeStr} · ${dateStr}`,
      createdAtMs: Date.now(),
      ...(replyingToMessage
        ? {
            replyTo: {
              id: replyingToMessage.id,
              senderName: resolveMessageFullIdentity(replyingToMessage).namaLengkap,
              senderNis: resolveMessageFullIdentity(replyingToMessage).nisNisn,
              senderKelas: cleanRoomKls,
              senderSeatNumber: replyingToMessage.senderSeatNumber,
              text: replyingToMessage.text.slice(0, 120),
            },
          }
        : {}),
      reactions: {},
    };

    const prevRoomMessages =
      chatMessagesByRoom[cleanRoomKls] || buildInitialMessagesForRoom(cleanRoomKls);
    const nextRoomList = [...prevRoomMessages, newMsg].slice(-120);

    setChatMessagesByRoom((prev) => ({
      ...prev,
      [cleanRoomKls]: nextRoomList,
    }));
    setChatInputText('');
    setReplyingToMessage(null);
    setChatSentSuccessBadge(true);
    setTimeout(() => setChatSentSuccessBadge(false), 2800);

    await pushRoomChatMessagesToFirestore(cleanRoomKls, nextRoomList);

    setTimeout(() => {
      chatMessagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 80);
  };

  const handleAddChatReaction = async (msgId: string, emoji: string) => {
    const cleanRoom = currentIsolatedRoom;
    const prevRoomMessages =
      chatMessagesByRoom[cleanRoom] || buildInitialMessagesForRoom(cleanRoom);
    const nextRoomList = prevRoomMessages.map((m) => {
      if (m.id !== msgId) return m;
      const prevCount = m.reactions?.[emoji] || 0;
      return {
        ...m,
        reactions: {
          ...(m.reactions || {}),
          [emoji]: prevCount + 1,
        },
      };
    });
    setChatMessagesByRoom((prev) => ({
      ...prev,
      [cleanRoom]: nextRoomList,
    }));
    await pushRoomChatMessagesToFirestore(cleanRoom, nextRoomList);
  };

  const handleDeleteChatMessage = async (msgId: string) => {
    if (
      !requireTeacherSeatUnlock(
        'Menghapus pesan pada Ruang Obrolan Kelas (Khusus Guru)'
      )
    ) {
      return;
    }
    const cleanRoom = currentIsolatedRoom;
    const roomDocId = getFirestoreChatDocIdForKelas(cleanRoom);
    const prevRoomMessages =
      chatMessagesByRoom[cleanRoom] || buildInitialMessagesForRoom(cleanRoom);
    const nextRoomList = prevRoomMessages.filter((m) => m.id !== msgId);

    setChatMessagesByRoom((prev) => ({
      ...prev,
      [cleanRoom]: nextRoomList,
    }));

    try {
      const existingCloud = await firestoreRestReadDoc<{
        deletedIds?: string[];
      }>(FIRESTORE_CHAT_COLLECTION, roomDocId, 2000);
      const delIds = Array.from(new Set([...(existingCloud?.deletedIds || []), msgId]));
      await firestoreRestWriteDoc(FIRESTORE_CHAT_COLLECTION, roomDocId, {
        kelas: cleanRoom,
        messages: nextRoomList,
        deletedIds: delIds,
        updatedAt: Date.now(),
      });
    } catch {
      // ignore
    }
    triggerToast(`✓ Pesan pada Ruang Kelas ${cleanRoom} berhasil dihapus oleh Guru.`);
  };

  // Hitung jumlah pesan terpisah untuk masing-masing ruang kelas (VII-1 s/d VIII-6)
  const messageCountByKelas = useMemo(() => {
    const counts: Record<string, number> = {};
    ALL_KELAS_LIST.forEach((kls) => {
      const list = chatMessagesByRoom[kls] || [];
      counts[kls] = list.length;
    });
    return counts;
  }, [chatMessagesByRoom]);

  // Daftar pesan khusus dari Siswa di ruang kelas aktif (untuk memudahkan Guru membalas pesan siswa di kelas tersebut)
  const studentMessagesInCurrentRoom = useMemo(() => {
    const roomList =
      chatMessagesByRoom[currentIsolatedRoom] ||
      buildInitialMessagesForRoom(currentIsolatedRoom);
    return roomList.filter((m) => m.senderRole === 'SISWA');
  }, [chatMessagesByRoom, currentIsolatedRoom]);

  // Daftar pesan yang ditampilkan khusus untuk ruang kelas aktif (terisolasi dari kelas lain)
  const displayedChatMessages = useMemo(() => {
    const roomList =
      chatMessagesByRoom[currentIsolatedRoom] ||
      buildInitialMessagesForRoom(currentIsolatedRoom);
    const q = chatSearchText.trim().toLowerCase();
    if (!q) return roomList;
    return roomList.filter(
      (m) =>
        m.text.toLowerCase().includes(q) ||
        (m.senderName || '').toLowerCase().includes(q) ||
        (m.senderNis || '').toLowerCase().includes(q) ||
        (m.recipientName || '').toLowerCase().includes(q)
    );
  }, [chatMessagesByRoom, currentIsolatedRoom, chatSearchText]);

  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((prev) => (prev === msg ? null : prev));
    }, 4500);
  };

  const requireTeacherSeatUnlock = (reason: string): boolean => {
    if (isIdentifiedAsTeacher) return true;
    setLockedSeatActionReason(reason);
    setTeacherSeatPasswordInput('');
    setTeacherSeatPasswordError(null);
    setShowTeacherSeatLockModal(true);
    return false;
  };

  const handleVerifyTeacherSeatUnlock = (e: React.FormEvent) => {
    e.preventDefault();
    if (teacherSeatPasswordInput.trim() === EXAM_INFO.teacherPassword) {
      setIsTeacherSeatDeleteUnlocked(true);
      setIsTeacherDeskChatMode(true);
      try {
        sessionStorage.setItem(TEACHER_VERIFIED_SESSION_KEY, 'true');
      } catch {
        // ignore
      }
      setShowTeacherSeatLockModal(false);
      setTeacherSeatPasswordInput('');
      setTeacherSeatPasswordError(null);
      triggerToast(
        `🔓 Mode Guru Aktif (${EXAM_INFO.guruMapel})! Anda kini dapat mengelola, mengedit, atau menghapus bangku siswa di seluruh ruangan kelas.`
      );
    } else {
      setTeacherSeatPasswordError(
        'Password Guru salah! Menghapus bangku siswa lain atau mengelola seluruh bangku siswa hanya dapat dilakukan di Mode Guru.'
      );
    }
  };

  const handleVerifyTeacherWithGoogleAccount = async () => {
    setIsVerifyingGoogleTeacher(true);
    setTeacherSeatPasswordError(null);
    try {
      const res = await googleSignIn();
      const signedEmail = (res?.user?.email || getCurrentGoogleUser()?.email || '')
        .trim()
        .toLowerCase();
      if (signedEmail === EXAM_INFO.teacherEmail.trim().toLowerCase()) {
        setLiveGoogleTeacherEmail(signedEmail);
        setIsTeacherSeatDeleteUnlocked(true);
        setIsTeacherDeskChatMode(true);
        try {
          sessionStorage.setItem(TEACHER_VERIFIED_SESSION_KEY, 'true');
        } catch {
          // ignore
        }
        setShowTeacherSeatLockModal(false);
        triggerToast(
          `🔓 Teridentifikasi sebagai Guru melalui Akun Google Resmi (${signedEmail})! Fitur Pesan Siaran & Balas Chat Kelas kini aktif.`
        );
      } else if (signedEmail) {
        setTeacherSeatPasswordError(
          `Akun Google (${signedEmail}) bukan email resmi Guru Mapel (${EXAM_INFO.teacherEmail}). Silakan gunakan akun Guru atau masukkan Password Guru.`
        );
      } else {
        setTeacherSeatPasswordError(
          'Verifikasi Google dibatalkan. Silakan coba lagi atau masukkan Password Guru.'
        );
      }
    } catch {
      setTeacherSeatPasswordError(
        'Gagal memverifikasi akun Google. Silakan gunakan Password Guru Mapel.'
      );
    } finally {
      setIsVerifyingGoogleTeacher(false);
    }
  };

  const handleCopyOfficialStudentShareLink = async () => {
    try {
      const targetUrl = (studentShareUrl || getStoredStudentShareUrl()).trim();
      let sharedViaNative = false;

      // Manfaatkan Web Share API jika perangkat mendukung (misal di smartphone / tablet Guru)
      if (
        typeof navigator !== 'undefined' &&
        navigator.share &&
        /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent || '')
      ) {
        try {
          await navigator.share({
            title: 'Portal Ujian Siswa ANBK Informatika - UPTD SMPN 7 Kisaran',
            text: `Halo Siswa-siswi, silakan akses portal ujian informatika dan atur posisi bangku kelas melalui link resmi berikut:\n${targetUrl}`,
            url: targetUrl,
          });
          sharedViaNative = true;
        } catch {
          // Lanjut ke clipboard jika pengguna membatalkan dialog share bawaan
        }
      }

      if (!sharedViaNative) {
        if (navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(targetUrl);
        } else {
          const tempTa = document.createElement('textarea');
          tempTa.value = targetUrl;
          tempTa.style.position = 'fixed';
          tempTa.style.opacity = '0';
          document.body.appendChild(tempTa);
          tempTa.select();
          document.execCommand('copy');
          document.body.removeChild(tempTa);
        }
      }

      setShareUrlCopied(true);
      setTimeout(() => setShareUrlCopied(false), 2500);
      triggerToast(
        `🔒 Link Siswa (${targetUrl}) berhasil disalin & dibagikan! Setiap siswa hanya berhak mengisi 1 kali dan fitur Delete Bangku dikunci permanen bagi siswa.`
      );
    } catch {
      // ignore
    }
  };

  // Update kursi kosong otomatis saat pindah kelas jika tidak sedang mengedit
  useEffect(() => {
    if (!editingStudentId) {
      const nextSeat = findFirstEmptySeat(
        selectedKelas,
        roomConfigs[selectedKelas]?.capacity || 32,
        classroomStudents
      );
      setSeatNumberInput(nextSeat);
    }
  }, [selectedKelas, classroomStudents, editingStudentId, roomConfigs]);

  const handlePresetChange = (idx: number) => {
    setDevicePresetIndex(idx);
    const preset = DEVICE_PRESETS[idx];
    if (!preset) return;
    if (preset.category === 'AUTO') {
      setCustomDeviceCategory(detectedDevice.deviceCategory);
      setCustomDeviceBrand(detectedDevice.brand);
      setCustomDeviceModel(detectedDevice.modelType);
    } else {
      setCustomDeviceCategory(preset.category);
      setCustomDeviceBrand(preset.brand);
      setCustomDeviceModel(preset.model);
    }
  };

  const resetManualForm = (targetSeat?: number) => {
    setEditingStudentId(null);
    setNamaSiswaInput('');
    setNisNisnInput('');
    setSeatPhotoInput('');
    setDevicePresetIndex(0);
    setCustomDeviceCategory(detectedDevice.deviceCategory);
    setCustomDeviceBrand(detectedDevice.brand);
    setCustomDeviceModel(detectedDevice.modelType);
    setAttendanceStatusInput('Selesai Ujian');
    setSkorBenarInput(20);
    setTotalSoalInput(EXAM_INFO.totalSoal ?? 25);
    setStatusKecuranganInput('Tidak Ada Kecurangan (Jujur / Bersih)');
    setSyncToRekapChecked(true);
    setSeatNumberInput(
      targetSeat ??
        findFirstEmptySeat(selectedKelas, currentRoomConfig.capacity, classroomStudents)
    );
  };

  // Sinkronkan siswa manual ke state global Submissions (Rekap Hasil Ujian & Google Sheets)
  const syncClassroomStudentToGlobalSubmissions = (
    studentRecord: ClassroomSeatStudent,
    allClassroomList: ClassroomSeatStudent[]
  ) => {
    if (!studentRecord.includeInRekap) return;

    const nowFormatted = new Date().toLocaleString('id-ID', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });

    const resolvedPhoto =
      studentRecord.photoUrl ||
      getPhotoForStudentIdentity(studentRecord.namaSiswa, studentRecord.nisNisn, false) ||
      undefined;

    const newSubmission: StudentSubmission = {
      id: studentRecord.id,
      timestamp: studentRecord.updatedAt || nowFormatted,
      namaSiswa: studentRecord.namaSiswa,
      nisNisn: studentRecord.nisNisn,
      kelas: getCleanKelas(studentRecord.kelas),
      semester: studentRecord.semester,
      skorBenar: studentRecord.skorBenar,
      totalSoal: studentRecord.totalSoal,
      nilaiAkhir: studentRecord.nilaiAkhir,
      statusKecurangan: studentRecord.statusKecurangan,
      lulusTidakLulus: studentRecord.lulusTidakLulus,
      isCompleted: true,
      deviceCategory: studentRecord.deviceCategory,
      deviceBrand: studentRecord.deviceBrand,
      deviceModel: studentRecord.deviceModel,
      deviceOsBrowser: detectedDevice.osNameVersion + ' · ' + detectedDevice.browserName,
      deviceInfo: studentRecord.deviceInfo,
      photoUrl: resolvedPhoto,
      answers: {},
      doubtful: {},
      questionDurations: {},
      batteryHistory: [],
      violationCount: 0,
      violationLogs: [],
      questionOrder: [],
    };

    const existingIdx = submissions.findIndex(
      (s) =>
        s.id === studentRecord.id ||
        (s.nisNisn.trim().toLowerCase() === studentRecord.nisNisn.trim().toLowerCase() &&
          getCleanKelas(s.kelas) === getCleanKelas(studentRecord.kelas)) ||
        (s.namaSiswa.trim().toLowerCase() === studentRecord.namaSiswa.trim().toLowerCase() &&
          getCleanKelas(s.kelas) === getCleanKelas(studentRecord.kelas))
    );

    let nextSubmissions: StudentSubmission[];
    if (existingIdx >= 0) {
      nextSubmissions = [...submissions];
      nextSubmissions[existingIdx] = {
        ...nextSubmissions[existingIdx],
        ...newSubmission,
      };
    } else {
      nextSubmissions = [newSubmission, ...submissions];
    }

    onUpdateSubmissions(nextSubmissions);
  };

  // Ref untuk melacak fingerprint terakhir yang disimpan agar auto-save tidak berulang tanpa henti (anti-kedip)
  const lastSavedFingerprintRef = useRef<string>('');

  // Core saver: menyimpan data siswa ke bangku secara langsung dan akurat (Otomatis & Manual)
  const saveStudentDataCore = useCallback(
    (params?: { seatNum?: number; isAuto?: boolean; customName?: string }) => {
      const cleanName = (params?.customName ?? namaSiswaInput).trim();
      const cleanNis = nisNisnInput.trim();

      if (!cleanName || cleanName.length < 2) {
        return null;
      }

      const clampedSkor = Math.max(0, Math.min(totalSoalInput, Number(skorBenarInput) || 0));
      const clampedTotal = Math.max(1, Number(totalSoalInput) || (EXAM_INFO.totalSoal ?? 25));
      const computedNilai = Math.round((clampedSkor / clampedTotal) * 100);
      const isDisqualified =
        statusKecuranganInput.toLowerCase().includes('diskualifikasi') ||
        statusKecuranganInput.toLowerCase().includes('curang');
      const isPassedKkm75 = !isDisqualified && computedNilai >= EXAM_INFO.kkm;
      const lulusText = isPassedKkm75
        ? 'Lulus Ujian'
        : 'Tidak Lulus Ujian (Ujian Susulan)';

      // ATURAN KETAT: Siswa hanya akan masuk ke Denah Kelas di Classroom dan mengisi bangku kosong
      // saat siswa SUDAH MENYELESAIKAN SEMUA SOAL UJIAN dan DINYATAKAN LULUS UJIAN (Minimal Standar KKM 75).
      // Selain itu TIDAK BISA!
      if (!isPassedKkm75) {
        if (!params?.isAuto) {
          triggerToast(
            `⚠️ TIDAK BISA MENGISI BANGKU! Siswa "${cleanName}" memiliki Nilai ${computedNilai}% (Di bawah Standar KKM ${EXAM_INFO.kkm} / Tidak Lulus Ujian). Hanya siswa yang sudah menyelesaikan semua soal ujian dan dinyatakan LULUS UJIAN (Minimal KKM ${EXAM_INFO.kkm}) yang dapat masuk ke denah kelas & mengisi bangku kosong!`
          );
        }
        return null;
      }

      // Jika bukan Mode Guru, pastikan siswa tersebut memang sudah menyelesaikan ujian dan LULUS UJIAN (minimal KKM 75) di data ujian (submissions)
      if (!isIdentifiedAsTeacher) {
        const hasPassedExamRecord = submissions.some((sub) => {
          const sameName =
            sub.namaSiswa.trim().toLowerCase() === cleanName.toLowerCase();
          const sameNis =
            Boolean(cleanNis) &&
            cleanNis !== '-' &&
            sub.nisNisn.trim().toLowerCase() === cleanNis.toLowerCase();
          const subPassed =
            sub.isCompleted !== false &&
            (sub.nilaiAkhir ?? 0) >= EXAM_INFO.kkm &&
            !String(sub.lulusTidakLulus || '').toLowerCase().includes('tidak') &&
            !String(sub.statusKecurangan || '').toLowerCase().includes('diskualifikasi');
          return (sameName || sameNis) && subPassed;
        });

        if (!hasPassedExamRecord) {
          if (!params?.isAuto) {
            triggerToast(
              `🔒 TIDAK BISA MENGISI BANGKU! Siswa "${cleanName}" belum menyelesaikan semua soal ujian dengan status LULUS UJIAN (Minimal Standar KKM ${EXAM_INFO.kkm}). Selesaikan seluruh soal ujian terlebih dahulu hingga dinyatakan Lulus Ujian (Nilai ≥ ${EXAM_INFO.kkm}) untuk otomatis mengisi bangku kosong!`
            );
          }
          return null;
        }
      }

      const formattedDevice = `${customDeviceCategory.trim() || 'HP Android'} - ${
        customDeviceModel.trim() || customDeviceBrand.trim() || 'Perangkat Siswa'
      } (${detectedDevice.osNameVersion} · ${detectedDevice.browserName})`;

      const targetSeatNum = Math.max(1, Number(params?.seatNum ?? seatNumberInput) || 1);

      const existingAtTargetSeat = classroomStudents.find(
        (s) => getCleanKelas(s.kelas) === selectedKelas && s.seatNumber === targetSeatNum
      );

      // Proteksi Ketat: Siswa TIDAK DAPAT menimpa atau menghapus bangku siswa lainnya (Berlaku untuk semua bangku siswa lainnya)
      if (existingAtTargetSeat && !isIdentifiedAsTeacher) {
        const isEditingSameRecord = editingStudentId && existingAtTargetSeat.id === editingStudentId;
        const isSameStudentIdentity =
          existingAtTargetSeat.namaSiswa.trim().toLowerCase() === cleanName.toLowerCase() ||
          (cleanNis &&
            cleanNis !== '-' &&
            existingAtTargetSeat.nisNisn.trim().toLowerCase() === cleanNis.toLowerCase());
        if (!isEditingSameRecord && !isSameStudentIdentity) {
          if (!params?.isAuto) {
            triggerToast(
              `🔒 Bangku #${targetSeatNum} sudah ditempati oleh "${existingAtTargetSeat.namaSiswa}". Siswa tidak dapat menghapus atau menimpa bangku siswa lainnya (Hanya Mode Guru)!`
            );
          }
          return null;
        }
      }

      const resolvedPhotoForRecord =
        seatPhotoInput ||
        getPhotoForStudentIdentity(cleanName, cleanNis, false) ||
        existingAtTargetSeat?.photoUrl ||
        undefined;

      // Buat fingerprint dari data yang sedang diedit; jika sama persis dan ini adalah auto-save, hentikan agar tidak memicu render loop berkedip!
      const currentFingerprint = JSON.stringify({
        seat: targetSeatNum,
        name: cleanName,
        nis: cleanNis,
        kelas: selectedKelas,
        sem: selectedSemester,
        devCat: customDeviceCategory.trim(),
        devBrand: customDeviceBrand.trim(),
        devModel: customDeviceModel.trim(),
        att: attendanceStatusInput,
        skor: clampedSkor,
        total: clampedTotal,
        curang: statusKecuranganInput,
        rekap: syncToRekapChecked,
        photo: resolvedPhotoForRecord || '',
      });

      if (params?.isAuto && lastSavedFingerprintRef.current === currentFingerprint) {
        setAutoSaveStatus((prev) => (prev === 'SAVED' ? prev : 'SAVED'));
        return existingAtTargetSeat || null;
      }
      lastSavedFingerprintRef.current = currentFingerprint;

      const nowStr = new Date().toLocaleString('id-ID', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });

      // Otomatis sesuaikan kapasitas ruangan jika nomor bangku melebihi kapasitas saat ini
      if (targetSeatNum > currentRoomConfig.capacity) {
        setRoomConfigs((prev) => ({
          ...prev,
          [selectedKelas]: {
            ...currentRoomConfig,
            capacity: Math.min(60, Math.max(targetSeatNum, currentRoomConfig.capacity + 4)),
          },
        }));
      }

      const targetId =
        editingStudentId ||
        (existingAtTargetSeat ? existingAtTargetSeat.id : `CLS-MANUAL-${Date.now()}`);
      if (!editingStudentId) {
        setEditingStudentId(targetId);
      }

      const record: ClassroomSeatStudent = {
        id: targetId,
        seatNumber: targetSeatNum,
        namaSiswa: cleanName,
        nisNisn: cleanNis,
        kelas: selectedKelas,
        semester: selectedSemester,
        deviceCategory: customDeviceCategory.trim() || 'HP Android',
        deviceBrand: customDeviceBrand.trim() || 'Android',
        deviceModel: customDeviceModel.trim() || 'Smartphone Siswa',
        deviceInfo: formattedDevice,
        attendanceStatus: attendanceStatusInput,
        skorBenar: clampedSkor,
        totalSoal: clampedTotal,
        nilaiAkhir: computedNilai,
        statusKecurangan: statusKecuranganInput,
        lulusTidakLulus: lulusText,
        includeInRekap: syncToRekapChecked,
        updatedAt: nowStr,
        photoUrl: resolvedPhotoForRecord,
      };

      let nextList: ClassroomSeatStudent[];
      if (editingStudentId) {
        const currentlyEditing = classroomStudents.find((s) => s.id === editingStudentId);
        const oldSeat = currentlyEditing?.seatNumber ?? targetSeatNum;
        nextList = classroomStudents.map((item) => {
          if (item.id === editingStudentId) {
            return record;
          }
          if (
            existingAtTargetSeat &&
            item.id === existingAtTargetSeat.id &&
            item.id !== editingStudentId
          ) {
            // Tukar nomor bangku otomatis agar tidak terjadi bangku ganda
            return { ...item, seatNumber: oldSeat };
          }
          return item;
        });
      } else if (existingAtTargetSeat) {
        nextList = classroomStudents.map((item) =>
          item.id === existingAtTargetSeat.id ? record : item
        );
      } else {
        nextList = [...classroomStudents, record];
      }

      setClassroomStudents(nextList);

      const nextActiveObj = {
        namaSiswa: record.namaSiswa,
        nisNisn: record.nisNisn,
        kelas: record.kelas,
        semester: record.semester,
        seatNumber: record.seatNumber,
        isNew: false,
        syncedAt: nowStr,
        deviceCategory: record.deviceCategory,
        deviceModel: record.deviceModel,
        photoUrl: record.photoUrl,
      };
      setActiveSyncedStudentBanner((prev) =>
        prev &&
        prev.namaSiswa === nextActiveObj.namaSiswa &&
        prev.nisNisn === nextActiveObj.nisNisn &&
        prev.kelas === nextActiveObj.kelas &&
        prev.seatNumber === nextActiveObj.seatNumber &&
        prev.photoUrl === nextActiveObj.photoUrl
          ? prev
          : nextActiveObj
      );

      try {
        localStorage.setItem(STORAGE_KEY_STUDENTS, JSON.stringify(nextList));
        localStorage.setItem(STORAGE_KEY_ACTIVE_SYNC, JSON.stringify(nextActiveObj));
        window.dispatchEvent(
          new CustomEvent(CLASSROOM_SYNC_EVENT, {
            detail: {
              internalSave: true,
              assignedSeat: targetSeatNum,
              isNew: false,
              student: record,
              list: nextList,
            },
          })
        );
      } catch {}

      if (syncToRekapChecked) {
        syncClassroomStudentToGlobalSubmissions(record, nextList);
      }

      setAutoSaveStatus('SAVED');
      setLastAutoSavedTime(nowStr);
      return record;
    },
    [
      namaSiswaInput,
      nisNisnInput,
      seatPhotoInput,
      seatNumberInput,
      selectedKelas,
      selectedSemester,
      totalSoalInput,
      skorBenarInput,
      statusKecuranganInput,
      customDeviceCategory,
      customDeviceModel,
      customDeviceBrand,
      detectedDevice,
      currentRoomConfig,
      classroomStudents,
      editingStudentId,
      syncToRekapChecked,
      attendanceStatusInput,
    ]
  );

  // Ref terbaru untuk fungsi saveStudentDataCore agar useEffect auto-save hanya berjalan ketika nilai input berubah (tidak memicu loop berkedip)
  const saveStudentDataCoreRef = useRef(saveStudentDataCore);
  useEffect(() => {
    saveStudentDataCoreRef.current = saveStudentDataCore;
  }, [saveStudentDataCore]);

  // Debounced Auto-Save: Menyimpan data bangku secara otomatis saat siswa mengetik tanpa berkedip berulang
  const isInitialAutoSaveMountRef = useRef(true);
  useEffect(() => {
    if (!namaSiswaInput || namaSiswaInput.trim().length < 2) {
      setAutoSaveStatus('SAVED');
      return;
    }

    const candidateFingerprint = JSON.stringify({
      seat: Math.max(1, Number(seatNumberInput) || 1),
      name: namaSiswaInput.trim(),
      nis: nisNisnInput.trim(),
      kelas: selectedKelas,
      sem: selectedSemester,
      devCat: customDeviceCategory.trim(),
      devBrand: customDeviceBrand.trim(),
      devModel: customDeviceModel.trim(),
      att: attendanceStatusInput,
      skor: Math.max(0, Math.min(totalSoalInput, Number(skorBenarInput) || 0)),
      total: Math.max(1, Number(totalSoalInput) || (EXAM_INFO.totalSoal ?? 25)),
      curang: statusKecuranganInput,
      rekap: syncToRekapChecked,
      photo:
        seatPhotoInput ||
        getPhotoForStudentIdentity(namaSiswaInput.trim(), nisNisnInput.trim(), false) ||
        '',
    });

    if (isInitialAutoSaveMountRef.current) {
      isInitialAutoSaveMountRef.current = false;
      lastSavedFingerprintRef.current = candidateFingerprint;
      return;
    }

    if (lastSavedFingerprintRef.current === candidateFingerprint) {
      return;
    }

    setAutoSaveStatus('SAVING');
    const timer = setTimeout(() => {
      saveStudentDataCoreRef.current({ isAuto: true });
    }, 450);
    return () => clearTimeout(timer);
  }, [
    namaSiswaInput,
    nisNisnInput,
    seatPhotoInput,
    seatNumberInput,
    selectedKelas,
    selectedSemester,
    customDeviceCategory,
    customDeviceModel,
    customDeviceBrand,
    attendanceStatusInput,
    skorBenarInput,
    totalSoalInput,
    statusKecuranganInput,
    syncToRekapChecked,
  ]);

  // Handler Submit Input Data Siswa Manual
  const handleManualSubmitStudent = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = namaSiswaInput.trim();
    if (!cleanName) {
      triggerToast('Mohon isi Nama Lengkap Siswa terlebih dahulu!');
      return;
    }
    const rec = saveStudentDataCore({ isAuto: false });
    if (rec) {
      triggerToast(
        `✓ Data Siswa "${rec.namaSiswa}" otomatis disimpan di Bangku #${rec.seatNumber} (Kelas ${selectedKelas})${
          syncToRekapChecked ? ' & disinkronkan ke Rekap Hasil Ujian!' : '!'
        }`
      );
    }
  };

  // Handler Klik Kursi di Denah Kelas
  const handleSeatClick = (seatNum: number) => {
    // Jika sedang mode Pindah / Tukar Bangku (Khusus Mode Guru)
    if (swapSourceSeat !== null) {
      if (!isIdentifiedAsTeacher) {
        setSwapSourceSeat(null);
        requireTeacherSeatUnlock(
          'Menukar atau memindahkan bangku siswa lainnya (Khusus Mode Guru · Siswa tidak dapat mengubah bangku siswa lain)'
        );
        return;
      }
      if (swapSourceSeat === seatNum) {
        setSwapSourceSeat(null);
        return;
      }
      const nextList = classroomStudents.map((s) => {
        if (getCleanKelas(s.kelas) !== selectedKelas) return s;
        if (s.seatNumber === swapSourceSeat) {
          return { ...s, seatNumber: seatNum };
        }
        if (s.seatNumber === seatNum) {
          return { ...s, seatNumber: swapSourceSeat };
        }
        return s;
      });
      setClassroomStudents(nextList);
      triggerToast(
        `✓ Posisi Bangku #${swapSourceSeat} dan Bangku #${seatNum} di Kelas ${selectedKelas} berhasil ditukar oleh Guru!`
      );
      setSwapSourceSeat(null);
      return;
    }

    const occupant = studentsInSelectedKelas.find((s) => s.seatNumber === seatNum);
    if (occupant) {
      const storedProf = loadStoredStudentProfile();
      const isOwnActiveSeat =
        (activeSyncedStudentBanner &&
          getCleanKelas(activeSyncedStudentBanner.kelas) === getCleanKelas(occupant.kelas) &&
          activeSyncedStudentBanner.seatNumber === occupant.seatNumber) ||
        (storedProf.namaSiswa &&
          occupant.namaSiswa.trim().toLowerCase() === storedProf.namaSiswa.trim().toLowerCase()) ||
        (storedProf.nisNisn &&
          storedProf.nisNisn !== '-' &&
          occupant.nisNisn.trim().toLowerCase() === storedProf.nisNisn.trim().toLowerCase());

      // Jika bukan Mode Guru dan bangku milik siswa lain, kunci agar siswa tidak dapat mengedit/menghapus bangku siswa lainnya
      if (!isIdentifiedAsTeacher && !isOwnActiveSeat) {
        triggerToast(
          `🔒 Meja #${seatNum} milik "${occupant.namaSiswa}". Siswa tidak dapat mengedit atau menghapus bangku siswa lainnya (Khusus Mode Guru)!`
        );
        return;
      }

      const rawOccupantNis = (occupant.nisNisn || '').trim();
      const isRandomGeneratedOccupantNis =
        occupant.id.startsWith('CLS-AUTO-') &&
        /^00\d{8}$/.test(rawOccupantNis) &&
        (!storedProf.nisNisn || !storedProf.nisNisn.trim());
      const cleanOccupantNis = isRandomGeneratedOccupantNis ? '' : rawOccupantNis;

      setEditingStudentId(occupant.id);
      setSeatNumberInput(occupant.seatNumber);
      setNamaSiswaInput(occupant.namaSiswa);
      setNisNisnInput(cleanOccupantNis);
      setSeatPhotoInput(
        occupant.photoUrl ||
          getPhotoForStudentIdentity(occupant.namaSiswa, cleanOccupantNis, false) ||
          ''
      );
      setSelectedSemester(occupant.semester);
      setCustomDeviceCategory(occupant.deviceCategory);
      setCustomDeviceBrand(occupant.deviceBrand);
      setCustomDeviceModel(occupant.deviceModel);
      setAttendanceStatusInput(occupant.attendanceStatus);
      setSkorBenarInput(occupant.skorBenar);
      setTotalSoalInput(occupant.totalSoal);
      setStatusKecuranganInput(occupant.statusKecurangan);
      setSyncToRekapChecked(occupant.includeInRekap);
      triggerToast(
        `✓ Membuka Bangku #${seatNum} (${occupant.namaSiswa}) pada Form Panel Kiri untuk diedit.`
      );
    } else {
      // Jika siswa sudah mengetik nama di form, langsung pindah & simpan ke bangku kosong ini secara otomatis!
      if (namaSiswaInput.trim().length >= 2) {
        setSeatNumberInput(seatNum);
        saveStudentDataCore({ seatNum, isAuto: true });
        triggerToast(
          `✓ Siswa "${namaSiswaInput.trim()}" otomatis disimpan & menempati Bangku Kosong #${seatNum} (Kelas ${selectedKelas})!`
        );
      } else {
        resetManualForm(seatNum);
        triggerToast(
          `✓ Bangku Kosong #${seatNum} dipilih. Ketik nama siswa dan bangku akan otomatis tersimpan di dalamnya.`
        );
      }
    }
  };

  const [seatStudentToDelete, setSeatStudentToDelete] = useState<ClassroomSeatStudent | null>(null);

  // Handler Hapus Siswa dari Bangku — HANYA MODE GURU (BERLAKU UNTUK SEMUA BANGKU SISWA LAINNYA)
  const handleDeleteSeatStudent = (student: ClassroomSeatStudent) => {
    if (
      !requireTeacherSeatUnlock(
        `Menghapus Bangku #${student.seatNumber} (${student.namaSiswa} · Kelas ${student.kelas}) — Siswa tidak dapat menghapus bangku siswa lainnya, fitur ini hanya berlaku di Mode Guru untuk semua bangku siswa`
      )
    ) {
      return;
    }
    setSeatStudentToDelete(student);
  };

  const handleExecuteDeleteSeatStudent = (student: ClassroomSeatStudent) => {
    const nextList = classroomStudents.filter((s) => s.id !== student.id);
    setClassroomStudents(nextList);

    // Hapus juga dari submissions global jika ada
    const nextSubs = submissions.filter(
      (sub) =>
        sub.id !== student.id &&
        !(
          sub.nisNisn.trim().toLowerCase() === student.nisNisn.trim().toLowerCase() &&
          getCleanKelas(sub.kelas) === getCleanKelas(student.kelas)
        )
    );
    if (nextSubs.length !== submissions.length) {
      onUpdateSubmissions(nextSubs);
    }

    if (editingStudentId === student.id) {
      resetManualForm(student.seatNumber);
    }
    setSeatStudentToDelete(null);
    triggerToast(
      `✓ [MODE GURU] Bangku #${student.seatNumber} (${student.namaSiswa}) telah dihapus/dikosongkan secara permanen dari Kelas ${selectedKelas}.`
    );
  };

  // Handler Bulk Input Siswa Manual (Banyak Siswa Sekaligus — Khusus Guru, Murid hanya boleh 1 kali)
  const handleBulkAddStudents = (e: React.FormEvent) => {
    e.preventDefault();
    if (
      !requireTeacherSeatUnlock(
        'Input Banyak Siswa Sekaligus (Khusus Guru · Setiap siswa hanya berhak mengisi 1 kali)'
      )
    ) {
      return;
    }
    const lines = bulkTextInput
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);

    if (lines.length === 0) {
      triggerToast('Masukkan minimal 1 baris data siswa!');
      return;
    }

    const nowStr = new Date().toLocaleString('id-ID', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });

    const updatedList = [...classroomStudents];
    const newSubmissionsToAdd: StudentSubmission[] = [];
    let addedCount = 0;

    lines.forEach((line, idx) => {
      // Format dukungan: Nama Siswa | NISN | Nilai (opsional) | Device (opsional)
      // atau dipisah koma / tab / titik koma
      const parts = line.split(/[|;\t,]/).map((p) => p.trim());
      const rawName = parts[0]?.replace(/^\d+[\.\)]\s*/, '').trim();
      if (!rawName) return;

      const rawNis =
        parts[1] && parts[1].length >= 4
          ? parts[1]
          : `008${Math.floor(1000000 + Math.random() * 8999999)}`;
      const rawScore = parts[2] !== undefined && !isNaN(Number(parts[2])) ? Number(parts[2]) : 80;
      const clampedNilai = Math.max(0, Math.min(100, rawScore));
      const skorBenar = Math.round((clampedNilai / 100) * 10);
      const rawDevice =
        parts[3] || `${customDeviceCategory} - ${customDeviceModel}`;

      const nextSeat = findFirstEmptySeat(
        selectedKelas,
        Math.max(currentRoomConfig.capacity, 40),
        updatedList
      );

      const newStudent: ClassroomSeatStudent = {
        id: `CLS-BULK-${Date.now()}-${idx}`,
        seatNumber: nextSeat,
        namaSiswa: rawName,
        nisNisn: rawNis,
        kelas: selectedKelas,
        semester: selectedSemester,
        deviceCategory: customDeviceCategory || 'HP Android',
        deviceBrand: customDeviceBrand || 'Samsung',
        deviceModel: rawDevice,
        deviceInfo: `${customDeviceCategory || 'HP Android'} - ${rawDevice} (${detectedDevice.osNameVersion})`,
        attendanceStatus: 'Selesai Ujian',
        skorBenar,
        totalSoal: 10,
        nilaiAkhir: clampedNilai,
        statusKecurangan: 'Tidak Ada Kecurangan (Jujur / Bersih)',
        lulusTidakLulus:
          clampedNilai >= EXAM_INFO.kkm
            ? 'Lulus Ujian'
            : 'Tidak Lulus Ujian (Ujian Susulan)',
        includeInRekap: true,
        updatedAt: nowStr,
      };

      updatedList.push(newStudent);
      addedCount++;

      newSubmissionsToAdd.push({
        id: newStudent.id,
        timestamp: nowStr,
        namaSiswa: newStudent.namaSiswa,
        nisNisn: newStudent.nisNisn,
        kelas: selectedKelas,
        semester: selectedSemester,
        skorBenar: newStudent.skorBenar,
        totalSoal: newStudent.totalSoal,
        nilaiAkhir: newStudent.nilaiAkhir,
        statusKecurangan: newStudent.statusKecurangan,
        lulusTidakLulus: newStudent.lulusTidakLulus,
        isCompleted: true,
        deviceCategory: newStudent.deviceCategory,
        deviceBrand: newStudent.deviceBrand,
        deviceModel: newStudent.deviceModel,
        deviceOsBrowser: `${detectedDevice.osNameVersion} · ${detectedDevice.browserName}`,
        deviceInfo: newStudent.deviceInfo,
        answers: {},
        doubtful: {},
        questionDurations: {},
        batteryHistory: [],
        violationCount: 0,
        violationLogs: [],
        questionOrder: [],
      });
    });

    if (addedCount > 0) {
      setClassroomStudents(updatedList);
      onUpdateSubmissions([...newSubmissionsToAdd, ...submissions]);
      setBulkTextInput('');
      setShowBulkModal(false);
      triggerToast(
        `✓ Berhasil menambahkan ${addedCount} Siswa secara manual ke Kelas ${selectedKelas} & menyinkronkan ke Rekap Hasil Ujian!`
      );
    }
  };

  // Sinkronkan seluruh siswa di Design Classroom ke Rekap Hasil Ujian & Google Sheets
  const handleSyncAllClassroomToRekap = () => {
    const existingMap = new Map<string, StudentSubmission>();
    submissions.forEach((s) => {
      const key = `${s.nisNisn.trim().toLowerCase()}__${getCleanKelas(s.kelas)}`;
      existingMap.set(key, s);
    });

    classroomStudents.forEach((cs) => {
      if (!cs.includeInRekap) return;
      const key = `${cs.nisNisn.trim().toLowerCase()}__${getCleanKelas(cs.kelas)}`;
      const prev = existingMap.get(key);
      existingMap.set(key, {
        answers: {},
        doubtful: {},
        questionDurations: {},
        batteryHistory: [],
        violationCount: 0,
        violationLogs: [],
        questionOrder: [],
        ...(prev || {}),
        id: prev?.id || cs.id,
        timestamp: cs.updatedAt || prev?.timestamp || new Date().toLocaleString('id-ID'),
        namaSiswa: cs.namaSiswa,
        nisNisn: cs.nisNisn,
        kelas: getCleanKelas(cs.kelas),
        semester: cs.semester,
        skorBenar: cs.skorBenar,
        totalSoal: cs.totalSoal,
        nilaiAkhir: cs.nilaiAkhir,
        statusKecurangan: cs.statusKecurangan,
        lulusTidakLulus: cs.lulusTidakLulus,
        isCompleted: true,
        deviceCategory: cs.deviceCategory,
        deviceBrand: cs.deviceBrand,
        deviceModel: cs.deviceModel,
        deviceOsBrowser:
          prev?.deviceOsBrowser ||
          `${detectedDevice.osNameVersion} · ${detectedDevice.browserName}`,
        deviceInfo: cs.deviceInfo,
        photoUrl:
          getPhotoForStudentIdentity(cs.namaSiswa, cs.nisNisn) || prev?.photoUrl || undefined,
      });
    });

    const mergedSubs = Array.from(existingMap.values());
    onUpdateSubmissions(mergedSubs);
    triggerToast(
      `✓ Seluruh Data Siswa Design Classroom (${mergedSubs.length} Siswa) berhasil disinkronkan ke Siswa Dashboard & Server Rekapitulasi!`
    );
  };

  const updateCurrentRoomConfig = (patch: Partial<ClassroomRoomConfig>) => {
    if (
      !requireTeacherSeatUnlock(
        `Mengubah konfigurasi atau denah ruangan Kelas ${selectedKelas} (maupun kelas lain)`
      )
    ) {
      return;
    }
    setRoomConfigs((prev) => ({
      ...prev,
      [selectedKelas]: {
        ...currentRoomConfig,
        ...patch,
      },
    }));
  };

  // Daftar nomor bangku 1..capacity
  const seatNumbers = useMemo(() => {
    const maxSeatInClass = studentsInSelectedKelas.reduce(
      (max, s) => Math.max(max, s.seatNumber),
      currentRoomConfig.capacity
    );
    const totalSeats = Math.max(currentRoomConfig.capacity, maxSeatInClass);
    return Array.from({ length: totalSeats }, (_, i) => i + 1);
  }, [currentRoomConfig.capacity, studentsInSelectedKelas]);

  const filteredStudentsList = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return studentsInSelectedKelas;
    return studentsInSelectedKelas.filter(
      (s) =>
        s.namaSiswa.toLowerCase().includes(q) ||
        s.nisNisn.toLowerCase().includes(q) ||
        s.deviceInfo.toLowerCase().includes(q) ||
        String(s.seatNumber).includes(q)
    );
  }, [studentsInSelectedKelas, searchQuery]);

  const renderDeviceIcon = (cat: string) => {
    const lower = (cat || '').toLowerCase();
    if (lower.includes('tablet') || lower.includes('ipad')) {
      return <Tablet className="w-3.5 h-3.5 text-purple-300 shrink-0" />;
    }
    if (lower.includes('laptop') || lower.includes('pc') || lower.includes('chromebook')) {
      return <Laptop className="w-3.5 h-3.5 text-sky-300 shrink-0" />;
    }
    return <Smartphone className="w-3.5 h-3.5 text-emerald-300 shrink-0" />;
  };

  return (
    <main className="flex-1 max-w-7xl w-full mx-auto px-1 sm:px-3 lg:px-5 py-1 sm:py-2 space-y-1 sm:space-y-2">
      {/* Notifikasi Toast */}
      {toastMessage && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 max-w-xl w-[92%] px-3 py-2 rounded-xl bg-emerald-950/95 border border-emerald-400 text-emerald-100 text-[10px] sm:text-xs font-bold shadow-2xl flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{toastMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setToastMessage(null)}
            className="p-0.5 rounded-lg hover:bg-white/10 text-emerald-200 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* HEADER BANNER DESIGN CLASSROOM — TATA LETAK PROFESIONAL & TERSTRUKTUR */}
      <section className="rounded-lg sm:rounded-xl border border-sky-500/35 bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 p-1.5 sm:p-2.5 text-white shadow-md space-y-1.5 sm:space-y-2">
        {/* Baris 1: Judul Utama & Ringkasan Kapasitas Ruangan */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-1.5 sm:gap-2.5 pb-1.5 sm:pb-2 border-b border-white/10">
          <div className="space-y-0.5 min-w-0">
            <div className="inline-flex items-center gap-1 text-[7.5px] sm:text-[9px] font-extrabold uppercase tracking-wider text-amber-300">
              <LayoutGrid className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-amber-300 shrink-0" />
              <span>DESIGN CLASSROOM · ANBK INFORMATIKA</span>
            </div>
            <h1 className="font-display text-xs sm:text-base lg:text-lg font-extrabold tracking-tight text-white leading-tight">
              Desain Tata Letak Ruangan Kelas (Design Classroom)
            </h1>
            <p className="text-[9px] sm:text-[11px] text-slate-300 max-w-3xl leading-snug">
              Atur denah tempat duduk ruang ujian CBT untuk Kelas{' '}
              <strong className="text-amber-300">VII-1 s/d VII-5</strong> dan{' '}
              <strong className="text-amber-300">VIII-1 s/d VIII-6</strong>, pantau penempatan bangku siswa yang otomatis terisi, lalu sinkronkan ke{' '}
              <strong className="text-sky-300">Siswa Dashboard &amp; Server Rekapitulasi</strong>.
            </p>
          </div>

          {/* Kartu Metrik Kapasitas Ruangan di Kanan Atas */}
          <div className="grid grid-cols-2 gap-1 sm:gap-1.5 sm:w-auto lg:w-56 shrink-0">
            <div className="rounded-md sm:rounded-lg bg-slate-950/85 border border-sky-400/30 px-2 py-1">
              <span className="text-[7.5px] sm:text-[8.5px] font-mono uppercase tracking-wider text-sky-300 block">
                Kapasitas Kelas {selectedKelas}
              </span>
              <div className="font-mono text-xs sm:text-sm font-extrabold text-white mt-0.5 tabular-nums">
                <span className="text-emerald-300">{studentsInSelectedKelas.length}</span>
                <span className="text-slate-400 text-[9px] sm:text-[11px]"> / {currentRoomConfig.capacity}</span>
              </div>
              <span className="text-[7.5px] sm:text-[9px] text-slate-400 block">Bangku Terisi</span>
            </div>

            <div className="rounded-md sm:rounded-lg bg-slate-950/85 border border-amber-400/30 px-2 py-1">
              <span className="text-[7.5px] sm:text-[8.5px] font-mono uppercase tracking-wider text-amber-300 block">
                Total Semua Kelas
              </span>
              <div className="font-mono text-xs sm:text-sm font-extrabold text-amber-300 mt-0.5 tabular-nums">
                {classroomStudents.length}
              </div>
              <span className="text-[7.5px] sm:text-[9px] text-slate-400 block">Siswa Terdaftar</span>
            </div>
          </div>
        </div>

        {/* Baris 2: Toolbar Aksi Utama (4 Tombol Sejajar & Proporsional) */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-1 sm:gap-1.5">
          <button
            type="button"
            onClick={onBackToHome}
            className="h-6 sm:h-7 px-1.5 sm:px-2.5 rounded-md border border-white/20 bg-white/10 hover:bg-white/15 text-white text-[9px] sm:text-[11px] font-bold flex items-center justify-center gap-1 transition-all cursor-pointer whitespace-nowrap"
          >
            <ArrowLeft className="w-2.5 h-2.5 sm:w-3 sm:h-3 shrink-0" />
            <span>Kembali ke Portal Ujian</span>
          </button>

          <button
            type="button"
            onClick={() => {
              if (
                requireTeacherSeatUnlock(
                  'Input Banyak Siswa Sekaligus (Khusus Guru · Siswa hanya berhak mengisi 1 kali)'
                )
              ) {
                setShowBulkModal(true);
              }
            }}
            className="h-6 sm:h-7 px-1.5 sm:px-2.5 rounded-md border border-amber-400/50 bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 text-[9px] sm:text-[11px] font-extrabold flex items-center justify-center gap-1 transition-all cursor-pointer whitespace-nowrap"
          >
            {isTeacherSeatDeleteUnlocked ? (
              <PlusCircle className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-amber-300 shrink-0" />
            ) : (
              <Lock className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-amber-300 shrink-0" />
            )}
            <span>Input Banyak Siswa</span>
          </button>

          <button
            type="button"
            onClick={() => setShowSyncDateModal(true)}
            className="h-6 sm:h-7 px-1.5 sm:px-2.5 rounded-md bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-[9px] sm:text-[11px] font-extrabold shadow-xs flex items-center justify-center gap-1 transition-all cursor-pointer whitespace-nowrap"
          >
            <FileSpreadsheet className="w-2.5 h-2.5 sm:w-3 sm:h-3 shrink-0" />
            <span>Sinkron ke Rekapitulasi</span>
          </button>

          <button
            type="button"
            onClick={onOpenStudentDashboard}
            className="h-6 sm:h-7 px-1.5 sm:px-2.5 rounded-md bg-sky-500 hover:bg-sky-400 text-slate-950 text-[9px] sm:text-[11px] font-extrabold shadow-xs flex items-center justify-center gap-1 transition-all cursor-pointer whitespace-nowrap"
          >
            <Users className="w-2.5 h-2.5 sm:w-3 sm:h-3 shrink-0" />
            <span>Siswa Dashboard ({submissions.length})</span>
          </button>
        </div>

        {/* Baris 3: Pemilih Ruangan Kelas Terstruktur (Grid 11 Kelas Rapi & Sejajar) */}
        <div className="pt-1.5 border-t border-white/10 space-y-1">
          <div className="flex flex-wrap items-center justify-between gap-1">
            <span className="text-[9.5px] sm:text-[11px] font-bold text-sky-300 flex items-center gap-1">
              <Layers className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-amber-300 shrink-0" />
              <span>Pilih Ruangan Kelas CBT (Jenjang Kelas VII &amp; VIII):</span>
            </span>
            <span className="text-[8.5px] sm:text-[10px] font-mono text-slate-300">
              Ruangan Aktif: <strong className="text-amber-300">{currentRoomConfig.roomName}</strong> · Kelas <strong className="text-white">{selectedKelas}</strong>
            </span>
          </div>

          <div className="grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-11 gap-1">
            {ALL_KELAS_LIST.map((kls) => {
              const countInKls = classroomStudents.filter(
                (s) => getCleanKelas(s.kelas) === kls
              ).length;
              const isSelected = selectedKelas === kls;
              return (
                <button
                  key={kls}
                  type="button"
                  onClick={() => {
                    setSelectedKelas(kls);
                    setEditingStudentId(null);
                    setSwapSourceSeat(null);
                  }}
                  className={`h-5.5 sm:h-6.5 px-1 sm:px-1.5 rounded-md text-[9.5px] sm:text-[11px] font-extrabold transition-all cursor-pointer flex items-center justify-center gap-0.5 sm:gap-1 ${
                    isSelected
                      ? 'bg-amber-400 text-slate-950 shadow ring-1 ring-amber-300'
                      : 'bg-slate-900/90 text-slate-300 border border-white/15 hover:bg-slate-800 hover:text-white'
                  }`}
                >
                  <span>{kls}</span>
                  <span
                    className={`px-1 py-0.1 rounded text-[7.5px] sm:text-[8.5px] font-mono ${
                      isSelected
                        ? 'bg-slate-950 text-amber-300 font-black'
                        : countInKls > 0
                        ? 'bg-emerald-500/25 text-emerald-300'
                        : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {countInKls}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* =================================================================== */}
      {/* FITUR SINKRONISASI DESIGN CLASSROOM & DENAH BANGKU KOSONG (REAL-TIME) */}
      {/* =================================================================== */}
      <section
        className={`rounded-lg sm:rounded-xl border p-1.5 sm:p-2.5 space-y-1.5 shadow-md text-white ${
          darkMode
            ? 'bg-gradient-to-br from-slate-950 via-slate-900/95 to-emerald-950/40 border-emerald-400/50'
            : 'bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950/50 border-emerald-400/50'
        }`}
      >
        <div className="flex flex-wrap items-center justify-between gap-1 border-b border-white/10 pb-1">
          <div className="flex items-center gap-1.5">
            <div className="w-5.5 h-5.5 sm:w-6.5 sm:h-6.5 rounded-md bg-emerald-500/20 border border-emerald-400/50 flex items-center justify-center text-emerald-300 shrink-0 shadow-inner">
              <Layers className="w-3 h-3" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-1">
                <h3 className="text-[9px] sm:text-[11px] font-extrabold uppercase tracking-wider text-emerald-300">
                  SINKRONISASI DESIGN CLASSROOM &amp; DENAH BANGKU KOSONG
                </h3>
                <span className="px-1 py-0.1 rounded-full bg-emerald-500/20 border border-emerald-400/50 text-[7.5px] sm:text-[8.5px] font-mono font-extrabold text-emerald-300">
                  AUTO-SYNC AKTIF
                </span>
              </div>
              <span className="text-[8.5px] sm:text-[9.5px] text-slate-300 font-medium block">
                Penempatan denah bangku siswa otomatis real-time dari Formulir Ujian &amp; Input Manual
              </span>
            </div>
          </div>

          <div>
            {activeSyncedStudentBanner ? (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] sm:text-[10.5px] font-mono font-extrabold bg-emerald-500/25 border border-emerald-400 text-emerald-200 shadow-xs animate-pulse">
                <CheckCircle2 className="w-2.5 h-2.5 text-emerald-400" />
                <span>Bangku #{activeSyncedStudentBanner.seatNumber} (Kelas {activeSyncedStudentBanner.kelas})</span>
              </span>
            ) : editingStudentId ? (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] sm:text-[10.5px] font-mono font-extrabold bg-sky-500/25 border border-sky-400 text-sky-200 shadow-xs">
                <Edit3 className="w-2.5 h-2.5 text-sky-300" />
                <span>Mengedit Bangku #{seatNumberInput}</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[8.5px] sm:text-[9.5px] font-mono font-bold bg-slate-900 border border-white/20 text-slate-300">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                <span>Siap Menerima Siswa Baru</span>
              </span>
            )}
          </div>
        </div>

        {/* Grid Ringkasan Pemetaan Bangku: 4 Kolom Rapi dan Sejajar */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-1 sm:gap-1.5 text-[9.5px] sm:text-[11px]">
          <div className="p-1 sm:p-1.5 rounded-md bg-slate-950/80 border border-white/10 space-y-0.5">
            <span className="text-[7.5px] sm:text-[8.5px] font-mono uppercase tracking-wider text-sky-300 block">
              1. Nama Siswa
            </span>
            <span className="text-[9.5px] sm:text-[11px] font-bold text-white block truncate">
              {activeSyncedStudentBanner?.namaSiswa || (namaSiswaInput.trim() ? namaSiswaInput : 'Siap Terisi')}
            </span>
          </div>

          <div className="p-1 sm:p-1.5 rounded-md bg-slate-950/80 border border-white/10 space-y-0.5">
            <span className="text-[7.5px] sm:text-[8.5px] font-mono uppercase tracking-wider text-sky-300 block">
              2. NIS / NISN
            </span>
            <span className="text-[9.5px] sm:text-[11px] font-mono font-bold text-amber-300 block truncate">
              {activeSyncedStudentBanner?.nisNisn || (nisNisnInput.trim() ? nisNisnInput : 'Otomatis dibuat')}
            </span>
          </div>

          <div className="p-1 sm:p-1.5 rounded-md bg-slate-950/80 border border-white/10 space-y-0.5">
            <span className="text-[7.5px] sm:text-[8.5px] font-mono uppercase tracking-wider text-sky-300 block">
              3. Ruang &amp; Semester
            </span>
            <span className="text-[9.5px] sm:text-[11px] font-bold text-emerald-300 block truncate">
              Kelas {activeSyncedStudentBanner?.kelas || selectedKelas} · {activeSyncedStudentBanner?.semester || selectedSemester}
            </span>
          </div>

          <div className="p-1 sm:p-1.5 rounded-md bg-slate-950/80 border border-emerald-400/50 shadow-inner space-y-0.5">
            <span className="text-[7.5px] sm:text-[8.5px] font-mono uppercase tracking-wider text-emerald-300 block">
              4. Status Bangku
            </span>
            <span className="text-[9.5px] sm:text-[11px] font-bold text-white flex items-center gap-1 truncate">
              {activeSyncedStudentBanner ? (
                <>
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0 animate-ping" />
                  <span className="text-emerald-300 font-mono font-extrabold truncate">
                    Bangku #{activeSyncedStudentBanner.seatNumber}
                  </span>
                </>
              ) : (
                <>
                  <span className="w-1.5 h-1.5 rounded-full bg-sky-400 shrink-0" />
                  <span className="text-slate-300 font-mono text-[9.5px] sm:text-[11px]">
                    Bangku Kosong #{seatNumberInput}
                  </span>
                </>
              )}
            </span>
          </div>
        </div>

            {/* Keterangan Sinkronisasi */}
            <div className="p-1 sm:p-1.5 rounded-md bg-emerald-950/60 border border-emerald-400/35 text-[8.5px] sm:text-[10px] text-slate-200 leading-snug flex items-start gap-1">
              <CheckCircle2 className="w-2.5 h-2.5 text-emerald-400 shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                {activeSyncedStudentBanner ? (
                  <span>
                    Siswa <strong className="text-amber-300">{activeSyncedStudentBanner.namaSiswa}</strong> telah menyelesaikan semua soal ujian &amp; dinyatakan <strong className="text-emerald-300">LULUS UJIAN (Minimal KKM {EXAM_INFO.kkm})</strong> sehingga otomatis masuk ke denah kelas &amp; mengisi{' '}
                    <strong className="text-emerald-300">Bangku Kosong #{activeSyncedStudentBanner.seatNumber}</strong> di Design Classroom (Kelas {activeSyncedStudentBanner.kelas}, Semester {activeSyncedStudentBanner.semester}).
                  </span>
                ) : (
                  <span>
                    <strong>Syarat Wajib Denah Kelas:</strong> Siswa secara otomatis masuk ke Denah Kelas di Classroom dan mengisi bangku kosong <strong>HANYA SAAT siswa sudah menyelesaikan semua soal ujian dan dinyatakan LULUS UJIAN (Minimal Standar KKM {EXAM_INFO.kkm})</strong>. Selain itu tidak bisa.
                  </span>
                )}
              </div>
            </div>

        {/* Tombol Aksi & Kontrol Interaktif */}
        <div className="flex flex-wrap items-center justify-between gap-1.5 pt-1 border-t border-white/10 text-[10px]">
          <div className="flex items-center gap-1.5">
            <div
              className="py-0.5 px-2 rounded-md bg-emerald-950/80 border border-emerald-400/50 text-emerald-300 font-extrabold text-[9.5px] flex items-center gap-1 shadow-xs select-none"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping shrink-0" />
              <span>
                {activeSyncedStudentBanner
                  ? `Tersimpan (Bangku #${activeSyncedStudentBanner.seatNumber})`
                  : 'Auto-Save Bangku Aktif'}
              </span>
            </div>
            {activeSyncedStudentBanner && (
              <span className="text-[9px] font-mono text-slate-400 hidden sm:inline">
                Update: {activeSyncedStudentBanner.syncedAt}
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-1">
            {activeSyncedStudentBanner && (
              <button
                type="button"
                onClick={() => {
                  setSelectedKelas(getCleanKelas(activeSyncedStudentBanner.kelas));
                  setSelectedSemester(activeSyncedStudentBanner.semester);
                  handleSeatClick(activeSyncedStudentBanner.seatNumber);
                  triggerToast(
                    `✓ Menyorot Bangku #${activeSyncedStudentBanner.seatNumber} untuk ${activeSyncedStudentBanner.namaSiswa}.`
                  );
                }}
                className="py-0.5 px-2 rounded-md bg-sky-500/25 hover:bg-sky-500/40 border border-sky-400/60 text-sky-200 font-extrabold text-[9.5px] sm:text-[10.5px] flex items-center gap-1 cursor-pointer transition-all shadow-xs"
              >
                <Layers className="w-2.5 h-2.5 text-sky-300 shrink-0" />
                <span>Sorot Bangku #{activeSyncedStudentBanner.seatNumber}</span>
              </button>
            )}

            {activeSyncedStudentBanner && (
              <button
                type="button"
                onClick={() => {
                  onSelectStudentForExam({
                    namaSiswa: activeSyncedStudentBanner.namaSiswa,
                    nisNisn: activeSyncedStudentBanner.nisNisn,
                    kelas: activeSyncedStudentBanner.kelas,
                    semester: activeSyncedStudentBanner.semester,
                  });
                }}
                className="py-0.5 px-2 rounded-md bg-amber-400 hover:bg-amber-300 text-slate-950 font-extrabold text-[9.5px] sm:text-[10.5px] flex items-center gap-1 cursor-pointer transition-all shadow-xs"
              >
                <Play className="w-2.5 h-2.5 fill-current shrink-0" />
                <span>Gunakan untuk Mulai Ujian</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                const active = getStoredActiveSync();
                if (active && active.namaSiswa) {
                  setActiveSyncedStudentBanner(active);
                  setSelectedKelas(getCleanKelas(active.kelas));
                  setSelectedSemester(active.semester);
                  handleSeatClick(active.seatNumber);
                  triggerToast(`✓ Sinkronisasi diperbarui: Bangku #${active.seatNumber} (${active.namaSiswa}).`);
                } else {
                  triggerToast('✓ Status sinkronisasi aktif: Siap menempatkan bangku kosong.');
                }
              }}
              className="py-0.5 px-2 rounded-md bg-slate-900 hover:bg-slate-800 border border-white/20 text-slate-200 font-extrabold text-[9.5px] sm:text-[10.5px] flex items-center gap-1 cursor-pointer transition-all shadow-xs"
            >
              <RefreshCw className="w-2.5 h-2.5 text-emerald-400 shrink-0" />
              <span>Segarkan Status</span>
            </button>
          </div>
        </div>
      </section>

      {/* =================================================================== */}
      {/* PANEL SISTEM DETEKSI OTOMATIS PERANGKAT LOGIN SISWA & SINKRON SEMUA DATA */}
      {/* (DIPINDAHKAN DARI PORTAL UJIAN KE MENU DESIGN CLASSROOM) */}
      {/* =================================================================== */}
      <section className="rounded-lg sm:rounded-xl border border-emerald-400/45 bg-gradient-to-r from-slate-950/95 via-emerald-950/35 to-slate-950/95 p-1.5 sm:p-2.5 space-y-1 sm:space-y-1.5 shadow-md text-white">
        <div className="flex flex-wrap items-center justify-between gap-1 border-b border-white/15 pb-1">
          <div className="flex flex-wrap items-center gap-1">
            {detectedDevice.isMobileOrTablet ? (
              <Smartphone className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-emerald-400 shrink-0" />
            ) : (
              <Laptop className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-sky-400 shrink-0" />
            )}
            <span className="text-[8.5px] sm:text-[10.5px] font-extrabold uppercase tracking-wider text-emerald-300">
              SISTEM DETEKSI OTOMATIS PERANGKAT LOGIN SISWA
            </span>
            <span className="px-1 py-0.1 rounded-full bg-emerald-500/20 border border-emerald-400/50 text-[7.5px] sm:text-[8px] font-mono font-extrabold text-emerald-300">
              AUTO-SYNC DEVICE · CLASSROOM
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-1">
            {/* Tombol Sinkron Semua Data Sekarang (Dipindahkan ke Menu Classroom) */}
            <button
              type="button"
              disabled={isSyncingLoginSheet}
              onClick={() => setShowSyncDateModal(true)}
              className={`relative inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md disabled:opacity-60 text-[8.5px] sm:text-[10px] font-extrabold transition-all duration-300 cursor-pointer border ${
                isSyncingLoginSheet
                  ? 'bg-amber-400 text-slate-950 border-amber-200 ring-1 ring-amber-300/60 shadow-xs'
                  : isLoginRekapSyncAnimated
                  ? 'bg-emerald-400 hover:bg-emerald-300 text-slate-950 border-emerald-100 ring-1 ring-emerald-400/60 shadow-[0_0_12px_rgba(16,185,129,0.85)]'
                  : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 border-emerald-300/60 shadow-xs'
              }`}
            >
              {isLoginRekapSyncAnimated && !isSyncingLoginSheet ? (
                <>
                  <span className="relative flex h-1.5 w-1.5 shrink-0">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-slate-950 opacity-90" />
                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-slate-950" />
                  </span>
                  <CheckCircle2 className="w-2.5 h-2.5 text-slate-950 shrink-0 animate-bounce" />
                  <span>Tersinkron ke Google Sheets! ({loginSheetSyncTime})</span>
                  <span className="absolute -top-1.5 -right-1 px-1 py-0.1 rounded-full text-[7px] font-mono font-extrabold uppercase tracking-wider bg-amber-300 text-slate-950 border border-slate-950 shadow-xs animate-bounce">
                    LIVE ✓
                  </span>
                </>
              ) : (
                <>
                  <span className="relative flex h-1.5 w-1.5 shrink-0">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-80 bg-slate-950" />
                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-slate-950" />
                  </span>
                  <FileSpreadsheet className="w-2.5 h-2.5 text-slate-950 shrink-0" />
                  <RefreshCw
                    className={`w-2.5 h-2.5 text-slate-950 shrink-0 ${
                      isSyncingLoginSheet ? 'animate-spin' : ''
                    }`}
                  />
                  <span>
                    {isSyncingLoginSheet
                      ? 'Menyinkronkan ke Google Sheets...'
                      : 'Sinkron Semua Data Sekarang'}
                  </span>
                  {loginSheetSyncTime && !isSyncingLoginSheet && (
                    <span className="hidden sm:inline-block px-1 py-0.1 rounded bg-slate-950/20 text-slate-950 font-mono text-[8px] font-black">
                      {loginSheetSyncTime}
                    </span>
                  )}
                </>
              )}
            </button>

            <button
              type="button"
              disabled={isDetectingDevice}
              onClick={() => {
                onRefreshDeviceDetection?.();
                setCustomDeviceCategory(detectedDevice.deviceCategory);
                setCustomDeviceBrand(detectedDevice.brand);
                setCustomDeviceModel(effectiveDeviceModel || detectedDevice.modelType);
              }}
              className={`relative inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md disabled:opacity-60 border text-[8.5px] sm:text-[9.5px] font-extrabold transition-all duration-300 cursor-pointer ${
                isDeviceRedetectAnimated && !isDetectingDevice
                  ? 'bg-emerald-500 text-slate-950 border-emerald-200 ring-1 ring-emerald-400/50 shadow-xs'
                  : 'bg-sky-500/20 hover:bg-sky-500/35 border-sky-400/50 text-sky-200'
              }`}
            >
              {isDeviceRedetectAnimated && !isDetectingDevice ? (
                <>
                  <CheckCircle2 className="w-2.5 h-2.5 text-slate-950 shrink-0" />
                  <span>Selesai!</span>
                </>
              ) : (
                <>
                  <RefreshCw
                    className={`w-2.5 h-2.5 text-emerald-300 ${
                      isDetectingDevice ? 'animate-spin' : ''
                    }`}
                  />
                  <span>{isDetectingDevice ? 'Mendeteksi...' : 'Deteksi Ulang'}</span>
                </>
              )}
            </button>

            <button
              type="button"
              disabled={isSyncingLoginSheet}
              onClick={() => {
                onSyncDeviceToGoogleSheets?.();
                handleSyncAllClassroomToRekap();
              }}
              className={`relative inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md disabled:opacity-60 border text-[8.5px] sm:text-[9.5px] font-extrabold transition-all duration-300 cursor-pointer ${
                isSyncingLoginSheet && syncTriggerSource === 'device'
                  ? 'bg-amber-400 text-slate-950 border-amber-200 ring-1 ring-amber-300/60'
                  : isLoginDeviceSyncAnimated
                  ? 'bg-emerald-400 hover:bg-emerald-300 text-slate-950 border-emerald-100 ring-1 ring-emerald-400/50 shadow-xs'
                  : 'bg-emerald-500/25 hover:bg-emerald-500/40 border-emerald-400/50 text-emerald-200'
              }`}
            >
              {isLoginDeviceSyncAnimated && !(isSyncingLoginSheet && syncTriggerSource === 'device') ? (
                <>
                  <CheckCircle2 className="w-2.5 h-2.5 text-slate-950 shrink-0" />
                  <span>Tersinkron!</span>
                </>
              ) : (
                <>
                  <RefreshCw
                    className={`w-2.5 h-2.5 ${
                      isSyncingLoginSheet && syncTriggerSource === 'device'
                        ? 'animate-spin text-slate-950'
                        : 'text-emerald-300'
                    }`}
                  />
                  <span>
                    {isSyncingLoginSheet && syncTriggerSource === 'device'
                      ? 'Menyinkronkan...'
                      : 'Sinkron Data'}
                  </span>
                </>
              )}
            </button>
          </div>
        </div>

        {loginSheetSyncToast && (
          <div className="px-2 py-1 rounded-md bg-emerald-950/90 border border-emerald-400 text-emerald-200 text-[9.5px] font-bold flex items-center gap-1.5 shadow-xs">
            <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />
            <span>{loginSheetSyncToast}</span>
          </div>
        )}

        {deviceRedetectToast && (
          <div className="px-2 py-1 rounded-md bg-emerald-950/90 border border-emerald-400/60 text-emerald-200 text-[9px] font-bold flex items-center gap-1.5 shadow-xs">
            <CheckCircle2 className="w-2.5 h-2.5 text-emerald-400 shrink-0" />
            <span>{deviceRedetectToast}</span>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-1 sm:gap-1.5 text-[9.5px] sm:text-[11px]">
          <div className="p-1 sm:p-1.5 rounded-md bg-slate-950/85 border border-emerald-400/30">
            <span className="text-[7.5px] sm:text-[8px] font-mono uppercase tracking-wider text-emerald-300 block">
              1. Jenis Perangkat
            </span>
            <span className="text-[9.5px] sm:text-[11px] font-extrabold text-white mt-0.5 flex items-center gap-1">
              {detectedDevice.isMobileOrTablet ? (
                <Smartphone className="w-2.5 h-2.5 text-emerald-400 shrink-0" />
              ) : (
                <Laptop className="w-2.5 h-2.5 text-sky-400 shrink-0" />
              )}
              <span>{detectedDevice.deviceCategory}</span>
            </span>
            <span className="text-[8px] sm:text-[8.5px] text-slate-300 font-mono block mt-0.5 truncate">
              {detectedDevice.screenResolution}
            </span>
          </div>

          <div className="p-1 sm:p-1.5 rounded-md bg-slate-950/85 border border-amber-400/35">
            <span className="text-[7.5px] sm:text-[8px] font-mono uppercase tracking-wider text-amber-300 block">
              2. Merek &amp; Tipe
            </span>
            <span className="text-[9.5px] sm:text-[11px] font-extrabold text-amber-300 mt-0.5 block truncate">
              {effectiveDeviceModel || customDeviceModel || detectedDevice.modelType}
            </span>
            <span className="text-[8px] sm:text-[8.5px] text-slate-300 font-mono block mt-0.5 truncate">
              Merek: {detectedDevice.brand}
              {detectedDevice.rawModelCode ? ` · ${detectedDevice.rawModelCode}` : ''}
            </span>
          </div>

          <div className="p-1 sm:p-1.5 rounded-md bg-slate-950/85 border border-sky-400/30">
            <span className="text-[7.5px] sm:text-[8px] font-mono uppercase tracking-wider text-sky-300 block">
              3. OS &amp; Browser
            </span>
            <span className="text-[9.5px] sm:text-[11px] font-extrabold text-white mt-0.5 block truncate">
              {detectedDevice.osNameVersion} · {detectedDevice.browserName}
            </span>
            <span className="text-[8px] sm:text-[8.5px] text-slate-300 font-mono flex items-center gap-1 mt-0.5 truncate">
              <Cpu className="w-2.5 h-2.5 text-sky-400 shrink-0" />
              <span className="truncate">{detectedDevice.gpuRenderer}</span>
            </span>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 pt-0.5">
          <label
            htmlFor="classroom-student-device-model-override"
            className="text-[9px] sm:text-[10px] font-semibold text-slate-300"
          >
            Tipe/Seri Spesifik (Opsional):
          </label>
          <div className="flex flex-wrap sm:flex-nowrap items-center gap-1 w-full sm:w-auto">
            <input
              id="classroom-student-device-model-override"
              type="text"
              value={customDeviceModelOverride || customDeviceModel}
              onChange={(e) => {
                const val = e.target.value;
                setCustomDeviceModel(val);
                onChangeCustomDeviceModelOverride?.(val);
              }}
              placeholder={`Otomatis: ${detectedDevice.modelType}`}
              className="w-full sm:w-52 px-2 py-0.5 rounded-md border border-emerald-400/40 bg-slate-900/90 text-white placeholder:text-emerald-300/70 text-[10px] font-mono focus:outline-none focus:ring-1 focus:ring-emerald-400"
            />
            {onOpenQrScanner && (
              <button
                type="button"
                onClick={onOpenQrScanner}
                className={`relative overflow-hidden inline-flex items-center justify-center gap-1 px-2 py-0.5 rounded-md text-[9.5px] font-extrabold shrink-0 transition-all cursor-pointer ${
                  isQrCameraActive
                    ? 'bg-emerald-400 hover:bg-emerald-300 text-slate-950 ring-1 ring-emerald-300 qr-camera-active-glow'
                    : 'bg-amber-400 hover:bg-amber-300 text-slate-950 shadow-xs'
                }`}
              >
                <QrCode className="w-2.5 h-2.5 shrink-0" />
                <span>{isQrCameraActive ? 'Pindai QR (Aktif)' : 'Pindai QR'}</span>
              </button>
            )}
          </div>
        </div>
      </section>

      {/* GRID UTAMA: VISUAL DESIGN CLASSROOM INTERAKTIF */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-2 sm:gap-3 items-start">
        {/* PANEL UTAMA (12 KOLOM): DENAH RUANGAN KELAS INTERAKTIF (DESIGN CLASSROOM) */}
        <section className="lg:col-span-12 rounded-lg sm:rounded-xl border border-sky-500/35 bg-slate-950/95 p-1.5 sm:p-2.5 text-white shadow-md space-y-1.5 sm:space-y-2">
          {/* Bar Proteksi Share Link Guru ke Siswa: Anti-Hapus Bangku Siswa Lain, Bangku Satu Kelas & Denah Kelas */}
          <div
            className={`rounded-lg border p-1.5 sm:p-2 space-y-1 ${
              isTeacherSeatDeleteUnlocked
                ? 'border-emerald-400/50 bg-emerald-950/35'
                : 'border-amber-400/45 bg-gradient-to-r from-slate-900/95 via-sky-950/60 to-slate-900/95'
            }`}
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 border-b border-white/10 pb-1">
              <div className="flex items-center gap-1.5 min-w-0">
                <div
                  className={`w-5.5 h-5.5 sm:w-6.5 sm:h-6.5 rounded-md flex items-center justify-center shrink-0 border ${
                    isTeacherSeatDeleteUnlocked
                      ? 'bg-emerald-500/20 border-emerald-400/50 text-emerald-300'
                      : 'bg-amber-400/20 border-amber-400/50 text-amber-300'
                  }`}
                >
                  {isTeacherSeatDeleteUnlocked ? (
                    <Unlock className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                  ) : (
                    <ShieldCheck className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                  )}
                </div>
                <div className="min-w-0">
                  <span
                    className={`text-[7.5px] sm:text-[8.5px] font-mono font-extrabold uppercase tracking-wider block ${
                      isTeacherSeatDeleteUnlocked ? 'text-emerald-300' : 'text-amber-300'
                    }`}
                  >
                    {isTeacherSeatDeleteUnlocked
                      ? 'MODE GURU TERBUKA · HANYA GURU YANG BISA EDIT POSISI & HAPUS BANGKU'
                      : 'KUNCI MODE GURU AKTIF · HANYA GURU YANG BISA EDIT POSISI & HAPUS BANGKU'}
                  </span>
                  <span className="text-[9px] sm:text-[10px] font-extrabold text-white block truncate">
                    Link Siswa:{' '}
                    <code
                      onClick={() => setIsEditingShareUrl((prev) => !prev)}
                      title="Klik untuk mengubah link siswa (otomatis tersimpan ke sistem)"
                      className="text-sky-300 font-mono underline decoration-sky-400/40 hover:text-amber-300 transition-colors cursor-pointer"
                    >
                      {studentShareUrl}
                    </code>
                  </span>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={handleCopyOfficialStudentShareLink}
                  className="h-6 px-2 rounded-md bg-sky-500/20 hover:bg-sky-500/35 border border-sky-400/45 text-sky-200 text-[9.5px] font-extrabold flex items-center gap-1 transition-colors cursor-pointer whitespace-nowrap"
                  title="Bagikan atau salin link siswa yang tersimpan di sistem"
                >
                  {shareUrlCopied ? (
                    <Check className="w-2.5 h-2.5 text-emerald-300 shrink-0" />
                  ) : (
                    <Copy className="w-2.5 h-2.5 text-sky-300 shrink-0" />
                  )}
                  <span>{shareUrlCopied ? 'Link Tersalin!' : 'Share Link Siswa'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setIsEditingShareUrl((prev) => !prev)}
                  className={`h-6 px-2 rounded-md border text-[9.5px] font-extrabold flex items-center gap-1 transition-colors cursor-pointer whitespace-nowrap ${
                    isEditingShareUrl
                      ? 'bg-amber-400 text-slate-950 border-amber-300 shadow-xs'
                      : 'bg-slate-800/80 hover:bg-slate-700/80 border-slate-600 text-slate-200'
                  }`}
                  title="Ubah link siswa yang disimpan otomatis di sistem"
                >
                  <Edit3 className="w-2.5 h-2.5 shrink-0" />
                  <span>{isEditingShareUrl ? 'Tutup Edit Link' : 'Ubah Link'}</span>
                </button>

                {isIdentifiedAsTeacher ? (
                  <button
                    type="button"
                    onClick={() => {
                      setIsTeacherSeatDeleteUnlocked(false);
                      try {
                        sessionStorage.setItem(TEACHER_VERIFIED_SESSION_KEY, 'false');
                      } catch {}
                      setEditingStudentId(null);
                      setSwapSourceSeat(null);
                      triggerToast(
                        '🔒 Kunci Mode Guru Aktif: Mode Guru telah dikunci. Hanya Guru saja yang bisa mengedit posisi bangku dan menghapus bangku siswa yang dipilih.'
                      );
                    }}
                    className="h-6 px-2 rounded-md bg-rose-500/20 hover:bg-rose-500/35 border border-rose-400/50 text-rose-200 text-[9.5px] font-extrabold flex items-center gap-1 transition-colors cursor-pointer whitespace-nowrap"
                    title="Kunci Mode Guru Terbuka: Klik untuk mengunci kembali ke Mode Siswa (Hanya Guru yang bisa mengedit posisi bangku dan menghapus bangku siswa)"
                  >
                    <Unlock className="w-2.5 h-2.5 text-emerald-300 shrink-0" />
                    <span>Kunci Mode Guru (Terbuka · Klik Kunci)</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() =>
                      requireTeacherSeatUnlock(
                        'Kunci Mode Guru: Hanya Guru saja yang bisa mengedit posisi bangku dan menghapus bangku siswa yang dipilih'
                      )
                    }
                    className="h-6 px-2 rounded-md bg-amber-400 hover:bg-amber-300 text-slate-950 text-[9.5px] font-extrabold flex items-center gap-1 shadow-xs transition-colors cursor-pointer whitespace-nowrap"
                    title="Kunci Mode Guru: Hanya Guru saja yang bisa mengedit posisi bangku dan menghapus bangku siswa yang dipilih (Klik untuk buka kunci)"
                  >
                    <Lock className="w-2.5 h-2.5 shrink-0 text-slate-950" />
                    <span>Kunci Mode Guru</span>
                  </button>
                )}
              </div>
            </div>

            {/* Panel Pengaturan & Perubahan Otomatis Link Siswa */}
            {isEditingShareUrl && (
              <div className="p-2 rounded-md bg-slate-950/95 border border-sky-400/50 space-y-1.5 text-[10px] shadow-md">
                <div className="flex items-center justify-between gap-1 flex-wrap">
                  <span className="font-extrabold text-amber-300 flex items-center gap-1 text-[9px] sm:text-[9.5px]">
                    <Globe className="w-2.5 h-2.5 text-sky-400 shrink-0" />
                    Perbarui Otomatis Link Siswa (Tersimpan Langsung ke Sistem)
                  </span>
                  {shareUrlSavedToast ? (
                    <span className="text-emerald-300 font-extrabold text-[8.5px] flex items-center gap-1 bg-emerald-950/70 border border-emerald-400/40 px-1.5 py-0.5 rounded">
                      <CheckCircle2 className="w-2.5 h-2.5 text-emerald-400 shrink-0" />
                      {shareUrlSavedToast}
                    </span>
                  ) : (
                    <span className="text-emerald-400 font-mono text-[7.5px] sm:text-[8px] font-bold">
                      ● Auto-Save Aktif: Setiap link diubah, langsung tersimpan di sistem &amp; tombol share
                    </span>
                  )}
                </div>

                <div className="flex flex-col sm:flex-row gap-1.5 items-stretch sm:items-center">
                  <div className="relative flex-1">
                    <input
                      type="url"
                      value={shareUrlInput}
                      onChange={(e) => {
                        const val = e.target.value;
                        setShareUrlInput(val);
                        handleAutoUpdateShareUrl(val);
                      }}
                      onBlur={() => {
                        if (shareUrlInput.trim()) {
                          handleAutoUpdateShareUrl(shareUrlInput.trim());
                        }
                      }}
                      placeholder="Tempel atau ketik link baru yang akan dibagikan ke siswa..."
                      className="w-full px-2 py-1 rounded border border-white/20 bg-slate-900 text-white font-mono text-[10px] focus:outline-none focus:ring-1 focus:ring-sky-400 placeholder:text-slate-500"
                    />
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={handleUseCurrentOriginUrl}
                      className="px-2 py-1 rounded bg-sky-500/20 hover:bg-sky-500/35 border border-sky-400/40 text-sky-200 text-[9px] font-bold flex items-center gap-1 transition-colors cursor-pointer whitespace-nowrap"
                      title="Gunakan link domain/URL web yang sedang aktif saat ini"
                    >
                      <RefreshCw className="w-2 h-2 text-sky-300 shrink-0" />
                      <span>URL Web Saat Ini</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        handleAutoUpdateShareUrl(shareUrlInput);
                        setIsEditingShareUrl(false);
                      }}
                      className="px-2.5 py-1 rounded bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-[9px] font-extrabold flex items-center gap-1 transition-colors cursor-pointer whitespace-nowrap"
                    >
                      <Check className="w-2.5 h-2.5 shrink-0" />
                      <span>Selesai &amp; Simpan</span>
                    </button>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center justify-between text-[8px] text-slate-300 gap-1 pt-0.5 border-t border-white/10">
                  <span>
                    Link aktif di sistem:{' '}
                    <code className="text-amber-300 font-mono font-bold">{studentShareUrl}</code>
                  </span>
                  <span className="text-slate-400">
                    Tombol <strong className="text-white">Share Link Siswa</strong> otomatis menyesuaikan link ini untuk dibagikan ke siswa.
                  </span>
                </div>
              </div>
            )}

            <p className="text-[8.5px] sm:text-[9.5px] text-slate-300 leading-snug">
              Saat Guru membagikan link{' '}
              <strong className="text-sky-300 font-mono">{studentShareUrl}</strong>{' '}
              kepada Siswa/Murid:{' '}
              <strong className="text-amber-300">
                (1) Kunci Mode Guru Aktif: Hanya Guru saja yang bisa mengedit posisi bangku dan menghapus bangku siswa yang dipilih; (2) Murid tidak bisa menghapus bangku siswa lain, bangku satu kelas, maupun denah kelas lain/sama; (3) Murid tidak bisa menambah kelas lainnya maupun kelas yang sama; dan (4) Setiap siswa hanya berhak mengisi data HANYA 1 KALI
              </strong>
              .
            </p>
            {isTeacherSeatDeleteUnlocked && studentSubmittedSeatLock && (
              <div className="pt-1 flex items-center justify-between gap-1.5 text-[9.5px] text-emerald-200 border-t border-white/10">
                <span>
                  Perangkat ini tercatat pernah mengisi 1x atas nama{' '}
                  <strong>{studentSubmittedSeatLock.namaSiswa}</strong> (Kelas{' '}
                  {studentSubmittedSeatLock.kelas} · Meja #{studentSubmittedSeatLock.seatNumber}).
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setStudentSubmittedSeatLock(null);
                    try {
                      localStorage.removeItem(STUDENT_ONCE_LOCK_KEY);
                    } catch {
                      // ignore
                    }
                    triggerToast(
                      '✓ Kuota input 1x pada perangkat ini berhasil direset oleh Guru.'
                    );
                  }}
                  className="px-1.5 py-0.5 rounded-md bg-emerald-500/25 hover:bg-emerald-500/40 border border-emerald-400/50 text-emerald-200 font-bold cursor-pointer shrink-0"
                >
                  Reset Kuota 1x Perangkat Ini
                </button>
              </div>
            )}
          </div>

          {/* Toolbar Pengaturan Desain Kelas */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 border-b border-white/15 pb-1.5">
            <div>
              <div className="flex flex-wrap items-center gap-1.5">
                <Monitor className="w-3.5 h-3.5 text-sky-400" />
                <h2 className="text-xs sm:text-sm font-extrabold text-white">
                  Denah Kelas {selectedKelas} · Semester {selectedSemester}
                </h2>
                <span className="inline-flex items-center gap-1 px-1.5 py-0.1 rounded-full bg-emerald-500/20 border border-emerald-400/50 text-[8px] sm:text-[8.5px] font-mono font-extrabold text-emerald-300 shadow-xs">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                  <span>SIMPAN BANGKU OTOMATIS: AKTIF</span>
                </span>
              </div>
              <p className="text-[9px] sm:text-[10px] text-slate-400 mt-0.5">
                {isTeacherSeatDeleteUnlocked
                  ? 'Mode Guru Aktif: Klik bangku untuk menginput, mengedit, menukar, atau menghapus bangku siswa'
                  : 'Klik Bangku Kosong untuk input data Anda · Bangku siswa lain & denah kelas terkunci dari penghapusan'}
              </p>
            </div>

            {/* Pengaturan Mode Layout, Kolom & Kapasitas Kursi */}
            <div className="flex flex-wrap items-center gap-1">
              <select
                value={currentRoomConfig.layoutMode}
                onChange={(e) =>
                  updateCurrentRoomConfig({
                    layoutMode: e.target.value as ClassroomLayoutMode,
                  })
                }
                className="px-1.5 py-0.5 rounded-md border border-sky-400/40 bg-slate-900 text-sky-200 text-[9.5px] sm:text-[10.5px] font-bold"
              >
                <option value="CBT_LAB">Mode Lab Komputer CBT</option>
                <option value="PAIRED_DESK">Mode Meja Berpasangan (2 Siswa)</option>
                <option value="EXAM_GRID">Mode Ujian Mandiri Berjarak</option>
              </select>

              <select
                value={currentRoomConfig.columns}
                onChange={(e) =>
                  updateCurrentRoomConfig({ columns: Number(e.target.value) || 4 })
                }
                className="px-1.5 py-0.5 rounded-md border border-white/20 bg-slate-900 text-white text-[9.5px] sm:text-[10.5px] font-bold"
              >
                <option value={3}>3 Kolom</option>
                <option value={4}>4 Kolom</option>
                <option value={5}>5 Kolom</option>
                <option value={6}>6 Kolom</option>
              </select>

              <select
                value={currentRoomConfig.capacity}
                onChange={(e) =>
                  updateCurrentRoomConfig({ capacity: Number(e.target.value) || 32 })
                }
                className="px-1.5 py-0.5 rounded-md border border-white/20 bg-slate-900 text-white text-[9.5px] sm:text-[10.5px] font-bold"
              >
                <option value={20}>20 Bangku</option>
                <option value={24}>24 Bangku</option>
                <option value={28}>28 Bangku</option>
                <option value={30}>30 Bangku</option>
                <option value={32}>32 Bangku</option>
                <option value={36}>36 Bangku</option>
                <option value={40}>40 Bangku</option>
              </select>
            </div>
          </div>

          {/* AREA DEPAN KELAS: PAPAN TULIS INTERAKTIF, MEJA GURU & PINTU MASUK */}
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-1.5 items-stretch">
            {/* Meja Guru / Pengawas ANBK — HANYA BISA DIAKSES OLEH GURU & TERHUBUNG KE OBROLAN SETIAP RUANG KELAS */}
            <div
              onClick={() => {
                if (!isTeacherSeatDeleteUnlocked) {
                  requireTeacherSeatUnlock(
                    'Mengakses Meja Guru & Konsol Obrolan Meja Guru ke Setiap Ruang Kelas (Meja Guru Hanya Bisa Diakses Oleh Guru)'
                  );
                  return;
                }
                setIsTeacherDeskChatMode(true);
                document
                  .getElementById('classroom-live-chat-panel')
                  ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
              }}
              className={`sm:col-span-4 rounded-lg border p-1.5 sm:p-2 flex flex-col justify-between cursor-pointer transition-all ${
                isTeacherSeatDeleteUnlocked
                  ? 'border-emerald-400 bg-gradient-to-br from-emerald-950/60 via-amber-950/30 to-slate-900 ring-1 ring-emerald-400/50 shadow-sm'
                  : 'border-amber-400/50 bg-gradient-to-br from-amber-500/15 to-slate-900 hover:border-amber-300'
              }`}
            >
              <div className="flex items-center justify-between gap-1 text-[8px] sm:text-[8.5px] font-mono uppercase tracking-wider text-amber-300">
                <span className="flex items-center gap-0.5 font-extrabold">
                  {isTeacherSeatDeleteUnlocked ? (
                    <Unlock className="w-2.5 h-2.5 text-emerald-300 shrink-0" />
                  ) : (
                    <Lock className="w-2.5 h-2.5 text-amber-300 shrink-0" />
                  )}
                  <span>Meja Guru &amp; Proktor</span>
                </span>
                <span
                  className={`px-1 py-0.1 rounded text-[7.5px] font-extrabold ${
                    isTeacherSeatDeleteUnlocked
                      ? 'bg-emerald-500/25 text-emerald-200 border border-emerald-400/40'
                      : 'bg-rose-500/25 text-rose-200 border border-rose-400/40'
                  }`}
                >
                  {isTeacherSeatDeleteUnlocked ? '🔓 Akses Guru Aktif' : '🔒 Khusus Guru'}
                </span>
              </div>
              <div className="my-0.5 space-y-0.5">
                <div className="text-[10px] sm:text-[11px] font-extrabold text-white truncate">
                  {EXAM_INFO.guruMapelUpper}
                </div>
                <div className="text-[8.5px] text-emerald-300 font-semibold flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                  <span>Terhubung Obrolan ke 11 Kelas</span>
                </div>
              </div>
              <div className="pt-0.5 border-t border-white/10 flex items-center justify-between text-[7.5px] sm:text-[8px] font-mono text-amber-200">
                <span>Khusus Guru</span>
                <span className="underline font-bold">
                  {isTeacherSeatDeleteUnlocked ? 'Buka Chat Meja Guru ➔' : 'Verifikasi Guru ➔'}
                </span>
              </div>
            </div>

            {/* Papan Tulis / Smartboard Proyektor ANBK */}
            <div className="sm:col-span-6 rounded-lg border border-sky-400/50 bg-gradient-to-r from-sky-950 via-slate-900 to-sky-950 p-1.5 sm:p-2 flex flex-col items-center justify-center text-center shadow-inner">
              <span className="text-[8px] sm:text-[8.5px] font-mono uppercase tracking-wider text-sky-300 font-bold">
                LAYAR PROYEKTOR / PAPAN TULIS DEPAN KELAS {selectedKelas}
              </span>
              <span className="text-[10px] sm:text-[11px] font-extrabold text-white mt-0.5">
                {EXAM_INFO.namaSekolah} · ANBK Informatika
              </span>
              <span className="text-[8px] sm:text-[8.5px] text-emerald-300 font-mono mt-0.5">
                Mode: {currentRoomConfig.layoutMode === 'CBT_LAB' ? 'Lab Komputer CBT' : currentRoomConfig.layoutMode === 'PAIRED_DESK' ? 'Kelas Reguler Berpasangan' : 'Ujian Mandiri Berjarak'}
              </span>
            </div>

            {/* Pintu Masuk Kelas */}
            <div className="sm:col-span-2 rounded-lg border border-emerald-400/40 bg-emerald-950/30 p-1.5 sm:p-2 flex flex-col items-center justify-center text-center">
              <DoorOpen className="w-3.5 h-3.5 text-emerald-300 mb-0.5" />
              <span className="text-[8px] sm:text-[8.5px] font-mono font-bold text-emerald-200 uppercase">
                Pintu Kelas
              </span>
            </div>
          </div>

          {/* Info Mode Tukar Bangku */}
          {swapSourceSeat !== null && (
            <div className="p-1.5 sm:p-2 rounded-lg bg-amber-500/20 border border-amber-400 text-amber-200 text-[10.5px] font-bold flex items-center justify-between">
              <span>
                Mode Pindah Bangku Aktif: Pilih bangku tujuan untuk bertukar posisi dengan{' '}
                <strong>Bangku #{swapSourceSeat}</strong>
              </span>
              <button
                type="button"
                onClick={() => setSwapSourceSeat(null)}
                className="px-1.5 py-0.5 rounded-md bg-slate-950 text-white text-[10px] cursor-pointer"
              >
                Batal Pindah
              </button>
            </div>
          )}

          {/* DENAH GRID BANGKU SISWA */}
          <div
            className="grid gap-1.5 pt-0.5"
            style={{
              gridTemplateColumns: `repeat(${currentRoomConfig.columns}, minmax(0, 1fr))`,
            }}
          >
            {seatNumbers.map((seatNum) => {
              const student = studentsInSelectedKelas.find((s) => s.seatNumber === seatNum);
              const seatPhotoInfo = student ? resolveSeatStudentPhoto(student) : null;
              const isSelectedForForm =
                seatNumberInput === seatNum &&
                (!editingStudentId || student?.id === editingStudentId);
              const isSwapSource = swapSourceSeat === seatNum;
              const isPairedRightGap =
                currentRoomConfig.layoutMode === 'PAIRED_DESK' && seatNum % 2 === 0;
              const isSyncedActiveSeat =
                activeSyncedStudentBanner &&
                activeSyncedStudentBanner.kelas === selectedKelas &&
                activeSyncedStudentBanner.seatNumber === seatNum;

              return (
                <div
                  key={seatNum}
                  onClick={() => handleSeatClick(seatNum)}
                  className={`group relative rounded-lg border p-1.5 transition-all cursor-pointer select-none flex flex-col justify-between min-h-[86px] sm:min-h-[100px] ${
                    isPairedRightGap ? ' sm:mr-1' : ''
                  } ${
                    isSwapSource
                      ? 'border-amber-400 bg-amber-500/25 ring-1 ring-amber-300'
                      : isSyncedActiveSeat
                      ? 'border-emerald-400 bg-emerald-500/20 ring-2 ring-emerald-400/80 shadow-[0_0_12px_rgba(16,185,129,0.5)]'
                      : isSelectedForForm
                      ? 'border-sky-400 bg-sky-500/20 ring-1 ring-sky-400 shadow-sm'
                      : student
                      ? student.nilaiAkhir >= EXAM_INFO.kkm
                        ? 'border-emerald-500/45 bg-gradient-to-br from-slate-900 via-slate-900 to-emerald-950/55 hover:border-emerald-400'
                        : 'border-rose-500/45 bg-gradient-to-br from-slate-900 via-slate-900 to-rose-950/55 hover:border-rose-400'
                      : 'border-dashed border-slate-700 bg-slate-900/50 hover:border-sky-400/60 hover:bg-slate-900'
                  }`}
                >
                  {/* Header Kartu Bangku */}
                  <div className="flex items-center justify-between gap-0.5">
                    <div className="flex items-center gap-0.5">
                      <span
                        className={`px-1 py-0.1 rounded text-[8px] sm:text-[9px] font-mono font-extrabold ${
                          isSyncedActiveSeat
                            ? 'bg-emerald-400 text-slate-950 font-black'
                            : student
                            ? 'bg-amber-400 text-slate-950'
                            : 'bg-slate-800 text-slate-400'
                        }`}
                      >
                        Meja #{seatNum}
                      </span>
                      {student && seatPhotoInfo?.hasCustomCameraPhoto && (
                        <span
                          className="px-1 py-0.1 rounded bg-emerald-500/30 border border-emerald-400/70 text-emerald-200 font-mono text-[7px] font-extrabold flex items-center gap-0.5"
                        >
                          <Camera className="w-2 h-2 text-amber-300 shrink-0" />
                          <span>FOTO ✓</span>
                        </span>
                      )}
                      {isSyncedActiveSeat && !seatPhotoInfo?.hasCustomCameraPhoto && (
                        <span className="px-1 py-0.1 rounded bg-emerald-400/25 border border-emerald-400/60 text-emerald-200 font-mono text-[7.5px] font-black uppercase tracking-wider">
                          SINKRON ✓
                        </span>
                      )}
                    </div>

                    {student ? (
                      <div className="flex items-center gap-0.5">
                        <span
                          className={`px-1 py-0.1 rounded text-[8px] sm:text-[8.5px] font-mono font-extrabold ${
                            student.nilaiAkhir >= EXAM_INFO.kkm
                              ? 'bg-emerald-500/25 text-emerald-300 border border-emerald-400/30'
                              : 'bg-rose-500/25 text-rose-300 border border-rose-400/30'
                          }`}
                        >
                          {student.nilaiAkhir}%
                        </span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectStudentForExam({
                              namaSiswa: student.namaSiswa,
                              nisNisn: student.nisNisn,
                              kelas: student.kelas,
                              semester: student.semester,
                            });
                          }}
                          className="p-0.5 rounded bg-emerald-500/25 hover:bg-emerald-400 hover:text-slate-950 text-emerald-300 transition-colors shadow-xs"
                        >
                          <Play className="w-2 h-2 fill-current" />
                        </button>
                        {isTeacherSeatDeleteUnlocked ? (
                          <button
                            type="button"
                            title="Mode Guru Aktif: Klik untuk pindah / tukar posisi bangku siswa ini"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSwapSourceSeat(seatNum);
                            }}
                            className="p-0.5 rounded bg-slate-800/90 hover:bg-amber-400 hover:text-slate-950 text-slate-300 transition-colors"
                          >
                            <Move className="w-2 h-2" />
                          </button>
                        ) : (
                          <button
                            type="button"
                            title="Kunci Mode Guru: Hanya Guru saja yang bisa mengedit posisi bangku dan menghapus bangku siswa yang dipilih (Klik untuk verifikasi Guru)"
                            onClick={(e) => {
                              e.stopPropagation();
                              requireTeacherSeatUnlock(
                                `Mengedit posisi Bangku #${seatNum} (${student.namaSiswa}) — Hanya Guru saja yang bisa mengedit posisi bangku dan menghapus bangku siswa yang dipilih`
                              );
                            }}
                            className="p-0.5 rounded bg-slate-900/90 hover:bg-amber-400/25 border border-amber-400/40 text-amber-300 transition-colors"
                          >
                            <Lock className="w-2 h-2" />
                          </button>
                        )}
                      </div>
                    ) : (
                      <span className="text-[8px] font-mono text-slate-500 group-hover:text-sky-300">
                        + Isi Manual
                      </span>
                    )}
                  </div>

                  {/* Isi Tengah Bangku: Foto Wajah Siswa + Identitas Lengkap */}
                  {student && seatPhotoInfo ? (
                    <div className="my-1 flex items-center gap-1.5">
                      {/* Bingkai Foto Wajah Siswa di Bangku (Klik untuk Zoom / Lihat Wajah Siswa) */}
                      <div
                        onClick={(e) => {
                          e.stopPropagation();
                          setZoomedSeatPhotoStudent({
                            seatNumber: student.seatNumber,
                            namaSiswa: student.namaSiswa,
                            nisNisn: student.nisNisn,
                            kelas: student.kelas,
                            semester: student.semester,
                            photoUrl: seatPhotoInfo.url,
                            attendanceStatus: student.attendanceStatus,
                            nilaiAkhir: student.nilaiAkhir,
                            deviceInfo: student.deviceInfo,
                          });
                        }}
                        className={`relative w-8 h-9.5 sm:w-9 sm:h-11 rounded-md overflow-hidden shrink-0 border shadow-sm transition-transform group-hover:scale-105 ${
                          seatPhotoInfo.hasCustomCameraPhoto
                            ? 'border-emerald-400 ring-1 ring-emerald-400/50'
                            : 'border-amber-400/70'
                        } bg-slate-950`}
                      >
                        <img
                          src={seatPhotoInfo.url}
                          alt={`Foto ${student.namaSiswa}`}
                          className="w-full h-full object-cover"
                        />
                        <span
                          className={`absolute bottom-0 inset-x-0 text-[6px] font-mono font-black text-center leading-tight py-0.1 ${
                            seatPhotoInfo.hasCustomCameraPhoto
                              ? 'bg-emerald-500/95 text-slate-950'
                              : 'bg-slate-900/90 text-amber-300'
                          }`}
                        >
                          {seatPhotoInfo.hasCustomCameraPhoto ? 'LIVE FOTO' : getStudentInitials(student.namaSiswa)}
                        </span>
                      </div>

                      <div className="min-w-0 flex-1 space-y-0.5">
                        <div
                          className="text-[9.5px] sm:text-[10.5px] font-extrabold text-white line-clamp-1 leading-tight"
                        >
                          {student.namaSiswa}
                        </div>
                        <div className="text-[8px] font-mono text-amber-300/95 truncate">
                          NISN: {student.nisNisn}
                        </div>
                        <div className="flex items-center gap-0.5 text-[8px] text-sky-300 font-semibold truncate">
                          {renderDeviceIcon(student.deviceCategory)}
                          <span className="truncate">
                            {student.deviceModel || student.deviceCategory}
                          </span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="my-1 flex flex-col items-center justify-center text-center text-slate-500 group-hover:text-sky-300">
                      <UserPlus className="w-3 h-3 mb-0.5 opacity-70" />
                      <span className="text-[8.5px] font-semibold">Bangku Kosong</span>
                    </div>
                  )}

                  {/* Footer Bangku — SISWA TIDAK DAPAT MENGHAPUS BANGKU SISWA LAINNYA (KHUSUS MODE GURU UNTUK SEMUA BANGKU) */}
                  {student ? (
                    <div className="flex items-center justify-between pt-0.5 border-t border-white/10 text-[7.5px] sm:text-[8px] font-mono">
                      <span className="text-emerald-300 truncate">{student.attendanceStatus}</span>
                      <div className="flex items-center gap-0.5">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectStudentForExam({
                              namaSiswa: student.namaSiswa,
                              nisNisn: student.nisNisn,
                              kelas: student.kelas,
                              semester: student.semester,
                            });
                          }}
                          className="px-1 py-0.1 rounded bg-amber-400/20 hover:bg-amber-400 hover:text-slate-950 text-amber-300 font-bold cursor-pointer text-[7.5px] flex items-center gap-0.5 transition-colors"
                        >
                          <span>Ujian</span>
                          <ArrowRight className="w-2 h-2" />
                        </button>
                        <button
                          type="button"
                          title={
                            isIdentifiedAsTeacher
                              ? `Mode Guru Aktif: Klik untuk menghapus Bangku #${student.seatNumber} (${student.namaSiswa})`
                              : `Kunci Mode Guru: Hanya Guru saja yang bisa mengedit posisi bangku dan menghapus bangku siswa yang dipilih (Klik untuk verifikasi Guru)`
                          }
                          onClick={(e) => {
                            e.stopPropagation();
                            if (!isIdentifiedAsTeacher) {
                              requireTeacherSeatUnlock(
                                `Menghapus Bangku #${student.seatNumber} (${student.namaSiswa} · Kelas ${student.kelas}) — Hanya Guru saja yang bisa mengedit posisi bangku dan menghapus bangku siswa yang dipilih`
                              );
                              return;
                            }
                            handleDeleteSeatStudent(student);
                          }}
                          className={`px-1 py-0.1 rounded font-bold cursor-pointer text-[7px] flex items-center gap-0.5 ml-0.5 transition-colors border ${
                            isIdentifiedAsTeacher
                              ? 'bg-rose-500/25 hover:bg-rose-500 hover:text-white border-rose-400/50 text-rose-300'
                              : 'bg-slate-900/95 hover:bg-amber-400/25 border-amber-400/45 text-amber-300'
                          }`}
                        >
                          {isIdentifiedAsTeacher ? (
                            <>
                              <Trash2 className="w-2 h-2 shrink-0" />
                              <span>Hapus</span>
                            </>
                          ) : (
                            <>
                              <Lock className="w-2 h-2 shrink-0 text-amber-300" />
                              <span>Kunci Guru</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center pt-0.5 border-t border-white/5 text-[7.5px] font-mono text-slate-500 group-hover:text-sky-300">
                      <span>Klik untuk menempati bangku ini</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Legenda Denah Kelas */}
          <div className="pt-1.5 border-t border-white/10 flex flex-wrap items-center justify-between gap-1 text-[9px] sm:text-[10px] text-slate-300">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1">
                <span className="w-2 h-2 rounded bg-emerald-500/40 border border-emerald-400 inline-block" />
                Terisi (Lulus ≥ {EXAM_INFO.kkm}%)
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="w-2 h-2 rounded bg-rose-500/40 border border-rose-400 inline-block" />
                Terisi (Remedial &lt; {EXAM_INFO.kkm}%)
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="w-2 h-2 rounded bg-sky-500/40 border border-sky-400 inline-block" />
                Bangku Sedang Dipilih
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="w-2 h-2 rounded border border-dashed border-slate-600 inline-block" />
                Bangku Kosong (Klik untuk Input)
              </span>
            </div>

            <button
              type="button"
              onClick={() => {
                handleSwitchChatClassroom(selectedKelas);
                document
                  .getElementById('classroom-live-chat-panel')
                  ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
              }}
              className="px-2 py-0.5 rounded-md bg-gradient-to-r from-sky-500/25 to-emerald-500/25 hover:from-sky-500/40 hover:to-emerald-500/40 border border-sky-400/50 text-sky-200 font-extrabold text-[9.5px] flex items-center gap-1 cursor-pointer transition-all"
            >
              <MessageSquare className="w-2.5 h-2.5 text-amber-300 shrink-0" />
              <span>
                Buka Ruang Diskusi Aman Kelas {selectedKelas} (
                {messageCountByKelas[selectedKelas] || 0} Pesan)
              </span>
            </button>
          </div>
        </section>

        {/* PANEL OBROLAN / LIVE CHAT REAL-TIME TERPISAH PER RUANG KELAS (FIRESTORE ISOLATED ROOMS) */}
        <section
          id="classroom-live-chat-panel"
          className="lg:col-span-12 rounded-lg sm:rounded-xl border border-sky-500/40 bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 p-1.5 sm:p-2.5 text-white shadow-md space-y-1.5 sm:space-y-2 overflow-hidden"
        >
          {/* Baris 1: Header Ruang Diskusi Kelas Real-Time Terpisah Berdasarkan Ruang Kelas */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-1.5 border-b border-white/15 pb-1.5">
            <div className="space-y-0.5">
              <div className="flex flex-wrap items-center gap-1">
                <div className="inline-flex items-center gap-1 text-[7.5px] sm:text-[8.5px] font-mono font-extrabold uppercase tracking-wider text-emerald-300">
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      firestoreLiveConnected ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'
                    }`}
                  />
                  <span>
                    CHAT REAL-TIME FIRESTORE TERPISAH PER RUANG KELAS (VIII-1..6 &amp; VII-1..5)
                  </span>
                </div>

                <span className="px-1 py-0.1 rounded-full bg-emerald-500/20 border border-emerald-400/50 text-emerald-200 text-[7.5px] sm:text-[8.5px] font-mono font-extrabold flex items-center gap-0.5">
                  <ShieldCheck className="w-2.5 h-2.5 text-emerald-300 shrink-0" />
                  <span>
                    Isolasi: {getFirestoreChatDocIdForKelas(currentIsolatedRoom)}
                  </span>
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-1">
                <MessageSquare className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-amber-300 shrink-0" />
                <AnimatePresence mode="wait" initial={false}>
                  <motion.h2
                    key={`header-room-title-${currentIsolatedRoom}`}
                    initial={{ opacity: 0, y: roomTransitionDirection * 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: roomTransitionDirection * -8 }}
                    transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                    className="text-[11px] sm:text-sm font-extrabold text-white flex flex-wrap items-center gap-1"
                  >
                    <span>
                      Ruang Diskusi Aman Khusus Siswa Kelas {currentIsolatedRoom}
                    </span>
                    <span className="px-1 py-0.1 rounded bg-amber-400 text-slate-950 text-[8px] sm:text-[9.5px] font-mono font-extrabold">
                      Terisolasi
                    </span>
                  </motion.h2>
                </AnimatePresence>
              </div>

              <p className="text-[8.5px] sm:text-[10px] text-slate-300 max-w-3xl leading-snug">
                Pesan obrolan dipisahkan ketat per ruang kelas (<strong className="text-amber-300">VIII-1 s/d VIII-6</strong> &amp;{' '}
                <strong className="text-amber-300">VII-1 s/d VII-5</strong>) agar{' '}
                <strong className="text-emerald-300">
                  siswa Kelas {currentIsolatedRoom} berdiskusi aman
                </strong>.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-1 shrink-0">
              {studentSubmittedSeatLock && !isIdentifiedAsTeacher && (
                <button
                  type="button"
                  onClick={() => setIsStrictClassLockEnabled((prev) => !prev)}
                  className={`h-6 px-1.5 rounded-md text-[9px] sm:text-[10px] font-extrabold flex items-center gap-1 transition-all cursor-pointer ${
                    isStrictClassLockEnabled
                      ? 'bg-emerald-500/25 border border-emerald-400 text-emerald-200'
                      : 'bg-slate-900 border border-white/15 text-slate-300'
                  }`}
                >
                  <Lock className="w-2.5 h-2.5 text-emerald-300 shrink-0" />
                  <span>
                    {isStrictClassLockEnabled
                      ? `Terkunci Kelas ${getCleanKelas(studentSubmittedSeatLock.kelas)}`
                      : 'Navigasi Terbuka'}
                  </span>
                </button>
              )}

              {chatSyncSuccessBadge && (
                <div className="px-1.5 py-0.5 rounded-md bg-emerald-500/25 border border-emerald-400 text-emerald-200 text-[9px] font-extrabold flex items-center gap-1 animate-bounce">
                  <CheckCircle2 className="w-2.5 h-2.5 text-emerald-300 shrink-0" />
                  <span>✓ Tersinkron!</span>
                </div>
              )}

              <button
                type="button"
                onClick={handleManualSyncClassroomChat}
                disabled={isSyncingChat}
                className={`h-6 px-2 rounded-md text-[9px] sm:text-[10px] font-extrabold flex items-center gap-1 transition-all cursor-pointer ${
                  chatSyncSuccessBadge
                    ? 'bg-emerald-500 text-slate-950 ring-1 ring-emerald-300 shadow-xs'
                    : 'bg-sky-500/25 hover:bg-sky-500/35 border border-sky-400/50 text-sky-200'
                }`}
              >
                <RefreshCw
                  className={`w-2.5 h-2.5 shrink-0 ${isSyncingChat ? 'animate-spin' : ''}`}
                />
                <span>
                  {isSyncingChat
                    ? `Menyinkronkan...`
                    : chatSyncSuccessBadge
                    ? 'Selesai!'
                    : `Sinkronkan Firestore`}
                </span>
              </button>
            </div>
          </div>

          {/* Baris 2: Pemilih Ruang Kelas Terpisah dengan Indikator Pegas Mulus (Spring Pill) & Tombol Navigasi Ruang Sebelumnya/Berikutnya */}
          <div className="space-y-1">
            <div className="flex flex-wrap items-center justify-between gap-1">
              <div className="flex flex-wrap items-center gap-1">
                <span className="text-[9.5px] sm:text-[11px] font-extrabold text-sky-300 flex items-center gap-1">
                  <DoorOpen className="w-2.5 h-2.5 text-amber-300 shrink-0" />
                  <span>
                    Pilih Ruang Kelas Diskusi:
                  </span>
                </span>

                {/* Tombol Navigasi Cepat Antar Ruang Kelas Sebelumnya & Berikutnya */}
                <div className="inline-flex items-center gap-0.5 bg-slate-900/90 border border-white/15 rounded-md p-0.5">
                  <button
                    type="button"
                    onClick={() => handleStepAdjacentChatRoom(-1)}
                    className="px-1 py-0.5 rounded hover:bg-slate-800 text-[8.5px] sm:text-[9.5px] font-extrabold text-sky-200 flex items-center gap-0.5 transition-colors cursor-pointer"
                  >
                    <ChevronLeft className="w-2.5 h-2.5 text-amber-300" />
                    <span>Seb.</span>
                  </button>
                  <span className="px-1 py-0.1 rounded bg-amber-400/20 border border-amber-400/40 text-amber-300 text-[8px] sm:text-[8.5px] font-mono font-extrabold tabular-nums">
                    {ALL_KELAS_LIST.indexOf(currentIsolatedRoom) + 1}/{ALL_KELAS_LIST.length} ·{' '}
                    {currentIsolatedRoom}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleStepAdjacentChatRoom(1)}
                    className="px-1 py-0.5 rounded hover:bg-slate-800 text-[8.5px] sm:text-[9.5px] font-extrabold text-sky-200 flex items-center gap-0.5 transition-colors cursor-pointer"
                  >
                    <span>Ber.</span>
                    <ChevronRight className="w-2.5 h-2.5 text-amber-300" />
                  </button>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-1">
                <div className="relative">
                  <Search className="w-2.5 h-2.5 text-slate-400 absolute left-1.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={chatSearchText}
                    onChange={(e) => setChatSearchText(e.target.value)}
                    placeholder={`Cari di ${currentIsolatedRoom}...`}
                    className="pl-5 pr-1.5 py-0.5 rounded-md border border-white/15 bg-slate-900 text-[8.5px] sm:text-[9.5px] text-white placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-sky-400"
                  />
                </div>
                <AnimatePresence mode="wait" initial={false}>
                  <motion.span
                    key={`student-count-pill-${currentIsolatedRoom}`}
                    initial={{ opacity: 0, scale: 0.92 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.92 }}
                    transition={{ duration: 0.18 }}
                    className="px-1.5 py-0.5 rounded-md bg-emerald-500/15 border border-emerald-400/40 text-emerald-200 text-[8.5px] sm:text-[9.5px] font-mono font-bold tabular-nums"
                  >
                    👥 {sameClassChatStudents.length} Siswa ({currentIsolatedRoom})
                  </motion.span>
                </AnimatePresence>
              </div>
            </div>

            {/* Grid 11 Tombol Ruang Kelas dengan Indikator Aktif Animasi Pegas (layoutId) */}
            <div className="grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-11 gap-1">
              {ALL_KELAS_LIST.map((kls) => {
                const isRoomActive = currentIsolatedRoom === kls;
                const msgCount = messageCountByKelas[kls] || 0;
                const isLockedOtherRoom =
                  Boolean(studentSubmittedSeatLock) &&
                  isStrictClassLockEnabled &&
                  !isIdentifiedAsTeacher &&
                  getCleanKelas(studentSubmittedSeatLock!.kelas) !== kls;

                return (
                  <motion.button
                    key={`chat-tab-${kls}`}
                    type="button"
                    whileHover={{ scale: isLockedOtherRoom ? 1 : 1.02 }}
                    whileTap={{ scale: isLockedOtherRoom ? 0.99 : 0.97 }}
                    onClick={() => handleSwitchChatClassroom(kls)}
                    className={`relative h-5.5 sm:h-6.5 px-1 sm:px-1.5 rounded-md text-[9px] sm:text-[10.5px] font-extrabold transition-colors cursor-pointer flex items-center justify-center gap-0.5 overflow-hidden ${
                      isRoomActive
                        ? 'text-slate-950 shadow ring-1 ring-amber-300'
                        : isLockedOtherRoom
                        ? 'bg-slate-950/60 text-slate-500 border border-white/5 opacity-65'
                        : 'bg-slate-900/90 text-slate-300 border border-white/15 hover:bg-slate-800 hover:text-white'
                    }`}
                  >
                    {isRoomActive && (
                      <motion.div
                        layoutId="activeClassroomChatRoomPill"
                        transition={{
                          type: 'spring',
                          stiffness: 420,
                          damping: 32,
                        }}
                        className="absolute inset-0 bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-400 rounded-md"
                      />
                    )}
                    <span className="relative z-10 flex items-center gap-0.5">
                      {isRoomActive ? (
                        <ShieldCheck className="w-2.5 h-2.5 text-slate-950 shrink-0" />
                      ) : isLockedOtherRoom ? (
                        <Lock className="w-2 h-2 text-slate-500 shrink-0" />
                      ) : null}
                      <span>{kls}</span>
                      <span
                        className={`px-0.5 py-0.1 rounded text-[7.5px] sm:text-[8.5px] font-mono tabular-nums ${
                          isRoomActive
                            ? 'bg-slate-950 text-amber-300 font-bold'
                            : msgCount > 0
                            ? 'bg-sky-500/25 text-sky-300'
                            : 'bg-slate-800 text-slate-400'
                        }`}
                      >
                        {msgCount}
                      </span>
                    </span>
                  </motion.button>
                );
              })}
            </div>

            {/* Banner Portal Animasi Saat Berpindah dari Ruang Kelas Satu ke Ruang Kelas Lainnya */}
            <AnimatePresence>
              {roomTransitionPortal && (
                <motion.div
                  key={`portal-${roomTransitionPortal.fromRoom}-${roomTransitionPortal.toRoom}`}
                  initial={{ opacity: 0, y: -8, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -6, scale: 0.98 }}
                  transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                  className="rounded-lg border border-amber-400/50 bg-gradient-to-r from-amber-500/20 via-sky-500/20 to-emerald-500/20 px-2 py-1 flex flex-wrap items-center justify-between gap-1 text-[10px] shadow-sm"
                >
                  <div className="flex flex-wrap items-center gap-1">
                    <span className="px-1 py-0.1 rounded bg-slate-900/90 border border-white/15 font-mono font-bold text-slate-300 text-[9px]">
                      Ruang Kelas {roomTransitionPortal.fromRoom}
                    </span>
                    <motion.span
                      initial={{ x: roomTransitionPortal.direction * -6 }}
                      animate={{ x: 0 }}
                      transition={{ type: 'spring', stiffness: 360, damping: 20 }}
                      className="inline-flex items-center text-amber-300 font-extrabold"
                    >
                      {roomTransitionPortal.direction === 1 ? (
                        <ArrowRight className="w-3 h-3" />
                      ) : (
                        <ArrowLeft className="w-3 h-3" />
                      )}
                    </motion.span>
                    <span className="px-1.5 py-0.1 rounded bg-amber-400 text-slate-950 font-mono font-extrabold shadow text-[9px]">
                      Ruang Kelas {roomTransitionPortal.toRoom}
                    </span>
                    <span className="text-sky-200 font-semibold text-[9.5px]">
                      Berpindah mulus ke ruang diskusi terisolasi Kelas {roomTransitionPortal.toRoom}
                    </span>
                  </div>
                  <span className="text-[8.5px] font-mono text-emerald-300 flex items-center gap-1">
                    <ShieldCheck className="w-2.5 h-2.5 text-emerald-400" />
                    <span>
                      {FIRESTORE_CHAT_COLLECTION}/{roomTransitionPortal.docId}
                    </span>
                  </span>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Baris 3: Grid Area Daftar Pesan Diskusi Satu Kelas (Kiri 7 Kolom) & Form Kirim Pesan Satu Kelas (Kanan 5 Kolom) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-1.5 sm:gap-2.5 items-start">
            {/* DAFTAR PESAN LIVE CHAT KHUSUS RUANG KELAS AKTIF & HUB KONEKSI MEJA GURU (CSS selector 1) */}
            <div className="lg:col-span-7 rounded-lg border border-amber-400/35 bg-gradient-to-b from-slate-950 via-slate-950/95 to-indigo-950/80 p-1.5 sm:p-2.5 space-y-1.5 shadow-md overflow-hidden">
              <div className="flex flex-wrap items-center justify-between gap-1 border-b border-white/10 pb-1 text-[9.5px] sm:text-[11px]">
                <div className="font-extrabold text-white flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                  <AnimatePresence mode="wait" initial={false}>
                    <motion.span
                      key={`room-feed-title-${currentIsolatedRoom}`}
                      initial={{ opacity: 0, x: roomTransitionDirection * 14 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: roomTransitionDirection * -14 }}
                      transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                    >
                      Ruang Diskusi Kelas {currentIsolatedRoom} &amp; Koneksi Meja Guru
                    </motion.span>
                  </AnimatePresence>
                </div>
                <div className="flex items-center gap-1">
                  <span className="px-1 py-0.1 rounded bg-slate-900 border border-emerald-400/30 text-[7.5px] sm:text-[8.5px] font-mono text-emerald-300">
                    {getFirestoreChatDocIdForKelas(currentIsolatedRoom)}
                  </span>
                  <span className="text-[8.5px] sm:text-[9.5px] font-mono text-sky-300 tabular-nums">
                    {displayedChatMessages.length} Pesan
                  </span>
                </div>
              </div>

              {/* BANNER KONEKSI OBROLAN MEJA GURU KE SETIAP RUANG KELAS (HANYA BISA DIAKSES OLEH GURU) */}
              <div
                className={`rounded-lg border p-1.5 sm:p-2 space-y-1 transition-all ${
                  isIdentifiedAsTeacher
                    ? 'border-emerald-400/60 bg-gradient-to-r from-emerald-950/70 via-amber-950/35 to-slate-900'
                    : 'border-amber-400/50 bg-gradient-to-r from-amber-950/45 via-slate-900 to-slate-950'
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-1">
                  <div className="flex items-center gap-1.5">
                    <div
                      className={`w-5.5 h-5.5 sm:w-6 sm:h-6 rounded-md flex items-center justify-center font-extrabold text-[9px] sm:text-[10px] border shrink-0 ${
                        isIdentifiedAsTeacher
                          ? 'bg-emerald-400 text-slate-950 border-emerald-200'
                          : 'bg-amber-400 text-slate-950 border-amber-200'
                      }`}
                    >
                      MG
                    </div>
                    <div>
                      <div className="flex flex-wrap items-center gap-1">
                        <span className="text-[9.5px] sm:text-[11px] font-extrabold text-white">
                          Meja Guru &amp; Proktor ({EXAM_INFO.guruMapel})
                        </span>
                        <span className="px-1 py-0.1 rounded bg-emerald-500/25 border border-emerald-400/50 text-emerald-200 text-[7.5px] sm:text-[8.5px] font-mono font-bold">
                          ● Kelas {currentIsolatedRoom}
                        </span>
                      </div>
                      <p className="text-[8px] sm:text-[9px] text-slate-300">
                        {isIdentifiedAsTeacher ? (
                          <span className="text-emerald-300 font-semibold">
                            ✓ {teacherIdentificationBadgeLabel}
                          </span>
                        ) : (
                          <>
                            Pesan siaran &amp; balas guru{' '}
                            <strong className="text-rose-300">
                              khusus akun Guru.
                            </strong>
                          </>
                        )}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-1">
                    {!isIdentifiedAsTeacher ? (
                      <>
                        <button
                          type="button"
                          onClick={() => {
                            setChatRecipientStudentKey('TEACHER_DESK');
                            triggerToast(
                              `💬 Tujuan obrolan diarahkan ke Meja Guru di Kelas ${currentIsolatedRoom}.`
                            );
                          }}
                          className="px-1.5 py-0.5 rounded-md bg-sky-500/25 hover:bg-sky-500/40 border border-sky-400/50 text-sky-200 text-[8.5px] sm:text-[9.5px] font-bold flex items-center gap-0.5 cursor-pointer"
                        >
                          <MessageSquare className="w-2.5 h-2.5 text-amber-300" />
                          <span>Hubungi Guru</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRequestAccessTeacherDesk('BROADCAST')}
                          className="px-1.5 py-0.5 rounded-md bg-amber-400 hover:bg-amber-300 text-slate-950 text-[8.5px] sm:text-[9.5px] font-extrabold flex items-center gap-0.5 cursor-pointer shadow-xs"
                        >
                          <Lock className="w-2.5 h-2.5 shrink-0" />
                          <span>Verifikasi Guru</span>
                        </button>
                      </>
                    ) : (
                      <div className="flex flex-wrap items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleRequestAccessTeacherDesk('BROADCAST')}
                          className={`px-1.5 py-0.5 rounded-md text-[8.5px] sm:text-[9.5px] font-bold flex items-center gap-0.5 cursor-pointer transition-all ${
                            isTeacherDeskChatMode && teacherChatActionType === 'BROADCAST'
                              ? 'bg-amber-400 text-slate-950 ring-1 ring-amber-200 font-extrabold'
                              : 'bg-amber-500/25 border border-amber-400/50 text-amber-200 hover:bg-amber-500/35'
                          }`}
                        >
                          <Megaphone className="w-2.5 h-2.5" />
                          <span>Siaran</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRequestAccessTeacherDesk('CLASS_REPLY')}
                          className={`px-1.5 py-0.5 rounded-md text-[8.5px] sm:text-[9.5px] font-bold flex items-center gap-0.5 cursor-pointer transition-all ${
                            isTeacherDeskChatMode && teacherChatActionType === 'CLASS_REPLY'
                              ? 'bg-emerald-400 text-slate-950 ring-1 ring-emerald-200 font-extrabold'
                              : 'bg-emerald-500/25 border border-emerald-400/50 text-emerald-200 hover:bg-emerald-500/35'
                          }`}
                        >
                          <Reply className="w-2.5 h-2.5" />
                          <span>Balas {currentIsolatedRoom}</span>
                        </button>
                        {!isTeacherAuthenticated && (
                          <button
                            type="button"
                            onClick={handleLockBackTeacherIdentity}
                            className="px-1 py-0.5 rounded-md bg-rose-500/20 hover:bg-rose-500/35 border border-rose-400/40 text-rose-200 text-[8.5px] font-bold cursor-pointer"
                          >
                            Kunci
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Indikator Jaringan Koneksi Meja Guru ke 11 Ruang Kelas dengan Transisi Mulus */}
                <div className="pt-1 border-t border-white/10 flex flex-wrap items-center gap-0.5 sm:gap-1">
                  <span className="text-[7.5px] sm:text-[8.5px] font-mono text-amber-300 font-bold mr-0.5">
                    Jaringan:
                  </span>
                  {ALL_KELAS_LIST.map((kls) => {
                    const isCurrent = currentIsolatedRoom === kls;
                    return (
                      <button
                        key={`mejaguru-link-${kls}`}
                        type="button"
                        onClick={() => handleSwitchChatClassroom(kls)}
                        className={`px-1 py-0.1 rounded text-[7.5px] sm:text-[8.5px] font-mono font-bold transition-all cursor-pointer ${
                          isCurrent
                            ? 'bg-amber-400 text-slate-950 font-extrabold ring-1 ring-amber-200'
                            : 'bg-slate-900/90 text-emerald-300 border border-emerald-400/30 hover:bg-slate-800'
                        }`}
                      >
                        ● {kls}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* KONTAINER ANIMASI TRANSISI ANTAR RUANG KELAS OBROLAN (AnimatePresence Directional Slide & Fade) */}
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={`chat-room-stage-${currentIsolatedRoom}`}
                  initial={{
                    opacity: 0,
                    x: roomTransitionDirection * 36,
                    scale: 0.985,
                  }}
                  animate={{
                    opacity: 1,
                    x: 0,
                    scale: 1,
                  }}
                  exit={{
                    opacity: 0,
                    x: roomTransitionDirection * -36,
                    scale: 0.985,
                  }}
                  transition={{
                    duration: 0.25,
                    ease: [0.16, 1, 0.3, 1],
                  }}
                  className="max-h-[240px] sm:max-h-[340px] overflow-y-auto pr-1 space-y-1 sm:space-y-1.5"
                >
                  {displayedChatMessages.length === 0 ? (
                    <div className="py-5 sm:py-6 text-center text-slate-400 text-[10px] sm:text-xs space-y-1">
                      <MessageSquare className="w-5 h-5 text-slate-600 mx-auto" />
                      <p>
                        Belum ada pesan diskusi di{' '}
                        <strong className="text-amber-300">
                          Ruang Kelas {currentIsolatedRoom}
                        </strong>
                        .
                      </p>
                      <p className="text-[8.5px] sm:text-[9.5px] text-slate-500">
                        Kirim pesan diskusi pertama kepada teman sekelas atau Meja Guru di Ruang Kelas {currentIsolatedRoom}!
                      </p>
                    </div>
                  ) : (
                    displayedChatMessages.map((msg, msgIdx) => {
                      const identity = resolveMessageFullIdentity(msg);
                      const isGuru = identity.isGuru;
                      const initials = identity.namaLengkap
                        .split(' ')
                        .filter(Boolean)
                        .slice(0, 2)
                        .map((w) => w[0]?.toUpperCase() || '')
                        .join('');

                      return (
                        <motion.div
                          key={msg.id}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{
                            duration: 0.2,
                            delay: Math.min(msgIdx * 0.03, 0.18),
                            ease: [0.16, 1, 0.3, 1],
                          }}
                          className={`rounded-lg border p-1.5 sm:p-2 space-y-1 transition-all ${
                            isGuru
                              ? 'border-amber-400/60 bg-gradient-to-r from-amber-950/55 via-slate-900 to-slate-900 shadow-sm'
                              : 'border-sky-400/35 bg-slate-900/90'
                          }`}
                        >
                          {/* Header Kartu Pesan (div:nth-of-type(1)): IDENTITAS LENGKAP SISWA / MEJA GURU & INFO NGOBROL SAMA SIAPA */}
                          <div className="rounded-md bg-slate-950/85 border border-white/10 p-1 sm:p-1.5 space-y-0.5">
                            {/* Baris Atas Identitas Pengirim */}
                            <div className="flex items-start justify-between gap-1">
                              <div className="flex items-start gap-1 min-w-0">
                                {/* Avatar / Foto Identitas Siswa / Meja Guru */}
                                <div className="relative shrink-0">
                                  {identity.photoUrl ? (
                                    <img
                                      src={identity.photoUrl}
                                      alt={identity.namaLengkap}
                                      referrerPolicy="no-referrer"
                                      className="w-6 h-6 sm:w-7 sm:h-7 rounded-md object-cover border border-emerald-400"
                                    />
                                  ) : (
                                    <div
                                      className={`w-6 h-6 sm:w-7 sm:h-7 rounded-md flex items-center justify-center font-extrabold text-[9px] border ${
                                        isGuru
                                          ? 'bg-amber-400 text-slate-950 border-amber-200'
                                          : 'bg-gradient-to-br from-sky-500 to-indigo-600 text-white border-sky-300/60'
                                      }`}
                                    >
                                      {isGuru ? 'MG' : initials || 'SW'}
                                    </div>
                                  )}
                                  <span
                                    className="w-1.5 h-1.5 rounded-full bg-emerald-400 ring-1 ring-slate-950 absolute -bottom-0.5 -right-0.5"
                                  />
                                </div>

                                {/* Nama Lengkap, NIS/NISN, Kelas, Nomor Meja & Perangkat */}
                                <div className="min-w-0 space-y-0.5">
                                  <div className="flex flex-wrap items-center gap-0.5 sm:gap-1">
                                    <span
                                      className={`px-1 py-0.1 rounded text-[7px] sm:text-[7.5px] font-mono font-extrabold uppercase ${
                                        isGuru
                                          ? 'bg-amber-400 text-slate-950'
                                          : 'bg-emerald-500/20 border border-emerald-400/40 text-emerald-300'
                                      }`}
                                    >
                                      {isGuru
                                        ? msg.isBroadcast
                                          ? `📢 SIARAN`
                                          : `BALASAN GURU`
                                        : `KELAS ${identity.kelas}`}
                                    </span>
                                    {msg.broadcastCategory && (
                                      <span className="px-1 py-0.1 rounded bg-rose-500/25 border border-rose-400/50 text-rose-200 text-[7px] sm:text-[7.5px] font-mono font-bold">
                                        {msg.broadcastCategory}
                                      </span>
                                    )}
                                    <span className="text-[10px] sm:text-[11px] font-extrabold text-white truncate">
                                      {identity.namaLengkap}
                                    </span>
                                  </div>

                                  <div className="flex flex-wrap items-center gap-0.5 sm:gap-1 text-[7.5px] sm:text-[8.5px] font-mono">
                                    <span className="px-1 py-0.1 rounded bg-amber-400 text-slate-950 font-extrabold">
                                      {isGuru
                                        ? `GURU`
                                        : `Kls ${identity.kelas}${
                                            identity.seatNumber ? ` · M#${identity.seatNumber}` : ''
                                          }`}
                                    </span>
                                    <span className="px-1 py-0.1 rounded bg-sky-500/20 border border-sky-400/35 text-sky-200 font-bold">
                                      {identity.nisNisn}
                                    </span>
                                    <span className="px-1 py-0.1 rounded bg-slate-900 border border-white/10 text-emerald-300 truncate max-w-[125px]">
                                      💻 {identity.deviceInfo}
                                    </span>
                                  </div>
                                </div>
                              </div>

                              <span className="text-[7.5px] sm:text-[8.5px] font-mono text-slate-400 shrink-0">
                                {msg.timestamp}
                              </span>
                            </div>

                            {/* Baris Bawah di dalam div:nth-of-type(1): KETERANGAN JELAS "NGOBROL SAMA SIAPA" */}
                            <div className="pt-0.5 border-t border-white/10 flex flex-wrap items-center justify-between gap-1 text-[8px] sm:text-[9px]">
                              <div className="flex flex-wrap items-center gap-0.5 sm:gap-1">
                                <span className="font-mono font-extrabold uppercase text-amber-300 flex items-center gap-0.5">
                                  <ArrowRightLeft className="w-2 h-2 text-amber-300 shrink-0" />
                                  <span>
                                    {isGuru ? 'Untuk:' : 'Kepada:'}
                                  </span>
                                </span>

                                <span className="px-1 py-0.1 rounded text-[8px] sm:text-[9px] font-bold flex items-center gap-0.5 bg-sky-500/20 border border-sky-400/40 text-sky-200">
                                  <Users className="w-2 h-2 shrink-0" />
                                  <span>{identity.partnerLabel}</span>
                                </span>

                                {identity.partnerNis && (
                                  <span className="px-1 py-0.1 rounded bg-slate-900 border border-white/15 font-mono text-sky-300">
                                    {identity.partnerNis}
                                  </span>
                                )}

                                <span className="px-1 py-0.1 rounded bg-emerald-500/20 border border-emerald-400/40 font-mono text-emerald-200">
                                  🔒 {currentIsolatedRoom}
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Kutipan Balasan (Reply Quote) */}
                          {msg.replyTo && (
                            <div className="rounded-md bg-slate-950/80 border-l-2 border-amber-400 px-1.5 py-0.5 text-[8.5px] sm:text-[9.5px] text-slate-300">
                              <div className="font-bold text-amber-300">
                                Membalas {msg.replyTo.senderName}:
                              </div>
                              <div className="truncate text-slate-400">"{msg.replyTo.text}"</div>
                            </div>
                          )}

                          {/* Isi Teks Pesan */}
                          <p className="text-[10px] sm:text-[11px] text-slate-100 leading-snug whitespace-pre-wrap break-words">
                            {msg.text}
                          </p>

                          {/* Footer Pesan: Reaksi Cepat, Tombol Balas Siswa, Tombol Balas Sebagai Guru (Hanya Jika Teridentifikasi Guru) */}
                          <div className="pt-0.5 border-t border-white/10 flex flex-wrap items-center justify-between gap-1">
                            <div className="flex flex-wrap items-center gap-0.5">
                              {(['👍', '🔥', '👏', '🎉', '✅'] as const).map((emoji) => {
                                const count = msg.reactions?.[emoji] || 0;
                                return (
                                  <button
                                    key={`${msg.id}-${emoji}`}
                                    type="button"
                                    onClick={() => handleAddChatReaction(msg.id, emoji)}
                                    className={`px-1 py-0.5 rounded text-[9px] font-mono flex items-center gap-0.5 transition-all cursor-pointer ${
                                      count > 0
                                        ? 'bg-sky-500/25 border border-sky-400/40 text-white font-bold'
                                        : 'bg-slate-800/80 hover:bg-slate-800 text-slate-400'
                                    }`}
                                  >
                                    <span>{emoji}</span>
                                    {count > 0 && <span>{count}</span>}
                                  </button>
                                );
                              })}
                            </div>

                            <div className="flex flex-wrap items-center gap-1">
                              <button
                                type="button"
                                onClick={() => {
                                  setReplyingToMessage(msg);
                                  if (isGuru) {
                                    setChatRecipientStudentKey('TEACHER_DESK');
                                  }
                                }}
                                className="px-1.5 py-0.5 rounded-md bg-sky-500/20 hover:bg-sky-500/35 text-sky-200 text-[9px] sm:text-[9.5px] font-bold flex items-center gap-0.5 cursor-pointer"
                              >
                                <Reply className="w-2.5 h-2.5" />
                                <span>
                                  Balas {isGuru ? 'Meja Guru' : identity.namaLengkap}
                                </span>
                              </button>

                              {isIdentifiedAsTeacher && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (inlineTeacherReplyMsgId === msg.id) {
                                      setInlineTeacherReplyMsgId(null);
                                      setInlineTeacherReplyText('');
                                    } else {
                                      setInlineTeacherReplyMsgId(msg.id);
                                      setInlineTeacherReplyText('');
                                    }
                                  }}
                                  className="px-1.5 py-0.5 rounded-md bg-amber-400 hover:bg-amber-300 text-slate-950 text-[9px] sm:text-[9.5px] font-extrabold flex items-center gap-0.5 cursor-pointer shadow-xs"
                                >
                                  <Reply className="w-2.5 h-2.5" />
                                  <span>Balas Guru</span>
                                </button>
                              )}

                              {isIdentifiedAsTeacher && (
                                <button
                                  type="button"
                                  onClick={() => handleDeleteChatMessage(msg.id)}
                                  className="p-0.5 rounded-md bg-rose-500/20 hover:bg-rose-500/35 text-rose-300 cursor-pointer"
                                >
                                  <Trash2 className="w-2.5 h-2.5" />
                                </button>
                              )}
                            </div>
                          </div>

                          {/* Kotak Balasan Cepat Inline Khusus Guru (Hanya tampil jika pengguna teridentifikasi sebagai Guru) */}
                          {isIdentifiedAsTeacher && inlineTeacherReplyMsgId === msg.id && (
                            <div className="mt-1 pt-1.5 border-t border-amber-400/30 rounded-md bg-slate-950/90 p-1.5 space-y-1">
                              <div className="flex items-center justify-between text-[9.5px]">
                                <span className="font-extrabold text-amber-300 flex items-center gap-1">
                                  <ShieldCheck className="w-2.5 h-2.5 text-emerald-400" />
                                  <span>
                                    Balas Guru ({EXAM_INFO.guruMapel}) ke {identity.namaLengkap}
                                  </span>
                                </span>
                                <button
                                  type="button"
                                  onClick={() => setInlineTeacherReplyMsgId(null)}
                                  className="text-slate-400 hover:text-white cursor-pointer"
                                >
                                  <X className="w-2.5 h-2.5" />
                                </button>
                              </div>
                              <div className="flex gap-1">
                                <input
                                  type="text"
                                  value={inlineTeacherReplyText}
                                  onChange={(e) => setInlineTeacherReplyText(e.target.value)}
                                  placeholder={`Ketik balasan Guru untuk ${identity.namaLengkap}...`}
                                  className="flex-1 px-2 py-0.5 rounded-md border border-amber-400/40 bg-slate-900 text-[10.5px] text-white focus:outline-none focus:ring-1 focus:ring-amber-400"
                                />
                                <button
                                  type="button"
                                  onClick={() => handleSendInlineTeacherReply(msg)}
                                  className="px-2 py-0.5 rounded-md bg-amber-400 hover:bg-amber-300 text-slate-950 text-[10px] font-extrabold flex items-center gap-1 cursor-pointer shrink-0"
                                >
                                  <Send className="w-2.5 h-2.5" />
                                  <span>Kirim</span>
                                </button>
                              </div>
                            </div>
                          )}
                        </motion.div>
                      );
                    })
                  )}
                  <div ref={chatMessagesEndRef} />
                </motion.div>
              </AnimatePresence>
            </div>

            {/* FORMULIR KIRIM PESAN DISKUSI KELAS & KONSOL OBROLAN MEJA GURU (CSS selector 2) */}
            <form
              onSubmit={handleSendClassroomChatMessage}
              className={`lg:col-span-5 rounded-lg sm:rounded-xl border p-1.5 sm:p-2.5 space-y-1.5 sm:space-y-2 shadow-md transition-all overflow-hidden ${
                isIdentifiedAsTeacher && isTeacherDeskChatMode
                  ? 'border-amber-400/60 bg-gradient-to-b from-amber-950/40 via-slate-950 to-slate-950'
                  : 'border-sky-400/40 bg-slate-950/95'
              }`}
            >
              <div className="flex items-center justify-between border-b border-white/10 pb-1">
                <AnimatePresence mode="wait" initial={false}>
                  <motion.div
                    key={`form-header-${currentIsolatedRoom}-${isTeacherDeskChatMode}-${teacherChatActionType}`}
                    initial={{ opacity: 0, x: roomTransitionDirection * 14 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: roomTransitionDirection * -14 }}
                    transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                  >
                    <h3 className="text-[10px] sm:text-[11px] font-extrabold text-white flex items-center gap-1">
                      <Send className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-emerald-300" />
                      <span>
                        {isIdentifiedAsTeacher && isTeacherDeskChatMode
                          ? teacherChatActionType === 'BROADCAST'
                            ? 'Konsol Siaran Guru (Broadcast)'
                            : `Konsol Balas Guru · Kelas ${currentIsolatedRoom}`
                          : `Kirim Diskusi Kelas ${currentIsolatedRoom} & Guru`}
                      </span>
                    </h3>
                    <p className="text-[8px] sm:text-[9px] text-slate-400">
                      {isIdentifiedAsTeacher && isTeacherDeskChatMode
                        ? teacherChatActionType === 'BROADCAST'
                          ? 'Kirim siaran resmi ke seluruh atau beberapa ruang kelas'
                          : `Membalas pesan siswa resmi di Kelas ${currentIsolatedRoom}`
                        : `Diskusi aman siswa Kelas ${currentIsolatedRoom} & Meja Guru`}
                    </p>
                  </motion.div>
                </AnimatePresence>
                {chatSentSuccessBadge && (
                  <span className="px-1.5 py-0.5 rounded-md bg-emerald-500/25 border border-emerald-400 text-emerald-200 text-[8.5px] font-extrabold flex items-center gap-1 animate-pulse">
                    <Check className="w-2.5 h-2.5" />
                    <span>Terkirim!</span>
                  </span>
                )}
              </div>

              {/* SAKELAR MODE PENGIRIM: SISWA KELAS vs FITUR GURU (SIARAN & BALAS KELAS) */}
              <div className="rounded-lg border border-amber-400/40 bg-slate-900/95 p-1.5 space-y-1">
                <div className="flex items-center justify-between text-[8px] sm:text-[9px] font-mono">
                  <span className="font-extrabold uppercase text-amber-300">
                    Peran Pengirim:
                  </span>
                  <span
                    className={`font-bold flex items-center gap-1 ${
                      isIdentifiedAsTeacher ? 'text-emerald-300' : 'text-rose-300'
                    }`}
                  >
                    {isIdentifiedAsTeacher ? (
                      <>
                        <ShieldCheck className="w-2.5 h-2.5" />
                        <span>Guru Teridentifikasi</span>
                      </>
                    ) : (
                      <>
                        <Lock className="w-2.5 h-2.5" />
                        <span>Khusus Guru</span>
                      </>
                    )}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-1">
                  <button
                    type="button"
                    onClick={() => setIsTeacherDeskChatMode(false)}
                    className={`py-1 px-1.5 rounded-md text-[9px] sm:text-[10px] font-extrabold flex items-center justify-center gap-1 transition-all cursor-pointer ${
                      !isTeacherDeskChatMode
                        ? 'bg-sky-500 text-slate-950 shadow ring-1 ring-sky-300'
                        : 'bg-slate-950 text-slate-300 border border-white/15 hover:bg-slate-800'
                    }`}
                  >
                    <Users className="w-2.5 h-2.5 shrink-0" />
                    <span>Siswa Kelas {currentIsolatedRoom}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      if (!isIdentifiedAsTeacher) {
                        requireTeacherSeatUnlock(
                          'Mengirim Pesan Siaran atau Membalas Pesan di Ruang Chat Masing-Masing Kelas (Hanya Jika Pengguna Teridentifikasi Sebagai Guru)'
                        );
                        return;
                      }
                      setIsTeacherDeskChatMode(true);
                    }}
                    className={`py-1 px-1.5 rounded-md text-[9px] sm:text-[10px] font-extrabold flex items-center justify-center gap-1 transition-all cursor-pointer ${
                      isIdentifiedAsTeacher && isTeacherDeskChatMode
                        ? 'bg-amber-400 text-slate-950 shadow ring-1 ring-amber-200'
                        : 'bg-slate-950 text-amber-300 border border-amber-400/40 hover:bg-amber-500/20'
                    }`}
                  >
                    {isIdentifiedAsTeacher ? (
                      <Unlock className="w-2.5 h-2.5 shrink-0" />
                    ) : (
                      <Lock className="w-2.5 h-2.5 shrink-0" />
                    )}
                    <span>Mode Guru</span>
                  </button>
                </div>
              </div>

              {isIdentifiedAsTeacher && isTeacherDeskChatMode ? (
                /* PANEL KONSOL RESMI GURU: 1) PESAN SIARAN (BROADCAST) ATAU 2) BALAS PESAN DI MASING-MASING KELAS */
                <div className="rounded-lg border border-amber-400/50 bg-gradient-to-br from-amber-950/45 via-slate-900 to-slate-950 p-2 sm:p-2.5 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[9.5px] font-extrabold uppercase tracking-wider text-amber-300 flex items-center gap-1">
                      <ShieldCheck className="w-3 h-3 text-emerald-300" />
                      <span>Konsol Guru Mapel</span>
                    </span>
                    <span className="px-1.5 py-0.2 rounded bg-emerald-500/20 border border-emerald-400/40 text-[8.5px] font-mono font-bold text-emerald-300">
                      ✓ Teridentifikasi
                    </span>
                  </div>

                  {/* Pilihan Jenis Tindakan Obrolan Guru: Pesan Siaran vs Balas di Ruang Kelas */}
                  <div className="grid grid-cols-2 gap-1">
                    <button
                      type="button"
                      onClick={() => {
                        setTeacherChatActionType('BROADCAST');
                        if (ALL_KELAS_LIST.includes(teacherDeskTargetScope)) {
                          setTeacherDeskTargetScope('ALL_11_ROOMS');
                        }
                      }}
                      className={`py-1 px-1.5 rounded-md text-[9.5px] font-extrabold flex items-center justify-center gap-1 transition-all cursor-pointer ${
                        teacherChatActionType === 'BROADCAST'
                          ? 'bg-amber-400 text-slate-950 shadow ring-1 ring-amber-200'
                          : 'bg-slate-950 text-amber-200 border border-amber-400/30 hover:bg-slate-800'
                      }`}
                    >
                      <Megaphone className="w-2.5 h-2.5 shrink-0" />
                      <span>1. Siaran (Broadcast)</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setTeacherChatActionType('CLASS_REPLY');
                        setTeacherDeskTargetScope(currentIsolatedRoom);
                      }}
                      className={`py-1 px-1.5 rounded-md text-[9.5px] font-extrabold flex items-center justify-center gap-1 transition-all cursor-pointer ${
                        teacherChatActionType === 'CLASS_REPLY'
                          ? 'bg-emerald-400 text-slate-950 shadow ring-1 ring-emerald-200'
                          : 'bg-slate-950 text-emerald-200 border border-emerald-400/30 hover:bg-slate-800'
                      }`}
                    >
                      <Reply className="w-2.5 h-2.5 shrink-0" />
                      <span>2. Balas ({currentIsolatedRoom})</span>
                    </button>
                  </div>

                  {teacherChatActionType === 'BROADCAST' ? (
                    <div className="space-y-1.5">
                      <div>
                        <label className="block text-[9px] font-bold text-amber-300 mb-0.5">
                          Kategori Pesan Siaran:
                        </label>
                        <select
                          value={teacherBroadcastCategory}
                          onChange={(e) => setTeacherBroadcastCategory(e.target.value)}
                          className="w-full px-2 py-1 rounded-md border border-amber-400/40 bg-slate-950 text-amber-200 text-[10px] sm:text-[11px] font-bold focus:outline-none focus:ring-1 focus:ring-amber-400"
                        >
                          <option value="📢 Pengumuman Resmi Guru">📢 Pengumuman Resmi Guru</option>
                          <option value="⏱️ Peringatan Waktu Ujian">⏱️ Peringatan Waktu Ujian</option>
                          <option value="🔑 Informasi Kode Token">🔑 Informasi Kode Token</option>
                          <option value="⚠️ Teguran Pengawas & Anti-Curang">
                            ⚠️ Teguran Pengawas &amp; Anti-Curang
                          </option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-[9px] font-bold text-amber-300 mb-0.5">
                          Jangkauan Ruang Kelas:
                        </label>
                        <select
                          value={teacherDeskTargetScope}
                          onChange={(e) => setTeacherDeskTargetScope(e.target.value)}
                          className="w-full px-2 py-1 rounded-md border border-amber-400/50 bg-slate-950 text-amber-200 text-[10px] sm:text-[11px] font-extrabold focus:outline-none focus:ring-1 focus:ring-amber-400"
                        >
                          <option value="ALL_11_ROOMS">
                            🌐 Semua 11 Ruang Kelas (VII-1..VII-5 &amp; VIII-1..VIII-6)
                          </option>
                          <option value="JENJANG_VIII">
                            🏫 Seluruh Ruang Kelas VIII (6 Kelas)
                          </option>
                          <option value="JENJANG_VII">
                            🏫 Seluruh Ruang Kelas VII (5 Kelas)
                          </option>
                          <option value="CUSTOM_ROOMS">
                            ☑️ Pilih Ruang Kelas Tertentu (Centang)
                          </option>
                        </select>
                      </div>

                      {teacherDeskTargetScope === 'CUSTOM_ROOMS' && (
                        <div className="p-1.5 rounded-md bg-slate-950 border border-white/15 space-y-1">
                          <div className="flex items-center justify-between text-[8.5px] text-slate-300">
                            <span>Pilih ruang kelas penerima:</span>
                            <button
                              type="button"
                              onClick={() => setSelectedBroadcastRooms([...ALL_KELAS_LIST])}
                              className="text-amber-300 hover:underline font-bold cursor-pointer"
                            >
                              Pilih Semua
                            </button>
                          </div>
                          <div className="grid grid-cols-4 gap-1">
                            {ALL_KELAS_LIST.map((kls) => {
                              const checked = selectedBroadcastRooms.includes(kls);
                              return (
                                <button
                                  key={`bcast-pick-${kls}`}
                                  type="button"
                                  onClick={() => {
                                    setSelectedBroadcastRooms((prev) =>
                                      prev.includes(kls)
                                        ? prev.filter((item) => item !== kls)
                                        : [...prev, kls]
                                    );
                                  }}
                                  className={`py-0.5 px-1 rounded text-[8.5px] font-mono font-bold border transition-all cursor-pointer ${
                                    checked
                                      ? 'bg-amber-400 text-slate-950 border-amber-200'
                                      : 'bg-slate-900 text-slate-400 border-white/10'
                                  }`}
                                >
                                  {checked ? '✓ ' : ''}
                                  {kls}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      <div>
                        <label className="block text-[9px] font-bold text-emerald-300 mb-0.5">
                          Ruang Kelas yang Dibalas:
                        </label>
                        <select
                          value={currentIsolatedRoom}
                          onChange={(e) => {
                            handleSwitchChatClassroom(e.target.value);
                            setTeacherDeskTargetScope(e.target.value);
                          }}
                          className="w-full px-2 py-1 rounded-md border border-emerald-400/50 bg-slate-950 text-emerald-200 text-[10px] sm:text-[11px] font-extrabold focus:outline-none focus:ring-1 focus:ring-emerald-400"
                        >
                          {ALL_KELAS_LIST.map((kls) => (
                            <option key={`reply-room-${kls}`} value={kls}>
                              🏫 Kelas {kls} ({messageCountByKelas[kls] || 0} Pesan)
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-[9px] font-bold text-sky-200 mb-0.5">
                          Tujuan Balasan di Kelas {currentIsolatedRoom}:
                        </label>
                        <select
                          value={chatRecipientStudentKey}
                          onChange={(e) => setChatRecipientStudentKey(e.target.value)}
                          className="w-full px-2 py-1 rounded-md border border-sky-400/40 bg-slate-950 text-sky-200 text-[10px] sm:text-[11px] font-bold focus:outline-none focus:ring-1 focus:ring-sky-400"
                        >
                          <option value="ALL_IN_TARGET">
                            👥 Seluruh Siswa di Kelas {currentIsolatedRoom}
                          </option>
                          {sameClassChatStudents.map((st) => (
                            <option key={`guru-reply-to-${st.key}`} value={st.key}>
                              👤 {st.namaSiswa} (NISN: {st.nisNisn} · Meja #{st.seatNumber})
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <AnimatePresence mode="wait" initial={false}>
                  <motion.div
                    key={`student-form-panel-${currentIsolatedRoom}`}
                    initial={{ opacity: 0, x: roomTransitionDirection * 18 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: roomTransitionDirection * -18 }}
                    transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                    className="space-y-1.5"
                  >
                    {/* Identitas Lengkap Siswa Pengirim di Kelas Aktif */}
                    <div className="rounded-lg border border-sky-400/30 bg-slate-900/90 p-1.5 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-[8.5px] font-extrabold uppercase tracking-wider text-amber-300 flex items-center gap-1">
                          <Users className="w-2.5 h-2.5 text-amber-300" />
                          <span>1. Identitas Siswa Pengirim</span>
                        </span>
                        <span className="text-[8px] sm:text-[9px] font-mono text-emerald-300">
                          Kelas {currentIsolatedRoom}
                        </span>
                      </div>

                      {/* Pilih Cepat dari Daftar Siswa Satu Kelas */}
                      <div>
                        <select
                          value=""
                          onChange={(e) => {
                            const chosen = sameClassChatStudents.find(
                              (st) => st.key === e.target.value
                            );
                            if (chosen) {
                              setChatSenderName(chosen.namaSiswa);
                              setChatSenderNis(chosen.nisNisn);
                              setChatSenderKelas(chosen.kelas);
                              setChatSenderSeat(chosen.seatNumber);
                            }
                          }}
                          className="w-full px-1.5 py-1 rounded-md border border-sky-400/40 bg-slate-950 text-sky-200 text-[9.5px] sm:text-[10.5px] font-semibold focus:outline-none focus:ring-1 focus:ring-sky-400"
                        >
                          <option value="">
                            -- Pilih Profil Siswa Kelas {currentIsolatedRoom} --
                          </option>
                          {sameClassChatStudents.map((st) => (
                            <option key={`pick-sender-${st.key}`} value={st.key}>
                              {st.namaSiswa} · NISN: {st.nisNisn} (Meja #{st.seatNumber})
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-12 gap-1">
                        <div className="sm:col-span-7">
                          <label className="block text-[8.5px] font-bold text-sky-200 mb-0.5">
                            Nama Lengkap <span className="text-rose-400">*</span>
                          </label>
                          <input
                            type="text"
                            value={chatSenderName}
                            onChange={(e) => setChatSenderName(e.target.value)}
                            placeholder={`Nama siswa Kelas ${currentIsolatedRoom}...`}
                            className="w-full px-1.5 py-1 rounded-md border border-white/20 bg-slate-950 text-white text-[10px] sm:text-[11px] font-bold focus:outline-none focus:ring-1 focus:ring-sky-400"
                          />
                        </div>

                        <div className="sm:col-span-5">
                          <label className="block text-[8.5px] font-bold text-sky-200 mb-0.5">
                            NIS / NISN
                          </label>
                          <input
                            type="text"
                            value={chatSenderNis}
                            onChange={(e) => setChatSenderNis(e.target.value)}
                            placeholder="0108823411"
                            className="w-full px-1.5 py-1 rounded-md border border-white/20 bg-slate-950 text-sky-300 font-mono text-[10px] sm:text-[11px] font-bold focus:outline-none focus:ring-1 focus:ring-sky-400"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-1">
                        <div>
                          <label className="block text-[8.5px] font-bold text-amber-300 mb-0.5">
                            Ruang Kelas
                          </label>
                          <div className="w-full px-1.5 py-1 rounded-md border border-emerald-400/40 bg-slate-950 text-emerald-300 text-[9.5px] sm:text-[10.5px] font-extrabold flex items-center justify-between">
                            <span>🔒 Kelas {currentIsolatedRoom}</span>
                          </div>
                        </div>

                        <div>
                          <label className="block text-[8.5px] font-bold text-sky-200 mb-0.5">
                            Nomor Bangku
                          </label>
                          <input
                            type="number"
                            min={1}
                            max={60}
                            value={chatSenderSeat}
                            onChange={(e) =>
                              setChatSenderSeat(Math.max(1, Number(e.target.value) || 1))
                            }
                            className="w-full px-1.5 py-1 rounded-md border border-white/20 bg-slate-950 text-white font-mono text-[10px] sm:text-[11px] font-bold focus:outline-none focus:ring-1 focus:ring-sky-400"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Pilihan Lawan Bicara ("Ngobrol Sama Siapa"): Meja Guru atau Teman Satu Kelas */}
                    <div className="rounded-lg border border-emerald-400/30 bg-slate-900/90 p-1.5 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-[8.5px] font-extrabold uppercase tracking-wider text-emerald-300 flex items-center gap-1">
                          <ShieldCheck className="w-2.5 h-2.5 text-emerald-300" />
                          <span>2. Lawan Bicara (Kelas {currentIsolatedRoom})</span>
                        </span>
                        <span className="text-[8px] sm:text-[9px] font-mono text-amber-300">
                          Meja Guru
                        </span>
                      </div>

                      <div>
                        <select
                          value={chatRecipientStudentKey}
                          onChange={(e) => {
                            setChatRecipientStudentKey(e.target.value);
                          }}
                          className="w-full px-1.5 py-1 rounded-md border border-amber-400/40 bg-slate-950 text-amber-200 text-[9.5px] sm:text-[10.5px] font-bold focus:outline-none focus:ring-1 focus:ring-amber-400"
                        >
                          <option value="ALL_IN_TARGET">
                            👥 Seluruh Teman Sekelas &amp; Meja Guru (Kelas {currentIsolatedRoom})
                          </option>
                          <option value="TEACHER_DESK">
                            👨‍🏫 Meja Guru &amp; Proktor ({EXAM_INFO.guruMapel})
                          </option>
                          {sameClassChatStudents.map((st) => (
                            <option key={`target-student-${st.key}`} value={st.key}>
                              👤 {st.namaSiswa} (NISN: {st.nisNisn} · Meja #{st.seatNumber})
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </motion.div>
                </AnimatePresence>
              )}

              {/* Indikator Sedang Membalas Pesan */}
              {replyingToMessage && (
                <div className="rounded-md bg-amber-500/15 border border-amber-400/50 p-1 flex items-center justify-between gap-1 text-[9.5px]">
                  <div className="min-w-0">
                    <span className="font-extrabold text-amber-300 block text-[9px]">
                      Membalas {replyingToMessage.senderName} (Kelas {currentIsolatedRoom})
                    </span>
                    <span className="text-[8.5px] text-slate-300 truncate block">
                      "{replyingToMessage.text}"
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setReplyingToMessage(null)}
                    className="p-0.5 rounded hover:bg-white/10 text-amber-200 shrink-0 cursor-pointer"
                  >
                    <X className="w-2.5 h-2.5" />
                  </button>
                </div>
              )}

              {/* Template Pesan Cepat (Otomatis menyesuaikan Mode Meja Guru vs Mode Siswa) */}
              <div className="space-y-0.5">
                <span className="text-[8px] sm:text-[9px] font-mono uppercase tracking-wider text-slate-400 block">
                  {isIdentifiedAsTeacher && isTeacherDeskChatMode
                    ? 'Instruksi Cepat Guru:'
                    : `Pesan Cepat Kelas ${currentIsolatedRoom}:`}
                </span>
                <div className="flex flex-wrap gap-1">
                  {(isIdentifiedAsTeacher && isTeacherDeskChatMode
                    ? TEACHER_DESK_QUICK_TEMPLATES
                    : QUICK_CHAT_TEMPLATES
                  ).map((tpl, idx) => (
                    <button
                      key={`tpl-${idx}`}
                      type="button"
                      onClick={() => setChatInputText(tpl)}
                      className="px-1.5 py-0.5 rounded-md bg-slate-900 hover:bg-slate-800 border border-white/15 text-[8.5px] sm:text-[9.5px] text-sky-200 text-left transition-colors cursor-pointer line-clamp-1"
                    >
                      {tpl}
                    </button>
                  ))}
                </div>
              </div>

              {/* Kotak Input Teks Pesan */}
              <div>
                <label className="block text-[8.5px] font-bold text-sky-200 mb-0.5">
                  {isIdentifiedAsTeacher && isTeacherDeskChatMode
                    ? teacherChatActionType === 'BROADCAST'
                      ? 'Isi Pesan Siaran Guru (Broadcast)'
                      : `Isi Balasan Guru (Kelas ${currentIsolatedRoom})`
                    : `Isi Pesan Diskusi (Kelas ${currentIsolatedRoom})`}
                </label>
                <textarea
                  rows={2}
                  value={chatInputText}
                  onChange={(e) => setChatInputText(e.target.value)}
                  placeholder={
                    isIdentifiedAsTeacher && isTeacherDeskChatMode
                      ? teacherChatActionType === 'BROADCAST'
                        ? 'Tulis pesan siaran resmi Guru...'
                        : `Tulis balasan Guru untuk Kelas ${currentIsolatedRoom}...`
                      : `Tulis pesan diskusi aman Kelas ${currentIsolatedRoom}...`
                  }
                  className="w-full p-1.5 rounded-md border border-white/20 bg-slate-900 text-white placeholder:text-slate-500 text-[10px] sm:text-[11px] focus:outline-none focus:ring-1 focus:ring-emerald-400"
                />
              </div>

              <button
                type="submit"
                className={`w-full py-1.5 px-2.5 rounded-lg font-extrabold text-[10px] sm:text-[11px] shadow flex items-center justify-center gap-1 transition-all cursor-pointer ${
                  isIdentifiedAsTeacher && isTeacherDeskChatMode
                    ? 'bg-gradient-to-r from-amber-400 via-yellow-300 to-emerald-400 hover:from-amber-300 hover:to-emerald-300 text-slate-950'
                    : 'bg-gradient-to-r from-emerald-500 via-teal-400 to-sky-400 hover:from-emerald-400 hover:to-sky-300 text-slate-950'
                }`}
              >
                <Send className="w-2.5 h-2.5 shrink-0" />
                <span>
                  {isIdentifiedAsTeacher && isTeacherDeskChatMode
                    ? teacherChatActionType === 'BROADCAST'
                      ? '📢 Kirim Siaran Guru'
                      : `↩️ Kirim Balasan ke Kelas ${currentIsolatedRoom}`
                    : chatRecipientStudentKey === 'TEACHER_DESK'
                    ? `Kirim ke Meja Guru (Kelas ${currentIsolatedRoom})`
                    : `Kirim ke Kelas ${currentIsolatedRoom}`}
                </span>
              </button>
            </form>
          </div>
        </section>
      </div>

      {/* TABEL DAFTAR SISWA DI RUANGAN KELAS AKTIF */}
      <section className="rounded-lg sm:rounded-xl border border-sky-500/35 bg-slate-950/95 p-1.5 sm:p-2.5 text-white shadow-md space-y-1.5 sm:space-y-2">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
          <div>
            <h3 className="text-[11px] sm:text-xs font-extrabold text-white flex items-center gap-1">
              <Users className="w-3 h-3 text-amber-300 shrink-0" />
              <span>
                Daftar Siswa Terdaftar di Ruang Kelas {selectedKelas} ({studentsInSelectedKelas.length}{' '}
                Siswa)
              </span>
            </h3>
            <p className="text-[8.5px] sm:text-[9.5px] text-slate-400">
              Data siswa yang diinput secara manual di kelas ini langsung tersinkron dengan Rekap Hasil Ujian & Device
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-1">
            <div className="relative w-full sm:w-auto">
              <Search className="w-2.5 h-2.5 text-slate-400 absolute left-2 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari nama, NISN, bangku..."
                className="w-full sm:w-auto pl-6 pr-2 py-0.5 rounded-md border border-white/15 bg-slate-900 text-[9.5px] sm:text-[10.5px] text-white placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-sky-400"
              />
            </div>
          </div>
        </div>

        <div className="overflow-x-auto rounded-lg border border-white/15">
          <table className="w-full text-left border-collapse text-[9.5px] sm:text-[11px]">
            <thead>
              <tr className="bg-slate-900/95 text-sky-200 border-b border-white/15 uppercase font-mono text-[8px] sm:text-[9px]">
                <th className="py-1 px-1.5">Bangku</th>
                <th className="py-1 px-1.5 text-center">Foto</th>
                <th className="py-1 px-1.5">Nama Siswa</th>
                <th className="py-1 px-1.5">NIS / NISN</th>
                <th className="py-1 px-1.5">Kelas & Sem</th>
                <th className="py-1 px-1.5">Device (Jenis & Merek/Tipe)</th>
                <th className="py-1 px-1.5 text-center">Skor</th>
                <th className="py-1 px-1.5 text-center">Nilai</th>
                <th className="py-1 px-1.5">Status</th>
                <th className="py-1 px-1.5 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {filteredStudentsList.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-3 text-center text-slate-400 text-[9.5px] sm:text-[10.5px]">
                    Belum ada data siswa di Kelas <strong>{selectedKelas}</strong>. Silakan isi{' '}
                    <strong>Form Input Manual</strong> di sebelah kiri atau klik salah satu bangku kosong di atas.
                  </td>
                </tr>
              ) : (
                filteredStudentsList.map((st, stIdx) => {
                  const rowPhoto = resolveSeatStudentPhoto(st);
                  return (
                  <tr
                    key={st.id ? `seat-st-${st.id}-${stIdx}` : `seat-st-${stIdx}`}
                    className="hover:bg-white/5 transition-colors text-[9.5px] sm:text-[11px]"
                  >
                    <td className="py-1 px-1.5 font-mono font-extrabold text-amber-300 whitespace-nowrap">
                      Meja #{st.seatNumber}
                    </td>
                    <td className="py-1 px-1.5 text-center">
                      <button
                        type="button"
                        onClick={() =>
                          setZoomedSeatPhotoStudent({
                            seatNumber: st.seatNumber,
                            namaSiswa: st.namaSiswa,
                            nisNisn: st.nisNisn,
                            kelas: st.kelas,
                            semester: st.semester,
                            photoUrl: rowPhoto.url,
                            attendanceStatus: st.attendanceStatus,
                            nilaiAkhir: st.nilaiAkhir,
                            deviceInfo: st.deviceInfo,
                          })
                        }
                        className="inline-flex flex-col items-center gap-0.5 cursor-pointer group/tblphoto"
                      >
                        <div
                          className={`w-6 h-7 sm:w-7 sm:h-8 rounded-md overflow-hidden border shadow-sm transition-transform group-hover/tblphoto:scale-105 ${
                            rowPhoto.hasCustomCameraPhoto
                              ? 'border-emerald-400'
                              : 'border-amber-400/60'
                          } bg-slate-950`}
                        >
                          <img
                            src={rowPhoto.url}
                            alt={st.namaSiswa}
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <span
                          className={`text-[6.5px] font-mono font-extrabold ${
                            rowPhoto.hasCustomCameraPhoto ? 'text-emerald-300' : 'text-slate-400'
                          }`}
                        >
                          {rowPhoto.hasCustomCameraPhoto ? '✓ Kamera' : 'Avatar'}
                        </span>
                      </button>
                    </td>
                    <td className="py-1 px-1.5 font-bold text-white whitespace-nowrap">{st.namaSiswa}</td>
                    <td className="py-1 px-1.5 font-mono text-slate-300 text-[9px] sm:text-[10px]">{st.nisNisn}</td>
                    <td className="py-1 px-1.5 whitespace-nowrap">
                      <span className="px-1 py-0.1 rounded bg-sky-500/20 text-sky-300 font-bold text-[8.5px] sm:text-[9.5px]">
                        {st.kelas} · {st.semester}
                      </span>
                    </td>
                    <td className="py-1 px-1.5">
                      <div className="flex items-center gap-1">
                        {renderDeviceIcon(st.deviceCategory)}
                        <div>
                          <div className="font-bold text-emerald-300 text-[8.5px] sm:text-[9.5px]">
                            {st.deviceCategory}
                          </div>
                          <div className="text-[7.5px] sm:text-[8.5px] text-slate-400 truncate max-w-[140px]">
                            {st.deviceModel}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="py-1 px-1.5 text-center font-mono text-[9.5px] sm:text-[10.5px]">
                      {st.skorBenar}/{st.totalSoal}
                    </td>
                    <td className="py-1 px-1.5 text-center">
                      <span
                        className={`px-1 py-0.1 rounded font-mono font-extrabold text-[8.5px] sm:text-[9.5px] ${
                          st.nilaiAkhir >= EXAM_INFO.kkm
                            ? 'bg-emerald-500/20 text-emerald-300'
                            : 'bg-rose-500/20 text-rose-300'
                        }`}
                      >
                        {st.nilaiAkhir}%
                      </span>
                    </td>
                    <td className="py-1 px-1.5 whitespace-nowrap">
                      <span
                        className={`text-[8.5px] sm:text-[9.5px] font-bold ${
                          st.nilaiAkhir >= EXAM_INFO.kkm ? 'text-emerald-300' : 'text-rose-300'
                        }`}
                      >
                        {st.lulusTidakLulus}
                      </span>
                    </td>
                    <td className="py-1 px-1.5 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() =>
                            onSelectStudentForExam({
                              namaSiswa: st.namaSiswa,
                              nisNisn: st.nisNisn,
                              kelas: st.kelas,
                              semester: st.semester,
                            })
                          }
                          className="px-1 py-0.5 rounded-md bg-emerald-500/20 hover:bg-emerald-500/35 text-emerald-200 text-[8.5px] sm:text-[9.5px] font-bold flex items-center gap-0.5 cursor-pointer"
                        >
                          <Play className="w-2.5 h-2.5" />
                          <span>Mulai</span>
                        </button>
                        {isIdentifiedAsTeacher ? (
                          <>
                            <button
                              type="button"
                              onClick={() => handleSeatClick(st.seatNumber)}
                              className="px-1.5 py-0.5 rounded-md bg-sky-500/20 hover:bg-sky-500/35 text-sky-200 font-bold flex items-center gap-0.5 cursor-pointer text-[8.5px] sm:text-[9.5px]"
                            >
                              <Edit3 className="w-2.5 h-2.5" />
                              <span>Edit</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteSeatStudent(st)}
                              className="px-1.5 py-0.5 rounded-md bg-rose-500/20 hover:bg-rose-500/35 border border-rose-400/40 text-rose-300 font-bold flex items-center gap-0.5 cursor-pointer text-[8.5px] sm:text-[9.5px]"
                            >
                              <Trash2 className="w-2.5 h-2.5" />
                              <span>Hapus (Guru)</span>
                            </button>
                          </>
                        ) : (
                          <button
                            type="button"
                            onClick={() =>
                              requireTeacherSeatUnlock(
                                `Menghapus Bangku #${st.seatNumber} (${st.namaSiswa} · Kelas ${st.kelas}) — Siswa tidak dapat menghapus bangku siswa lainnya (Khusus Mode Guru)`
                              )
                            }
                            className="px-1.5 py-0.5 rounded-md bg-slate-900 hover:bg-amber-400/20 border border-amber-400/45 text-amber-300 font-mono text-[8px] sm:text-[9px] font-bold inline-flex items-center gap-0.5 cursor-pointer transition-colors"
                          >
                            <Lock className="w-2.5 h-2.5 text-amber-300" />
                            <span>Mode Guru</span>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* MODAL INSPEKSI FOTO WAJAH SISWA DI BANGKU (AGAR GURU TAHU WAJAH SIAPA YANG DUDUK DI BANGKUNYA) */}
      {zoomedSeatPhotoStudent && (
        <div
          onClick={() => setZoomedSeatPhotoStudent(null)}
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-start justify-center pt-2 sm:pt-4 px-4 pb-4 overflow-y-auto"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="max-w-md w-full self-start mt-0 sm:mt-1 rounded-3xl border-2 border-emerald-400/70 bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950/90 p-5 text-white shadow-2xl space-y-4"
          >
            <div className="flex items-center justify-between border-b border-white/15 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-500/20 border border-emerald-400/60 flex items-center justify-center text-emerald-300 shrink-0">
                  <Camera className="w-4 h-4 text-amber-300" />
                </div>
                <div>
                  <span className="text-[10px] font-mono font-extrabold uppercase tracking-wider text-emerald-300 block">
                    VERIFIKASI WAJAH BANGKU SISWA · MEJA #{zoomedSeatPhotoStudent.seatNumber}
                  </span>
                  <h3 className="text-sm sm:text-base font-extrabold text-white truncate">
                    {zoomedSeatPhotoStudent.namaSiswa}
                  </h3>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setZoomedSeatPhotoStudent(null)}
                className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-slate-200 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex flex-col items-center text-center space-y-3">
              <div className="relative w-44 h-56 rounded-2xl overflow-hidden border-2 border-amber-400 shadow-2xl bg-slate-950">
                <img
                  src={zoomedSeatPhotoStudent.photoUrl}
                  alt={zoomedSeatPhotoStudent.namaSiswa}
                  className="w-full h-full object-cover"
                />
                <div className="absolute top-2 left-2 px-2 py-0.5 rounded-full bg-amber-400 text-slate-950 font-mono text-[10px] font-black shadow">
                  Meja #{zoomedSeatPhotoStudent.seatNumber}
                </div>
                <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-slate-950 via-slate-950/85 to-transparent p-2.5 text-center">
                  <span className="text-xs font-extrabold text-white block truncate">
                    {zoomedSeatPhotoStudent.namaSiswa}
                  </span>
                  <span className="text-[10px] font-mono text-emerald-300 block">
                    NISN: {zoomedSeatPhotoStudent.nisNisn} · Kelas {zoomedSeatPhotoStudent.kelas}
                  </span>
                </div>
              </div>

              <div className="w-full grid grid-cols-2 gap-2 text-left text-xs">
                <div className="p-2.5 rounded-xl bg-slate-900/90 border border-white/10">
                  <span className="text-[9.5px] font-mono text-sky-300 uppercase block">
                    Posisi Duduk Kelas
                  </span>
                  <span className="font-extrabold text-amber-300">
                    Kelas {zoomedSeatPhotoStudent.kelas} · Meja #{zoomedSeatPhotoStudent.seatNumber}
                  </span>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-900/90 border border-white/10">
                  <span className="text-[9.5px] font-mono text-sky-300 uppercase block">
                    Status & Nilai
                  </span>
                  <span className="font-extrabold text-emerald-300">
                    {zoomedSeatPhotoStudent.attendanceStatus} ({zoomedSeatPhotoStudent.nilaiAkhir}%)
                  </span>
                </div>
              </div>

              {zoomedSeatPhotoStudent.deviceInfo && (
                <div className="w-full p-2.5 rounded-xl bg-slate-900/90 border border-white/10 text-left text-[11px] text-slate-300">
                  <span className="text-[9.5px] font-mono text-sky-300 uppercase block">
                    Perangkat Siswa di Bangku Ini:
                  </span>
                  <span className="font-semibold text-white">
                    {zoomedSeatPhotoStudent.deviceInfo}
                  </span>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between gap-2 pt-2 border-t border-white/10">
              <button
                type="button"
                onClick={() => {
                  const targetSeat = zoomedSeatPhotoStudent.seatNumber;
                  setZoomedSeatPhotoStudent(null);
                  handleSeatClick(targetSeat);
                  setShowSeatCameraModal(true);
                }}
                className="flex-1 py-2 px-3 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-extrabold text-xs flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Camera className="w-3.5 h-3.5" />
                <span>Update Foto Kamera Bangku #{zoomedSeatPhotoStudent.seatNumber}</span>
              </button>
              <button
                type="button"
                onClick={() => setZoomedSeatPhotoStudent(null)}
                className="py-2 px-4 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs cursor-pointer"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL PROFIL KAMERA SISWA LANGSUNG DARI DESIGN CLASSROOM (OTOMATIS TERSINKRON KE BANGKU) */}
      <StudentCameraProfileModal
        isOpen={showSeatCameraModal}
        onClose={() => setShowSeatCameraModal(false)}
        namaSiswa={namaSiswaInput.trim()}
        nisNisn={nisNisnInput.trim()}
        kelasSiswa={selectedKelas}
        semesterSiswa={selectedSemester}
        currentPhotoUrl={
          seatPhotoInput ||
          getPhotoForStudentIdentity(namaSiswaInput, nisNisnInput, false) ||
          ''
        }
        onSaveProfile={(updated) => {
          const cleanSavedName = (updated.namaSiswa || namaSiswaInput).trim();
          const cleanSavedNis = (updated.nisNisn || nisNisnInput).trim();
          const cleanSavedKelas =
            getCleanKelas(updated.kelasSiswa || selectedKelas) || selectedKelas;
          const cleanSavedSem = updated.semesterSiswa || selectedSemester;

          if (cleanSavedName) setNamaSiswaInput(cleanSavedName);
          if (cleanSavedNis) setNisNisnInput(cleanSavedNis);
          setSelectedKelas(cleanSavedKelas);
          setSelectedSemester(cleanSavedSem);
          setSeatPhotoInput(updated.photoDataUrl || '');

          saveStoredStudentProfile(updated);

          setClassroomStudents((prev) => {
            const next = prev.map((st) => {
              const isTargetSeat =
                getCleanKelas(st.kelas) === cleanSavedKelas &&
                st.seatNumber === seatNumberInput;
              const isSameIdentity =
                (cleanSavedNis &&
                  st.nisNisn.trim().toLowerCase() === cleanSavedNis.toLowerCase()) ||
                (cleanSavedName &&
                  st.namaSiswa.trim().toLowerCase() === cleanSavedName.toLowerCase() &&
                  getCleanKelas(st.kelas) === cleanSavedKelas);
              if (isTargetSeat || isSameIdentity) {
                return {
                  ...st,
                  namaSiswa: cleanSavedName || st.namaSiswa,
                  nisNisn: cleanSavedNis || st.nisNisn,
                  photoUrl: updated.photoDataUrl || st.photoUrl,
                };
              }
              return st;
            });
            try {
              localStorage.setItem(STORAGE_KEY_STUDENTS, JSON.stringify(next));
            } catch {}
            return next;
          });

          triggerToast(
            `📸 Foto wajah "${cleanSavedName || 'Siswa'}" otomatis terhubung & tampil di Meja #${seatNumberInput} (Kelas ${cleanSavedKelas})!`
          );
        }}
      />

      {/* Modal Pilihan Data Sinkronisasi (Tanggal, Bulan, Tahun) */}
      <SyncDataDateModal
        isOpen={showSyncDateModal}
        onClose={() => setShowSyncDateModal(false)}
        submissions={submissions}
        title="PILIHAN DATA SINKRONISASI CLASSROOM & REKAP"
        description="Pilih tanggal, bulan, atau tahun data ujian siswa yang ingin disinkronkan ke Rekapitulasi (13 Kolom) & Google Sheets."
        isSyncing={isSyncingLoginSheet}
        onConfirmSync={handleConfirmClassroomSyncFromModal}
      />

      {/* MODAL INPUT BANYAK SISWA SEKALIGUS (BULK MANUAL INPUT) */}
      {showBulkModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="max-w-xl w-full rounded-3xl border border-sky-500/40 bg-slate-950 p-6 text-white shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-white/15 pb-3">
              <div className="flex items-center gap-2">
                <PlusCircle className="w-5 h-5 text-amber-300" />
                <h3 className="text-base font-extrabold">
                  Input Manual Banyak Siswa Sekaligus · Kelas {selectedKelas}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowBulkModal(false)}
                className="p-1 rounded-lg hover:bg-white/10 text-slate-300 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleBulkAddStudents} className="space-y-4">
              <p className="text-xs text-slate-300 leading-relaxed">
                Ketik atau tempel (paste) daftar nama siswa untuk dimasukkan ke bangku kosong di{' '}
                <strong className="text-amber-300">Kelas {selectedKelas}</strong> (1 baris = 1 siswa).
                Format: <code className="text-emerald-300">Nama Siswa | NISN | Nilai (0-100) | Device</code>
              </p>

              <textarea
                rows={7}
                required
                value={bulkTextInput}
                onChange={(e) => setBulkTextInput(e.target.value)}
                placeholder={`Contoh:\nAndi Pratama | 0081122334 | 90 | Samsung Galaxy A15\nCitra Lestari | 0081122335 | 80 | Xiaomi Redmi Note 13\nDimas Anggara | 0081122336 | 85 | Laptop ASUS VivoBook`}
                className="w-full p-3.5 rounded-2xl border border-white/20 bg-slate-900 text-xs font-mono text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-400"
              />

              <div className="flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowBulkModal(false)}
                  className="px-4 py-2 rounded-xl border border-white/20 bg-white/10 text-xs font-bold text-white cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-extrabold flex items-center gap-1.5 cursor-pointer"
                >
                  <Check className="w-4 h-4" />
                  <span>Tambahkan Semua ke Kelas {selectedKelas}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL IDENTIFIKASI & OTORISASI GURU: HANYA GURU YANG DAPAT MENGIRIM PESAN SIARAN / MEMBALAS SEBAGAI GURU */}
      {showTeacherSeatLockModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="max-w-md w-full rounded-3xl border border-amber-400/50 bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 p-6 text-white shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-white/15 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-400/20 border border-amber-400/50 flex items-center justify-center text-amber-300 shrink-0">
                  <KeyRound className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-white">
                    Verifikasi Identitas Guru Mapel
                  </h3>
                  <p className="text-[11px] text-amber-200">
                    Fitur ini hanya aktif jika pengguna teridentifikasi sebagai Guru
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowTeacherSeatLockModal(false)}
                className="p-1 rounded-lg hover:bg-white/10 text-slate-300 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4" role="group">
              <div className="rounded-2xl border border-white/10 bg-slate-900/90 p-3.5 text-xs text-slate-300 space-y-1.5">
                <div className="text-amber-300 font-bold">Fitur Khusus Guru:</div>
                <div className="text-white font-semibold">{lockedSeatActionReason}</div>
                <div className="text-[11px] text-slate-400 pt-1">
                  Silakan verifikasi identitas Anda sebagai Guru Mapel (<strong className="text-amber-300">{EXAM_INFO.guruMapelUpper}</strong>) menggunakan Kode Mode Guru atau Akun Google Resmi Guru (<code className="text-emerald-300">{EXAM_INFO.teacherEmail}</code>).
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-sky-200 mb-1.5">
                  1. Verifikasi dengan Kode Mode Guru
                </label>
                <div className="relative">
                  <input
                    type={showSeatPass ? 'text' : 'password'}
                    name="q_filter_seat_guru_anbk"
                    autoFocus
                    autoComplete="off"
                    autoCorrect="off"
                    autoCapitalize="off"
                    spellCheck={false}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleVerifyTeacherSeatUnlock(e as unknown as React.FormEvent);
                      }
                    }}
                    value={teacherSeatPasswordInput}
                    onChange={(e) => {
                      setTeacherSeatPasswordInput(e.target.value);
                      if (teacherSeatPasswordError) setTeacherSeatPasswordError(null);
                    }}
                    placeholder="Ketik password Mode Guru..."
                    className="w-full pl-3.5 pr-10 py-2.5 rounded-xl border border-white/20 bg-slate-900 text-white text-sm font-mono tracking-widest focus:outline-none focus:ring-2 focus:ring-amber-400 placeholder:text-slate-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowSeatPass((p) => !p)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-amber-300 transition-colors cursor-pointer"
                    title={showSeatPass ? 'Sembunyikan password' : 'Tampilkan password'}
                  >
                    {showSeatPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {teacherSeatPasswordError && (
                  <p className="mt-1.5 text-xs font-bold text-rose-400">
                    {teacherSeatPasswordError}
                  </p>
                )}
              </div>

              <div className="pt-1 border-t border-white/10 space-y-2">
                <span className="block text-[11px] font-bold text-emerald-300">
                  2. Atau Verifikasi Otomatis via Akun Google Resmi Guru:
                </span>
                <button
                  type="button"
                  disabled={isVerifyingGoogleTeacher}
                  onClick={handleVerifyTeacherWithGoogleAccount}
                  className="w-full py-2.5 px-3.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/35 border border-emerald-400/50 text-emerald-200 text-xs font-extrabold flex items-center justify-center gap-2 cursor-pointer transition-all"
                >
                  <Globe className="w-4 h-4 text-emerald-300" />
                  <span>
                    {isVerifyingGoogleTeacher
                      ? 'Memverifikasi Akun Google Guru...'
                      : `Verifikasi Akun Google (${EXAM_INFO.teacherEmail})`}
                  </span>
                </button>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-1">
                <button
                  type="button"
                  onClick={() => setShowTeacherSeatLockModal(false)}
                  className="px-4 py-2 rounded-xl border border-white/20 bg-white/10 text-xs font-bold text-white cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={(e) => handleVerifyTeacherSeatUnlock(e as unknown as React.FormEvent)}
                  className="px-5 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-extrabold flex items-center gap-1.5 cursor-pointer shadow-md"
                >
                  <Unlock className="w-4 h-4" />
                  <span>Verifikasi Kode Guru</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL KONFIRMASI HAPUS SISWA DARI BANGKU */}
      {seatStudentToDelete && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="max-w-md w-full rounded-2xl border-2 border-rose-500/80 bg-slate-900 p-4 sm:p-5 space-y-3.5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 pb-2.5">
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 rounded-xl bg-rose-500/20 border border-rose-400/50 flex items-center justify-center text-rose-300 shrink-0">
                  <Trash2 className="w-5 h-5 text-rose-400" />
                </div>
                <div>
                  <h3 className="text-xs sm:text-sm font-black text-white uppercase tracking-tight flex items-center gap-1.5">
                    <span>Hapus Siswa dari Bangku</span>
                    <span className="px-1.5 py-0.2 rounded bg-rose-500/20 text-rose-300 text-[8px] font-mono border border-rose-500/40">
                      KURSI #{seatStudentToDelete.seatNumber}
                    </span>
                  </h3>
                  <p className="text-[9.5px] text-slate-300">
                    Konfirmasi pengosongan bangku lab komputer
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSeatStudentToDelete(null)}
                className="text-slate-400 hover:text-white p-1 cursor-pointer rounded-lg hover:bg-white/10"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Rincian Bangku & Siswa */}
            <div className="p-3 rounded-xl bg-slate-950 border border-rose-500/30 space-y-2 text-[10.5px]">
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Nama Siswa:</span>
                <strong className="text-white">{seatStudentToDelete.namaSiswa}</strong>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">NISN / Kelas:</span>
                <span className="font-mono text-amber-300 font-bold">
                  {seatStudentToDelete.nisNisn || '-'} · Kelas {seatStudentToDelete.kelas}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Nomor Kursi:</span>
                <span className="font-mono text-sky-300 font-bold">
                  Kursi Lab Komputer #{seatStudentToDelete.seatNumber}
                </span>
              </div>
            </div>

            {/* Peringatan */}
            <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-500/40 text-[10px] text-rose-200 leading-relaxed">
              <strong className="text-white block mb-0.5">
                Perhatian Mode Guru:
              </strong>
              Apakah Anda yakin ingin mengosongkan bangku #{seatStudentToDelete.seatNumber} dan menghapus data kehadiran siswa ini dari denah kursi lab komputer?
            </div>

            {/* Tombol Aksi */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-white/10">
              <button
                type="button"
                onClick={() => setSeatStudentToDelete(null)}
                className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold cursor-pointer transition-colors"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => handleExecuteDeleteSeatStudent(seatStudentToDelete)}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white text-xs font-black cursor-pointer shadow-lg shadow-rose-950/60 ring-2 ring-rose-400/40 flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Ya, Hapus dari Bangku</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
};
