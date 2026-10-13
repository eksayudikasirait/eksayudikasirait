import { StudentSubmission, getCleanKelas, EXAM_INFO } from '../data/examData';

export const STORAGE_KEY_STUDENTS = 'anbk_classroom_manual_students_v1';
export const STORAGE_KEY_ACTIVE_SYNC = 'anbk_classroom_active_student_sync_v1';
export const CLASSROOM_SYNC_EVENT = 'anbk-classroom-students-updated';

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

export interface ActiveClassroomStudentSyncData {
  namaSiswa: string;
  nisNisn: string;
  kelas: string;
  semester: 'Ganjil' | 'Genap';
  seatNumber: number;
  isNew: boolean;
  syncedAt: string;
  deviceCategory?: string;
  deviceModel?: string;
  photoUrl?: string;
}

/**
 * Membaca daftar siswa di Design Classroom dari localStorage.
 * Jika belum ada, gunakan fallback submissions awal.
 */
export function loadStoredClassroomStudents(
  submissionsFallback: StudentSubmission[] = []
): ClassroomSeatStudent[] {
  const demoNames = [
    'nayla azzahra nst',
    'sofi marsya aulia',
    'muhammad ridho syahputra',
    'dimas aditya pratama',
    'aisyah haya kholis hrp',
    'farel pratama',
    'siti zahra khairunnisa',
  ];
  try {
    const raw = localStorage.getItem(STORAGE_KEY_STUDENTS);
    if (raw !== null && raw !== undefined) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        const cleaned = parsed.filter(
          (s) => s && !demoNames.includes(String(s.namaSiswa || '').trim().toLowerCase())
        );
        if (cleaned.length !== parsed.length) {
          try {
            localStorage.setItem(STORAGE_KEY_STUDENTS, JSON.stringify(cleaned));
          } catch {}
        }
        return cleaned;
      }
    }
  } catch {
    // ignore
  }

  // Fallback awal dari submissions (HANYA untuk siswa yang sudah menyelesaikan semua soal ujian dan dinyatakan LULUS UJIAN minimal KKM 75)
  const seatCounterByKelas: Record<string, number> = {};
  const passedSubmissions = submissionsFallback.filter((sub) => {
    const score = Number(sub.nilaiAkhir ?? 0);
    const isCompleted = sub.isCompleted !== false;
    const isDisqualified =
      String(sub.statusKecurangan || '').toLowerCase().includes('diskualifikasi') ||
      String(sub.lulusTidakLulus || '').toLowerCase().includes('tidak');
    return isCompleted && !isDisqualified && score >= EXAM_INFO.kkm;
  });

  return passedSubmissions.map((sub, idx) => {
    const cleanKls = getCleanKelas(sub.kelas) || 'VIII-1';
    seatCounterByKelas[cleanKls] = (seatCounterByKelas[cleanKls] || 0) + 1;
    return {
      id: sub.id || `CLS-INIT-${idx + 1}`,
      seatNumber: seatCounterByKelas[cleanKls],
      namaSiswa: sub.namaSiswa,
      nisNisn: sub.nisNisn,
      kelas: cleanKls,
      semester: (sub.semester === 'Ganjil' || sub.semester === 'Genap') ? sub.semester : 'Ganjil',
      deviceCategory: sub.deviceCategory || 'HP Android',
      deviceBrand: sub.deviceBrand || 'Samsung',
      deviceModel: sub.deviceModel || sub.deviceInfo || 'HP Android Siswa',
      deviceInfo:
        sub.deviceInfo ||
        [sub.deviceCategory, sub.deviceModel, sub.deviceOsBrowser].filter(Boolean).join(' - ') ||
        'HP Android - Chrome Mobile',
      photoUrl: sub.photoUrl || undefined,
      attendanceStatus: 'Selesai Ujian',
      skorBenar: sub.skorBenar ?? 20,
      totalSoal: sub.totalSoal ?? EXAM_INFO.totalSoal ?? 25,
      nilaiAkhir: sub.nilaiAkhir ?? 80,
      statusKecurangan: sub.statusKecurangan || 'Tidak Ada Kecurangan (Jujur / Bersih)',
      lulusTidakLulus: 'Lulus Ujian',
      includeInRekap: true,
      updatedAt: sub.timestamp || new Date().toLocaleString('id-ID'),
    };
  });
}

/**
 * Mencari nomor bangku kosong pertama di kelas tertentu
 * Urutan masuk: 1, 2, 3, ... N (tanpa tertindih bangku yang sudah terisi)
 */
export function findFirstEmptySeatForClass(
  kelas: string,
  list: ClassroomSeatStudent[],
  capacity: number = 32
): number {
  const cleanKls = getCleanKelas(kelas);
  const occupied = new Set(
    list.filter((s) => getCleanKelas(s.kelas) === cleanKls).map((s) => s.seatNumber)
  );
  let seat = 1;
  while (occupied.has(seat)) {
    seat++;
  }
  return seat;
}

