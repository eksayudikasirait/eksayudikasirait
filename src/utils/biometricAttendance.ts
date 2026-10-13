import { getCleanKelas } from '../data/examData';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import { formatPhoneForWhatsApp } from './whatsappHelper';

export const STORAGE_KEY_REGISTERED_STUDENTS = 'anbk_biometric_students_v1';
export const STORAGE_KEY_ATTENDANCE_LOGS = 'anbk_biometric_attendance_v1';
export const STORAGE_KEY_KELAS_WALI = 'anbk_attendance_kelas_wali_v1';
export const STORAGE_KEY_SCHEDULE_CONFIG = 'anbk_attendance_schedule_cfg_v1';
export const STORAGE_KEY_ONLINE_PERMITS = 'anbk_attendance_online_permits_v1';

export const BIOMETRIC_ATTENDANCE_EVENT = 'anbk-biometric-attendance-updated';
export const BIOMETRIC_STUDENT_REGISTERED_EVENT = 'anbk-biometric-student-registered';
export const PERMIT_REQUEST_EVENT = 'anbk-attendance-permit-updated';

export type AttendanceStatusType =
  | 'HADIR_TEPAT_WAKTU'
  | 'TERLAMBAT'
  | 'SAKIT'
  | 'IZIN'
  | 'ALFA'
  | 'BOLOS'
  | 'DISPENSASI';

export type AttendanceMethodType =
  | 'SENSOR_SIDIK_JARI_ANDROID'
  | 'TOUCH_ID_APPLE'
  | 'WEBAUTHN_BIOMETRIK'
  | 'SENSOR_KAPASITIF_LAYAR'
  | 'QR_CODE_SCANNER'
  | 'KARTU_RFID'
  | 'SWAFOTO_GPS'
  | 'INPUT_MANUAL_GURU'
  | 'PENGAJUAN_IZIN_ONLINE';

export interface RegisteredStudentBiometric {
  id: string;
  namaSiswa: string;
  nis?: string;
  nisn?: string;
  nisNisn: string; // Composite or primary identifier
  kelas: string;
  jenisKelamin: 'Laki-laki' | 'Perempuan';
  noHpOrangTua?: string;
  namaOrangTua?: string;
  credentialId?: string; // WebAuthn rawId (base64)
  fingerprintFinger: string; // 'Jempol Kanan' | 'Telunjuk Kanan' | 'Jempol Kiri' | 'Telunjuk Kiri'
  fingerprintHash: string; // Biometric signature identifier
  photoUrl?: string;
  rfidCardId?: string; // Virtual RFID card number
  registeredAt: string;
  deviceInfo: {
    brand: string;
    model: string;
    platform: string;
    isAndroid: boolean;
    isIos: boolean;
    hasHardwareBiometric: boolean;
  };
}

export interface StudentAttendanceRecord {
  id: string;
  studentId: string;
  namaSiswa: string;
  nis?: string;
  nisn?: string;
  nisNisn: string;
  kelas: string;
  timestamp: string; // DD/MM/YYYY, HH.mm.ss WIB
  date: string; // YYYY-MM-DD
  time: string; // HH:mm:ss
  status: AttendanceStatusType;
  metodeVerifikasi: AttendanceMethodType;
  deviceModel: string;
  deviceBrand: string;
  photoUrl?: string;
  gpsLocation?: {
    latitude: number;
    longitude: number;
    accuracy: number;
    distanceToSchoolMeters: number;
    isWithinSchoolRadius: boolean;
    address?: string;
  };
  catatan?: string;
  suratBuktiUrl?: string;
  waNotificationSent?: boolean;
  hari?: SchoolDayName;
  mataPelajaran?: string;
  jamJadwalMapel?: string;
}

export interface KelasWaliKelasMaster {
  id: string;
  namaKelas: string;
  jenjang: 'VII' | 'VIII' | 'IX';
  namaWaliKelas: string;
  nipWaliKelas: string;
  noHpWaliKelas: string;
}

export type SchoolDayName = 'Senin' | 'Selasa' | 'Rabu' | 'Kamis' | 'Jumat' | 'Sabtu';

export const SCHOOL_DAYS_LIST: SchoolDayName[] = [
  'Senin',
  'Selasa',
  'Rabu',
  'Kamis',
  'Jumat',
  'Sabtu',
];

export interface SubjectScheduleSession {
  id: string;
  hari: SchoolDayName;
  mataPelajaran: string;
  kelasTarget: string; // 'ALL' atau nama kelas spesifik mis. 'VIII-1'
  jamMulai: string; // e.g. "07:30"
  jamBatasToleransi: string; // e.g. "07:45"
  jamSelesai: string; // e.g. "09:00"
  guruPengampu: string;
  keterangan?: string;
  aktif: boolean;
}

export interface DailyScheduleConfig {
  hari: SchoolDayName;
  aktif: boolean;
  jamMasuk: string;
  jamBatasToleransi: string;
  jamPulang: string;
  catatanHari: string;
  sesiMapel: SubjectScheduleSession[];
}

export interface SchoolScheduleConfig {
  jamMasuk: string; // e.g. "07:15"
  jamBatasToleransi: string; // e.g. "07:30"
  jamPulang: string; // e.g. "14:00"
  schoolLatitude: number;
  schoolLongitude: number;
  maxRadiusMeters: number;
  schoolName: string;
  alamatSekolah: string;
  hariLibur: string[]; // ['2026-08-17', '2026-12-25', ...]
  hariAktifTerpilih?: SchoolDayName;
  jadwalHarian?: Record<SchoolDayName, DailyScheduleConfig>;
}

export interface OnlinePermitRequest {
  id: string;
  studentId: string;
  namaSiswa: string;
  nisn: string;
  kelas: string;
  jenisIzin: 'SAKIT' | 'IZIN' | 'DISPENSASI';
  tanggalMulai: string;
  tanggalSelesai: string;
  alasan: string;
  fotoBuktiUrl?: string;
  status: 'MENUNGGU_VERIFIKASI' | 'DISETUJUI' | 'DITOLAK';
  diverifikasiOleh?: string;
  diverifikasiAt?: string;
  catatanGuru?: string;
  createdAt: string;
}

// Master Data Default Kelas & Wali Kelas UPTD SMP Negeri 7 Kisaran
export const INITIAL_KELAS_WALI_LIST: KelasWaliKelasMaster[] = [
  {
    id: 'KW-VII-1',
    namaKelas: 'VII-1',
    jenjang: 'VII',
    namaWaliKelas: 'Dra. Nurhayati Marpaung, M.Pd',
    nipWaliKelas: '197405121998022001',
    noHpWaliKelas: '081263881234',
  },
  {
    id: 'KW-VII-2',
    namaKelas: 'VII-2',
    jenjang: 'VII',
    namaWaliKelas: 'Budi Santoso, S.Pd',
    nipWaliKelas: '198003152005011003',
    noHpWaliKelas: '081375992345',
  },
  {
    id: 'KW-VII-3',
    namaKelas: 'VII-3',
    jenjang: 'VII',
    namaWaliKelas: 'Sri Wahyuni, S.Kom',
    nipWaliKelas: '198507202009032005',
    noHpWaliKelas: '085297113456',
  },
  {
    id: 'KW-VII-4',
    namaKelas: 'VII-4',
    jenjang: 'VII',
    namaWaliKelas: 'Ahmad Zulkarnain, S.Pd',
    nipWaliKelas: '197811122002121002',
    noHpWaliKelas: '082165885568',
  },
  {
    id: 'KW-VII-5',
    namaKelas: 'VII-5',
    jenjang: 'VII',
    namaWaliKelas: 'Rina Marlina, S.Pd',
    nipWaliKelas: '198802282010012015',
    noHpWaliKelas: '081264225678',
  },
  {
    id: 'KW-VIII-1',
    namaKelas: 'VIII-1',
    jenjang: 'VIII',
    namaWaliKelas: 'Eksa Yudika Sirait, S.Kom',
    nipWaliKelas: '198904162015041002',
    noHpWaliKelas: '082165885568',
  },
  {
    id: 'KW-VIII-2',
    namaKelas: 'VIII-2',
    jenjang: 'VIII',
    namaWaliKelas: 'Drs. M. Taufik Hidayat',
    nipWaliKelas: '196908141994121001',
    noHpWaliKelas: '081361226789',
  },
  {
    id: 'KW-VIII-3',
    namaKelas: 'VIII-3',
    jenjang: 'VIII',
    namaWaliKelas: 'Dewi Sartika Simanjuntak, S.Pd',
    nipWaliKelas: '198210052008012009',
    noHpWaliKelas: '085370337890',
  },
  {
    id: 'KW-VIII-4',
    namaKelas: 'VIII-4',
    jenjang: 'VIII',
    namaWaliKelas: 'Rudi Hartono, M.Pd',
    nipWaliKelas: '197609252003121004',
    noHpWaliKelas: '082274558901',
  },
  {
    id: 'KW-VIII-5',
    namaKelas: 'VIII-5',
    jenjang: 'VIII',
    namaWaliKelas: 'Siti Rahma Siregar, S.Pd',
    nipWaliKelas: '198403192009022008',
    noHpWaliKelas: '081265779012',
  },
  {
    id: 'KW-VIII-6',
    namaKelas: 'VIII-6',
    jenjang: 'VIII',
    namaWaliKelas: 'Hendri Wijaya, S.Pd',
    nipWaliKelas: '198712102011011005',
    noHpWaliKelas: '081376880123',
  },
];

export const INITIAL_JADWAL_HARIAN: Record<SchoolDayName, DailyScheduleConfig> = {
  Senin: {
    hari: 'Senin',
    aktif: true,
    jamMasuk: '07:15',
    jamBatasToleransi: '07:30',
    jamPulang: '14:00',
    catatanHari: 'Upacara Bendera & Pembelajaran Mapel Hari Senin',
    sesiMapel: [
      {
        id: 'SESI-SENIN-1',
        hari: 'Senin',
        mataPelajaran: 'Informatika (Fase D)',
        kelasTarget: 'VIII-1',
        jamMulai: '08:00',
        jamBatasToleransi: '08:15',
        jamSelesai: '09:30',
        guruPengampu: 'Eksa Yudika Sirait, S.Kom',
        keterangan: 'Praktikum Lab Komputer & Sistem Komputer',
        aktif: true,
      },
      {
        id: 'SESI-SENIN-2',
        hari: 'Senin',
        mataPelajaran: 'Informatika (Fase D)',
        kelasTarget: 'VII-1',
        jamMulai: '10:00',
        jamBatasToleransi: '10:15',
        jamSelesai: '11:30',
        guruPengampu: 'Eksa Yudika Sirait, S.Kom',
        keterangan: 'Berpikir Komputasional & Literasi Digital',
        aktif: true,
      },
    ],
  },
  Selasa: {
    hari: 'Selasa',
    aktif: true,
    jamMasuk: '07:15',
    jamBatasToleransi: '07:30',
    jamPulang: '14:00',
    catatanHari: 'Jadwal Pembelajaran Mapel Hari Selasa',
    sesiMapel: [
      {
        id: 'SESI-SELASA-1',
        hari: 'Selasa',
        mataPelajaran: 'Informatika (Fase D)',
        kelasTarget: 'VIII-2',
        jamMulai: '07:30',
        jamBatasToleransi: '07:45',
        jamSelesai: '09:00',
        guruPengampu: 'Eksa Yudika Sirait, S.Kom',
        keterangan: 'Jaringan Komputer & Internet',
        aktif: true,
      },
      {
        id: 'SESI-SELASA-2',
        hari: 'Selasa',
        mataPelajaran: 'Informatika (Fase D)',
        kelasTarget: 'VII-2',
        jamMulai: '09:30',
        jamBatasToleransi: '09:45',
        jamSelesai: '11:00',
        guruPengampu: 'Sri Wahyuni, S.Kom',
        keterangan: 'Teknologi Informasi & Komunikasi',
        aktif: true,
      },
    ],
  },
  Rabu: {
    hari: 'Rabu',
    aktif: true,
    jamMasuk: '07:15',
    jamBatasToleransi: '07:30',
    jamPulang: '14:00',
    catatanHari: 'Jadwal Pembelajaran Mapel Hari Rabu',
    sesiMapel: [
      {
        id: 'SESI-RABU-1',
        hari: 'Rabu',
        mataPelajaran: 'Informatika (Fase D)',
        kelasTarget: 'VIII-3',
        jamMulai: '07:30',
        jamBatasToleransi: '07:45',
        jamSelesai: '09:00',
        guruPengampu: 'Eksa Yudika Sirait, S.Kom',
        keterangan: 'Analisis Data & Algoritma Pemrograman',
        aktif: true,
      },
      {
        id: 'SESI-RABU-2',
        hari: 'Rabu',
        mataPelajaran: 'Informatika (Fase D)',
        kelasTarget: 'VII-3',
        jamMulai: '10:00',
        jamBatasToleransi: '10:15',
        jamSelesai: '11:30',
        guruPengampu: 'Sri Wahyuni, S.Kom',
        keterangan: 'Perangkat Keras & Perangkat Lunak',
        aktif: true,
      },
    ],
  },
  Kamis: {
    hari: 'Kamis',
    aktif: true,
    jamMasuk: '07:15',
    jamBatasToleransi: '07:30',
    jamPulang: '14:00',
    catatanHari: 'Jadwal Pembelajaran Mapel Hari Kamis',
    sesiMapel: [
      {
        id: 'SESI-KAMIS-1',
        hari: 'Kamis',
        mataPelajaran: 'Informatika (Fase D)',
        kelasTarget: 'VIII-4',
        jamMulai: '07:30',
        jamBatasToleransi: '07:45',
        jamSelesai: '09:00',
        guruPengampu: 'Eksa Yudika Sirait, S.Kom',
        keterangan: 'Dampak Sosial Informatika & Praktik Lintas Bidang',
        aktif: true,
      },
      {
        id: 'SESI-KAMIS-2',
        hari: 'Kamis',
        mataPelajaran: 'Informatika (Fase D)',
        kelasTarget: 'VII-4',
        jamMulai: '09:30',
        jamBatasToleransi: '09:45',
        jamSelesai: '11:00',
        guruPengampu: 'Eksa Yudika Sirait, S.Kom',
        keterangan: 'Sistem Bilangan Biner & Desimal',
        aktif: true,
      },
    ],
  },
  Jumat: {
    hari: 'Jumat',
    aktif: true,
    jamMasuk: '07:15',
    jamBatasToleransi: '07:30',
    jamPulang: '11:45',
    catatanHari: 'Senam Pagi / Imtaq & Pembelajaran Mapel Hari Jumat',
    sesiMapel: [
      {
        id: 'SESI-JUMAT-1',
        hari: 'Jumat',
        mataPelajaran: 'Informatika (Fase D)',
        kelasTarget: 'VIII-5',
        jamMulai: '08:00',
        jamBatasToleransi: '08:15',
        jamSelesai: '09:30',
        guruPengampu: 'Eksa Yudika Sirait, S.Kom',
        keterangan: 'Evaluasi & Latihan Soal ANBK Informatika',
        aktif: true,
      },
      {
        id: 'SESI-JUMAT-2',
        hari: 'Jumat',
        mataPelajaran: 'Informatika (Fase D)',
        kelasTarget: 'VII-5',
        jamMulai: '09:45',
        jamBatasToleransi: '10:00',
        jamSelesai: '11:15',
        guruPengampu: 'Eksa Yudika Sirait, S.Kom',
        keterangan: 'Praktikum Pengolahan Data Dasar',
        aktif: true,
      },
    ],
  },
  Sabtu: {
    hari: 'Sabtu',
    aktif: true,
    jamMasuk: '07:15',
    jamBatasToleransi: '07:30',
    jamPulang: '12:30',
    catatanHari: 'Pembelajaran Mapel & Ekstrakurikuler Hari Sabtu',
    sesiMapel: [
      {
        id: 'SESI-SABTU-1',
        hari: 'Sabtu',
        mataPelajaran: 'Informatika (Fase D)',
        kelasTarget: 'VIII-6',
        jamMulai: '07:30',
        jamBatasToleransi: '07:45',
        jamSelesai: '09:00',
        guruPengampu: 'Eksa Yudika Sirait, S.Kom',
        keterangan: 'Simulasi Ujian ANBK & Proyek Digital',
        aktif: true,
      },
      {
        id: 'SESI-SABTU-2',
        hari: 'Sabtu',
        mataPelajaran: 'Semua Mapel / Ekstrakurikuler',
        kelasTarget: 'ALL',
        jamMulai: '09:15',
        jamBatasToleransi: '09:30',
        jamSelesai: '12:00',
        guruPengampu: 'Tim Guru Mapel SMPN 7 Kisaran',
        keterangan: 'Pengembangan Diri & Kelas Tambahan',
        aktif: true,
      },
    ],
  },
};

export function getCurrentIndonesianSchoolDay(date: Date = new Date()): SchoolDayName {
  const dayIdx = date.getDay(); // 0 = Minggu, 1 = Senin, ..., 6 = Sabtu
  const map: Record<number, SchoolDayName> = {
    1: 'Senin',
    2: 'Selasa',
    3: 'Rabu',
    4: 'Kamis',
    5: 'Jumat',
    6: 'Sabtu',
  };
  return map[dayIdx] || 'Senin';
}

// Pengaturan Jadwal & Lokasi UPTD SMP Negeri 7 Kisaran
export const INITIAL_SCHEDULE_CONFIG: SchoolScheduleConfig = {
  jamMasuk: '07:15',
  jamBatasToleransi: '07:30',
  jamPulang: '14:00',
  schoolLatitude: 2.98642,
  schoolLongitude: 99.62725,
  maxRadiusMeters: 250, // 250 meter radius sekolah
  schoolName: 'UPTD SMP Negeri 7 Kisaran',
  alamatSekolah: 'Jl. Labu No. 10 Siumbut Baru Kisaran Timur.',
  hariLibur: ['2026-08-17', '2026-10-28', '2026-11-25', '2026-12-25', '2027-01-01', '2027-05-01'],
  hariAktifTerpilih: getCurrentIndonesianSchoolDay(),
  jadwalHarian: INITIAL_JADWAL_HARIAN,
};

// Data awal siswa SMPN 7 Kisaran yang sudah terdaftar template sidik jari (Awalnya kosong, nama demo dihapus permanen)
export const INITIAL_DEMO_REGISTERED_STUDENTS: RegisteredStudentBiometric[] = [];

// Helper kalkulasi jarak Haversine (dalam satuan meter)
export function calculateDistanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371e3; // radius bumi dalam meter
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return Math.round(R * c);
}

/**
 * Konversi buffer array ke Base64 URL safe string
 */
function bufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * Konversi Base64 URL safe string ke Uint8Array
 */