export interface SyncStudentParams {
  namaSiswa: string;
  nisNisn: string;
  kelas: string;
  semester: 'Ganjil' | 'Genap';
  deviceCategory?: string;
  deviceBrand?: string;
  deviceModel?: string;
  deviceInfo?: string;
  photoUrl?: string;
  attendanceStatus?: 'Hadir - Siap Ujian' | 'Sedang Ujian' | 'Selesai Ujian' | 'Izin / Sakit';
  skorBenar?: number;
  totalSoal?: number;
  nilaiAkhir?: number;
  statusKecurangan?: string;
  lulusTidakLulus?: string;
  isExamCompletedAndPassed?: boolean;
  submissionsFallback?: StudentSubmission[];
}

export interface SyncStudentResult {
  assignedSeat: number;
  isNew: boolean;
  student: ClassroomSeatStudent;
  list: ClassroomSeatStudent[];
}

/**
 * Sinkronkan data Siswa ke menu Design Classroom:
 * SYARAT WAJIB: Siswa HANYA dapat masuk ke denah kelas di Classroom dan mengisi bangku yang kosong
 * saat siswa SUDAH MENYELESAIKAN SEMUA SOAL UJIAN dan DINYATAKAN LULUS UJIAN (Minimal Standar KKM 75).
 * Selain itu (nilai < 75, belum selesai, atau tidak lulus) TIDAK BISA mengisi bangku.
 */