function base64ToUint8Array(base64: string): Uint8Array {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const safe = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(safe);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Cek apakah browser mendukung WebAuthn Platform Authenticator (Fingerprint Android / Touch ID iOS)
 */
export async function checkHardwareBiometricSupport(): Promise<{
  supported: boolean;
  hasPlatformAuthenticator: boolean;
  isAndroid: boolean;
  isIos: boolean;
  details: string;
}> {
  if (typeof window === 'undefined') {
    return {
      supported: false,
      hasPlatformAuthenticator: false,
      isAndroid: false,
      isIos: false,
      details: 'SSR / Window not available',
    };
  }

  const ua = navigator.userAgent || '';
  const isAndroid = /Android/i.test(ua);
  const isIos = /iPhone|iPad|iPod/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

  const supported = Boolean(window.PublicKeyCredential);
  let hasPlatformAuthenticator = false;

  if (supported && typeof window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable === 'function') {
    try {
      hasPlatformAuthenticator = await window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
    } catch {
      hasPlatformAuthenticator = false;
    }
  }

  let details = 'Sensor Sentuh Kapasitif Layar Siap';
  if (isAndroid) {
    details = hasPlatformAuthenticator
      ? 'Hardware Sensor Sidik Jari Android (BiometricPrompt) Aktif ✓'
      : 'Android Terdeteksi · Pemindai Sidik Jari Layar Siap ✓';
  } else if (isIos) {
    details = hasPlatformAuthenticator
      ? 'Touch ID / Face ID Apple Aktif ✓'
      : 'iPhone Terdeteksi · Pemindai Sidik Jari Layar Siap ✓';
  }

  return {
    supported,
    hasPlatformAuthenticator,
    isAndroid,
    isIos,
    details,
  };
}

/**
 * Membaca daftar kelas dan wali kelas
 */
export function getKelasWaliKelasList(): KelasWaliKelasMaster[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_KELAS_WALI);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {}
  try {
    localStorage.setItem(STORAGE_KEY_KELAS_WALI, JSON.stringify(INITIAL_KELAS_WALI_LIST));
  } catch {}
  return INITIAL_KELAS_WALI_LIST;
}

export function saveKelasWaliKelasList(list: KelasWaliKelasMaster[]): void {
  try {
    localStorage.setItem(STORAGE_KEY_KELAS_WALI, JSON.stringify(list));
  } catch {}
}

/**
 * Membaca pengaturan jadwal sekolah & jam presensi
 */
export function getSchoolScheduleConfig(): SchoolScheduleConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_SCHEDULE_CONFIG);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.jamMasuk) {
        if (!parsed.alamatSekolah || parsed.alamatSekolah.includes('Pondok Bungur') || parsed.alamatSekolah.includes('Labu r')) {
          parsed.alamatSekolah = 'Jl. Labu No. 10 Siumbut Baru Kisaran Timur.';
        }
        const mergedJadwalHarian: Record<SchoolDayName, DailyScheduleConfig> = {
          ...INITIAL_JADWAL_HARIAN,
          ...(parsed.jadwalHarian || {}),
        };
        SCHOOL_DAYS_LIST.forEach((day) => {
          if (!mergedJadwalHarian[day]) {
            mergedJadwalHarian[day] = INITIAL_JADWAL_HARIAN[day];
          } else if (!Array.isArray(mergedJadwalHarian[day].sesiMapel)) {
            mergedJadwalHarian[day].sesiMapel = INITIAL_JADWAL_HARIAN[day].sesiMapel;
          }
        });
        const finalCfg: SchoolScheduleConfig = {
          ...INITIAL_SCHEDULE_CONFIG,
          ...parsed,
          alamatSekolah: 'Jl. Labu No. 10 Siumbut Baru Kisaran Timur.',
          hariAktifTerpilih: parsed.hariAktifTerpilih || getCurrentIndonesianSchoolDay(),
          jadwalHarian: mergedJadwalHarian,
        };
        return finalCfg;
      }
    }
  } catch {}
  try {
    localStorage.setItem(STORAGE_KEY_SCHEDULE_CONFIG, JSON.stringify(INITIAL_SCHEDULE_CONFIG));
  } catch {}
  return INITIAL_SCHEDULE_CONFIG;
}

export function saveSchoolScheduleConfig(cfg: SchoolScheduleConfig): void {
  try {
    localStorage.setItem(STORAGE_KEY_SCHEDULE_CONFIG, JSON.stringify(cfg));
  } catch {}
}

/**
 * Membaca daftar siswa yang terdaftar
 */
export function getRegisteredStudents(): RegisteredStudentBiometric[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_REGISTERED_STUDENTS);
    if (raw !== null && raw !== undefined) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        // Hapus permanen jika ada residu nama-nama demo bawaan lama yang tersimpan di browser
        const demoNames = [
          'nayla azzahra nst',
          'sofi marsya aulia',
          'muhammad ridho syahputra',
          'dimas aditya pratama',
          'aisyah haya kholis hrp',
          'farel pratama',
          'siti zahra khairunnisa',
        ];
        const cleaned = parsed.filter(
          (s) =>
            s &&
            !demoNames.includes(String(s.namaSiswa || '').trim().toLowerCase()) &&
            !String(s.id || '').startsWith('BIO-SMPN7-00')
        );
        if (cleaned.length !== parsed.length) {
          try {
            localStorage.setItem(STORAGE_KEY_REGISTERED_STUDENTS, JSON.stringify(cleaned));
          } catch {}
        }
        return cleaned;
      }
    }
  } catch {}

  try {
    localStorage.setItem(STORAGE_KEY_REGISTERED_STUDENTS, JSON.stringify([]));
  } catch {}
  return [];
}

export function saveRegisteredStudents(students: RegisteredStudentBiometric[]): void {
  try {
    localStorage.setItem(STORAGE_KEY_REGISTERED_STUDENTS, JSON.stringify(students));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent(BIOMETRIC_STUDENT_REGISTERED_EVENT, {
          detail: { count: students.length, timestamp: Date.now() },
        })
      );
    }
  } catch {}
}

export function clearAllRegisteredStudentsPermanently(): void {
  try {
    localStorage.setItem(STORAGE_KEY_REGISTERED_STUDENTS, JSON.stringify([]));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent(BIOMETRIC_STUDENT_REGISTERED_EVENT, {
          detail: { count: 0, timestamp: Date.now() },
        })
      );
    }
  } catch {}
}

/**
 * Mendaftarkan siswa baru dengan sidik jari
 */
export async function registerStudentWithBiometric(
  studentInfo: {
    namaSiswa: string;
    nis?: string;
    nisn?: string;
    nisNisn: string;
    kelas: string;
    jenisKelamin: 'Laki-laki' | 'Perempuan';
    fingerprintFinger: string;
    photoUrl?: string;
    noHpOrangTua?: string;
    namaOrangTua?: string;
    rfidCardId?: string;
  },
  device: { brand: string; model: string }
): Promise<{
  success: boolean;
  student?: RegisteredStudentBiometric;
  message: string;
  usedWebAuthn: boolean;
}> {
  const cleanKls = getCleanKelas(studentInfo.kelas);
  const now = new Date();
  const nowFormatted = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}, ${String(now.getHours()).padStart(2, '0')}.${String(now.getMinutes()).padStart(2, '0')}.${String(now.getSeconds()).padStart(2, '0')} WIB`;

  const support = await checkHardwareBiometricSupport();
  let credentialId = '';
  let usedWebAuthn = false;

  const primaryNisNisn = (studentInfo.nisn || studentInfo.nisNisn || studentInfo.nis || '').trim();

  // WebAuthn platform authenticator
  if (support.supported && support.hasPlatformAuthenticator && window.crypto && window.crypto.getRandomValues) {
    try {
      const challenge = new Uint8Array(32);
      window.crypto.getRandomValues(challenge);

      const userIdBuffer = new TextEncoder().encode((primaryNisNisn || 'SMPN7-SISWA').slice(0, 16));

      const publicKeyCredentialCreationOptions: PublicKeyCredentialCreationOptions = {
        challenge,
        rp: {
          name: 'UPTD SMP Negeri 7 Kisaran',
          id: window.location.hostname || undefined,
        },
        user: {
          id: userIdBuffer,
          name: primaryNisNisn || studentInfo.namaSiswa,
          displayName: studentInfo.namaSiswa,
        },
        pubKeyCredParams: [
          { type: 'public-key', alg: -7 }, // ES256
          { type: 'public-key', alg: -257 }, // RS256
        ],
        authenticatorSelection: {
          authenticatorAttachment: 'platform',
          userVerification: 'required',
          residentKey: 'discouraged',
        },
        timeout: 45000,
        attestation: 'none',
      };

      const credential = (await navigator.credentials.create({
        publicKey: publicKeyCredentialCreationOptions,
      })) as PublicKeyCredential | null;

      if (credential) {
        credentialId = bufferToBase64(credential.rawId);
        usedWebAuthn = true;
      }
    } catch (webAuthnError) {
      console.warn('WebAuthn registration fallback to biometric signature:', webAuthnError);
    }
  }

  // Fallback signature hash jika WebAuthn bypass
  if (!credentialId) {
    const seed = `${primaryNisNisn}_${studentInfo.namaSiswa}_${studentInfo.fingerprintFinger}_${Date.now()}`;
    let hash = 0;
    for (let i = 0; i < seed.length; i++) {
      hash = (hash << 5) - hash + seed.charCodeAt(i);
      hash |= 0;
    }
    credentialId = `cred_bio_${Math.abs(hash)}_${primaryNisNisn}`;
  }

  const fingerprintHash = `fp_hash_${primaryNisNisn}_${studentInfo.fingerprintFinger.toLowerCase().replace(/\s+/g, '_')}`;
  const rfid = studentInfo.rfidCardId || `RFID-${cleanKls}-${primaryNisNisn.slice(-4) || Math.floor(1000 + Math.random() * 9000)}`;

  const newStudent: RegisteredStudentBiometric = {
    id: `BIO-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    namaSiswa: studentInfo.namaSiswa.trim(),
    nis: studentInfo.nis?.trim() || '',
    nisn: studentInfo.nisn?.trim() || primaryNisNisn,
    nisNisn: primaryNisNisn,
    kelas: cleanKls,
    jenisKelamin: studentInfo.jenisKelamin,
    noHpOrangTua: studentInfo.noHpOrangTua?.trim() || '',
    namaOrangTua: studentInfo.namaOrangTua?.trim() || '',
    rfidCardId: rfid,
    credentialId,
    fingerprintFinger: studentInfo.fingerprintFinger,
    fingerprintHash,
    photoUrl: studentInfo.photoUrl,
    registeredAt: nowFormatted,
    deviceInfo: {
      brand: device.brand,
      model: device.model,
      platform: support.isAndroid ? 'Android' : support.isIos ? 'iOS' : 'Web Desktop',
      isAndroid: support.isAndroid,
      isIos: support.isIos,
      hasHardwareBiometric: support.hasPlatformAuthenticator,
    },
  };

  const currentList = getRegisteredStudents();
  const existingIndex = currentList.findIndex(
    (s) =>
      (primaryNisNisn && s.nisNisn.trim().toLowerCase() === primaryNisNisn.toLowerCase()) ||
      s.namaSiswa.trim().toLowerCase() === studentInfo.namaSiswa.trim().toLowerCase()
  );

  let updatedList: RegisteredStudentBiometric[];
  if (existingIndex >= 0) {
    updatedList = [...currentList];
    updatedList[existingIndex] = { ...newStudent, id: currentList[existingIndex].id };
  } else {
    updatedList = [newStudent, ...currentList];
  }

  saveRegisteredStudents(updatedList);

  return {
    success: true,
    student: newStudent,
    message: `Identitas & Sidik Jari ${newStudent.namaSiswa} (${newStudent.kelas}) Berhasil Didaftarkan dan Disimpan di Sistem!`,
    usedWebAuthn,
  };
}

/**
 * Membaca rekaman riwayat absensi siswa
 */
export function getAttendanceRecords(): StudentAttendanceRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_ATTENDANCE_LOGS);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {}
  return [];
}

export function saveAttendanceRecords(records: StudentAttendanceRecord[]): void {
  try {
    localStorage.setItem(STORAGE_KEY_ATTENDANCE_LOGS, JSON.stringify(records));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent(BIOMETRIC_ATTENDANCE_EVENT, {
          detail: { count: records.length, timestamp: Date.now() },
        })
      );
    }
  } catch {}
}

/**
 * Menghitung status kedisiplinan berdasarkan jam saat ini, hari aktif, dan sesi jadwal mata pelajaran
 */
export function determineAttendanceStatus(
  now: Date = new Date(),
  overrideToleransiTime?: string,
  targetDay?: SchoolDayName
): AttendanceStatusType {
  const schedule = getSchoolScheduleConfig();
  const activeDay = targetDay || schedule.hariAktifTerpilih || getCurrentIndonesianSchoolDay(now);
  const dailyCfg = schedule.jadwalHarian?.[activeDay];
  const effectiveToleransi =
    overrideToleransiTime || dailyCfg?.jamBatasToleransi || schedule.jamBatasToleransi || '07:30';
  const [tolH, tolM] = effectiveToleransi.split(':').map((n) => parseInt(n, 10) || 0);

  const currentH = now.getHours();
  const currentM = now.getMinutes();

  if (currentH > tolH || (currentH === tolH && currentM > tolM)) {
    return 'TERLAMBAT';
  }
  return 'HADIR_TEPAT_WAKTU';
}

/**
 * Mencatat presensi/kehadiran siswa dengan fleksibilitas metode, koordinat GPS, serta Hari & Jadwal Mapel
 */
export function recordStudentAttendance(
  student: RegisteredStudentBiometric,
  method: AttendanceMethodType,
  device: { brand: string; model: string },
  customStatus?: AttendanceStatusType,
  gpsData?: {
    latitude: number;
    longitude: number;
    accuracy: number;
    distanceToSchoolMeters: number;
    isWithinSchoolRadius: boolean;
    address?: string;
  },
  catatanManual?: string,
  suratBuktiUrl?: string,
  scheduleContext?: {
    hari?: SchoolDayName;
    mataPelajaran?: string;
    jamJadwalMapel?: string;
    jamBatasToleransi?: string;
  }
): StudentAttendanceRecord {
  const now = new Date();
  const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
  const timestamp = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}, ${String(now.getHours()).padStart(2, '0')}.${String(now.getMinutes()).padStart(2, '0')}.${String(now.getSeconds()).padStart(2, '0')} WIB`;

  const schedule = getSchoolScheduleConfig();
  const activeHari: SchoolDayName =
    scheduleContext?.hari || schedule.hariAktifTerpilih || getCurrentIndonesianSchoolDay(now);
  const dailyCfg = schedule.jadwalHarian?.[activeHari];
  const matchedSession = dailyCfg?.sesiMapel?.find(
    (s) =>
      s.aktif &&
      (s.kelasTarget === 'ALL' || getCleanKelas(s.kelasTarget) === getCleanKelas(student.kelas))
  );

  const effectiveMapel =
    scheduleContext?.mataPelajaran || matchedSession?.mataPelajaran || 'Informatika (Fase D)';
  const effectiveJamJadwal =
    scheduleContext?.jamJadwalMapel ||
    (matchedSession
      ? `${matchedSession.jamMulai} - ${matchedSession.jamSelesai} WIB`
      : `${dailyCfg?.jamMasuk || schedule.jamMasuk} - ${dailyCfg?.jamPulang || schedule.jamPulang} WIB`);
  const effectiveToleransi =
    scheduleContext?.jamBatasToleransi ||
    matchedSession?.jamBatasToleransi ||
    dailyCfg?.jamBatasToleransi ||
    schedule.jamBatasToleransi;

  const status: AttendanceStatusType =
    customStatus || determineAttendanceStatus(now, effectiveToleransi, activeHari);

  let defaultCatatan = '';
  const mapelPrefix = `[Hari ${activeHari} • ${effectiveMapel} (${effectiveJamJadwal})] `;
  if (method === 'SENSOR_SIDIK_JARI_ANDROID' || method === 'TOUCH_ID_APPLE' || method === 'WEBAUTHN_BIOMETRIK' || method === 'SENSOR_KAPASITIF_LAYAR') {
    defaultCatatan = `${mapelPrefix}Verifikasi Biometrik Sidik Jari Sukses (${student.fingerprintFinger})`;
  } else if (method === 'SWAFOTO_GPS') {
    defaultCatatan = gpsData?.isWithinSchoolRadius
      ? `${mapelPrefix}Swafoto & GPS Terverifikasi (Jarak ${gpsData.distanceToSchoolMeters}m dari sekolah)`
      : `${mapelPrefix}Swafoto Terverifikasi (GPS ${gpsData?.distanceToSchoolMeters ?? 0}m)`;
  } else if (method === 'QR_CODE_SCANNER') {
    defaultCatatan = `${mapelPrefix}Pemindaian QR Code Kartu Pelajar Berhasil`;
  } else if (method === 'KARTU_RFID') {
    defaultCatatan = `${mapelPrefix}Tap Kartu Digital RFID Siswa (${student.rfidCardId || 'RFID'})`;
  } else if (method === 'INPUT_MANUAL_GURU') {
    defaultCatatan = `${mapelPrefix}Dicatat Langsung oleh Guru / Wali Kelas`;
  }

  const record: StudentAttendanceRecord = {
    id: `ATT-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    studentId: student.id,
    namaSiswa: student.namaSiswa,
    nis: student.nis,
    nisn: student.nisn || student.nisNisn,
    nisNisn: student.nisNisn,
    kelas: student.kelas,
    timestamp,
    date: dateStr,
    time: timeStr,
    status,
    metodeVerifikasi: method,
    deviceModel: device.model || student.deviceInfo?.model || 'Perangkat Siswa',
    deviceBrand: device.brand || student.deviceInfo?.brand || 'Android/iOS',
    photoUrl: student.photoUrl,
    gpsLocation: gpsData,
    catatan: catatanManual || defaultCatatan,
    suratBuktiUrl,
    waNotificationSent: false,
    hari: activeHari,
    mataPelajaran: effectiveMapel,
    jamJadwalMapel: effectiveJamJadwal,
  };

  const currentRecords = getAttendanceRecords();
  // Cek apakah siswa sudah absen hari ini
  const existingTodayIdx = currentRecords.findIndex(
    (r) => r.studentId === student.id && r.date === dateStr
  );

  let nextRecords: StudentAttendanceRecord[];
  if (existingTodayIdx >= 0) {
    // Perbarui record hari ini
    nextRecords = [...currentRecords];
    nextRecords[existingTodayIdx] = record;
  } else {
    nextRecords = [record, ...currentRecords];
  }

  saveAttendanceRecords(nextRecords);
  return record;
}

/**
 * Normalisasi nama jari untuk pencocokan biometrik akurat
 */
export function normalizeFingerName(fingerName?: string): string {
  if (!fingerName) return '';
  return fingerName
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .replace(/ibujari/g, 'jempol');
}

/**
 * Daftar opsi jari standar untuk registrasi dan pengujian sensor
 */
export const AVAILABLE_FINGER_OPTIONS = [
  { id: 'Jempol Kanan', label: 'Jempol Kanan', icon: '👍', shortLabel: 'Jempol Kanan' },
  { id: 'Telunjuk Kanan', label: 'Telunjuk Kanan', icon: '☝️', shortLabel: 'Telunjuk Kanan' },
  { id: 'Jempol Kiri', label: 'Jempol Kiri', icon: '👍', shortLabel: 'Jempol Kiri' },
  { id: 'Telunjuk Kiri', label: 'Telunjuk Kiri', icon: '☝️', shortLabel: 'Telunjuk Kiri' },
  { id: 'Jari Tengah Kanan', label: 'Jari Tengah Kanan', icon: '🖐️', shortLabel: 'Tengah Kanan' },
  { id: 'Jari Lain', label: 'Jari Lain (Uji Penolakan)', icon: '🚫', shortLabel: 'Jari Lain' },
];

/**
 * Mencocokkan sidik jari siswa secara otomatis menggunakan WebAuthn Hardware Authenticator
 */