export function syncStudentToClassroomSeat(params: SyncStudentParams): SyncStudentResult | null {
  const cleanName = params.namaSiswa.trim();
  const cleanNis = params.nisNisn.trim();
  const cleanKls = getCleanKelas(params.kelas) || 'VIII-1';
  const cleanSem = params.semester || 'Ganjil';

  if (!cleanName && !cleanNis && !params.photoUrl) {
    return null;
  }

  // Validasi Ketat Syarat Kelulusan Minimal Standar KKM 75:
  // Jika nilaiAkhir diberikan dan di bawah KKM 75 (atau dinyatakan Tidak Lulus), siswa TIDAK BISA masuk ke bangku denah kelas!
  const effectiveNilai = params.nilaiAkhir ?? 80;
  const effectiveLulusText = params.lulusTidakLulus || (effectiveNilai >= EXAM_INFO.kkm ? 'Lulus Ujian' : 'Tidak Lulus Ujian (Ujian Susulan)');
  const isDisqualifiedOrFailed =
    effectiveNilai < EXAM_INFO.kkm ||
    effectiveLulusText.toLowerCase().includes('tidak') ||
    (params.statusKecurangan || '').toLowerCase().includes('diskualifikasi');

  if (isDisqualifiedOrFailed) {
    return null;
  }

  const currentList = loadStoredClassroomStudents(params.submissionsFallback || []);

  // Cek apakah siswa sudah ada di kelas ini (berdasarkan NISN yang cocok, Nama yang sama, atau bangku aktif terakhir)
  const storedActive = getStoredActiveSync();
  const existingIndex = currentList.findIndex((s) => {
    const isSameClass = getCleanKelas(s.kelas) === cleanKls;
    if (!isSameClass) return false;
    const matchNis =
      cleanNis &&
      cleanNis !== '-' &&
      s.nisNisn &&
      s.nisNisn.trim().toLowerCase() === cleanNis.toLowerCase();
    const matchName =
      cleanName &&
      s.namaSiswa &&
      s.namaSiswa.trim().toLowerCase() === cleanName.toLowerCase();
    const matchActiveSeat =
      !cleanName &&
      !cleanNis &&
      storedActive &&
      getCleanKelas(storedActive.kelas) === cleanKls &&
      s.seatNumber === storedActive.seatNumber;
    return Boolean(matchNis || matchName || matchActiveSeat);
  });

  const nowFormatted = new Date().toLocaleString('id-ID', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  let assignedSeat: number;
  let isNew = false;
  let studentRecord: ClassroomSeatStudent;
  let nextList: ClassroomSeatStudent[];

  const finalTotalSoal = params.totalSoal ?? EXAM_INFO.totalSoal ?? 25;
  const finalSkorBenar = params.skorBenar ?? Math.round((effectiveNilai / 100) * finalTotalSoal);

  if (existingIndex >= 0) {
    // Siswa SUDAH punya bangku di kelas ini -> PERTAHANKAN nomor bangku tersebut & perbarui foto profil serta nilainya!
    const existing = currentList[existingIndex];
    assignedSeat = existing.seatNumber;
    studentRecord = {
      ...existing,
      namaSiswa: cleanName || existing.namaSiswa,
      nisNisn: cleanNis || existing.nisNisn,
      kelas: cleanKls,
      semester: cleanSem,
      deviceCategory: params.deviceCategory || existing.deviceCategory || 'HP Android',
      deviceBrand: params.deviceBrand || existing.deviceBrand || 'Android',
      deviceModel: params.deviceModel || existing.deviceModel || 'Smartphone Siswa',
      deviceInfo: params.deviceInfo || existing.deviceInfo || 'HP Android Siswa',
      photoUrl:
        params.photoUrl !== undefined ? params.photoUrl || undefined : existing.photoUrl,
      attendanceStatus: params.attendanceStatus || 'Selesai Ujian',
      skorBenar: params.skorBenar !== undefined ? finalSkorBenar : existing.skorBenar,
      totalSoal: params.totalSoal !== undefined ? finalTotalSoal : existing.totalSoal,
      nilaiAkhir: params.nilaiAkhir !== undefined ? effectiveNilai : existing.nilaiAkhir,
      statusKecurangan: params.statusKecurangan || existing.statusKecurangan || 'Tidak Ada Kecurangan (Jujur / Bersih)',
      lulusTidakLulus: 'Lulus Ujian',
      updatedAt: nowFormatted,
    };
    nextList = [...currentList];
    nextList[existingIndex] = studentRecord;
  } else {
    // Siswa BARU yang LULUS UJIAN (Nilai >= KKM 75) -> Masuk dan menempati bangku KOSONG pertama sesuai urutan masuk (1, 2, 3... yang belum terisi)
    isNew = true;
    const occupiedSeats = new Set(
      currentList.filter((s) => getCleanKelas(s.kelas) === cleanKls).map((s) => s.seatNumber)
    );
    let targetSeat = 1;
    while (occupiedSeats.has(targetSeat)) {
      targetSeat++;
    }
    assignedSeat = targetSeat;

    const safeNis = cleanNis;
    const studentId = `CLS-AUTO-${safeNis.replace(/[^A-Za-z0-9]/g, '') || Date.now()}-${Date.now()}`;

    studentRecord = {
      id: studentId,
      seatNumber: assignedSeat,
      namaSiswa: cleanName || 'Peserta Ujian',
      nisNisn: safeNis,
      kelas: cleanKls,
      semester: cleanSem,
      deviceCategory: params.deviceCategory || 'HP Android',
      deviceBrand: params.deviceBrand || 'Android',
      deviceModel: params.deviceModel || 'Smartphone Siswa',
      deviceInfo: params.deviceInfo || 'HP Android - Siswa ANBK',
      photoUrl: params.photoUrl || undefined,
      attendanceStatus: params.attendanceStatus || 'Selesai Ujian',
      skorBenar: finalSkorBenar,
      totalSoal: finalTotalSoal,
      nilaiAkhir: effectiveNilai,
      statusKecurangan: params.statusKecurangan || 'Tidak Ada Kecurangan (Jujur / Bersih)',
      lulusTidakLulus: 'Lulus Ujian',
      includeInRekap: true,
      updatedAt: nowFormatted,
    };
    nextList = [...currentList, studentRecord];
  }

  // Simpan ke localStorage
  try {
    localStorage.setItem(STORAGE_KEY_STUDENTS, JSON.stringify(nextList));
    const activeSyncData: ActiveClassroomStudentSyncData = {
      namaSiswa: studentRecord.namaSiswa,
      nisNisn: studentRecord.nisNisn,
      kelas: studentRecord.kelas,
      semester: studentRecord.semester,
      seatNumber: studentRecord.seatNumber,
      isNew,
      syncedAt: nowFormatted,
      deviceCategory: studentRecord.deviceCategory,
      deviceModel: studentRecord.deviceModel,
      photoUrl: studentRecord.photoUrl,
    };
    localStorage.setItem(STORAGE_KEY_ACTIVE_SYNC, JSON.stringify(activeSyncData));
  } catch {
    // ignore
  }

  // Siarkan event agar komponen yang sedang aktif (ClassroomDesignView / App) langsung tahu
  try {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent(CLASSROOM_SYNC_EVENT, {
          detail: {
            assignedSeat,
            isNew,
            student: studentRecord,
            kelas: cleanKls,
            timestamp: Date.now(),
          },
        })
      );
    }
  } catch {
    // ignore
  }

  return {
    assignedSeat,
    isNew,
    student: studentRecord,
    list: nextList,
  };
}

/**
 * Membaca sinkronisasi siswa aktif terakhir
 */
export function getStoredActiveSync(): ActiveClassroomStudentSyncData | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_ACTIVE_SYNC);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch {
    // ignore
  }
  return null;
}

/**
 * Menghapus sinkronisasi siswa aktif
 */
export function clearStoredActiveSync(): void {
  try {
    localStorage.removeItem(STORAGE_KEY_ACTIVE_SYNC);
  } catch {
    // ignore
  }
}