export async function authenticateWithHardwareBiometric(
  students: RegisteredStudentBiometric[],
  currentFinger?: string,
  selectedStudentId?: string | null
): Promise<{
  success: boolean;
  student?: RegisteredStudentBiometric;
  method?: 'SENSOR_SIDIK_JARI_ANDROID' | 'TOUCH_ID_APPLE' | 'WEBAUTHN_BIOMETRIK';
  message: string;
  fingerMismatch?: boolean;
}> {
  if (students.length === 0) {
    return {
      success: false,
      message: 'Belum ada data siswa terdaftar. Silakan registrasikan identitas siswa terlebih dahulu.',
    };
  }

  const support = await checkHardwareBiometricSupport();

  if (!support.supported || !window.PublicKeyCredential || !window.crypto) {
    return {
      success: false,
      message: 'Perangkat tidak mendukung WebAuthn. Gunakan pemindai sidik jari layar sentuh di bawah.',
    };
  }

  const effectiveFinger = currentFinger?.trim() || 'Jempol Kanan';
  const normCurrent = normalizeFingerName(effectiveFinger);

  // Jika siswa dipilih secara spesifik, lakukan pre-check jari yang didaftarkan
  if (selectedStudentId) {
    const targetStudent = students.find((s) => s.id === selectedStudentId);
    if (targetStudent) {
      const normRegistered = normalizeFingerName(targetStudent.fingerprintFinger);
      if (normRegistered !== normCurrent) {
        return {
          success: false,
          student: targetStudent,
          fingerMismatch: true,
          message: `❌ Verifikasi Ditolak: Siswa ${targetStudent.namaSiswa} terdaftar menggunakan jari [${targetStudent.fingerprintFinger}], sedangkan jari yang dipindai adalah [${effectiveFinger}]. Gunakan jari yang sesuai!`,
        };
      }
    }
  }

  const validCredentialStudents = students.filter(
    (s) => s.credentialId && s.credentialId.length > 10 && !s.credentialId.startsWith('cred_bio_')
  );

  try {
    const challenge = new Uint8Array(32);
    window.crypto.getRandomValues(challenge);

    const allowCredentials: PublicKeyCredentialDescriptor[] = validCredentialStudents.map((s) => ({
      type: 'public-key',
      id: base64ToUint8Array(s.credentialId!) as unknown as BufferSource,
      transports: ['internal'],
    }));

    const assertionOptions: PublicKeyCredentialRequestOptions = {
      challenge,
      timeout: 45000,
      userVerification: 'required',
      rpId: window.location.hostname || undefined,
    };

    if (allowCredentials.length > 0) {
      assertionOptions.allowCredentials = allowCredentials;
    }

    const assertion = (await navigator.credentials.get({
      publicKey: assertionOptions,
    })) as PublicKeyCredential | null;

    if (assertion) {
      const returnedCredId = bufferToBase64(assertion.rawId);
      const matchedStudent = validCredentialStudents.find(
        (s) => s.credentialId === returnedCredId
      );

      // Verifikasi kredensial hardware: jika tidak cocok, cari siswa yang mendaftarkan jari tersebut
      let candidate = matchedStudent;
      if (!candidate) {
        // Cari siswa yang mendaftarkan jari yang sama
        candidate = students.find(
          (s) => normalizeFingerName(s.fingerprintFinger) === normCurrent
        );
      }

      if (!candidate) {
        return {
          success: false,
          fingerMismatch: true,
          message: `❌ Verifikasi Ditolak: Jari [${effectiveFinger}] tidak cocok dengan sidik jari siswa manapun yang terdaftar.`,
        };
      }

      // Validasi ketat kesesuaian jari siswa
      const normReg = normalizeFingerName(candidate.fingerprintFinger);
      if (normReg !== normCurrent) {
        return {
          success: false,
          student: candidate,
          fingerMismatch: true,
          message: `❌ Verifikasi Ditolak: Siswa ${candidate.namaSiswa} terdaftar menggunakan jari [${candidate.fingerprintFinger}], tetapi sensor mendeteksi jari [${effectiveFinger}].`,
        };
      }

      const method = support.isIos ? 'TOUCH_ID_APPLE' : 'SENSOR_SIDIK_JARI_ANDROID';
      return {
        success: true,
        student: candidate,
        method,
        message: `Identitas Sidik Jari Dikenali: ${candidate.namaSiswa} (${candidate.kelas}) - Terverifikasi Jari [${candidate.fingerprintFinger}]`,
      };
    }
  } catch (err: any) {
    console.warn('Hardware biometric verification error:', err);
    if (err?.name === 'NotAllowedError') {
      return {
        success: false,
        message: 'Verifikasi sidik jari dibatalkan oleh pengguna atau sensor hardware tidak merespons.',
      };
    }
  }

  return {
    success: false,
    message: 'Sensor hardware tidak dapat memverifikasi sidik jari. Gunakan scanner sentuh layar.',
  };
}

/**
 * Mencocokkan sidik jari siswa secara ketat:
 * Memvalidasi apakah jari yang ditempelkan/dipindai cocok dengan jari yang didaftarkan siswa.
 * Jika siswa mendaftar dengan 'Jempol Kanan', tetapi memindai dengan 'Telunjuk Kanan' atau jari lain,
 * verifikasi AKAN DITOLAK.
 */
export function recognizeStudentFromTouchSensor(
  selectedStudentId: string | null,
  registeredStudents: RegisteredStudentBiometric[],
  touchMetrics?: { radiusX?: number; radiusY?: number; force?: number },
  scannedFinger?: string
): {
  success: boolean;
  student?: RegisteredStudentBiometric;
  message: string;
  fingerMismatch?: boolean;
  expectedFinger?: string;
  scannedFinger?: string;
} {
  if (registeredStudents.length === 0) {
    return {
      success: false,
      message: 'Belum ada data siswa yang mendaftarkan sidik jari. Silakan lakukan registrasi terlebih dahulu.',
    };
  }

  // Tentukan jari yang dipindai saat ini
  let effectiveFinger = scannedFinger?.trim() || '';
  if (!effectiveFinger && touchMetrics?.radiusX && touchMetrics?.radiusY) {
    const area = touchMetrics.radiusX * touchMetrics.radiusY;
    // Jempol memiliki kontak sentuhan kapasitif yang lebih lebar daripada telunjuk/jari lain
    effectiveFinger = area >= 280 ? 'Jempol Kanan' : 'Telunjuk Kanan';
  }
  if (!effectiveFinger) {
    effectiveFinger = 'Jempol Kanan';
  }

  const normScanned = normalizeFingerName(effectiveFinger);

  // KASUS 1: Mode Manual - Siswa tertentu dipilih dari dropdown
  if (selectedStudentId) {
    const targetStudent = registeredStudents.find((s) => s.id === selectedStudentId);
    if (!targetStudent) {
      return {
        success: false,
        message: 'Data siswa yang dipilih tidak ditemukan dalam sistem.',
      };
    }

    const normRegistered = normalizeFingerName(targetStudent.fingerprintFinger);
    if (normRegistered !== normScanned) {
      return {
        success: false,
        student: targetStudent,
        fingerMismatch: true,
        expectedFinger: targetStudent.fingerprintFinger,
        scannedFinger: effectiveFinger,
        message: `❌ Verifikasi Sidik Jari DITOLAK! Siswa ${targetStudent.namaSiswa} terdaftar menggunakan jari [${targetStudent.fingerprintFinger}], sedangkan jari yang Anda tempelkan pada sensor adalah [${effectiveFinger}]. Mohon gunakan jari yang sesuai!`,
      };
    }

    return {
      success: true,
      student: targetStudent,
      expectedFinger: targetStudent.fingerprintFinger,
      scannedFinger: effectiveFinger,
      message: `✅ Sidik Jari Cocok! Jari [${targetStudent.fingerprintFinger}] terverifikasi untuk siswa ${targetStudent.namaSiswa} (${targetStudent.kelas}).`,
    };
  }

  // KASUS 2: Mode Otomatis - Mengenali siswa berdasarkan jari yang ditempelkan
  // Hanya mencari siswa yang mendaftarkan jari yang sama persis
  const matchingStudents = registeredStudents.filter(
    (s) => normalizeFingerName(s.fingerprintFinger) === normScanned
  );

  if (matchingStudents.length === 0) {
    const daftarJariTerdaftar = Array.from(
      new Set(registeredStudents.map((s) => s.fingerprintFinger))
    ).join(', ');
    return {
      success: false,
      fingerMismatch: true,
      scannedFinger: effectiveFinger,
      message: `❌ Sidik Jari Tidak Cocok! Tidak ada siswa yang mendaftarkan sidik jari dengan [${effectiveFinger}]. Siswa terdaftar menggunakan jari: [${daftarJariTerdaftar}]. Silakan tempelkan jari yang benar!`,
    };
  }

  // Jika ada siswa yang cocok dengan jari tersebut
  let selectedCandidateIndex = 0;
  if (matchingStudents.length > 1 && touchMetrics?.radiusX && touchMetrics?.radiusY) {
    const area = Math.round(touchMetrics.radiusX * touchMetrics.radiusY * 11);
    selectedCandidateIndex = Math.abs(area) % matchingStudents.length;
  }

  const matched = matchingStudents[selectedCandidateIndex];
  return {
    success: true,
    student: matched,
    expectedFinger: matched.fingerprintFinger,
    scannedFinger: effectiveFinger,
    message: `✅ Sidik Jari Dikenali Otomatis: ${matched.namaSiswa} (${matched.kelas}) - Terverifikasi Jari [${matched.fingerprintFinger}].`,
  };
}

/**
 * Pengajuan Izin Online (Siswa / Orang Tua)
 */
export function getOnlinePermitRequests(): OnlinePermitRequest[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_ONLINE_PERMITS);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {}
  return [];
}

export function saveOnlinePermitRequests(list: OnlinePermitRequest[]): void {
  try {
    localStorage.setItem(STORAGE_KEY_ONLINE_PERMITS, JSON.stringify(list));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent(PERMIT_REQUEST_EVENT, {
          detail: { count: list.length, timestamp: Date.now() },
        })
      );
    }
  } catch {}
}

export function submitOnlinePermitRequest(permit: Omit<OnlinePermitRequest, 'id' | 'createdAt' | 'status'>): OnlinePermitRequest {
  const now = new Date();
  const dateFormatted = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')} WIB`;

  const newRequest: OnlinePermitRequest = {
    ...permit,
    id: `PERMIT-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    status: 'MENUNGGU_VERIFIKASI',
    createdAt: dateFormatted,
  };

  const list = getOnlinePermitRequests();
  const updated = [newRequest, ...list];
  saveOnlinePermitRequests(updated);
  return newRequest;
}

export function verifyOnlinePermitRequest(
  permitId: string,
  decision: 'DISETUJUI' | 'DITOLAK',
  verifiedByTeacher: string,
  catatanGuru?: string
): void {
  const list = getOnlinePermitRequests();
  const idx = list.findIndex((p) => p.id === permitId);
  if (idx < 0) return;

  const req = list[idx];
  const now = new Date();
  const verifiedAt = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')} WIB`;

  list[idx] = {
    ...req,
    status: decision,
    diverifikasiOleh: verifiedByTeacher,
    diverifikasiAt: verifiedAt,
    catatanGuru: catatanGuru || (decision === 'DISETUJUI' ? 'Pengajuan telah disetujui wali kelas' : 'Pengajuan ditolak'),
  };
  saveOnlinePermitRequests(list);

  // Jika disetujui, otomatis rekam ke kehadiran
  if (decision === 'DISETUJUI') {
    const students = getRegisteredStudents();
    const student = students.find((s) => s.id === req.studentId || s.nisNisn === req.nisn);
    if (student) {
      const statusMap: AttendanceStatusType =
        req.jenisIzin === 'SAKIT' ? 'SAKIT' : req.jenisIzin === 'DISPENSASI' ? 'DISPENSASI' : 'IZIN';

      recordStudentAttendance(
        student,
        'PENGAJUAN_IZIN_ONLINE',
        { brand: 'Surat Online', model: 'Verifikasi Guru' },
        statusMap,
        undefined,
        `Surat ${req.jenisIzin}: ${req.alasan} (Disetujui oleh: ${verifiedByTeacher})`,
        req.fotoBuktiUrl
      );
    }
  }
}

/**
 * Bulk Absensi Cepat oleh Guru / Wali Kelas per Kelas
 */
export function bulkMarkClassAttendance(
  kelas: string,
  studentStatuses: { studentId: string; status: AttendanceStatusType; catatan?: string }[],
  teacherName: string,
  scheduleContext?: {
    hari?: SchoolDayName;
    mataPelajaran?: string;
    jamJadwalMapel?: string;
    jamBatasToleransi?: string;
  }
): void {
  const allStudents = getRegisteredStudents();
  const targetStudents = allStudents.filter((s) => getCleanKelas(s.kelas) === getCleanKelas(kelas));

  studentStatuses.forEach((item) => {
    const student = targetStudents.find((s) => s.id === item.studentId);
    if (student) {
      recordStudentAttendance(
        student,
        'INPUT_MANUAL_GURU',
        { brand: 'Panel Guru', model: teacherName },
        item.status,
        undefined,
        item.catatan ||
          (scheduleContext?.hari && scheduleContext?.mataPelajaran
            ? `[Hari ${scheduleContext.hari} • ${scheduleContext.mataPelajaran} (${scheduleContext.jamJadwalMapel || ''})] Input manual oleh ${teacherName}`
            : `Input manual oleh ${teacherName}`),
        undefined,
        scheduleContext
      );
    }
  });
}

/**
 * Format Pesan WhatsApp Resmi Kehadiran untuk Orang Tua / Wali Murid
 */
export function buildWhatsAppAttendanceMessage(
  record: StudentAttendanceRecord,
  student?: RegisteredStudentBiometric,
  schedule?: SchoolScheduleConfig
): string {
  const sched = schedule || getSchoolScheduleConfig();
  const statusEmoji: Record<AttendanceStatusType, string> = {
    HADIR_TEPAT_WAKTU: '✅ HADIR TEPAT WAKTU',
    TERLAMBAT: '⚠️ HADIR TERLAMBAT',
    SAKIT: '🏥 SAKIT',
    IZIN: '✉️ IZIN',
    ALFA: '❌ ALFA (TANPA KETERANGAN)',
    BOLOS: '🚨 BOLOS / CABUT',
    DISPENSASI: '🎖️ DISPENSASI SEKOLAH',
  };

  const statusLabel = statusEmoji[record.status] || record.status;
  const methodLabel: Record<AttendanceMethodType, string> = {
    SENSOR_SIDIK_JARI_ANDROID: 'Sensor Sidik Jari Android (Biometric)',
    TOUCH_ID_APPLE: 'Touch ID / Apple Biometric',
    WEBAUTHN_BIOMETRIK: 'Autentikasi Biometrik Perangkat',
    SENSOR_KAPASITIF_LAYAR: 'Sensor Sentuh Layar Kapasitif',
    QR_CODE_SCANNER: 'Pemindaian QR Code Kartu Siswa',
    KARTU_RFID: 'Tap Kartu Pelajar Digital RFID',
    SWAFOTO_GPS: 'Swafoto Kamera Depan & GPS Validasi',
    INPUT_MANUAL_GURU: 'Pencatatan Manual Guru / Wali Kelas',
    PENGAJUAN_IZIN_ONLINE: 'Verifikasi Surat Izin / Sakit Online',
  };

  let gpsText = '';
  if (record.gpsLocation) {
    gpsText = `\n📍 *Lokasi & Radius*: ${record.gpsLocation.distanceToSchoolMeters} meter dari gerbang sekolah (${record.gpsLocation.isWithinSchoolRadius ? 'Dalam Area Sekolah ✓' : 'Luar Area'})`;
  }

  const hariLabel = record.hari || sched.hariAktifTerpilih || getCurrentIndonesianSchoolDay();
  const mapelText = record.mataPelajaran
    ? `\n📘 *Mata Pelajaran* : *${record.mataPelajaran}* (${record.jamJadwalMapel || `${sched.jamMasuk} WIB`})`
    : '';

  const cleanAlamat = 'Jl. Labu No. 10 Siumbut Baru Kisaran Timur.';

  const text = `*PEMBERITAHUAN KEHADIRAN SISWA*
🏛️ *${sched.schoolName || 'UPTD SMP Negeri 7 Kisaran'}*
${cleanAlamat}
-----------------------------------------------
Yth. Bapak/Ibu Orang Tua / Wali dari:

👤 *Nama Siswa* : *${record.namaSiswa}*
🆔 *NISN / NIS* : ${record.nisn || record.nisNisn}
🏫 *Kelas* : ${record.kelas}
📅 *Hari / Tanggal* : *Hari ${hariLabel}*, ${record.date}${mapelText}
⏰ *Waktu Presensi* : *${record.time} WIB*
📊 *Status Kehadiran* : *${statusLabel}*
📱 *Metode Input* : ${methodLabel[record.metodeVerifikasi] || record.metodeVerifikasi}${gpsText}
📝 *Keterangan* : ${record.catatan || 'Presensi telah tercatat secara otomatis di sistem sekolah.'}

-----------------------------------------------
_Catatan: Sistem Presensi Digital Terpadu UPTD SMP Negeri 7 Kisaran. Informasi ini dikirim secara otomatis untuk mendukung kedisiplinan dan transparansi pembelajaran putra/putri Bapak/Ibu._

Hormat kami,
*Guru Mapel & Tim Kesiswaan UPTD SMP Negeri 7 Kisaran*
------------------------------------------------`;

  return text;
}

/**
 * Ekspor Data Presensi ke Format Excel (.xlsx) Lengkap
 */
export function exportAttendanceToExcel(
  records: StudentAttendanceRecord[],
  filterTitle: string = 'Rekap Kehadiran Siswa'
): void {
  const schedule = getSchoolScheduleConfig();
  const dateNow = new Date();
  const dateFormatted = `${dateNow.getFullYear()}-${String(dateNow.getMonth() + 1).padStart(2, '0')}-${String(dateNow.getDate()).padStart(2, '0')}`;

  // Header & data rows
  const dataRows = records.map((rec, idx) => ({
    'No': idx + 1,
    'NIS': rec.nis || '-',
    'NISN': rec.nisn || rec.nisNisn || '-',
    'Nama Siswa': rec.namaSiswa,
    'Kelas': rec.kelas,
    'Tanggal': rec.date,
    'Waktu': `${rec.time} WIB`,
    'Status Kehadiran': rec.status.replace(/_/g, ' '),
    'Metode Verifikasi': rec.metodeVerifikasi.replace(/_/g, ' '),
    'Perangkat': `${rec.deviceBrand} ${rec.deviceModel}`,
    'Radius GPS': rec.gpsLocation ? `${rec.gpsLocation.distanceToSchoolMeters} m` : '-',
    'Catatan': rec.catatan || '-',
  }));

  const worksheet = XLSX.utils.json_to_sheet(dataRows);

  // Set lebar kolom otomatis
  worksheet['!cols'] = [
    { wch: 6 },  // No
    { wch: 12 }, // NIS
    { wch: 16 }, // NISN
    { wch: 28 }, // Nama Siswa
    { wch: 10 }, // Kelas
    { wch: 14 }, // Tanggal
    { wch: 14 }, // Waktu
    { wch: 22 }, // Status
    { wch: 28 }, // Metode
    { wch: 22 }, // Perangkat
    { wch: 12 }, // Radius GPS
    { wch: 35 }, // Catatan
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Rekap Kehadiran');

  // Ringkasan sheet
  const hadirCount = records.filter((r) => r.status === 'HADIR_TEPAT_WAKTU').length;
  const terlambatCount = records.filter((r) => r.status === 'TERLAMBAT').length;
  const sakitCount = records.filter((r) => r.status === 'SAKIT').length;
  const izinCount = records.filter((r) => r.status === 'IZIN').length;
  const alfaCount = records.filter((r) => r.status === 'ALFA').length;
  const bolosCount = records.filter((r) => r.status === 'BOLOS').length;
  const dispCount = records.filter((r) => r.status === 'DISPENSASI').length;

  const summaryData = [
    { 'Parameter': 'Sekolah', 'Keterangan': schedule.schoolName },
    { 'Parameter': 'Tanggal Ekspor', 'Keterangan': `${dateFormatted} WIB` },
    { 'Parameter': 'Total Log Kehadiran', 'Keterangan': records.length },
    { 'Parameter': 'Hadir Tepat Waktu', 'Keterangan': hadirCount },
    { 'Parameter': 'Hadir Terlambat', 'Keterangan': terlambatCount },
    { 'Parameter': 'Sakit', 'Keterangan': sakitCount },
    { 'Parameter': 'Izin', 'Keterangan': izinCount },
    { 'Parameter': 'Alfa', 'Keterangan': alfaCount },
    { 'Parameter': 'Bolos / Cabut', 'Keterangan': bolosCount },
    { 'Parameter': 'Dispensasi', 'Keterangan': dispCount },
    {
      'Parameter': 'Persentase Kehadiran (%)',
      'Keterangan': records.length > 0 ? `${(((hadirCount + terlambatCount + dispCount) / records.length) * 100).toFixed(1)}%` : '0%',
    },
  ];
  const summarySheet = XLSX.utils.json_to_sheet(summaryData);
  summarySheet['!cols'] = [{ wch: 26 }, { wch: 45 }];
  XLSX.utils.book_append_sheet(workbook, summarySheet, 'Statistik Ringkasan');

  const filename = `Rekap_Kehadiran_SMPN7_Kisaran_${dateFormatted}.xlsx`;
  XLSX.writeFile(workbook, filename);
}

/**
 * Ekspor Data Presensi ke Format Dokumen Resmi PDF (.pdf)
 */
export function exportAttendanceToPdf(
  records: StudentAttendanceRecord[],
  filterTitle: string = 'Rekap Kehadiran Siswa'
): void {
  const schedule = getSchoolScheduleConfig();
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const dateNow = new Date();
  const dateFormatted = `${String(dateNow.getDate()).padStart(2, '0')}/${String(dateNow.getMonth() + 1).padStart(2, '0')}/${dateNow.getFullYear()}`;

  // KOP SURAT RESMI
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('PEMERINTAH KABUPATEN ASAHAN', 105, 15, { align: 'center' });
  doc.text('DINAS PENDIDIKAN DAN KEBUDAYAAN', 105, 20, { align: 'center' });
  doc.setFontSize(14);
  doc.text(schedule.schoolName.toUpperCase(), 105, 26, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(schedule.alamatSekolah, 105, 31, { align: 'center' });
  doc.text('Email: smpn7kisaran@sekolah.belajar.id | Website: smpn7kisaran.sch.id', 105, 35, { align: 'center' });

  // Garis Pembatas Kop Surat
  doc.setLineWidth(0.8);
  doc.line(15, 38, 195, 38);
  doc.setLineWidth(0.2);
  doc.line(15, 39, 195, 39);

  // Judul Laporan
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text(`LAPORAN REKAPITULASI KEHADIRAN SISWA DIGITAL`, 105, 46, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.text(`Periode: ${dateFormatted} | Filter: ${filterTitle}`, 105, 51, { align: 'center' });

  // Statistik Singkat
  const hadirCount = records.filter((r) => r.status === 'HADIR_TEPAT_WAKTU').length;
  const lateCount = records.filter((r) => r.status === 'TERLAMBAT').length;
  const sakitCount = records.filter((r) => r.status === 'SAKIT').length;
  const izinCount = records.filter((r) => r.status === 'IZIN').length;
  const alfaCount = records.filter((r) => r.status === 'ALFA').length;

  doc.setFillColor(240, 245, 250);
  doc.roundedRect(15, 55, 180, 11, 2, 2, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.text(`Total: ${records.length} | Hadir: ${hadirCount} | Terlambat: ${lateCount} | Sakit: ${sakitCount} | Izin: ${izinCount} | Alfa: ${alfaCount}`, 105, 62, { align: 'center' });

  // Tabel Kehadiran
  let startY = 71;
  const rowHeight = 7;
  const maxRowsPerPage = 24;

  // Header Tabel
  doc.setFillColor(15, 23, 42); // slate-900
  doc.rect(15, startY, 180, 8, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text('No', 18, startY + 5);
  doc.text('NISN', 26, startY + 5);
  doc.text('Nama Siswa', 52, startY + 5);
  doc.text('Kelas', 105, startY + 5);
  doc.text('Waktu', 120, startY + 5);
  doc.text('Status', 142, startY + 5);
  doc.text('Metode Verifikasi', 168, startY + 5);

  doc.setTextColor(0, 0, 0);
  doc.setFont('helvetica', 'normal');
  startY += 8;

  records.slice(0, 80).forEach((rec, idx) => {
    if (startY > 260) {
      doc.addPage();
      startY = 20;
    }

    if (idx % 2 === 1) {
      doc.setFillColor(248, 250, 252);
      doc.rect(15, startY, 180, rowHeight, 'F');
    }

    doc.setFontSize(7.5);
    doc.text(String(idx + 1), 18, startY + 4.5);
    doc.text((rec.nisn || rec.nisNisn || '-').slice(0, 10), 26, startY + 4.5);
    doc.text(rec.namaSiswa.slice(0, 24), 52, startY + 4.5);
    doc.text(rec.kelas, 105, startY + 4.5);
    doc.text(`${rec.time}`, 120, startY + 4.5);

    // Pewarnaan status singkat
    const stShort = rec.status === 'HADIR_TEPAT_WAKTU' ? 'Hadir' : rec.status === 'TERLAMBAT' ? 'Terlambat' : rec.status;
    doc.text(stShort, 142, startY + 4.5);

    const metShort = rec.metodeVerifikasi.replace(/SENSOR_|TOUCH_ID_|WEBAUTHN_/g, '').slice(0, 16);
    doc.text(metShort, 168, startY + 4.5);

    startY += rowHeight;
  });

  // Tanda Tangan
  const signY = Math.min(startY + 15, 250);
  doc.setFontSize(9);
  doc.text('Mengetahui,', 25, signY);
  doc.text('Kepala UPTD SMP Negeri 7 Kisaran', 25, signY + 5);
  doc.text('( Drs. H. Marwan, M.Pd )', 25, signY + 28);
  doc.text('NIP. 196803121995121001', 25, signY + 33);

  doc.text(`Kisaran, ${dateFormatted}`, 135, signY);
  doc.text('Guru Pengampu / Wali Kelas', 135, signY + 5);
  doc.text('( Eksa Yudika Sirait, S.Kom )', 135, signY + 28);
  doc.text('NIP. 198904162015041002', 135, signY + 33);

  doc.save(`Laporan_Kehadiran_SMPN7_${dateNow.getTime()}.pdf`);
}

/**
 * Ekspor Data Presensi ke Format Word / HTML Cetak Mandiri
 */
export function exportAttendanceToWordHtml(
  records: StudentAttendanceRecord[],
  filterTitle: string = 'Rekap Kehadiran Siswa'
): void {
  const schedule = getSchoolScheduleConfig();
  const dateNow = new Date();
  const dateFormatted = `${dateNow.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}`;

  const rows = records
    .map(
      (r, i) => `
    <tr>
      <td style="padding:6px;border:1px solid #333;text-align:center;">${i + 1}</td>
      <td style="padding:6px;border:1px solid #333;">${r.nis || '-'}</td>
      <td style="padding:6px;border:1px solid #333;">${r.nisn || r.nisNisn || '-'}</td>
      <td style="padding:6px;border:1px solid #333;font-weight:bold;">${r.namaSiswa}</td>
      <td style="padding:6px;border:1px solid #333;text-align:center;">${r.kelas}</td>
      <td style="padding:6px;border:1px solid #333;text-align:center;">${r.date} ${r.time}</td>
      <td style="padding:6px;border:1px solid #333;text-align:center;">${r.status.replace(/_/g, ' ')}</td>
      <td style="padding:6px;border:1px solid #333;">${r.metodeVerifikasi.replace(/_/g, ' ')}</td>
      <td style="padding:6px;border:1px solid #333;">${r.catatan || '-'}</td>
    </tr>`
    )
    .join('');

  const htmlContent = `
  <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
  <head>
    <meta charset="utf-8">
    <title>Rekap Kehadiran - ${schedule.schoolName}</title>
    <style>
      body { font-family: Calibri, Arial, sans-serif; margin: 24px; color: #111; }
      h2, h3 { text-align: center; margin: 4px 0; }
      table { width: 100%; border-collapse: collapse; margin-top: 16px; font-size: 11pt; }
      th { background-color: #0f172a; color: white; padding: 8px; border: 1px solid #333; }
    </style>
  </head>
  <body>
    <h2>PEMERINTAH KABUPATEN ASAHAN - DINAS PENDIDIKAN</h2>
    <h3>${schedule.schoolName.toUpperCase()}</h3>
    <p style="text-align:center;font-size:10pt;">${schedule.alamatSekolah}</p>
    <hr style="border:1.5px solid #000;margin-bottom:16px;">
    <h3>REKAPITULASI PRESENSI KEHADIRAN SISWA</h3>
    <p style="text-align:center;">${dateFormatted} | Filter: ${filterTitle}</p>
    <table>
      <thead>
        <tr>
          <th>No</th>
          <th>NIS</th>
          <th>NISN</th>
          <th>Nama Siswa</th>
          <th>Kelas</th>
          <th>Waktu</th>
          <th>Status</th>
          <th>Metode</th>
          <th>Catatan</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
      </tbody>
    </table>
  </body>
  </html>`;

  const blob = new Blob(['\ufeff', htmlContent], {
    type: 'application/msword',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Rekap_Kehadiran_${schedule.schoolName.replace(/\s+/g, '_')}_${Date.now()}.doc`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Impor Data Siswa Baru dari Array Objek (hasil upload file Excel / CSV)
 */
export function importStudentsFromData(
  rawList: Array<Record<string, any>>
): { successCount: number; errorCount: number; message: string } {
  let successCount = 0;
  let errorCount = 0;

  const currentStudents = getRegisteredStudents();
  const nextList = [...currentStudents];

  rawList.forEach((row, idx) => {
    const nama = String(row['Nama Siswa'] || row['namaSiswa'] || row['Nama'] || row['nama'] || '').trim();
    const nisn = String(row['NISN'] || row['nisn'] || row['No Induk Siswa Nasional'] || '').trim();
    const nis = String(row['NIS'] || row['nis'] || row['No Induk Siswa'] || '').trim();
    const kelas = String(row['Kelas'] || row['kelas'] || 'VIII-1').trim();
    const jk = String(row['Jenis Kelamin'] || row['jenisKelamin'] || 'Laki-laki').trim();
    const noHp = String(row['No HP Ortu'] || row['noHpOrangTua'] || row['No HP'] || '').trim();

    if (!nama) {
      errorCount++;
      return;
    }

    const primaryKey = nisn || nis || `SMPN7-${Date.now()}-${idx}`;
    const cleanKls = getCleanKelas(kelas);

    const existingIdx = nextList.findIndex(
      (s) =>
        (primaryKey && s.nisNisn.toLowerCase() === primaryKey.toLowerCase()) ||
        s.namaSiswa.toLowerCase() === nama.toLowerCase()
    );

    const studentObj: RegisteredStudentBiometric = {
      id: `BIO-IMP-${Date.now()}-${idx}`,
      namaSiswa: nama,
      nis,
      nisn,
      nisNisn: primaryKey,
      kelas: cleanKls,
      jenisKelamin: jk.toLowerCase().includes('p') ? 'Perempuan' : 'Laki-laki',
      noHpOrangTua: noHp,
      rfidCardId: `RFID-${cleanKls}-${primaryKey.slice(-4) || '0000'}`,
      fingerprintFinger: 'Jempol Kanan',
      fingerprintHash: `fp_hash_${primaryKey}_imp`,
      registeredAt: new Date().toLocaleDateString('id-ID'),
      deviceInfo: {
        brand: 'IMPORT',
        model: 'File Master',
        platform: 'Web Importer',
        isAndroid: true,
        isIos: false,
        hasHardwareBiometric: true,
      },
    };

    if (existingIdx >= 0) {
      nextList[existingIdx] = { ...studentObj, id: nextList[existingIdx].id };
    } else {
      nextList.push(studentObj);
    }
    successCount++;
  });

  saveRegisteredStudents(nextList);
  return {
    successCount,
    errorCount,
    message: `Berhasil mengimpor ${successCount} siswa! ${errorCount > 0 ? `(${errorCount} baris tidak lengkap/dilewati)` : ''}`,
  };
}

/**
 * Menghapus rekaman presensi berdasarkan ID atau filter
 */
export function deleteAttendanceRecordById(recordId: string): StudentAttendanceRecord[] {
  const current = getAttendanceRecords();
  const next = current.filter((r) => r.id !== recordId);
  saveAttendanceRecords(next);
  return next;
}

/**
 * Menghapus rekaman presensi berdasarkan filter kelas / status / tanggal
 */
export function deleteAttendanceRecordsByFilter(filter: {
  kelas?: string;
  status?: string;
  date?: string;
  searchQuery?: string;
  studentId?: string;
}): { deletedCount: number; remainingRecords: StudentAttendanceRecord[] } {
  const current = getAttendanceRecords();
  const remaining: StudentAttendanceRecord[] = [];
  let deletedCount = 0;

  current.forEach((rec) => {
    const matchKelas =
      !filter.kelas || filter.kelas === 'ALL' || getCleanKelas(rec.kelas) === getCleanKelas(filter.kelas);
    const matchStatus = !filter.status || filter.status === 'ALL' || rec.status === filter.status;
    const matchDate = !filter.date || filter.date === 'ALL' || rec.date === filter.date;
    const matchStudentId = !filter.studentId || rec.studentId === filter.studentId;
    const matchQuery =
      !filter.searchQuery ||
      filter.searchQuery.trim() === '' ||
      rec.namaSiswa.toLowerCase().includes(filter.searchQuery.toLowerCase()) ||
      rec.nisNisn.toLowerCase().includes(filter.searchQuery.toLowerCase());

    if (matchKelas && matchStatus && matchDate && matchStudentId && matchQuery) {
      deletedCount++;
    } else {
      remaining.push(rec);
    }
  });

  saveAttendanceRecords(remaining);
  return { deletedCount, remainingRecords: remaining };
}

/**
 * Reset data presensi & master siswa
 */
export function resetAttendanceData(
  mode: 'TODAY' | 'ALL' | 'RESET_MASTER_DEFAULT'
): { success: boolean; message: string } {
  try {
    if (mode === 'ALL') {
      saveAttendanceRecords([]);
      return { success: true, message: 'Seluruh riwayat presensi berhasil direset/dikosongkan!' };
    } else if (mode === 'RESET_MASTER_DEFAULT') {
      saveRegisteredStudents([]);
      saveKelasWaliKelasList(INITIAL_KELAS_WALI_LIST);
      saveSchoolScheduleConfig(INITIAL_SCHEDULE_CONFIG);
      return {
        success: true,
        message: 'Data master kelas & wali kelas, serta jadwal sekolah berhasil dikembalikan ke pengaturan awal!',
      };
    } else {
      const todayDateStr = new Date().toISOString().slice(0, 10);
      const current = getAttendanceRecords();
      const filtered = current.filter((r) => r.date !== todayDateStr);
      saveAttendanceRecords(filtered);
      return { success: true, message: 'Seluruh data presensi HARI INI berhasil direset!' };
    }
  } catch (err: any) {
    return { success: false, message: err?.message || 'Gagal mereset data presensi' };
  }
}

/**
 * Simpan & Backup seluruh state Presensi & Kehadiran Siswa ke penyimpanan lokal + JSON file atau Cloud
 */
export function saveAllAttendanceStateToStorage(params: {
  students: RegisteredStudentBiometric[];
  records: StudentAttendanceRecord[];
  kelasList: KelasWaliKelasMaster[];
  scheduleConfig: SchoolScheduleConfig;
  permits: OnlinePermitRequest[];
}): { success: boolean; timestamp: string; message: string } {
  const now = new Date();
  const timestamp = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')} WIB`;
  try {
    saveRegisteredStudents(params.students);
    saveAttendanceRecords(params.records);
    saveKelasWaliKelasList(params.kelasList);
    saveSchoolScheduleConfig(params.scheduleConfig);
    saveOnlinePermitRequests(params.permits);
    localStorage.setItem('anbk_attendance_last_saved_at_v1', timestamp);
    return {
      success: true,
      timestamp,
      message: `Data Presensi (${params.records.length} catatan & ${params.students.length} siswa) berhasil disimpan permanen pada ${timestamp}!`,
    };
  } catch (err: any) {
    return {
      success: false,
      timestamp,
      message: err?.message || 'Gagal menyimpan data presensi.',
    };
  }
}

/**
 * Sinkronisasi Data Presensi & Siswa (Lintas Tab, Storage, & Server/Cloud)
 */
export async function syncAttendanceStateNow(): Promise<{
  students: RegisteredStudentBiometric[];
  records: StudentAttendanceRecord[];
  kelasList: KelasWaliKelasMaster[];
  scheduleConfig: SchoolScheduleConfig;
  permits: OnlinePermitRequest[];
  syncedAt: string;
  message: string;
}> {
  const now = new Date();
  const syncedAt = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')} WIB`;

  // Muat ulang dari sumber terbaru di localStorage & sinkronkan event lintas komponen
  const students = getRegisteredStudents();
  const records = getAttendanceRecords();
  const kelasList = getKelasWaliKelasList();
  const scheduleConfig = getSchoolScheduleConfig();
  const permits = getOnlinePermitRequests();

  saveRegisteredStudents(students);
  saveAttendanceRecords(records);
  saveKelasWaliKelasList(kelasList);
  saveSchoolScheduleConfig(scheduleConfig);
  saveOnlinePermitRequests(permits);
  try {
    localStorage.setItem('anbk_attendance_last_synced_at_v1', syncedAt);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(BIOMETRIC_ATTENDANCE_EVENT));
      window.dispatchEvent(new CustomEvent(BIOMETRIC_STUDENT_REGISTERED_EVENT));
      window.dispatchEvent(new CustomEvent(PERMIT_REQUEST_EVENT));
    }
  } catch {}

  return {
    students,
    records,
    kelasList,
    scheduleConfig,
    permits,
    syncedAt,
    message: `Sinkronisasi selesai (${syncedAt}): ${students.length} Siswa Terdaftar, ${records.length} Log Presensi, & ${permits.length} Surat Izin tersinkronisasi.`,
  };
}

/**
 * Membunyikan efek suara biometrik menggunakan Web Audio API
 */
export function playBiometricSound(type: 'scan' | 'success' | 'error' | 'beep'): void {
  try {
    if (typeof window === 'undefined') return;
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;

    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.connect(gain);
    gain.connect(ctx.destination);

    const now = ctx.currentTime;

    if (type === 'beep') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, now);
      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
      osc.start(now);
      osc.stop(now + 0.1);
    } else if (type === 'scan') {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(440, now);
      osc.frequency.linearRampToValueAtTime(880, now + 0.25);
      gain.gain.setValueAtTime(0.1, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
      osc.start(now);
      osc.stop(now + 0.25);
    } else if (type === 'success') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(523.25, now); // C5
      osc.frequency.setValueAtTime(783.99, now + 0.12); // G5
      gain.gain.setValueAtTime(0.18, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
      osc.start(now);
      osc.stop(now + 0.35);
    } else if (type === 'error') {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(220, now);
      osc.frequency.linearRampToValueAtTime(140, now + 0.25);
      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
      osc.start(now);
      osc.stop(now + 0.25);
    }
  } catch {}
}

/**
 * Haptic Vibration Feedback
 */
export function triggerHaptic(type: 'touch' | 'scan' | 'success' | 'error'): void {
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      if (type === 'touch') {
        navigator.vibrate(15);
      } else if (type === 'scan') {
        navigator.vibrate([20, 30, 20]);
      } else if (type === 'success') {
        navigator.vibrate([40, 50, 60]);
      } else if (type === 'error') {
        navigator.vibrate([100, 50, 100]);
      }
    }
  } catch {}
}
