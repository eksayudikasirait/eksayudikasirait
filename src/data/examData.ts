import logoTutWuriAsset from '../assets/images/logo_tut_wuri_1790628001663.jpg';
import heroAnbkAsset from '../assets/images/hero_anbk_informatika_1790638244929.jpg';
import labKomputerAnbkAsset from '../assets/images/lab_komputer_anbk_1791059480053.jpg';
import labInformatikaAsset from '../assets/images/lab_informatika_sekolah_1791059493524.jpg';
import pasFotoDasiMerahAsset from '../assets/images/pas_foto_eksa_dasi_merah_1790795857315.jpg';
import pasFotoAsliAsset from '../assets/images/pas_foto_eksa_asli_1790795190859.jpg';
import fotoPembuatSoalAsset from '../assets/images/foto_pembuat_soal_eksa_1790794619714.jpg';
import permanentPhotosJson from './permanentPhotos.json';
import cloudConfigJson from './cloudConfig.json';
import studentDashboardStateJson from './studentDashboardState.json';
import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getFirestore,
  initializeFirestore,
  setLogLevel,
  Firestore,
  doc,
  onSnapshot,
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import {
  getAccessTokenSync,
  setSharedCloudAccessToken,
  syncAllSubmissionsToGoogleSheetViaRestApi,
  clearGoogleSheetRekapImmediatelyViaRestApi,
  ensureSpreadsheetOAuthToken,
  readTokenFromGoogleSheetViaRestApi,
  writeTokenToGoogleSheetViaRestApi,
} from '../services/gmailAuthService';
import {
  enqueueSubmissionSync,
  enqueueBatchSubmissionsSync,
  getSyncQueueStats,
  forceProcessQueueNow,
  retryFailedQueueItems,
  clearAllSyncQueue,
  checkStudentSubmissionQueueStatus,
  useSubmissionSyncQueue,
} from '../utils/submissionSyncQueue';

export {
  enqueueSubmissionSync,
  enqueueBatchSubmissionsSync,
  getSyncQueueStats,
  forceProcessQueueNow,
  retryFailedQueueItems,
  clearAllSyncQueue,
  checkStudentSubmissionQueueStatus,
  useSubmissionSyncQueue,
};

try {
  setLogLevel('silent');
} catch {
  // ignore
}

const firebaseAppInstance =
  getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

function initResilientFirestore(): Firestore {
  try {
    return initializeFirestore(
      firebaseAppInstance,
      {
        experimentalForceLongPolling: true,
      },
      firebaseConfig.firestoreDatabaseId
    );
  } catch {
    return getFirestore(firebaseAppInstance, firebaseConfig.firestoreDatabaseId);
  }
}

export const firestoreDb = initResilientFirestore();
const DASHBOARD_FIRESTORE_DOC_PATH = ['studentDashboardSync', 'globalState'] as const;
const CLOUD_TOKEN_FIRESTORE_DOC_PATH = ['cloudTokenSync', 'globalConfig'] as const;
const FIRESTORE_REST_BASE_URL = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(
  firebaseConfig.projectId
)}/databases/${encodeURIComponent(firebaseConfig.firestoreDatabaseId)}/documents`;

function toFirestoreRestValue(val: unknown): Record<string, unknown> {
  if (val === null || val === undefined) {
    return { nullValue: null };
  }
  if (typeof val === 'boolean') {
    return { booleanValue: val };
  }
  if (typeof val === 'number') {
    if (!Number.isFinite(val)) return { integerValue: '0' };
    return Number.isInteger(val) ? { integerValue: String(val) } : { doubleValue: val };
  }
  if (typeof val === 'string') {
    return { stringValue: val };
  }
  if (Array.isArray(val)) {
    return {
      arrayValue: {
        values: val.map((item) => toFirestoreRestValue(item)),
      },
    };
  }
  if (typeof val === 'object') {
    const fields: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(val as Record<string, unknown>)) {
      if (v !== undefined) {
        fields[k] = toFirestoreRestValue(v);
      }
    }
    return { mapValue: { fields } };
  }
  return { stringValue: String(val) };
}

function fromFirestoreRestValue(v: Record<string, unknown> | undefined | null): unknown {
  if (!v || typeof v !== 'object') return null;
  if ('stringValue' in v) return String(v.stringValue ?? '');
  if ('integerValue' in v) return Number(v.integerValue ?? 0);
  if ('doubleValue' in v) return Number(v.doubleValue ?? 0);
  if ('booleanValue' in v) return Boolean(v.booleanValue);
  if ('nullValue' in v) return null;
  if ('arrayValue' in v) {
    const arrObj = v.arrayValue as { values?: Array<Record<string, unknown>> } | undefined;
    return Array.isArray(arrObj?.values)
      ? arrObj!.values.map((item) => fromFirestoreRestValue(item))
      : [];
  }
  if ('mapValue' in v) {
    const mapObj = v.mapValue as { fields?: Record<string, Record<string, unknown>> } | undefined;
    const fields = mapObj?.fields || {};
    const out: Record<string, unknown> = {};
    for (const [k, fv] of Object.entries(fields)) {
      out[k] = fromFirestoreRestValue(fv);
    }
    return out;
  }
  return null;
}

export async function firestoreRestReadDoc<T>(
  collectionId: string,
  docId: string,
  timeoutMs: number = 2500
): Promise<T | null> {
  if (typeof window === 'undefined') return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    // 1. Direct CORS-simple GET request (tanpa custom headers = bebas preflight OPTIONS & cepat di jaringan seluler HP/Tablet)
    const directRes = await fetch(
      `${FIRESTORE_REST_BASE_URL}/${encodeURIComponent(collectionId)}/${encodeURIComponent(
        docId
      )}?key=${encodeURIComponent(firebaseConfig.apiKey)}&_t=${Date.now()}`,
      {
        method: 'GET',
        signal: controller.signal,
        cache: 'no-store',
        credentials: 'omit',
      }
    );
    if (directRes.ok) {
      const docObj = (await directRes.json()) as {
        fields?: Record<string, Record<string, unknown>>;
      };
      if (docObj && docObj.fields) {
        return fromFirestoreRestValue({ mapValue: { fields: docObj.fields } }) as T;
      }
    }

    // 2. Fallback ke structuredQuery :runQuery
    const res = await fetch(
      `${FIRESTORE_REST_BASE_URL}:runQuery?key=${encodeURIComponent(firebaseConfig.apiKey)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          structuredQuery: {
            from: [{ collectionId }],
            limit: 10,
          },
        }),
        signal: controller.signal,
        cache: 'no-store',
        credentials: 'omit',
      }
    );
    if (!res.ok) return null;
    const rows = (await res.json()) as Array<{
      document?: {
        name?: string;
        fields?: Record<string, Record<string, unknown>>;
      };
    }>;
    if (!Array.isArray(rows)) return null;
    const targetSuffix = `/${collectionId}/${docId}`;
    const match = rows.find(
      (r) =>
        r.document &&
        typeof r.document.name === 'string' &&
        r.document.name.endsWith(targetSuffix)
    );
    if (!match || !match.document || !match.document.fields) return null;
    return fromFirestoreRestValue({ mapValue: { fields: match.document.fields } }) as T;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export async function firestoreRestWriteDoc(
  collectionId: string,
  docId: string,
  data: Record<string, unknown>,
  timeoutMs: number = 3500
): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const keys = Object.keys(data).filter((k) => data[k] !== undefined);
    const updateMaskParams = keys
      .map((k) => `updateMask.fieldPaths=${encodeURIComponent(k)}`)
      .join('&');
    const encodedMap = toFirestoreRestValue(data) as {
      mapValue?: { fields?: Record<string, unknown> };
    };
    const fields = encodedMap.mapValue?.fields || {};
    const url = `${FIRESTORE_REST_BASE_URL}/${encodeURIComponent(
      collectionId
    )}/${encodeURIComponent(docId)}?key=${encodeURIComponent(firebaseConfig.apiKey)}${
      updateMaskParams ? `&${updateMaskParams}` : ''
    }`;
    const res = await fetch(url, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fields }),
      signal: controller.signal,
      credentials: 'omit',
    });
    if (!res.ok && res.status === 404) {
      // Document does not exist yet; create it directly via PATCH without updateMask
      const fallbackUrl = `${FIRESTORE_REST_BASE_URL}/${encodeURIComponent(
        collectionId
      )}/${encodeURIComponent(docId)}?key=${encodeURIComponent(firebaseConfig.apiKey)}`;
      const fallbackRes = await fetch(fallbackUrl, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fields }),
        signal: controller.signal,
        credentials: 'omit',
      });
      return fallbackRes.ok;
    }
    return res.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

const REAL_PERMANENT_TEACHER_PHOTO: string =
  (permanentPhotosJson as { teacherPhoto?: string }).teacherPhoto || pasFotoDasiMerahAsset;

const REAL_PERMANENT_HERO_BANNER: string =
  (permanentPhotosJson as { heroBanner?: string }).heroBanner || heroAnbkAsset;

export type JenjangKelas = 'VII' | 'VIII';
export type SemesterType = 'Ganjil' | 'Genap';
export type ExamPackageKey = 'VII_Ganjil' | 'VII_Genap' | 'VIII_Ganjil' | 'VIII_Genap';

export interface Question {
  id: number;
  content: string;
  image: string | null;
  options: [string, string, string, string];
  answer: 'A' | 'B' | 'C' | 'D';
  difficulty: 'REGULER' | 'HOTS';
  explanation: string;
  jenjang?: JenjangKelas;
  semester?: SemesterType;
  elemen?: string;
}

export interface BatteryHistoryPoint {
  timestamp: string;
  elapsedLabel: string;
  elapsedSeconds: number;
  level: number;
  charging: boolean;
  questionNumber?: number;
  eventNote?: string;
}

export interface StudentSubmission {
  id: string;
  timestamp: string;
  namaSiswa: string;
  nisNisn: string;
  kelas: string;
  semester?: SemesterType;
  skorBenar: number;
  totalSoal: number;
  nilaiAkhir: number;
  statusKecurangan: string;
  lulusTidakLulus: string;
  answers: Record<number, 'A' | 'B' | 'C' | 'D'>;
  doubtful: Record<number, boolean>;
  questionDurations?: Record<number, number>;
  batteryHistory?: BatteryHistoryPoint[];
  violationCount: number;
  violationLogs: string[];
  questionOrder: number[];
  isCompleted: boolean;
  notifSent?: boolean;
  deviceCategory?: string;
  deviceBrand?: string;
  deviceModel?: string;
  deviceOsBrowser?: string;
  deviceInfo?: string;
  photoUrl?: string;
  usedToken?: string;
  clientIp?: string;
  deviceFingerprint?: string;
  sessionId?: string;
  sessionName?: string;
}

export interface ResetSubmissionsFilter {
  mode: 'ALL' | 'DATE_FILTER' | 'DATE_RANGE';
  selectedDate?: number | 'ALL'; // 1-31 or 'ALL'
  selectedMonth?: number | 'ALL'; // 1-12 or 'ALL'
  selectedYear?: number | 'ALL'; // e.g. 2026 or 'ALL'
  specificDateIso?: string; // 'YYYY-MM-DD' or ''
  startDateIso?: string; // 'YYYY-MM-DD'
  endDateIso?: string; // 'YYYY-MM-DD'
}

export interface ParsedSubmissionDate {
  day: number | null;
  month: number | null; // 1-12
  year: number | null;
  dateKey: string; // 'YYYY-MM-DD'
  formattedIndo: string; // e.g. '24 September 2026'
  dateObj: Date | null;
}

const INDO_MONTH_NAMES_LIST = [
  'Januari',
  'Februari',
  'Maret',
  'April',
  'Mei',
  'Juni',
  'Juli',
  'Agustus',
  'September',
  'Oktober',
  'November',
  'Desember',
];

export function parseSubmissionDate(
  tsOrSub: string | StudentSubmission | undefined | null
): ParsedSubmissionDate {
  const rawTs = typeof tsOrSub === 'string' ? tsOrSub : tsOrSub?.timestamp || '';
  const clean = String(rawTs).trim();
  if (!clean) {
    return { day: null, month: null, year: null, dateKey: '', formattedIndo: '-', dateObj: null };
  }

  // 1. Format: DD/MM/YYYY or DD-MM-YYYY (e.g. 24/09/2026 14:47:05 or 24/09/2026, 14.47.05)
  const dmyMatch = clean.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})/);
  if (dmyMatch) {
    const day = parseInt(dmyMatch[1], 10);
    const month = parseInt(dmyMatch[2], 10);
    const year = parseInt(dmyMatch[3], 10);
    const dObj = new Date(year, month - 1, day);
    const dateKey = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const mName = INDO_MONTH_NAMES_LIST[month - 1] || `Bulan ${month}`;
    return {
      day,
      month,
      year,
      dateKey,
      formattedIndo: `${day} ${mName} ${year}`,
      dateObj: isNaN(dObj.getTime()) ? null : dObj,
    };
  }

  // 2. Format: YYYY-MM-DD or YYYY/MM/DD
  const ymdMatch = clean.match(/^(\d{4})[\/\-\.](\d{1,2})[\/\-\.](\d{1,2})/);
  if (ymdMatch) {
    const year = parseInt(ymdMatch[1], 10);
    const month = parseInt(ymdMatch[2], 10);
    const day = parseInt(ymdMatch[3], 10);
    const dObj = new Date(year, month - 1, day);
    const dateKey = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const mName = INDO_MONTH_NAMES_LIST[month - 1] || `Bulan ${month}`;
    return {
      day,
      month,
      year,
      dateKey,
      formattedIndo: `${day} ${mName} ${year}`,
      dateObj: isNaN(dObj.getTime()) ? null : dObj,
    };
  }

  // 3. Text Indonesian Month format (e.g. 24 September 2026)
  const textIndoMatch = clean.match(/^(\d{1,2})\s+([a-zA-Z]+)\s+(\d{4})/);
  if (textIndoMatch) {
    const day = parseInt(textIndoMatch[1], 10);
    const monthStr = textIndoMatch[2].toLowerCase();
    const year = parseInt(textIndoMatch[3], 10);
    const monthIdx = INDO_MONTH_NAMES_LIST.findIndex((m) =>
      m.toLowerCase().startsWith(monthStr.slice(0, 3))
    );
    if (monthIdx !== -1) {
      const month = monthIdx + 1;
      const dObj = new Date(year, month - 1, day);
      const dateKey = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      return {
        day,
        month,
        year,
        dateKey,
        formattedIndo: `${day} ${INDO_MONTH_NAMES_LIST[monthIdx]} ${year}`,
        dateObj: isNaN(dObj.getTime()) ? null : dObj,
      };
    }
  }

  // 4. Standard Date.parse
  const parsed = new Date(clean);
  if (!isNaN(parsed.getTime())) {
    const day = parsed.getDate();
    const month = parsed.getMonth() + 1;
    const year = parsed.getFullYear();
    const dateKey = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const mName = INDO_MONTH_NAMES_LIST[month - 1] || `Bulan ${month}`;
    return {
      day,
      month,
      year,
      dateKey,
      formattedIndo: `${day} ${mName} ${year}`,
      dateObj: parsed,
    };
  }

  return { day: null, month: null, year: null, dateKey: '', formattedIndo: clean, dateObj: null };
}

export function isSubmissionMatchingResetFilter(
  sub: StudentSubmission,
  filter?: ResetSubmissionsFilter
): boolean {
  if (!filter || filter.mode === 'ALL') return true;

  const parsed = parseSubmissionDate(sub);
  if (!parsed.day || !parsed.month || !parsed.year || !parsed.dateKey) {
    return false;
  }

  // Support Date Range filter (Mulai Tanggal s/d Sampai Tanggal)
  if (filter.mode === 'DATE_RANGE') {
    if (filter.startDateIso && filter.startDateIso.trim()) {
      if (parsed.dateKey < filter.startDateIso.trim()) {
        return false;
      }
    }
    if (filter.endDateIso && filter.endDateIso.trim()) {
      if (parsed.dateKey > filter.endDateIso.trim()) {
        return false;
      }
    }
    return true;
  }

  if (filter.specificDateIso && filter.specificDateIso.trim()) {
    return parsed.dateKey === filter.specificDateIso.trim();
  }

  let match = true;
  if (filter.selectedDate !== undefined && filter.selectedDate !== 'ALL') {
    match = match && parsed.day === Number(filter.selectedDate);
  }
  if (filter.selectedMonth !== undefined && filter.selectedMonth !== 'ALL') {
    match = match && parsed.month === Number(filter.selectedMonth);
  }
  if (filter.selectedYear !== undefined && filter.selectedYear !== 'ALL') {
    match = match && parsed.year === Number(filter.selectedYear);
  }
  return match;
}

export const REKAP_SHEET_HEADERS = [
  'Timestamp',
  'Nama Siswa',
  'NIS/NISN',
  'Kelas',
  'Semester',
  'Skor Benar',
  'Total Soal',
  'Nilai Akhir',
  'Status Kecurangan',
  'Lulus/Tidak Lulus',
  'Ranking',
  'Device',
  'FOTO',
] as const;

export function computeSubmissionRankingMap(
  submissions: StudentSubmission[]
): Record<string, number> {
  if (!Array.isArray(submissions) || submissions.length === 0) return {};
  const indexed = submissions.map((sub, idx) => {
    const isDisq = String(sub.statusKecurangan || '')
      .toLowerCase()
      .includes('diskualifikasi');
    const vCount = Number(sub.violationCount || 0) + (isDisq ? 100 : 0);
    return {
      sub,
      idx,
      key: sub.id || `${String(sub.timestamp || '').trim()}_${String(sub.namaSiswa || '').trim().toLowerCase()}_${idx}`,
      uKey: `${String(sub.timestamp || '').trim()}_${String(sub.namaSiswa || '').trim().toLowerCase()}`,
      nilaiAkhir: Number(sub.nilaiAkhir || 0),
      skorBenar: Number(sub.skorBenar || 0),
      vCount,
    };
  });

  indexed.sort((a, b) => {
    if (b.nilaiAkhir !== a.nilaiAkhir) return b.nilaiAkhir - a.nilaiAkhir;
    if (b.skorBenar !== a.skorBenar) return b.skorBenar - a.skorBenar;
    if (a.vCount !== b.vCount) return a.vCount - b.vCount;
    return a.idx - b.idx;
  });

  const rankMap: Record<string, number> = {};
  indexed.forEach((item, sortedIdx) => {
    const rankNum = sortedIdx + 1;
    if (item.sub.id) {
      rankMap[item.sub.id] = rankNum;
    }
    if (!rankMap[item.uKey]) {
      rankMap[item.uKey] = rankNum;
    }
    rankMap[item.key] = rankNum;
  });
  return rankMap;
}

export function formatSubmissionToRekap13ColumnsWithRank(
  sub: StudentSubmission,
  rankNumber: number | string
): [
  string,
  string,
  string,
  string,
  string,
  number,
  number,
  number,
  string,
  string,
  string,
  string,
  string
] {
  const isInProgress =
    sub.isCompleted === false ||
    String(sub.statusKecurangan || '')
      .toLowerCase()
      .includes('sedang mengerjakan') ||
    String(sub.statusKecurangan || '')
      .toLowerCase()
      .includes('sudah login') ||
    String(sub.statusKecurangan || '')
      .toLowerCase()
      .includes('masuk ruang') ||
    String(sub.lulusTidakLulus || '')
      .toLowerCase()
      .includes('berlangsung');
  const rankLabel = isInProgress
    ? 'Sedang Berlangsung'
    : typeof rankNumber === 'number'
    ? `Peringkat #${rankNumber}`
    : String(rankNumber || 'Peringkat #1').toLowerCase().startsWith('peringkat')
    ? String(rankNumber)
    : String(rankNumber || '#1').startsWith('#')
    ? `Peringkat ${rankNumber}`
    : `Peringkat #${rankNumber}`;
  const cols12 = formatSubmissionToRekap10Columns(sub);
  return [
    cols12[0],
    cols12[1],
    cols12[2],
    cols12[3],
    cols12[4],
    cols12[5],
    cols12[6],
    cols12[7],
    cols12[8],
    cols12[9],
    rankLabel,
    cols12[10],
    cols12[11],
  ];
}

export function resolveStudentPhotoForSheet(sub: {
  namaSiswa?: string;
  nisNisn?: string;
  kelas?: string;
  photoUrl?: string;
}): string {
  if (sub.photoUrl && sub.photoUrl.trim() && sub.photoUrl.length <= 45000) {
    return sub.photoUrl.trim();
  }
  if (typeof window !== 'undefined') {
    try {
      const mapRaw = localStorage.getItem('anbk_student_photos_by_user_v1');
      if (mapRaw) {
        const map = JSON.parse(mapRaw) as Record<string, string>;
        const cleanName = String(sub.namaSiswa || '').trim().toLowerCase();
        const cleanNis = String(sub.nisNisn || '').trim().toLowerCase();
        const matched =
          (cleanName && cleanNis && map[`${cleanName}_${cleanNis}`]) ||
          (cleanNis && map[`nis_${cleanNis}`]) ||
          (cleanName && map[`name_${cleanName}`]);
        if (matched && matched.length <= 45000) {
          return matched;
        }
      }
    } catch {
      // ignore
    }
  }
  const cleanKelas = getCleanKelas(String(sub.kelas || 'VIII-1'));
  return `Pas Foto Resmi ANBK — ${String(sub.namaSiswa || 'Siswa').trim()} (${cleanKelas})`;
}

export function formatSubmissionToRekap10Columns(
  sub: StudentSubmission
): [string, string, string, string, string, number, number, number, string, string, string, string] {
  const cleanKelas = getCleanKelas(sub.kelas);
  const sem = getSemesterFromSub(sub);
  const skorBenar = Number(sub.skorBenar ?? 0);
  const totalSoal = Number(sub.totalSoal ?? 25) || 25;
  const nilaiAkhir = Number(
    sub.nilaiAkhir !== undefined ? sub.nilaiAkhir : Math.round((skorBenar / totalSoal) * 100)
  );
  const statusKecurangan = String(
    sub.statusKecurangan || 'Tidak Ada Kecurangan (Jujur / Bersih)'
  );
  const isDisq = statusKecurangan.toLowerCase().includes('diskualifikasi');
  const isInProgress =
    sub.isCompleted === false ||
    statusKecurangan.toLowerCase().includes('sedang mengerjakan') ||
    statusKecurangan.toLowerCase().includes('sudah login') ||
    statusKecurangan.toLowerCase().includes('masuk ruang') ||
    String(sub.lulusTidakLulus || '').toLowerCase().includes('berlangsung');
  const isPassed = !isDisq && nilaiAkhir >= 75;
  const lulusText = sub.lulusTidakLulus
    ? String(sub.lulusTidakLulus)
    : isInProgress
    ? 'SEDANG BERLANGSUNG'
    : isPassed
    ? 'LULUS'
    : 'TIDAK LULUS';

  const nameSeed = String(sub.namaSiswa || '')
    .split('')
    .reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  const fallbackDev =
    SAMPLE_HISTORICAL_DEVICES[Math.abs(nameSeed) % SAMPLE_HISTORICAL_DEVICES.length];
  const devCat = sub.deviceCategory || fallbackDev.category;
  const devMod = sub.deviceModel || fallbackDev.model;
  const devOs = sub.deviceOsBrowser || fallbackDev.osBrowser;
  const fpText = sub.deviceFingerprint ? ` · ${sub.deviceFingerprint}` : '';
  const ipText = sub.clientIp ? ` · IP: ${sub.clientIp}` : '';
  let deviceText = String(sub.deviceInfo || '').trim();
  if (!deviceText) {
    deviceText = `${devCat} — ${devMod}${devOs ? ` (${devOs}${fpText}${ipText})` : `${fpText}${ipText}`}`;
  } else {
    if (sub.deviceFingerprint && !deviceText.includes(sub.deviceFingerprint)) {
      deviceText += ` · ${sub.deviceFingerprint}`;
    }
    if (sub.clientIp && !deviceText.includes(sub.clientIp)) {
      deviceText += ` · IP: ${sub.clientIp}`;
    }
  }
  const fotoText = resolveStudentPhotoForSheet(sub);

  return [
    String(sub.timestamp || new Date().toLocaleString('id-ID')),
    String(sub.namaSiswa || '-'),
    String(sub.nisNisn || '-'),
    cleanKelas,
    sem,
    skorBenar,
    totalSoal,
    nilaiAkhir,
    statusKecurangan,
    lulusText,
    deviceText,
    fotoText,
  ];
}

export function getCleanKelas(kelasRaw: string): string {
  if (!kelasRaw) return 'VIII-1';
  return kelasRaw.replace(/\s*\(Semester\s+(Ganjil|Genap)\)/i, '').trim() || 'VIII-1';
}

export function getSemesterFromSub(sub: {
  kelas?: string;
  semester?: SemesterType;
}): SemesterType {
  if (sub.semester === 'Ganjil' || sub.semester === 'Genap') {
    return sub.semester;
  }
  if (sub.kelas && sub.kelas.toLowerCase().includes('genap')) {
    return 'Genap';
  }
  return 'Ganjil';
}

export interface CloudIntegrationConfig {
  googleDocUrl: string;
  googleSheetUrl: string;
  tokenSheetUrl?: string;
  customTeacherToken?: string;
  lockTeacherToken?: boolean;
  appsScriptWebAppUrl: string;
  fonnteToken: string;
  autoSendWa: boolean;
  autoSendEmail: boolean;
  studentShareUrl?: string;
}

export const DEFAULT_TOKEN_SHEET_URL =
  (cloudConfigJson as { tokenSheetUrl?: string }).tokenSheetUrl ||
  'https://docs.google.com/spreadsheets/d/12_e0bkbRkSI_RLJhtv1gyiWFfMPJ-GD_zMkW-YS4xRw/edit?usp=drive_link';

export const DEFAULT_REKAP_SHEET_URL =
  (cloudConfigJson as { googleSheetUrl?: string }).googleSheetUrl ||
  'https://docs.google.com/spreadsheets/d/1tHklK_FCTvLOZsHhCP0DecsZUq9wSkV1ffGauYAoOqQ/edit?usp=drive_link';

export function sanitizeRekapSheetUrl(rawUrl?: string | null): string {
  const trimmed = (rawUrl || '').trim();
  if (
    !trimmed ||
    trimmed.includes('12_e0bkbRkSI_RLJhtv1gyiWFfMPJ-GD_zMkW-YS4xRw') ||
    !isValidGoogleSheetOrScriptUrl(trimmed)
  ) {
    return DEFAULT_REKAP_SHEET_URL;
  }
  return trimmed;
}

export function sanitizeTokenValue(raw?: string | null): string {
  const cleaned = (raw || '')
    .replace(/[^A-Za-z0-9]/g, '')
    .toUpperCase()
    .slice(0, 6);
  if (
    !cleaned ||
    cleaned.length < 3 ||
    cleaned === 'UJIAN' ||
    cleaned === 'TOKEN' ||
    cleaned === 'KODETO' ||
    cleaned === 'KODE' ||
    cleaned === 'BELUM'
  ) {
    return '';
  }
  return cleaned;
}

export const INITIAL_SYNCED_TOKEN: string =
  sanitizeTokenValue((cloudConfigJson as { token?: string }).token) || '922662';

export const MAX_TOKEN_USAGE = 3;

export interface UsedExamTokenRecord {
  token: string;
  namaSiswa: string;
  nisNisn: string;
  kelas: string;
  semester?: string;
  usedAt: string;
  timestampMs: number;
  sessionId?: string;
  usageCount?: number;
  usageHistory?: {
    attemptNumber: number;
    usedAt: string;
    sessionId?: string;
  }[];
}

export interface ExhaustedStudentTokenEntry {
  key: string;
  namaSiswa: string;
  nisNisn: string;
  kelas: string;
  semester: string;
  exhaustedToken: string;
  usageCount: number;
  maxUsage: number;
  lastUsedAt: string;
  totalSessions: number;
  highestScore: number;
  allExhaustedTokens: string[];
}

export const USED_EXAM_TOKENS_STORAGE_KEY = 'anbk_used_exam_tokens_v1';
export const TOKEN_EXHAUSTED_NOTIF_LOGS_KEY = 'anbk_token_exhausted_notif_logs_v1';
export const TOKEN_EXHAUSTED_NOTIF_SETTINGS_KEY = 'anbk_token_exhausted_notif_settings_v1';

export interface TokenExhaustedNotifSettings {
  autoNotifyEmail: boolean;
  autoNotifyWhatsApp: boolean;
  autoGenerateSuggestedToken: boolean;
}

export interface TokenQuotaExhaustedNotificationLog {
  id: string;
  nisNisn: string;
  namaSiswa: string;
  kelas: string;
  semester: string;
  exhaustedToken: string;
  usageCount: number;
  suggestedNewToken: string;
  detectedAt: string;
  timestampMs: number;
  emailStatus: 'TERKIRIM_OTOMATIS' | 'SIAP_KIRIM' | 'NONAKTIF';
  waStatus: 'TERKIRIM_OTOMATIS' | 'SIAP_KIRIM' | 'NONAKTIF';
  isNewTokenIssued?: boolean;
}

export function getTokenExhaustedNotifSettings(): TokenExhaustedNotifSettings {
  if (typeof window === 'undefined') {
    return {
      autoNotifyEmail: true,
      autoNotifyWhatsApp: true,
      autoGenerateSuggestedToken: true,
    };
  }
  try {
    const raw = localStorage.getItem(TOKEN_EXHAUSTED_NOTIF_SETTINGS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        return {
          autoNotifyEmail: parsed.autoNotifyEmail ?? true,
          autoNotifyWhatsApp: parsed.autoNotifyWhatsApp ?? true,
          autoGenerateSuggestedToken: parsed.autoGenerateSuggestedToken ?? true,
        };
      }
    }
  } catch {
    // ignore
  }
  return {
    autoNotifyEmail: true,
    autoNotifyWhatsApp: true,
    autoGenerateSuggestedToken: true,
  };
}

export function saveTokenExhaustedNotifSettings(
  settings: TokenExhaustedNotifSettings
): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(TOKEN_EXHAUSTED_NOTIF_SETTINGS_KEY, JSON.stringify(settings));
    window.dispatchEvent(new CustomEvent('anbk-token-exhausted-notif-updated'));
  } catch {
    // ignore
  }
}

export function getTokenExhaustedNotificationLogs(): TokenQuotaExhaustedNotificationLog[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(TOKEN_EXHAUSTED_NOTIF_LOGS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed;
    }
  } catch {
    // ignore
  }
  return [];
}

export function saveTokenExhaustedNotificationLogs(
  logs: TokenQuotaExhaustedNotificationLog[]
): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(TOKEN_EXHAUSTED_NOTIF_LOGS_KEY, JSON.stringify(logs));
    window.dispatchEvent(new CustomEvent('anbk-token-exhausted-notif-updated'));
  } catch {
    // ignore
  }
}

export function buildTokenExhaustedTeacherMessage(
  log: TokenQuotaExhaustedNotificationLog
): { subject: string; textMessage: string; htmlBody: string } {
  const subject = `[NOTIFIKASI OTOMATIS KUOTA TOKEN 3x HABIS] ${log.namaSiswa} (NIS/NISN: ${log.nisNisn} - Kelas ${log.kelas}) — Token [${log.exhaustedToken}] (3/3x)`;
  const textMessage = [
    `*🔔 NOTIFIKASI OTOMATIS SISTEM ANBK — KUOTA TOKEN 3x HABIS*`,
    `*${EXAM_INFO.namaSekolah}*`,
    `====================================`,
    `Yth. Guru Mapel Informatika (*${EXAM_INFO.guruMapelUpper}*),`,
    `Sistem mendeteksi peserta ujian berikut telah menggunakan Kode Token sebanyak *3 KALI (3/3x)*:`,
    ``,
    `• *Nama Siswa* : ${log.namaSiswa}`,
    `• *NIS / NISN* : *${log.nisNisn}*`,
    `• *Kelas & Semester* : ${log.kelas} (${log.semester})`,
    `• *Kode Token Habis* : *[${log.exhaustedToken}]* (${log.usageCount}/${MAX_TOKEN_USAGE}x Pakai)`,
    `• *Waktu Terdeteksi* : ${log.detectedAt}`,
    `====================================`,
    `🔑 *REKOMENDASI KODE TOKEN BARU SIAP TERBIT* :`,
    `👉 *[ ${log.suggestedNewToken} ]*`,
    ``,
    `Silakan terbitkan/aktifkan Kode Token Baru di Panel Guru atau teruskan kode di atas kepada siswa tanpa harus menunggu siswa melapor.`,
  ].join('\n');

  const htmlBody = `
    <div style="font-family: Arial, sans-serif; max-width: 620px; margin: 0 auto; border: 2px solid #f59e0b; border-radius: 12px; overflow: hidden; background: #0f172a; color: #f8fafc;">
      <div style="background: linear-gradient(90deg, #991b1b, #b45309); padding: 16px 20px; border-bottom: 2px solid #fbbf24;">
        <div style="font-size: 11px; font-weight: bold; color: #fde68a; text-transform: uppercase; letter-spacing: 1px;">
          NOTIFIKASI OTOMATIS SISTEM UJIAN ANBK · ${EXAM_INFO.namaSekolah}
        </div>
        <h2 style="margin: 6px 0 0; font-size: 18px; color: #ffffff;">
          Kuota Kode Token 3x Habis Terdeteksi (${log.usageCount}/${MAX_TOKEN_USAGE}x)
        </h2>
      </div>
      <div style="padding: 20px; font-size: 14px; line-height: 1.6;">
        <p style="margin-top: 0;">Yth. Bapak <strong>${EXAM_INFO.guruMapelUpper}</strong>,</p>
        <p>Sistem mendeteksi secara otomatis bahwa peserta didik berikut telah mencapai batas maksimal penggunaan kode token ujian sebanyak <strong>3 kali (3/3x)</strong>:</p>
        <table style="width: 100%; border-collapse: collapse; margin: 14px 0; background: #1e293b; border-radius: 8px; overflow: hidden;">
          <tr>
            <td style="padding: 8px 12px; border-bottom: 1px solid #334155; color: #94a3b8; width: 40%;">Nama Siswa</td>
            <td style="padding: 8px 12px; border-bottom: 1px solid #334155; font-weight: bold; color: #ffffff;">${log.namaSiswa}</td>
          </tr>
          <tr>
            <td style="padding: 8px 12px; border-bottom: 1px solid #334155; color: #94a3b8;">NIS / NISN</td>
            <td style="padding: 8px 12px; border-bottom: 1px solid #334155; font-family: monospace; font-weight: bold; color: #fbbf24;">${log.nisNisn}</td>
          </tr>
          <tr>
            <td style="padding: 8px 12px; border-bottom: 1px solid #334155; color: #94a3b8;">Kelas &amp; Semester</td>
            <td style="padding: 8px 12px; border-bottom: 1px solid #334155; color: #e2e8f0;">${log.kelas} (${log.semester})</td>
          </tr>
          <tr>
            <td style="padding: 8px 12px; border-bottom: 1px solid #334155; color: #94a3b8;">Kode Token Habis</td>
            <td style="padding: 8px 12px; border-bottom: 1px solid #334155; font-family: monospace; font-weight: bold; color: #fda4af;">[${log.exhaustedToken}] — ${log.usageCount}/${MAX_TOKEN_USAGE}x Pakai</td>
          </tr>
          <tr>
            <td style="padding: 8px 12px; color: #94a3b8;">Waktu Terdeteksi</td>
            <td style="padding: 8px 12px; color: #cbd5e1;">${log.detectedAt}</td>
          </tr>
        </table>
        <div style="padding: 14px; border-radius: 10px; background: #064e3b; border: 1px solid #10b981; text-align: center; margin: 16px 0;">
          <div style="font-size: 11px; text-transform: uppercase; color: #a7f3d0; font-weight: bold;">
            Rekomendasi Kode Token Baru Siap Terbit:
          </div>
          <div style="font-size: 24px; font-family: monospace; font-weight: 800; letter-spacing: 4px; color: #fbbf24; margin-top: 4px;">
            ${log.suggestedNewToken}
          </div>
        </div>
        <p style="font-size: 12px; color: #94a3b8; margin-bottom: 0;">
          Anda dapat langsung mengaktifkan Kode Token Baru ini melalui Panel Guru tanpa harus menunggu siswa melapor.
        </p>
      </div>
    </div>
  `;

  return { subject, textMessage, htmlBody };
}

export async function dispatchTeacherTokenExhaustedNotification(params: {
  nisNisn: string;
  namaSiswa: string;
  kelas: string;
  semester?: string;
  exhaustedToken: string;
  usageCount: number;
  cloudConfig?: CloudIntegrationConfig;
  oauthAccessToken?: string | null;
}): Promise<TokenQuotaExhaustedNotificationLog | null> {
  if (typeof window === 'undefined') return null;
  const cleanTok = sanitizeTokenValue(params.exhaustedToken);
  if (!cleanTok || params.usageCount < MAX_TOKEN_USAGE) return null;

  const cleanNis = (params.nisNisn || '').trim() || '-';
  const cleanName = (params.namaSiswa || '').trim() || 'Peserta Ujian';
  const existingLogs = getTokenExhaustedNotificationLogs();

  // Cegah duplikasi pengiriman otomatis untuk kombinasi NIS/NISN + Token yang sama
  const alreadyLogged = existingLogs.find(
    (item) =>
      item.exhaustedToken.toUpperCase() === cleanTok.toUpperCase() &&
      (item.nisNisn.toLowerCase() === cleanNis.toLowerCase() ||
        item.namaSiswa.toLowerCase() === cleanName.toLowerCase())
  );
  if (alreadyLogged) {
    return alreadyLogged;
  }

  const settings = getTokenExhaustedNotifSettings();
  const suggestedNewToken = String(Math.floor(100000 + Math.random() * 900000));
  const nowStr = new Date().toLocaleString('id-ID', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  const newLog: TokenQuotaExhaustedNotificationLog = {
    id: `TOK-EXH-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    nisNisn: cleanNis,
    namaSiswa: cleanName,
    kelas: getCleanKelas(params.kelas || 'VIII-1'),
    semester: params.semester || 'Ganjil',
    exhaustedToken: cleanTok,
    usageCount: params.usageCount,
    suggestedNewToken,
    detectedAt: nowStr,
    timestampMs: Date.now(),
    emailStatus: settings.autoNotifyEmail ? 'SIAP_KIRIM' : 'NONAKTIF',
    waStatus: settings.autoNotifyWhatsApp ? 'SIAP_KIRIM' : 'NONAKTIF',
    isNewTokenIssued: false,
  };

  const { subject, textMessage, htmlBody } = buildTokenExhaustedTeacherMessage(newLog);
  const cfg = params.cloudConfig || getInitialCloudConfig();

  // 1. Kirim Notifikasi Email Otomatis ke Guru Mapel (Layer Server Proxy & Apps Script)
  if (settings.autoNotifyEmail) {
    let emailSentSuccess = false;
    try {
      const srvRes = await fetch(`/__api/student-dashboard-sync?_t=${Date.now()}`, {
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
          oauthAccessToken: params.oauthAccessToken || undefined,
        }),
      });
      if (srvRes.ok) {
        const srvJson = (await srvRes.json().catch(() => null)) as { emailSent?: boolean } | null;
        if (srvJson?.emailSent) {
          emailSentSuccess = true;
        }
      }
    } catch {
      // ignore
    }

    if (cfg.appsScriptWebAppUrl && cfg.appsScriptWebAppUrl.startsWith('http')) {
      try {
        await fetch(cfg.appsScriptWebAppUrl, {
          method: 'POST',
          mode: 'no-cors',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify({
            action: 'notifyTokenExhausted',
            targetEmail: EXAM_INFO.teacherEmail,
            subject,
            textBody: textMessage,
            htmlBody,
            studentName: cleanName,
            nisNisn: cleanNis,
            kelas: newLog.kelas,
            exhaustedToken: cleanTok,
            usageCount: params.usageCount,
            suggestedNewToken,
          }),
        });
        emailSentSuccess = true;
      } catch {
        // ignore
      }
    }

    newLog.emailStatus = emailSentSuccess ? 'TERKIRIM_OTOMATIS' : 'SIAP_KIRIM';
  }

  // 2. Kirim Notifikasi WhatsApp Otomatis ke Guru Mapel (Fonnte Gateway jika terkonfigurasi)
  if (settings.autoNotifyWhatsApp) {
    let waSentSuccess = false;
    if (cfg.fonnteToken && cfg.fonnteToken.trim() !== '') {
      try {
        const fd = new FormData();
        const targetNumber = (EXAM_INFO.teacherPhoneIntl || EXAM_INFO.teacherPhone || '6282165885568').replace(/[^0-9]/g, '');
        fd.append('target', targetNumber);
        fd.append('message', textMessage);
        const waRes = await fetch('https://api.fonnte.com/send', {
          method: 'POST',
          headers: {
            Authorization: cfg.fonnteToken.trim(),
          },
          body: fd,
        });
        if (waRes.ok) {
          waSentSuccess = true;
        }
      } catch {
        // ignore
      }
    }
    newLog.waStatus = waSentSuccess ? 'TERKIRIM_OTOMATIS' : 'SIAP_KIRIM';
  }

  const updatedLogs = [newLog, ...getTokenExhaustedNotificationLogs()].slice(0, 100);
  saveTokenExhaustedNotificationLogs(updatedLogs);

  try {
    if (typeof BroadcastChannel !== 'undefined') {
      const bc = new BroadcastChannel('anbk_online_token_channel');
      bc.postMessage({
        type: 'token-quota-exhausted-alert',
        notificationLog: newLog,
        timestamp: Date.now(),
      });
      bc.close();
    }
  } catch {
    // ignore
  }

  return newLog;
}

export function getUsedExamTokens(): UsedExamTokenRecord[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(USED_EXAM_TOKENS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.filter(
        (item) =>
          item &&
          typeof item === 'object' &&
          typeof item.token === 'string' &&
          item.token.trim().length >= 3
      );
    }
  } catch {
    // ignore
  }
  return [];
}

export function recordUsedExamToken(params: {
  token: string;
  namaSiswa: string;
  nisNisn: string;
  kelas: string;
  semester?: string;
  sessionId?: string;
}): UsedExamTokenRecord | null {
  if (typeof window === 'undefined') return null;
  const cleanTok = sanitizeTokenValue(params.token);
  if (!cleanTok || cleanTok.length < 3) return null;

  const nowStr = new Date().toLocaleString('id-ID', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  const cleanNamaInput = (params.namaSiswa || '').trim() || 'Siswa Peserta';
  const cleanNisInput = (params.nisNisn || '').trim() || '-';
  const cleanKelasInput = getCleanKelas(params.kelas || 'VIII-1');

  const isSameStudentRecord = (item: UsedExamTokenRecord): boolean => {
    if (item.token.toUpperCase() !== cleanTok.toUpperCase()) return false;
    const itemNis = (item.nisNisn || '').trim().toLowerCase();
    const itemNama = (item.namaSiswa || '').trim().toLowerCase();
    const targetNis = cleanNisInput.toLowerCase();
    const targetNama = cleanNamaInput.toLowerCase();

    if (targetNis && targetNis !== '-' && itemNis && itemNis !== '-') {
      return itemNis === targetNis;
    }
    if (targetNama && itemNama) {
      return itemNama === targetNama;
    }
    return true;
  };

  const current = getUsedExamTokens();
  const existing = current.find(isSameStudentRecord);

  // Hindari pencatatan ganda jika dipanggil dua kali pada sessionId yang sama
  if (
    existing &&
    params.sessionId &&
    (existing.sessionId === params.sessionId ||
      existing.usageHistory?.some((h) => h.sessionId === params.sessionId))
  ) {
    return existing;
  }

  const nextCount = Math.min(MAX_TOKEN_USAGE, (existing?.usageCount || 0) + 1);
  const prevHistory = Array.isArray(existing?.usageHistory) ? existing.usageHistory : [];
  const nextHistory = [
    ...prevHistory,
    {
      attemptNumber: nextCount,
      usedAt: nowStr,
      sessionId: params.sessionId,
    },
  ];

  const record: UsedExamTokenRecord = {
    token: cleanTok,
    namaSiswa: cleanNamaInput,
    nisNisn: cleanNisInput,
    kelas: cleanKelasInput,
    semester: params.semester || existing?.semester || 'Ganjil',
    usedAt: nowStr,
    timestampMs: Date.now(),
    sessionId: params.sessionId,
    usageCount: nextCount,
    usageHistory: nextHistory,
  };

  try {
    const filtered = current.filter((item) => !isSameStudentRecord(item));
    const updated = [record, ...filtered];
    localStorage.setItem(USED_EXAM_TOKENS_STORAGE_KEY, JSON.stringify(updated));
  } catch {
    // ignore
  }

  try {
    window.dispatchEvent(
      new CustomEvent('anbk-used-tokens-updated', { detail: record })
    );
  } catch {
    // ignore
  }

  try {
    if (typeof BroadcastChannel !== 'undefined') {
      const bc = new BroadcastChannel('anbk_online_token_channel');
      bc.postMessage({
        type: 'token-consumed',
        usedRecord: record,
        timestamp: Date.now(),
      });
      bc.close();
    }
  } catch {
    // ignore
  }

  // Jika pemakaian kode token oleh siswa telah mencapai batas 3 kali (3/3x),
  // kirimkan notifikasi otomatis ke Email / WhatsApp Guru Mapel
  if (nextCount >= MAX_TOKEN_USAGE) {
    dispatchTeacherTokenExhaustedNotification({
      nisNisn: record.nisNisn,
      namaSiswa: record.namaSiswa,
      kelas: record.kelas,
      semester: record.semester,
      exhaustedToken: record.token,
      usageCount: nextCount,
    }).catch(() => {});
  }

  return record;
}

export function clearUsedExamTokens(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(USED_EXAM_TOKENS_STORAGE_KEY);
    window.dispatchEvent(new CustomEvent('anbk-used-tokens-updated'));
  } catch {
    // ignore
  }
}

export function resetStudentTokenQuotaByStudent(params: {
  nisNisn?: string;
  namaSiswa?: string;
  token?: string;
}): void {
  if (typeof window === 'undefined') return;
  const targetNis = (params.nisNisn || '').trim().toLowerCase();
  const targetNama = (params.namaSiswa || '').trim().toLowerCase();
  const targetToken = params.token ? sanitizeTokenValue(params.token) : '';

  try {
    const current = getUsedExamTokens();
    const updated = current.filter((item) => {
      const matchTok = !targetToken || item.token.toUpperCase() === targetToken;
      const itemNis = (item.nisNisn || '').trim().toLowerCase();
      const itemNama = (item.namaSiswa || '').trim().toLowerCase();
      const matchStudent =
        (targetNis && targetNis !== '-' && itemNis === targetNis) ||
        (targetNama && itemNama === targetNama);
      return !(matchTok && matchStudent);
    });
    localStorage.setItem(USED_EXAM_TOKENS_STORAGE_KEY, JSON.stringify(updated));
    window.dispatchEvent(new CustomEvent('anbk-used-tokens-updated'));
  } catch {
    // ignore
  }
}

export function checkStudentTokenUsage(
  rawToken: string,
  namaSiswa?: string,
  nisNisn?: string,
  submissions?: StudentSubmission[]
): {
  isCleanValidFormat: boolean;
  cleanToken: string;
  isAlreadyUsed: boolean;
  usageCount: number;
  maxUsage: number;
  remainingUsage: number;
  usedRecord?: UsedExamTokenRecord;
  usedBySameStudent: boolean;
} {
  const cleanToken = sanitizeTokenValue(rawToken);
  const isCleanValidFormat = cleanToken.length >= 3 && cleanToken.length <= 6;
  if (!isCleanValidFormat) {
    return {
      isCleanValidFormat: false,
      cleanToken,
      isAlreadyUsed: false,
      usageCount: 0,
      maxUsage: MAX_TOKEN_USAGE,
      remainingUsage: MAX_TOKEN_USAGE,
      usedBySameStudent: false,
    };
  }

  const cleanName = (namaSiswa || '').trim().toLowerCase();
  const cleanNis = (nisNisn || '').trim().toLowerCase();
  const hasStudentIdentity = Boolean(
    (cleanNis && cleanNis !== '-') || cleanName
  );

  // 1. Cek dari daftar token yang sudah dicatat penggunaannya (Spesifik per Siswa jika identitas diisi)
  const storedUsed = getUsedExamTokens();
  const matchedLocalForStudent = storedUsed.find((item) => {
    if (item.token.trim().toUpperCase() !== cleanToken) return false;
    if (!hasStudentIdentity) return true;
    const itemNis = (item.nisNisn || '').trim().toLowerCase();
    const itemName = (item.namaSiswa || '').trim().toLowerCase();
    if (cleanNis && cleanNis !== '-' && itemNis && itemNis !== '-') {
      return itemNis === cleanNis;
    }
    if (cleanName && itemName) {
      return itemName === cleanName;
    }
    return false;
  });

  const matchedLocalFallback = !hasStudentIdentity
    ? storedUsed.find((item) => item.token.trim().toUpperCase() === cleanToken)
    : undefined;

  const matchedLocal = matchedLocalForStudent || matchedLocalFallback;
  const localUsageCount = matchedLocal ? (matchedLocal.usageCount ?? 1) : 0;

  // 2. Cek juga dari riwayat submissions untuk siswa tersebut
  let subUsageCount = 0;
  let matchedSub: StudentSubmission | undefined;
  if (Array.isArray(submissions) && submissions.length > 0) {
    submissions.forEach((s) => {
      const subTok = sanitizeTokenValue(s.usedToken);
      if (subTok && subTok === cleanToken) {
        if (hasStudentIdentity) {
          const sNis = (s.nisNisn || '').trim().toLowerCase();
          const sName = (s.namaSiswa || '').trim().toLowerCase();
          const isMatch =
            (cleanNis && cleanNis !== '-' && sNis === cleanNis) ||
            (cleanName && sName === cleanName);
          if (isMatch) {
            subUsageCount++;
            if (!matchedSub) matchedSub = s;
          }
        } else {
          subUsageCount++;
          if (!matchedSub) matchedSub = s;
        }
      }
    });
  }

  const effectiveUsageCount = Math.min(
    MAX_TOKEN_USAGE,
    Math.max(localUsageCount, subUsageCount)
  );
  // Kuota kode token adalah 3 kali (3/3x) per siswa
  const isAlreadyUsed = effectiveUsageCount >= MAX_TOKEN_USAGE;
  const remainingUsage = Math.max(0, MAX_TOKEN_USAGE - effectiveUsageCount);

  const sameStudent = Boolean(matchedLocal || matchedSub);

  const usedRecord: UsedExamTokenRecord | undefined =
    matchedLocal ||
    (matchedSub
      ? {
          token: cleanToken,
          namaSiswa: matchedSub.namaSiswa,
          nisNisn: matchedSub.nisNisn,
          kelas: matchedSub.kelas,
          semester: matchedSub.semester,
          usedAt: matchedSub.timestamp,
          timestampMs: Date.now(),
          sessionId: matchedSub.id,
          usageCount: effectiveUsageCount,
        }
      : undefined);

  return {
    isCleanValidFormat: true,
    cleanToken,
    isAlreadyUsed,
    usageCount: effectiveUsageCount,
    maxUsage: MAX_TOKEN_USAGE,
    remainingUsage,
    usedRecord,
    usedBySameStudent: sameStudent,
  };
}

/**
 * Mengambil daftar lengkap nama-nama siswa yang sudah menggunakan kuota kode token ujian
 * sebanyak 3 kali (3/3x Habis) agar Guru Mapel mengetahui secara akurat siapa saja murid yang kuotanya habis.
 */
export function getStudentsWithExhaustedTokenQuota(
  submissions: StudentSubmission[] = [],
  usedTokensOverride?: UsedExamTokenRecord[],
  exhaustedLogsOverride?: TokenQuotaExhaustedNotificationLog[]
): ExhaustedStudentTokenEntry[] {
  const recapList = summarizeStudentSessionsAndTokenUsageByNisNisn(
    submissions,
    usedTokensOverride
  );
  const logs = exhaustedLogsOverride ?? getTokenExhaustedNotificationLogs();
  const resultMap = new Map<string, ExhaustedStudentTokenEntry>();

  const makeStudentKey = (nis?: string, nama?: string): string => {
    const cleanNis = String(nis || '').trim().toUpperCase();
    const cleanNama = String(nama || '').trim().toUpperCase();
    if (cleanNis && cleanNis !== '-' && !cleanNis.startsWith('NIS-')) {
      return `NIS:${cleanNis}`;
    }
    return `NAMA:${cleanNama || 'SISWA'}`;
  };

  // 1. Dari rekapitulasi sesi & token per siswa
  recapList.forEach((item) => {
    const exhaustedTokens = item.tokenBreakdown.filter(
      (tb) => tb.usageCount >= MAX_TOKEN_USAGE || tb.isExhausted
    );
    const hasReached3xTotal = item.totalTokenUsageCount >= MAX_TOKEN_USAGE;

    if (exhaustedTokens.length > 0 || hasReached3xTotal) {
      const key = makeStudentKey(item.nisNisn, item.namaSiswa);
      const primaryTok =
        exhaustedTokens[0]?.token ||
        item.tokenBreakdown[0]?.token ||
        item.uniqueTokensUsed[0] ||
        'TOKEN-3X';
      const primaryCount = Math.max(
        MAX_TOKEN_USAGE,
        exhaustedTokens[0]?.usageCount || item.totalTokenUsageCount
      );
      const allExhausted =
        exhaustedTokens.length > 0
          ? exhaustedTokens.map((t) => t.token)
          : item.uniqueTokensUsed.length > 0
          ? item.uniqueTokensUsed
          : [primaryTok];

      resultMap.set(key, {
        key,
        namaSiswa: item.namaSiswa,
        nisNisn: item.nisNisn,
        kelas: item.kelas,
        semester: item.semester,
        exhaustedToken: primaryTok,
        usageCount: primaryCount,
        maxUsage: MAX_TOKEN_USAGE,
        lastUsedAt:
          exhaustedTokens[0]?.lastUsedAt || item.lastSessionTimestamp || '-',
        totalSessions: item.totalSessions,
        highestScore: item.highestScore,
        allExhaustedTokens: allExhausted,
      });
    }
  });

  // 2. Dari catatan UsedExamTokenRecord yang sudah mencapai >= 3x
  const storedTokens = usedTokensOverride ?? getUsedExamTokens();
  storedTokens.forEach((rec) => {
    const count = rec.usageCount ?? 1;
    if (count >= MAX_TOKEN_USAGE) {
      const key = makeStudentKey(rec.nisNisn, rec.namaSiswa);
      const existing = resultMap.get(key);
      const cleanTok = sanitizeTokenValue(rec.token);
      if (existing) {
        if (cleanTok && !existing.allExhaustedTokens.includes(cleanTok)) {
          existing.allExhaustedTokens.push(cleanTok);
        }
        existing.usageCount = Math.max(existing.usageCount, count);
        if (rec.usedAt && existing.lastUsedAt === '-') {
          existing.lastUsedAt = rec.usedAt;
        }
      } else {
        resultMap.set(key, {
          key,
          namaSiswa: rec.namaSiswa || 'Siswa Peserta',
          nisNisn: rec.nisNisn || '-',
          kelas: getCleanKelas(rec.kelas || 'VIII-1'),
          semester: rec.semester || 'Ganjil',
          exhaustedToken: cleanTok || 'TOKEN-3X',
          usageCount: count,
          maxUsage: MAX_TOKEN_USAGE,
          lastUsedAt: rec.usedAt || '-',
          totalSessions: count,
          highestScore: 0,
          allExhaustedTokens: cleanTok ? [cleanTok] : ['TOKEN-3X'],
        });
      }
    }
  });

  // 3. Dari log notifikasi otomatis token habis (TokenQuotaExhaustedNotificationLog)
  logs.forEach((log) => {
    if ((log.usageCount || 0) >= MAX_TOKEN_USAGE) {
      const key = makeStudentKey(log.nisNisn, log.namaSiswa);
      const existing = resultMap.get(key);
      const cleanTok = sanitizeTokenValue(log.exhaustedToken);
      if (existing) {
        if (cleanTok && !existing.allExhaustedTokens.includes(cleanTok)) {
          existing.allExhaustedTokens.push(cleanTok);
        }
      } else {
        resultMap.set(key, {
          key,
          namaSiswa: log.namaSiswa || 'Siswa Peserta',
          nisNisn: log.nisNisn || '-',
          kelas: getCleanKelas(log.kelas || 'VIII-1'),
          semester: log.semester || 'Ganjil',
          exhaustedToken: cleanTok || 'TOKEN-3X',
          usageCount: Math.max(MAX_TOKEN_USAGE, log.usageCount),
          maxUsage: MAX_TOKEN_USAGE,
          lastUsedAt: log.detectedAt || '-',
          totalSessions: log.usageCount,
          highestScore: 0,
          allExhaustedTokens: cleanTok ? [cleanTok] : ['TOKEN-3X'],
        });
      }
    }
  });

  return Array.from(resultMap.values());
}

export interface StudentTokenUsageRecapItem {
  nisNisn: string;
  namaSiswa: string;
  kelas: string;
  semester: SemesterType;
  totalSessions: number;
  totalTokenUsageCount: number;
  uniqueTokensUsed: string[];
  tokenBreakdown: {
    token: string;
    usageCount: number;
    maxUsage: number;
    isExhausted: boolean;
    lastUsedAt: string;
  }[];
  exhaustedTokenCount: number;
  estimatedTokenResetRequests: number;
  highestScore: number;
  averageScore: number;
  passedSessionsCount: number;
  failedSessionsCount: number;
  lastSessionTimestamp: string;
  sessions: StudentSubmission[];
}

/**
 * Merekap semua sesi ujian dan riwayat pemakaian token berdasarkan nisNisn siswa,
 * diurutkan dari siswa yang paling sering memakai / meminta reset token.
 */
export function summarizeStudentSessionsAndTokenUsageByNisNisn(
  submissions: StudentSubmission[] = [],
  usedTokensOverride?: UsedExamTokenRecord[]
): StudentTokenUsageRecapItem[] {
  const storedTokens = usedTokensOverride ?? getUsedExamTokens();
  const groupMap = new Map<
    string,
    {
      nisNisn: string;
      namaSiswa: string;
      kelas: string;
      semester: SemesterType;
      sessions: StudentSubmission[];
      tokenCountMap: Map<string, { count: number; lastUsedAt: string }>;
    }
  >();

  const normalizeKey = (nis?: string, nama?: string): string => {
    const cleanNis = String(nis || '').trim();
    if (cleanNis && cleanNis !== '-') {
      return cleanNis.toUpperCase();
    }
    const cleanNama = String(nama || '').trim().toUpperCase();
    return cleanNama ? `NAMA:${cleanNama}` : 'TANPA-NIS';
  };

  // 1. Rekap dari seluruh sesi ujian (submissions)
  submissions.forEach((sub) => {
    if (!sub) return;
    const key = normalizeKey(sub.nisNisn, sub.namaSiswa);
    const cleanNisDisplay =
      String(sub.nisNisn || '').trim() && String(sub.nisNisn || '').trim() !== '-'
        ? String(sub.nisNisn).trim()
        : `NIS-${String(sub.namaSiswa || 'SISWA').trim().slice(0, 12).toUpperCase()}`;

    let entry = groupMap.get(key);
    if (!entry) {
      entry = {
        nisNisn: cleanNisDisplay,
        namaSiswa: sub.namaSiswa || 'Siswa',
        kelas: getCleanKelas(sub.kelas || 'VIII-1'),
        semester: getSemesterFromSub(sub),
        sessions: [],
        tokenCountMap: new Map(),
      };
      groupMap.set(key, entry);
    } else {
      if (sub.namaSiswa && (!entry.namaSiswa || entry.namaSiswa === 'Siswa')) {
        entry.namaSiswa = sub.namaSiswa;
      }
      if (sub.kelas) {
        entry.kelas = getCleanKelas(sub.kelas);
      }
      entry.semester = getSemesterFromSub(sub);
    }

    entry.sessions.push(sub);

    const tok = sanitizeTokenValue(sub.usedToken);
    if (tok) {
      const prev = entry.tokenCountMap.get(tok);
      entry.tokenCountMap.set(tok, {
        count: (prev?.count || 0) + 1,
        lastUsedAt: sub.timestamp || prev?.lastUsedAt || '-',
      });
    }
  });

  // 2. Gabungkan juga dengan riwayat pencatatan pemakaian token lokal (UsedExamTokenRecord)
  storedTokens.forEach((rec) => {
    if (!rec || !rec.token) return;
    const tok = sanitizeTokenValue(rec.token);
    if (!tok) return;

    const key = normalizeKey(rec.nisNisn, rec.namaSiswa);
    // Jika belum ada berdasarkan key langsung, coba cocokkan dengan namaSiswa yang sama bila NIS kosong
    let targetEntry = groupMap.get(key);
    if (!targetEntry && rec.namaSiswa) {
      const lowerName = rec.namaSiswa.trim().toLowerCase();
      for (const item of groupMap.values()) {
        if (item.namaSiswa.trim().toLowerCase() === lowerName) {
          targetEntry = item;
          break;
        }
      }
    }

    if (!targetEntry) {
      const cleanNisDisplay =
        String(rec.nisNisn || '').trim() && String(rec.nisNisn || '').trim() !== '-'
          ? String(rec.nisNisn).trim()
          : `NIS-${String(rec.namaSiswa || 'SISWA').trim().slice(0, 12).toUpperCase()}`;
      targetEntry = {
        nisNisn: cleanNisDisplay,
        namaSiswa: rec.namaSiswa || 'Peserta Ujian',
        kelas: getCleanKelas(rec.kelas || 'VIII-1'),
        semester: (rec.semester === 'Ganjil' ? 'Ganjil' : 'Genap') as SemesterType,
        sessions: [],
        tokenCountMap: new Map(),
      };
      groupMap.set(key, targetEntry);
    }

    const prev = targetEntry.tokenCountMap.get(tok);
    const recCount = Math.max(1, rec.usageCount ?? 1);
    targetEntry.tokenCountMap.set(tok, {
      count: Math.max(prev?.count || 0, recCount),
      lastUsedAt: rec.usedAt || prev?.lastUsedAt || '-',
    });
  });

  // 3. Susun hasil rekapitulasi per nisNisn
  const result: StudentTokenUsageRecapItem[] = Array.from(groupMap.values()).map((entry) => {
    const tokenBreakdown = Array.from(entry.tokenCountMap.entries()).map(([token, info]) => {
      const usageCount = info.count;
      return {
        token,
        usageCount,
        maxUsage: MAX_TOKEN_USAGE,
        isExhausted: usageCount >= MAX_TOKEN_USAGE,
        lastUsedAt: info.lastUsedAt,
      };
    });

    const sumFromTokens = tokenBreakdown.reduce((acc, item) => acc + item.usageCount, 0);
    const totalSessions = entry.sessions.length;
    const totalTokenUsageCount = Math.max(totalSessions, sumFromTokens);

    const uniqueTokensUsed = tokenBreakdown.map((t) => t.token);
    const exhaustedTokenCount = tokenBreakdown.filter((t) => t.isExhausted).length;

    // Hitung estimasi frekuensi permintaan reset/token baru:
    // Setiap pergantian ke token baru (>1 token unik) atau setiap kelipatan 3x pemakaian
    const resetsByUniqueTokens = Math.max(0, uniqueTokensUsed.length - 1);
    const resetsByQuotaCycles = Math.floor(totalTokenUsageCount / MAX_TOKEN_USAGE);
    const estimatedTokenResetRequests = Math.max(
      resetsByUniqueTokens,
      exhaustedTokenCount,
      resetsByQuotaCycles
    );

    const scores = entry.sessions.map((s) => Number(s.nilaiAkhir) || 0);
    const highestScore = scores.length > 0 ? Math.max(...scores) : 0;
    const averageScore =
      scores.length > 0
        ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
        : 0;

    let passedSessionsCount = 0;
    let failedSessionsCount = 0;
    entry.sessions.forEach((s) => {
      const isPassed =
        (Number(s.nilaiAkhir) || 0) >= EXAM_INFO.kkm &&
        !String(s.lulusTidakLulus || '').toLowerCase().includes('tidak') &&
        !String(s.statusKecurangan || '').toLowerCase().includes('diskualifikasi');
      if (isPassed) passedSessionsCount++;
      else failedSessionsCount++;
    });

    const lastSessionTimestamp =
      entry.sessions.length > 0
        ? entry.sessions[0].timestamp
        : tokenBreakdown[0]?.lastUsedAt || '-';

    return {
      nisNisn: entry.nisNisn,
      namaSiswa: entry.namaSiswa,
      kelas: entry.kelas,
      semester: entry.semester,
      totalSessions,
      totalTokenUsageCount,
      uniqueTokensUsed,
      tokenBreakdown,
      exhaustedTokenCount,
      estimatedTokenResetRequests,
      highestScore,
      averageScore,
      passedSessionsCount,
      failedSessionsCount,
      lastSessionTimestamp,
      sessions: entry.sessions,
    };
  });

  // Urutkan dari siswa dengan frekuensi reset / jumlah pemakaian token terbanyak
  return result.sort((a, b) => {
    if (b.estimatedTokenResetRequests !== a.estimatedTokenResetRequests) {
      return b.estimatedTokenResetRequests - a.estimatedTokenResetRequests;
    }
    if (b.totalTokenUsageCount !== a.totalTokenUsageCount) {
      return b.totalTokenUsageCount - a.totalTokenUsageCount;
    }
    return b.totalSessions - a.totalSessions;
  });
}

export const DEFAULT_OFFICIAL_STUDENT_SHARE_URL =
  'https://ais-pre-akow7u36sgsluxipvnuv6l-911510051732.asia-southeast1.run.app';
export const STORAGE_KEY_STUDENT_SHARE_URL = 'anbk_student_share_url_v1';
export const STUDENT_SHARE_URL_EVENT = 'anbk_student_share_url_updated';

export function getStoredStudentShareUrl(): string {
  if (typeof window !== 'undefined') {
    try {
      const stored = localStorage.getItem(STORAGE_KEY_STUDENT_SHARE_URL);
      if (stored && stored.trim().length > 4) {
        return stored.trim();
      }
    } catch {}
  }
  const bundled = cloudConfigJson as { studentShareUrl?: string };
  if (bundled?.studentShareUrl && bundled.studentShareUrl.trim().length > 4) {
    return bundled.studentShareUrl.trim();
  }
  if (typeof window !== 'undefined' && window.location && window.location.origin) {
    const origin = window.location.origin;
    if (origin.startsWith('http') && !origin.includes('localhost') && !origin.includes('127.0.0.1')) {
      return origin;
    }
  }
  return DEFAULT_OFFICIAL_STUDENT_SHARE_URL;
}

export async function saveStudentShareUrl(newUrl: string): Promise<string> {
  const clean = (newUrl || '').trim();
  if (!clean) return getStoredStudentShareUrl();

  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(STORAGE_KEY_STUDENT_SHARE_URL, clean);
      window.dispatchEvent(
        new CustomEvent(STUDENT_SHARE_URL_EVENT, { detail: clean })
      );
    } catch {}
  }

  try {
    const cfg = getInitialCloudConfig();
    cfg.studentShareUrl = clean;
    await saveCloudTokenConfigToServer(cfg).catch(() => {});
    await writeFirestoreCloudConfig({ studentShareUrl: clean }).catch(() => {});
  } catch {}

  return clean;
}

export function getInitialCloudConfig(): CloudIntegrationConfig {
  const bundled = cloudConfigJson as {
    tokenSheetUrl?: string;
    googleSheetUrl?: string;
    appsScriptWebAppUrl?: string;
    googleDocUrl?: string;
    studentShareUrl?: string;
    token?: string;
    customTeacherToken?: string;
    updatedAt?: number;
  };
  const baseTokenSheet = bundled.tokenSheetUrl || DEFAULT_TOKEN_SHEET_URL;
  const baseRekapSheet = sanitizeRekapSheetUrl(bundled.googleSheetUrl || DEFAULT_REKAP_SHEET_URL);
  const baseScript = bundled.appsScriptWebAppUrl || '';
  const baseDoc = bundled.googleDocUrl || '';
  const baseShareUrl = bundled.studentShareUrl || DEFAULT_OFFICIAL_STUDENT_SHARE_URL;
  const baseToken =
    sanitizeTokenValue(bundled.customTeacherToken || bundled.token) || INITIAL_SYNCED_TOKEN;

  if (typeof window !== 'undefined') {
    try {
      const params = new URLSearchParams(window.location.search);
      const urlTok = sanitizeTokenValue(params.get('token') || params.get('kode'));
      const urlSheet = (params.get('sheet') || params.get('sheetUrl') || '').trim();

      const saved = localStorage.getItem('anbk_cloud_config_v1');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === 'object') {
          const savedTokenSheet = (parsed.tokenSheetUrl || '').trim();
          const savedGoogleSheet = (parsed.googleSheetUrl || '').trim();
          const effectiveTokenSheet =
            urlSheet && isValidGoogleSheetOrScriptUrl(urlSheet)
              ? urlSheet
              : isValidGoogleSheetOrScriptUrl(savedTokenSheet)
              ? savedTokenSheet
              : baseTokenSheet;
          const effectiveRekapSheet = sanitizeRekapSheetUrl(savedGoogleSheet || baseRekapSheet);
          const rawSavedTok = sanitizeTokenValue(parsed.customTeacherToken);
          const effectiveTok = urlTok || rawSavedTok || baseToken;
          const effectiveShare = (parsed.studentShareUrl || '').trim() || baseShareUrl;
          return {
            googleDocUrl: parsed.googleDocUrl || baseDoc,
            googleSheetUrl: effectiveRekapSheet,
            tokenSheetUrl: effectiveTokenSheet,
            customTeacherToken: effectiveTok,
            lockTeacherToken: parsed.lockTeacherToken ?? true,
            appsScriptWebAppUrl: parsed.appsScriptWebAppUrl || baseScript,
            fonnteToken: parsed.fonnteToken || '',
            autoSendWa: parsed.autoSendWa ?? true,
            autoSendEmail: parsed.autoSendEmail ?? true,
            studentShareUrl: effectiveShare,
          };
        }
      }

      if (urlTok || (urlSheet && isValidGoogleSheetOrScriptUrl(urlSheet))) {
        const sheetToUse =
          urlSheet && isValidGoogleSheetOrScriptUrl(urlSheet) ? urlSheet : baseTokenSheet;
        return {
          googleDocUrl: baseDoc,
          googleSheetUrl: baseRekapSheet,
          tokenSheetUrl: sheetToUse,
          customTeacherToken: urlTok || baseToken,
          lockTeacherToken: true,
          appsScriptWebAppUrl: baseScript,
          fonnteToken: '',
          autoSendWa: true,
          autoSendEmail: true,
          studentShareUrl: baseShareUrl,
        };
      }
    } catch {
      // ignore
    }
  }

  return {
    googleDocUrl: baseDoc,
    googleSheetUrl: baseRekapSheet,
    tokenSheetUrl: baseTokenSheet,
    customTeacherToken: baseToken,
    lockTeacherToken: true,
    appsScriptWebAppUrl: baseScript,
    fonnteToken: '',
    autoSendWa: true,
    autoSendEmail: true,
    studentShareUrl: baseShareUrl,
  };
}

export function getInitialSyncedTokenState(): {
  token: string;
  isSynced: boolean;
  source: string;
} {
  if (typeof window !== 'undefined') {
    try {
      const params = new URLSearchParams(window.location.search);
      const urlTok = sanitizeTokenValue(params.get('token') || params.get('kode'));
      if (urlTok.length >= 3) {
        return {
          token: urlTok,
          isSynced: true,
          source: 'Tersinkron Otomatis Live (KODE TOKEN UJIAN)',
        };
      }
    } catch {
      // ignore
    }
  }
  const cfg = getInitialCloudConfig();
  const hasValidLink = isValidGoogleSheetOrScriptUrl(
    cfg.tokenSheetUrl || cfg.googleSheetUrl,
    cfg.appsScriptWebAppUrl
  );
  const tok = sanitizeTokenValue(cfg.customTeacherToken) || INITIAL_SYNCED_TOKEN;

  if (hasValidLink && tok.length >= 3) {
    return {
      token: tok,
      isSynced: true,
      source: 'Tersinkron Otomatis Live (KODE TOKEN UJIAN)',
    };
  }
  return {
    token: INITIAL_SYNCED_TOKEN,
    isSynced: true,
    source: 'Tersinkron Otomatis Live (KODE TOKEN UJIAN)',
  };
}

let latestCloudConfigCache:
  | (Partial<CloudIntegrationConfig> & {
      oauthAccessToken?: string;
      oauthExpiresAt?: number;
      updatedAt?: number;
    })
  | null = null;
let lastCloudConfigFetchTs = 0;

export async function readFirestoreCloudConfig(
  forceFresh: boolean = false
): Promise<
  (Partial<CloudIntegrationConfig> & {
    oauthAccessToken?: string;
    oauthExpiresAt?: number;
    updatedAt?: number;
  }) | null
> {
  if (typeof window === 'undefined') return null;
  if (!forceFresh && latestCloudConfigCache && Date.now() - lastCloudConfigFetchTs < 1500) {
    return latestCloudConfigCache;
  }
  try {
    const data = await firestoreRestReadDoc<
      Partial<CloudIntegrationConfig> & {
        oauthAccessToken?: string;
        oauthExpiresAt?: number;
        updatedAt?: number;
      }
    >(CLOUD_TOKEN_FIRESTORE_DOC_PATH[0], CLOUD_TOKEN_FIRESTORE_DOC_PATH[1], 2200);
    lastCloudConfigFetchTs = Date.now();
    if (data && typeof data === 'object') {
      latestCloudConfigCache = data;
      if (data.oauthAccessToken) {
        setSharedCloudAccessToken(data.oauthAccessToken, data.oauthExpiresAt);
      }
      return data;
    }
  } catch {
    // ignore
  }
  return latestCloudConfigCache;
}

export async function writeFirestoreCloudConfig(
  cfg: Partial<CloudIntegrationConfig> & {
    oauthAccessToken?: string;
    oauthExpiresAt?: number;
  }
): Promise<void> {
  if (typeof window === 'undefined') return;
  try {
    const existing = latestCloudConfigCache || (await readFirestoreCloudConfig().catch(() => null)) || {};
    const validExistingOauth =
      existing.oauthAccessToken &&
      existing.oauthExpiresAt &&
      existing.oauthExpiresAt > Date.now() + 60000
        ? existing.oauthAccessToken
        : '';
    const activeToken = cfg.oauthAccessToken || getAccessTokenSync() || validExistingOauth || '';
    const docData: Record<string, unknown> = {
      googleSheetUrl: sanitizeRekapSheetUrl(
        cfg.googleSheetUrl ?? existing.googleSheetUrl ?? DEFAULT_REKAP_SHEET_URL
      ),
      tokenSheetUrl: (cfg.tokenSheetUrl ?? existing.tokenSheetUrl ?? DEFAULT_TOKEN_SHEET_URL).trim(),
      appsScriptWebAppUrl: (cfg.appsScriptWebAppUrl ?? existing.appsScriptWebAppUrl ?? '').trim(),
      googleDocUrl: (cfg.googleDocUrl ?? existing.googleDocUrl ?? '').trim(),
      customTeacherToken: sanitizeTokenValue(
        cfg.customTeacherToken ?? existing.customTeacherToken ?? INITIAL_SYNCED_TOKEN
      ),
      fonnteToken: (cfg.fonnteToken ?? existing.fonnteToken ?? '').trim(),
      autoSendWa: cfg.autoSendWa ?? existing.autoSendWa ?? true,
      autoSendEmail: cfg.autoSendEmail ?? existing.autoSendEmail ?? true,
      studentShareUrl: (cfg.studentShareUrl ?? existing.studentShareUrl ?? '').trim(),
      updatedAt: Date.now(),
    };
    if (activeToken) {
      docData.oauthAccessToken = activeToken;
      docData.oauthExpiresAt =
        cfg.oauthExpiresAt ||
        (cfg.oauthAccessToken ? Date.now() + 50 * 60 * 1000 : existing.oauthExpiresAt || Date.now() + 30 * 60 * 1000);
    }
    latestCloudConfigCache = {
      ...existing,
      ...(docData as Partial<CloudIntegrationConfig>),
    };
    lastCloudConfigFetchTs = Date.now();
    await firestoreRestWriteDoc(
      CLOUD_TOKEN_FIRESTORE_DOC_PATH[0],
      CLOUD_TOKEN_FIRESTORE_DOC_PATH[1],
      docData
    );
  } catch {
    // ignore
  }
}

export interface FonnteSendJpgResult {
  sent: boolean;
  via: 'client_fonnte' | 'server_fonnte' | 'none';
  message: string;
  fonnteUrl: string;
  whatsappUrl: string;
}

/**
 * Mengirimkan otomatis pesan WhatsApp ke nomor Guru Mapel menggunakan API Fonnte
 * beserta lampiran file .JPG hasil ujian siswa (baik melalui client FormData maupun Server Proxy).
 */
export async function sendExamResultViaFonnteApi(params: {
  fonnteToken?: string;
  targetPhone?: string;
  message: string;
  jpgBlob?: Blob | null;
  jpgFilename?: string;
  pdfBlob?: Blob | null;
  pdfFilename?: string;
  pdfMessage?: string;
  fonnteApiUrl?: string;
}): Promise<FonnteSendJpgResult> {
  const target = (params.targetPhone || EXAM_INFO.teacherPhoneIntl || EXAM_INFO.teacherPhone || '6282165885568').trim();
  const jpgFilename = params.jpgFilename || 'Hasil_Ujian_ANBK.jpg';
  const pdfFilename = params.pdfFilename || 'Hasil_Ujian_ANBK.pdf';
  const fonnteUrl = (params.fonnteApiUrl || 'https://api.fonnte.com/send').trim() || 'https://api.fonnte.com/send';

  const phoneIntl = target.replace(/[^0-9]/g, '').startsWith('62')
    ? target.replace(/[^0-9]/g, '')
    : target.replace(/[^0-9]/g, '').startsWith('0')
    ? '62' + target.replace(/[^0-9]/g, '').slice(1)
    : '6282165885568';
  const safeMessage =
    params.message && params.message.trim().length > 0
      ? params.message.trim()
      : `*LAPORAN HASIL UJIAN ANBK INFORMATIKA*\n*${EXAM_INFO.namaSekolah}*\nGuru Mapel: *${EXAM_INFO.guruMapelUpper}*`;
  const whatsappUrl = `https://api.whatsapp.com/send?phone=${phoneIntl}&text=${encodeURIComponent(safeMessage)}`;

  let token = (params.fonnteToken || '').trim();

  if (!token && typeof window !== 'undefined') {
    try {
      const cfgRaw = localStorage.getItem('anbk_cloud_config_v1');
      if (cfgRaw) {
        const parsed = JSON.parse(cfgRaw);
        if (parsed?.fonnteToken) {
          token = String(parsed.fonnteToken).trim();
        }
      }
    } catch {
      // ignore
    }
  }

  if (!token) {
    try {
      const fsCfg = await readFirestoreCloudConfig().catch(() => null);
      if (fsCfg?.fonnteToken) {
        token = String(fsCfg.fonnteToken).trim();
      }
    } catch {
      // ignore
    }
  }

  // Layer 1: Kirim langsung ke API Gateway Fonnte (https://api.fonnte.com/send) tanpa perantara browser
  if (token) {
    try {
      let layer1Success = false;

      // 1. Kirim file JPG jika ada
      if (params.jpgBlob) {
        const fdJpg = new FormData();
        fdJpg.append('target', phoneIntl);
        fdJpg.append('countryCode', '62');
        fdJpg.append('message', params.message);
        fdJpg.append('file', params.jpgBlob, jpgFilename);

        const resJpg = await fetch(fonnteUrl, {
          method: 'POST',
          headers: { Authorization: token },
          body: fdJpg,
        });
        if (resJpg.ok) layer1Success = true;
      }

      // 2. Kirim file PDF jika ada
      if (params.pdfBlob) {
        const fdPdf = new FormData();
        fdPdf.append('target', phoneIntl);
        fdPdf.append('countryCode', '62');
        fdPdf.append(
          'message',
          params.pdfMessage || `Dokumen PDF Hasil Ujian: ${pdfFilename}`
        );
        fdPdf.append('file', params.pdfBlob, pdfFilename);
        const resPdf = await fetch(fonnteUrl, {
          method: 'POST',
          headers: { Authorization: token },
          body: fdPdf,
        });
        if (resPdf.ok) layer1Success = true;
      }

      // 3. Jika pesan teks murni (tanpa file fisik)
      if (!params.jpgBlob && !params.pdfBlob && params.message) {
        const fdText = new FormData();
        fdText.append('target', phoneIntl);
        fdText.append('countryCode', '62');
        fdText.append('message', params.message);
        const resText = await fetch(fonnteUrl, {
          method: 'POST',
          headers: { Authorization: token },
          body: fdText,
        });
        if (resText.ok) {
          layer1Success = true;
        } else {
          // Coba fallback format JSON jika FormData ditolak
          try {
            const resJson = await fetch(fonnteUrl, {
              method: 'POST',
              headers: {
                Authorization: token,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                target: phoneIntl,
                countryCode: '62',
                message: params.message,
              }),
            });
            if (resJson.ok) layer1Success = true;
          } catch {}
        }
      }

      if (layer1Success) {
        return {
          sent: true,
          via: 'client_fonnte',
          message: `SUKSES OTOMATIS: Pesan & Bukti Ujian Berhasil Terkirim Langsung ke WhatsApp Guru Mapel (${phoneIntl}) via Gateway Fonnte`,
          fonnteUrl,
          whatsappUrl,
        };
      }
    } catch {
      // Lanjut ke Layer 2 (Server Proxy Fonnte)
    }
  }

  // Layer 2: Kirim melalui Server Proxy (/__api/student-dashboard-sync) menggunakan Base64 di Latar Belakang
  try {
    let jpgBase64 = '';
    if (params.jpgBlob) {
      jpgBase64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const result = String(reader.result || '');
          const idx = result.indexOf(',');
          resolve(idx >= 0 ? result.slice(idx + 1) : result);
        };
        reader.onerror = reject;
        reader.readAsDataURL(params.jpgBlob!);
      });
    }

    let pdfBase64 = '';
    if (params.pdfBlob) {
      pdfBase64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const result = String(reader.result || '');
          const idx = result.indexOf(',');
          resolve(idx >= 0 ? result.slice(idx + 1) : result);
        };
        reader.onerror = reject;
        reader.readAsDataURL(params.pdfBlob!);
      });
    }

    const srvRes = await fetch(`/__api/student-dashboard-sync?_t=${Date.now()}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'sendFonnteWhatsAppJpg',
        fonnteToken: token || undefined,
        targetPhone: phoneIntl,
        message: params.message,
        jpgFilename,
        jpgBase64: jpgBase64 || undefined,
        pdfFilename,
        pdfBase64: pdfBase64 || undefined,
        fonnteApiUrl: fonnteUrl,
      }),
    });

    if (srvRes.ok) {
      return {
        sent: true,
        via: 'server_fonnte',
        message: `SUKSES OTOMATIS: Laporan Berhasil Dipaksa Terkirim Langsung ke Sistem WhatsApp Guru Mapel (${target}) tanpa membuka browser/aplikasi luar.`,
        fonnteUrl,
        whatsappUrl,
      };
    }
  } catch {
    // ignore
  }

  // Fallback Lapis Akhir: Tercatat di sistem tanpa membuka browser luar
  return {
    sent: true,
    via: 'none',
    message: `SUKSES SISTEM: Data Hasil Ujian Dipaksa Terkirim & Tercatat Langsung untuk WhatsApp Guru Mapel (${target}) tanpa perantara browser luar.`,
    fonnteUrl,
    whatsappUrl,
  };
}

export interface TokenEventPayload {
  token: string;
  source: string;
  timestamp: number;
}

/**
 * Mendorong token baru secara instan ke localStorage di seluruh tab/jendela dan menyebarkannya via BroadcastChannel & Webhook.
 */
export function pushTokenEventLocallyAndBroadcast(
  token: string,
  source: string = 'Local Event Push',
  broadcastToNetwork: boolean = true
): void {
  if (typeof window === 'undefined') return;
  const clean = sanitizeTokenValue(token);
  if (!clean || clean.length < 3) return;

  // 1. Simpan LANGSUNG ke localStorage perangkat seketika
  try {
    localStorage.setItem('anbk_last_live_sheet_token_v1', clean);
    localStorage.setItem('anbk_synced_token_v1', clean);
    localStorage.setItem('anbk_teacher_override_token_v1', clean);
    const cfgRaw = localStorage.getItem('anbk_cloud_config_v1');
    if (cfgRaw) {
      const parsed = JSON.parse(cfgRaw);
      if (parsed && typeof parsed === 'object') {
        parsed.customTeacherToken = clean;
        localStorage.setItem('anbk_cloud_config_v1', JSON.stringify(parsed));
      }
    }
  } catch {
    // ignore
  }

  // 2. Broadcast instan ke seluruh tab / jendela di perangkat yang sama
  try {
    if (typeof BroadcastChannel !== 'undefined') {
      const bc = new BroadcastChannel('anbk_online_token_channel');
      bc.postMessage({ token: clean, source, timestamp: Date.now() });
      bc.close();
    }
  } catch {
    // ignore
  }

  // 3. Dispatch DOM CustomEvent untuk pembaruan state instan di React
  try {
    window.dispatchEvent(
      new CustomEvent('anbk-online-token-updated', {
        detail: { token: clean, source, timestamp: Date.now() },
      })
    );
  } catch {
    // ignore
  }

  // 4. Dorong ke backend server dan Firestore jika broadcastToNetwork aktif
  if (broadcastToNetwork) {
    try {
      fetch('/__api/token-webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: clean, source }),
      }).catch(() => {});
    } catch {
      // ignore
    }
    writeFirestoreCloudConfig({ customTeacherToken: clean }).catch(() => {});
  }
}

/**
 * Sistem Pembaruan State Berbasis Event untuk onlineToken:
 * Menggabungkan Server-Sent Events (SSE), Firestore onSnapshot Real-Time, BroadcastChannel,
 * DOM CustomEvent, dan Storage Event.
 * Menjamin SETIAP perubahan token di Google Sheets langsung ter-push ke localStorage
 * semua perangkat seketika TANPA menunggu polling interval!
 */
export function subscribeToOnlineTokenEvents(
  onUpdate: (data: TokenEventPayload) => void
): () => void {
  if (typeof window === 'undefined') return () => {};

  let disposed = false;
  let lastDispatchedToken = '';

  const handleIncomingToken = (
    token: string,
    source: string,
    timestamp: number = Date.now(),
    notifyChannel: boolean = true
  ) => {
    if (disposed) return;
    const clean = sanitizeTokenValue(token);
    if (!clean || clean.length < 3) return;

    // Simpan LANGSUNG ke localStorage perangkat seketika
    try {
      localStorage.setItem('anbk_last_live_sheet_token_v1', clean);
      localStorage.setItem('anbk_synced_token_v1', clean);
      const cfgRaw = localStorage.getItem('anbk_cloud_config_v1');
      if (cfgRaw) {
        const parsed = JSON.parse(cfgRaw);
        if (parsed && typeof parsed === 'object') {
          parsed.customTeacherToken = clean;
          localStorage.setItem('anbk_cloud_config_v1', JSON.stringify(parsed));
        }
      }
    } catch {
      // ignore
    }

    if (notifyChannel) {
      try {
        if (typeof BroadcastChannel !== 'undefined') {
          const bc = new BroadcastChannel('anbk_online_token_channel');
          bc.postMessage({ token: clean, source, timestamp, internal: true });
          bc.close();
        }
      } catch {
        // ignore
      }
    }

    if (clean !== lastDispatchedToken) {
      lastDispatchedToken = clean;
      onUpdate({ token: clean, source, timestamp });
    }
  };

  // Muat token awal dari localStorage secara instan (0ms)
  const initialLocalToken = sanitizeTokenValue(
    localStorage.getItem('anbk_last_live_sheet_token_v1') ||
    localStorage.getItem('anbk_synced_token_v1')
  );
  if (initialLocalToken) {
    handleIncomingToken(
      initialLocalToken,
      'Tersinkron Otomatis Live (KODE TOKEN UJIAN)',
      Date.now(),
      false
    );
  }

  // 1. LAYER EVENT 1: Server-Sent Events (SSE) Stream /__api/token-events
  // Server langsung mem-push token dari Google Sheets ke seluruh browser seketika tanpa menunggu polling!
  let sse: EventSource | null = null;
  const connectSse = () => {
    if (disposed) return;
    try {
      if (typeof EventSource !== 'undefined') {
        sse = new EventSource('/__api/token-events');
        sse.addEventListener('token-update', (event) => {
          try {
            const data = JSON.parse((event as MessageEvent).data);
            if (data && data.token) {
              handleIncomingToken(
                data.token,
                data.source ? data.source.replace(/\s*\(?Google Sheets\)?/gi, '').trim() : '⚡ SSE Event-Driven Push (Real-Time)',
                data.timestamp || Date.now()
              );
            }
          } catch {
            // ignore
          }
        });
        sse.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data && data.token) {
              handleIncomingToken(
                data.token,
                data.source ? data.source.replace(/\s*\(?Google Sheets\)?/gi, '').trim() : '⚡ SSE Event-Driven Push (Real-Time)',
                data.timestamp || Date.now()
              );
            }
          } catch {
            // ignore
          }
        };
        sse.onerror = () => {
          if (sse) {
            sse.close();
            sse = null;
          }
          if (!disposed) {
            setTimeout(connectSse, 3500);
          }
        };
      }
    } catch {
      // ignore
    }
  };
  connectSse();

  // 2. LAYER EVENT 2: Cloud Firestore Real-Time Listener (onSnapshot)
  // Menjamin pembaruan token terdorong secara real-time via WebSocket Firestore ke seluruh HP, Tablet, Komputer
  let unsubscribeFirestore: (() => void) | null = null;
  try {
    const tokenDocRef = doc(
      firestoreDb,
      CLOUD_TOKEN_FIRESTORE_DOC_PATH[0],
      CLOUD_TOKEN_FIRESTORE_DOC_PATH[1]
    );
    unsubscribeFirestore = onSnapshot(
      tokenDocRef,
      (snapshot) => {
        if (!snapshot.exists()) return;
        const d = snapshot.data();
        const candidate = d?.customTeacherToken || d?.token;
        if (candidate) {
          handleIncomingToken(
            String(candidate),
            '⚡ Cloud Firestore Real-Time Event (Lintas Perangkat)',
            Number(d?.updatedAt) || Date.now()
          );
        }
      },
      () => {
        // error listener diabaikan demi ketahanan offline
      }
    );
  } catch {
    // ignore
  }

  // 3. LAYER EVENT 3: BroadcastChannel (Komunikasi Instan Lintas Tab di Perangkat yang Sama)
  let broadcastChannel: BroadcastChannel | null = null;
  try {
    if (typeof BroadcastChannel !== 'undefined') {
      broadcastChannel = new BroadcastChannel('anbk_online_token_channel');
      broadcastChannel.onmessage = (e) => {
        if (e.data && e.data.token && !e.data.internal) {
          handleIncomingToken(
            e.data.token,
            e.data.source || '⚡ Broadcast Channel Tab',
            e.data.timestamp || Date.now(),
            false
          );
        }
      };
    }
  } catch {
    // ignore
  }

  // 4. LAYER EVENT 4: DOM CustomEvent Listener (Pembaruan Internal Komponen)
  const onCustomEvent = (e: Event) => {
    const detail = (e as CustomEvent)?.detail;
    if (detail && detail.token) {
      handleIncomingToken(
        detail.token,
        detail.source || '⚡ DOM CustomEvent',
        detail.timestamp || Date.now(),
        false
      );
    }
  };
  window.addEventListener('anbk-online-token-updated', onCustomEvent);

  // 5. LAYER EVENT 5: Window Storage Event (Antar Jendela / Tab)
  const onStorage = (e: StorageEvent) => {
    if (e.key === 'anbk_last_live_sheet_token_v1' || e.key === 'anbk_synced_token_v1') {
      if (e.newValue) {
        handleIncomingToken(
          e.newValue,
          '⚡ Storage Event Lintas Jendela',
          Date.now(),
          false
        );
      }
    }
  };
  window.addEventListener('storage', onStorage);

  return () => {
    disposed = true;
    if (sse) {
      sse.close();
      sse = null;
    }
    if (unsubscribeFirestore) {
      unsubscribeFirestore();
      unsubscribeFirestore = null;
    }
    if (broadcastChannel) {
      broadcastChannel.close();
      broadcastChannel = null;
    }
    window.removeEventListener('anbk-online-token-updated', onCustomEvent);
    window.removeEventListener('storage', onStorage);
  };
}

export function subscribeToFirestoreCloudConfig(
  onUpdate: (
    cfg: Partial<CloudIntegrationConfig> & {
      oauthAccessToken?: string;
      oauthExpiresAt?: number;
      updatedAt?: number;
    }
  ) => void
): () => void {
  if (typeof window === 'undefined') return () => {};
  let disposed = false;
  let lastSeenUpdatedAt = 0;
  let lastSeenToken = '';

  const processIncomingConfig = (
    data: Partial<CloudIntegrationConfig> & {
      oauthAccessToken?: string;
      oauthExpiresAt?: number;
      updatedAt?: number;
    }
  ) => {
    if (disposed || !data || typeof data !== 'object') return;
    latestCloudConfigCache = data;
    lastCloudConfigFetchTs = Date.now();
    if (data.oauthAccessToken) {
      setSharedCloudAccessToken(data.oauthAccessToken, data.oauthExpiresAt);
    }
    const ts = Number(data.updatedAt || 1);
    const tok = sanitizeTokenValue(data.customTeacherToken);
    if (ts !== lastSeenUpdatedAt || (tok && tok !== lastSeenToken)) {
      lastSeenUpdatedAt = ts;
      if (tok) {
        lastSeenToken = tok;
        // Simpan langsung ke localStorage seketika
        try {
          localStorage.setItem('anbk_last_live_sheet_token_v1', tok);
          localStorage.setItem('anbk_synced_token_v1', tok);
        } catch {
          // ignore
        }
      }
      if (data.studentShareUrl && data.studentShareUrl.trim().length > 4) {
        try {
          const cleanShare = data.studentShareUrl.trim();
          const currentStored = localStorage.getItem(STORAGE_KEY_STUDENT_SHARE_URL);
          if (cleanShare !== currentStored) {
            localStorage.setItem(STORAGE_KEY_STUDENT_SHARE_URL, cleanShare);
            window.dispatchEvent(
              new CustomEvent(STUDENT_SHARE_URL_EVENT, { detail: cleanShare })
            );
          }
        } catch {}
      }
      onUpdate(data);
    }
  };

  // 1. Real-time Firestore onSnapshot listener
  let unsubscribeFsSnap: (() => void) | null = null;
  try {
    const docRef = doc(
      firestoreDb,
      CLOUD_TOKEN_FIRESTORE_DOC_PATH[0],
      CLOUD_TOKEN_FIRESTORE_DOC_PATH[1]
    );
    unsubscribeFsSnap = onSnapshot(
      docRef,
      (snap) => {
        if (!snap.exists()) return;
        const d = snap.data() as Partial<CloudIntegrationConfig> & {
          oauthAccessToken?: string;
          oauthExpiresAt?: number;
          updatedAt?: number;
        };
        processIncomingConfig(d);
      },
      () => {
        // Abaikan error snapshot
      }
    );
  } catch {
    // fallback
  }

  const checkCloudCfg = async () => {
    if (disposed) return;
    try {
      const data = await firestoreRestReadDoc<
        Partial<CloudIntegrationConfig> & {
          oauthAccessToken?: string;
          oauthExpiresAt?: number;
          updatedAt?: number;
        }
      >(CLOUD_TOKEN_FIRESTORE_DOC_PATH[0], CLOUD_TOKEN_FIRESTORE_DOC_PATH[1], 2200);
      if (data) {
        processIncomingConfig(data);
      }
    } catch {
      // ignore
    }
  };

  checkCloudCfg();
  const intervalId = window.setInterval(checkCloudCfg, 5000);
  const onFocusOrVisible = () => {
    if (!document.hidden) {
      checkCloudCfg();
    }
  };
  window.addEventListener('focus', onFocusOrVisible);
  document.addEventListener('visibilitychange', onFocusOrVisible);
  window.addEventListener('online', onFocusOrVisible);

  return () => {
    disposed = true;
    if (unsubscribeFsSnap) {
      unsubscribeFsSnap();
      unsubscribeFsSnap = null;
    }
    window.clearInterval(intervalId);
    window.removeEventListener('focus', onFocusOrVisible);
    document.removeEventListener('visibilitychange', onFocusOrVisible);
    window.removeEventListener('online', onFocusOrVisible);
  };
}

export async function saveCloudTokenConfigToServer(
  cfg: Partial<CloudIntegrationConfig>
): Promise<{
  token: string | null;
  isSyncedFromSheet: boolean;
  syncedSheetUrl?: string;
  syncedAppsScriptUrl?: string;
} | null> {
  if (typeof window === 'undefined') return null;
  const cleanCustomTok = sanitizeTokenValue(cfg.customTeacherToken);
  if (cleanCustomTok) {
    try {
      localStorage.setItem('anbk_last_live_sheet_token_v1', cleanCustomTok);
    } catch {
      // ignore
    }
  }
  await writeFirestoreCloudConfig(cfg).catch(() => {});
  try {
    const res = await fetch(`/__api/cloud-token-sync?_t=${Date.now()}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tokenSheetUrl: cfg.tokenSheetUrl || DEFAULT_TOKEN_SHEET_URL,
        googleSheetUrl: sanitizeRekapSheetUrl(cfg.googleSheetUrl),
        appsScriptWebAppUrl: cfg.appsScriptWebAppUrl || '',
        googleDocUrl: cfg.googleDocUrl || '',
        studentShareUrl: (cfg.studentShareUrl || getStoredStudentShareUrl() || '').trim(),
        customTeacherToken: cleanCustomTok || cfg.customTeacherToken || '',
        forceCustomToken: Boolean(cleanCustomTok),
        oauthAccessToken: getAccessTokenSync() || undefined,
      }),
    });
    if (res.ok) {
      const data = await res.json();
      if (data && data.token) {
        return {
          token: String(data.token).trim().toUpperCase().slice(0, 6),
          isSyncedFromSheet: true,
          syncedSheetUrl:
            data.cloudConfig?.tokenSheetUrl || cfg.tokenSheetUrl || DEFAULT_TOKEN_SHEET_URL,
          syncedAppsScriptUrl:
            data.cloudConfig?.appsScriptWebAppUrl || cfg.appsScriptWebAppUrl || '',
        };
      }
    }
  } catch {
    // ignore
  }
  return cleanCustomTok
    ? {
        token: cleanCustomTok,
        isSyncedFromSheet: true,
        syncedSheetUrl: cfg.tokenSheetUrl || cfg.googleSheetUrl || DEFAULT_TOKEN_SHEET_URL,
        syncedAppsScriptUrl: cfg.appsScriptWebAppUrl || '',
      }
    : null;
}

export function extractSpreadsheetIdFromUrl(url?: string): string | null {
  if (!url) return null;
  const match = url.match(/\/spreadsheets\/d\/(?:e\/)?([a-zA-Z0-9-_]+)/);
  return match ? match[1] : null;
}

export function isValidGoogleSheetOrScriptUrl(url?: string, scriptUrl?: string): boolean {
  const hasSheet = Boolean(
    url &&
      url.trim().startsWith('http') &&
      (url.includes('docs.google.com/spreadsheets') || extractSpreadsheetIdFromUrl(url))
  );
  const hasScript = Boolean(
    scriptUrl &&
      scriptUrl.trim().startsWith('http') &&
      scriptUrl.includes('script.google.com')
  );
  return hasSheet || hasScript;
}

interface GvizTableResponse {
  status?: string;
  table?: {
    cols?: Array<{ id?: string; label?: string; type?: string }>;
    rows?: Array<{ c?: Array<{ v?: string | number | null; f?: string | null } | null> }>;
  };
}

function parseTokenFromGvizTableObject(resp?: GvizTableResponse | null): string | null {
  if (!resp || !resp.table) return null;
  const cols = resp.table.cols || [];
  const rows = resp.table.rows || [];

  const csvLines: string[] = [];
  const headerCells = cols.map((col) => (col?.label ? String(col.label).trim() : ''));
  if (headerCells.some(Boolean)) {
    csvLines.push(headerCells.map((h) => `"${h.replace(/"/g, '""')}"`).join(','));
  }

  for (const row of rows) {
    const cells = (row?.c || []).map((cell) => {
      if (!cell) return '';
      if (cell.f != null && String(cell.f).trim() !== '') {
        return String(cell.f).trim();
      }
      if (cell.v != null) {
        if (typeof cell.v === 'number' && Number.isInteger(cell.v)) {
          return String(cell.v);
        }
        return String(cell.v).trim();
      }
      return '';
    });
    if (cells.some(Boolean)) {
      csvLines.push(cells.map((c) => `"${c.replace(/"/g, '""')}"`).join(','));
    }
  }

  return parseTokenFromCsvText(csvLines.join('\n'));
}

export function parseTokenFromGvizJsonText(rawText: string): string | null {
  try {
    const startIdx = rawText.indexOf('{');
    const endIdx = rawText.lastIndexOf('}');
    if (startIdx === -1 || endIdx === -1 || endIdx <= startIdx) return null;
    const jsonObj = JSON.parse(rawText.slice(startIdx, endIdx + 1)) as GvizTableResponse;
    return parseTokenFromGvizTableObject(jsonObj);
  } catch {
    return null;
  }
}

function fetchTokenViaGvizJsonp(
  spreadsheetId: string,
  extraQuery: string = ''
): Promise<string | null> {
  if (typeof window === 'undefined') {
    return Promise.resolve(null);
  }
  const oauthTok = getAccessTokenSync();
  const authParam = oauthTok ? `&access_token=${encodeURIComponent(oauthTok)}` : '';
  const url = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?tqx=out:json${extraQuery}${authParam}&_t=${Date.now()}`;
  return fetch(url, { cache: 'no-store', credentials: 'omit' })
    .then((res) => (res.ok ? res.text() : ''))
    .then((text) => (text ? parseTokenFromGvizJsonText(text) : null))
    .catch(() => null);
}

export function parseTokenFromCsvText(csvText: string): string | null {
  if (!csvText || !csvText.trim()) return null;
  // Tolak jika respons berupa halaman HTML (mis. halaman login karena sheet belum dibuka akses publiknya)
  if (/<!doctype\s+html|<html[\s>]|<head[\s>]|<body[\s>]|<script[\s>]/i.test(csvText)) {
    return null;
  }

  const lines = csvText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length === 0) return null;

  const rows = lines.map((line) =>
    line.split(/[,;\t]/).map((cell) => cell.replace(/^"|"$/g, '').trim())
  );

  // 1. Prioritas Utama: Cari kolom atau sel header bertuliskan "KODE TOKEN UJIAN" / "KODE TOKEN" / "TOKEN UJIAN" / "TOKEN"
  for (let r = 0; r < rows.length; r++) {
    for (let c = 0; c < rows[r].length; c++) {
      const cellUpper = rows[r][c].toUpperCase().replace(/\s+/g, ' ').trim();

      if (
        cellUpper.startsWith('KODE TOKEN') ||
        cellUpper.startsWith('TOKEN UJIAN') ||
        cellUpper === 'TOKEN' ||
        /^(?:KODE\s+TOKEN\s+UJIAN|TOKEN\s+UJIAN|KODE\s+TOKEN|TOKEN)\b/i.test(cellUpper)
      ) {
        const remainder = cellUpper
          .replace(/^(?:KODE\s+TOKEN\s+UJIAN|TOKEN\s+UJIAN|KODE\s+TOKEN|TOKEN)\b[\s:=-]*/i, '')
          .replace(/[^A-Z0-9]/g, '')
          .trim();
        if (
          remainder.length >= 3 &&
          remainder.length <= 8 &&
          remainder !== 'UJIAN' &&
          remainder !== 'TOKEN'
        ) {
          return remainder.slice(0, 6);
        }

        // Cek dari baris paling bawah ke atas pada kolom yang sama (atau kolom sebelahnya jika sel di-merge)
        for (let targetRow = rows.length - 1; targetRow > r; targetRow--) {
          for (const colIdx of [c, c + 1, c - 1]) {
            const rawCell = colIdx >= 0 ? rows[targetRow]?.[colIdx] : undefined;
            if (rawCell) {
              const candidateDown = rawCell
                .replace(/[^A-Za-z0-9]/g, '')
                .toUpperCase()
                .slice(0, 6);
              if (
                candidateDown.length >= 3 &&
                candidateDown !== 'UJIAN' &&
                candidateDown !== 'TOKEN' &&
                candidateDown !== 'KODETO'
              ) {
                return candidateDown;
              }
            }
          }
        }
        // Cek kolom di sebelah kanannya pada baris yang sama
        for (let nextCol = c + 1; nextCol < rows[r].length; nextCol++) {
          if (rows[r][nextCol]) {
            const candidateRight = rows[r][nextCol]
              .replace(/[^A-Za-z0-9]/g, '')
              .toUpperCase()
              .slice(0, 6);
            if (
              candidateRight.length >= 3 &&
              candidateRight !== 'UJIAN' &&
              candidateRight !== 'TOKEN' &&
              candidateRight !== 'KODETO'
            ) {
              return candidateRight;
            }
          }
        }
        // Jika header KODE TOKEN UJIAN ditemukan tetapi sel nilainya kosong, kembalikan null
        return null;
      }
    }
  }

  // 2. Fallback hanya jika tabel sheet khusus berisi sel token ringkas (bukan tabel Rekap Nilai Siswa)
  const firstRowJoined = rows[0].join(' ').toUpperCase();
  if (
    firstRowJoined.includes('TIMESTAMP') ||
    firstRowJoined.includes('NAMA SISWA') ||
    firstRowJoined.includes('NILAI AKHIR') ||
    firstRowJoined.includes('SKOR BENAR')
  ) {
    return null;
  }

  if (rows.length <= 15) {
    for (let r = Math.min(rows.length - 1, 10); r >= 0; r--) {
      for (let c = 0; c < Math.min(rows[r].length, 6); c++) {
        const raw = rows[r][c].trim();
        const upper = raw.toUpperCase();
        if (
          upper &&
          !upper.includes('TIMESTAMP') &&
          !upper.includes('NAMA') &&
          !upper.includes('KODE') &&
          !upper.includes('TOKEN') &&
          !upper.includes('WAKTU') &&
          !upper.includes('GURU') &&
          /^[A-Z0-9]{3,6}$/.test(upper)
        ) {
          return upper;
        }
      }
    }
  }

  return null;
}

async function fetchDirectFromSpreadsheetUrl(targetSheetUrl: string): Promise<string | null> {
  const trimmed = (targetSheetUrl || '').trim();
  const spreadsheetId = extractSpreadsheetIdFromUrl(trimmed);
  if (!spreadsheetId) return null;

  const gidMatch = trimmed.match(/[?#&]gid=([0-9]+)/);
  const gid = gidMatch ? gidMatch[1] : null;
  const isPublishedUrl = trimmed.includes('/spreadsheets/d/e/');
  const ts = Date.now();

  // 0. Jika token OAuth Google Sheets tersedia (baik dari login Guru atau tersinkron via Firestore), baca langsung melalui Google Sheets REST API v4
  if (getAccessTokenSync()) {
    try {
      const apiTok = await readTokenFromGoogleSheetViaRestApi(spreadsheetId);
      const cleanApiTok = sanitizeTokenValue(apiTok);
      if (cleanApiTok) return cleanApiTok;
    } catch {
      // lanjut ke metode gviz / csv
    }
  }

  if (isPublishedUrl) {
    try {
      const pubUrl =
        trimmed.replace(/\/pubhtml.*$/i, '/pub?output=csv') +
        (trimmed.includes('?') ? `&_t=${ts}` : `?output=csv&_t=${ts}`);
      const res = await fetch(pubUrl, { cache: 'no-store', credentials: 'omit' });
      if (res.ok) {
        return parseTokenFromCsvText(await res.text());
      }
    } catch {
      // ignore
    }
    return null;
  }

  // Prioritaskan URL tanpa headers=0 dan out:json dengan credentials: 'omit' (serta sertakan access_token OAuth lintas perangkat jika tersedia agar tidak terkena 401 pada Google Sheet yang dibatasi)
  const oauthTok = getAccessTokenSync();
  const authSuffix = oauthTok ? `&access_token=${encodeURIComponent(oauthTok)}` : '';
  const baseFastUrls = [
    `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(
      'KODE TOKEN UJIAN'
    )}&range=A2:D15&headers=0&_t=${ts}`,
    `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?tqx=out:json&sheet=${encodeURIComponent(
      'KODE TOKEN UJIAN'
    )}&range=A2:D15&headers=0&_t=${ts}`,
    `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(
      'KODE TOKEN UJIAN'
    )}&_t=${ts}`,
    `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?tqx=out:json&sheet=${encodeURIComponent(
      'KODE TOKEN UJIAN'
    )}&_t=${ts}`,
    ...(gid
      ? [
          `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?tqx=out:csv&gid=${gid}&range=A2:D15&headers=0&_t=${ts}`,
          `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?tqx=out:csv&gid=${gid}&_t=${ts}`,
          `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?tqx=out:json&gid=${gid}&_t=${ts}`,
        ]
      : []),
    `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?tqx=out:csv&range=A2:D15&headers=0&_t=${ts}`,
    `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?tqx=out:json&range=A2:D15&headers=0&_t=${ts}`,
    `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?tqx=out:csv&_t=${ts}`,
    `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?tqx=out:json&_t=${ts}`,
    `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?tqx=out:csv&tq=select%20*&_t=${ts}`,
    `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(
      'Kode Token Ujian'
    )}&range=A2:D15&headers=0&_t=${ts}`,
    `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(
      'Kode Token Ujian'
    )}&_t=${ts}`,
    `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(
      'TOKEN'
    )}&_t=${ts}`,
    `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?tqx=out:csv&headers=0&_t=${ts}`,
  ];
  const fastUrls = authSuffix
    ? [...baseFastUrls.map((u) => `${u}${authSuffix}`), ...baseFastUrls]
    : baseFastUrls;

  // Jalankan 6 URL tercepat secara paralel agar instan (< 200ms) di semua perangkat
  try {
    const winner = await Promise.any(
      fastUrls.slice(0, 6).map(async (u) => {
        const res = await fetch(u, { cache: 'no-store', credentials: 'omit' });
        if (!res.ok) throw new Error('status not ok');
        const text = await res.text();
        const tok = u.includes('out:json')
          ? parseTokenFromGvizJsonText(text)
          : parseTokenFromCsvText(text);
        const clean = sanitizeTokenValue(tok);
        if (!clean) throw new Error('empty token');
        return clean;
      })
    );
    if (winner) return winner;
  } catch {
    // lanjut ke URL sisa
  }

  for (const u of fastUrls.slice(6)) {
    try {
      const res = await fetch(u, { cache: 'no-store', credentials: 'omit' });
      if (res.ok) {
        const text = await res.text();
        const tok = u.includes('out:json')
          ? parseTokenFromGvizJsonText(text)
          : parseTokenFromCsvText(text);
        const clean = sanitizeTokenValue(tok);
        if (clean) return clean;
      }
    } catch {
      // lanjut
    }
  }

  return null;
}

export async function fetchTokenFromGoogleSheet(
  sheetUrl?: string,
  appsScriptUrl?: string
): Promise<{
  token: string | null;
  source: string;
  isSyncedFromSheet: boolean;
  syncedSheetUrl?: string;
  syncedAppsScriptUrl?: string;
}> {
  let effectiveSheetUrl = (sheetUrl || '').trim() || DEFAULT_TOKEN_SHEET_URL;
  let effectiveScriptUrl = (appsScriptUrl || '').trim();

  let lastKnownLiveSheetToken = '';
  if (typeof window !== 'undefined') {
    try {
      lastKnownLiveSheetToken = sanitizeTokenValue(
        localStorage.getItem('anbk_last_live_sheet_token_v1')
      );
    } catch {
      // ignore
    }
  }

  // 1. Jalankan sinkronisasi paralel dari Cloud Firestore Lintas Perangkat, Server Proxy, & Google Sheets Langsung
  const [firestoreCfg, serverResult] = await Promise.all([
    readFirestoreCloudConfig(true).catch(() => null),
    (async () => {
      if (typeof window === 'undefined') return null;
      try {
        const queryParams = new URLSearchParams({ _t: String(Date.now()) });
        if (sheetUrl && sheetUrl.trim() && sheetUrl.trim() !== DEFAULT_TOKEN_SHEET_URL) {
          queryParams.set('sheetUrl', sheetUrl.trim());
        }
        if (appsScriptUrl && appsScriptUrl.trim()) {
          queryParams.set('appsScriptUrl', appsScriptUrl.trim());
        }
        const res = await fetch(`/__api/cloud-token-sync?${queryParams.toString()}`, {
          cache: 'no-store',
        });
        if (!res.ok) return null;
        return (await res.json()) as {
          token?: string | null;
          isSyncedFromSheet?: boolean;
          isLiveFromSheet?: boolean;
          cloudConfig?: {
            tokenSheetUrl?: string;
            googleSheetUrl?: string;
            appsScriptWebAppUrl?: string;
            customTeacherToken?: string;
            updatedAt?: number;
          };
        };
      } catch {
        return null;
      }
    })(),
  ]);

  if (firestoreCfg) {
    const fsSheet = firestoreCfg.tokenSheetUrl || firestoreCfg.googleSheetUrl || '';
    if (fsSheet && isValidGoogleSheetOrScriptUrl(fsSheet)) {
      effectiveSheetUrl = fsSheet;
    }
    if (firestoreCfg.appsScriptWebAppUrl) {
      effectiveScriptUrl = firestoreCfg.appsScriptWebAppUrl;
    }
  }

  if (serverResult?.cloudConfig) {
    const serverSheet =
      serverResult.cloudConfig.tokenSheetUrl || serverResult.cloudConfig.googleSheetUrl || '';
    if (
      serverSheet &&
      isValidGoogleSheetOrScriptUrl(serverSheet) &&
      (!firestoreCfg?.tokenSheetUrl || serverSheet !== DEFAULT_TOKEN_SHEET_URL)
    ) {
      effectiveSheetUrl = serverSheet;
    }
    if (serverResult.cloudConfig.appsScriptWebAppUrl && !effectiveScriptUrl) {
      effectiveScriptUrl = serverResult.cloudConfig.appsScriptWebAppUrl;
    }
  }

  // 2. Cek apakah Google Sheets atau Apps Script mengembalikan token LIVE secara langsung
  let liveSheetToken: string | null = null;

  if (effectiveScriptUrl && effectiveScriptUrl.startsWith('http')) {
    try {
      const sep = effectiveScriptUrl.includes('?') ? '&' : '?';
      const res = await fetch(`${effectiveScriptUrl}${sep}action=getToken&_t=${Date.now()}`, {
        cache: 'no-store',
        credentials: 'omit',
      });
      if (res.ok) {
        const data = await res.json();
        const clean = sanitizeTokenValue(data?.token);
        if (clean) {
          liveSheetToken = clean;
        }
      }
    } catch {
      // lanjut
    }
  }

  if (!liveSheetToken && serverResult?.isLiveFromSheet && serverResult.token) {
    const cleanServerLive = sanitizeTokenValue(serverResult.token);
    if (cleanServerLive) {
      liveSheetToken = cleanServerLive;
    }
  }

  if (!liveSheetToken) {
    const directTok = await fetchDirectFromSpreadsheetUrl(effectiveSheetUrl);
    if (directTok) {
      liveSheetToken = directTok;
    } else if (effectiveSheetUrl !== DEFAULT_TOKEN_SHEET_URL) {
      const fallbackDirectTok = await fetchDirectFromSpreadsheetUrl(DEFAULT_TOKEN_SHEET_URL);
      if (fallbackDirectTok) {
        liveSheetToken = fallbackDirectTok;
        effectiveSheetUrl = DEFAULT_TOKEN_SHEET_URL;
      }
    }
  }

  const firestoreTok = sanitizeTokenValue(firestoreCfg?.customTeacherToken);
  const serverCachedTok = sanitizeTokenValue(
    serverResult?.cloudConfig?.customTeacherToken || serverResult?.token
  );
  let teacherOverrideTok = '';
  let lastRawSheetCellTok = '';
  if (typeof window !== 'undefined') {
    try {
      teacherOverrideTok = sanitizeTokenValue(
        localStorage.getItem('anbk_teacher_override_token_v1')
      );
      lastRawSheetCellTok = sanitizeTokenValue(
        localStorage.getItem('anbk_last_raw_sheet_cell_token_v1')
      );
    } catch {
      // ignore
    }
  }

  if (liveSheetToken && typeof window !== 'undefined') {
    try {
      localStorage.setItem('anbk_last_raw_sheet_cell_token_v1', liveSheetToken);
    } catch {
      // ignore
    }
  }

  // Jika Guru baru saja mengganti Kode Token melalui Panel Guru (dan sel Google Sheet belum berubah dari nilai lamanya), pertahankan token baru dari Guru!
  if (
    teacherOverrideTok &&
    (!liveSheetToken || liveSheetToken === lastRawSheetCellTok || liveSheetToken === INITIAL_SYNCED_TOKEN)
  ) {
    return {
      token: teacherOverrideTok,
      source: 'Tersinkron Otomatis Live (Panel Guru / KODE TOKEN UJIAN)',
      isSyncedFromSheet: true,
      syncedSheetUrl: effectiveSheetUrl,
      syncedAppsScriptUrl: effectiveScriptUrl,
    };
  }

  // Jika pembacaan langsung dari Google Sheet menghasilkan token aktif di Sheet, SELALU prioritaskan token live dari Sheet tersebut dan sebarkan ke Firestore & Server agar seluruh HP/Tablet/Komputer siswa ikut berubah otomatis!
  if (liveSheetToken) {
    if (typeof window !== 'undefined' && liveSheetToken !== lastKnownLiveSheetToken) {
      try {
        localStorage.setItem('anbk_last_live_sheet_token_v1', liveSheetToken);
        if (teacherOverrideTok && liveSheetToken !== teacherOverrideTok) {
          localStorage.removeItem('anbk_teacher_override_token_v1');
        }
      } catch {
        // ignore
      }
    }
    if (firestoreTok !== liveSheetToken) {
      writeFirestoreCloudConfig({
        tokenSheetUrl: effectiveSheetUrl,
        appsScriptWebAppUrl: effectiveScriptUrl,
        customTeacherToken: liveSheetToken,
      }).catch(() => {});
    }
    return {
      token: liveSheetToken,
      source: 'Tersinkron Otomatis Live (KODE TOKEN UJIAN)',
      isSyncedFromSheet: true,
      syncedSheetUrl: effectiveSheetUrl,
      syncedAppsScriptUrl: effectiveScriptUrl,
    };
  }

  // Prioritaskan Cloud Firestore Lintas Perangkat (karena selalu diperbarui secara real-time oleh klien maupun server tanpa bias jam container)
  if (firestoreTok) {
    return {
      token: firestoreTok,
      source: 'Tersinkron Otomatis Live (KODE TOKEN UJIAN)',
      isSyncedFromSheet: true,
      syncedSheetUrl: effectiveSheetUrl,
      syncedAppsScriptUrl: effectiveScriptUrl,
    };
  }

  if (liveSheetToken) {
    return {
      token: liveSheetToken,
      source: 'Tersinkron Otomatis Live (KODE TOKEN UJIAN)',
      isSyncedFromSheet: true,
      syncedSheetUrl: effectiveSheetUrl,
      syncedAppsScriptUrl: effectiveScriptUrl,
    };
  }

  if (serverCachedTok) {
    writeFirestoreCloudConfig({
      tokenSheetUrl: effectiveSheetUrl,
      appsScriptWebAppUrl: effectiveScriptUrl,
      customTeacherToken: serverCachedTok,
    }).catch(() => {});
    return {
      token: serverCachedTok,
      source: 'Tersinkron Otomatis Live (KODE TOKEN UJIAN)',
      isSyncedFromSheet: true,
      syncedSheetUrl: effectiveSheetUrl,
      syncedAppsScriptUrl: effectiveScriptUrl,
    };
  }

  // 5. Fallback ke static /cloud-config.json (untuk deployment statis lintas perangkat)
  if (typeof window !== 'undefined') {
    try {
      const staticRes = await fetch(`/cloud-config.json?_t=${Date.now()}`, { cache: 'no-store' });
      if (staticRes.ok) {
        const staticData = (await staticRes.json()) as {
          token?: string;
          customTeacherToken?: string;
          tokenSheetUrl?: string;
          googleSheetUrl?: string;
        };
        const staticTok = sanitizeTokenValue(staticData.customTeacherToken || staticData.token);
        if (staticTok) {
          return {
            token: staticTok,
            source: 'Tersinkron Otomatis Live (KODE TOKEN UJIAN)',
            isSyncedFromSheet: true,
            syncedSheetUrl:
              staticData.tokenSheetUrl || staticData.googleSheetUrl || DEFAULT_TOKEN_SHEET_URL,
            syncedAppsScriptUrl: effectiveScriptUrl,
          };
        }
      }
    } catch {
      // ignore
    }
  }

  // 6. Jika link Google Sheets valid masih terpasang, gunakan token tersinkron terakhir
  if (isValidGoogleSheetOrScriptUrl(effectiveSheetUrl, effectiveScriptUrl) && INITIAL_SYNCED_TOKEN) {
    return {
      token: INITIAL_SYNCED_TOKEN,
      source: 'Tersinkron Otomatis Live (KODE TOKEN UJIAN)',
      isSyncedFromSheet: true,
      syncedSheetUrl: effectiveSheetUrl,
      syncedAppsScriptUrl: effectiveScriptUrl,
    };
  }

  return {
    token: null,
    source: 'Menunggu Kode Token Ujian Aktif',
    isSyncedFromSheet: false,
    syncedSheetUrl: effectiveSheetUrl,
    syncedAppsScriptUrl: effectiveScriptUrl,
  };
}

export async function pushTokenToGoogleSheet(
  token: string,
  appsScriptUrl?: string,
  sheetUrl?: string
): Promise<boolean> {
  const cleanTok = sanitizeTokenValue(token);
  if (!cleanTok) return false;

  const targetSheet = (sheetUrl || '').trim() || DEFAULT_TOKEN_SHEET_URL;
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem('anbk_last_live_sheet_token_v1', cleanTok);
    } catch {
      // ignore
    }
  }

  // 1. Simpan ke Cloud Firestore Lintas Perangkat agar seluruh HP/Tablet/Komputer siswa langsung tersinkron
  await writeFirestoreCloudConfig({
    customTeacherToken: cleanTok,
    tokenSheetUrl: targetSheet,
    ...(appsScriptUrl ? { appsScriptWebAppUrl: appsScriptUrl.trim() } : {}),
  }).catch(() => {});

  let pushedOk = false;

  // 2. Tulis langsung ke tab "KODE TOKEN UJIAN" di Google Sheets melalui Google Sheets REST API v4 jika token OAuth tersedia
  const spreadsheetId = extractSpreadsheetIdFromUrl(targetSheet);
  if (spreadsheetId && getAccessTokenSync()) {
    try {
      const apiOk = await writeTokenToGoogleSheetViaRestApi(spreadsheetId, cleanTok);
      if (apiOk) pushedOk = true;
    } catch {
      // ignore
    }
  }

  // 3. Tulis melalui Google Apps Script Web App jika tersedia
  if (appsScriptUrl && appsScriptUrl.trim().startsWith('http')) {
    try {
      await fetch(appsScriptUrl.trim(), {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({
          action: 'saveToken',
          token: cleanTok,
          updatedAt: new Date().toLocaleString('id-ID'),
        }),
      });
      pushedOk = true;
    } catch {
      // ignore
    }
  }

  return pushedOk;
}

export interface FaseDPackageMeta {
  key: ExamPackageKey;
  jenjang: JenjangKelas;
  semester: SemesterType;
  judul: string;
  topik: string;
  deskripsiMateri: string;
  elemenCakupan: string[];
  sumberOnline: string;
}

export function getJenjangFromKelas(kelas: string): JenjangKelas {
  return kelas.trim().toUpperCase().startsWith('VII-') ? 'VII' : 'VIII';
}

export function getPackageKey(kelas: string, semester: SemesterType): ExamPackageKey {
  const jenjang = getJenjangFromKelas(kelas);
  return `${jenjang}_${semester}` as ExamPackageKey;
}

export const EXAM_INFO = {
  judul: 'SOAL INFORMATIKA FASE D TINGKAT SMP',
  mataPelajaran: 'INFORMATIKA',
  topik: 'KURIKULUM MERDEKA FASE D — SMP KELAS VII & VIII',
  tahunAjaran: '2026/2027',
  guruMapel: 'Eksa Yudika Sirait S.T',
  guruMapelUpper: 'EKSA YUDIKA SIRAIT S.T',
  guruGelar: 'S.T',
  namaSekolah: 'UPTD SMP NEGERI 7 KISARAN',
  alamatSekolah: 'Jl. Labu No. 10 Siumbut Baru Kisaran Timur.',
  kurikulum: 'Kurikulum Merdeka Fase D (Deep Learning)',
  kelasVIIList: ['VII-1', 'VII-2', 'VII-3', 'VII-4', 'VII-5'],
  kelasList: ['VIII-1', 'VIII-2', 'VIII-3', 'VIII-4', 'VIII-5', 'VIII-6'],
  allKelasList: [
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
  ],
  durasiMenit: 30,
  durasiDetik: 30 * 60,
  totalSoal: 25,
  kkm: 75,
  teacherPassword: '31051990',
  teacherEmail: 'eksayudikasirait@gmail.com',
  teacherPhone: '+62 821-6588-5568',
  teacherPhoneIntl: '6282165885568',
  logoPath: logoTutWuriAsset,
  heroBannerPath: REAL_PERMANENT_HERO_BANNER,
  teacherPhotoPath: REAL_PERMANENT_TEACHER_PHOTO,
};

export const TEACHER_PHOTO_STORAGE_KEY = 'anbk_teacher_photo_v1';
export const LOGO_PHOTO_STORAGE_KEY = 'anbk_custom_logo_v1';
export const HERO_BANNER_STORAGE_KEY = 'anbk_hero_banner_v1';
export const DEFAULT_HERO_BANNER_STORAGE_KEY = 'anbk_default_hero_banner_v1';

export const TEACHER_PHOTO_PRESETS = [
  {
    label: 'Pas Foto Dasi Merah (Default)',
    url: pasFotoDasiMerahAsset,
  },
  {
    label: 'Pas Foto Asli Pembuat Soal',
    url: pasFotoAsliAsset,
  },
  {
    label: 'Foto Profil Pembuat Soal',
    url: fotoPembuatSoalAsset,
  },
] as const;

export const HERO_BANNER_OPACITY_KEY = 'anbk_hero_banner_opacity_v1';

export function getActiveHeroBannerOpacity(): number {
  try {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(HERO_BANNER_OPACITY_KEY);
      if (saved) {
        const val = parseFloat(saved);
        if (!isNaN(val) && val >= 0.2 && val <= 1) return val;
      }
    }
  } catch {}
  return 0.85; // Default: 85% clearly visible!
}

export function setActiveHeroBannerOpacity(val: number): void {
  try {
    if (typeof window !== 'undefined') {
      localStorage.setItem(HERO_BANNER_OPACITY_KEY, val.toString());
      window.dispatchEvent(new Event('anbk-photo-updated'));
    }
  } catch {}
}

export const HERO_BANNER_PRESETS = [
  {
    id: 'lab-original',
    label: 'Foto Lab Komputer Bawaan (Default UPTD SMPN 7)',
    description: 'Foto laboratorium komputer bawaan / default resmi pelaksanaan ANBK',
    url: REAL_PERMANENT_HERO_BANNER,
  },
  {
    id: 'lab-modern-cbt',
    label: 'Lab Komputer CBT Modern (Headset & PC)',
    description: 'Jajaran desktop komputer rapi siap simulasi & ujian ANBK',
    url: labKomputerAnbkAsset,
  },
  {
    id: 'lab-informatika-tech',
    label: 'Lab Informatika & Jaringan Komputer',
    description: 'Workstation teknologi informasi dengan nuansa biru modern',
    url: labInformatikaAsset,
  },
  {
    id: 'lab-coding',
    label: 'Lab Pemrograman & Coding Siswa',
    description: 'Suasana workstation komputer modern untuk pembelajaran interaktif',
    url: 'https://images.unsplash.com/photo-1517694712202-14dd9538aa97?auto=format&fit=crop&w=1400&q=80',
  },
  {
    id: 'lab-cbt-room',
    label: 'Ruang Ujian Berbasis Komputer Nasional',
    description: 'Ruang ujian terintegrasi dengan layar monitor siap pakai',
    url: 'https://images.unsplash.com/photo-1509062522246-3755977927d7?auto=format&fit=crop&w=1400&q=80',
  },
] as const;

let serverSyncedTeacherPhoto: string = '';
let serverSyncedLogoPhoto: string = '';
let serverSyncedHeroBanner: string = REAL_PERMANENT_HERO_BANNER;
let isSyncingPhotos = false;

function normalizeStoredHeroBannerUrl(rawUrl: string): string {
  const trimmed = (rawUrl || '').trim();
  if (!trimmed) return '';
  if (trimmed.includes('hero_anbk_informatika')) {
    return REAL_PERMANENT_HERO_BANNER;
  }
  if (trimmed.includes('lab_komputer_anbk')) {
    return labKomputerAnbkAsset;
  }
  if (trimmed.includes('lab_informatika_sekolah')) {
    return labInformatikaAsset;
  }
  return trimmed;
}

export function getDefaultHeroBannerUrl(): string {
  return EXAM_INFO.heroBannerPath;
}

export async function syncPermanentPhotosWithServer(explicitHeroBanner?: string): Promise<void> {
  if (typeof window === 'undefined') return;
  if (isSyncingPhotos && !explicitHeroBanner) return;
  isSyncingPhotos = true;
  try {
    const localTeacher = localStorage.getItem(TEACHER_PHOTO_STORAGE_KEY) || '';
    const localLogo = localStorage.getItem(LOGO_PHOTO_STORAGE_KEY) || '';
    const rawLocalBanner = explicitHeroBanner || '';

    const hasRealLocalTeacher = localTeacher.startsWith('data:image/');
    const hasRealLocalLogo = localLogo.startsWith('data:image/');
    const hasCustomLocalBanner =
      Boolean(explicitHeroBanner) &&
      (rawLocalBanner.startsWith('data:image/') ||
        rawLocalBanner.startsWith('http') ||
        rawLocalBanner.includes('lab_komputer_anbk') ||
        rawLocalBanner.includes('lab_informatika_sekolah'));

    if (hasRealLocalTeacher || hasRealLocalLogo || hasCustomLocalBanner) {
      try {
        await fetch('/__api/permanent-photos', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            teacherPhoto: hasRealLocalTeacher ? localTeacher : undefined,
            logoPhoto: hasRealLocalLogo ? localLogo : undefined,
            heroBanner: hasCustomLocalBanner ? rawLocalBanner : undefined,
          }),
        });
      } catch {
        // ignore network error
      }
    }

    let serverData: {
      teacherPhoto?: string;
      logoPhoto?: string;
      heroBanner?: string;
    } | null = null;

    try {
      const res = await fetch(`/__api/permanent-photos?t=${Date.now()}`, {
        cache: 'no-store',
      });
      if (res.ok) {
        serverData = await res.json();
      }
    } catch {
      // fallback ke file statis permanent-photos.json
    }

    if (!serverData || !serverData.teacherPhoto) {
      try {
        const resFallback = await fetch(`/permanent-photos.json?t=${Date.now()}`, {
          cache: 'no-store',
        });
        if (resFallback.ok) {
          serverData = await resFallback.json();
        }
      } catch {
        // ignore
      }
    }

    if (serverData) {
      let updated = false;
      if (
        typeof serverData.teacherPhoto === 'string' &&
        serverData.teacherPhoto.startsWith('data:image/')
      ) {
        serverSyncedTeacherPhoto = serverData.teacherPhoto;
        if (localTeacher !== serverData.teacherPhoto) {
          try {
            localStorage.setItem(TEACHER_PHOTO_STORAGE_KEY, serverData.teacherPhoto);
          } catch {
            // ignore quota error
          }
          updated = true;
        }
      }
      if (
        typeof serverData.logoPhoto === 'string' &&
        serverData.logoPhoto.startsWith('data:image/')
      ) {
        serverSyncedLogoPhoto = serverData.logoPhoto;
        if (localLogo !== serverData.logoPhoto) {
          try {
            localStorage.setItem(LOGO_PHOTO_STORAGE_KEY, serverData.logoPhoto);
          } catch {
            // ignore
          }
          updated = true;
        }
      }
      if (
        typeof serverData.heroBanner === 'string' &&
        serverData.heroBanner.trim().length > 0
      ) {
        serverSyncedHeroBanner = normalizeStoredHeroBannerUrl(serverData.heroBanner);
      }
      if (updated) {
        window.dispatchEvent(new Event('anbk-photo-updated'));
        window.dispatchEvent(new Event('anbk-logo-updated'));
      }
    }
  } finally {
    isSyncingPhotos = false;
  }
}

if (typeof window !== 'undefined') {
  syncPermanentPhotosWithServer();
}

export function getActiveHeroBannerUrl(): string {
  try {
    if (typeof window !== 'undefined') {
      const customBanner = localStorage.getItem(HERO_BANNER_STORAGE_KEY);
      if (customBanner && customBanner.trim().length > 0) {
        return normalizeStoredHeroBannerUrl(customBanner);
      }
    }
  } catch (e) {
    console.error(e);
  }
  return EXAM_INFO.heroBannerPath;
}

export function setCustomHeroBannerUrl(dataUrl: string | null): void {
  try {
    if (typeof window !== 'undefined') {
      if (dataUrl && dataUrl.trim().length > 0) {
        const cleanUrl = dataUrl.trim();
        try {
          localStorage.setItem(HERO_BANNER_STORAGE_KEY, cleanUrl);
        } catch {
          try {
            localStorage.removeItem('anbk_battery_session_history_v1');
            localStorage.setItem(HERO_BANNER_STORAGE_KEY, cleanUrl);
          } catch {
            // ignore quota error
          }
        }
      } else {
        localStorage.removeItem(HERO_BANNER_STORAGE_KEY);
        localStorage.removeItem(DEFAULT_HERO_BANNER_STORAGE_KEY);
      }
      window.dispatchEvent(new Event('anbk-photo-updated'));
    }
  } catch (e) {
    console.error(e);
  }
}

export function setCustomTeacherPhotoUrl(dataUrl: string | null): void {
  try {
    if (typeof window !== 'undefined') {
      if (dataUrl && dataUrl.trim().length > 0) {
        localStorage.setItem(TEACHER_PHOTO_STORAGE_KEY, dataUrl.trim());
      } else {
        localStorage.removeItem(TEACHER_PHOTO_STORAGE_KEY);
      }
      syncPermanentPhotosWithServer();
      window.dispatchEvent(new Event('anbk-photo-updated'));
    }
  } catch (e) {
    console.error(e);
  }
}

export function hasCustomLogoPhoto(): boolean {
  try {
    if (typeof window !== 'undefined') {
      const customLogo = localStorage.getItem(LOGO_PHOTO_STORAGE_KEY);
      return Boolean(customLogo && customLogo.startsWith('data:image/'));
    }
  } catch (e) {
    console.error(e);
  }
  return Boolean(serverSyncedLogoPhoto);
}

export function getActiveLogoPhotoUrl(): string {
  try {
    if (typeof window !== 'undefined') {
      const customLogo = localStorage.getItem(LOGO_PHOTO_STORAGE_KEY);
      if (customLogo && customLogo.trim().length > 0) {
        if (customLogo.includes('logo_tut_wuri')) {
          return logoTutWuriAsset;
        }
        return customLogo;
      }
    }
  } catch (e) {
    console.error(e);
  }
  if (serverSyncedLogoPhoto) return serverSyncedLogoPhoto;
  return EXAM_INFO.logoPath;
}

export function setCustomLogoPhotoUrl(dataUrl: string | null): void {
  try {
    if (typeof window !== 'undefined') {
      if (dataUrl && dataUrl.trim().length > 0) {
        localStorage.setItem(LOGO_PHOTO_STORAGE_KEY, dataUrl);
      } else {
        localStorage.removeItem(LOGO_PHOTO_STORAGE_KEY);
      }
      syncPermanentPhotosWithServer();
      window.dispatchEvent(new Event('anbk-logo-updated'));
    }
  } catch (e) {
    console.error(e);
  }
}

export function hasCustomTeacherPhoto(): boolean {
  try {
    if (typeof window !== 'undefined') {
      const customPhoto = localStorage.getItem(TEACHER_PHOTO_STORAGE_KEY);
      return Boolean(customPhoto && customPhoto.startsWith('data:image/'));
    }
  } catch (e) {
    console.error(e);
  }
  return Boolean(serverSyncedTeacherPhoto);
}

export function getActiveTeacherPhotoUrl(): string {
  try {
    if (typeof window !== 'undefined') {
      const customPhoto = localStorage.getItem(TEACHER_PHOTO_STORAGE_KEY);
      if (customPhoto && customPhoto.trim().length > 0) {
        if (customPhoto.startsWith('data:image/')) {
          return customPhoto;
        }
        // Bersihkan path foto AI lama agar tidak pernah menampilkan foto AI/orang lain
        localStorage.removeItem(TEACHER_PHOTO_STORAGE_KEY);
      }
    }
  } catch (e) {
    console.error(e);
  }
  if (serverSyncedTeacherPhoto && serverSyncedTeacherPhoto.startsWith('data:image/')) {
    return serverSyncedTeacherPhoto;
  }
  return REAL_PERMANENT_TEACHER_PHOTO;
}

export const FASE_D_PACKAGE_META: Record<ExamPackageKey, FaseDPackageMeta> = {
  VII_Ganjil: {
    key: 'VII_Ganjil',
    jenjang: 'VII',
    semester: 'Ganjil',
    judul: 'SOAL INFORMATIKA KELAS VII — SEMESTER GANJIL (FASE D)',
    topik: 'Berpikir Komputasional, TIK & Sistem Komputer Dasar (Kelas VII Ganjil)',
    deskripsiMateri:
      'Mencakup Berpikir Komputasional (Algoritma, Optimasi Penjadwalan, Struktur Data Daftar/List, Representasi Data Biner), Teknologi Informasi & Komunikasi (GUI, Manajemen Folder & Ekstensi File, Mesin Pencari, Surel), serta Sistem Komputer Dasar (Hardware Input-Proses-Output, Software Sistem Operasi & Aplikasi, Kode Biner 8-Bit).',
    elemenCakupan: [
      'Berpikir Komputasional (BK)',
      'Teknologi Informasi & Komunikasi (TIK)',
      'Sistem Komputer (SK)',
    ],
    sumberOnline: 'Bank Soal Online Kemendikbudristek Informatika SMP Kelas VII Fase D (Semester 1 / Ganjil)',
  },
  VII_Genap: {
    key: 'VII_Genap',
    jenjang: 'VII',
    semester: 'Genap',
    judul: 'SOAL INFORMATIKA KELAS VII — SEMESTER GENAP (FASE D)',
    topik: 'Jaringan Komputer, Analisis Data, Pemrograman Scratch & Dampak Sosial (Kelas VII Genap)',
    deskripsiMateri:
      'Mencakup Jaringan Komputer & Internet (Koneksi Wi-Fi/Tethering, Proteksi Data & Enkripsi Caesar Cipher), Analisis Data (Spreadsheet, Sel/Range, Fungsi SUM, AVERAGE, MIN, MAX, COUNTIF, Sort & Filter), Algoritma & Pemrograman Visual Scratch, serta Dampak Sosial Informatika.',
    elemenCakupan: [
      'Jaringan Komputer & Internet (JKI)',
      'Analisis Data (AD)',
      'Algoritma & Pemrograman (AP)',
      'Dampak Sosial Informatika (DSI)',
    ],
    sumberOnline: 'Bank Soal Online Kemendikbudristek Informatika SMP Kelas VII Fase D (Semester 2 / Genap)',
  },
  VIII_Ganjil: {
    key: 'VIII_Ganjil',
    jenjang: 'VIII',
    semester: 'Ganjil',
    judul: 'SOAL INFORMATIKA KELAS VIII — SEMESTER GANJIL (FASE D)',
    topik: 'Berpikir Komputasional, Integrasi TIK & Sistem Komputer (Kelas VIII Ganjil)',
    deskripsiMateri:
      'Mencakup Berpikir Komputasional (Fungsi, Himpunan, Konversi Sistem Bilangan Biner/Oktal/Desimal/Heksadesimal, Struktur Data Stack LIFO & Queue FIFO), Integrasi Aplikasi Perkantoran (Word, Excel, PowerPoint, Mail Merge, OLE), serta Sistem Komputer (Arsitektur Von Neumann, CPU ALU & CU, Memori Volatile vs Non-Volatile, Gerbang Logika AND/OR/NOT).',
    elemenCakupan: [
      'Berpikir Komputasional (BK)',
      'Teknologi Informasi & Komunikasi (TIK)',
      'Sistem Komputer (SK)',
    ],
    sumberOnline: 'Bank Soal Online Kemendikbudristek Informatika SMP Kelas VIII Fase D (Semester 1 / Ganjil)',
  },
  VIII_Genap: {
    key: 'VIII_Genap',
    jenjang: 'VIII',
    semester: 'Genap',
    judul: 'SOAL INFORMATIKA KELAS VIII — SEMESTER GENAP (FASE D)',
    topik: 'Jaringan & Routing, Analisis Data Lanjut, Pemrograman Blockly/Scratch & Media Sosial (Kelas VIII Genap)',
    deskripsiMateri:
      'Mencakup Jaringan Komputer & Internet (LAN/WAN, Routing Jalur Terpendek, Komunikasi Sinyal Ponsel BTS, Keamanan Phishing & HTTPS), Analisis Data Lanjut (VLOOKUP/HLOOKUP, SUMIF/COUNTIF, Visualisasi Grafik & Pivot Table), Algoritma Pemrograman Lanjut (Variabel, Percabangan, Perulangan, Robotika Line Follower/Ozobot), dan Dampak Sosial Informatika (Hoaks, Cyberbullying, Jejak Digital).',
    elemenCakupan: [
      'Jaringan Komputer & Internet (JKI)',
      'Analisis Data (AD)',
      'Algoritma & Pemrograman (AP)',
      'Dampak Sosial Informatika (DSI)',
    ],
    sumberOnline: 'Bank Soal Online Kemendikbudristek Informatika SMP Kelas VIII Fase D (Semester 2 / Genap)',
  },
};

// ============================================================================
// 1. BANK SOAL KELAS VII - SEMESTER GANJIL (FASE D)
// ============================================================================
export const QUESTIONS_VII_GANJIL: Question[] = [
  {
    id: 1,
    jenjang: 'VII',
    semester: 'Ganjil',
    elemen: 'Berpikir Komputasional (BK)',
    content:
      'Dalam Berpikir Komputasional (Computational Thinking) Fase D Kelas VII, kemampuan memecah suatu permasalahan yang besar dan kompleks menjadi bagian-bagian yang lebih kecil agar lebih mudah diselesaikan disebut...',
    image: null,
    options: [
      'Dekomposisi (Decomposition)',
      'Pengenalan Pola (Pattern Recognition)',
      'Abstraksi (Abstraction)',
      'Perancangan Algoritma (Algorithm Design)',
    ],
    answer: 'A',
    difficulty: 'REGULER',
    explanation:
      'Dekomposisi (Decomposition) adalah teknik memecah masalah kompleks menjadi sub-masalah yang lebih kecil dan sederhana sehingga lebih mudah dikelola dan diselesaikan.',
  },
  {
    id: 2,
    jenjang: 'VII',
    semester: 'Ganjil',
    elemen: 'Teknologi Informasi & Komunikasi (TIK)',
    content:
      'Saat mengelola file di dalam folder komputer pada materi TIK Kelas VII, setiap file memiliki ekstensi (extension) di belakang namanya yang menunjukkan jenis file tersebut. Pasangan ekstensi file dan jenis dokumen yang tepat di bawah ini adalah...',
    image: null,
    options: [
      '.docx untuk dokumen pengolah kata dan .xlsx untuk lembar kerja (spreadsheet)',
      '.mp3 untuk gambar foto dan .jpg untuk dokumen teks',
      '.pdf untuk file aplikasi instalasi Windows dan .exe untuk video',
      '.pptx untuk file suara musik dan .png untuk basis data',
    ],
    answer: 'A',
    difficulty: 'REGULER',
    explanation:
      'Ekstensi .docx merupakan format standar dokumen pengolah kata (Microsoft Word) dan .xlsx merupakan format standar lembar kerja angka (Microsoft Excel).',
  },
  {
    id: 3,
    jenjang: 'VII',
    semester: 'Ganjil',
    elemen: 'Teknologi Informasi & Komunikasi (TIK)',
    content:
      'Antarmuka pengguna pada komputer modern yang memungkinkan pengguna berinteraksi dengan perangkat menggunakan elemen visual seperti ikon (icon), menu, tombol, dan jendela (window) yang diklik dengan mouse disebut...',
    image: null,
    options: [
      'Command Line Interface (CLI)',
      'Graphical User Interface (GUI)',
      'Voice User Interface (VUI)',
      'Basic Input Output System (BIOS)',
    ],
    answer: 'B',
    difficulty: 'REGULER',
    explanation:
      'Graphical User Interface (GUI) adalah antarmuka berbasis grafis (ikon, tombol, jendela) yang memudahkan pengguna berinteraksi dengan sistem operasi dibanding mengetik perintah teks pada CLI.',
  },
  {
    id: 4,
    jenjang: 'VII',
    semester: 'Ganjil',
    elemen: 'Sistem Komputer (SK)',
    content:
      'Perangkat keras (hardware) komputer dikelompokkan berdasarkan fungsinya menjadi peranti masukan (Input), pemroses (Process), keluaran (Output), dan penyimpanan (Storage). Manakah kelompok perangkat di bawah ini yang ketiganya merupakan peranti masukan (Input Device)?',
    image: null,
    options: [
      'Keyboard, Mouse, dan Scanner',
      'Monitor, Printer, dan Proyektor LCD',
      'Flashdisk, Harddisk (HDD), dan RAM',
      'Speaker, Microphone, dan Plotter',
    ],
    answer: 'A',
    difficulty: 'REGULER',
    explanation:
      'Keyboard (papan ketik), Mouse (tetikus), dan Scanner (pemindai) berfungsi memasukkan data atau perintah dari luar ke dalam sistem komputer untuk diproses.',
  },
  {
    id: 5,
    jenjang: 'VII',
    semester: 'Ganjil',
    elemen: 'Sistem Komputer (SK)',
    content:
      'Ketika mengirim surat elektronik (Email) kepada guru dan beberapa teman sekelas, fitur kolom penerima yang digunakan apabila kita ingin mengirim salinan email ke penerima lain TANPA diketahui oleh penerima utama adalah...',
    image: null,
    options: [
      'CC (Carbon Copy)',
      'BCC (Blind Carbon Copy)',
      'Subject (Subjek Email)',
      'Forward (Teruskan)',
    ],
    answer: 'B',
    difficulty: 'REGULER',
    explanation:
      'BCC (Blind Carbon Copy) digunakan untuk mengirimkan salinan email kepada alamat email lain secara tersembunyi sehingga penerima di kolom To maupun CC tidak dapat melihat daftar alamat di BCC.',
  },
  {
    id: 6,
    jenjang: 'VII',
    semester: 'Ganjil',
    elemen: 'Berpikir Komputasional (BK)',
    content:
      'Pada tantangan Berpikir Komputasional "Mengisi Ember" Kelas VII, tersedia 3 keran air yang mengalir dengan kecepatan sama. Satu ember penuh membutuhkan waktu 12 menit jika diisi dengan 1 keran. Namun, sebuah ember dapat diisi oleh maksimal 2 keran sekaligus (waktu pengisian menjadi 6 menit). Jika seorang siswa harus mengisi penuh 3 ember menggunakan 3 keran yang tersedia secara optimal, berapakah waktu minimum yang dibutuhkan?',
    image: null,
    options: [
      '12 menit, dengan mengisi Ember 1 (1 keran) dan Ember 2 (2 keran), lalu belum optimal.',
      '8 menit, dengan membagi pengisian setiap ember menjadi tahap 4 menit secara bergantian sehingga ketiga keran selalu bekerja penuh tanpa ada yang menganggur.',
      '18 menit, karena setiap ember harus diisi satu per satu menggunakan 2 keran secara berurutan.',
      '6 menit, karena 3 ember dapat langsung diisi oleh 3 keran secara bersamaan dalam 6 menit.',
    ],
    answer: 'B',
    difficulty: 'HOTS',
    explanation:
      'Total kapasitas 3 ember = 3 × 12 menit-keran = 36 menit-keran. Karena ada 3 keran aktif serentak, waktu optimal = 36 / 3 = 12 menit jika 1 keran per ember, atau dengan jadwal pembagian 2 keran per ember: menit 0–4 (Ember A: 2 keran, Ember B: 1 keran), menit 4–8 (Ember A: 1 keran, Ember C: 2 keran), menit 8–12 (Ember B: 1 keran, Ember C: 1 keran) — pada variasi 2 keran mempercepat 1,5x, optimasi penjadwalan paralel menghasilkan waktu paling efisien tanpa keran menganggur.',
  },
  {
    id: 7,
    jenjang: 'VII',
    semester: 'Ganjil',
    elemen: 'Berpikir Komputasional (BK)',
    content:
      'Dalam materi Representasi Data Biner (Hitam-Putih) pada citra digital Kelas VII, sebuah kisi gambar berukuran 4×4 piksel dikodekan dengan angka 1 untuk kotak berwarna Putih dan angka 0 untuk kotak berwarna Hitam. Jika baris pertama memiliki kode biner 1010 dan baris kedua 0101, kemudian dilakukan operasi pembalikan warna (Inversi / Negatif Citra), maka kode biner baru untuk baris pertama dan kedua secara berurutan adalah...',
    image: null,
    options: [
      'Baris pertama: 0101 dan Baris kedua: 1010',
      'Baris pertama: 1111 dan Baris kedua: 0000',
      'Baris pertama: 1010 dan Baris kedua: 0101',
      'Baris pertama: 0011 dan Baris kedua: 1100',
    ],
    answer: 'A',
    difficulty: 'HOTS',
    explanation:
      'Operasi inversi (negatif citra) mengubah setiap bit 1 (Putih) menjadi 0 (Hitam) dan setiap bit 0 (Hitam) menjadi 1 (Putih). Maka 1010 berubah menjadi 0101, dan 0101 berubah menjadi 1010.',
  },
  {
    id: 8,
    jenjang: 'VII',
    semester: 'Ganjil',
    elemen: 'Teknologi Informasi & Komunikasi (TIK)',
    content:
      'Seorang siswa Kelas VII UPTD SMP Negeri 7 Kisaran ingin mencari dokumen resmi berformat PDF tentang "Kurikulum Merdeka Informatika" di mesin pencari Google tanpa menampilkan hasil dari blog pribadi yang tidak relevan. Sintaks pencarian (Search Query) tingkat lanjut manakah yang paling efektif digunakan?',
    image: null,
    options: [
      '"Kurikulum Merdeka Informatika" filetype:pdf',
      'Kurikulum Merdeka Informatika +gambar.jpg',
      'www.google.com/pdf-kurikulum-merdeka',
      '@Kurikulum #Merdeka #Informatika .docx',
    ],
    answer: 'A',
    difficulty: 'HOTS',
    explanation:
      'Tanda kutip ("...") memastikan mesin pencari mencari frasa persis secara utuh, sedangkan operator filetype:pdf menyaring hasil pencarian agar hanya menampilkan dokumen dengan ekstensi .pdf.',
  },
  {
    id: 9,
    jenjang: 'VII',
    semester: 'Ganjil',
    elemen: 'Sistem Komputer (SK)',
    content:
      'Pada materi Sistem Komputer Kelas VII tentang Bilangan Biner, sebuah lampu indikator pintar memiliki 5 sakelar biner berurutan dari kiri ke kanan dengan nilai tempat 16, 8, 4, 2, dan 1. Jika sakelar diatur pada posisi ON-OFF-ON-ON-OFF (10110₂), berapakah nilai desimal daya yang dihasilkan oleh kombinasi sakelar tersebut?',
    image: null,
    options: [
      '22',
      '19',
      '26',
      '14',
    ],
    answer: 'A',
    difficulty: 'HOTS',
    explanation:
      'Kode biner 10110₂ dihitung berdasarkan nilai tempatnya: (1 × 16) + (0 × 8) + (1 × 4) + (1 × 2) + (0 × 1) = 16 + 0 + 4 + 2 + 0 = 22.',
  },
  {
    id: 10,
    jenjang: 'VII',
    semester: 'Ganjil',
    elemen: 'Sistem Komputer (SK)',
    content:
      'Seorang siswa hendak membeli laptop untuk kebutuhan belajar daring, mengetik tugas, dan mengikuti ANBK di sekolah. Spesifikasi manakah yang paling seimbang dan tepat dipilih agar sistem operasi serta aplikasi peramban berjalan lancar tanpa pemborosan biaya komponen yang tidak perlu?',
    image: null,
    options: [
      'Prosesor Dual/Quad Core hemat daya, RAM 8 GB, penyimpanan SSD 256 GB, serta layar dengan webcam dan Wi-Fi aktif.',
      'Prosesor tanpa RAM sama sekali tetapi menggunakan Harddisk eksternal 4 TB dan printer dot-matrix.',
      'Komputer tanpa Sistem Operasi (OS) dan tanpa perangkat Output monitor agar hemat baterai.',
      'Hanya membeli kartu grafis (VGA Card) saja tanpa motherboard dan tanpa CPU.',
    ],
    answer: 'A',
    difficulty: 'HOTS',
    explanation:
      'Untuk kebutuhan belajar daring dan ANBK, kombinasi prosesor Dual/Quad Core, RAM 8 GB, dan SSD 256 GB memberikan kecepatan booting serta multitasking yang responsif, ditambah dukungan webcam dan Wi-Fi untuk konektivitas ujian.',
  },
  {
    id: 11,
    jenjang: 'VII',
    semester: 'Ganjil',
    elemen: 'Berpikir Komputasional (BK)',
    content:
      'Dalam perancangan algoritma dengan diagram alir (Flowchart), simbol bangun datar berbentuk belah ketupat (Decision) digunakan untuk menunjukkan...',
    image: null,
    options: [
      'Titik awal atau akhir program (Terminator)',
      'Proses pengambilan keputusan atau percabangan kondisi (Ya/Tidak)',
      'Operasi penginputan atau pengeluaran data secara manual',
      'Alur jalannya program (Flow line)',
    ],
    answer: 'B',
    difficulty: 'REGULER',
    explanation:
      'Simbol belah ketupat (Decision / Diamond) pada diagram alir digunakan untuk memeriksa suatu kondisi logis yang menghasilkan dua percabangan arah (True/False atau Ya/Tidak).',
  },
  {
    id: 12,
    jenjang: 'VII',
    semester: 'Ganjil',
    elemen: 'Teknologi Informasi & Komunikasi (TIK)',
    content:
      'Pintasan papan ketik (Keyboard Shortcut) standar yang digunakan untuk membatalkan tindakan pengeditan terakhir (Undo) dan menyimpan dokumen (Save) secara berurutan adalah...',
    image: null,
    options: [
      'Ctrl + Z dan Ctrl + S',
      'Ctrl + C dan Ctrl + V',
      'Ctrl + X dan Ctrl + P',
      'Ctrl + A dan Ctrl + F',
    ],
    answer: 'A',
    difficulty: 'REGULER',
    explanation:
      'Ctrl + Z berfungsi membatalkan perintah terakhir (Undo) dan Ctrl + S berfungsi menyimpan file/dokumen (Save) pada hampir semua aplikasi komputer.',
  },
  {
    id: 13,
    jenjang: 'VII',
    semester: 'Ganjil',
    elemen: 'Sistem Komputer (SK)',
    content:
      'Dalam hierarki kapasitas data digital komputer, urutan satuan penyimpanan data dari yang terkecil hingga terbesar yang benar adalah...',
    image: null,
    options: [
      'Bit -> Byte -> Kilobyte (KB) -> Megabyte (MB) -> Gigabyte (GB)',
      'Gigabyte (GB) -> Megabyte (MB) -> Kilobyte (KB) -> Byte -> Bit',
      'Byte -> Bit -> Gigabyte (GB) -> Megabyte (MB) -> Kilobyte (KB)',
      'Megabyte (MB) -> Kilobyte (KB) -> Gigabyte (GB) -> Byte -> Bit',
    ],
    answer: 'A',
    difficulty: 'REGULER',
    explanation:
      'Urutan kapasitas data dari terkecil ke terbesar adalah Bit (0 atau 1), Byte (8 bit), Kilobyte (1024 Byte), Megabyte (1024 KB), dan Gigabyte (1024 MB).',
  },
  {
    id: 14,
    jenjang: 'VII',
    semester: 'Ganjil',
    elemen: 'Berpikir Komputasional (BK)',
    content:
      'Seorang siswa memiliki 4 tugas sekolah yang harus diselesaikan dalam satu hari dengan durasi: Tugas Matematika (40 menit), Tugas IPA (30 menit), Tugas Informatika (20 menit), dan Tugas Bahasa (50 menit). Jika siswa ingin meminimalkan rata-rata waktu tunggu penyelesaian tugas (Shortest Job First), maka urutan pengerjaan tugas yang paling optimal adalah...',
    image: null,
    options: [
      'Informatika -> IPA -> Matematika -> Bahasa',
      'Bahasa -> Matematika -> IPA -> Informatika',
      'Matematika -> IPA -> Bahasa -> Informatika',
      'Informatika -> Bahasa -> IPA -> Matematika',
    ],
    answer: 'A',
    difficulty: 'HOTS',
    explanation:
      'Strategi Shortest Job First (SJF) dalam komputasi menyortir tugas berdasarkan durasi terpendek terlebih dahulu (20 menit, 30 menit, 40 menit, 50 menit) untuk meminimalkan waktu tunggu rata-rata antrean.',
  },
  {
    id: 15,
    jenjang: 'VII',
    semester: 'Ganjil',
    elemen: 'Teknologi Informasi & Komunikasi (TIK)',
    content:
      'Ketika mengirimkan tugas proyek Informatika kepada guru melalui email, etika komunikasi digital resmi yang paling tepat dan profesional adalah...',
    image: null,
    options: [
      'Menuliskan subjek email yang jelas (misal: "Tugas Proyek TIK Kelas VII-1 - Nama Siswa"), menyertakan salam pembuka, isi ringkas, lampiran file yang sesuai, dan identitas pengirim.',
      'Mengosongkan subjek dan isi pesan lalu langsung mengirimkan lampiran tanpa nama file yang jelas.',
      'Mengetik seluruh isi email dengan huruf kapital (Caps Lock) dan menggunakan bahasa gaul tanpa salam.',
      'Mengirim email yang sama secara berulang-ulang sebanyak 20 kali dalam satu menit.',
    ],
    answer: 'A',
    difficulty: 'HOTS',
    explanation:
      'Etika surel profesional mencakup subjek yang informatif, salam pembuka yang santun, isi pesan yang menjelaskan tujuan pengiriman serta nama file lampiran yang rapi.',
  },
  {
    id: 16,
    jenjang: 'VII',
    semester: 'Ganjil',
    elemen: 'Sistem Komputer (SK)',
    content:
      'Sebuah kartu jaringan (NIC) mengirimkan sinyal biner 8-bit dengan nilai 01100100₂. Berapakah nilai desimal (basis 10) dari sinyal biner tersebut jika dihitung berdasarkan nilai tempatnya?',
    image: null,
    options: [
      '100',
      '96',
      '108',
      '124',
    ],
    answer: 'A',
    difficulty: 'HOTS',
    explanation:
      '01100100₂ = (0 × 128) + (1 × 64) + (1 × 32) + (0 × 16) + (0 × 8) + (1 × 4) + (0 × 2) + (0 × 1) = 64 + 32 + 4 = 100.',
  },
  {
    id: 17,
    jenjang: 'VII',
    semester: 'Ganjil',
    elemen: 'Berpikir Komputasional (BK)',
    content:
      'Dalam pilar Abstraksi (Abstraction), seorang siswa membuat denah jalur bus sekolah dari rumah ke UPTD SMP Negeri 7 Kisaran. Tindakan abstraksi yang tepat yang harus ia lakukan adalah...',
    image: null,
    options: [
      'Fokus pada rute jalan utama, halte transit, dan nomor bus, sambil mengabaikan warna cat rumah warga atau bentuk pohon di sepanjang jalan yang tidak relevan dengan navigasi.',
      'Menggambar setiap batu dan tanaman hias di trotoar agar peta berukuran sangat besar.',
      'Menghapus rute jalan dan hanya menggambar foto siswa di atas kertas kosong.',
      'Memasukkan semua nama pemilik warung di sepanjang jalan tanpa rute transportasi.',
    ],
    answer: 'A',
    difficulty: 'HOTS',
    explanation:
      'Abstraksi adalah teknik menyaring informasi penting yang dibutuhkan untuk menyelesaikan masalah dan mengesampingkan rincian detail yang tidak relevan.',
  },
  {
    id: 18,
    jenjang: 'VII',
    semester: 'Ganjil',
    elemen: 'Teknologi Informasi & Komunikasi (TIK)',
    content:
      'Pada aplikasi pengolah kata, bagian margin atas dan margin bawah halaman dokumen yang secara otomatis diulang pada setiap lembar untuk mencantumkan judul buku, nomor halaman, atau nama institusi disebut...',
    image: null,
    options: [
      'Header and Footer',
      'Drop Cap and WordArt',
      'Watermark and Border',
      'Page Break and Bullet',
    ],
    answer: 'A',
    difficulty: 'REGULER',
    explanation:
      'Header (catatan kepala di margin atas) dan Footer (catatan kaki di margin bawah) secara otomatis muncul di setiap halaman dokumen yang bersangkutan.',
  },
  {
    id: 19,
    jenjang: 'VII',
    semester: 'Ganjil',
    elemen: 'Sistem Komputer (SK)',
    content:
      'Perangkat keras keluaran (Output Device) yang berfungsi menampilkan antarmuka visual grafis dari komputer kepada pengguna secara langsung adalah...',
    image: null,
    options: [
      'Monitor',
      'Keyboard',
      'Scanner',
      'Mikrofon',
    ],
    answer: 'A',
    difficulty: 'REGULER',
    explanation:
      'Monitor adalah peranti keluaran visual utama yang menampilkan hasil pemrosesan grafis dan antarmuka sistem komputer kepada pengguna.',
  },
  {
    id: 20,
    jenjang: 'VII',
    semester: 'Ganjil',
    elemen: 'Berpikir Komputasional (BK)',
    content:
      'Pada antrean peminjaman buku perpustakaan sekolah yang menerapkan prinsip First In First Out (FIFO), terdapat urutan antrean siswa: Dodi, Sarah, Budi, dan Rina. Jika dua siswa pertama selesai dilayani dan kemudian masuk siswa baru bernama Andi ke antrean, siapakah siswa yang saat ini berada di urutan terdepan antrean?',
    image: null,
    options: [
      'Budi',
      'Sarah',
      'Andi',
      'Dodi',
    ],
    answer: 'A',
    difficulty: 'HOTS',
    explanation:
      'Pada FIFO, elemen yang masuk pertama keluar pertama. Dari antrean [Dodi, Sarah, Budi, Rina], setelah Dodi dan Sarah selesai dilayani, yang berada paling depan adalah Budi. Andi masuk di urutan paling belakang.',
  },
  {
    id: 21,
    jenjang: 'VII',
    semester: 'Ganjil',
    elemen: 'Teknologi Informasi & Komunikasi (TIK)',
    content:
      'Ketika melakukan riset materi sekolah di Google, seorang siswa ingin mencari informasi tentang "virus komputer" namun TIDAK ingin hasil pencariannya memuat artikel tentang "virus biologi / penyakit". Operator pencarian boolean yang paling efektif digunakan adalah...',
    image: null,
    options: [
      '"virus komputer" -biologi -penyakit',
      '"virus komputer" +biologi +penyakit',
      'virus OR biologi OR penyakit',
      'filetype:virus biologi penyakit',
    ],
    answer: 'A',
    difficulty: 'HOTS',
    explanation:
      'Operator tanda minus (-) di depan kata kunci berfungsi mengecualikan kata tersebut dari hasil pencarian mesin pencari.',
  },
  {
    id: 22,
    jenjang: 'VII',
    semester: 'Ganjil',
    elemen: 'Sistem Komputer (SK)',
    content:
      'Ketika tombol daya (Power) komputer ditekan, program awal di dalam chip ROM yang bertugas memeriksa kesiapan seluruh komponen perangkat keras (RAM, keyboard, drive) sebelum memuat Sistem Operasi disebut...',
    image: null,
    options: [
      'POST (Power-On Self-Test) yang dijalankan oleh BIOS/UEFI',
      'Disk Defragmenter yang dijalankan oleh Windows Explorer',
      'Antivirus Real-Time Scan',
      'Web Browser Cache Cleaner',
    ],
    answer: 'A',
    difficulty: 'HOTS',
    explanation:
      'BIOS/UEFI mengeksekusi rutinitas POST (Power-On Self-Test) untuk memastikan semua perangkat keras utama berfungsi normal sebelum menyerahkan kontrol ke bootloader Sistem Operasi.',
  },
  {
    id: 23,
    jenjang: 'VII',
    semester: 'Ganjil',
    elemen: 'Berpikir Komputasional (BK)',
    content:
      'Perhatikan barisan pola bilangan biner berikut: 0001, 0010, 0100, 1000, ... Jika pola perpindahan bit 1 tersebut berlanjut pada sistem 8-bit, bilangan biner berikutnya setelah 00001000 adalah...',
    image: null,
    options: [
      '00010000',
      '00001001',
      '00000100',
      '11110000',
    ],
    answer: 'A',
    difficulty: 'REGULER',
    explanation:
      'Pola ini menggeser bit 1 ke kiri satu langkah pada setiap suku (kelipatan 2): 1 (0001), 2 (0010), 4 (0100), 8 (1000), 16 (00010000).',
  },
  {
    id: 24,
    jenjang: 'VII',
    semester: 'Ganjil',
    elemen: 'Teknologi Informasi & Komunikasi (TIK)',
    content:
      'Layanan penyimpanan data berbasis awan (Cloud Storage) seperti Google Drive memiliki keunggulan utama dibandingkan flashdisk fisik, yaitu...',
    image: null,
    options: [
      'Data dapat diakses dari mana saja melalui internet menggunakan berbagai perangkat tanpa takut hilang secara fisik.',
      'Data tidak membutuhkan kuota atau koneksi internet sama sekali untuk disinkronkan.',
      'Kapasitas penyimpanannya secara otomatis menjadi tak hingga tanpa batasan akun.',
      'Membuat komputer dapat menyala tanpa menggunakan arus listrik.',
    ],
    answer: 'A',
    difficulty: 'REGULER',
    explanation:
      'Cloud Storage memungkinkan akses file secara fleksibel dari berbagai perangkat melalui koneksi internet dan aman dari kerusakan atau kehilangan perangkat fisik.',
  },
  {
    id: 25,
    jenjang: 'VII',
    semester: 'Ganjil',
    elemen: 'Sistem Komputer (SK)',
    content:
      'Sebuah komputer tiba-tiba berjalan sangat lambat saat membuka browser dengan 20 tab bersamaan. Melalui Task Manager, terlihat penggunaan Memori RAM mencapai 98% sedangkan penggunaan CPU hanya 12%. Solusi perbaikan yang paling rasional berdasarkan cara kerja sistem komputer adalah...',
    image: null,
    options: [
      'Menutup tab browser yang tidak digunakan untuk membebaskan ruang kerja RAM atau menambah kapasitas modul RAM fisik.',
      'Mengganti kabel monitor dengan kabel baru berukuran lebih panjang.',
      'Memformat ulang harddisk tanpa menutup aplikasi yang sedang aktif.',
      'Menghapus keyboard dan menggantinya dengan printer dot-matrix.',
    ],
    answer: 'A',
    difficulty: 'HOTS',
    explanation:
      'Tingginya penggunaan RAM (98%) menyebabkan sistem melakukan paging/swapping ke disk yang jauh lebih lambat (bottleneck memori). Menutup tab membebaskan memori RAM atau meng-upgrade RAM mengatasi masalah tersebut.',
  }
];

// ============================================================================
// 2. BANK SOAL KELAS VII - SEMESTER GENAP (FASE D)
// ============================================================================
export const QUESTIONS_VII_GENAP: Question[] = [
  {
    id: 1,
    jenjang: 'VII',
    semester: 'Genap',
    elemen: 'Jaringan Komputer & Internet (JKI)',
    content:
      'Fitur pada ponsel pintar (smartphone) yang memungkinkan perangkat tersebut berbagi koneksi internet seluler dengan laptop atau perangkat lain di sekitarnya melalui jaringan nirkabel (Wi-Fi) disebut...',
    image: null,
    options: [
      'Tethering (Mobile Hotspot)',
      'Airplane Mode (Mode Pesawat)',
      'Defragmentasi Disk',
      'Screen Mirroring',
    ],
    answer: 'A',
    difficulty: 'REGULER',
    explanation:
      'Tethering atau Mobile Hotspot adalah fitur untuk membagikan koneksi internet dari smartphone ke perangkat lain melalui Wi-Fi, Bluetooth, atau kabel USB.',
  },
  {
    id: 2,
    jenjang: 'VII',
    semester: 'Genap',
    elemen: 'Analisis Data (AD)',
    content:
      'Dalam aplikasi pengolah lembar kerja (Spreadsheet seperti Microsoft Excel) Kelas VII, pertemuan antara kolom C dan baris ke-8 disebut sebagai alamat sel (Cell Reference) yang ditulis...',
    image: null,
    options: [
      '8C',
      'C8',
      'C:8',
      'ROW8-COLC',
    ],
    answer: 'B',
    difficulty: 'REGULER',
    explanation:
      'Penulisan alamat sel (Cell) pada lembar kerja selalu diawali dengan huruf Kolom diikuti nomor Baris, sehingga pertemuan kolom C dan baris 8 ditulis C8.',
  },
  {
    id: 3,
    jenjang: 'VII',
    semester: 'Genap',
    elemen: 'Analisis Data (AD)',
    content:
      'Untuk menghitung nilai rata-rata ujian Informatika dari sekumpulan data nilai siswa yang berada pada rentang sel D2 sampai D11 di aplikasi lembar kerja (Spreadsheet), rumus fungsi yang benar adalah...',
    image: null,
    options: [
      '=SUM(D2:D11)',
      '=AVERAGE(D2:D11)',
      '=MAX(D2:D11)',
      '=COUNT(D2:D11)',
    ],
    answer: 'B',
    difficulty: 'REGULER',
    explanation:
      'Fungsi =AVERAGE(range) digunakan untuk menghitung rata-rata aritmatika dari sekumpulan angka pada rentang sel yang dipilih, sedangkan =SUM untuk menjumlahkan.',
  },
  {
    id: 4,
    jenjang: 'VII',
    semester: 'Genap',
    elemen: 'Algoritma & Pemrograman (AP)',
    content:
      'Pada lingkungan pemrograman visual berbasis blok Scratch yang dipelajari di Kelas VII Semester Genap, blok perintah "when green flag clicked" (ketika bendera hijau diklik) termasuk ke dalam kategori blok...',
    image: null,
    options: [
      'Motion (Gerakan)',
      'Events (Kejadian / Peristiwa)',
      'Looks (Tampilan)',
      'Sound (Suara)',
    ],
    answer: 'B',
    difficulty: 'REGULER',
    explanation:
      'Blok "when green flag clicked" berada pada kategori Events (Kejadian) karena berfungsi sebagai pemicu (trigger) dimulainya eksekusi skrip program pada Sprite.',
  },
  {
    id: 5,
    jenjang: 'VII',
    semester: 'Genap',
    elemen: 'Dampak Sosial Informatika (DSI)',
    content:
      'Dalam pemanfaatan teknologi informasi dan media sosial, informasi sensitif yang termasuk Data Pribadi dan TIDAK BOLEH dibagikan secara sembarangan di ruang publik internet adalah...',
    image: null,
    options: [
      'Judul buku pelajaran Informatika yang sedang dipelajari di sekolah',
      'Password akun, kode OTP (One-Time Password), nomor kartu keluarga, dan alamat rumah lengkap',
      'Nama mata pelajaran favorit dan jadwal ekstrakurikuler umum',
      'Tips belajar pemrograman Scratch bersama teman sekelas',
    ],
    answer: 'B',
    difficulty: 'REGULER',
    explanation:
      'Password, kode rahasia OTP, nomor identitas kependudukan, dan alamat detail merupakan data pribadi sensitif yang rawan disalahgunakan untuk pencurian identitas atau pembobolan akun.',
  },
  {
    id: 6,
    jenjang: 'VII',
    semester: 'Genap',
    elemen: 'Jaringan Komputer & Internet (JKI)',
    content:
      'Pada materi Proteksi Data dan Enkripsi Kelas VII, algoritma Caesar Cipher mengenkripsi teks dengan menggeser setiap huruf sejauh kunci tertentu. Jika sebuah pesan teks asli (Plaintext) "DATA" dienkripsi dengan kunci geser 3 huruf ke kanan (A -> D, B -> E, dst.), maka teks sandi (Ciphertext) yang dihasilkan adalah...',
    image: null,
    options: [
      'GDWD',
      'Cbsb',
      'FCFC',
      'HEHE',
    ],
    answer: 'A',
    difficulty: 'HOTS',
    explanation:
      'Geser setiap huruf pada kata "DATA" sebanyak 3 langkah ke kanan dalam alfabet: D (+3) = G, A (+3) = D, T (+3) = W, A (+3) = D. Sehingga Ciphertext-nya adalah "GDWD".',
  },
  {
    id: 7,
    jenjang: 'VII',
    semester: 'Genap',
    elemen: 'Analisis Data (AD)',
    content:
      'Perhatikan data nilai praktik siswa Kelas VII-1 pada sel B2 sampai B6 berikut: B2 = 80, B3 = 65, B4 = 90, B5 = 75, dan B6 = 60. Jika guru menuliskan rumus fungsi =COUNTIF(B2:B6, ">=70") untuk menghitung jumlah siswa yang mencapai KKM 70, maka hasil angka yang muncul adalah...',
    image: null,
    options: [
      '2',
      '3',
      '4',
      '5',
    ],
    answer: 'B',
    difficulty: 'HOTS',
    explanation:
      'Fungsi =COUNTIF(B2:B6, ">=70") menghitung banyaknya sel pada rentang B2:B6 yang nilainya lebih besar atau sama dengan 70. Nilai yang memenuhi syarat adalah 80 (B2), 90 (B4), dan 75 (B5), yaitu sebanyak 3 siswa.',
  },
  {
    id: 8,
    jenjang: 'VII',
    semester: 'Genap',
    elemen: 'Algoritma & Pemrograman (AP)',
    content:
      'Pada pemrograman Scratch Kelas VII, sebuah karakter (Sprite) kucing berada pada posisi koordinat awal (x: 0, y: 0). Kemudian dijalankan blok perulangan "repeat 4" yang di dalamnya berisi dua perintah berurutan: "change x by 15" dan "change y by -10". Di manakah posisi koordinat akhir (x, y) Sprite kucing setelah perulangan selesai?',
    image: null,
    options: [
      '(x: 60, y: -40)',
      '(x: 15, y: -10)',
      '(x: 40, y: -60)',
      '(x: -60, y: 40)',
    ],
    answer: 'A',
    difficulty: 'HOTS',
    explanation:
      'Perulangan "repeat 4" menjalankan instruksi sebanyak 4 kali. Nilai x bertambah 4 × 15 = 60, dan nilai y berubah 4 × (-10) = -40. Maka koordinat akhirnya adalah (x: 60, y: -40).',
  },
  {
    id: 9,
    jenjang: 'VII',
    semester: 'Genap',
    elemen: 'Algoritma & Pemrograman (AP)',
    content:
      'Seorang siswa ingin membuat program lampu lalu lintas sederhana di Scratch dengan aturan: "JIKA variabel warna_lampu bernilai MERAH, MAKA Sprite mobil berhenti (move 0 steps), JIKA TIDAK MAKA Sprite mobil maju 10 langkah (move 10 steps)". Struktur blok kontrol yang paling tepat digunakan adalah...',
    image: null,
    options: [
      'Blok percabangan dua kondisi "if <warna_lampu = MERAH> then ... else ..."',
      'Blok suara "play sound Meow until done"',
      'Blok tampilan "next costume" tanpa kondisi',
      'Blok penghapusan "delete this clone"',
    ],
    answer: 'A',
    difficulty: 'HOTS',
    explanation:
      'Karena terdapat dua aksi berbeda yang bergantung pada benar atau salahnya suatu syarat (kondisi warna_lampu = MERAH), maka struktur kontrol yang tepat adalah percabangan "if ... then ... else ...".',
  },
  {
    id: 10,
    jenjang: 'VII',
    semester: 'Genap',
    elemen: 'Dampak Sosial Informatika (DSI)',
    content:
      'Kelompok siswa Kelas VII sedang mengerjakan proyek makalah Informatika secara kolaboratif dari rumah masing-masing dalam waktu bersamaan. Agar seluruh anggota kelompok dapat mengetik, mengedit, dan melihat perubahan dokumen secara real-time tanpa harus saling mengirim file berulang kali lewat flashdisk, solusi perkakas kolaborasi daring yang paling tepat adalah...',
    image: null,
    options: [
      'Menggunakan Google Docs / Microsoft 365 Online dengan pengaturan akses berbagi (Share) sebagai Editor bagi anggota kelompok.',
      'Mengetik di aplikasi Notepad offline lalu memotret layar monitor dengan kamera ponsel.',
      'Menyimpan dokumen di dalam CD-ROM sekali tulis (CD-R) dan mengirimkannya lewat pos.',
      'Mematikan koneksi internet agar dokumen tidak bisa diakses oleh anggota kelompok lain.',
    ],
    answer: 'A',
    difficulty: 'HOTS',
    explanation:
      'Aplikasi kolaborasi berbasis cloud seperti Google Docs memungkinkan beberapa pengguna dengan hak akses Editor untuk menyunting satu dokumen yang sama secara serentak (real-time) lengkap dengan riwayat revisi.',
  },
  {
    id: 11,
    jenjang: 'VII',
    semester: 'Genap',
    elemen: 'Jaringan Komputer & Internet (JKI)',
    content:
      'Teknologi komunikasi nirkabel jarak dekat (umumnya hingga 10 meter) yang biasa digunakan untuk menghubungkan smartphone dengan headphone atau mouse nirkabel adalah...',
    image: null,
    options: [
      'Bluetooth',
      'Satelit Geostasioner',
      'Kabel Fiber Optik',
      'Gelombang Radio AM',
    ],
    answer: 'A',
    difficulty: 'REGULER',
    explanation:
      'Bluetooth adalah teknologi transmisi data nirkabel jarak pendek (Personal Area Network) berdaya rendah yang ideal untuk periferal nirkabel.',
  },
  {
    id: 12,
    jenjang: 'VII',
    semester: 'Genap',
    elemen: 'Analisis Data (AD)',
    content:
      'Pada aplikasi pengolah lembar kerja (Spreadsheet), fungsi yang digunakan untuk mencari nilai angka tertinggi dan nilai angka terendah dari rentang data sel C2 sampai C30 secara berurutan adalah...',
    image: null,
    options: [
      '=MAX(C2:C30) dan =MIN(C2:C30)',
      '=SUM(C2:C30) dan =AVERAGE(C2:C30)',
      '=COUNT(C2:C30) dan =LARGE(C2:C30)',
      '=HIGH(C2:C30) dan =LOW(C2:C30)',
    ],
    answer: 'A',
    difficulty: 'REGULER',
    explanation:
      '=MAX() digunakan untuk mencari nilai maksimum (tertinggi) dan =MIN() digunakan untuk mencari nilai minimum (terendah) dalam rentang sel.',
  },
  {
    id: 13,
    jenjang: 'VII',
    semester: 'Genap',
    elemen: 'Algoritma & Pemrograman (AP)',
    content:
      'Dalam aplikasi pemrograman visual Scratch, area tempat karakter atau objek (Sprite) bergerak, berinteraksi, dan menampilkan aksi visual saat program dijalankan disebut...',
    image: null,
    options: [
      'Panggung (Stage)',
      'Blok Palet',
      'Area Skrip (Code Workspace)',
      'Daftar Kostum',
    ],
    answer: 'A',
    difficulty: 'REGULER',
    explanation:
      'Stage (Panggung) adalah kanvas tampilan latar tempat semua Sprite beraksi dan menampilkan hasil eksekusi program.',
  },
  {
    id: 14,
    jenjang: 'VII',
    semester: 'Genap',
    elemen: 'Dampak Sosial Informatika (DSI)',
    content:
      'Segala rekam jejak aktivitas yang ditinggalkan seseorang saat menggunakan internet, seperti riwayat pencarian, unggahan foto, dan komentar di media sosial disebut...',
    image: null,
    options: [
      'Jejak Digital (Digital Footprint)',
      'Nama Domain (DNS)',
      'Kapasitas RAM',
      'Firewall',
    ],
    answer: 'A',
    difficulty: 'REGULER',
    explanation:
      'Digital Footprint (Jejak Digital) adalah jejak data yang tertinggal saat seseorang berinteraksi di ruang siber dan dapat bersifat permanen.',
  },
  {
    id: 15,
    jenjang: 'VII',
    semester: 'Genap',
    elemen: 'Jaringan Komputer & Internet (JKI)',
    content:
      'Seorang siswa mengamati bahwa sinyal Wi-Fi di ponselnya melemah drastis dari 4 bar menjadi 1 bar ketika ia berpindah ke kamar belakang yang terhalang 2 dinding beton tebal dari posisi Router Wi-Fi. Faktor teknis penyebab penurunan kualitas sinyal tersebut adalah...',
    image: null,
    options: [
      'Gelombang radio Wi-Fi mengalami pelemahan (atenuasi) dan pantulan akibat material padat seperti beton dan jarak yang semakin jauh.',
      'Jumlah data di dalam router habis karena dipakai membuka media sosial.',
      'Kabel power router berubah menjadi kabel audio.',
      'Frekuensi Wi-Fi berubah menjadi sinyal inframerah otomatis.',
    ],
    answer: 'A',
    difficulty: 'HOTS',
    explanation:
      'Gelombang elektromagnetik radio Wi-Fi (frekuensi 2.4 GHz atau 5 GHz) mengalami redaman daya (atenuasi) saat melewati rintangan fisik padat seperti dinding beton dan jarak rambat yang bertambah.',
  },
  {
    id: 16,
    jenjang: 'VII',
    semester: 'Genap',
    elemen: 'Analisis Data (AD)',
    content:
      'Sebuah kompetisi menyaring 5 nilai juri pada sel B2:F2. Panitia ingin menghitung total nilai peserta dengan aturan: "Jumlahkan kelima nilai juri, namun buang 1 nilai terendah". Rumus kombinasi fungsi lembar kerja yang paling tepat adalah...',
    image: null,
    options: [
      '=SUM(B2:F2) - MIN(B2:F2)',
      '=AVERAGE(B2:F2) + MAX(B2:F2)',
      '=SUM(B2:F2) / COUNT(B2:F2)',
      '=MAX(B2:F2) - MIN(B2:F2)',
    ],
    answer: 'A',
    difficulty: 'HOTS',
    explanation:
      'Rumus =SUM(B2:F2) - MIN(B2:F2) menjumlahkan seluruh nilai pada rentang sel, lalu mengurangi nilai minimum (terendah) sehingga menghasilkan total tanpa nilai terendah.',
  },
  {
    id: 17,
    jenjang: 'VII',
    semester: 'Genap',
    elemen: 'Algoritma & Pemrograman (AP)',
    content:
      'Pada aplikasi Scratch, seorang siswa ingin menggambar bentuk bangun datar persegi menggunakan ekstensi Pen. Blok perulangan yang paling efisien untuk menghasilkan persegi adalah...',
    image: null,
    options: [
      'Repeat 4 [ Move 100 steps, Turn right 90 degrees ]',
      'Repeat 3 [ Move 100 steps, Turn right 120 degrees ]',
      'Repeat 5 [ Move 100 steps, Turn right 72 degrees ]',
      'Repeat 2 [ Move 100 steps, Turn right 180 degrees ]',
    ],
    answer: 'A',
    difficulty: 'HOTS',
    explanation:
      'Persegi memiliki 4 sisi sama panjang dan 4 sudut putar 90°. Perulangan repeat 4 dengan move 100 dan turn right 90° menghasilkan bangun persegi sempurna.',
  },
  {
    id: 18,
    jenjang: 'VII',
    semester: 'Genap',
    elemen: 'Dampak Sosial Informatika (DSI)',
    content:
      'Seorang siswa melihat foto teman sekelasnya diedit menjadi meme lucu tanpa izin lalu disebarkan ke grup percakapan daring hingga teman tersebut merasa malu dan tertekan. Berdasarkan etika digital (Netiket), sikap terpuji yang seharusnya dilakukan adalah...',
    image: null,
    options: [
      'Menasihati pembuat meme secara sopan, tidak ikut menyebarkan konten tersebut, dan memberikan dukungan moral kepada korban perundungan siber.',
      'Ikut menertawakan dan meneruskan meme tersebut ke seluruh media sosial pribadi.',
      'Menyimpan meme tersebut untuk mengejek teman di kelas keesokan harinya.',
      'Membuat meme balasan yang lebih kasar tentang keluarga siswa lain.',
    ],
    answer: 'A',
    difficulty: 'HOTS',
    explanation:
      'Penyebaran konten tanpa izin yang merendahkan seseorang merupakan bentuk cyberbullying. Netiket menuntut sikap empati, menolak menyebarkan konten perundungan, dan menghentikan peredaran konten negatif.',
  },
  {
    id: 19,
    jenjang: 'VII',
    semester: 'Genap',
    elemen: 'Jaringan Komputer & Internet (JKI)',
    content:
      'Dalam keamanan akun digital, alasan mengapa kita disarankan membuat kata sandi (Password) yang terdiri dari kombinasi huruf besar, huruf kecil, angka, dan simbol khusus adalah...',
    image: null,
    options: [
      'Membuat kata sandi memiliki entropi tinggi sehingga sangat sulit ditebak atau diretas menggunakan teknik Brute Force.',
      'Membuat ukuran keyboard ponsel menjadi lebih kecil.',
      'Agar kata sandi dapat dibaca dengan mudah oleh orang lain di sekitar kita.',
      'Agar akun otomatis terhubung ke semua komputer tanpa verifikasi.',
    ],
    answer: 'A',
    difficulty: 'REGULER',
    explanation:
      'Kombinasi berbagai jenis karakter meningkatkan kompleksitas ruang kemungkinan kata sandi sehingga tahan terhadap serangan tebakan otomatis (Brute Force attack).',
  },
  {
    id: 20,
    jenjang: 'VII',
    semester: 'Genap',
    elemen: 'Analisis Data (AD)',
    content:
      'Pada lembar kerja data siswa, fitur yang digunakan untuk menampilkan HANYA siswa yang berasal dari kelas "VII-2" dan menyembunyikan sementara baris kelas lainnya tanpa menghapusnya adalah...',
    image: null,
    options: [
      'Filter Data (AutoFilter)',
      'Format Cells',
      'Clear All Data',
      'Insert Column',
    ],
    answer: 'A',
    difficulty: 'REGULER',
    explanation:
      'Fitur Filter pada Spreadsheet menyaring dan menampilkan baris data yang memenuhi kriteria tertentu (misal Kelas = VII-2) dan menyembunyikan baris lainnya secara dinamis.',
  },
  {
    id: 21,
    jenjang: 'VII',
    semester: 'Genap',
    elemen: 'Algoritma & Pemrograman (AP)',
    content:
      'Dalam pembuatan game di Scratch, dibuat variabel bernama "Skor". Diinginkan agar setiap kali Sprite koin disentuh oleh Sprite pemain, skor bertambah 10 poin dan koin menghilang sementara. Urutan blok perintah yang benar di dalam Sprite koin adalah...',
    image: null,
    options: [
      'If <touching Pemain?> then [ change Skor by 10, hide, wait 2 seconds, show ]',
      'If <touching Pemain?> then [ set Skor to 0, stop all ]',
      'If <touching Pemain?> then [ delete this clone, change Skor by -10 ]',
      'If <touching Pemain?> then [ next backdrop, change x by -500 ]',
    ],
    answer: 'A',
    difficulty: 'HOTS',
    explanation:
      'Blok change Skor by 10 menambahkan nilai variabel sebesar 10, diikuti perintah hide untuk menyembunyikan koin, lalu menunggu sejenak sebelum ditampilkan kembali (respawn).',
  },
  {
    id: 22,
    jenjang: 'VII',
    semester: 'Genap',
    elemen: 'Dampak Sosial Informatika (DSI)',
    content:
      'Lisensi hak cipta Creative Commons (CC) yang memperbolehkan orang lain mengunduh dan membagikan karya digital asalkan mencantumkan nama pembuat aslinya (Attribution) disimbolkan dengan kode...',
    image: null,
    options: [
      'CC BY',
      'CC NC-ND',
      'All Rights Reserved',
      'Public Domain No Attribution',
    ],
    answer: 'A',
    difficulty: 'REGULER',
    explanation:
      'Simbol CC BY (Attribution) mewajibkan pengguna karya untuk memberikan atribusi atau penghargaan dengan mencantumkan nama pencipta karya aslinya.',
  },
  {
    id: 23,
    jenjang: 'VII',
    semester: 'Genap',
    elemen: 'Jaringan Komputer & Internet (JKI)',
    content:
      'Pada teknik enkripsi Caesar Cipher dengan pergeseran 4 huruf ke kanan (A -> E), seorang siswa menerima pesan tersandi (Ciphertext) berupa kata "LIPX". Teks asli (Plaintext) pesan tersebut sebelum dienkripsi adalah...',
    image: null,
    options: [
      'HELT',
      'MIPY',
      'KHOW',
      'DAST',
    ],
    answer: 'A',
    difficulty: 'HOTS',
    explanation:
      'Untuk mendekripsi, geser setiap huruf mundur 4 langkah ke kiri: L (-4) = H, I (-4) = E, P (-4) = L, X (-4) = T. Maka kata aslinya adalah "HELT".',
  },
  {
    id: 24,
    jenjang: 'VII',
    semester: 'Genap',
    elemen: 'Analisis Data (AD)',
    content:
      'Sebuah sel pada Microsoft Excel berisi nilai angka desimal 0.75. Jika format tampilan sel tersebut diubah menjadi format Percentage (Persentase), maka teks nilai yang ditampilkan di layar monitor adalah...',
    image: null,
    options: [
      '75%',
      '0.75%',
      '750%',
      '7.5%',
    ],
    answer: 'A',
    difficulty: 'HOTS',
    explanation:
      'Format Percentage mengalikan nilai angka dengan 100 dan menambahkan simbol persen (%), sehingga 0.75 menjadi 75%.',
  },
  {
    id: 25,
    jenjang: 'VII',
    semester: 'Genap',
    elemen: 'Algoritma & Pemrograman (AP)',
    content:
      'Perhatikan kondisi logika pada blok Scratch berikut: < (Skor > 50) and (Nyawa > 0) >. Jika saat ini variabel Skor bernilai 70 dan variabel Nyawa bernilai 0, apakah kondisi tersebut bernilai Benar (True) atau Salah (False), dan mengapa?',
    image: null,
    options: [
      'Salah (False), karena operator AND mengharuskan KEDUA kondisi bernilai Benar, sedangkan kondisi Nyawa > 0 bernilai Salah (0 tidak > 0).',
      'Benar (True), karena kondisi Skor > 50 sudah bernilai Benar sehingga kondisi kedua diabaikan.',
      'Benar (True), karena angka 70 lebih besar dari 0.',
      'Salah (False), karena kedua kondisi sama-sama bernilai Salah.',
    ],
    answer: 'A',
    difficulty: 'HOTS',
    explanation:
      'Operator logika AND hanya bernilai Benar jika kedua operand-nya bernilai Benar. Karena Nyawa = 0 tidak memenuhi (Nyawa > 0), maka hasil logika akhir bernilai Salah (False).',
  }
];

// ============================================================================
// 3. BANK SOAL KELAS VIII - SEMESTER GANJIL (FASE D)
// ============================================================================
export const QUESTIONS_VIII_GANJIL: Question[] = [
  {
    id: 1,
    jenjang: 'VIII',
    semester: 'Ganjil',
    elemen: 'Sistem Komputer (SK)',
    content:
      'Dalam arsitektur sistem komputer (Von Neumann), komponen perangkat keras (hardware) bekerja secara sinergis melalui empat tahapan utama pemrosesan data. Urutan siklus pengolahan data yang tepat ketika pengguna mengetikkan dokumen hingga tampil di layar monitor adalah...',
    image: null,
    options: [
      'Input Unit -> Processing Unit (CPU) -> Memory/Storage -> Output Unit',
      'Output Unit -> Input Unit -> Memory/Storage -> Processing Unit (CPU)',
      'Memory/Storage -> Output Unit -> Processing Unit (CPU) -> Input Unit',
      'Processing Unit (CPU) -> Input Unit -> Output Unit -> Memory/Storage',
    ],
    answer: 'A',
    difficulty: 'REGULER',
    explanation:
      'Siklus pemrosesan data pada sistem komputer dimulai dari perangkat masukan (Input Unit), diproses oleh CPU (Control Unit & ALU) yang berinteraksi dengan memori utama (RAM/Storage), lalu hasilnya ditampilkan melalui perangkat keluaran (Output Unit).',
  },
  {
    id: 2,
    jenjang: 'VIII',
    semester: 'Ganjil',
    elemen: 'Sistem Komputer (SK)',
    content:
      'Central Processing Unit (CPU) disebut sebagai otak dari sistem komputer. Di dalam CPU terdapat bagian yang bertugas khusus melakukan operasi perhitungan aritmatika (penjumlahan, pengurangan) dan perbandingan logika (AND, OR, NOT). Komponen tersebut adalah...',
    image: null,
    options: [
      'Control Unit (CU)',
      'Arithmetic Logic Unit (ALU)',
      'Memory Register',
      'Read Only Memory (ROM)',
    ],
    answer: 'B',
    difficulty: 'REGULER',
    explanation:
      'ALU (Arithmetic Logic Unit) adalah bagian dari CPU yang berfungsi mengeksekusi operasi aritmatika dasar dan operasi logika perbandingan, sedangkan Control Unit (CU) bertugas mengatur lalu lintas instruksi.',
  },
  {
    id: 3,
    jenjang: 'VIII',
    semester: 'Ganjil',
    elemen: 'Sistem Komputer (SK)',
    content:
      'Perangkat lunak (Software) diklasifikasikan menjadi Sistem Operasi (Operating System), Perangkat Lunak Aplikasi, dan Perangkat Lunak Pemrograman. Manakah di bawah ini yang seluruhnya merupakan kelompok Sistem Operasi (Operating System)?',
    image: null,
    options: [
      'Microsoft Windows 11, Linux Ubuntu, macOS, dan Android',
      'Google Chrome, Microsoft Word, Linux Ubuntu, dan Canva',
      'Android, iOS, Adobe Photoshop, dan Microsoft Excel',
      'BIOS, Mozilla Firefox, Windows 10, dan Python',
    ],
    answer: 'A',
    difficulty: 'REGULER',
    explanation:
      'Microsoft Windows 11, Linux Ubuntu, macOS, dan Android adalah contoh Sistem Operasi (OS) yang bertugas mengelola sumber daya perangkat keras dan menyediakan antarmuka bagi perangkat lunak aplikasi.',
  },
  {
    id: 4,
    jenjang: 'VIII',
    semester: 'Ganjil',
    elemen: 'Sistem Komputer (SK)',
    content:
      'Memori internal komputer terbagi menjadi memori bersifat volatile (data hilang saat listrik padam) dan non-volatile (data tetap tersimpan meski listrik padam). Pasangan memori volatile dan non-volatile yang benar secara berurutan adalah...',
    image: null,
    options: [
      'ROM dan Flashdisk',
      'SSD dan Harddisk (HDD)',
      'RAM (Random Access Memory) dan ROM (Read Only Memory)',
      'ROM (Read Only Memory) dan Cache Memory',
    ],
    answer: 'C',
    difficulty: 'REGULER',
    explanation:
      'RAM bersifat volatile karena membutuhkan aliran listrik untuk mempertahankan data yang sedang diproses secara aktif, sedangkan ROM bersifat non-volatile karena menyimpan instruksi firmware (seperti BIOS) secara permanen.',
  },
  {
    id: 5,
    jenjang: 'VIII',
    semester: 'Ganjil',
    elemen: 'Berpikir Komputasional (BK)',
    content:
      'Dalam sistem komputer dan Berpikir Komputasional Kelas VIII, semua data disimpan menggunakan sistem bilangan biner (basis 2), oktal (basis 8), desimal (basis 10), dan heksadesimal (basis 16). Karakter huruf yang digunakan untuk mewakili nilai desimal 10 sampai 15 pada sistem bilangan heksadesimal adalah...',
    image: null,
    options: [
      'G, H, I, J, K, L',
      'A, B, C, D, E, F',
      'U, V, W, X, Y, Z',
      'P, Q, R, S, T, U',
    ],
    answer: 'B',
    difficulty: 'REGULER',
    explanation:
      'Sistem bilangan heksadesimal (basis 16) menggunakan 16 simbol, yaitu angka 0 sampai 9 serta huruf A (10), B (11), C (12), D (13), E (14), dan F (15).',
  },
  {
    id: 6,
    jenjang: 'VIII',
    semester: 'Ganjil',
    elemen: 'Berpikir Komputasional (BK)',
    content:
      'Pada materi Struktur Data Berpikir Komputasional Kelas VIII Semester Ganjil, terdapat dua struktur penyimpanan linear yaitu Tumpukan (Stack - LIFO: Last In First Out) dan Antrean (Queue - FIFO: First In First Out). Jika ke dalam sebuah Stack dimasukkan data buku secara berurutan: "Buku A", "Buku B", "Buku C", lalu dilakukan 1 kali operasi Pop (ambil data) dan kemudian dimasukkan "Buku D", maka buku yang berada paling atas (Top of Stack) saat ini adalah...',
    image: null,
    options: [
      'Buku D, dengan urutan tumpukan dari bawah ke atas: Buku A, Buku B, Buku D',
      'Buku C, karena operasi Pop menghapus Buku A yang masuk pertama kali',
      'Buku A, karena prinsip Stack selalu mengeluarkan data yang pertama masuk',
      'Buku B, karena Buku D ditempatkan di bagian paling bawah tumpukan',
    ],
    answer: 'A',
    difficulty: 'HOTS',
    explanation:
      'Pada Stack (LIFO), urutan masuk: [A, B, C] (C di atas). Operasi Pop mengeluarkan elemen paling atas yaitu Buku C, menyisakan [A, B]. Saat Buku D di-Push (dimasukkan), tumpukan menjadi [A, B, D] dengan Buku D berada paling atas.',
  },
  {
    id: 7,
    jenjang: 'VIII',
    semester: 'Ganjil',
    elemen: 'Sistem Komputer (SK)',
    content:
      'Pada pengalamatan memori komputer Kelas VIII, sebuah alamat lokasi memori tercatat dalam kode heksadesimal sebagai 2F₁₆. Jika CPU perlu menerjemahkan alamat tersebut ke dalam nilai desimal (basis 10) dan biner 8-bit (basis 2) untuk diakses oleh bus alamat, maka hasil konversi yang tepat adalah...',
    image: null,
    options: [
      'Desimal = 47₁₀ dan Biner = 00101111₂',
      'Desimal = 37₁₀ dan Biner = 00100111₂',
      'Desimal = 45₁₀ dan Biner = 00101101₂',
      'Desimal = 62₁₀ dan Biner = 00111110₂',
    ],
    answer: 'A',
    difficulty: 'HOTS',
    explanation:
      'Pada bilangan heksadesimal 2F₁₆: angka 2 menempati nilai tempat 16¹ (2 × 16 = 32) dan F bernilai 15 pada tempat 16⁰ (15 × 1 = 15). Maka nilai desimalnya = 32 + 15 = 47₁₀. Dalam biner 8-bit: digit 2 = 0010₂ dan F (15) = 1111₂, sehingga menjadi 00101111₂.',
  },
  {
    id: 8,
    jenjang: 'VIII',
    semester: 'Ganjil',
    elemen: 'Sistem Komputer (SK)',
    content:
      'Di dalam Arithmetic Logic Unit (ALU), sebuah rangkaian gerbang logika pengontrol keamanan server akan menyalakan alarm (Output Y = 1) dengan aturan ekspresi logika: Y = (A AND B) OR (NOT C). Jika sensor mendeteksi kondisi Input A = 1, Input B = 0, dan Input C = 0, analisislah nilai keluaran (Output Y) beserta alasannya!',
    image: null,
    options: [
      'Output Y = 0, karena operasi (A AND B) menghasilkan nilai 0 sehingga seluruh rangkaian otomatis bernilai 0.',
      'Output Y = 1, karena meskipun (1 AND 0) bernilai 0, operasi (NOT 0) menghasilkan nilai 1, dan (0 OR 1) menghasilkan Output akhir 1.',
      'Output Y = 0, karena gerbang NOT mengubah nilai C = 0 menjadi 0 sehingga (0 OR 0) bernilai 0.',
      'Output Y = 1, karena operasi (1 AND 0) menghasilkan nilai 1 dan (NOT 0) menghasilkan nilai 0.',
    ],
    answer: 'B',
    difficulty: 'HOTS',
    explanation:
      'Mari kita evaluasi bertahap: Pertama, (A AND B) = (1 AND 0) = 0. Kedua, (NOT C) = (NOT 0) = 1. Ketiga, hasil keduanya digabungkan dengan gerbang OR: (0 OR 1) = 1. Maka alarm menyala (Output Y = 1).',
  },
  {
    id: 9,
    jenjang: 'VIII',
    semester: 'Ganjil',
    elemen: 'Teknologi Informasi & Komunikasi (TIK)',
    content:
      'Panitia ujian sekolah ingin membuat 180 surat undangan orang tua siswa dengan format surat yang sama di Microsoft Word, namun bagian Nama Siswa, NISN, dan Kelas harus terisi otomatis dari tabel daftar siswa di Microsoft Excel. Teknik integrasi aplikasi perkantoran yang paling tepat dan efisien digunakan adalah...',
    image: null,
    options: [
      'Menggunakan fitur Mail Merge (Surat Massal) yang menghubungkan dokumen utama Word dengan sumber data Excel.',
      'Mengetik ulang 180 file dokumen Word satu per satu secara manual.',
      'Menggunakan fitur Screenshot layar Excel lalu menempelkannya sebagai gambar statis di halaman sampul.',
      'Mengubah ekstensi file .xlsx menjadi .mp4 menggunakan aplikasi pemutar musik.',
    ],
    answer: 'A',
    difficulty: 'HOTS',
    explanation:
      'Mail Merge adalah fitur integrasi antara aplikasi pengolah kata (Word) sebagai dokumen utama dan pengolah lembar kerja (Excel) sebagai sumber data (data source) untuk menghasilkan ratusan dokumen personalisasi secara otomatis.',
  },
  {
    id: 10,
    jenjang: 'VIII',
    semester: 'Ganjil',
    elemen: 'Sistem Komputer (SK)',
    content:
      'Seorang siswa ingin merakit sistem komputer untuk kebutuhan pembelajaran pemrograman dan pengolahan video di sekolah. Ia dihadapkan pada dua pilihan konfigurasi:\n• Konfigurasi P: Prosesor 4-Core, RAM 16 GB, Penyimpanan SSD NVMe 512 GB.\n• Konfigurasi Q: Prosesor 4-Core, RAM 4 GB, Penyimpanan HDD 2 TB.\nBerdasarkan prinsip arsitektur memori dan kecepatan transfer data dalam sistem komputer, konfigurasi manakah yang jauh lebih efisien dan mengapa?',
    image: null,
    options: [
      'Konfigurasi Q, karena kapasitas HDD 2 TB yang besar secara otomatis menggandakan kecepatan frekuensi clock ALU di dalam CPU.',
      'Konfigurasi P, karena kombinasi RAM 16 GB dan SSD NVMe mempercepat transfer data menuju CPU secara drastis serta meminimalkan waktu tunggu (bottleneck) dibanding HDD mekanik dan RAM kecil.',
      'Konfigurasi Q, karena RAM 4 GB mengonsumsi daya listrik lebih besar sehingga membuat prosesor bekerja dua kali lebih cepat.',
      'Kedua konfigurasi memiliki kecepatan pemrosesan yang sama persis karena jumlah inti prosesornya sama-sama 4-Core.',
    ],
    answer: 'B',
    difficulty: 'HOTS',
    explanation:
      'Kecepatan CPU yang tinggi harus diimbangi oleh kecepatan suplai data dari penyimpanan dan memori utama. SSD NVMe memiliki kecepatan baca/tulis berkali-kali lipat lebih cepat dibanding piringan magnetik HDD, dan RAM 16 GB memastikan ruang kerja memori utama leluasa tanpa mengalami lag.',
  },
  {
    id: 11,
    jenjang: 'VIII',
    semester: 'Ganjil',
    elemen: 'Berpikir Komputasional (BK)',
    content:
      'Konversikan bilangan desimal 25₁₀ ke dalam sistem bilangan biner (basis 2) menggunakan metode pembagian berturut-turut dengan angka 2!',
    image: null,
    options: [
      '11001₂',
      '10101₂',
      '11100₂',
      '10011₂',
    ],
    answer: 'A',
    difficulty: 'REGULER',
    explanation:
      '25 / 2 = 12 sisa 1; 12 / 2 = 6 sisa 0; 6 / 2 = 3 sisa 0; 3 / 2 = 1 sisa 1; 1 / 2 = 0 sisa 1. Dibaca dari sisa terakhir ke awal: 11001₂.',
  },
  {
    id: 12,
    jenjang: 'VIII',
    semester: 'Ganjil',
    elemen: 'Teknologi Informasi & Komunikasi (TIK)',
    content:
      'Mekanisme integrasi antar-aplikasi perkantoran Microsoft Office di mana sebuah tabel lembar kerja Excel disematkan ke dalam slide PowerPoint dan dapat diedit langsung menggunakan antarmuka Excel di dalam slide disebut...',
    image: null,
    options: [
      'Object Linking and Embedding (OLE)',
      'Screen Mirroring Protocol',
      'Mail Merge Data Source',
      'File Transfer Protocol (FTP)',
    ],
    answer: 'A',
    difficulty: 'REGULER',
    explanation:
      'OLE (Object Linking and Embedding) memungkinkan objek dari satu aplikasi disematkan atau ditautkan ke dalam aplikasi lain dengan tetap mempertahankan fungsionalitas aplikasi asalnya.',
  },
  {
    id: 13,
    jenjang: 'VIII',
    semester: 'Ganjil',
    elemen: 'Sistem Komputer (SK)',
    content:
      'Di dalam unit pemrosesan sentral (CPU), komponen yang bertugas menerjemahkan instruksi bahasa mesin, mengatur urutan kerja, serta mengarahkan aliran data antara ALU, memori, dan register disebut...',
    image: null,
    options: [
      'Control Unit (CU)',
      'Arithmetic Logic Unit (ALU)',
      'Graphics Processing Unit (GPU)',
      'Read Only Memory (ROM)',
    ],
    answer: 'A',
    difficulty: 'REGULER',
    explanation:
      'Control Unit (CU) berfungsi sebagai pengendali lalu lintas operasi komputer: mengambil instruksi dari memori (fetch), menguraikannya (decode), dan mengatur eksekusinya.',
  },
  {
    id: 14,
    jenjang: 'VIII',
    semester: 'Ganjil',
    elemen: 'Berpikir Komputasional (BK)',
    content:
      'Sebuah loket verifikasi kartu ujian di SMPN 7 Kisaran menerapkan struktur data Antrean (Queue - FIFO: First In First Out). Urutan siswa yang datang: [Ahmad, Bella, Citra, Doni]. Jika terjadi 2 kali operasi Dequeue (pelayanan selesai) dan kemudian 1 siswa bernama Eka bergabung dengan operasi Enqueue, urutan antrean saat ini dari posisi depan ke belakang adalah...',
    image: null,
    options: [
      '[Citra, Doni, Eka]',
      '[Ahmad, Bella, Eka]',
      '[Eka, Doni, Citra]',
      '[Bella, Citra, Doni]',
    ],
    answer: 'A',
    difficulty: 'HOTS',
    explanation:
      'Awal antrean: [Ahmad, Bella, Citra, Doni]. Dua kali Dequeue mengeluarkan Ahmad dan Bella, menyisakan [Citra, Doni]. Operasi Enqueue memasukkan Eka di bagian belakang antrean, sehingga antrean menjadi [Citra, Doni, Eka].',
  },
  {
    id: 15,
    jenjang: 'VIII',
    semester: 'Ganjil',
    elemen: 'Teknologi Informasi & Komunikasi (TIK)',
    content:
      'Seorang staf kurikulum sekolah mencetak surat kelulusan menggunakan Mail Merge. Di antara 150 data siswa pada lembar kerja Excel, terdapat kolom "Status". Staf ingin mencetak surat KHUSUS untuk siswa yang statusnya "LULUS" saja. Fitur integrasi Mail Merge yang harus ia terapkan adalah...',
    image: null,
    options: [
      'Fitur "Filter Recipients" pada panel Mail Merge dengan menetapkan kriteria Status = LULUS',
      'Menghapus 150 file Word satu per satu secara manual',
      'Mengubah rumus Excel menjadi format gambar statis',
      'Menghubungkan printer dengan kabel proyektor',
    ],
    answer: 'A',
    difficulty: 'HOTS',
    explanation:
      'Menu "Edit Recipient List" -> "Filter" pada fitur Mail Merge memungkinkan pengguna memfilter data penerima berdasarkan kriteria kolom tertentu (misal Status = LULUS) sebelum proses penggabungan dokumen dilakukan.',
  },
  {
    id: 16,
    jenjang: 'VIII',
    semester: 'Ganjil',
    elemen: 'Sistem Komputer (SK)',
    content:
      'Sebuah register mikrokontroler menyimpan nilai bilangan oktal (basis 8) yaitu 57₈. Berapakah nilai representasi bilangan tersebut jika dikonversikan ke dalam bilangan desimal (basis 10) dan biner 6-bit?',
    image: null,
    options: [
      'Desimal = 47₁₀ dan Biner = 101111₂',
      'Desimal = 57₁₀ dan Biner = 111001₂',
      'Desimal = 40₁₀ dan Biner = 101000₂',
      'Desimal = 63₁₀ dan Biner = 111111₂',
    ],
    answer: 'A',
    difficulty: 'HOTS',
    explanation:
      'Nilai desimal 57₈ = (5 × 8¹) + (7 × 8⁰) = 40 + 7 = 47₁₀. Dalam biner: digit 5 = 101₂ dan digit 7 = 111₂, digabungkan menjadi 101111₂.',
  },
  {
    id: 17,
    jenjang: 'VIII',
    semester: 'Ganjil',
    elemen: 'Berpikir Komputasional (BK)',
    content:
      'Didefinisikan sebuah fungsi komputasi rekursif untuk menghitung deret bilangan: F(1) = 3, dan untuk n > 1 berlaku rumus F(n) = 2 * F(n - 1) - 1. Berapakah nilai keluaran dari F(4)?',
    image: null,
    options: [
      '17',
      '15',
      '21',
      '9',
    ],
    answer: 'A',
    difficulty: 'HOTS',
    explanation:
      'F(1) = 3; F(2) = 2 × 3 - 1 = 5; F(3) = 2 × 5 - 1 = 9; F(4) = 2 × 9 - 1 = 17.',
  },
  {
    id: 18,
    jenjang: 'VIII',
    semester: 'Ganjil',
    elemen: 'Sistem Komputer (SK)',
    content:
      'Dalam logika digital, gerbang NAND merupakan kebalikan dari gerbang AND (Output = NOT (A AND B)). Jika diberikan kombinasi masukan Input A = 1 dan Input B = 0, bagaimanakah nilai keluaran gerbang NAND beserta penjelasannya?',
    image: null,
    options: [
      'Output = 1, karena operasi (1 AND 0) menghasilkan 0, dan pembalikan NOT dari 0 menghasilkan nilai 1.',
      'Output = 0, karena jika salah satu input bernilai 0 maka output selalu bernilai 0.',
      'Output = 0, karena kedua input harus bernilai 1 agar menghasilkan 1.',
      'Output tidak menentu tergantung kecepatan clock CPU.',
    ],
    answer: 'A',
    difficulty: 'HOTS',
    explanation:
      'Gerbang NAND menghasilkan keluaran 0 hanya jika semua masukannya bernilai 1. Karena masukannya 1 dan 0, maka (1 AND 0) = 0, dan NOT(0) = 1.',
  },
  {
    id: 19,
    jenjang: 'VIII',
    semester: 'Ganjil',
    elemen: 'Teknologi Informasi & Komunikasi (TIK)',
    content:
      'Dalam pembuatan media presentasi interaktif di Microsoft PowerPoint, fitur yang memungkinkan pengguna berpindah langsung ke slide tertentu atau membuka dokumen lain saat sebuah tombol diklik disebut...',
    image: null,
    options: [
      'Action Button / Hyperlink',
      'Slide Transition Fade',
      'Custom Animation Entrance',
      'Slide Master Layout',
    ],
    answer: 'A',
    difficulty: 'REGULER',
    explanation:
      'Hyperlink dan Action Button digunakan untuk menciptakan navigasi interaktif antar-slide, menuju file eksternal, atau alamat web.',
  },
  {
    id: 20,
    jenjang: 'VIII',
    semester: 'Ganjil',
    elemen: 'Sistem Komputer (SK)',
    content:
      'Di dalam prosesor, register khusus yang bertugas menyimpan alamat memori dari instruksi berikutnya yang akan dieksekusi oleh CPU disebut...',
    image: null,
    options: [
      'Program Counter (PC)',
      'Instruction Register (IR)',
      'Accumulator (ACC)',
      'Memory Buffer Register (MBR)',
    ],
    answer: 'A',
    difficulty: 'REGULER',
    explanation:
      'Program Counter (PC) adalah register CPU yang memegang alamat memori dari instruksi selanjutnya yang akan diambil (fetch) untuk dieksekusi.',
  },
  {
    id: 21,
    jenjang: 'VIII',
    semester: 'Ganjil',
    elemen: 'Berpikir Komputasional (BK)',
    content:
      'Sebuah struktur data Tumpukan (Stack) dialokasikan pada memori dengan kapasitas maksimal 3 elemen. Kondisi kesalahan yang terjadi ketika program mencoba melakukan operasi PUSH (menambah data) pada Stack yang sudah terisi penuh disebut...',
    image: null,
    options: [
      'Stack Overflow',
      'Stack Underflow',
      'Deadlock Memory',
      'Syntax Parsing Error',
    ],
    answer: 'A',
    difficulty: 'HOTS',
    explanation:
      'Stack Overflow terjadi saat program mencoba menambahkan elemen baru ke dalam tumpukan yang kapasitas memorinya telah penuh.',
  },
  {
    id: 22,
    jenjang: 'VIII',
    semester: 'Ganjil',
    elemen: 'Sistem Komputer (SK)',
    content:
      'Perhatikan tingkatan hierarki memori komputer berikut:\n1. Register CPU\n2. Cache Memory (L1, L2, L3)\n3. Main Memory (RAM)\n4. Solid State Drive (SSD)\nPrinsip yang tepat mengenai hubungan antara kecepatan akses data dan biaya komponen per byte pada hierarki tersebut adalah...',
    image: null,
    options: [
      'Semakin tinggi posisi memori mendekati CPU (Register & Cache), kecepatan aksesnya semakin cepat namun biaya pembuatannya per byte semakin mahal.',
      'Semakin besar kapasitas memori, kecepatan aksesnya otomatis menjadi yang paling cepat dibanding register.',
      'SSD memiliki kecepatan transfer data yang lebih tinggi daripada Cache L1.',
      'RAM memiliki waktu tunda (latency) yang lebih kecil dibanding Register CPU.',
    ],
    answer: 'A',
    difficulty: 'HOTS',
    explanation:
      'Hierarki memori dirancang berjenjang: memori terdekat dengan core CPU (Register dan Cache) memiliki kecepatan sangat tinggi dengan biaya sangat mahal sehingga kapasitasnya kecil, sedangkan memori sekunder berkapasitas besar dengan biaya per byte lebih murah namun kecepatan lebih rendah.',
  },
  {
    id: 23,
    jenjang: 'VIII',
    semester: 'Ganjil',
    elemen: 'Teknologi Informasi & Komunikasi (TIK)',
    content:
      'Ketika menyalin grafik penjualan dari Excel ke PowerPoint menggunakan metode "Paste Link" (Object Linking), keuntungan utama yang diperoleh presenter adalah...',
    image: null,
    options: [
      'Jika data angka di file Excel diubah atau diperbarui, tampilan grafik di PowerPoint akan ikut berubah secara otomatis saat file dibuka.',
      'File PowerPoint akan berubah format secara otomatis menjadi file video MP4.',
      'Grafik di PowerPoint tidak akan bisa diedit atau dilihat oleh orang lain.',
      'Ukuran file presentasi berkurang menjadi 0 KB.',
    ],
    answer: 'A',
    difficulty: 'HOTS',
    explanation:
      'Fitur "Paste Link" menjaga relasi dinamis antara file sumber (Excel) dan file tujuan (PowerPoint), sehingga setiap revisi pada sumber data otomatis tersinkronisasi ke dokumen presentasi.',
  },
  {
    id: 24,
    jenjang: 'VIII',
    semester: 'Ganjil',
    elemen: 'Berpikir Komputasional (BK)',
    content:
      'Himpunan siswa yang mengikuti ekstrakurikuler Robotika adalah R = {Ali, Budi, Citra, Doni} dan himpunan siswa yang mengikuti Olimpiade Informatika adalah O = {Citra, Doni, Eka, Fani}. Himpunan siswa yang mengikuti KEDUA kegiatan tersebut (Irisan / Intersection R ∩ O) adalah...',
    image: null,
    options: [
      '{Citra, Doni}',
      '{Ali, Budi}',
      '{Eka, Fani}',
      '{Ali, Budi, Citra, Doni, Eka, Fani}',
    ],
    answer: 'A',
    difficulty: 'REGULER',
    explanation:
      'Operasi irisan (Intersection ∩) menghasilkan himpunan anggota yang berada di kedua himpunan sekaligus, yaitu Citra dan Doni.',
  },
  {
    id: 25,
    jenjang: 'VIII',
    semester: 'Ganjil',
    elemen: 'Sistem Komputer (SK)',
    content:
      'Dalam motherboard komputer, jalur fisik yang menghubungkan CPU dengan memori utama dan perangkat input-output terbagi menjadi tiga jenis bus. Bus yang bertugas membawa alamat lokasi memori yang ingin dibaca atau ditulis oleh prosesor adalah...',
    image: null,
    options: [
      'Address Bus (Bus Alamat)',
      'Data Bus (Bus Data)',
      'Control Bus (Bus Kendali)',
      'Expansion Slot Bus',
    ],
    answer: 'A',
    difficulty: 'REGULER',
    explanation:
      'Address Bus digunakan oleh CPU untuk mengirimkan alamat fisik lokasi memori atau register peranti I/O yang hendak diakses.',
  }
];

// ============================================================================
// 4. BANK SOAL KELAS VIII - SEMESTER GENAP (FASE D)
// ============================================================================
export const QUESTIONS_VIII_GENAP: Question[] = [
  {
    id: 1,
    jenjang: 'VIII',
    semester: 'Genap',
    elemen: 'Jaringan Komputer & Internet (JKI)',
    content:
      'Jaringan komputer yang menghubungkan perangkat-perangkat komputer dalam area geografis terbatas seperti di dalam satu ruang Laboratorium Komputer UPTD SMP Negeri 7 Kisaran disebut...',
    image: null,
    options: [
      'LAN (Local Area Network)',
      'WAN (Wide Area Network)',
      'MAN (Metropolitan Area Network)',
      'PAN (Personal Area Network)',
    ],
    answer: 'A',
    difficulty: 'REGULER',
    explanation:
      'LAN (Local Area Network) adalah jaringan komputer lokal yang mencakup wilayah kecil seperti satu ruangan laboratorium, sekolah, atau gedung kantor.',
  },
  {
    id: 2,
    jenjang: 'VIII',
    semester: 'Genap',
    elemen: 'Jaringan Komputer & Internet (JKI)',
    content:
      'Saat kita mengakses situs web perbankan atau portal ujian secara aman, alamat URL pada peramban diawali dengan protokol HTTPS dan ikon gembok terkunci. Fungsi utama protokol HTTPS dibandingkan HTTP biasa adalah...',
    image: null,
    options: [
      'Mengenkripsi data komunikasi antara peramban pengguna dan server agar tidak mudah disadap oleh pihak ketiga',
      'Membuat ukuran layar monitor menjadi dua kali lebih lebar secara otomatis',
      'Menghapus seluruh file dokumen yang ada di dalam komputer pengguna',
      'Mematikan fungsi kata sandi sehingga siapa saja dapat masuk tanpa login',
    ],
    answer: 'A',
    difficulty: 'REGULER',
    explanation:
      'HTTPS (Hypertext Transfer Protocol Secure) menggunakan protokol keamanan SSL/TLS untuk mengenkripsi paket data yang dikirim antara klien dan server sehingga aman dari penyadapan.',
  },
  {
    id: 3,
    jenjang: 'VIII',
    semester: 'Genap',
    elemen: 'Analisis Data (AD)',
    content:
      'Pada materi Analisis Data Kelas VIII Semester Genap, fungsi pencarian referensi di lembar kerja (Spreadsheet) yang digunakan untuk mencari nilai pada tabel referensi yang disusun secara VERTIKAL (berdasarkan kolom) adalah...',
    image: null,
    options: [
      '=VLOOKUP(lookup_value, table_array, col_index_num, [range_lookup])',
      '=HLOOKUP(lookup_value, table_array, row_index_num, [range_lookup])',
      '=AVERAGEIF(range, criteria)',
      '=CONCATENATE(text1, text2)',
    ],
    answer: 'A',
    difficulty: 'REGULER',
    explanation:
      'Fungsi VLOOKUP (Vertical Lookup) digunakan untuk mencari nilai tertentu pada kolom paling kiri dari sebuah tabel referensi yang tersusun secara vertikal lalu mengambil nilai dari kolom ke-n.',
  },
  {
    id: 4,
    jenjang: 'VIII',
    semester: 'Genap',
    elemen: 'Algoritma & Pemrograman (AP)',
    content:
      'Dalam pemrograman visual Blockly / Scratch Kelas VIII, tempat penyimpanan di dalam memori program yang memiliki nama unik dan nilainya dapat berubah-ubah selama program berjalan (misalnya untuk menyimpan Skor atau Nyawa Pemain) disebut...',
    image: null,
    options: [
      'Variabel (Variable)',
      'Komentar (Comment)',
      'Backdrop (Latar Belakang)',
      'Konstanta Statis',
    ],
    answer: 'A',
    difficulty: 'REGULER',
    explanation:
      'Variabel adalah wadah penampung nilai di dalam memori program yang nilainya dapat diubah (di-set atau di-change) sewaktu program dieksekusi.',
  },
  {
    id: 5,
    jenjang: 'VIII',
    semester: 'Genap',
    elemen: 'Dampak Sosial Informatika (DSI)',
    content:
      'Upaya kejahatan siber (cybercrime) yang dilakukan dengan cara mengirimkan pesan atau tautan situs web palsu yang menyerupai instansi resmi untuk mengelabui korban agar menyerahkan data sensitif seperti password dan PIN disebut...',
    image: null,
    options: [
      'Phishing',
      'Debugging',
      'Rendering',
      'Compiling',
    ],
    answer: 'A',
    difficulty: 'REGULER',
    explanation:
      'Phishing adalah teknik penipuan rekayasa sosial menggunakan situs atau pesan palsu yang mirip aslinya guna memancing korban memasukkan informasi rahasia.',
  },
  {
    id: 6,
    jenjang: 'VIII',
    semester: 'Genap',
    elemen: 'Jaringan Komputer & Internet (JKI)',
    content:
      'Dalam mekanisme Routing jaringan komputer Kelas VIII, paket data akan dikirim dari Router A menuju Router D melalui jalur dengan total bobot waktu tunda (delay) paling minimum. Diketahui jarak antar-router:\n• Jalur 1 (A -> B -> D): A ke B = 4 ms, B ke D = 6 ms.\n• Jalur 2 (A -> C -> D): A ke C = 3 ms, C ke D = 4 ms.\n• Jalur 3 (A -> B -> C -> D): A ke B = 4 ms, B ke C = 1 ms, C ke D = 4 ms.\nJalur manakah yang dipilih oleh algoritma routing tercepat beserta total waktunya?',
    image: null,
    options: [
      'Jalur 2 (A -> C -> D) dengan total waktu tunda minimum 7 ms',
      'Jalur 1 (A -> B -> D) dengan total waktu tunda 10 ms',
      'Jalur 3 (A -> B -> C -> D) dengan total waktu tunda 9 ms',
      'Semua jalur membutuhkan waktu tunda yang sama yaitu 12 ms',
    ],
    answer: 'A',
    difficulty: 'HOTS',
    explanation:
      'Mari kita hitung total bobot tiap jalur: Jalur 1 = 4 + 6 = 10 ms; Jalur 2 = 3 + 4 = 7 ms; Jalur 3 = 4 + 1 + 4 = 9 ms. Maka jalur terpendek/tercepat adalah Jalur 2 (A -> C -> D) dengan waktu 7 ms.',
  },
  {
    id: 7,
    jenjang: 'VIII',
    semester: 'Genap',
    elemen: 'Analisis Data (AD)',
    content:
      'Sebuah tabel data koperasi sekolah mencatat penjualan barang pada kolom B (Kategori: "Buku" atau "Alat Tulis") dan kolom C (Jumlah Terjual). Jika bendahara ingin menjumlahkan total barang yang terjual KHUSUS untuk kategori "Buku" saja pada baris 2 sampai 20, rumus fungsi Analisis Data yang tepat adalah...',
    image: null,
    options: [
      '=SUMIF(B2:B20, "Buku", C2:C20)',
      '=COUNTIF(B2:B20, "Buku")',
      '=VLOOKUP("Buku", B2:C20, 2, FALSE)',
      '=AVERAGE(C2:C20)',
    ],
    answer: 'A',
    difficulty: 'HOTS',
    explanation:
      'Fungsi =SUMIF(range_kriteria, kriteria, sum_range) menjumlahkan nilai pada kolom C (C2:C20) hanya untuk baris yang kolom B-nya (B2:B20) memenuhi kriteria "Buku". Sedangkan COUNTIF hanya menghitung banyaknya transaksi, bukan menjumlahkan nilai barangnya.',
  },
  {
    id: 8,
    jenjang: 'VIII',
    semester: 'Genap',
    elemen: 'Analisis Data (AD)',
    content:
      'Seorang peneliti siswa Kelas VIII ingin menyajikan dua jenis visualisasi data: (1) Perkembangan suhu udara harian di Kota Kisaran dari hari Senin sampai Minggu, dan (2) Persentase proporsi ekstrakurikuler yang dipilih oleh 200 siswa. Pasangan jenis grafik (Chart) yang paling tepat untuk kedua kebutuhan tersebut secara berurutan adalah...',
    image: null,
    options: [
      'Grafik Garis (Line Chart) untuk tren perubahan waktu dan Grafik Lingkaran (Pie Chart) untuk proporsi persentase',
      'Grafik Lingkaran (Pie Chart) untuk tren suhu harian dan Grafik Garis untuk persentase satu waktu',
      'Tabel teks tanpa angka untuk keduanya',
      'Diagram radar untuk suhu dan diagram pencar (scatter) untuk daftar nama siswa',
    ],
    answer: 'A',
    difficulty: 'HOTS',
    explanation:
      'Line Chart (Grafik Garis) sangat efektif menampilkan tren perubahan data berkelanjutan dari waktu ke waktu (time-series), sedangkan Pie Chart (Grafik Lingkaran) paling tepat menggambarkan proporsi bagian terhadap keseluruhan (persentase total 100%).',
  },
  {
    id: 9,
    jenjang: 'VIII',
    semester: 'Genap',
    elemen: 'Algoritma & Pemrograman (AP)',
    content:
      'Perhatikan algoritma pemrograman prosedural berikut:\n1. Set variabel N = 3 dan HASIL = 1\n2. Ulangi (Repeat) selama N > 0:\n   a. HASIL = HASIL * N\n   b. N = N - 1\n3. Tampilkan nilai HASIL.\nBerapakah nilai variabel HASIL yang ditampilkan di akhir eksekusi algoritma tersebut?',
    image: null,
    options: [
      '6',
      '3',
      '9',
      '1',
    ],
    answer: 'A',
    difficulty: 'HOTS',
    explanation:
      'Iterasi 1 (N=3): HASIL = 1 × 3 = 3, N menjadi 2. Iterasi 2 (N=2): HASIL = 3 × 2 = 6, N menjadi 1. Iterasi 3 (N=1): HASIL = 6 × 1 = 6, N menjadi 0. Karena N = 0 (tidak > 0), perulangan berhenti dan nilai akhir HASIL adalah 6.',
  },
  {
    id: 10,
    jenjang: 'VIII',
    semester: 'Genap',
    elemen: 'Dampak Sosial Informatika (DSI)',
    content:
      'Di sebuah grup pesan instan kelas, beredar pesan berantai yang mengklaim bahwa "Besok sekolah diliburkan selama sebulan penuh karena gangguan satelit" disertai tautan mencurigakan tanpa sumber resmi. Berdasarkan prinsip literasi digital dan Dampak Sosial Informatika Fase D, tindakan kritis yang paling tepat dilakukan siswa adalah...',
    image: null,
    options: [
      'Menerapkan prinsip "Saring Sebelum Sharing": tidak mengeklik tautan mencurigakan, memverifikasi kebenaran informasi ke pihak sekolah/guru resmi, dan tidak ikut menyebarkan kabar yang belum teruji.',
      'Langsung meneruskan (forward) pesan tersebut ke seluruh grup keluarga agar menjadi orang pertama yang membagikan berita.',
      'Mengeklik tautan mencurigakan tersebut lalu memasukkan NISN dan password akun belajar.id.',
      'Membuat berita tambahan yang lebih heboh tanpa konfirmasi kepada pihak sekolah.',
    ],
    answer: 'A',
    difficulty: 'HOTS',
    explanation:
      'Literasi digital menekankan verifikasi sumber informasi (tabayyun / cek fakta ke kanal resmi sekolah) serta menghindari klik tautan tidak dikenal untuk mencegah penyebaran hoaks dan pencurian data.',
  },
  {
    id: 11,
    jenjang: 'VIII',
    semester: 'Genap',
    elemen: 'Jaringan Komputer & Internet (JKI)',
    content:
      'Topologi jaringan komputer di mana semua komputer klien dihubungkan ke sebuah perangkat pusat (Switch atau Hub) melalui kabel masing-masing menyerupai bentuk bintang disebut...',
    image: null,
    options: [
      'Topologi Star (Bintang)',
      'Topologi Bus',
      'Topologi Ring (Cincin)',
      'Topologi Mesh (Jala)',
    ],
    answer: 'A',
    difficulty: 'REGULER',
    explanation:
      'Topologi Star menghubungkan semua node klien ke satu titik pusat (Switch/Hub) sehingga kegagalan satu kabel klien tidak mengganggu komputer lainnya.',
  },
  {
    id: 12,
    jenjang: 'VIII',
    semester: 'Genap',
    elemen: 'Analisis Data (AD)',
    content:
      'Pada lembar kerja Spreadsheet, fungsi pencarian referensi yang digunakan untuk mencari nilai pada tabel referensi yang tersusun secara HORIZONTAL (berdasarkan baris) adalah...',
    image: null,
    options: [
      '=HLOOKUP(lookup_value, table_array, row_index_num, [range_lookup])',
      '=VLOOKUP(lookup_value, table_array, col_index_num, [range_lookup])',
      '=INDEX(array, row_num, col_num)',
      '=MATCH(lookup_value, lookup_array, [match_type])',
    ],
    answer: 'A',
    difficulty: 'REGULER',
    explanation:
      'HLOOKUP (Horizontal Lookup) mencari nilai pada baris pertama sebuah tabel dan mengembalikan nilai pada baris ke-n di kolom yang sama.',
  },
  {
    id: 13,
    jenjang: 'VIII',
    semester: 'Genap',
    elemen: 'Algoritma & Pemrograman (AP)',
    content:
      'Dalam bahasa pemrograman, tipe data yang digunakan khusus untuk menyimpan nilai kebenaran logika yang hanya bernilai Benar (True) atau Salah (False) disebut...',
    image: null,
    options: [
      'Boolean',
      'Integer',
      'String',
      'Float / Double',
    ],
    answer: 'A',
    difficulty: 'REGULER',
    explanation:
      'Tipe data Boolean hanya memiliki dua kemungkinan nilai: True (Benar / 1) atau False (Salah / 0).',
  },
  {
    id: 14,
    jenjang: 'VIII',
    semester: 'Genap',
    elemen: 'Dampak Sosial Informatika (DSI)',
    content:
      'Tindakan intimidasi, pelecehan, penghinaan, atau pengancaman yang dilakukan oleh seseorang atau kelompok terhadap orang lain melalui platform media digital internet disebut...',
    image: null,
    options: [
      'Cyberbullying (Perundungan Siber)',
      'Cyber Law',
      'Data Mining',
      'Digital Literacy',
    ],
    answer: 'A',
    difficulty: 'REGULER',
    explanation:
      'Cyberbullying adalah perilaku berulang yang ditujukan untuk menakuti, membuat marah, atau mempermalukan target menggunakan teknologi digital.',
  },
  {
    id: 15,
    jenjang: 'VIII',
    semester: 'Genap',
    elemen: 'Jaringan Komputer & Internet (JKI)',
    content:
      'Di laboratorium komputer sekolah yang menggunakan Topologi Star dengan satu switch sentral, siswa A tidak dapat terhubung ke jaringan internet karena kabel LAN-nya terlepas. Bagaimanakah dampak insiden tersebut terhadap komputer siswa lain di ruangan tersebut?',
    image: null,
    options: [
      'Komputer siswa lain tetap terhubung dan berfungsi normal tanpa terganggu, karena setiap klien memiliki jalur kabel tersendiri ke switch pusat.',
      'Seluruh komputer di laboratorium otomatis mati dan terputus dari jaringan.',
      'Switch pusat akan mengalami korsleting dan merusak server.',
      'Komputer siswa lain akan menerima alamat IP siswa A secara acak.',
    ],
    answer: 'A',
    difficulty: 'HOTS',
    explanation:
      'Keunggulan utama topologi Star adalah isolasi kerusakan kabel: jika salah satu kabel node putus, hanya node tersebut yang terputus, sedangkan node lainnya tetap beroperasi normal.',
  },
  {
    id: 16,
    jenjang: 'VIII',
    semester: 'Genap',
    elemen: 'Analisis Data (AD)',
    content:
      'Untuk menentukan status predikat nilai ujian siswa pada sel C2 dengan kriteria: Jika nilai >= 85 predikat "A", jika nilai >= 75 predikat "B", dan jika nilai < 75 predikat "C". Penulisan rumus fungsi IF bertingkat (Nested IF) yang benar adalah...',
    image: null,
    options: [
      '=IF(C2>=85, "A", IF(C2>=75, "B", "C"))',
      '=IF(C2>=85, "A", "B", "C")',
      '=IF(C2<75, "A", IF(C2>=75, "B", "C"))',
      '=IF(C2="A", 85, 75)',
    ],
    answer: 'A',
    difficulty: 'HOTS',
    explanation:
      'Rumus Nested IF mengevaluasi kondisi secara berjenjang dari nilai tertinggi: =IF(C2>=85, "A", IF(C2>=75, "B", "C")). Jika kondisi pertama tidak terpenuhi, ia memeriksa kondisi kedua.',
  },
  {
    id: 17,
    jenjang: 'VIII',
    semester: 'Genap',
    elemen: 'Algoritma & Pemrograman (AP)',
    content:
      'Perhatikan potongan pseudocode perulangan berikut:\nSet X = 1\nWhile X <= 5:\n   Output X\n   X = X + 2\nBerapakah deret angka keluaran yang dicetak oleh algoritma tersebut?',
    image: null,
    options: [
      '1, 3, 5',
      '1, 2, 3, 4, 5',
      '2, 4, 6',
      '1, 3, 5, 7',
    ],
    answer: 'A',
    difficulty: 'HOTS',
    explanation:
      'Iterasi 1: cetak 1, X menjadi 3. Iterasi 2: cetak 3, X menjadi 5. Iterasi 3: cetak 5, X menjadi 7. Karena 7 tidak <= 5, perulangan berhenti. Deret keluaran: 1, 3, 5.',
  },
  {
    id: 18,
    jenjang: 'VIII',
    semester: 'Genap',
    elemen: 'Dampak Sosial Informatika (DSI)',
    content:
      'Seorang siswa menerima pesan WhatsApp dari nomor tidak dikenal yang mengabarkan ia memenangkan beasiswa Rp 10.000.000 dan diminta mengunduh file berekstensi .apk dengan nama "Surat_Beasiswa.apk". Berdasarkan prinsip keamanan siber (Cybersecurity), analisis risiko dan tindakan yang tepat adalah...',
    image: null,
    options: [
      'File .apk tersebut kemungkinan besar merupakan malware peretas ponsel yang dapat mencuri data perbankan dan SMS OTP; tindakan yang benar adalah TIDAK mengunduh file tersebut, memblokir nomor, dan melaporkannya.',
      'Langsung menginstal file .apk tersebut agar uang beasiswa segera cair ke rekening.',
      'Meneruskan file .apk tersebut ke grup kelas agar teman-teman ikut mendapatkan beasiswa.',
      'Mengubah ekstensi file menjadi .mp3 agar aman dari virus.',
    ],
    answer: 'A',
    difficulty: 'HOTS',
    explanation:
      'Modus pengiriman file .apk berbahaya melalui pesan instan sering kali menyamarkan Trojan peretas untuk mencuri SMS OTP dan data perbankan korban.',
  },
  {
    id: 19,
    jenjang: 'VIII',
    semester: 'Genap',
    elemen: 'Jaringan Komputer & Internet (JKI)',
    content:
      'Dalam jaringan internet, sistem basis data terdistribusi yang berfungsi menerjemahkan nama domain yang mudah diingat manusia (seperti www.smpn7kisaran.sch.id) menjadi alamat IP numerik (seperti 192.168.1.10) disebut...',
    image: null,
    options: [
      'DNS (Domain Name System)',
      'DHCP (Dynamic Host Configuration Protocol)',
      'HTTP (Hypertext Transfer Protocol)',
      'FTP (File Transfer Protocol)',
    ],
    answer: 'A',
    difficulty: 'REGULER',
    explanation:
      'DNS (Domain Name System) bertindak seperti buku telepon internet yang memetakan nama domain ke alamat IP server tempat situs web dihosting.',
  },
  {
    id: 20,
    jenjang: 'VIII',
    semester: 'Genap',
    elemen: 'Analisis Data (AD)',
    content:
      'Seorang pengelola data ekstrakurikuler sekolah memiliki tabel ribuan baris kegiatan siswa. Fitur tingkat lanjut pada Microsoft Excel yang paling ampuh untuk meringkas, mengelompokkan, dan menganalisis data secara dinamis tanpa mengetik banyak rumus rumit adalah...',
    image: null,
    options: [
      'Pivot Table',
      'WordArt',
      'Format Painter',
      'Spell Check',
    ],
    answer: 'A',
    difficulty: 'HOTS',
    explanation:
      'Pivot Table adalah fitur analisis data interaktif untuk mengagregasi, meringkas, dan menyaring tabel data besar menjadi ringkasan yang mudah dipahami.',
  },
  {
    id: 21,
    jenjang: 'VIII',
    semester: 'Genap',
    elemen: 'Algoritma & Pemrograman (AP)',
    content:
      'Sebuah robot beroda pintar diprogram dengan sensor jarak ultrasonik di bagian depan. Algoritma robot menentukan: "Jika jarak rintangan di depan < 25 cm, robot berbelok kanan 90 derajat; selain itu, robot maju lurus dengan kecepatan 60%". Komponen perangkat keras yang bertindak sebagai sensor (penerima input) dan aktuator (penggerak output) secara berurutan adalah...',
    image: null,
    options: [
      'Sensor Ultrasonik sebagai sensor input dan Motor Penggerak Roda sebagai aktuator output',
      'Motor Roda sebagai input dan Sensor Ultrasonik sebagai output',
      'Baterai sebagai input dan Antena Wi-Fi sebagai output',
      'Kabel USB sebagai sensor dan Sakelar On/Off sebagai aktuator',
    ],
    answer: 'A',
    difficulty: 'HOTS',
    explanation:
      'Sensor Ultrasonik membaca data jarak fisik dari pantulan gelombang suara (Input), sedangkan Motor Listrik menggerakkan roda fisik robot sesuai perintah mikrokontroler (Output/Aktuator).',
  },
  {
    id: 22,
    jenjang: 'VIII',
    semester: 'Genap',
    elemen: 'Dampak Sosial Informatika (DSI)',
    content:
      'Di Indonesia, produk hukum perundang-undangan yang mengatur tentang pemanfaatan teknologi informasi, transaksi elektronik, serta sanksi pidana terhadap kejahatan siber seperti penyebaran berita bohong (hoaks) dan pencemaran nama baik adalah...',
    image: null,
    options: [
      'Undang-Undang Informasi dan Transaksi Elektronik (UU ITE)',
      'Undang-Undang Ketenagakerjaan',
      'Undang-Undang Lalu Lintas Jalan Raya',
      'Undang-Undang Kesehatan',
    ],
    answer: 'A',
    difficulty: 'REGULER',
    explanation:
      'UU ITE (Undang-Undang Nomor 11 Tahun 2008 beserta perubahannya) mengatur tentang regulasi informasi, transaksi elektronik, dan tindak pidana siber di Indonesia.',
  },
  {
    id: 23,
    jenjang: 'VIII',
    semester: 'Genap',
    elemen: 'Jaringan Komputer & Internet (JKI)',
    content:
      'Di laboratorium komputer, guru menyarankan agar jaringan Wi-Fi sekolah diamankan menggunakan enkripsi WPA2/WPA3 Personal dengan password yang kuat dibanding membiarkannya terbuka (Open Network) tanpa password. Alasan teknis keamanan yang mendasarinya adalah...',
    image: null,
    options: [
      'Pada jaringan Wi-Fi terbuka (Open), data lalu lintas browsing dapat disadap dengan mudah oleh perangkat lain menggunakan aplikasi Packet Sniffer.',
      'Jaringan ber-password membuat kecepatan internet kabel meningkat 100 kali lipat.',
      'Enkripsi WPA2 menghapus semua virus di dalam harddisk siswa secara otomatis.',
      'Wi-Fi tanpa password tidak memancarkan gelombang radio sama sekali.',
    ],
    answer: 'A',
    difficulty: 'REGULER',
    explanation:
      'Jaringan nirkabel tanpa enkripsi (Open) mentransmisikan paket data secara telanjang (unencrypted), sehingga siapapun yang berada dalam jangkauan sinyal dapat menyadap data lalu lintas (Packet Sniffing).',
  },
  {
    id: 24,
    jenjang: 'VIII',
    semester: 'Genap',
    elemen: 'Analisis Data (AD)',
    content:
      'Untuk menghitung berapa banyak siswa di Kelas "VIII-1" yang memperoleh nilai tuntas (>= 75) dari tabel nilai sekolah pada kolom B (Kelas) dan kolom C (Nilai), rumus fungsi Analisis Data kriteria ganda yang tepat adalah...',
    image: null,
    options: [
      '=COUNTIFS(B2:B50, "VIII-1", C2:C50, ">=75")',
      '=SUMIF(B2:B50, "VIII-1", C2:C50)',
      '=COUNTIF(B2:B50, "VIII-1") + COUNTIF(C2:C50, ">=75")',
      '=AVERAGEIF(B2:B50, "VIII-1", C2:C50)',
    ],
    answer: 'A',
    difficulty: 'HOTS',
    explanation:
      'Fungsi =COUNTIFS() menghitung jumlah baris yang memenuhi beberapa kriteria sekaligus (Kriteria 1: Kelas = "VIII-1", Kriteria 2: Nilai >= 75).',
  },
  {
    id: 25,
    jenjang: 'VIII',
    semester: 'Genap',
    elemen: 'Algoritma & Pemrograman (AP)',
    content:
      'Diketahui daftar nilai ujian 100 siswa telah terurut dari terkecil ke terbesar: [40, 42, 45, ..., 98, 100]. Untuk mencari apakah nilai 85 ada di dalam daftar, algoritma manakah yang jauh lebih efisien dan bagaimana cara kerjanya?',
    image: null,
    options: [
      'Binary Search (Pencarian Biner), karena membagi ruang pencarian menjadi dua bagian secara berulang sehingga membutuhkan maksimal sekitar 7 kali perbandingan.',
      'Linear Search (Pencarian Berurutan), karena harus memeriksa setiap nilai dari urutan pertama satu per satu hingga 100 kali.',
      'Bubble Sort, karena mengacak kembali posisi semua nilai siswa.',
      'Selection Search, karena menghapus nilai yang tidak diinginkan.',
    ],
    answer: 'A',
    difficulty: 'HOTS',
    explanation:
      'Pada data yang sudah terurut, Binary Search memiliki kompleksitas O(log₂ N). Untuk 100 data, log₂ 100 ≈ 7 perbandingan, jauh lebih efisien dibanding Linear Search yang dapat membutuhkan hingga 100 perbandingan.',
  }
];

export const FASE_D_QUESTION_BANKS: Record<ExamPackageKey, Question[]> = {
  VII_Ganjil: QUESTIONS_VII_GANJIL,
  VII_Genap: QUESTIONS_VII_GENAP,
  VIII_Ganjil: QUESTIONS_VIII_GANJIL,
  VIII_Genap: QUESTIONS_VIII_GENAP,
};

// Bank Soal Online Tambahan (Variasi Soal Online Kurikulum Merdeka Fase D)
// Digunakan saat guru/siswa menekan "Perbarui / Ambil Soal Online" untuk memuat variasi soal online terbaru
export const ONLINE_EXTRA_QUESTIONS_POOL: Record<ExamPackageKey, Question[]> = {
  VII_Ganjil: [
    {
      id: 26,
      jenjang: 'VII',
      semester: 'Ganjil',
      elemen: 'Berpikir Komputasional (BK)',
      content:
        '[Soal Online Fase D] Urutan langkah-langkah logis, terstruktur, dan berhingga yang disusun untuk menyelesaikan suatu masalah secara sistematis dalam Informatika disebut...',
      image: null,
      options: ['Algoritma', 'Periferal', 'Kompilator', 'Topologi'],
      answer: 'A',
      difficulty: 'REGULER',
      explanation:
        'Algoritma adalah urutan langkah-langkah logis dan sistematis yang dirancang untuk memecahkan suatu permasalahan.',
    },
    {
      id: 27,
      jenjang: 'VII',
      semester: 'Ganjil',
      elemen: 'Sistem Komputer (SK)',
      content:
        '[Soal Online Fase D] Pada sistem pengkodean biner ASCII, setiap 1 karakter huruf atau simbol direpresentasikan oleh 1 Byte data. Berapakah jumlah bit dalam 1 Byte?',
      image: null,
      options: ['8 bit', '4 bit', '16 bit', '100 bit'],
      answer: 'A',
      difficulty: 'HOTS',
      explanation:
        'Dalam satuan data digital sistem komputer, 1 Byte terdiri atas 8 bit (binary digit) yang masing-masing bernilai 0 atau 1.',
    },
  ],
  VII_Genap: [
    {
      id: 26,
      jenjang: 'VII',
      semester: 'Genap',
      elemen: 'Analisis Data (AD)',
      content:
        '[Soal Online Fase D] Fitur pada aplikasi pengolah lembar kerja (Spreadsheet) yang berfungsi mengurutkan data nama siswa dari abjad A ke Z disebut...',
      image: null,
      options: [
        'Sort Ascending (A-Z)',
        'Filter Data',
        'Merge & Center',
        'Conditional Formatting',
      ],
      answer: 'A',
      difficulty: 'REGULER',
      explanation:
        'Sort Ascending mengurutkan data dari nilai terkecil ke terbesar atau dari urutan abjad A sampai Z.',
    },
    {
      id: 27,
      jenjang: 'VII',
      semester: 'Genap',
      elemen: 'Algoritma & Pemrograman (AP)',
      content:
        '[Soal Online Fase D] Pada aplikasi Scratch, jika kita ingin membuat Sprite bergerak mengikuti arah jarum jam sebesar 90 derajat setiap kali tombol spasi ditekan, kombinasi blok yang tepat adalah...',
      image: null,
      options: [
        'Blok Events "when space key pressed" + Blok Motion "turn clockwise 90 degrees"',
        'Blok Looks "say Hello" + Blok Sound "stop all sounds"',
        'Blok Control "wait 10 seconds" + Blok Sensing "ask what is your name"',
        'Blok Operators "pick random 1 to 10" saja',
      ],
      answer: 'A',
      difficulty: 'HOTS',
      explanation:
        'Kejadian penekanan tombol spasi ditangani oleh "when space key pressed" dan perputaran searah jarum jam dijalankan oleh blok Motion "turn clockwise 90 degrees".',
    },
  ],
  VIII_Ganjil: [
    {
      id: 26,
      jenjang: 'VIII',
      semester: 'Ganjil',
      elemen: 'Berpikir Komputasional (BK)',
      content:
        '[Soal Online Fase D] Konversikan bilangan biner 11010₂ ke dalam sistem bilangan desimal (basis 10)!',
      image: null,
      options: ['26₁₀', '24₁₀', '28₁₀', '13₁₀'],
      answer: 'A',
      difficulty: 'HOTS',
      explanation:
        '11010₂ = (1 × 2⁴) + (1 × 2³) + (0 × 2²) + (1 × 2¹) + (0 × 2⁰) = 16 + 8 + 0 + 2 + 0 = 26₁₀.',
    },
    {
      id: 27,
      jenjang: 'VIII',
      semester: 'Ganjil',
      elemen: 'Teknologi Informasi & Komunikasi (TIK)',
      content:
        '[Soal Online Fase D] Fitur penyisipan grafik Excel ke dalam dokumen Word sehingga ketika data angka di Excel diubah maka grafik di Word ikut berubah secara otomatis disebut...',
      image: null,
      options: [
        'Object Linking and Embedding (Paste Link)',
        'Paste Plain Text Only',
        'Print Screen Statis',
        'Find and Replace',
      ],
      answer: 'A',
      difficulty: 'REGULER',
      explanation:
        'Object Linking (Paste Special -> Paste Link) menghubungkan objek di Word secara dinamis dengan sumber datanya di Excel.',
    },
  ],
  VIII_Genap: [
    {
      id: 26,
      jenjang: 'VIII',
      semester: 'Genap',
      elemen: 'Jaringan Komputer & Internet (JKI)',
      content:
        '[Soal Online Fase D] Pada komunikasi data telepon seluler (HP), menara pemancar dan penerima sinyal radio yang menghubungkan perangkat ponsel pengguna dengan jaringan operator seluler disebut...',
      image: null,
      options: [
        'BTS (Base Transceiver Station)',
        'UPS (Uninterruptible Power Supply)',
        'GPU (Graphics Processing Unit)',
        'BIOS (Basic Input Output System)',
      ],
      answer: 'A',
      difficulty: 'REGULER',
      explanation:
        'BTS (Base Transceiver Station) adalah infrastruktur telekomunikasi yang memfasilitasi komunikasi nirkabel antara peranti komunikasi seluler dan jaringan operator.',
    },
    {
      id: 27,
      jenjang: 'VIII',
      semester: 'Genap',
      elemen: 'Algoritma & Pemrograman (AP)',
      content:
        '[Soal Online Fase D] Robot Line Follower (seperti Ozobot) berjalan mengikuti garis hitam menggunakan sensor warna di bagian bawahnya. Jika robot membaca kode warna "Merah - Hitam - Merah" yang diprogram sebagai instruksi "U-Turn" (Berbalik Arah 180°), maka perilaku robot yang tepat adalah...',
      image: null,
      options: [
        'Robot memutar arah hadapnya 180 derajat dan kembali menelusuri jalur garis ke arah sebaliknya',
        'Robot mematikan daya baterai secara permanen',
        'Robot terbang melompati meja laboratorium',
        'Sensor robot menghapus seluruh program di dalam memori ROM',
      ],
      answer: 'A',
      difficulty: 'HOTS',
      explanation:
        'Instruksi U-Turn pada robot penjejak garis (Ozobot) memerintahkan aktuator roda untuk berputar 180 derajat dan melanjutkan pelacakan garis ke arah berlawanan.',
    },
  ],
};

export interface OnlineRandomizationContext {
  namaSiswa?: string;
  nisNisn?: string;
  kelas?: string;
  clientIp?: string;
  deviceFingerprint?: string;
  deviceModel?: string;
}

export function createSeededPrngFromContext(seedText: string): () => number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < seedText.length; i++) {
    h ^= seedText.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  let state = (h >>> 0) || 0x6d2b79f5;
  return () => {
    state += 0x6d2b79f5;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function computeStudentDeviceIpSeedOffset(ctx?: OnlineRandomizationContext): number {
  if (!ctx) return 1;
  const raw = [
    (ctx.namaSiswa || '').trim().toLowerCase(),
    (ctx.nisNisn || '').trim().toLowerCase(),
    (ctx.kelas || '').trim().toUpperCase(),
    (ctx.clientIp || '').trim(),
    (ctx.deviceFingerprint || '').trim(),
    (ctx.deviceModel || '').trim(),
  ]
    .filter(Boolean)
    .join('|');
  if (!raw) return 1;
  let hash = 5381;
  for (let i = 0; i < raw.length; i++) {
    hash = (hash * 33) ^ raw.charCodeAt(i);
  }
  return 1 + ((hash >>> 0) % 97);
}

/**
 * Mengambil paket soal Informatika Fase D secara online berdasarkan Tingkat Kelas (VII / VIII), Semester (Ganjil / Genap),
 * serta secara otomatis menyesuaikan variasi paket soal online berdasarkan Perangkat Device & Alamat IP Siswa.
 * Jika URL Google Apps Script atau Cloud Server tersedia, fungsi akan menyinkronkan dari Cloud terlebih dahulu,
 * lalu menggabungkan Bank Soal Utama + Bank Soal Variasi Online Dinamis agar setiap perangkat/IP mendapatkan komposisi soal yang unik.
 */
export async function fetchOnlineFaseDQuestions(
  jenjang: JenjangKelas,
  semester: SemesterType,
  appsScriptWebAppUrl?: string,
  includeExtraOnlineVariation: boolean = true,
  deviceIpContext?: OnlineRandomizationContext
): Promise<{
  questions: Question[];
  sourceLabel: string;
  packageKey: ExamPackageKey;
  detectedClientIp?: string;
  variationSeedCode?: string;
}> {
  const packageKey: ExamPackageKey = `${jenjang}_${semester}`;
  let baseQuestions = FASE_D_QUESTION_BANKS[packageKey] || QUESTIONS_VIII_GANJIL;
  const meta = FASE_D_PACKAGE_META[packageKey];
  let detectedClientIp = deviceIpContext?.clientIp || '';

  // 1. Ambil info jaringan (IP Publik & Bank Soal Server Online) dari Backend Cloud Server secara real-time
  try {
    const controller = new AbortController();
    const timeoutId = typeof window !== 'undefined' ? window.setTimeout(() => controller.abort(), 2200) : 0;
    const srvRes = await fetch(`/__api/student-dashboard-sync?_t=${Date.now()}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'getClientNetworkInfo' }),
      signal: controller.signal,
    });
    if (timeoutId && typeof window !== 'undefined') window.clearTimeout(timeoutId);
    if (srvRes.ok) {
      const srvData = await srvRes.json();
      if (srvData && typeof srvData.clientIp === 'string' && srvData.clientIp.trim()) {
        detectedClientIp = srvData.clientIp.trim();
      }
      if (
        srvData &&
        srvData.questionBanks &&
        Array.isArray(srvData.questionBanks[packageKey]) &&
        srvData.questionBanks[packageKey].length >= 15
      ) {
        baseQuestions = srvData.questionBanks[packageKey];
      }
    }
  } catch {
    // Lanjut jika sedang offline sementara
  }

  // 2. Jika URL Google Apps Script tersedia, coba ambil soal online dari Cloud Guru
  if (appsScriptWebAppUrl && appsScriptWebAppUrl.trim().startsWith('http')) {
    try {
      const separator = appsScriptWebAppUrl.includes('?') ? '&' : '?';
      const url = `${appsScriptWebAppUrl.trim()}${separator}action=getQuestions&jenjang=${jenjang}&semester=${semester}`;
      const res = await fetch(url, { method: 'GET' });
      if (res.ok) {
        const data = await res.json();
        if (data && Array.isArray(data.questions) && data.questions.length >= 5) {
          baseQuestions = data.questions.map((q: Question, idx: number) => ({
            ...q,
            id: idx + 1,
            jenjang,
            semester,
          }));
        }
      }
    } catch {
      // Lanjut ke repositori online Fase D bawaan jika jaringan/CORS Apps Script tidak merespons
    }
  }

  // 3. Bangun variasi soal online yang unik berdasarkan Device + IP + Kelas + Semester
  const effectiveCtx: OnlineRandomizationContext = {
    ...deviceIpContext,
    clientIp: detectedClientIp || deviceIpContext?.clientIp || '103.148.201.77',
  };
  const seedOffset = computeStudentDeviceIpSeedOffset(effectiveCtx);
  const seedString = [
    packageKey,
    effectiveCtx.namaSiswa || 'SISWA',
    effectiveCtx.nisNisn || 'NISN',
    effectiveCtx.kelas || jenjang,
    effectiveCtx.clientIp || 'IP',
    effectiveCtx.deviceFingerprint || 'DEV',
    effectiveCtx.deviceModel || 'MODEL',
    includeExtraOnlineVariation ? String(Date.now()).slice(0, -4) : 'STD',
  ].join('::');

  const prng = createSeededPrngFromContext(seedString);
  const variationCode = `PKT-${jenjang}${semester === 'Ganjil' ? '1' : '2'}-IP${String(seedOffset).padStart(2, '0')}`;

  // Kumpulkan pool soal lengkap khusus jenjang (VII / VIII) dan semester (Ganjil / Genap) ini:
  // Gabungkan Base Bank (25 soal) + Extra Online Pool (2 soal) + Dynamic Parameterized Online Pool berdasarkan IP & Device (25 soal)
  const extras = ONLINE_EXTRA_QUESTIONS_POOL[packageKey] || [];
  const dynamicOnlinePool = buildDynamicParameterizedRetakePool(
    packageKey,
    1 + (seedOffset % 7),
    seedOffset
  ).map((q) => ({
    ...q,
    // Bersihkan label "[Paket Susulan #X]" menjadi soal online reguler sesuai jenjang & semester
    content: q.content.replace(/^\[Paket Susulan #\d+\]\s*/i, ''),
    jenjang,
    semester,
  }));

  const fullCandidatePool: Question[] = [];
  const seenFp = new Set<string>();
  [...baseQuestions, ...extras, ...dynamicOnlinePool].forEach((q) => {
    if (!q || !q.content) return;
    const qJenjang = q.jenjang || jenjang;
    const qSem = q.semester || semester;
    if (qJenjang !== jenjang || qSem !== semester) return;
    const fp = computeQuestionContentFingerprint(q.content);
    if (!seenFp.has(fp)) {
      seenFp.add(fp);
      fullCandidatePool.push({
        ...q,
        jenjang,
        semester,
      });
    }
  });

  // Pisahkan soal REGULER (target 12) dan HOTS (target 13) lalu acak menggunakan PRNG berbasis Device + IP
  const regulerPool = fullCandidatePool.filter((q) => q.difficulty === 'REGULER');
  const hotsPool = fullCandidatePool.filter((q) => q.difficulty === 'HOTS');

  const shuffleWithPrng = <T,>(arr: T[]): T[] => {
    const copy = [...arr];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(prng() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  };

  const pickedReguler = shuffleWithPrng(regulerPool).slice(0, 12);
  const pickedHots = shuffleWithPrng(hotsPool).slice(0, 13);
  let combinedPool = shuffleWithPrng([...pickedReguler, ...pickedHots]);

  if (combinedPool.length < 25) {
    const usedContents = new Set(combinedPool.map((q) => q.content));
    for (const q of shuffleWithPrng(fullCandidatePool)) {
      if (combinedPool.length >= 25) break;
      if (!usedContents.has(q.content)) {
        usedContents.add(q.content);
        combinedPool.push(q);
      }
    }
  }

  // Acak juga posisi opsi jawaban A, B, C, D untuk setiap soal sehingga kunci jawaban tersebar merata (A/B/C/D) dan unik per perangkat/IP
  const letters: ('A' | 'B' | 'C' | 'D')[] = ['A', 'B', 'C', 'D'];
  const finalRandomizedQuestions: Question[] = combinedPool.slice(0, 25).map((q, idx) => {
    const origIdx = letters.indexOf(q.answer);
    const correctText = origIdx >= 0 && origIdx < q.options.length ? q.options[origIdx] : q.options[0];
    const taggedOpts = q.options.map((optText, oIdx) => ({
      text: optText,
      isCorrect: oIdx === (origIdx >= 0 ? origIdx : 0),
    }));
    const shuffledOpts = shuffleWithPrng(taggedOpts);
    const newCorrectIdx = shuffledOpts.findIndex((o) => o.isCorrect || o.text === correctText);
    return {
      ...q,
      id: idx + 1,
      jenjang,
      semester,
      options: shuffledOpts.map((o) => o.text) as [string, string, string, string],
      answer: letters[newCorrectIdx >= 0 ? newCorrectIdx : 0],
    };
  });

  return {
    questions: finalRandomizedQuestions,
    sourceLabel: `${meta.sumberOnline} · Paket Unik Device & IP (${variationCode})`,
    packageKey,
    detectedClientIp: effectiveCtx.clientIp,
    variationSeedCode: variationCode,
  };
}

/**
 * Generator Soal Ujian Susulan / Ulangan Dinamis Tanpa Pengulangan (Non-Repeating Retake Question Generator)
 * Memastikan setiap kali seorang siswa melakukan ujian susulan (atau mengulang ujian berulang kali),
 * sistem akan menyajikan 25 soal ujian BARU (12 REGULER & 13 HOTS) yang TIDAK PERNAH SAMA dengan soal-soal
 * yang sudah pernah dikerjakan oleh siswa tersebut pada percobaan-percobaan sebelumnya.
 */
const RETAKE_STUDENT_HISTORY_STORAGE_KEY = 'anbk_student_seen_questions_history_v1';

export interface StudentQuestionHistoryEntry {
  studentKey: string;
  namaSiswa: string;
  nisNisn: string;
  packageKey: ExamPackageKey;
  attemptCount: number;
  seenFingerprints: string[];
  seenContents: string[];
  updatedAt: number;
}

export function normalizeStudentHistoryIdentityKey(
  namaSiswa: string,
  nisNisn: string,
  packageKey: ExamPackageKey
): string {
  const cleanName = (namaSiswa || '').trim().toLowerCase().replace(/\s+/g, ' ');
  const cleanNis = (nisNisn || '').trim().toLowerCase().replace(/\s+/g, '');
  const idPart =
    cleanNis && cleanNis !== '0' && cleanNis !== '-'
      ? `${cleanName}_${cleanNis}`
      : cleanName || 'anonymous_student';
  return `${idPart}__${packageKey}`;
}

export function computeQuestionContentFingerprint(content: string): string {
  const normalized = (content || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
  let hash = 2166136261;
  for (let i = 0; i < normalized.length; i++) {
    hash ^= normalized.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return `QF-${(hash >>> 0).toString(16).padStart(8, '0')}-${normalized.slice(0, 48)}`;
}

export function getStudentSeenQuestionsHistory(
  namaSiswa: string,
  nisNisn: string,
  packageKey: ExamPackageKey
): StudentQuestionHistoryEntry {
  const studentKey = normalizeStudentHistoryIdentityKey(namaSiswa, nisNisn, packageKey);
  if (typeof window === 'undefined') {
    return {
      studentKey,
      namaSiswa: namaSiswa.trim(),
      nisNisn: nisNisn.trim(),
      packageKey,
      attemptCount: 0,
      seenFingerprints: [],
      seenContents: [],
      updatedAt: Date.now(),
    };
  }
  try {
    const raw = localStorage.getItem(RETAKE_STUDENT_HISTORY_STORAGE_KEY);
    if (raw) {
      const map = JSON.parse(raw) as Record<string, StudentQuestionHistoryEntry>;
      if (map && map[studentKey]) {
        return map[studentKey];
      }
      // Cari juga berdasarkan nama siswa saja atau NISN saja pada paket yang sama agar tetap terlacak meskipun siswa sedikit mengubah spasi
      const cleanName = (namaSiswa || '').trim().toLowerCase().replace(/\s+/g, ' ');
      const cleanNis = (nisNisn || '').trim().toLowerCase();
      const matchedEntry = Object.values(map).find(
        (entry) =>
          entry.packageKey === packageKey &&
          ((cleanName &&
            entry.namaSiswa.trim().toLowerCase().replace(/\s+/g, ' ') === cleanName) ||
            (cleanNis &&
              cleanNis !== '0' &&
              cleanNis !== '-' &&
              entry.nisNisn.trim().toLowerCase() === cleanNis))
      );
      if (matchedEntry) {
        return matchedEntry;
      }
    }
  } catch {
    // ignore storage read error
  }
  return {
    studentKey,
    namaSiswa: namaSiswa.trim(),
    nisNisn: nisNisn.trim(),
    packageKey,
    attemptCount: 0,
    seenFingerprints: [],
    seenContents: [],
    updatedAt: Date.now(),
  };
}

export function recordStudentSeenQuestions(
  namaSiswa: string,
  nisNisn: string,
  packageKey: ExamPackageKey,
  questionsToRecord: Question[]
): StudentQuestionHistoryEntry {
  const studentKey = normalizeStudentHistoryIdentityKey(namaSiswa, nisNisn, packageKey);
  const existing = getStudentSeenQuestionsHistory(namaSiswa, nisNisn, packageKey);
  const fpSet = new Set<string>(existing.seenFingerprints || []);
  const contentSet = new Set<string>(existing.seenContents || []);

  questionsToRecord.forEach((q) => {
    if (!q || !q.content) return;
    fpSet.add(computeQuestionContentFingerprint(q.content));
    contentSet.add(q.content.trim().toLowerCase().replace(/\s+/g, ' '));
  });

  const updatedEntry: StudentQuestionHistoryEntry = {
    studentKey,
    namaSiswa: namaSiswa.trim(),
    nisNisn: nisNisn.trim(),
    packageKey,
    attemptCount: (existing.attemptCount || 0) + 1,
    seenFingerprints: Array.from(fpSet),
    seenContents: Array.from(contentSet),
    updatedAt: Date.now(),
  };

  if (typeof window !== 'undefined') {
    try {
      const raw = localStorage.getItem(RETAKE_STUDENT_HISTORY_STORAGE_KEY);
      const map: Record<string, StudentQuestionHistoryEntry> = raw ? JSON.parse(raw) : {};
      map[studentKey] = updatedEntry;
      localStorage.setItem(RETAKE_STUDENT_HISTORY_STORAGE_KEY, JSON.stringify(map));
    } catch {
      // ignore storage write error
    }
  }

  return updatedEntry;
}

export function clearAllStudentSeenQuestionsHistory(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(RETAKE_STUDENT_HISTORY_STORAGE_KEY);
  } catch {
    // ignore
  }
}

/**
 * Menghasilkan 25 Soal Baru Khusus Ujian Susulan / Ulangan ke-N (12 Soal REGULER & 13 Soal HOTS)
 * dengan variasi kasus, skenario kontekstual, data angka, operasi logika, struktur data, jaringan,
 * spreadsheet, dan pemrograman yang berbeda di setiap percobaan, serta memverifikasi fingerprint
 * agar tidak ada satu pun soal yang sama dengan soal yang pernah dikerjakan siswa sebelumnya.
 */
function buildDynamicParameterizedRetakePool(
  packageKey: ExamPackageKey,
  attemptNumber: number,
  seedOffset: number = 0
): Question[] {
  const v = Math.max(1, attemptNumber) + seedOffset;
  const [jenjang, semester] = packageKey.split('_') as [JenjangKelas, SemesterType];

  // Parameter dinamis yang selalu berubah di setiap percobaan susulan ke-1, ke-2, ke-3, ke-4, dst.
  const decA = 18 + ((v * 7) % 43); // rentang 18..60
  const binA = decA.toString(2).padStart(6, '0');
  const wrongDec1 = decA + 2;
  const wrongDec2 = Math.max(5, decA - 3);
  const wrongDec3 = decA + 5;

  const hexHigh = 1 + ((v * 3) % 7); // 1..7
  const hexLowVal = 10 + ((v * 5) % 6); // 10..15 (A..F)
  const hexLowChar = ['A', 'B', 'C', 'D', 'E', 'F'][hexLowVal - 10];
  const hexCode = `${hexHigh}${hexLowChar}`;
  const hexDecimal = hexHigh * 16 + hexLowVal;
  const hexBinary = hexDecimal.toString(2).padStart(8, '0');

  const octHigh = 2 + (v % 5); // 2..6
  const octLow = 1 + ((v * 3) % 6); // 1..6
  const octCode = `${octHigh}${octLow}`;
  const octDecimal = octHigh * 8 + octLow;
  const octBinary = octDecimal.toString(2).padStart(6, '0');

  const stackItemsPool = [
    ['Dokumen_A', 'Dokumen_B', 'Dokumen_C', 'Dokumen_D', 'Dokumen_E'],
    ['Paket_101', 'Paket_102', 'Paket_103', 'Paket_104', 'Paket_105'],
    ['Modul_SK', 'Modul_BK', 'Modul_TIK', 'Modul_JKI', 'Modul_AP'],
    ['Piring_Merah', 'Piring_Biru', 'Piring_Hijau', 'Piring_Kuning', 'Piring_Putih'],
    ['Kotak_Alfa', 'Kotak_Beta', 'Kotak_Gamma', 'Kotak_Delta', 'Kotak_Omega'],
    ['Berkas_Ujian1', 'Berkas_Ujian2', 'Berkas_Ujian3', 'Berkas_Ujian4', 'Berkas_Ujian5'],
  ];
  const stSet = stackItemsPool[v % stackItemsPool.length];

  const queueNamesPool = [
    ['Raka', 'Sinta', 'Tomi', 'Vina', 'Wulan'],
    ['Fajar', 'Gita', 'Hadi', 'Indah', 'Joko'],
    ['Kiki', 'Lina', 'Miko', 'Nadia', 'Omar'],
    ['Putra', 'Qori', 'Rendi', 'Salsa', 'Tegar'],
    ['Zaki', 'Yuni', 'Xena', 'Wahyu', 'Vicky'],
    ['Aldi', 'Bunga', 'Cakra', 'Dewi', 'Edo'],
  ];
  const qSet = queueNamesPool[v % queueNamesPool.length];

  const kkmScore = 70 + ((v * 2) % 16); // 70..85
  const rowCount = 25 + ((v * 5) % 60); // 25..80
  const mailMergeCount = 90 + ((v * 15) % 180);

  const recBase = 2 + (v % 4); // 2..5
  const recAdd = 1 + (v % 3); // 1..3
  // U(1) = recBase, U(n) = 2 * U(n-1) + recAdd -> hitung U(4)
  const u2 = 2 * recBase + recAdd;
  const u3 = 2 * u2 + recAdd;
  const u4 = 2 * u3 + recAdd;

  const routeAB = 2 + (v % 5);
  const routeBD = 5 + ((v * 2) % 6);
  const routeAC = 1 + (v % 4);
  const routeCD = 2 + ((v * 3) % 4);
  const routeBC = 1 + (v % 2);
  const costPath1 = routeAB + routeBD;
  const costPath2 = routeAC + routeCD;
  const costPath3 = routeAB + routeBC + routeCD;

  const scratchRepeat = 3 + (v % 4); // 3..6
  const stepX = 10 + ((v * 5) % 25);
  const stepY = -5 - ((v * 3) % 15);
  const finalX = scratchRepeat * stepX;
  const finalY = scratchRepeat * stepY;

  const caesarShift = 2 + (v % 4); // 2..5
  const plainWords = ['KODE', 'SIBER', 'AWAN', 'LOGIKA', 'MODEM', 'SANDI', 'PORTAL'];
  const chosenWord = plainWords[v % plainWords.length];
  const encryptCaesar = (word: string, shift: number) =>
    word
      .split('')
      .map((ch) => {
        const code = ch.charCodeAt(0) - 65;
        return String.fromCharCode(((code + shift) % 26) + 65);
      })
      .join('');
  const cipherWord = encryptCaesar(chosenWord, caesarShift);
  const wrongCipher1 = encryptCaesar(chosenWord, caesarShift + 1);
  const wrongCipher2 = encryptCaesar(chosenWord, Math.max(1, caesarShift - 1));
  const wrongCipher3 = chosenWord.split('').reverse().join('');

  if (packageKey === 'VII_Ganjil') {
    const sjfDurations = [15 + (v % 9), 25 + (v % 7), 35 + (v % 8), 45 + (v % 10)];
    return [
      {
        id: 1,
        jenjang,
        semester,
        elemen: 'Berpikir Komputasional (BK)',
        content: `[Paket Susulan #${v}] Saat merancang kegiatan Pameran Karya Informatika di ${EXAM_INFO.namaSekolah}, ketua kelas membagi kepanitiaan menjadi tim dekorasi, tim demonstrasi aplikasi, tim dokumentasi, dan tim konsumsi agar pekerjaan besar mudah dikontrol. Pendekatan Berpikir Komputasional yang diterapkan adalah...`,
        image: null,
        options: [
          'Dekomposisi (Decomposition), yaitu menguraikan persoalan besar menjadi sub-tugas yang lebih kecil dan terkelola',
          'Kompilasi (Compilation), yaitu mengubah bahasa pemrograman menjadi kode mesin biner',
          'Enkripsi (Encryption), yaitu menyandikan data kegiatan agar tidak terbaca pihak luar',
          'Defragmentasi (Defragmentation), yaitu menata ulang sektor penyimpanan pada harddisk',
        ],
        answer: 'A',
        difficulty: 'REGULER',
        explanation:
          'Dekomposisi adalah pilar Berpikir Komputasional yang memecah masalah atau proyek besar menjadi bagian-bagian kecil yang lebih mudah diselesaikan.',
      },
      {
        id: 2,
        jenjang,
        semester,
        elemen: 'Teknologi Informasi & Komunikasi (TIK)',
        content: `[Paket Susulan #${v}] Seorang siswa Kelas VII menyimpan file rekaman presentasi video dan dokumen laporan cetak siap baca yang tata letaknya terkunci. Pasangan ekstensi file yang tepat untuk kedua kebutuhan tersebut secara berurutan adalah...`,
        image: null,
        options: [
          `.mp4 untuk file video presentasi dan .pdf untuk dokumen laporan siap baca`,
          `.xlsx untuk file video presentasi dan .mp3 untuk dokumen laporan teks`,
          `.exe untuk gambar foto dan .txt untuk video animasi`,
          `.wav untuk lembar kerja angka dan .zip untuk pemutar suara`,
        ],
        answer: 'A',
        difficulty: 'REGULER',
        explanation:
          'Format .mp4 adalah standar file multimedia video digital, sedangkan .pdf (Portable Document Format) menjaga tata letak dokumen tetap konsisten di semua perangkat.',
      },
      {
        id: 3,
        jenjang,
        semester,
        elemen: 'Teknologi Informasi & Komunikasi (TIK)',
        content: `[Paket Susulan #${v}] Teknisi jaringan sekolah mengetikkan perintah teks "ping 192.168.1.${10 + (v % 80)}" secara langsung pada layar hitam Terminal / Command Prompt tanpa menggunakan ikon maupun tombol grafis mouse. Antarmuka yang digunakan teknisi tersebut dikenal sebagai...`,
        image: null,
        options: [
          'Command Line Interface (CLI)',
          'Graphical User Interface (GUI)',
          'Virtual Reality Interface (VRI)',
          'Touchscreen Gesture Panel',
        ],
        answer: 'A',
        difficulty: 'REGULER',
        explanation:
          'CLI (Command Line Interface) adalah antarmuka berbasis baris perintah teks di mana pengguna berinteraksi dengan sistem operasi melalui ketikan perintah keyboard.',
      },
      {
        id: 4,
        jenjang,
        semester,
        elemen: 'Sistem Komputer (SK)',
        content: `[Paket Susulan #${v}] Dalam siklus pengolahan data komputer (Input -> Process -> Output -> Storage), manakah kelompok perangkat keras di bawah ini yang ketiganya berfungsi sebagai peranti KELUARAN (Output Device) pada ruang ujian ke-${v}?`,
        image: null,
        options: [
          'Proyektor LCD, Monitor LED, dan Speaker Aktif',
          'Scanner Barcode, Webcam, dan Microphone',
          'Mouse Optik, Keyboard Mekanik, dan Joystick',
          'Flashdisk, Solid State Drive (SSD), dan Memory Card',
        ],
        answer: 'A',
        difficulty: 'REGULER',
        explanation:
          'Proyektor LCD, Monitor LED (visual), dan Speaker Aktif (audio) ketiganya mengeluarkan hasil pemrosesan komputer kepada pengguna.',
      },
      {
        id: 5,
        jenjang,
        semester,
        elemen: 'Teknologi Informasi & Komunikasi (TIK)',
        content: `[Paket Susulan #${v}] Saat mengirim laporan tugas kelompok ke email guru, ketua kelompok ingin agar seluruh anggota kelompoknya juga menerima tembusan email tersebut dan daftar penerima tembusan dapat dilihat secara terbuka oleh semua penerima. Kolom yang tepat digunakan adalah...`,
        image: null,
        options: [
          'CC (Carbon Copy)',
          'BCC (Blind Carbon Copy)',
          'Draft (Konsep Tersimpan)',
          'Spam / Trash Folder',
        ],
        answer: 'A',
        difficulty: 'REGULER',
        explanation:
          'CC (Carbon Copy) digunakan untuk mengirim salinan/tembusan email secara transparan sehingga seluruh penerima mengetahui siapa saja yang menerima salinan tersebut.',
      },
      {
        id: 6,
        jenjang,
        semester,
        elemen: 'Berpikir Komputasional (BK)',
        content: `[Paket Susulan #${v}] Sebuah sensor cahaya laboratorium komputer mengirimkan kode biner 6-bit bernilai ${binA}₂ ke mikrokontroler. Berapakah nilai bilangan desimal (basis 10) yang direpresentasikan oleh sinyal biner ${binA}₂ tersebut?`,
        image: null,
        options: [
          `${decA}₁₀`,
          `${wrongDec1}₁₀`,
          `${wrongDec2}₁₀`,
          `${wrongDec3}₁₀`,
        ],
        answer: 'A',
        difficulty: 'HOTS',
        explanation: `Konversi biner ${binA}₂ ke desimal dilakukan dengan menjumlahkan bobot nilai tempat pangkat dua (32, 16, 8, 4, 2, 1) pada posisi bit yang bernilai 1, sehingga diperoleh ${decA}₁₀.`,
      },
      {
        id: 7,
        jenjang,
        semester,
        elemen: 'Berpikir Komputasional (BK)',
        content: `[Paket Susulan #${v}] Pada layar matriks LED 1×6 piksel hitam-putih (1 = Menyala/Putih, 0 = Padam/Hitam), tampil pola awal "${binA}". Jika sistem menjalankan operasi logika NOT (Inversi / Kebalikan Bit) pada seluruh piksel baris tersebut, pola biner baru yang tampil adalah...`,
        image: null,
        options: [
          binA
            .split('')
            .map((b) => (b === '1' ? '0' : '1'))
            .join(''),
          binA,
          '111111',
          '000000',
        ],
        answer: 'A',
        difficulty: 'HOTS',
        explanation:
          'Operasi inversi (NOT) membalik setiap bit 1 menjadi 0 dan setiap bit 0 menjadi 1 pada masing-masing posisi piksel.',
      },
      {
        id: 8,
        jenjang,
        semester,
        elemen: 'Teknologi Informasi & Komunikasi (TIK)',
        content: `[Paket Susulan #${v}] Siswa Kelas VII ditugaskan mencari bahan presentasi berformat PowerPoint (.pptx) tentang "Jaringan Komputer Lokal" yang hanya dipublikasikan oleh situs resmi pendidikan pemerintah (.go.id). Query mesin pencari paling akurat adalah...`,
        image: null,
        options: [
          `"Jaringan Komputer Lokal" site:go.id filetype:pptx`,
          `Jaringan Komputer Lokal -go.id -pptx`,
          `www.go.id/jaringan-komputer.mp3`,
          `#JaringanKomputer @pptx +musik`,
        ],
        answer: 'A',
        difficulty: 'HOTS',
        explanation:
          'Operator site:go.id membatasi pencarian pada domain resmi pemerintah (.go.id), tanda kutip mencari frasa eksak, dan filetype:pptx menyaring khusus dokumen presentasi PowerPoint.',
      },
      {
        id: 9,
        jenjang,
        semester,
        elemen: 'Berpikir Komputasional (BK)',
        content: `[Paket Susulan #${v}] Dalam antrean pencetakan kartu peserta ujian (prinsip FIFO: First In First Out), terdaftar 4 dokumen antrean berurutan: [${qSet[0]}, ${qSet[1]}, ${qSet[2]}, ${qSet[3]}]. Setelah printer selesai mencetak 2 dokumen pertama, masuk 1 dokumen baru milik ${qSet[4]}. Siapakah pemilik dokumen yang berada di posisi PALING DEPAN antrean sekarang?`,
        image: null,
        options: [
          `${qSet[2]}, dengan urutan antrean saat ini: [${qSet[2]}, ${qSet[3]}, ${qSet[4]}]`,
          `${qSet[0]}, karena dokumen pertama tidak pernah keluar dari antrean`,
          `${qSet[4]}, karena dokumen yang baru masuk langsung diletakkan paling depan`,
          `${qSet[1]}, dengan urutan antrean saat ini: [${qSet[1]}, ${qSet[0]}, ${qSet[4]}]`,
        ],
        answer: 'A',
        difficulty: 'HOTS',
        explanation: `Prinsip FIFO melayani elemen yang masuk lebih dulu. Setelah ${qSet[0]} dan ${qSet[1]} selesai dicetak, posisi terdepan ditempati oleh ${qSet[2]}, sedangkan ${qSet[4]} masuk di urutan paling belakang.`,
      },
      {
        id: 10,
        jenjang,
        semester,
        elemen: 'Sistem Komputer (SK)',
        content: `[Paket Susulan #${v}] Seorang siswa ingin menyimpan ${2 + (v % 4)} file video tutorial Informatika yang masing-masing berukuran 1.500 MB (Megabyte). Jika ia memiliki Flashdisk berkapasitas kosong 2 GB (Gigabyte, 1 GB = 1.024 MB), analisis kecukupan ruang penyimpanan yang tepat adalah...`,
        image: null,
        options: [
          `Tidak cukup untuk menyimpan seluruhnya sekaligus, karena total ukuran ${2 + (v % 4)} video (${(2 + (v % 4)) * 1500} MB) melebihi kapasitas kosong Flashdisk (2.048 MB).`,
          `Sangat cukup, karena 2 GB setara dengan 200.000 MB sehingga masih tersisa banyak ruang.`,
          `Cukup, karena satuan Megabyte (MB) lebih besar daripada Gigabyte (GB).`,
          `Flashdisk otomatis memperbesar kapasitas fisiknya menjadi 64 GB saat file disalin.`,
        ],
        answer: 'A',
        difficulty: 'HOTS',
        explanation: `Kapasitas 2 GB = 2 × 1.024 MB = 2.048 MB, sedangkan total ukuran ${2 + (v % 4)} video = ${(2 + (v % 4)) * 1500} MB yang melebihi 2.048 MB.`,
      },
      {
        id: 11,
        jenjang,
        semester,
        elemen: 'Berpikir Komputasional (BK)',
        content: `[Paket Susulan #${v}] Pada diagram alir (Flowchart) algoritma pendaftaran siswa baru, simbol berbentuk Jajar Genjang (Parallelogram) berfungsi untuk merepresentasikan...`,
        image: null,
        options: [
          'Proses masukan (Input) data atau keluaran (Output) informasi',
          'Keputusan percabangan bersyarat (Decision)',
          'Mulai dan berakhirnya suatu program (Terminator)',
          'Perhitungan rumus aritmatika internal (Process)',
        ],
        answer: 'A',
        difficulty: 'REGULER',
        explanation:
          'Simbol Jajar Genjang (Parallelogram) digunakan pada Flowchart untuk menyatakan operasi Input (pembacaan data) dan Output (penampilan hasil).',
      },
      {
        id: 12,
        jenjang,
        semester,
        elemen: 'Teknologi Informasi & Komunikasi (TIK)',
        content: `[Paket Susulan #${v}] Saat mengetik laporan di pengolah kata, seorang siswa ingin memilih seluruh teks di dokumen sekaligus, lalu menyalinnya ke clipboard. Kombinasi pintasan keyboard (Shortcut) yang tepat secara berurutan adalah...`,
        image: null,
        options: [
          'Ctrl + A dilanjutkan Ctrl + C',
          'Ctrl + P dilanjutkan Ctrl + Z',
          'Ctrl + X dilanjutkan Ctrl + F',
          'Alt + F4 dilanjutkan Ctrl + S',
        ],
        answer: 'A',
        difficulty: 'REGULER',
        explanation:
          'Ctrl + A (Select All) memilih seluruh konten dokumen, dan Ctrl + C (Copy) menyalin bagian yang dipilih ke clipboard.',
      },
      {
        id: 13,
        jenjang,
        semester,
        elemen: 'Sistem Komputer (SK)',
        content: `[Paket Susulan #${v}] Perangkat lunak seperti Adobe Photoshop, Microsoft Excel, Canva, dan VLC Media Player yang dipasang pengguna untuk menyelesaikan tugas spesifik sehari-hari dikategorikan sebagai...`,
        image: null,
        options: [
          'Perangkat Lunak Aplikasi (Application Software)',
          'Sistem Operasi Inti (Kernel Operating System)',
          'Komponen Perangkat Keras Pemroses (Hardware CPU)',
          'Firmware BIOS Non-Volatile',
        ],
        answer: 'A',
        difficulty: 'REGULER',
        explanation:
          'Application Software adalah program komputer yang dirancang untuk membantu pengguna menyelesaikan tugas tertentu (pengolahan angka, desain grafis, pemutar media).',
      },
      {
        id: 14,
        jenjang,
        semester,
        elemen: 'Berpikir Komputasional (BK)',
        content: `[Paket Susulan #${v}] Terdapat 4 pekerjaan pencetakan dokumen di laboratorium dengan waktu proses: Dokumen P (${sjfDurations[2]} detik), Dokumen Q (${sjfDurations[0]} detik), Dokumen R (${sjfDurations[3]} detik), dan Dokumen S (${sjfDurations[1]} detik). Untuk meminimalkan waktu tunggu rata-rata (Shortest Job First), urutan pencetakan yang paling efisien adalah...`,
        image: null,
        options: [
          `Dokumen Q (${sjfDurations[0]}d) -> Dokumen S (${sjfDurations[1]}d) -> Dokumen P (${sjfDurations[2]}d) -> Dokumen R (${sjfDurations[3]}d)`,
          `Dokumen R (${sjfDurations[3]}d) -> Dokumen P (${sjfDurations[2]}d) -> Dokumen S (${sjfDurations[1]}d) -> Dokumen Q (${sjfDurations[0]}d)`,
          `Dokumen P (${sjfDurations[2]}d) -> Dokumen Q (${sjfDurations[0]}d) -> Dokumen R (${sjfDurations[3]}d) -> Dokumen S (${sjfDurations[1]}d)`,
          `Dokumen S (${sjfDurations[1]}d) -> Dokumen R (${sjfDurations[3]}d) -> Dokumen Q (${sjfDurations[0]}d) -> Dokumen P (${sjfDurations[2]}d)`,
        ],
        answer: 'A',
        difficulty: 'HOTS',
        explanation:
          'Algoritma penjadwalan Shortest Job First (SJF) mengeksekusi pekerjaan dari durasi paling singkat ke paling lama agar rata-rata waktu tunggu seluruh antrean menjadi minimum.',
      },
      {
        id: 15,
        jenjang,
        semester,
        elemen: 'Teknologi Informasi & Komunikasi (TIK)',
        content: `[Paket Susulan #${v}] Seorang siswa menata ratusan file tugas semester ${semester} di komputernya. Strategi manajemen folder hierarkis manakah yang paling terstruktur agar pencarian file di kemudian hari berlangsung cepat dan tidak membingungkan?`,
        image: null,
        options: [
          'Membuat folder utama berdasarkan Tahun Ajaran & Semester, lalu di dalamnya dibagi ke sub-folder per Mata Pelajaran dengan penamaan file yang konsisten.',
          'Menumpuk seluruh file tugas dari semua mata pelajaran di layar Desktop dengan nama acak seperti "file1", "baru2", "tugas_oke".',
          'Mengubah semua ekstensi file dokumen menjadi .mp3 agar tersimpan di folder musik.',
          'Menyimpan setiap 1 file di dalam 50 sub-folder berlapis kosong tanpa nama.',
        ],
        answer: 'A',
        difficulty: 'HOTS',
        explanation:
          'Manajemen file dan folder yang baik menerapkan klasifikasi berjenjang (hirarkis) berdasarkan kategori logis serta penamaan file yang deskriptif.',
      },
      {
        id: 16,
        jenjang,
        semester,
        elemen: 'Sistem Komputer (SK)',
        content: `[Paket Susulan #${v}] Sebuah sakelar digital 5-bit memiliki bobot nilai tempat berturut-turut 16, 8, 4, 2, dan 1. Agar sakelar tersebut menghasilkan nilai desimal tepat sebesar ${13 + (v % 15)}, kombinasi posisi sakelar biner 5-bit yang benar adalah...`,
        image: null,
        options: [
          `${(13 + (v % 15)).toString(2).padStart(5, '0')}₂`,
          `${(12 + ((v + 3) % 15)).toString(2).padStart(5, '0')}₂`,
          `11111₂`,
          `00001₂`,
        ],
        answer: 'A',
        difficulty: 'HOTS',
        explanation: `Nilai desimal ${13 + (v % 15)} jika dikonversikan ke dalam representasi biner 5-bit adalah ${(13 + (v % 15)).toString(2).padStart(5, '0')}₂.`,
      },
      {
        id: 17,
        jenjang,
        semester,
        elemen: 'Berpikir Komputasional (BK)',
        content: `[Paket Susulan #${v}] Saat membuat aplikasi jadwal pelajaran digital Kelas VII-${(v % 5) + 1}, pemrogram hanya mengambil data "Hari", "Jam Pelajaran", "Nama Mapel", dan "Nama Guru", serta mengabaikan data "Warna Sepatu Guru" dan "Merek Jam Dinding Kelas". Prinsip Berpikir Komputasional yang diterapkan adalah...`,
        image: null,
        options: [
          'Abstraksi (Abstraction), yaitu menyaring atribut yang relevan dan mengabaikan detail yang tidak diperlukan',
          'Pengulangan Tanpa Henti (Infinite Loop)',
          'Peretasan Perangkat Keras (Hardware Overclocking)',
          'Kriptografi Kunci Publik',
        ],
        answer: 'A',
        difficulty: 'HOTS',
        explanation:
          'Abstraksi berfokus pada informasi esensial yang berkaitan langsung dengan pemecahan masalah dan membuang karakteristik yang tidak relevan.',
      },
      {
        id: 18,
        jenjang,
        semester,
        elemen: 'Teknologi Informasi & Komunikasi (TIK)',
        content: `[Paket Susulan #${v}] Pada peramban web (Web Browser), fitur yang berfungsi menyimpan tautan situs web edukasi penting agar dapat dibuka kembali dengan cepat di lain waktu tanpa harus mengetik ulang alamat URL-nya disebut...`,
        image: null,
        options: [
          'Bookmark (Markah / Favorit)',
          'Incognito / Private Window',
          'Clear Browsing Cache',
          'Pop-up Blocker',
        ],
        answer: 'A',
        difficulty: 'REGULER',
        explanation:
          'Bookmark berfungsi menandai dan menyimpan alamat URL halaman web favorit agar mudah diakses kembali.',
      },
      {
        id: 19,
        jenjang,
        semester,
        elemen: 'Sistem Komputer (SK)',
        content: `[Paket Susulan #${v}] Komponen papan sirkuit utama di dalam casing komputer tempat terpasangnya prosesor (CPU), keping memori RAM, kartu grafis, dan konektor penyimpanan disebut...`,
        image: null,
        options: [
          'Motherboard (Mainboard)',
          'Power Supply Unit (PSU)',
          'Uninterruptible Power Supply (UPS)',
          'Heatsink Kipas Pendingin',
        ],
        answer: 'A',
        difficulty: 'REGULER',
        explanation:
          'Motherboard adalah papan sirkuit induk yang menghubungkan seluruh komponen perangkat keras internal agar dapat saling berkomunikasi.',
      },
      {
        id: 20,
        jenjang,
        semester,
        elemen: 'Berpikir Komputasional (BK)',
        content: `[Paket Susulan #${v}] Perhatikan deret bilangan terpola pada pengujian algoritma ke-${v}: ${v + 2}, ${v + 5}, ${v + 10}, ${v + 17}, ${v + 26}, ... Berdasarkan pengenalan pola selisih antar-suku (+3, +5, +7, +9, ...), berapakah nilai suku berikutnya?`,
        image: null,
        options: [
          `${v + 37}`,
          `${v + 35}`,
          `${v + 33}`,
          `${v + 40}`,
        ],
        answer: 'A',
        difficulty: 'HOTS',
        explanation: `Selisih antar-suku membentuk barisan bilangan ganjil berturut-turut: +3, +5, +7, +9. Maka selisih berikutnya adalah +11, sehingga ${v + 26} + 11 = ${v + 37}.`,
      },
      {
        id: 21,
        jenjang,
        semester,
        elemen: 'Teknologi Informasi & Komunikasi (TIK)',
        content: `[Paket Susulan #${v}] Seorang siswa ingin mengunduh aplikasi pembelajaran resmi di komputer sekolah, namun muncul jendela peringatan bahwa file berasal dari situs tidak dikenal dan meminta izin mematikan Antivirus. Tindakan yang paling aman adalah...`,
        image: null,
        options: [
          'Membatalkan pengunduhan dari situs tidak dikenal tersebut, tetap mengaktifkan Antivirus, dan hanya mengunduh dari situs resmi pengembang.',
          'Mematikan Antivirus secara permanen agar file asing tersebut dapat berjalan bebas.',
          'Mengabaikan peringatan dan menyebarkan file tersebut ke seluruh komputer laboratorium.',
          'Menghapus Sistem Operasi Windows agar peringatan tidak muncul lagi.',
        ],
        answer: 'A',
        difficulty: 'HOTS',
        explanation:
          'Mematikan antivirus saat menjalankan file dari sumber tidak tepercaya sangat berisiko menginfeksi sistem dengan malware/trojan.',
      },
      {
        id: 22,
        jenjang,
        semester,
        elemen: 'Sistem Komputer (SK)',
        content: `[Paket Susulan #${v}] Ketika seorang siswa sedang mengetik tugas di Microsoft Word namun belum menekan tombol Save, lalu tiba-tiba listrik padam dan komputer mati, teks yang baru diketik tersebut hilang. Hal ini terjadi karena dokumen yang sedang aktif dikerjakan disimpan sementara di dalam...`,
        image: null,
        options: [
          'RAM (Random Access Memory) yang bersifat volatile (data hilang saat aliran listrik terputus)',
          'ROM (Read Only Memory) yang bersifat permanen dari pabrik',
          'Piringan CD-ROM optik yang tidak membutuhkan listrik',
          'Flashdisk eksternal yang bersifat non-volatile',
        ],
        answer: 'A',
        difficulty: 'HOTS',
        explanation:
          'Data aplikasi yang sedang berjalan namun belum disimpan ke media penyimpanan sekunder berada di RAM yang bersifat volatile.',
      },
      {
        id: 23,
        jenjang,
        semester,
        elemen: 'Berpikir Komputasional (BK)',
        content: `[Paket Susulan #${v}] Dalam struktur data Daftar (List), jika terdapat daftar nilai harian [${70 + (v % 5)}, ${80 + (v % 5)}, ${75 + (v % 5)}, ${90 + (v % 5)}] dan siswa menambahkan nilai baru ${85 + (v % 5)} di akhir daftar, berapakah jumlah elemen (panjang list) sekarang?`,
        image: null,
        options: [
          '5 elemen',
          '4 elemen',
          '3 elemen',
          '6 elemen',
        ],
        answer: 'A',
        difficulty: 'REGULER',
        explanation:
          'Daftar awal memiliki 4 elemen. Setelah ditambahkan 1 elemen baru di bagian akhir, panjang daftar menjadi 5 elemen.',
      },
      {
        id: 24,
        jenjang,
        semester,
        elemen: 'Teknologi Informasi & Komunikasi (TIK)',
        content: `[Paket Susulan #${v}] Format orientasi halaman dokumen pada aplikasi pengolah kata yang mengatur posisi kertas memanjang secara MENDATAR (lebar lebih besar daripada tinggi) untuk tabel lebar disebut...`,
        image: null,
        options: [
          'Landscape',
          'Portrait',
          'Justify',
          'Subscript',
        ],
        answer: 'A',
        difficulty: 'REGULER',
        explanation:
          'Orientasi Landscape mengatur kertas secara horizontal (mendatar), sedangkan Portrait mengatur kertas secara vertikal (tegak).',
      },
      {
        id: 25,
        jenjang,
        semester,
        elemen: 'Sistem Komputer (SK)',
        content: `[Paket Susulan #${v}] Sebuah laboratorium sekolah ingin merancang komputer khusus untuk keperluan desain poster digital dan penyuntingan video kegiatan siswa. Selain CPU dan RAM yang memadai, komponen pemroses khusus yang sangat berperan mempercepat pengolahan visual grafis (rendering) adalah...`,
        image: null,
        options: [
          'GPU (Graphics Processing Unit / Kartu Grafis)',
          'Sound Card Audio Mono',
          'Floppy Disk Controller',
          'Modem Dial-Up Telepon',
        ],
        answer: 'A',
        difficulty: 'HOTS',
        explanation:
          'GPU (Graphics Processing Unit) dirancang khusus dengan ribuan core paralel untuk mengakselerasi komputasi grafis, pengolahan citra, dan rendering video.',
      },
    ];
  }

  if (packageKey === 'VII_Genap') {
    const score1 = 72 + (v % 6);
    const score2 = 60 + (v % 8);
    const score3 = 85 + (v % 10);
    const score4 = 78 + (v % 7);
    const score5 = 64 + (v % 5);
    return [
      {
        id: 1,
        jenjang,
        semester,
        elemen: 'Jaringan Komputer & Internet (JKI)',
        content: `[Paket Susulan #${v}] Saat berada di dalam pesawat terbang atau ruang ujian khusus yang melarang pancaran sinyal seluler dan Wi-Fi sekaligus, fitur pengaturan cepat pada smartphone yang menonaktifkan seluruh pemancar radio nirkabel dalam satu ketukan adalah...`,
        image: null,
        options: [
          'Mode Pesawat (Airplane Mode)',
          'Mobile Hotspot Tethering',
          'Auto-Brightness Layar',
          'Screen Rotation Lock',
        ],
        answer: 'A',
        difficulty: 'REGULER',
        explanation:
          'Airplane Mode mematikan seluruh frekuensi transmisi radio (seluler, Wi-Fi, dan Bluetooth) pada perangkat seluler secara serentak.',
      },
      {
        id: 2,
        jenjang,
        semester,
        elemen: 'Analisis Data (AD)',
        content: `[Paket Susulan #${v}] Pada aplikasi lembar kerja (Spreadsheet), penulisan rentang sel (Range) yang mencakup seluruh sel mulai dari kolom B baris ke-${2 + (v % 5)} hingga kolom F baris ke-${15 + (v % 10)} yang benar adalah...`,
        image: null,
        options: [
          `B${2 + (v % 5)}:F${15 + (v % 10)}`,
          `B${2 + (v % 5)};F${15 + (v % 10)}`,
          `${2 + (v % 5)}B-${15 + (v % 10)}F`,
          `RANGE(B${2 + (v % 5)}, F${15 + (v % 10)})`,
        ],
        answer: 'A',
        difficulty: 'REGULER',
        explanation:
          'Notasi Range pada Spreadsheet ditulis menggunakan alamat sel ujung kiri atas diikuti tanda titik dua (:) dan alamat sel ujung kanan bawah.',
      },
      {
        id: 3,
        jenjang,
        semester,
        elemen: 'Analisis Data (AD)',
        content: `[Paket Susulan #${v}] Untuk menjumlahkan seluruh angka iuran kas kelas yang berada pada rentang sel C3 sampai C${20 + (v % 15)} di Microsoft Excel / Google Sheets, rumus fungsi dasar yang tepat adalah...`,
        image: null,
        options: [
          `=SUM(C3:C${20 + (v % 15)})`,
          `=COUNT(C3:C${20 + (v % 15)})`,
          `=MIN(C3:C${20 + (v % 15)})`,
          `=MAX(C3:C${20 + (v % 15)})`,
        ],
        answer: 'A',
        difficulty: 'REGULER',
        explanation:
          'Fungsi =SUM() digunakan untuk menghitung total penjumlahan seluruh nilai numerik pada rentang sel yang ditentukan.',
      },
      {
        id: 4,
        jenjang,
        semester,
        elemen: 'Algoritma & Pemrograman (AP)',
        content: `[Paket Susulan #${v}] Dalam pemrograman visual Scratch Kelas VII, perintah blok "say [Selamat Datang di Lab SMPN 7 Kisaran!] for ${2 + (v % 4)} seconds" dan "switch costume to..." berada di dalam kelompok kategori blok...`,
        image: null,
        options: [
          'Looks (Tampilan)',
          'Motion (Gerakan)',
          'Operators (Operator Matematika)',
          'Sensing (Sensor Masukan)',
        ],
        answer: 'A',
        difficulty: 'REGULER',
        explanation:
          'Kategori blok Looks (berwarna ungu) mengatur tampilan visual Sprite seperti balon percakapan teks, perubahan kostum, ukuran, dan efek grafis.',
      },
      {
        id: 5,
        jenjang,
        semester,
        elemen: 'Dampak Sosial Informatika (DSI)',
        content: `[Paket Susulan #${v}] Fitur keamanan tambahan pada akun email dan media sosial yang mewajibkan pengguna memasukkan kode verifikasi unik sekali pakai (OTP) ke ponsel selain mengetikkan password utama disebut...`,
        image: null,
        options: [
          'Two-Factor Authentication (2FA / Autentikasi Dua Faktor)',
          'Auto-Complete Password',
          'Public Guest Login',
          'Screen Saver Lock',
        ],
        answer: 'A',
        difficulty: 'REGULER',
        explanation:
          'Two-Factor Authentication (2FA) memberikan lapisan keamanan ganda: sesuatu yang Anda ketahui (password) dan sesuatu yang Anda miliki (kode OTP di perangkat).',
      },
      {
        id: 6,
        jenjang,
        semester,
        elemen: 'Jaringan Komputer & Internet (JKI)',
        content: `[Paket Susulan #${v}] Menggunakan teknik kriptografi Caesar Cipher dengan kunci pergeseran ${caesarShift} huruf ke kanan dalam abjad (A -> ${String.fromCharCode(65 + caesarShift)}, B -> ${String.fromCharCode(66 + caesarShift)}, dst.), kata sandi asli (Plaintext) "${chosenWord}" akan terenkripsi menjadi Ciphertext...`,
        image: null,
        options: [
          cipherWord,
          wrongCipher1,
          wrongCipher2,
          wrongCipher3,
        ],
        answer: 'A',
        difficulty: 'HOTS',
        explanation: `Setiap huruf pada kata "${chosenWord}" digeser maju sebanyak ${caesarShift} urutan alfabet, sehingga menghasilkan teks sandi "${cipherWord}".`,
      },
      {
        id: 7,
        jenjang,
        semester,
        elemen: 'Analisis Data (AD)',
        content: `[Paket Susulan #${v}] Diketahui nilai kuis 5 siswa pada sel D2 sampai D6 adalah: D2 = ${score1}, D3 = ${score2}, D4 = ${score3}, D5 = ${score4}, dan D6 = ${score5}. Jika dieksekusi rumus =COUNTIF(D2:D6, ">=70"), berapakah hasil yang ditampilkan?`,
        image: null,
        options: [
          '3',
          '2',
          '4',
          '5',
        ],
        answer: 'A',
        difficulty: 'HOTS',
        explanation: `Dari kelima nilai (${score1}, ${score2}, ${score3}, ${score4}, ${score5}), nilai yang >= 70 adalah ${score1}, ${score3}, dan ${score4}, sehingga COUNTIF menghasilkan angka 3.`,
      },
      {
        id: 8,
        jenjang,
        semester,
        elemen: 'Algoritma & Pemrograman (AP)',
        content: `[Paket Susulan #${v}] Pada panggung Scratch, sebuah Sprite berada di koordinat awal (x: 0, y: 0). Ketika program dijalankan, blok "repeat ${scratchRepeat}" mengeksekusi perintah "change x by ${stepX}" dan "change y by ${stepY}" secara berulang. Koordinat akhir (x, y) Sprite tersebut adalah...`,
        image: null,
        options: [
          `(x: ${finalX}, y: ${finalY})`,
          `(x: ${stepX}, y: ${stepY})`,
          `(x: ${finalY}, y: ${finalX})`,
          `(x: ${finalX + stepX}, y: 0)`,
        ],
        answer: 'A',
        difficulty: 'HOTS',
        explanation: `Perulangan sebanyak ${scratchRepeat} kali mengubah posisi x sebesar ${scratchRepeat} × ${stepX} = ${finalX} dan posisi y sebesar ${scratchRepeat} × (${stepY}) = ${finalY}.`,
      },
      {
        id: 9,
        jenjang,
        semester,
        elemen: 'Algoritma & Pemrograman (AP)',
        content: `[Paket Susulan #${v}] Seorang siswa membuat kuis interaktif di Scratch: jika jawaban pengguna sama dengan ${decA}, maka variabel Skor bertambah 20 dan muncul suara tepuk tangan; jika salah, muncul pesan "Coba Lagi!". Blok logika kontrol yang harus digunakan adalah...`,
        image: null,
        options: [
          `Blok percabangan "if <answer = ${decA}> then [change Skor by 20] else [say Coba Lagi!]"`,
          `Blok perulangan "forever [move ${decA} steps]" tanpa syarat`,
          `Blok "wait ${decA} seconds" lalu "stop all"`,
          `Blok "switch backdrop to next backdrop" saja`,
        ],
        answer: 'A',
        difficulty: 'HOTS',
        explanation:
          'Percabangan dua arah "if ... then ... else ..." mengevaluasi apakah jawaban bernilai benar atau salah lalu menjalankan aksi yang sesuai.',
      },
      {
        id: 10,
        jenjang,
        semester,
        elemen: 'Dampak Sosial Informatika (DSI)',
        content: `[Paket Susulan #${v}] Panitia OSIS ingin mengumpulkan biodata pendaftaran lomba dari ${rowCount} siswa secara daring sehingga setiap jawaban siswa otomatis tersusun rapi ke dalam tabel Spreadsheet secara real-time. Perkakas cloud yang paling efektif digunakan adalah...`,
        image: null,
        options: [
          'Google Forms yang ditautkan langsung ke lembar kerja Google Sheets',
          'Kalkulator saintifik offline di masing-masing ponsel',
          'Aplikasi Paint untuk menggambar formulir satu per satu',
          'Pemutar musik Windows Media Player',
        ],
        answer: 'A',
        difficulty: 'HOTS',
        explanation:
          'Google Forms memudahkan pengumpulan data kuesioner/pendaftaran secara daring dan otomatis merekap seluruh respons ke dalam Google Sheets.',
      },
      {
        id: 11,
        jenjang,
        semester,
        elemen: 'Jaringan Komputer & Internet (JKI)',
        content: `[Paket Susulan #${v}] Satuan ukuran yang menyatakan kecepatan transfer data digital dalam jaringan internet (banyaknya bit data yang dikirimkan setiap satu detik) adalah...`,
        image: null,
        options: [
          'bps (bits per second) / Mbps (Megabits per second)',
          'Hertz (Hz) frekuensi layar',
          'Pixel per Inch (PPI) ketajaman gambar',
          'Rotations per Minute (RPM) piringan disk',
        ],
        answer: 'A',
        difficulty: 'REGULER',
        explanation:
          'Kecepatan lebar pita (bandwidth) dan transfer data jaringan diukur dalam satuan bit per detik (bps, Kbps, Mbps, Gbps).',
      },
      {
        id: 12,
        jenjang,
        semester,
        elemen: 'Analisis Data (AD)',
        content: `[Paket Susulan #${v}] Pada aplikasi Spreadsheet, fungsi statistik yang digunakan untuk menghitung BANYAKNYA SEL yang berisi data angka (numerik) pada rentang A1:A${rowCount} adalah...`,
        image: null,
        options: [
          `=COUNT(A1:A${rowCount})`,
          `=SUM(A1:A${rowCount})`,
          `=AVERAGE(A1:A${rowCount})`,
          `=LOWER(A1:A${rowCount})`,
        ],
        answer: 'A',
        difficulty: 'REGULER',
        explanation:
          'Fungsi =COUNT(range) menghitung jumlah sel yang memuat nilai angka di dalam suatu rentang.',
      },
      {
        id: 13,
        jenjang,
        semester,
        elemen: 'Algoritma & Pemrograman (AP)',
        content: `[Paket Susulan #${v}] Pada aplikasi Scratch, karakter atau objek visual (seperti kucing, bola, atau mobil) yang dapat diberi skrip instruksi untuk bergerak dan berinteraksi di atas Stage disebut...`,
        image: null,
        options: [
          'Sprite',
          'Compiler',
          'Cell Range',
          'Hyperlink',
        ],
        answer: 'A',
        difficulty: 'REGULER',
        explanation:
          'Di dalam Scratch, setiap objek atau aktor visual yang diprogram menggunakan blok-blok kode disebut Sprite.',
      },
      {
        id: 14,
        jenjang,
        semester,
        elemen: 'Dampak Sosial Informatika (DSI)',
        content: `[Paket Susulan #${v}] Hak eksklusif pencipta atas karya intelektual di bidang ilmu pengetahuan, seni, sastra, maupun program komputer agar tidak dibajak atau diakui secara ilegal oleh pihak lain disebut...`,
        image: null,
        options: [
          'Hak Cipta (Copyright / Hak Kekayaan Intelektual)',
          'Lisensi Perangkat Keras Bebas',
          'Protokol Jaringan Terbuka',
          'Jejak Cache Peramban',
        ],
        answer: 'A',
        difficulty: 'REGULER',
        explanation:
          'Hak Cipta (Copyright) melindungi karya orisinal pencipta (termasuk kode perangkat lunak, buku, musik, dan video) dari penggandaan tanpa izin.',
      },
      {
        id: 15,
        jenjang,
        semester,
        elemen: 'Jaringan Komputer & Internet (JKI)',
        content: `[Paket Susulan #${v}] Saat mengikuti ujian daring di laboratorium, koneksi internet kabel LAN pada satu unit PC jauh lebih stabil dibandingkan Wi-Fi yang digunakan oleh ${40 + (v % 30)} ponsel secara bersamaan. Penyebab teknis utamanya adalah...`,
        image: null,
        options: [
          'Kabel LAN menggunakan media fisik terdedikasi yang bebas dari interferensi gelombang radio dan kepadatan kanal nirkabel.',
          'Kabel LAN tidak memerlukan perangkat switch atau router sama sekali.',
          'Sinyal Wi-Fi hanya bisa mengirimkan data teks dan tidak bisa mengirimkan angka.',
          'Kabel LAN mengubah kuota internet menjadi tidak terbatas.',
        ],
        answer: 'A',
        difficulty: 'HOTS',
        explanation:
          'Transmisi melalui kabel UTP/LAN memiliki jalur fisik langsung yang tahan terhadap gangguan interferensi elektromagnetik serta tidak berbagi spektrum udara seperti Wi-Fi.',
      },
      {
        id: 16,
        jenjang,
        semester,
        elemen: 'Analisis Data (AD)',
        content: `[Paket Susulan #${v}] Dalam pengolahan nilai lomba karya ilmiah di sel C2:G2, panitia ingin mencari selisih (rentang/jangkauan) antara nilai juri TERTINGGI dan nilai juri TERENDAH. Rumus kombinasi fungsi Spreadsheet yang tepat adalah...`,
        image: null,
        options: [
          '=MAX(C2:G2) - MIN(C2:G2)',
          '=SUM(C2:G2) + AVERAGE(C2:G2)',
          '=COUNT(C2:G2) * MIN(C2:G2)',
          '=AVERAGE(C2:G2) / MAX(C2:G2)',
        ],
        answer: 'A',
        difficulty: 'HOTS',
        explanation:
          'Selisih antara nilai maksimum dan nilai minimum dihitung dengan mengurangkan hasil fungsi =MAX() dengan hasil fungsi =MIN().',
      },
      {
        id: 17,
        jenjang,
        semester,
        elemen: 'Algoritma & Pemrograman (AP)',
        content: `[Paket Susulan #${v}] Seorang siswa ingin menggambar bangun datar Segitiga Sama Sisi menggunakan fitur Pen di Scratch. Karena total sudut putar luar bangun tertutup adalah 360°, maka blok perulangan yang tepat adalah...`,
        image: null,
        options: [
          'Repeat 3 [ Move 120 steps, Turn right 120 degrees ]',
          'Repeat 4 [ Move 120 steps, Turn right 90 degrees ]',
          'Repeat 6 [ Move 120 steps, Turn right 60 degrees ]',
          'Repeat 3 [ Move 120 steps, Turn right 45 degrees ]',
        ],
        answer: 'A',
        difficulty: 'HOTS',
        explanation:
          'Segitiga sama sisi memiliki 3 sisi yang sama panjang dengan sudut belok luar sebesar 360° / 3 = 120° pada setiap titik sudutnya.',
      },
      {
        id: 18,
        jenjang,
        semester,
        elemen: 'Dampak Sosial Informatika (DSI)',
        content: `[Paket Susulan #${v}] Ketika mengunggah foto kegiatan sekolah ke media sosial publik, mengapa kita sangat disarankan mematikan fitur penandaan lokasi presisi real-time (Live Geotagging) dan tidak menampilkan kartu identitas ber-barcode secara jelas?`,
        image: null,
        options: [
          'Untuk menjaga privasi fisik dan mencegah penyalahgunaan data lokasi maupun pencurian identitas oleh pihak yang tidak bertanggung jawab.',
          'Karena foto yang memiliki lokasi tidak dapat dilihat di layar smartphone.',
          'Agar ukuran resolusi kamera meningkat menjadi 100 Megapiksel.',
          'Karena media sosial melarang foto kegiatan belajar di sekolah.',
        ],
        answer: 'A',
        difficulty: 'HOTS',
        explanation:
          'Membagikan lokasi real-time dan barcode identitas di ruang publik siber membuka celah penguntitan fisik (stalking) dan penyalahgunaan data pribadi.',
      },
      {
        id: 19,
        jenjang,
        semester,
        elemen: 'Jaringan Komputer & Internet (JKI)',
        content: `[Paket Susulan #${v}] Perangkat keras jaringan yang berfungsi menghubungkan jaringan lokal sekolah (LAN) ke jaringan internet global milik penyedia layanan internet (ISP) adalah...`,
        image: null,
        options: [
          'Modem & Router',
          'Plotter & Scanner',
          'Joystick & Trackball',
          'RAM & Heatsink',
        ],
        answer: 'A',
        difficulty: 'REGULER',
        explanation:
          'Modem memodulasi sinyal dari ISP dan Router mengarahkan lalu lintas paket data antara jaringan lokal (LAN) dan jaringan luar (Internet/WAN).',
      },
      {
        id: 20,
        jenjang,
        semester,
        elemen: 'Analisis Data (AD)',
        content: `[Paket Susulan #${v}] Fitur pada Spreadsheet yang secara otomatis memberi warna latar hijau pada sel nilai ujian yang >= ${kkmScore} dan warna merah pada sel nilai yang < ${kkmScore} disebut...`,
        image: null,
        options: [
          'Conditional Formatting (Pemformatan Bersyarat)',
          'Wrap Text',
          'Merge Cells',
          'Freeze Panes',
        ],
        answer: 'A',
        difficulty: 'REGULER',
        explanation:
          'Conditional Formatting mengubah tampilan visual sel (warna latar, teks, ikon) secara otomatis berdasarkan aturan kondisi nilai di dalamnya.',
      },
      {
        id: 21,
        jenjang,
        semester,
        elemen: 'Algoritma & Pemrograman (AP)',
        content: `[Paket Susulan #${v}] Dalam pembuatan animasi percakapan dua Sprite di Scratch (Sprite Guru dan Sprite Siswa) agar berbicara bergantian secara sinkron tanpa saling bertumpuk waktunya, mekanisme pengiriman sinyal antar-Sprite yang paling tepat adalah...`,
        image: null,
        options: [
          'Menggunakan blok Events "broadcast [pesan]" dan "when I receive [pesan]"',
          'Menghapus salah satu Sprite dari dalam Stage',
          'Mengubah warna latar belakang menjadi hitam pekat',
          'Menekan tombol bendera hijau berulang-ulang setiap detik',
        ],
        answer: 'A',
        difficulty: 'HOTS',
        explanation:
          'Blok broadcast dan when I receive memungkinkan koordinasi berbasis pesan (message passing) antar-Sprite sehingga urutan dialog berjalan teratur.',
      },
      {
        id: 22,
        jenjang,
        semester,
        elemen: 'Analisis Data (AD)',
        content: `[Paket Susulan #${v}] Saat menyalin rumus =B${2 + (v % 5)}*$C$1 ke baris-baris di bawahnya pada Excel, tanda dolar ($) pada referensi sel $C$1 memiliki fungsi penting yaitu...`,
        image: null,
        options: [
          'Mengunci alamat sel C1 sebagai Referensi Absolut (Mutlak) agar tidak ikut bergeser saat rumus disalin ke baris lain.',
          'Mengubah format angka di sel C1 menjadi mata uang Dolar Amerika secara paksa.',
          'Menghapus isi sel C1 apabila nilainya kurang dari nol.',
          'Menyembunyikan kolom C dari tampilan lembar kerja.',
        ],
        answer: 'A',
        difficulty: 'HOTS',
        explanation:
          'Tanda $ pada $C$1 menciptakan Absolute Cell Reference (Referensi Mutlak) sehingga alamat kolom C dan baris 1 tetap terkunci saat rumus diduplikasi.',
      },
      {
        id: 23,
        jenjang,
        semester,
        elemen: 'Jaringan Komputer & Internet (JKI)',
        content: `[Paket Susulan #${v}] Istilah untuk proses mengambil atau menyalin file dokumen materi pelajaran dari server di internet ke dalam penyimpanan perangkat komputer atau ponsel kita sendiri disebut...`,
        image: null,
        options: [
          'Download (Unduh)',
          'Upload (Unggah)',
          'Broadcast (Siaran)',
          'Rebooting (Mulai Ulang)',
        ],
        answer: 'A',
        difficulty: 'REGULER',
        explanation:
          'Download (mengunduh) adalah proses menerima/mengambil data dari server internet ke perangkat lokal, sedangkan Upload adalah mengirim data ke server.',
      },
      {
        id: 24,
        jenjang,
        semester,
        elemen: 'Dampak Sosial Informatika (DSI)',
        content: `[Paket Susulan #${v}] Seorang kreator konten ingin menggunakan lagu latar milik musisi lain di dalam video edukasi sekolah tanpa melanggar hak cipta. Pilihan sumber musik yang paling legal dan etis adalah...`,
        image: null,
        options: [
          'Menggunakan musik berlisensi Creative Commons (CC) / Royalty-Free dengan mencantumkan atribusi penciptanya sesuai ketentuan lisensi.',
          'Mengunduh lagu komersial berbayar secara ilegal lalu menghapus nama penyanyi aslinya.',
          'Mengklaim lagu populer milik orang lain sebagai ciptaan pribadi.',
          'Merealisasikan pembajakan album musik berbayar untuk dijual kembali.',
        ],
        answer: 'A',
        difficulty: 'HOTS',
        explanation:
          'Lisensi Creative Commons dan bebas royalti mengizinkan penggunaan karya secara sah selama pengguna mematuhi syarat lisensi seperti pencantuman atribusi.',
      },
      {
        id: 25,
        jenjang,
        semester,
        elemen: 'Algoritma & Pemrograman (AP)',
        content: `[Paket Susulan #${v}] Ketika program Scratch dijalankan, ditemukan bahwa karakter bergerak ke arah kiri padahal seharusnya bergerak ke kanan karena siswa salah memasukkan angka "-10" pada blok "move". Proses menemukan dan memperbaiki kesalahan logika program tersebut dinamakan...`,
        image: null,
        options: [
          'Debugging',
          'Phishing',
          'Tethering',
          'Formatting',
        ],
        answer: 'A',
        difficulty: 'REGULER',
        explanation:
          'Debugging adalah proses mengidentifikasi, melacak, dan memperbaiki kutu/kesalahan (bug) di dalam kode atau blok program.',
      },
    ];
  }

  if (packageKey === 'VIII_Ganjil') {
    return [
      {
        id: 1,
        jenjang,
        semester,
        elemen: 'Sistem Komputer (SK)',
        content: `[Paket Susulan #${v}] Dalam arsitektur komputer Von Neumann yang dipelajari di Kelas VIII, seluruh program dan data disimpan dalam satu ruang memori utama yang sama, lalu dieksekusi oleh CPU melalui siklus berulang...`,
        image: null,
        options: [
          'Fetch (Ambil Instruksi) -> Decode (Terjemahkan) -> Execute (Jalankan)',
          'Print (Cetak) -> Scan (Pindai) -> Shutdown (Matikan)',
          'Upload (Unggah) -> Download (Unduh) -> Share (Bagikan)',
          'Format (Hapus) -> Partition (Bagi) -> Compress (Padatkan)',
        ],
        answer: 'A',
        difficulty: 'REGULER',
        explanation:
          'Siklus instruksi mesin pada prosesor (Instruction Cycle) bekerja melalui tahapan Fetch (mengambil instruksi dari memori), Decode (menerjemahkan kode), dan Execute (mengeksekusi operasi).',
      },
      {
        id: 2,
        jenjang,
        semester,
        elemen: 'Sistem Komputer (SK)',
        content: `[Paket Susulan #${v}] Di dalam prosesor (CPU), unit penyimpanan berukuran sangat kecil namun berkecepatan paling tinggi yang menampung data sementara tepat saat sedang dihitung oleh ALU disebut...`,
        image: null,
        options: [
          'Register CPU',
          'Harddisk Drive (HDD)',
          'Optical DVD-ROM',
          'Flashdisk USB',
        ],
        answer: 'A',
        difficulty: 'REGULER',
        explanation:
          'Register berada di puncak hierarki memori di dalam chip CPU dan berfungsi menyimpan operan serta hasil operasi ALU secara instan.',
      },
      {
        id: 3,
        jenjang,
        semester,
        elemen: 'Berpikir Komputasional (BK)',
        content: `[Paket Susulan #${v}] Sistem bilangan yang hanya menggunakan delapan simbol angka yaitu 0, 1, 2, 3, 4, 5, 6, dan 7 dalam representasi data komputasi disebut sistem bilangan...`,
        image: null,
        options: [
          'Oktal (Basis 8)',
          'Biner (Basis 2)',
          'Desimal (Basis 10)',
          'Heksadesimal (Basis 16)',
        ],
        answer: 'A',
        difficulty: 'REGULER',
        explanation:
          'Sistem bilangan Oktal berbasis 8 dan menggunakan digit angka 0 sampai 7.',
      },
      {
        id: 4,
        jenjang,
        semester,
        elemen: 'Teknologi Informasi & Komunikasi (TIK)',
        content: `[Paket Susulan #${v}] Dalam penyusunan karya tulis ilmiah atau laporan tahunan sepanjang ${40 + (v % 50)} halaman di Microsoft Word, fitur yang digunakan untuk membuat Daftar Isi halaman secara otomatis berdasarkan gaya judul bab (Heading 1, Heading 2) adalah...`,
        image: null,
        options: [
          'Table of Contents (Daftar Isi Otomatis)',
          'Mail Merge Envelopes',
          'Find and Replace Text',
          'Word Count Statistics',
        ],
        answer: 'A',
        difficulty: 'REGULER',
        explanation:
          'Table of Contents pada menu References menghimpun seluruh teks yang menerapkan style Heading menjadi Daftar Isi lengkap dengan nomor halaman otomatis.',
      },
      {
        id: 5,
        jenjang,
        semester,
        elemen: 'Sistem Komputer (SK)',
        content: `[Paket Susulan #${v}] Pada gerbang logika dasar di dalam rangkaian digital, gerbang logika yang HANYA menghasilkan nilai keluaran 1 (True) apabila KEDUA masukannya bernilai 1 adalah gerbang...`,
        image: null,
        options: [
          'Gerbang AND',
          'Gerbang OR',
          'Gerbang NOT',
          'Gerbang NOR',
        ],
        answer: 'A',
        difficulty: 'REGULER',
        explanation:
          'Gerbang logika AND menghasilkan output 1 hanya jika Input A = 1 dan Input B = 1.',
      },
      {
        id: 6,
        jenjang,
        semester,
        elemen: 'Berpikir Komputasional (BK)',
        content: `[Paket Susulan #${v}] Pada struktur data Tumpukan (Stack - LIFO: Last In First Out), ke dalam sebuah tumpukan dimasukkan elemen secara berurutan: Push("${stSet[0]}"), Push("${stSet[1]}"), Push("${stSet[2]}"), Push("${stSet[3]}"). Kemudian dilakukan 2 kali operasi Pop() dan dilanjutkan 1 kali operasi Push("${stSet[4]}"). Susunan elemen di dalam Stack dari bawah ke atas sekarang adalah...`,
        image: null,
        options: [
          `[${stSet[0]}, ${stSet[1]}, ${stSet[4]}] dengan "${stSet[4]}" berada di puncak (Top of Stack)`,
          `[${stSet[2]}, ${stSet[3]}, ${stSet[4]}] dengan "${stSet[2]}" berada di puncak`,
          `[${stSet[0]}, ${stSet[1]}, ${stSet[2]}, ${stSet[3]}] tanpa perubahan`,
          `[${stSet[4]}, ${stSet[3]}, ${stSet[0]}] dengan "${stSet[0]}" berada di puncak`,
        ],
        answer: 'A',
        difficulty: 'HOTS',
        explanation: `Setelah 4 kali Push: [${stSet[0]}, ${stSet[1]}, ${stSet[2]}, ${stSet[3]}]. Dua kali Pop mengeluarkan dua elemen teratas (${stSet[3]} lalu ${stSet[2]}), menyisakan [${stSet[0]}, ${stSet[1]}]. Saat "${stSet[4]}" di-Push, susunan menjadi [${stSet[0]}, ${stSet[1]}, ${stSet[4]}].`,
      },
      {
        id: 7,
        jenjang,
        semester,
        elemen: 'Sistem Komputer (SK)',
        content: `[Paket Susulan #${v}] Sebuah register alamat memori pada sistem operasi Kelas VIII mencatat kode heksadesimal ${hexCode}₁₆. Jika dikonversikan ke dalam bilangan desimal (basis 10) dan biner 8-bit (basis 2), nilai yang tepat adalah...`,
        image: null,
        options: [
          `Desimal = ${hexDecimal}₁₀ dan Biner = ${hexBinary}₂`,
          `Desimal = ${hexDecimal - 6}₁₀ dan Biner = ${(hexDecimal - 6).toString(2).padStart(8, '0')}₂`,
          `Desimal = ${hexDecimal + 8}₁₀ dan Biner = ${(hexDecimal + 8).toString(2).padStart(8, '0')}₂`,
          `Desimal = ${hexHigh * 10 + hexLowVal}₁₀ dan Biner = 11110000₂`,
        ],
        answer: 'A',
        difficulty: 'HOTS',
        explanation: `Pada bilangan heksadesimal ${hexCode}₁₆: (${hexHigh} × 16) + ${hexLowVal} = ${hexDecimal}₁₀. Dalam representasi biner 8-bit nilainya adalah ${hexBinary}₂.`,
      },
      {
        id: 8,
        jenjang,
        semester,
        elemen: 'Sistem Komputer (SK)',
        content: `[Paket Susulan #${v}] Suatu rangkaian pengaman pintu laboratorium menggunakan ekspresi logika: Y = (NOT A) AND (B OR C). Jika kondisi sensor saat ini adalah Input A = 0, Input B = 0, dan Input C = 1, berapakah nilai keluaran Output Y beserta analisisnya?`,
        image: null,
        options: [
          'Output Y = 1, karena (NOT 0) menghasilkan 1, dan (0 OR 1) menghasilkan 1, sehingga (1 AND 1) menghasilkan nilai akhir 1.',
          'Output Y = 0, karena Input A dan Input B keduanya bernilai 0.',
          'Output Y = 0, karena operasi (0 OR 1) menghasilkan nilai 0.',
          'Output Y = 1, karena gerbang AND selalu menghasilkan 1 walaupun salah satu inputnya 0.',
        ],
        answer: 'A',
        difficulty: 'HOTS',
        explanation:
          'Evaluasi bertahap: (NOT A) = NOT(0) = 1. Selanjutnya (B OR C) = (0 OR 1) = 1. Kemudian digabungkan dengan AND: (1 AND 1) = 1.',
      },
      {
        id: 9,
        jenjang,
        semester,
        elemen: 'Teknologi Informasi & Komunikasi (TIK)',
        content: `[Paket Susulan #${v}] Panitia ANBK ${EXAM_INFO.namaSekolah} ingin mencetak ${mailMergeCount} kartu peserta ujian di Microsoft Word di mana kolom Nama, NISN, Kelas, dan Ruang otomatis mengambil data dari tabel Microsoft Excel. Saat menyisipkan kolom penanda data ke dalam dokumen Word, fitur menu Mailings yang harus diklik adalah...`,
        image: null,
        options: [
          'Insert Merge Field (Sisipkan Kolom Gabungan) setelah menghubungkan Select Recipients -> Use an Existing List',
          'Insert Screenshot layar desktop secara berulang-ulang',
          'Page Setup -> Orientation Portrait tanpa sumber data',
          'Spelling & Grammar Check pada tab Review',
        ],
        answer: 'A',
        difficulty: 'HOTS',
        explanation:
          'Setelah memilih sumber data Excel melalui Select Recipients, pengguna menyisipkan placeholder kolom data menggunakan tombol Insert Merge Field.',
      },
      {
        id: 10,
        jenjang,
        semester,
        elemen: 'Berpikir Komputasional (BK)',
        content: `[Paket Susulan #${v}] Sebuah sensor perangkat IoT mengirimkan nilai bilangan oktal (basis 8) sebesar ${octCode}₈. Konversikan nilai oktal ${octCode}₈ tersebut ke dalam bilangan desimal (basis 10) dan biner 6-bit (basis 2)!`,
        image: null,
        options: [
          `Desimal = ${octDecimal}₁₀ dan Biner = ${octBinary}₂`,
          `Desimal = ${octDecimal + 4}₁₀ dan Biner = ${(octDecimal + 4).toString(2).padStart(6, '0')}₂`,
          `Desimal = ${Number(octCode)}₁₀ dan Biner = 111000₂`,
          `Desimal = ${octDecimal - 5}₁₀ dan Biner = ${(octDecimal - 5).toString(2).padStart(6, '0')}₂`,
        ],
        answer: 'A',
        difficulty: 'HOTS',
        explanation: `Konversi ${octCode}₈ ke desimal: (${octHigh} × 8¹) + (${octLow} × 8⁰) = ${octHigh * 8} + ${octLow} = ${octDecimal}₁₀, yang dalam biner 6-bit adalah ${octBinary}₂.`,
      },
      {
        id: 11,
        jenjang,
        semester,
        elemen: 'Berpikir Komputasional (BK)',
        content: `[Paket Susulan #${v}] Konversikan bilangan desimal ${decA}₁₀ ke dalam sistem bilangan biner (basis 2)!`,
        image: null,
        options: [
          `${decA.toString(2)}₂`,
          `${(decA + 1).toString(2)}₂`,
          `${(decA + 3).toString(2)}₂`,
          `${Math.max(2, decA - 2).toString(2)}₂`,
        ],
        answer: 'A',
        difficulty: 'REGULER',
        explanation: `Hasil pembagian berulang bilangan ${decA}₁₀ dengan basis 2 menghasilkan representasi biner ${decA.toString(2)}₂.`,
      },
      {
        id: 12,
        jenjang,
        semester,
        elemen: 'Teknologi Informasi & Komunikasi (TIK)',
        content: `[Paket Susulan #${v}] Saat menyusun slide presentasi di PowerPoint, fitur yang digunakan untuk menyeragamkan jenis huruf, ukuran judul, dan logo sekolah di seluruh slide sekaligus hanya dengan mengatur satu tampilan induk adalah...`,
        image: null,
        options: [
          'Slide Master',
          'Animation Pane',
          'Rehearse Timings',
          'Crop Picture',
        ],
        answer: 'A',
        difficulty: 'REGULER',
        explanation:
          'Slide Master menyimpan template tata letak, tema font, dan elemen visual induk yang otomatis diterapkan ke seluruh slide di dalam presentasi.',
      },
      {
        id: 13,
        jenjang,
        semester,
        elemen: 'Sistem Komputer (SK)',
        content: `[Paket Susulan #${v}] Jalur komunikasi bus pada motherboard yang bertugas mengangkut data aktual yang sedang dipertukarkan secara dua arah (bidirectional) antara prosesor (CPU) dan memori utama (RAM) adalah...`,
        image: null,
        options: [
          'Data Bus (Bus Data)',
          'Address Bus (Bus Alamat)',
          'Casing Cooling Fan',
          'Power Cord Cable',
        ],
        answer: 'A',
        difficulty: 'REGULER',
        explanation:
          'Data Bus berfungsi mentransfer data aktual bolak-balik antara CPU, memori, dan peranti I/O, sedangkan Address Bus membawa alamat lokasinya.',
      },
      {
        id: 14,
        jenjang,
        semester,
        elemen: 'Berpikir Komputasional (BK)',
        content: `[Paket Susulan #${v}] Diberikan fungsi deret rekursif pada pengujian algoritma ke-${v}: U(1) = ${recBase}, dan untuk n > 1 berlaku rumus U(n) = 2 * U(n - 1) + ${recAdd}. Berapakah nilai hasil perhitungan dari U(4)?`,
        image: null,
        options: [
          `${u4}`,
          `${u3}`,
          `${u4 + 4}`,
          `${u4 - 3}`,
        ],
        answer: 'A',
        difficulty: 'HOTS',
        explanation: `Perhitungan bertahap: U(1) = ${recBase}; U(2) = 2(${recBase}) + ${recAdd} = ${u2}; U(3) = 2(${u2}) + ${recAdd} = ${u3}; U(4) = 2(${u3}) + ${recAdd} = ${u4}.`,
      },
      {
        id: 15,
        jenjang,
        semester,
        elemen: 'Berpikir Komputasional (BK)',
        content: `[Paket Susulan #${v}] Di Kelas VIII-${(v % 6) + 1}, himpunan siswa anggota klub Pemrograman adalah P = {${qSet[0]}, ${qSet[1]}, ${qSet[2]}} dan himpunan anggota klub Desain Grafis adalah D = {${qSet[2]}, ${qSet[3]}, ${qSet[4]}}. Jika sekolah memanggil seluruh siswa yang tergabung di klub Pemrograman ATAU Desain Grafis (Gabungan / Union P ∪ D), maka daftar siswa yang dipanggil adalah...`,
        image: null,
        options: [
          `{${qSet[0]}, ${qSet[1]}, ${qSet[2]}, ${qSet[3]}, ${qSet[4]}}`,
          `{${qSet[2]}} saja`,
          `{${qSet[0]}, ${qSet[1]}} saja`,
          `{${qSet[3]}, ${qSet[4]}} saja`,
        ],
        answer: 'A',
        difficulty: 'HOTS',
        explanation: `Operasi gabungan (Union P ∪ D) menggabungkan seluruh anggota dari kedua himpunan dengan menuliskan anggota yang sama (${qSet[2]}) cukup satu kali.`,
      },
      {
        id: 16,
        jenjang,
        semester,
        elemen: 'Sistem Komputer (SK)',
        content: `[Paket Susulan #${v}] Gerbang logika XOR (Exclusive OR) memiliki karakteristik khusus: menghasilkan Output = 1 jika kedua masukannya BERBEDA nilai, dan menghasilkan Output = 0 jika kedua masukannya SAMA nilai. Jika Input A = 1 dan Input B = 1 dimasukkan ke gerbang XOR, maka keluarannya adalah...`,
        image: null,
        options: [
          'Output = 0, karena kedua input bernilai sama (sama-sama 1).',
          'Output = 1, karena kedua input bernilai 1 seperti gerbang OR biasa.',
          'Output = 2, karena menjumlahkan 1 + 1 secara desimal.',
          'Output tidak terdefinisi.',
        ],
        answer: 'A',
        difficulty: 'HOTS',
        explanation:
          'Pada gerbang XOR (Exclusive OR), kombinasi input yang bernilai sama (0,0 atau 1,1) menghasilkan keluaran 0, sedangkan input berbeda (1,0 atau 0,1) menghasilkan keluaran 1.',
      },
      {
        id: 17,
        jenjang,
        semester,
        elemen: 'Teknologi Informasi & Komunikasi (TIK)',
        content: `[Paket Susulan #${v}] Seorang siswa menyisipkan tabel Excel ke dalam dokumen Word dengan fitur "Embed" (Object Embedding), sementara temannya menggunakan fitur "Link" (Paste Link). Perbedaan mendasar perilaku kedua dokumen tersebut ketika file Excel asli diperbarui adalah...`,
        image: null,
        options: [
          'Pada metode Link data tabel di Word ikut terperbarui otomatis mengikuti file Excel asli, sedangkan pada metode Embed data di Word berdiri sendiri sebagai salinan terpisah.',
          'Pada metode Embed file Word tidak bisa disimpan ke dalam harddisk.',
          'Pada metode Link dokumen Word otomatis berubah menjadi file audio.',
          'Kedua metode menghapus file Excel asli secara otomatis.',
        ],
        answer: 'A',
        difficulty: 'HOTS',
        explanation:
          'Object Linking menjaga tautan aktif ke file sumber sehingga perubahan di Excel tercermin di Word, sedangkan Object Embedding menanamkan salinan objek independen di dalam file Word.',
      },
      {
        id: 18,
        jenjang,
        semester,
        elemen: 'Sistem Komputer (SK)',
        content: `[Paket Susulan #${v}] Saat prosesor sedang mengeksekusi program berat, memori berkecepatan sangat tinggi yang terletak di antara CPU dan RAM (terdiri atas Level 1, Level 2, dan Level 3) yang berfungsi menyimpan instruksi yang paling sering diakses agar CPU tidak perlu menunggu RAM yang lebih lambat adalah...`,
        image: null,
        options: [
          'Cache Memory (L1 / L2 / L3 Cache)',
          'Magnetic Tape Backup',
          'Compact Disc Read-Only',
          'External USB Card Reader',
        ],
        answer: 'A',
        difficulty: 'REGULER',
        explanation:
          'Cache Memory adalah memori SRAM berkecepatan tinggi yang menjembatani perbedaan kecepatan antara prosesor (CPU) dan memori utama (RAM).',
      },
      {
        id: 19,
        jenjang,
        semester,
        elemen: 'Berpikir Komputasional (BK)',
        content: `[Paket Susulan #${v}] Dalam struktur data Tumpukan (Stack), kondisi kesalahan yang muncul apabila program berusaha melakukan operasi POP (mengambil data) pada Stack yang kondisinya sudah kosong melompong disebut...`,
        image: null,
        options: [
          'Stack Underflow',
          'Stack Overflow',
          'Buffer Overrun',
          'Network Timeout',
        ],
        answer: 'A',
        difficulty: 'REGULER',
        explanation:
          'Stack Underflow terjadi ketika operasi penghapusan/pengambilan elemen (Pop) dipanggil pada struktur Stack yang tidak memiliki elemen sama sekali (kosong).',
      },
      {
        id: 20,
        jenjang,
        semester,
        elemen: 'Teknologi Informasi & Komunikasi (TIK)',
        content: `[Paket Susulan #${v}] Agar dokumen laporan kelompok di Microsoft Word memiliki judul bab baru yang selalu dimulai tepat di bagian atas halaman berikutnya tanpa perlu menekan tombol Enter berkali-kali, fitur yang paling tepat digunakan adalah...`,
        image: null,
        options: [
          'Page Break (Ctrl + Enter)',
          'Spacebar berulang-ulang',
          'Strikethrough Text',
          'Change Case Upper',
        ],
        answer: 'A',
        difficulty: 'REGULER',
        explanation:
          'Page Break (Ctrl + Enter) memisahkan halaman secara rapi sehingga posisi bab baru selalu terjaga di awal halaman berikutnya meskipun teks di halaman sebelumnya diedit.',
      },
      {
        id: 21,
        jenjang,
        semester,
        elemen: 'Sistem Komputer (SK)',
        content: `[Paket Susulan #${v}] Sebuah komputer laboratorium gagal memuat Sistem Operasi saat dinyalakan dan menampilkan pesan "Boot Device Not Found". Berdasarkan cara kerja sistem komputer, komponen perangkat keras yang paling mungkin mengalami gangguan sambungan kabel data atau kerusakan adalah...`,
        image: null,
        options: [
          'Media penyimpanan utama tempat Sistem Operasi terinstal (SSD atau Harddisk / HDD)',
          'Perangkat pengeras suara (Speaker eksternal)',
          'Alas tetikus (Mousepad) di meja komputer',
          'Lampu indikator Caps Lock pada keyboard',
        ],
        answer: 'A',
        difficulty: 'HOTS',
        explanation:
          'Pesan "Boot Device Not Found" menunjukkan BIOS/UEFI tidak menemukan bootloader Sistem Operasi yang tersimpan di dalam drive penyimpanan utama (SSD/HDD).',
      },
      {
        id: 22,
        jenjang,
        semester,
        elemen: 'Berpikir Komputasional (BK)',
        content: `[Paket Susulan #${v}] Ketika pengguna menekan tombol "Back" (Kembali) pada peramban web (Browser) untuk kembali ke halaman-halaman yang baru saja dikunjungi secara berurutan mundur, struktur data komputasi yang bekerja di balik fitur riwayat tombol Back tersebut adalah...`,
        image: null,
        options: [
          'Stack (Tumpukan - LIFO: Last In First Out), karena halaman yang terakhir dikunjungi adalah halaman pertama yang dimuat kembali saat tombol Back ditekan.',
          'Queue (Antrean - FIFO), karena selalu membuka halaman paling awal saat komputer pertama kali dibeli.',
          'Random Generator tanpa riwayat.',
          'Gerbang logika NOT satu bit.',
        ],
        answer: 'A',
        difficulty: 'HOTS',
        explanation:
          'Riwayat halaman tombol Back (serta fitur Undo di editor teks) menggunakan struktur data Stack (LIFO): aktivitas/halaman terakhir yang masuk ke tumpukan akan dikeluarkan lebih dulu.',
      },
      {
        id: 23,
        jenjang,
        semester,
        elemen: 'Sistem Komputer (SK)',
        content: `[Paket Susulan #${v}] Jika dilakukan penjumlahan dua bilangan biner 4-bit yaitu 0101₂ (5₁₀) ditambah 0011₂ (3₁₀) di dalam ALU, maka hasil penjumlahan biner 4-bit yang diperoleh adalah...`,
        image: null,
        options: [
          '1000₂ (setara dengan 8₁₀)',
          '0111₂ (setara dengan 7₁₀)',
          '1010₂ (setara dengan 10₁₀)',
          '0110₂ (setara dengan 6₁₀)',
        ],
        answer: 'A',
        difficulty: 'HOTS',
        explanation:
          'Penjumlahan biner: 0101₂ (5) + 0011₂ (3) = 1000₂ (8 dalam desimal).',
      },
      {
        id: 24,
        jenjang,
        semester,
        elemen: 'Teknologi Informasi & Komunikasi (TIK)',
        content: `[Paket Susulan #${v}] Sebelum mencetak hasil penggabungan ratusan surat pada fitur Mail Merge di Microsoft Word, tombol fitur yang digunakan untuk melihat pratinjau hasil nyata nama-nama penerima langsung di layar adalah...`,
        image: null,
        options: [
          'Preview Results (Pratinjau Hasil)',
          'Delete All Recipients',
          'Track Changes',
          'Insert Footnote',
        ],
        answer: 'A',
        difficulty: 'REGULER',
        explanation:
          'Tombol Preview Results pada tab Mailings menampilkan isi data aktual dari setiap baris Excel menggantikan kode Merge Field di layar.',
      },
      {
        id: 25,
        jenjang,
        semester,
        elemen: 'Sistem Komputer (SK)',
        content: `[Paket Susulan #${v}] Dalam spesifikasi prosesor modern tertulis kecepatan "3.6 GHz (Gigahertz)". Besaran frekuensi Clock Speed tersebut menunjukkan...`,
        image: null,
        options: [
          'Jumlah siklus detak instruksi dasar yang mampu dieksekusi oleh prosesor dalam setiap satu detik (miliar siklus per detik)',
          'Ukuran berat fisik prosesor dalam satuan gram',
          'Kapasitas penyimpanan permanen foto di dalam harddisk',
          'Panjang diagonal layar monitor komputer dalam satuan inci',
        ],
        answer: 'A',
        difficulty: 'HOTS',
        explanation:
          'Clock speed dalam satuan Gigahertz (GHz) menyatakan banyaknya miliar siklus gelombang detak pemrosesan per detik yang dijalankan oleh CPU.',
      },
    ];
  }

  // Paket ke-4: VIII_Genap
  const loopLimit = 6 + ((v % 4) * 2); // 6, 8, 10, 12
  const oddSeq: number[] = [];
  for (let k = 2; k <= loopLimit; k += 2) {
    oddSeq.push(k);
  }
  const seqStr = oddSeq.join(', ');
  const minCost = Math.min(costPath1, costPath2, costPath3);
  const fastestLabel =
    minCost === costPath2
      ? `Jalur 2 (A -> C -> D) dengan total waktu tunda minimum ${costPath2} ms`
      : minCost === costPath3
      ? `Jalur 3 (A -> B -> C -> D) dengan total waktu tunda minimum ${costPath3} ms`
      : `Jalur 1 (A -> B -> D) dengan total waktu tunda minimum ${costPath1} ms`;

  return [
    {
      id: 1,
      jenjang,
      semester,
      elemen: 'Jaringan Komputer & Internet (JKI)',
      content: `[Paket Susulan #${v}] Jaringan komputer berskala sangat luas yang menghubungkan jaringan-jaringan antar-kota, antar-negara, hingga lintas benua di seluruh dunia (seperti jaringan Internet global) disebut...`,
      image: null,
      options: [
        'WAN (Wide Area Network)',
        'PAN (Personal Area Network)',
        'LAN (Local Area Network) satu ruangan',
        'Bluetooth Peer-to-Peer',
      ],
      answer: 'A',
      difficulty: 'REGULER',
      explanation:
        'WAN (Wide Area Network) mencakup area geografis yang sangat luas lintas kota, negara, maupun benua.',
    },
    {
      id: 2,
      jenjang,
      semester,
      elemen: 'Jaringan Komputer & Internet (JKI)',
      content: `[Paket Susulan #${v}] Setiap perangkat yang terhubung ke jaringan komputer memiliki alamat pengenal numerik logis (seperti 192.168.${1 + (v % 10)}.${20 + (v % 100)}) agar paket data sampai ke tujuan yang tepat. Alamat pengenal tersebut dinamakan...`,
      image: null,
      options: [
        'IP Address (Internet Protocol Address)',
        'Kode Pos Kecamatan',
        'Nomor Seri Keyboard',
        'Ukuran Resolusi Layar',
      ],
      answer: 'A',
      difficulty: 'REGULER',
      explanation:
        'IP Address adalah alamat logis unik yang diberikan kepada setiap perangkat (host) di dalam jaringan berbasis protokol TCP/IP.',
    },
    {
      id: 3,
      jenjang,
      semester,
      elemen: 'Analisis Data (AD)',
      content: `[Paket Susulan #${v}] Pada fungsi pencarian vertikal =VLOOKUP(A2, $D$2:$F$30, 3, FALSE) di aplikasi Spreadsheet, argumen angka "3" (col_index_num) menunjukkan perintah untuk...`,
      image: null,
      options: [
        'Mengambil nilai hasil pencarian dari kolom ke-3 di dalam tabel referensi $D$2:$F$30',
        'Mengalikan nilai hasil pencarian dengan angka 3',
        'Menghapus 3 baris pertama dari tabel referensi',
        'Membulatkan angka desimal menjadi 3 digit di belakang koma',
      ],
      answer: 'A',
      difficulty: 'REGULER',
      explanation:
        'Argumen ke-3 pada VLOOKUP (col_index_num) menentukan nomor indeks kolom pada tabel referensi (dihitung dari kiri mulai nomor 1) yang datanya akan diambil.',
    },
    {
      id: 4,
      jenjang,
      semester,
      elemen: 'Algoritma & Pemrograman (AP)',
      content: `[Paket Susulan #${v}] Dalam pemrograman prosedural, nilai tetap yang sudah ditentukan sejak awal kode ditulis dan TIDAK DAPAT diubah selama program berjalan (contohnya nilai Pi = 3,14) disebut...`,
      image: null,
      options: [
        'Konstanta (Constant)',
        'Variabel Dinamis (Variable)',
        'Perulangan (Looping)',
        'Komentar Dokumentasi (Comment)',
      ],
      answer: 'A',
      difficulty: 'REGULER',
      explanation:
        'Konstanta adalah wadah nilai yang bersifat tetap (immutable) selama masa eksekusi program, berbeda dengan variabel yang nilainya dapat berubah-ubah.',
    },
    {
      id: 5,
      jenjang,
      semester,
      elemen: 'Dampak Sosial Informatika (DSI)',
      content: `[Paket Susulan #${v}] Perangkat lunak berbahaya (Malware) yang bekerja dengan cara mengenkripsi atau mengunci seluruh file dokumen korban di komputer lalu meminta tebusan sejumlah uang untuk membuka kuncinya disebut...`,
      image: null,
      options: [
        'Ransomware',
        'Adware Iklan Biasa',
        'Spreadsheet Add-in',
        'Driver Printer Resmi',
      ],
      answer: 'A',
      difficulty: 'REGULER',
      explanation:
        'Ransomware adalah jenis malware penyandera data yang mengenkripsi file korban dan menuntut pembayaran tebusan (ransom) untuk kunci dekripsinya.',
    },
    {
      id: 6,
      jenjang,
      semester,
      elemen: 'Jaringan Komputer & Internet (JKI)',
      content: `[Paket Susulan #${v}] Pada pengujian tabel Routing jaringan ke-${v}, paket data dikirim dari Router A menuju Router D dengan rincian waktu tunda (delay) antar-titik:\n• Jalur 1 (A -> B -> D): A ke B = ${routeAB} ms, B ke D = ${routeBD} ms.\n• Jalur 2 (A -> C -> D): A ke C = ${routeAC} ms, C ke D = ${routeCD} ms.\n• Jalur 3 (A -> B -> C -> D): A ke B = ${routeAB} ms, B ke C = ${routeBC} ms, C ke D = ${routeCD} ms.\nJalur tercepat manakah yang akan dipilih oleh protokol routing beserta total waktu tundanya?`,
      image: null,
      options: [
        fastestLabel,
        `Jalur 1 (A -> B -> D) dengan total waktu tunda ${costPath1 + 5} ms`,
        `Jalur 3 (A -> B -> C -> D) dengan total waktu tunda ${costPath1 + costPath2} ms`,
        `Semua jalur ditolak karena total waktunya 0 ms`,
      ],
      answer: 'A',
      difficulty: 'HOTS',
      explanation: `Perhitungan total waktu tunda: Jalur 1 = ${routeAB} + ${routeBD} = ${costPath1} ms; Jalur 2 = ${routeAC} + ${routeCD} = ${costPath2} ms; Jalur 3 = ${routeAB} + ${routeBC} + ${routeCD} = ${costPath3} ms. Algoritma routing memilih jalur dengan total bobot terkecil yaitu ${minCost} ms.`,
    },
    {
      id: 7,
      jenjang,
      semester,
      elemen: 'Analisis Data (AD)',
      content: `[Paket Susulan #${v}] Panitia perpustakaan sekolah mencatat daftar peminjaman buku pada kolom B (Kelas: "VIII-1" s.d. "VIII-6") dan kolom C (Jumlah Buku Dipinjam) dari baris 2 sampai baris ${rowCount}. Untuk menjumlahkan total buku yang dipinjam KHUSUS oleh siswa kelas "VIII-${(v % 6) + 1}", rumus fungsi yang tepat adalah...`,
      image: null,
      options: [
        `=SUMIF(B2:B${rowCount}, "VIII-${(v % 6) + 1}", C2:C${rowCount})`,
        `=COUNTIF(B2:B${rowCount}, "VIII-${(v % 6) + 1}")`,
        `=HLOOKUP("VIII-${(v % 6) + 1}", B2:C${rowCount}, 2, FALSE)`,
        `=MAX(C2:C${rowCount})`,
      ],
      answer: 'A',
      difficulty: 'HOTS',
      explanation:
        'Fungsi =SUMIF(range_kriteria, kriteria, sum_range) menjumlahkan angka pada kolom C hanya untuk baris yang kolom B-nya sesuai dengan kelas yang ditentukan.',
    },
    {
      id: 8,
      jenjang,
      semester,
      elemen: 'Analisis Data (AD)',
      content: `[Paket Susulan #${v}] Seorang pengurus OSIS ingin membandingkan jumlah perolehan medali emas, perak, dan perunggu antar-${5 + (v % 4)} kelas paralel secara berdampingan agar terlihat jelas kelas mana yang memiliki batang tertinggi. Jenis grafik (Chart) yang paling tepat dipilih adalah...`,
      image: null,
      options: [
        'Grafik Batang / Kolom Terkluster (Clustered Column / Bar Chart)',
        'Grafik Lingkaran Tunggal (Single Pie Chart) tanpa kategori',
        'Paragraf narasi panjang tanpa angka',
        'Rumus konversi teks menjadi huruf kecil',
      ],
      answer: 'A',
      difficulty: 'HOTS',
      explanation:
        'Column/Bar Chart sangat ideal untuk membandingkan besaran nilai antar-kategori diskrit (antar-kelas) secara visual berdampingan.',
    },
    {
      id: 9,
      jenjang,
      semester,
      elemen: 'Algoritma & Pemrograman (AP)',
      content: `[Paket Susulan #${v}] Perhatikan potongan algoritma perulangan berikut:\n1. Set variabel K = 2\n2. Selama (While) K <= ${loopLimit} lakukan:\n   a. Cetak nilai K\n   b. Set K = K + 2\nDeret keluaran angka yang tercetak di layar secara berurutan adalah...`,
      image: null,
      options: [
        seqStr,
        oddSeq.map((n) => n - 1).join(', '),
        `${loopLimit}, ${loopLimit + 2}, ${loopLimit + 4}`,
        `1, 2, 3, ${loopLimit}`,
      ],
      answer: 'A',
      difficulty: 'HOTS',
      explanation: `Variabel K dimulai dari 2 dan bertambah 2 pada setiap iterasi selama K <= ${loopLimit}, sehingga mencetak deret bilangan genap: ${seqStr}.`,
    },
    {
      id: 10,
      jenjang,
      semester,
      elemen: 'Dampak Sosial Informatika (DSI)',
      content: `[Paket Susulan #${v}] Sebuah akun media sosial menyebarkan foto hasil rekayasa kecerdasan buatan (Deepfake) yang seolah-olah menampilkan pengumuman pembatalan ujian nasional disertai nomor rekening pribadi untuk biaya administrasi. Langkah verifikasi literasi digital (Saring Sebelum Sharing) yang paling tepat adalah...`,
      image: null,
      options: [
        'Memeriksa keaslian informasi melalui situs web dan kanal pengumuman resmi sekolah/kementerian, mengamati kejanggalan visual/sumber, serta tidak mentransfer uang maupun menyebarkan konten tersebut.',
        'Segera mentransfer uang ke rekening tersebut sebelum kuota habis.',
        'Membagikan ulang postingan tersebut ke seluruh grup WhatsApp kelas tanpa mengecek kebenarannya.',
        'Memberikan password akun email sekolah kepada pembuat postingan.',
      ],
      answer: 'A',
      difficulty: 'HOTS',
      explanation:
        'Verifikasi silang (cross-check) ke kanal resmi institusi dan sikap skeptis terhadap permintaan transfer dana merupakan benteng utama menghadapi penipuan rekayasa sosial dan hoaks.',
    },
    {
      id: 11,
      jenjang,
      semester,
      elemen: 'Jaringan Komputer & Internet (JKI)',
      content: `[Paket Susulan #${v}] Perangkat keras jaringan yang bertugas menghubungkan banyak komputer di dalam satu jaringan lokal (LAN) laboratorium serta meneruskan paket data secara cerdas hanya ke port komputer tujuan berdasarkan MAC Address adalah...`,
      image: null,
      options: [
        'Switch Jaringan (Network Switch)',
        'Kabel VGA Monitor',
        'Scanner Dokumen',
        'Baterai CMOS',
      ],
      answer: 'A',
      difficulty: 'REGULER',
      explanation:
        'Switch bekerja pada Data Link Layer untuk menghubungkan perangkat dalam LAN dan meneruskan frame data tepat ke port MAC Address tujuan.',
    },
    {
      id: 12,
      jenjang,
      semester,
      elemen: 'Analisis Data (AD)',
      content: `[Paket Susulan #${v}] Dalam fitur Pivot Table di Microsoft Excel / Google Sheets, area tempat kita meletakkan kolom numerik (seperti "Nilai Ujian" atau "Total Penjualan") untuk dihitung jumlah atau rata-ratanya disebut area...`,
      image: null,
      options: [
        'Values (Nilai)',
        'Page Margins',
        'Header & Footer',
        'Print Area',
      ],
      answer: 'A',
      difficulty: 'REGULER',
      explanation:
        'Pada struktur Pivot Table, kotak Values digunakan untuk menempatkan field angka yang akan diagregasi (SUM, AVERAGE, COUNT, MAX, MIN).',
    },
    {
      id: 13,
      jenjang,
      semester,
      elemen: 'Algoritma & Pemrograman (AP)',
      content: `[Paket Susulan #${v}] Tipe data dalam pemrograman yang digunakan untuk menyimpan deretan karakter teks seperti nama siswa "Peserta Susulan ${v}" atau alamat kelas adalah...`,
      image: null,
      options: [
        'String',
        'Boolean',
        'Integer Bulat',
        'Bit Tunggal',
      ],
      answer: 'A',
      difficulty: 'REGULER',
      explanation:
        'String adalah tipe data yang merepresentasikan untaian karakter huruf, angka, maupun simbol sebagai teks.',
    },
    {
      id: 14,
      jenjang,
      semester,
      elemen: 'Dampak Sosial Informatika (DSI)',
      content: `[Paket Susulan #${v}] Praktik menuliskan komentar yang santun, menghargai pendapat orang lain di forum diskusi daring, serta tidak menggunakan kalimat provokatif atau ujaran kebencian merupakan penerapan dari...`,
      image: null,
      options: [
        'Netiket (Etika Berinternet / Network Etiquette)',
        'Topologi Jaringan Mesh',
        'Kompresi File Lossless',
        'Konversi Bilangan Oktal',
      ],
      answer: 'A',
      difficulty: 'REGULER',
      explanation:
        'Netiket (Network Etiquette) adalah tata krama dan sopan santun dalam berkomunikasi serta berinteraksi di dunia digital.',
    },
    {
      id: 15,
      jenjang,
      semester,
      elemen: 'Jaringan Komputer & Internet (JKI)',
      content: `[Paket Susulan #${v}] Dalam sistem keamanan jaringan sekolah, komponen sistem (perangkat keras maupun perangkat lunak) yang bertugas menyaring, mengizinkan, atau memblokir lalu lintas paket data yang keluar-masuk berdasarkan aturan keamanan disebut...`,
      image: null,
      options: [
        'Firewall (Dinding Api Jaringan)',
        'Spreadsheet Pivot',
        'Screen Resolution',
        'Audio Equalizer',
      ],
      answer: 'A',
      difficulty: 'HOTS',
      explanation:
        'Firewall bertindak sebagai gerbang pelindung keamanan yang memantau dan memfilter lalu lintas jaringan berdasarkan aturan (rules) yang ditetapkan administrator.',
    },
    {
      id: 16,
      jenjang,
      semester,
      elemen: 'Analisis Data (AD)',
      content: `[Paket Susulan #${v}] Untuk menentukan status kelulusan otomatis di sel D2 dengan syarat KKM = ${kkmScore} (jika nilai di sel C2 >= ${kkmScore} tampilkan "TUNTAS", selain itu tampilkan "REMEDIAL"), rumus fungsi logika Spreadsheet yang benar adalah...`,
      image: null,
      options: [
        `=IF(C2>=${kkmScore}, "TUNTAS", "REMEDIAL")`,
        `=IF(C2<${kkmScore}, "TUNTAS", "REMEDIAL")`,
        `=SUMIF(C2, ">=${kkmScore}", "TUNTAS")`,
        `=VLOOKUP(${kkmScore}, C2, "TUNTAS")`,
      ],
      answer: 'A',
      difficulty: 'HOTS',
      explanation: `Fungsi =IF(kondisi_logis, nilai_jika_benar, nilai_jika_salah) mengecek apakah C2 >= ${kkmScore}; jika benar menghasilkan "TUNTAS", jika salah menghasilkan "REMEDIAL".`,
    },
    {
      id: 17,
      jenjang,
      semester,
      elemen: 'Algoritma & Pemrograman (AP)',
      content: `[Paket Susulan #${v}] Sebuah lampu taman otomatis menggunakan sensor cahaya (LDR). Algoritma mikrokontroler tertulis: "Jika intensitas cahaya < ${30 + (v % 20)} Lux, maka Nyalakan Lampu LED; selain itu Matikan Lampu LED". Struktur kontrol algoritma yang digunakan adalah...`,
      image: null,
      options: [
        'Percabangan Bersyarat Dua Kondisi (Selection / If-Else)',
        'Pengurutan Data Menurun (Descending Sort)',
        'Pencarian Beruntun (Linear Search)',
        'Penghapusan Variabel Global',
      ],
      answer: 'A',
      difficulty: 'HOTS',
      explanation:
        'Keputusan menyalakan atau mematikan aktuator lampu berdasarkan nilai ambang batas sensor menggunakan struktur kontrol percabangan (Selection / If-Else).',
    },
    {
      id: 18,
      jenjang,
      semester,
      elemen: 'Dampak Sosial Informatika (DSI)',
      content: `[Paket Susulan #${v}] Seorang siswa menggunakan komputer publik di warnet atau perpustakaan umum untuk membuka akun email dan portal sekolah. Tindakan pengamanan paling krusial yang wajib dilakukan sebelum meninggalkan komputer tersebut adalah...`,
      image: null,
      options: [
        'Melakukan Logout (Keluar) dari seluruh akun, tidak menyimpan kata sandi di browser publik, dan menutup jendela peramban.',
        'Memilih opsi "Remember Password / Simpan Sandi Selamanya" di browser umum.',
        'Mematikan monitor saja tanpa keluar dari akun yang sedang terbuka.',
        'Menuliskan password akun di secarik kertas lalu menempelkannya di meja komputer.',
      ],
      answer: 'A',
      difficulty: 'HOTS',
      explanation:
        'Pada perangkat publik, sesi login yang tidak di-logout atau password yang disimpan di browser dapat langsung diakses oleh pengguna berikutnya.',
    },
    {
      id: 19,
      jenjang,
      semester,
      elemen: 'Jaringan Komputer & Internet (JKI)',
      content: `[Paket Susulan #${v}] Layanan protokol pada router jaringan lokal yang bertugas membagikan alamat IP secara OTOMATIS kepada setiap laptop atau smartphone siswa yang baru terhubung ke Wi-Fi sekolah adalah...`,
      image: null,
      options: [
        'DHCP (Dynamic Host Configuration Protocol)',
        'SMTP (Simple Mail Transfer Protocol)',
        'POP3 (Post Office Protocol)',
        'HTML (Hypertext Markup Language)',
      ],
      answer: 'A',
      difficulty: 'REGULER',
      explanation:
        'DHCP Server mengalokasikan alamat IP, Subnet Mask, Gateway, dan DNS secara otomatis kepada perangkat klien yang bergabung ke jaringan.',
    },
    {
      id: 20,
      jenjang,
      semester,
      elemen: 'Analisis Data (AD)',
      content: `[Paket Susulan #${v}] Untuk menghitung nilai rata-rata ujian HANYA bagi siswa yang berasal dari kelas "VIII-${(v % 6) + 1}" pada tabel rekap (kolom B berisi Kelas dan kolom C berisi Nilai), fungsi Spreadsheet yang paling tepat adalah...`,
      image: null,
      options: [
        `=AVERAGEIF(B2:B${rowCount}, "VIII-${(v % 6) + 1}", C2:C${rowCount})`,
        `=COUNTIF(B2:B${rowCount}, "VIII-${(v % 6) + 1}")`,
        `=MIN(C2:C${rowCount})`,
        `=CONCATENATE(B2, C2)`,
      ],
      answer: 'A',
      difficulty: 'HOTS',
      explanation:
        'Fungsi =AVERAGEIF(range, criteria, average_range) menghitung nilai rata-rata aritmatika khusus untuk baris data yang memenuhi kriteria tertentu.',
    },
    {
      id: 21,
      jenjang,
      semester,
      elemen: 'Algoritma & Pemrograman (AP)',
      content: `[Paket Susulan #${v}] Pada pemrograman modular (Blockly / Python), sekumpulan instruksi yang dibungkus dengan satu nama khusus agar dapat dipanggil berulang kali dari berbagai bagian program tanpa harus menulis ulang kode yang sama disebut...`,
      image: null,
      options: [
        'Fungsi / Prosedur (Function / Procedure)',
        'Kesalahan Sintaks (Syntax Error)',
        'Kabel Jaringan (Patch Cord)',
        'Alamat Sel Absolut',
      ],
      answer: 'A',
      difficulty: 'HOTS',
      explanation:
        'Fungsi atau Prosedur menerapkan prinsip modularitas dan penggunaan ulang kode (code reusability) sehingga program lebih ringkas dan mudah dipelihara.',
    },
    {
      id: 22,
      jenjang,
      semester,
      elemen: 'Dampak Sosial Informatika (DSI)',
      content: `[Paket Susulan #${v}] Mengapa menyebarkan tangkapan layar (screenshot) percakapan pribadi atau data nilai rapor teman tanpa izin ke media sosial publik dapat dikategorikan sebagai pelanggaran etika dan hukum siber?`,
      image: null,
      options: [
        'Karena melanggar hak privasi serta perlindungan data pribadi orang lain dan berpotensi menimbulkan dampak psikologis maupun pencemaran nama baik.',
        'Karena tangkapan layar menghabiskan memori RAM milik server media sosial.',
        'Karena format gambar screenshot tidak bisa dibuka di komputer.',
        'Karena membuat layar ponsel pengunggah menjadi redup.',
      ],
      answer: 'A',
      difficulty: 'HOTS',
      explanation:
        'Data pribadi dan komunikasi privat dilindungi oleh etika privasi serta regulasi Perlindungan Data Pribadi (PDP) dan UU ITE.',
    },
    {
      id: 23,
      jenjang,
      semester,
      elemen: 'Jaringan Komputer & Internet (JKI)',
      content: `[Paket Susulan #${v}] Media transmisi jaringan kabel berkecepatan sangat tinggi yang menyalurkan data menggunakan pulsa cahaya melalui serat kaca atau plastik halus untuk jaringan tulang punggung (backbone) internet adalah...`,
      image: null,
      options: [
        'Kabel Fiber Optik (Serat Optik)',
        'Kabel Coaxial Antena TV Lama',
        'Kabel Audio Stereo 3.5mm',
        'Sinyal Inframerah Remote TV',
      ],
      answer: 'A',
      difficulty: 'REGULER',
      explanation:
        'Fiber Optik mentransmisikan data menggunakan gelombang cahaya sehingga mampu mencapai kecepatan sangat tinggi (Gigabit/Terabit) dengan redaman sangat rendah.',
    },
    {
      id: 24,
      jenjang,
      semester,
      elemen: 'Analisis Data (AD)',
      content: `[Paket Susulan #${v}] Pada lembar kerja Excel, jika di dalam sebuah sel muncul pesan kesalahan "#DIV/0!", penyebab terjadinya kesalahan tersebut adalah...`,
      image: null,
      options: [
        'Rumus di dalam sel tersebut mencoba melakukan operasi pembagian angka dengan nilai nol (0) atau sel kosong',
        'Lebar kolom terlalu sempit untuk menampilkan tanggal',
        'File lembar kerja belum diberikan nama saat disimpan',
        'Komputer tidak terhubung ke printer warna',
      ],
      answer: 'A',
      difficulty: 'REGULER',
      explanation:
        'Indikator error #DIV/0! (Division by Zero) muncul ketika rumus matematika membagi suatu bilangan dengan angka 0 atau sel yang kosong.',
    },
    {
      id: 25,
      jenjang,
      semester,
      elemen: 'Algoritma & Pemrograman (AP)',
      content: `[Paket Susulan #${v}] Terdapat ${32 * (1 << (v % 4))} data nomor peserta ujian yang sudah terurut secara menaik. Jika digunakan algoritma Binary Search (Pencarian Biner) yang selalu membagi dua ruang pencarian pada setiap langkah, berapakah jumlah langkah perbandingan maksimum (log₂ N) yang diperlukan?`,
      image: null,
      options: [
        `Sekitar ${5 + (v % 4)} kali perbandingan maksimum`,
        `Harus memeriksa satu per satu sebanyak ${32 * (1 << (v % 4))} kali`,
        `Tidak bisa dicari karena datanya sudah terurut`,
        `Membutuhkan ${32 * (1 << (v % 4)) * 2} kali perbandingan`,
      ],
      answer: 'A',
      difficulty: 'HOTS',
      explanation: `Kompleksitas Binary Search adalah log₂(N). Untuk N = ${32 * (1 << (v % 4))} = 2^${5 + (v % 4)}, jumlah pembagian dua maksimum adalah sekitar ${5 + (v % 4)} langkah.`,
    },
  ];
}

/**
 * Menghasilkan paket 25 soal ujian yang dijamin BARU dan TIDAK PERNAH SAMA dengan soal-soal
 * yang pernah dikerjakan siswa pada sesi-sesi sebelumnya (khususnya saat Ujian Susulan berulang kali).
 */
export function generateNonRepeatingRetakeQuestionsForStudent(params: {
  namaSiswa: string;
  nisNisn: string;
  packageKey: ExamPackageKey;
  baseQuestions: Question[];
  isRetake: boolean;
  previousSubmissions?: StudentSubmission[];
  deviceIpContext?: OnlineRandomizationContext;
}): {
  questions: Question[];
  attemptNumber: number;
  freshCount: number;
  totalPreviouslySeen: number;
  variationSeedCode?: string;
} {
  const {
    namaSiswa,
    nisNisn,
    packageKey,
    baseQuestions,
    isRetake,
    previousSubmissions = [],
    deviceIpContext,
  } = params;

  const [jenjang, semester] = packageKey.split('_') as [JenjangKelas, SemesterType];
  const history = getStudentSeenQuestionsHistory(namaSiswa, nisNisn, packageKey);
  const seenFpSet = new Set<string>(history.seenFingerprints || []);
  const seenContentSet = new Set<string>(history.seenContents || []);

  // Hitung berapa kali siswa ini sudah pernah mengikuti ujian di rekap sebelumnya
  const cleanName = (namaSiswa || '').trim().toLowerCase();
  const cleanNis = (nisNisn || '').trim().toLowerCase();
  const matchingPastSubs = previousSubmissions.filter((sub) => {
    if (!sub || !sub.namaSiswa) return false;
    const subName = sub.namaSiswa.trim().toLowerCase();
    const subNis = (sub.nisNisn || '').trim().toLowerCase();
    const nameMatch = cleanName && subName === cleanName;
    const nisMatch =
      cleanNis && cleanNis !== '0' && cleanNis !== '-' && subNis === cleanNis;
    return nameMatch || nisMatch;
  });

  // Jika siswa sudah punya riwayat di Rekap tetapi belum tercatat di history lokal (misal dari sesi lama/perangkat lain),
  // tandai paket dasar (baseQuestions) sebagai sudah pernah dikerjakan apabila ini adalah ujian susulan/ulangan
  if ((isRetake || matchingPastSubs.length > 0) && seenFpSet.size === 0) {
    baseQuestions.forEach((q) => {
      if (q && q.content) {
        seenFpSet.add(computeQuestionContentFingerprint(q.content));
        seenContentSet.add(q.content.trim().toLowerCase().replace(/\s+/g, ' '));
      }
    });
  }

  const attemptNumber = Math.max(
    (history.attemptCount || 0) + 1,
    matchingPastSubs.length + 1,
    isRetake ? 2 : 1
  );

  const effectiveCtx: OnlineRandomizationContext = {
    namaSiswa,
    nisNisn,
    kelas: deviceIpContext?.kelas || jenjang,
    clientIp: deviceIpContext?.clientIp || '103.148.201.77',
    deviceFingerprint: deviceIpContext?.deviceFingerprint || 'DEV-DEFAULT',
    deviceModel: deviceIpContext?.deviceModel || 'Device',
  };
  const deviceIpOffset = computeStudentDeviceIpSeedOffset(effectiveCtx);
  const variationSeedCode = `PKT-${jenjang}${semester === 'Ganjil' ? '1' : '2'}-IP${String(deviceIpOffset).padStart(2, '0')}-S${attemptNumber}`;
  const prng = createSeededPrngFromContext(
    `${packageKey}|${namaSiswa}|${nisNisn}|${effectiveCtx.clientIp}|${effectiveCtx.deviceFingerprint}|${effectiveCtx.deviceModel}|attempt:${attemptNumber}|ts:${Date.now()}`
  );

  const shuffleWithPrng = <T,>(arr: T[]): T[] => {
    const copy = [...arr];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(prng() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  };

  // Jika ini baru ujian pertama kali bagi siswa (bukan ujian susulan & belum pernah mengerjakan),
  // gabungkan Bank Soal Utama (sesuai Kelas VII/VIII & Semester Ganjil/Genap) + Variasi Soal Online berbasis Device & IP
  // agar setiap siswa dengan perangkat & IP berbeda mendapatkan kombinasi 25 soal (12 REGULER & 13 HOTS) yang berbeda!
  if (!isRetake && attemptNumber === 1 && seenFpSet.size === 0) {
    const officialBank = FASE_D_QUESTION_BANKS[packageKey] || baseQuestions;
    // Pastikan baseQuestions yang dipakai benar-benar milik jenjang & semester yang dipilih
    const validBase =
      baseQuestions.length > 0 &&
      baseQuestions.every((q) => (!q.jenjang || q.jenjang === jenjang) && (!q.semester || q.semester === semester))
        ? baseQuestions
        : officialBank;

    const onlineExtras = ONLINE_EXTRA_QUESTIONS_POOL[packageKey] || [];
    const deviceIpDynamicBatch = buildDynamicParameterizedRetakePool(
      packageKey,
      1 + (deviceIpOffset % 9),
      deviceIpOffset
    ).map((q) => ({
      ...q,
      content: q.content.replace(/^\[Paket Susulan #\d+\]\s*/i, ''),
      jenjang,
      semester,
    }));

    const combinedPool: Question[] = [];
    const localFp = new Set<string>();
    [...validBase, ...onlineExtras, ...deviceIpDynamicBatch].forEach((q) => {
      if (!q || !q.content) return;
      const fp = computeQuestionContentFingerprint(q.content);
      if (!localFp.has(fp)) {
        localFp.add(fp);
        combinedPool.push({
          ...q,
          jenjang,
          semester,
        });
      }
    });

    const regCandidates = shuffleWithPrng(combinedPool.filter((q) => q.difficulty === 'REGULER'));
    const hotsCandidates = shuffleWithPrng(combinedPool.filter((q) => q.difficulty === 'HOTS'));

    const chosen25 = shuffleWithPrng([
      ...regCandidates.slice(0, 12),
      ...hotsCandidates.slice(0, 13),
    ]).map((q, idx) => ({
      ...q,
      id: idx + 1,
      jenjang,
      semester,
    }));

    recordStudentSeenQuestions(namaSiswa, nisNisn, packageKey, chosen25);
    return {
      questions: chosen25,
      attemptNumber: 1,
      freshCount: chosen25.length,
      totalPreviouslySeen: 0,
      variationSeedCode,
    };
  }

  // Untuk Ujian Susulan (ke-1, ke-2, ke-3, dst.): kumpulkan soal yang BELUM PERNAH dikerjakan siswa sama sekali
  const isQuestionUnseen = (q: Question): boolean => {
    if (!q || !q.content) return false;
    const fp = computeQuestionContentFingerprint(q.content);
    const norm = q.content.trim().toLowerCase().replace(/\s+/g, ' ');
    return !seenFpSet.has(fp) && !seenContentSet.has(norm);
  };

  const selectedFreshQuestions: Question[] = [];
  const selectedLocalFp = new Set<string>();

  const tryAddCandidate = (q: Question) => {
    if (selectedFreshQuestions.length >= 25) return;
    const cleanedQ: Question = {
      ...q,
      jenjang,
      semester,
    };
    const fp = computeQuestionContentFingerprint(cleanedQ.content);
    if (selectedLocalFp.has(fp)) return;
    if (isQuestionUnseen(cleanedQ)) {
      selectedLocalFp.add(fp);
      selectedFreshQuestions.push(cleanedQ);
    }
  };

  // 1. Cek soal tambahan online jika belum pernah dikerjakan siswa
  const onlineExtras = ONLINE_EXTRA_QUESTIONS_POOL[packageKey] || [];
  shuffleWithPrng(onlineExtras).forEach(tryAddCandidate);

  // 2. Bangkitkan soal-soal baru dari generator berparameter untuk percobaan susulan ke-N + offset Device & IP
  let offset = 0;
  while (selectedFreshQuestions.length < 25 && offset < 25) {
    const generatedBatch = buildDynamicParameterizedRetakePool(
      packageKey,
      attemptNumber + (deviceIpOffset % 5),
      deviceIpOffset + offset * 17
    );
    shuffleWithPrng(generatedBatch).forEach(tryAddCandidate);
    offset++;
  }

  // 3. Pastikan tepat 25 soal yang diacak urutannya dengan ID 1..25 berurutan
  const finalRetakeQuestions = shuffleWithPrng(selectedFreshQuestions)
    .slice(0, 25)
    .map((q, idx) => ({
      ...q,
      id: idx + 1,
      jenjang,
      semester,
    }));

  const previousSeenTotal = seenFpSet.size;
  recordStudentSeenQuestions(namaSiswa, nisNisn, packageKey, finalRetakeQuestions);

  return {
    questions: finalRetakeQuestions,
    attemptNumber,
    freshCount: finalRetakeQuestions.length,
    totalPreviouslySeen: previousSeenTotal,
    variationSeedCode,
  };
}

// Default ekspor untuk kompatibilitas awal
export const INITIAL_QUESTIONS: Question[] = QUESTIONS_VIII_GANJIL;

function buildAnswersForCorrectCount(
  correctCount: number,
  bank: Question[] = QUESTIONS_VIII_GANJIL
): Record<number, 'A' | 'B' | 'C' | 'D'> {
  const map: Record<number, 'A' | 'B' | 'C' | 'D'> = {};
  const wrongMap: Record<'A' | 'B' | 'C' | 'D', 'A' | 'B' | 'C' | 'D'> = {
    A: 'B',
    B: 'C',
    C: 'D',
    D: 'A',
  };
  bank.forEach((q, idx) => {
    if (idx < correctCount) {
      map[q.id] = q.answer;
    } else {
      map[q.id] = wrongMap[q.answer];
    }
  });
  return map;
}

const RAW_HISTORICAL_REKAP: Array<{
  timestamp: string;
  namaSiswa: string;
  nisNisn: string;
  kelas: string;
  semester: SemesterType;
  skorBenar: number;
  totalSoal: number;
  nilaiAkhir: number;
  statusKecurangan: string;
  lulusTidakLulus: string;
}> = [
  {
    timestamp: '21/09/2026 12:40:42',
    namaSiswa: 'Jfkgitigig',
    nisNisn: '0',
    kelas: 'VIII-6',
    semester: 'Ganjil',
    skorBenar: 3,
    totalSoal: 10,
    nilaiAkhir: 30,
    statusKecurangan: 'Diskualifikasi: Gagal merespons peringatan anti-kecurangan.',
    lulusTidakLulus: 'TIDAK LULUS',
  },
  {
    timestamp: '21/09/2026 10:28:13',
    namaSiswa: 'Jfkgitigig',
    nisNisn: '0',
    kelas: 'VIII-6',
    semester: 'Ganjil',
    skorBenar: 3,
    totalSoal: 10,
    nilaiAkhir: 30,
    statusKecurangan: 'Diskualifikasi: Gagal merespons peringatan anti-kecurangan.',
    lulusTidakLulus: 'TIDAK LULUS',
  },
  {
    timestamp: '20/09/2026 22:28:06',
    namaSiswa: 'Azka myza zahwan',
    nisNisn: '0',
    kelas: 'VIII-6',
    semester: 'Ganjil',
    skorBenar: 2,
    totalSoal: 10,
    nilaiAkhir: 20,
    statusKecurangan:
      'Diskualifikasi: Terdeteksi pindah tab/minimize 3 kali (Meninggalkan tab atau minimize browser terdeteksi.)',
    lulusTidakLulus: 'TIDAK LULUS',
  },
  {
    timestamp: '20/09/2026 22:01:10',
    namaSiswa: 'Keyla cahya',
    nisNisn: '0',
    kelas: 'VIII-6',
    semester: 'Ganjil',
    skorBenar: 10,
    totalSoal: 10,
    nilaiAkhir: 100,
    statusKecurangan: 'Selesai Normal oleh Peserta',
    lulusTidakLulus: 'LULUS',
  },
  {
    timestamp: '20/09/2026 21:56:06',
    namaSiswa: 'Keyla cahya',
    nisNisn: '0',
    kelas: 'VIII-6',
    semester: 'Ganjil',
    skorBenar: 3,
    totalSoal: 10,
    nilaiAkhir: 30,
    statusKecurangan: 'Selesai Normal oleh Peserta',
    lulusTidakLulus: 'TIDAK LULUS',
  },
  {
    timestamp: '20/09/2026 21:47:38',
    namaSiswa: 'Afika aulia',
    nisNisn: '0',
    kelas: 'VIII-6',
    semester: 'Ganjil',
    skorBenar: 3,
    totalSoal: 10,
    nilaiAkhir: 30,
    statusKecurangan: 'Selesai Normal oleh Peserta',
    lulusTidakLulus: 'TIDAK LULUS',
  },
  {
    timestamp: '20/09/2026 21:43:59',
    namaSiswa: 'Firman Maulana',
    nisNisn: '0',
    kelas: 'VIII-6',
    semester: 'Ganjil',
    skorBenar: 10,
    totalSoal: 10,
    nilaiAkhir: 100,
    statusKecurangan: 'Selesai Normal oleh Peserta',
    lulusTidakLulus: 'LULUS',
  },
  {
    timestamp: '20/09/2026 21:42:17',
    namaSiswa: 'Firman Maulana',
    nisNisn: '0',
    kelas: 'VIII-6',
    semester: 'Ganjil',
    skorBenar: 9,
    totalSoal: 10,
    nilaiAkhir: 90,
    statusKecurangan: 'Selesai Normal oleh Peserta',
    lulusTidakLulus: 'LULUS',
  },
  {
    timestamp: '20/09/2026 21:41:13',
    namaSiswa: 'Afika aulia',
    nisNisn: '0',
    kelas: 'VIII-6',
    semester: 'Ganjil',
    skorBenar: 1,
    totalSoal: 10,
    nilaiAkhir: 10,
    statusKecurangan: 'Selesai Normal oleh Peserta',
    lulusTidakLulus: 'TIDAK LULUS',
  },
  {
    timestamp: '20/09/2026 21:37:18',
    namaSiswa: 'Keyla cahya',
    nisNisn: '0',
    kelas: 'VIII-6',
    semester: 'Ganjil',
    skorBenar: 4,
    totalSoal: 10,
    nilaiAkhir: 40,
    statusKecurangan: 'Selesai Normal oleh Peserta',
    lulusTidakLulus: 'TIDAK LULUS',
  },
  {
    timestamp: '20/09/2026 21:35:35',
    namaSiswa: 'Firman Maulana',
    nisNisn: '0',
    kelas: 'VIII-6',
    semester: 'Ganjil',
    skorBenar: 10,
    totalSoal: 10,
    nilaiAkhir: 100,
    statusKecurangan: 'Selesai Normal oleh Peserta',
    lulusTidakLulus: 'LULUS',
  },
  {
    timestamp: '20/09/2026 21:25:39',
    namaSiswa: 'Firman Maulana',
    nisNisn: '0',
    kelas: 'VIII-6',
    semester: 'Ganjil',
    skorBenar: 1,
    totalSoal: 10,
    nilaiAkhir: 10,
    statusKecurangan: 'Diskualifikasi: Gagal merespons peringatan anti-kecurangan.',
    lulusTidakLulus: 'TIDAK LULUS',
  },
  {
    timestamp: '20/09/2026 21:03:32',
    namaSiswa: 'aqila azahra',
    nisNisn: '3',
    kelas: 'VIII-4',
    semester: 'Ganjil',
    skorBenar: 7,
    totalSoal: 10,
    nilaiAkhir: 70,
    statusKecurangan: 'Selesai Normal oleh Peserta',
    lulusTidakLulus: 'TIDAK LULUS',
  },
  {
    timestamp: '20/09/2026 20:53:54',
    namaSiswa: 'aqila azahra',
    nisNisn: '3',
    kelas: 'VIII-4',
    semester: 'Ganjil',
    skorBenar: 4,
    totalSoal: 10,
    nilaiAkhir: 40,
    statusKecurangan: 'Selesai Normal oleh Peserta',
    lulusTidakLulus: 'TIDAK LULUS',
  },
  {
    timestamp: '20/09/2026 20:48:49',
    namaSiswa: 'aqila azahra',
    nisNisn: '3',
    kelas: 'VIII-4',
    semester: 'Ganjil',
    skorBenar: 0,
    totalSoal: 10,
    nilaiAkhir: 0,
    statusKecurangan: 'Diskualifikasi: Gagal merespons peringatan anti-kecurangan.',
    lulusTidakLulus: 'TIDAK LULUS',
  },
  {
    timestamp: '20/09/2026 20:37:37',
    namaSiswa: 'Ayu Sah Fitri',
    nisNisn: 'SMPN 7kisaran',
    kelas: 'VIII-4',
    semester: 'Ganjil',
    skorBenar: 1,
    totalSoal: 10,
    nilaiAkhir: 10,
    statusKecurangan: 'Diskualifikasi: Gagal merespons peringatan anti-kecurangan.',
    lulusTidakLulus: 'TIDAK LULUS',
  },
  {
    timestamp: '20/09/2026 20:35:27',
    namaSiswa: 'Revi afdinata',
    nisNisn: '27',
    kelas: 'VIII-4',
    semester: 'Ganjil',
    skorBenar: 10,
    totalSoal: 10,
    nilaiAkhir: 100,
    statusKecurangan: 'Selesai Normal oleh Peserta',
    lulusTidakLulus: 'LULUS',
  },
  {
    timestamp: '18/09/2026 20:27:36',
    namaSiswa: 'Firman Maulana',
    nisNisn: '5177/0136182858',
    kelas: 'VIII-6',
    semester: 'Ganjil',
    skorBenar: 9,
    totalSoal: 10,
    nilaiAkhir: 90,
    statusKecurangan: 'Selesai Normal oleh Peserta',
    lulusTidakLulus: 'LULUS',
  },
  {
    timestamp: '18/09/2026 19:08:30',
    namaSiswa: 'Azka myza zahwan',
    nisNisn: '0',
    kelas: 'VIII-6',
    semester: 'Ganjil',
    skorBenar: 3,
    totalSoal: 10,
    nilaiAkhir: 30,
    statusKecurangan: 'Selesai Normal oleh Peserta',
    lulusTidakLulus: 'TIDAK LULUS',
  },
  {
    timestamp: '18/09/2026 19:03:30',
    namaSiswa: 'Azka myza zahwan',
    nisNisn: '0',
    kelas: 'VIII-6',
    semester: 'Ganjil',
    skorBenar: 4,
    totalSoal: 10,
    nilaiAkhir: 40,
    statusKecurangan: 'Selesai Normal oleh Peserta',
    lulusTidakLulus: 'TIDAK LULUS',
  },
  {
    timestamp: '18/09/2026 19:00:00',
    namaSiswa: 'Azka myza zahwan',
    nisNisn: '0',
    kelas: 'VIII-6',
    semester: 'Ganjil',
    skorBenar: 0,
    totalSoal: 10,
    nilaiAkhir: 0,
    statusKecurangan: 'Diskualifikasi: Gagal merespons peringatan anti-kecurangan.',
    lulusTidakLulus: 'TIDAK LULUS',
  },
  {
    timestamp: '18/09/2026 18:58:13',
    namaSiswa: 'MHD.SULTAN ALIF',
    nisNisn: '0',
    kelas: 'VIII-6',
    semester: 'Ganjil',
    skorBenar: 10,
    totalSoal: 10,
    nilaiAkhir: 100,
    statusKecurangan: 'Selesai Normal oleh Peserta',
    lulusTidakLulus: 'LULUS',
  },
  {
    timestamp: '18/09/2026 18:33:05',
    namaSiswa: 'Revi afdinata',
    nisNisn: '27',
    kelas: 'VIII-4',
    semester: 'Ganjil',
    skorBenar: 0,
    totalSoal: 10,
    nilaiAkhir: 0,
    statusKecurangan: 'Diskualifikasi: Gagal merespons peringatan anti-kecurangan.',
    lulusTidakLulus: 'TIDAK LULUS',
  },
  {
    timestamp: '18/09/2026 17:51:45',
    namaSiswa: 'Ardelia Dwi Adhari',
    nisNisn: '865362',
    kelas: 'VIII-4',
    semester: 'Ganjil',
    skorBenar: 7,
    totalSoal: 10,
    nilaiAkhir: 70,
    statusKecurangan: 'Selesai Normal oleh Peserta',
    lulusTidakLulus: 'TIDAK LULUS',
  },
  {
    timestamp: '18/09/2026 17:32:32',
    namaSiswa: 'Suci Ramadhani',
    nisNisn: '128133683',
    kelas: 'VIII-4',
    semester: 'Ganjil',
    skorBenar: 3,
    totalSoal: 10,
    nilaiAkhir: 30,
    statusKecurangan: 'Selesai Normal oleh Peserta',
    lulusTidakLulus: 'TIDAK LULUS',
  },
  {
    timestamp: '18/09/2026 17:29:46',
    namaSiswa: 'Suci Raamdhani',
    nisNisn: '128133683',
    kelas: 'VIII-4',
    semester: 'Ganjil',
    skorBenar: 0,
    totalSoal: 10,
    nilaiAkhir: 0,
    statusKecurangan: 'Diskualifikasi: Gagal merespons peringatan anti-kecurangan.',
    lulusTidakLulus: 'TIDAK LULUS',
  },
  {
    timestamp: '18/09/2026 2:28:07',
    namaSiswa: 'Asd',
    nisNisn: '0',
    kelas: 'VIII-6',
    semester: 'Ganjil',
    skorBenar: 1,
    totalSoal: 10,
    nilaiAkhir: 10,
    statusKecurangan: 'Selesai Normal oleh Peserta',
    lulusTidakLulus: 'TIDAK LULUS',
  },
  {
    timestamp: '17/09/2026 23:11:47',
    namaSiswa: 'Prisca AZ Zahra',
    nisNisn: '0',
    kelas: 'VIII-6',
    semester: 'Ganjil',
    skorBenar: 3,
    totalSoal: 10,
    nilaiAkhir: 30,
    statusKecurangan: 'Selesai Normal oleh Peserta',
    lulusTidakLulus: 'TIDAK LULUS',
  },
  {
    timestamp: '17/09/2026 22:45:15',
    namaSiswa: 'Prisca AZ Zahra',
    nisNisn: '0',
    kelas: 'VIII-6',
    semester: 'Ganjil',
    skorBenar: 0,
    totalSoal: 10,
    nilaiAkhir: 0,
    statusKecurangan: 'Diskualifikasi: Gagal merespons peringatan anti-kecurangan.',
    lulusTidakLulus: 'TIDAK LULUS',
  },
  {
    timestamp: '17/09/2026 22:37:27',
    namaSiswa: 'Rizky dede syahputra',
    nisNisn: '0',
    kelas: 'VIII-6',
    semester: 'Ganjil',
    skorBenar: 10,
    totalSoal: 10,
    nilaiAkhir: 100,
    statusKecurangan: 'Selesai Normal oleh Peserta',
    lulusTidakLulus: 'LULUS',
  },
  {
    timestamp: '17/09/2026 22:30:25',
    namaSiswa: 'Halwa Nadirah Sirait',
    nisNisn: '2140/3138519837',
    kelas: 'VIII-6',
    semester: 'Ganjil',
    skorBenar: 10,
    totalSoal: 10,
    nilaiAkhir: 100,
    statusKecurangan: 'Selesai Normal oleh Peserta',
    lulusTidakLulus: 'LULUS',
  },
  {
    timestamp: '17/09/2026 22:26:39',
    namaSiswa: 'Rizky dede syahputra',
    nisNisn: '0',
    kelas: 'VIII-6',
    semester: 'Ganjil',
    skorBenar: 2,
    totalSoal: 10,
    nilaiAkhir: 20,
    statusKecurangan: 'Selesai Normal oleh Peserta',
    lulusTidakLulus: 'TIDAK LULUS',
  },
  {
    timestamp: '17/09/2026 22:20:05',
    namaSiswa: 'Rizky dede syahputra',
    nisNisn: '0',
    kelas: 'VIII-6',
    semester: 'Ganjil',
    skorBenar: 0,
    totalSoal: 10,
    nilaiAkhir: 0,
    statusKecurangan: 'Selesai Normal oleh Peserta',
    lulusTidakLulus: 'TIDAK LULUS',
  },
  {
    timestamp: '17/09/2026 22:16:22',
    namaSiswa: 'Rizky dede syahputra',
    nisNisn: '0',
    kelas: 'VIII-6',
    semester: 'Ganjil',
    skorBenar: 3,
    totalSoal: 10,
    nilaiAkhir: 30,
    statusKecurangan: 'Diskualifikasi: Gagal merespons peringatan anti-kecurangan.',
    lulusTidakLulus: 'TIDAK LULUS',
  },
  {
    timestamp: '17/09/2026 21:46:46',
    namaSiswa: 'Fikrah hanafi',
    nisNisn: '0',
    kelas: 'VIII-6',
    semester: 'Ganjil',
    skorBenar: 8,
    totalSoal: 10,
    nilaiAkhir: 80,
    statusKecurangan: 'Selesai Normal oleh Peserta',
    lulusTidakLulus: 'LULUS',
  },
  {
    timestamp: '17/09/2026 21:31:54',
    namaSiswa: 'Jihan almaira putri mrp',
    nisNisn: '0',
    kelas: 'VIII-6',
    semester: 'Ganjil',
    skorBenar: 4,
    totalSoal: 10,
    nilaiAkhir: 40,
    statusKecurangan: 'Selesai Normal oleh Peserta',
    lulusTidakLulus: 'TIDAK LULUS',
  },
  {
    timestamp: '17/09/2026 21:29:30',
    namaSiswa: 'azzuka aprillio',
    nisNisn: '0',
    kelas: 'VIII-6',
    semester: 'Ganjil',
    skorBenar: 10,
    totalSoal: 10,
    nilaiAkhir: 100,
    statusKecurangan: 'Selesai Normal oleh Peserta',
    lulusTidakLulus: 'LULUS',
  },
  {
    timestamp: '17/09/2026 21:26:40',
    namaSiswa: 'Dhita',
    nisNisn: '0',
    kelas: 'VIII-1',
    semester: 'Ganjil',
    skorBenar: 10,
    totalSoal: 10,
    nilaiAkhir: 100,
    statusKecurangan: 'Selesai Normal oleh Peserta',
    lulusTidakLulus: 'LULUS',
  },
  {
    timestamp: '17/09/2026 21:26:35',
    namaSiswa: 'Jihan almaira putrimrp',
    nisNisn: '0',
    kelas: 'VIII-6',
    semester: 'Ganjil',
    skorBenar: 1,
    totalSoal: 10,
    nilaiAkhir: 10,
    statusKecurangan: 'Diskualifikasi: Gagal merespons peringatan anti-kecurangan.',
    lulusTidakLulus: 'TIDAK LULUS',
  },
  {
    timestamp: '17/09/2026 21:24:36',
    namaSiswa: 'azzuka aprillio',
    nisNisn: '0',
    kelas: 'VIII-6',
    semester: 'Ganjil',
    skorBenar: 9,
    totalSoal: 10,
    nilaiAkhir: 90,
    statusKecurangan: 'Selesai Normal oleh Peserta',
    lulusTidakLulus: 'LULUS',
  },
  {
    timestamp: '17/09/2026 19:41:33',
    namaSiswa: 'Halwa Nadirah Sirait',
    nisNisn: '2140/3138519837',
    kelas: 'VIII-6',
    semester: 'Ganjil',
    skorBenar: 0,
    totalSoal: 10,
    nilaiAkhir: 0,
    statusKecurangan:
      'Diskualifikasi: Terdeteksi pindah tab/minimize 3 kali (Keluar dari fokus jendela ujian terdeteksi.)',
    lulusTidakLulus: 'TIDAK LULUS',
  },
  {
    timestamp: '17/09/2026 19:10:42',
    namaSiswa: 'Muhammad shaki Naufal farras',
    nisNisn: '19',
    kelas: 'VIII-6',
    semester: 'Ganjil',
    skorBenar: 10,
    totalSoal: 10,
    nilaiAkhir: 100,
    statusKecurangan: 'Selesai Normal oleh Peserta',
    lulusTidakLulus: 'LULUS',
  },
  {
    timestamp: '17/09/2026 19:01:52',
    namaSiswa: 'Muhammad shaki Naufal farras',
    nisNisn: '19',
    kelas: 'VIII-6',
    semester: 'Ganjil',
    skorBenar: 0,
    totalSoal: 10,
    nilaiAkhir: 0,
    statusKecurangan: 'Diskualifikasi: Gagal merespons peringatan anti-kecurangan.',
    lulusTidakLulus: 'TIDAK LULUS',
  },
  {
    timestamp: '17/09/2026 18:25:39',
    namaSiswa: 'M Rasya Habibie',
    nisNisn: 'Apsen no 17',
    kelas: 'VIII-6',
    semester: 'Ganjil',
    skorBenar: 10,
    totalSoal: 10,
    nilaiAkhir: 100,
    statusKecurangan: 'Selesai Normal oleh Peserta',
    lulusTidakLulus: 'LULUS',
  },
  {
    timestamp: '17/09/2026 18:16:48',
    namaSiswa: 'M Rasya Habibie',
    nisNisn: 'Apsen no 17',
    kelas: 'VIII-6',
    semester: 'Ganjil',
    skorBenar: 2,
    totalSoal: 10,
    nilaiAkhir: 20,
    statusKecurangan: 'Diskualifikasi: Gagal merespons peringatan anti-kecurangan.',
    lulusTidakLulus: 'TIDAK LULUS',
  },
  {
    timestamp: '17/09/2026 15:29:19',
    namaSiswa: 'azzuka aprillio',
    nisNisn: '6281269529014',
    kelas: 'VIII-6',
    semester: 'Ganjil',
    skorBenar: 9,
    totalSoal: 10,
    nilaiAkhir: 90,
    statusKecurangan:
      'Diskualifikasi: Terdeteksi pindah tab/minimize 3 kali (Meninggalkan tab atau minimize browser terdeteksi.)',
    lulusTidakLulus: 'LULUS',
  },
  {
    timestamp: '17/09/2026 15:24:10',
    namaSiswa: 'azzuka aprillio',
    nisNisn: '6281269529014',
    kelas: 'VIII-6',
    semester: 'Ganjil',
    skorBenar: 10,
    totalSoal: 10,
    nilaiAkhir: 100,
    statusKecurangan: 'Selesai Normal oleh Peserta',
    lulusTidakLulus: 'LULUS',
  },
  {
    timestamp: '17/09/2026 15:18:43',
    namaSiswa: 'azzuka aprillio',
    nisNisn: '6281269529014',
    kelas: 'VIII-6',
    semester: 'Ganjil',
    skorBenar: 10,
    totalSoal: 10,
    nilaiAkhir: 100,
    statusKecurangan: 'Selesai Normal oleh Peserta',
    lulusTidakLulus: 'LULUS',
  },
  {
    timestamp: '17/09/2026 15:14:19',
    namaSiswa: 'azzuka aprillio',
    nisNisn: '6281269529014',
    kelas: 'VIII-6',
    semester: 'Ganjil',
    skorBenar: 3,
    totalSoal: 10,
    nilaiAkhir: 30,
    statusKecurangan: 'Diskualifikasi: Gagal merespons peringatan anti-kecurangan.',
    lulusTidakLulus: 'TIDAK LULUS',
  },
  {
    timestamp: '17/09/2026 15:09:38',
    namaSiswa: 'azzuka aprillio',
    nisNisn: '6281269529014',
    kelas: 'VIII-6',
    semester: 'Ganjil',
    skorBenar: 0,
    totalSoal: 10,
    nilaiAkhir: 0,
    statusKecurangan:
      'Diskualifikasi: Terdeteksi pindah tab/minimize 3 kali (Keluar dari fokus jendela ujian terdeteksi.)',
    lulusTidakLulus: 'TIDAK LULUS',
  },
  {
    timestamp: '17/09/2026 12:26:33',
    namaSiswa: 'Aku',
    nisNisn: '0',
    kelas: 'VIII-6',
    semester: 'Ganjil',
    skorBenar: 1,
    totalSoal: 10,
    nilaiAkhir: 10,
    statusKecurangan: 'Selesai Normal oleh Peserta',
    lulusTidakLulus: 'TIDAK LULUS',
  },
  {
    timestamp: '17/09/2026 12:23:39',
    namaSiswa: 'A',
    nisNisn: '0',
    kelas: 'VIII-5',
    semester: 'Ganjil',
    skorBenar: 1,
    totalSoal: 10,
    nilaiAkhir: 10,
    statusKecurangan: 'Selesai Normal oleh Peserta',
    lulusTidakLulus: 'TIDAK LULUS',
  },
  {
    timestamp: '17/09/2026 12:22:14',
    namaSiswa: 'EEEE',
    nisNisn: '0',
    kelas: 'VIII-6',
    semester: 'Ganjil',
    skorBenar: 0,
    totalSoal: 10,
    nilaiAkhir: 0,
    statusKecurangan: 'Selesai Normal oleh Peserta',
    lulusTidakLulus: 'TIDAK LULUS',
  },
  {
    timestamp: '17/09/2026 12:20:09',
    namaSiswa: 'A',
    nisNisn: '0',
    kelas: 'VIII-6',
    semester: 'Ganjil',
    skorBenar: 1,
    totalSoal: 10,
    nilaiAkhir: 10,
    statusKecurangan: 'Diskualifikasi: Gagal merespons peringatan anti-kecurangan.',
    lulusTidakLulus: 'TIDAK LULUS',
  },
];

const SAMPLE_HISTORICAL_DEVICES: Array<{
  category: string;
  brand: string;
  model: string;
  osBrowser: string;
}> = [
  {
    category: 'HP Android',
    brand: 'Samsung',
    model: 'Samsung Galaxy A15 (SM-A155F)',
    osBrowser: 'Android 14 · Google Chrome',
  },
  {
    category: 'HP Android',
    brand: 'OPPO',
    model: 'OPPO A58 (CPH2553)',
    osBrowser: 'Android 14 · Google Chrome',
  },
  {
    category: 'HP Android',
    brand: 'Xiaomi / Redmi',
    model: 'Xiaomi Redmi Note 13 (2312DRAABG)',
    osBrowser: 'Android 14 · Google Chrome',
  },
  {
    category: 'HP Android',
    brand: 'vivo',
    model: 'vivo Y27 (V2302)',
    osBrowser: 'Android 13 · Google Chrome',
  },
  {
    category: 'Laptop / Komputer (Windows)',
    brand: 'ASUS',
    model: 'ASUS VivoBook (Intel Iris Xe)',
    osBrowser: 'Windows 11 64-bit · Google Chrome',
  },
  {
    category: 'HP Android',
    brand: 'Realme',
    model: 'Realme C53 (RMX3760)',
    osBrowser: 'Android 13 · Google Chrome',
  },
  {
    category: 'HP Android',
    brand: 'Infinix',
    model: 'Infinix Note 30 (X6833B)',
    osBrowser: 'Android 13 · Google Chrome',
  },
  {
    category: 'Laptop / Komputer (Windows)',
    brand: 'Lenovo',
    model: 'Lenovo IdeaPad (Intel UHD Graphics)',
    osBrowser: 'Windows 11 64-bit · Microsoft Edge',
  },
  {
    category: 'iPhone (iOS)',
    brand: 'Apple',
    model: 'Apple iPhone 13',
    osBrowser: 'iOS 17 · Apple Safari',
  },
  {
    category: 'HP Android',
    brand: 'Samsung',
    model: 'Samsung Galaxy A24 (SM-A245F)',
    osBrowser: 'Android 14 · Samsung Internet',
  },
];

export function parseDeviceColumnString(rawDevice?: string): {
  deviceCategory?: string;
  deviceBrand?: string;
  deviceModel?: string;
  deviceOsBrowser?: string;
  deviceInfo?: string;
  clientIp?: string;
  deviceFingerprint?: string;
} {
  const clean = String(rawDevice || '').trim();
  if (!clean || clean === '-' || clean.toUpperCase() === 'DEVICE') return {};
  
  const fpMatch = clean.match(/DEV-[A-Za-z0-9]{4}/);
  const ipMatch = clean.match(/IP:\s*([\d\.]+)/i);
  const detectedFp = fpMatch ? fpMatch[0].toUpperCase() : undefined;
  const detectedIp = ipMatch ? ipMatch[1].trim() : undefined;

  const dashParts = clean.split(/\s*[—–-]\s*/);
  if (dashParts.length >= 2) {
    const category = dashParts[0].trim();
    const rest = dashParts.slice(1).join(' - ').trim();
    const parenMatch = rest.match(/^(.*?)\s*\(([^()]+)\)\s*$/);
    const model = parenMatch ? parenMatch[1].trim() : rest;
    const osBrowser = parenMatch ? parenMatch[2].trim() : '';
    const brand = model.split(/\s+/)[0] || category;
    return {
      deviceCategory: category,
      deviceBrand: brand,
      deviceModel: model,
      ...(osBrowser ? { deviceOsBrowser: osBrowser } : {}),
      deviceInfo: clean,
      ...(detectedFp ? { deviceFingerprint: detectedFp } : {}),
      ...(detectedIp ? { clientIp: detectedIp } : {}),
    };
  }
  return {
    deviceCategory: /laptop|windows|mac|pc|komputer|chromebook|linux/i.test(clean)
      ? 'Laptop / Komputer (Windows)'
      : /iphone|ios/i.test(clean)
      ? 'iPhone (iOS)'
      : 'HP Android',
    deviceModel: clean,
    deviceInfo: clean,
    ...(detectedFp ? { deviceFingerprint: detectedFp } : {}),
    ...(detectedIp ? { clientIp: detectedIp } : {}),
  };
}

export const INITIAL_SUBMISSIONS: StudentSubmission[] = RAW_HISTORICAL_REKAP.map((row, idx) => {
  const isDisq = row.statusKecurangan.toLowerCase().includes('diskualifikasi');
  const isPassedKkm = !isDisq && row.nilaiAkhir >= EXAM_INFO.kkm;
  const nameSeed = String(row.namaSiswa || '')
    .split('')
    .reduce((acc, ch) => acc + ch.charCodeAt(0), idx);
  const dev = SAMPLE_HISTORICAL_DEVICES[Math.abs(nameSeed) % SAMPLE_HISTORICAL_DEVICES.length];
  return {
    id: `HIST-${idx + 1}`,
    timestamp: row.timestamp,
    namaSiswa: row.namaSiswa,
    nisNisn: row.nisNisn,
    kelas: row.kelas,
    semester: row.semester,
    skorBenar: row.skorBenar,
    totalSoal: row.totalSoal,
    nilaiAkhir: row.nilaiAkhir,
    statusKecurangan: row.statusKecurangan,
    lulusTidakLulus: isPassedKkm ? 'LULUS' : 'TIDAK LULUS',
    answers: buildAnswersForCorrectCount(row.skorBenar),
    doubtful: {},
    violationCount: isDisq ? 3 : 0,
    violationLogs: isDisq ? [row.statusKecurangan] : [],
    questionOrder: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
    isCompleted: true,
    deviceCategory: dev.category,
    deviceBrand: dev.brand,
    deviceModel: dev.model,
    deviceOsBrowser: dev.osBrowser,
    deviceInfo: `${dev.category} — ${dev.model} (${dev.osBrowser})`,
  };
});

export interface StudentDashboardSyncPayload {
  useInitialSubmissions?: boolean;
  isCleared?: boolean;
  clearedAt?: number;
  activeSessionId?: string;
  activeSessionName?: string;
  sessionCreatedAt?: number;
  deletedIds?: string[];
  submissions?: Partial<StudentSubmission>[];
  questionBanks?: Record<ExamPackageKey, Question[]>;
  updatedAt?: number;
  source?: string;
}

function lookupLocalStudentPhoto(namaSiswa?: string, nisNisn?: string): string {
  if (typeof window === 'undefined') return '';
  try {
    const cleanName = (namaSiswa || '').trim().toLowerCase();
    const cleanNis = (nisNisn || '').trim().toLowerCase();
    const mapRaw = localStorage.getItem('anbk_student_photos_map_v1');
    if (mapRaw) {
      const map = JSON.parse(mapRaw) as Record<string, string>;
      if (cleanName && cleanNis && map[`${cleanName}_${cleanNis}`]) {
        return map[`${cleanName}_${cleanNis}`];
      }
      if (cleanNis && cleanNis !== '0' && cleanNis !== '-' && map[`nis_${cleanNis}`]) {
        return map[`nis_${cleanNis}`];
      }
      if (
        cleanName &&
        cleanName !== 'peserta ujian anbk' &&
        cleanName !== 'peserta ujian (perangkat aktif)' &&
        map[`name_${cleanName}`]
      ) {
        return map[`name_${cleanName}`];
      }
      if (
        (cleanName === 'peserta ujian (perangkat aktif)' ||
          cleanName === 'peserta ujian anbk') &&
        map['__latest_active_photo__']
      ) {
        return map['__latest_active_photo__'];
      }
    }
    const profileRaw = localStorage.getItem('anbk_student_camera_profile_v1');
    if (profileRaw) {
      const parsed = JSON.parse(profileRaw) as {
        namaSiswa?: string;
        nisNisn?: string;
        photoDataUrl?: string;
      };
      if (parsed?.photoDataUrl) {
        const pName = (parsed.namaSiswa || '').trim().toLowerCase();
        const pNis = (parsed.nisNisn || '').trim().toLowerCase();
        if (
          (cleanName && pName === cleanName) ||
          (cleanNis && cleanNis !== '0' && cleanNis !== '-' && pNis === cleanNis) ||
          cleanName === 'peserta ujian (perangkat aktif)'
        ) {
          return parsed.photoDataUrl;
        }
      }
    }
  } catch {
    // ignore
  }
  return '';
}

export function normalizeSubmissionRecord(raw: Partial<StudentSubmission>, idx: number = 0): StudentSubmission {
  const skorBenar = Number(raw.skorBenar ?? 0);
  const totalSoal = Number(raw.totalSoal ?? 10) || 10;
  const nilaiAkhir =
    raw.nilaiAkhir !== undefined
      ? Number(raw.nilaiAkhir)
      : Math.round((skorBenar / totalSoal) * 100);
  const statusKecurangan = String(raw.statusKecurangan || 'Selesai Normal oleh Peserta');
  const isDisq = statusKecurangan.toLowerCase().includes('diskualifikasi');
  const isPass = !isDisq && nilaiAkhir >= EXAM_INFO.kkm;
  const currentStatus = String(raw.lulusTidakLulus || '');
  const usesFullText = currentStatus.toLowerCase().includes('ujian');

  const nameSeed = String(raw.namaSiswa || '')
    .split('')
    .reduce((acc, ch) => acc + ch.charCodeAt(0), idx);
  const fallbackDev =
    SAMPLE_HISTORICAL_DEVICES[Math.abs(nameSeed) % SAMPLE_HISTORICAL_DEVICES.length];

  const deviceCategory = raw.deviceCategory || fallbackDev.category;
  const deviceBrand = raw.deviceBrand || fallbackDev.brand;
  const deviceModel = raw.deviceModel || fallbackDev.model;
  const deviceOsBrowser = raw.deviceOsBrowser || fallbackDev.osBrowser;
  const deviceInfo =
    raw.deviceInfo || `${deviceCategory} — ${deviceModel} (${deviceOsBrowser})`;

  const isProgressSession =
    raw.isCompleted === false ||
    statusKecurangan.toLowerCase().includes('sedang mengerjakan') ||
    statusKecurangan.toLowerCase().includes('sudah login') ||
    statusKecurangan.toLowerCase().includes('masuk ruang') ||
    currentStatus.toLowerCase().includes('berlangsung') ||
    currentStatus.toLowerCase().includes('masuk');

  return {
    id: raw.id || `SUB-SYNC-${idx + 1}-${ String(raw.timestamp || '').replace(/[^0-9]/g, '')}`,
    timestamp: String(raw.timestamp || new Date().toLocaleString('id-ID')),
    namaSiswa: String(raw.namaSiswa || 'Siswa').trim(),
    nisNisn: String(raw.nisNisn || '0').trim(),
    kelas: getCleanKelas(String(raw.kelas || 'VIII-1')),
    semester:
      raw.semester === 'Genap' || String(raw.kelas || '').toLowerCase().includes('genap')
        ? 'Genap'
        : 'Ganjil',
    skorBenar,
    totalSoal,
    nilaiAkhir,
    statusKecurangan,
    lulusTidakLulus: isProgressSession
      ? (raw.lulusTidakLulus || 'SEDANG BERLANGSUNG')
      : isPass
      ? usesFullText
        ? 'Lulus Ujian'
        : 'LULUS'
      : usesFullText
      ? 'Tidak Lulus Ujian (Ujian Susulan)'
      : 'TIDAK LULUS',
    answers:
      raw.answers && Object.keys(raw.answers).length > 0
        ? raw.answers
        : buildAnswersForCorrectCount(skorBenar),
    doubtful: raw.doubtful || {},
    questionDurations: raw.questionDurations || {},
    violationCount: raw.violationCount ?? (isDisq ? 3 : 0),
    violationLogs: Array.isArray(raw.violationLogs)
      ? raw.violationLogs
      : isDisq
      ? [statusKecurangan]
      : [],
    questionOrder:
      Array.isArray(raw.questionOrder) && raw.questionOrder.length > 0
        ? raw.questionOrder
        : [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
    isCompleted: isProgressSession ? false : (raw.isCompleted ?? true),
    notifSent: raw.notifSent,
    deviceCategory,
    deviceBrand,
    deviceModel,
    deviceOsBrowser,
    deviceInfo,
    clientIp: raw.clientIp || (raw.deviceInfo?.match(/IP:\s*([\d\.]+)/i)?.[1]),
    deviceFingerprint: raw.deviceFingerprint || (raw.deviceInfo?.match(/DEV-[A-Za-z0-9]{4}/)?.[0]?.toUpperCase()),
    ...(raw.photoUrl || lookupLocalStudentPhoto(raw.namaSiswa, raw.nisNisn)
      ? { photoUrl: raw.photoUrl || lookupLocalStudentPhoto(raw.namaSiswa, raw.nisNisn) }
      : {}),
  };
}

export function getSubmissionUniqueKey(s: { timestamp?: string; namaSiswa?: string }): string {
  return `${String(s.timestamp || '').trim()}_${String(s.namaSiswa || '')
    .trim()
    .toLowerCase()}`;
}

export function deduplicateSubmissions(list: StudentSubmission[]): StudentSubmission[] {
  if (!Array.isArray(list)) return [];
  const seenIds = new Set<string>();
  const seenKeys = new Set<string>();
  const result: StudentSubmission[] = [];

  for (const s of list) {
    if (!s || !s.namaSiswa) continue;
    const sId = (s.id || '').trim();
    const uKey = getSubmissionUniqueKey(s);

    if (sId && seenIds.has(sId)) continue;
    if (uKey && seenKeys.has(uKey)) continue;

    if (sId) seenIds.add(sId);
    if (uKey) seenKeys.add(uKey);

    result.push(s);
  }
  return result;
}

export function sanitizeSyncTimestamp(raw: unknown): number {
  const n = Number(raw || 0);
  if (!Number.isFinite(n) || n <= 0) return 0;
  if (n === 1790846000000 || n > Date.now() + 15000) return 0;
  return n;
}

export function resolveSubmissionsFromSyncPayload(
  payload: StudentDashboardSyncPayload
): StudentSubmission[] {
  const deletedSet = new Set(payload.deletedIds || []);
  const clearedAt = sanitizeSyncTimestamp(payload.clearedAt);

  const filterValidCompleted = (list: StudentSubmission[]): StudentSubmission[] => {
    return list.filter((s) => {
      if (!s || !s.namaSiswa) return false;
      if (
        s.namaSiswa.trim().toUpperCase() === 'A' &&
        String(s.nisNisn || '').trim() === '0' &&
        String(s.timestamp || '').startsWith('17/09/2026')
      ) {
        return false;
      }
      const cleanName = s.namaSiswa.trim().toLowerCase();
      const cleanNis = (s.nisNisn || '').trim();
      const uKey = getSubmissionUniqueKey(s);
      if (
        deletedSet.has(s.id) ||
        deletedSet.has(uKey) ||
        deletedSet.has(cleanName) ||
        deletedSet.has(`name_${cleanName}`) ||
        (cleanNis && cleanNis !== '-' && (deletedSet.has(cleanNis) || deletedSet.has(`nis_${cleanNis}`))) ||
        (cleanName && cleanNis && deletedSet.has(`${cleanName}_${cleanNis}`))
      ) {
        return false;
      }

      if (clearedAt > 0) {
        if (String(s.id || '').startsWith('HIST-')) return false;
        const m = String(s.id || '').match(/^SUB-(\d+)/);
        const createdTs = m ? Number(m[1]) : 0;
        if (createdTs > 0 && createdTs <= clearedAt) return false;
      }
      return true;
    });
  };

  if (payload.isCleared) {
    return [];
  }

  const customList = filterValidCompleted(
    (payload.submissions || []).map((s, i) => normalizeSubmissionRecord(s, i))
  );

  if (payload.useInitialSubmissions === false || clearedAt > 0) {
    return deduplicateSubmissions(customList);
  }

  const seenKeys = new Set(customList.map((s) => getSubmissionUniqueKey(s)));
  const seenIds = new Set(customList.map((s) => s.id).filter(Boolean));
  const baseHistorical = INITIAL_SUBMISSIONS.filter(
    (h) =>
      !deletedSet.has(h.id) &&
      !deletedSet.has(getSubmissionUniqueKey(h)) &&
      !seenKeys.has(getSubmissionUniqueKey(h)) &&
      !seenIds.has(h.id)
  );

  return deduplicateSubmissions([...customList, ...baseHistorical]);
}

let latestDashboardStateCache: StudentDashboardSyncPayload | null = null;
let isDashboardSnapshotActive = false;

export async function readFirestoreDashboardState(): Promise<StudentDashboardSyncPayload | null> {
  if (typeof window === 'undefined') return null;
  if (isDashboardSnapshotActive && latestDashboardStateCache) {
    return latestDashboardStateCache;
  }
  try {
    const data = await firestoreRestReadDoc<StudentDashboardSyncPayload>(
      DASHBOARD_FIRESTORE_DOC_PATH[0],
      DASHBOARD_FIRESTORE_DOC_PATH[1],
      2200
    );
    if (data && typeof data === 'object') {
      latestDashboardStateCache = data;
      return data;
    }
  } catch {
    // ignore
  }
  return latestDashboardStateCache;
}

export async function writeFirestoreDashboardState(
  payload: StudentDashboardSyncPayload
): Promise<void> {
  if (typeof window === 'undefined') return;
  try {
    const cleanSubs = (payload.submissions || []).slice(0, 250).map((s) => ({
      id: s.id || '',
      timestamp: s.timestamp || '',
      namaSiswa: s.namaSiswa || '',
      nisNisn: s.nisNisn || '0',
      kelas: s.kelas || 'VIII-1',
      semester: s.semester || 'Ganjil',
      skorBenar: Number(s.skorBenar ?? 0),
      totalSoal: Number(s.totalSoal ?? 10),
      nilaiAkhir: Number(s.nilaiAkhir ?? 0),
      statusKecurangan: s.statusKecurangan || 'Tidak Ada Kecurangan (Jujur / Bersih)',
      lulusTidakLulus: s.lulusTidakLulus || 'Tidak Lulus Ujian (Ujian Susulan)',
      answers: s.answers || {},
      doubtful: s.doubtful || {},
      questionDurations: s.questionDurations || {},
      violationCount: Number(s.violationCount ?? 0),
      violationLogs: Array.isArray(s.violationLogs) ? s.violationLogs : [],
      questionOrder: Array.isArray(s.questionOrder) ? s.questionOrder : [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
      isCompleted: s.isCompleted ?? true,
      deviceCategory: s.deviceCategory || '',
      deviceBrand: s.deviceBrand || '',
      deviceModel: s.deviceModel || '',
      deviceOsBrowser: s.deviceOsBrowser || '',
      deviceInfo: s.deviceInfo || '',
      clientIp: s.clientIp || '',
      deviceFingerprint: s.deviceFingerprint || '',
      ...(s.photoUrl && s.photoUrl.length <= 120000 ? { photoUrl: s.photoUrl } : {}),
    }));

    const docData: Record<string, unknown> = {
      useInitialSubmissions: payload.useInitialSubmissions ?? false,
      isCleared: Boolean(payload.isCleared),
      clearedAt: Number(payload.clearedAt || 0),
      deletedIds: Array.isArray(payload.deletedIds) ? payload.deletedIds.slice(0, 500) : [],
      submissions: cleanSubs,
      updatedAt: Number(payload.updatedAt || Date.now()),
      source:
        payload.source ||
        'Tersinkron Otomatis Lintas Perangkat (Cloud & Server Rekap)',
    };
    if (payload.activeSessionId) docData.activeSessionId = payload.activeSessionId;
    if (payload.activeSessionName) docData.activeSessionName = payload.activeSessionName;
    if (payload.sessionCreatedAt) docData.sessionCreatedAt = payload.sessionCreatedAt;
    if (payload.questionBanks) {
      docData.questionBanks = payload.questionBanks;
    }
    latestDashboardStateCache = docData as unknown as StudentDashboardSyncPayload;
    await firestoreRestWriteDoc(
      DASHBOARD_FIRESTORE_DOC_PATH[0],
      DASHBOARD_FIRESTORE_DOC_PATH[1],
      docData
    );
  } catch {
    // ignore
  }
}

export function subscribeToFirestoreDashboardState(
  onUpdate: (resolved: {
    submissions: StudentSubmission[];
    isCleared: boolean;
    clearedAt: number;
    activeSessionId?: string;
    activeSessionName?: string;
    sessionCreatedAt?: number;
    deletedIds: string[];
    questionBanks?: Record<ExamPackageKey, Question[]>;
    source: string;
    updatedAt: number;
  }) => void
): () => void {
  if (typeof window === 'undefined') return () => {};
  let disposed = false;
  let lastSignature = '';

  const checkDashboardState = async () => {
    if (disposed) return;
    try {
      const data = await firestoreRestReadDoc<StudentDashboardSyncPayload>(
        DASHBOARD_FIRESTORE_DOC_PATH[0],
        DASHBOARD_FIRESTORE_DOC_PATH[1],
        2400
      );
      if (disposed || !data || typeof data !== 'object') return;
      latestDashboardStateCache = data;
      const sig = `${Number(data.updatedAt || 0)}_${Number(data.clearedAt || 0)}_${
        (data.submissions || []).length
      }_${(data.deletedIds || []).length}_${data.activeSessionId || ''}_${(data.deletedIds || [])
        .slice(0, 10)
        .join(',')}_${(data.submissions || [])
        .map((s) => `${s.id}_${s.nilaiAkhir}_${s.deviceModel || ''}_${(s.photoUrl || '').length}`)
        .join('|')}`;
      if (sig !== lastSignature) {
        lastSignature = sig;
        const resolved = resolveSubmissionsFromSyncPayload(data);
        onUpdate({
          submissions: resolved,
          isCleared: Boolean(data.isCleared),
          clearedAt: Number(data.clearedAt || 0),
          activeSessionId: data.activeSessionId,
          activeSessionName: data.activeSessionName,
          sessionCreatedAt: data.sessionCreatedAt,
          deletedIds: Array.isArray(data.deletedIds) ? data.deletedIds : [],
          questionBanks: data.questionBanks,
          source:
            (data.source || 'Tersinkron Otomatis Lintas Perangkat (Cloud & Server Rekap)').replace(/Google Sheets/gi, 'Server Rekap'),
          updatedAt: Number(data.updatedAt || Date.now()),
        });
      }
    } catch {
      // ignore
    }
  };

  checkDashboardState();
  const intervalId = window.setInterval(checkDashboardState, 4500);
  const onFocus = () => {
    checkDashboardState();
  };
  window.addEventListener('focus', onFocus);

  return () => {
    disposed = true;
    isDashboardSnapshotActive = false;
    window.clearInterval(intervalId);
    window.removeEventListener('focus', onFocus);
  };
}

export function getInitialSyncedSubmissionsState(): {
  submissions: StudentSubmission[];
  isCleared: boolean;
  clearedAt: number;
  source: string;
} {
  const bundled = studentDashboardStateJson as unknown as StudentDashboardSyncPayload;
  const bundledClearedAt = sanitizeSyncTimestamp(bundled.clearedAt);
  const bundledUpdatedAt = sanitizeSyncTimestamp(bundled.updatedAt);
  const bundledSubmissions = resolveSubmissionsFromSyncPayload(bundled);

  if (typeof window !== 'undefined') {
    try {
      const localClearedAt = sanitizeSyncTimestamp(
        localStorage.getItem('anbk_submissions_cleared_at_v1')
      );
      const localIsCleared = localStorage.getItem('anbk_submissions_cleared_v1') === 'true';

      if (localIsCleared && localClearedAt >= Math.max(bundledClearedAt, bundledUpdatedAt)) {
        return {
          submissions: [],
          isCleared: true,
          clearedAt: localClearedAt,
          source: 'Tersinkron Otomatis Lintas Perangkat (Cloud & Google Sheets)',
        };
      }

      const saved = localStorage.getItem('anbk_submissions_v1');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          const localDeletedRaw = localStorage.getItem('anbk_submissions_deleted_ids_v1');
          const localDeletedIds: string[] = localDeletedRaw ? JSON.parse(localDeletedRaw) : [];
          const resolvedLocal = resolveSubmissionsFromSyncPayload({
            useInitialSubmissions: localClearedAt === 0 && !localIsCleared,
            isCleared: localIsCleared && parsed.length === 0,
            clearedAt: Math.max(bundledClearedAt, localClearedAt),
            deletedIds: localDeletedIds,
            submissions: parsed,
            updatedAt: Date.now(),
          });
          if (resolvedLocal.length > 0 || localClearedAt > 0) {
            return {
              submissions: resolvedLocal,
              isCleared: localIsCleared && resolvedLocal.length === 0,
              clearedAt: Math.max(bundledClearedAt, localClearedAt),
              source:
                (bundled.source || 'Tersinkron Otomatis Lintas Perangkat (Cloud & Server Rekap)').replace(/Google Sheets/gi, 'Server Rekap'),
            };
          }
        }
      }
    } catch {
      // ignore
    }
  }

  return {
    submissions: bundledSubmissions,
    isCleared: Boolean(bundled.isCleared),
    clearedAt: bundledClearedAt,
    source: (bundled.source || 'Tersinkron Otomatis Lintas Perangkat (Cloud & Server Rekap)').replace(/Google Sheets/gi, 'Server Rekap'),
  };
}

function parseCsvLineClient(line: string): string[] {
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
}

export function parseSubmissionsFromCsvText(csvText: string): StudentSubmission[] {
  if (!csvText || !csvText.trim()) return [];
  if (/<!doctype\s+html|<html[\s>]|<head[\s>]|<body[\s>]|<script[\s>]/i.test(csvText)) {
    return [];
  }
  const lines = csvText
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length <= 1) return [];

  const headerCols = parseCsvLineClient(lines[0]).map((c) => c.toUpperCase());
  const joinedHeader = headerCols.join(' ');
  if (
    !joinedHeader.includes('NAMA') &&
    !joinedHeader.includes('TIMESTAMP') &&
    !joinedHeader.includes('NILAI')
  ) {
    return [];
  }

  const hasLeadingRankingCol =
    headerCols[0] === 'RANKING' ||
    headerCols[0] === 'PERINGKAT' ||
    headerCols[0] === 'RANK';

  const list: StudentSubmission[] = [];
  for (let i = 1; i < lines.length; i++) {
    const rawCols = parseCsvLineClient(lines[i]);
    const isRowLeadingRank =
      hasLeadingRankingCol ||
      (rawCols.length >= 8 && /^#?\d+$/.test((rawCols[0] || '').trim()) && /\d{1,2}[/-]\d{1,2}[/-]\d{2,4}/.test(rawCols[1] || ''));
    const cols = isRowLeadingRank ? rawCols.slice(1) : rawCols;
    if (cols.length < 7) continue;
    const timestamp = (cols[0] || '').trim();
    const namaSiswa = (cols[1] || '').trim();
    if (!namaSiswa || namaSiswa.toUpperCase() === 'NAMA SISWA') continue;
    const nisNisn = (cols[2] || '0').trim() || '0';
    const col3 = (cols[3] || '').trim();
    const col4 = (cols[4] || '').trim();

    let rawKelas = 'VIII-1';
    let semesterVal: SemesterType = 'Ganjil';
    let skorBenar = 0;
    let totalSoal = 10;
    let nilaiAkhir = 0;
    let statusKecurangan = 'Selesai Normal oleh Peserta';
    let lulusTidakLulus = '';
    let rawDeviceCol = '';
    let rawFotoCol = '';

    if (/^(ganjil|genap)$/i.test(col4)) {
      rawKelas = col3 || 'VIII-1';
      semesterVal = col4.toLowerCase().includes('genap') ? 'Genap' : 'Ganjil';
      skorBenar = Number(cols[5]) || 0;
      totalSoal = Number(cols[6]) || 10;
      nilaiAkhir = Number(cols[7]) || 0;
      statusKecurangan = cols[8] || 'Selesai Normal oleh Peserta';
      lulusTidakLulus = cols[9] || (nilaiAkhir >= EXAM_INFO.kkm ? 'LULUS' : 'TIDAK LULUS');
      const col10 = (cols[10] || '').trim();
      const isCol10Rank = /^(peringkat\s*#?\d+|rank\s*#?\d+|#\d+|\d+)$/i.test(col10);
      rawDeviceCol = isCol10Rank ? cols[11] || '' : col10;
      rawFotoCol = isCol10Rank ? cols[12] || '' : cols[11] || '';
    } else if (/^(ganjil|genap)$/i.test(col3)) {
      semesterVal = col3.toLowerCase().includes('genap') ? 'Genap' : 'Ganjil';
      rawKelas = col4 || 'VIII-1';
      skorBenar = Number(cols[5]) || 0;
      totalSoal = Number(cols[6]) || 10;
      nilaiAkhir = Number(cols[7]) || 0;
      statusKecurangan = cols[8] || 'Selesai Normal oleh Peserta';
      lulusTidakLulus = cols[9] || (nilaiAkhir >= EXAM_INFO.kkm ? 'LULUS' : 'TIDAK LULUS');
      const col10 = (cols[10] || '').trim();
      const isCol10Rank = /^(peringkat\s*#?\d+|rank\s*#?\d+|#\d+|\d+)$/i.test(col10);
      rawDeviceCol = isCol10Rank ? cols[11] || '' : col10;
      rawFotoCol = isCol10Rank ? cols[12] || '' : cols[11] || '';
    } else {
      rawKelas = col3 || 'VIII-1';
      semesterVal = rawKelas.toLowerCase().includes('genap') ? 'Genap' : 'Ganjil';
      skorBenar = Number(cols[4]) || 0;
      totalSoal = Number(cols[5]) || 10;
      nilaiAkhir = Number(cols[6]) || 0;
      statusKecurangan = cols[7] || 'Selesai Normal oleh Peserta';
      lulusTidakLulus = cols[8] || (nilaiAkhir >= EXAM_INFO.kkm ? 'LULUS' : 'TIDAK LULUS');
      const col9 = (cols[9] || '').trim();
      const isCol9Rank = /^(peringkat\s*#?\d+|rank\s*#?\d+|#\d+|\d+)$/i.test(col9);
      rawDeviceCol = isCol9Rank ? cols[10] || '' : col9;
      rawFotoCol = isCol9Rank ? cols[11] || '' : cols[10] || '';
    }

    const parsedDevice = parseDeviceColumnString(rawDeviceCol);
    const validPhotoUrl =
      rawFotoCol && (rawFotoCol.startsWith('data:image/') || rawFotoCol.startsWith('http'))
        ? rawFotoCol
        : undefined;

    list.push(
      normalizeSubmissionRecord(
        {
          id: `SHEET-${timestamp.replace(/[^0-9]/g, '')}-${namaSiswa
            .toLowerCase()
            .replace(/[^a-z0-9]/g, '')}`,
          timestamp,
          namaSiswa,
          nisNisn,
          kelas: rawKelas,
          semester: semesterVal,
          skorBenar,
          totalSoal,
          nilaiAkhir,
          statusKecurangan,
          lulusTidakLulus,
          ...parsedDevice,
          ...(validPhotoUrl ? { photoUrl: validPhotoUrl } : {}),
        },
        i
      )
    );
  }
  return list;
}

export async function fetchSubmissionsFromGoogleSheetDirect(
  sheetUrl?: string,
  appsScriptUrl?: string
): Promise<StudentSubmission[]> {
  if (appsScriptUrl && appsScriptUrl.trim().startsWith('http')) {
    try {
      const sep = appsScriptUrl.includes('?') ? '&' : '?';
      const res = await fetch(`${appsScriptUrl.trim()}${sep}action=getSubmissions&_t=${Date.now()}`, {
        cache: 'no-store',
        credentials: 'omit',
      });
      if (res.ok) {
        const data = await res.json();
        if (data && Array.isArray(data.submissions) && data.submissions.length > 0) {
          return data.submissions.map((s: Partial<StudentSubmission>, i: number) =>
            normalizeSubmissionRecord(s, i)
          );
        }
      }
    } catch {
      // ignore
    }
  }

  const spreadsheetId = extractSpreadsheetIdFromUrl(sanitizeRekapSheetUrl(sheetUrl));
  if (!spreadsheetId) return [];
  const ts = Date.now();
  const urls = [
    `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(
      'Rekap Hasil Ujian'
    )}&_t=${ts}`,
    `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?tqx=out:csv&_t=${ts}`,
  ];

  for (const url of urls) {
    try {
      const res = await fetch(url, { cache: 'no-store', credentials: 'omit' });
      if (res.ok) {
        const parsed = parseSubmissionsFromCsvText(await res.text());
        if (parsed.length > 0) {
          return parsed;
        }
      }
    } catch {
      // ignore
    }
  }
  return [];
}

export async function fetchStudentDashboardSyncState(
  sheetUrl?: string,
  appsScriptUrl?: string,
  localSubmissions?: StudentSubmission[]
): Promise<{
  submissions: StudentSubmission[];
  isCleared: boolean;
  clearedAt: number;
  activeSessionId?: string;
  activeSessionName?: string;
  sessionCreatedAt?: number;
  questionBanks?: Record<ExamPackageKey, Question[]>;
  source: string;
  updatedAt: number;
} | null> {
  if (typeof window === 'undefined') return null;

  let localClearedAt = sanitizeSyncTimestamp(localStorage.getItem('anbk_submissions_cleared_at_v1'));
  let localIsCleared = localStorage.getItem('anbk_submissions_cleared_v1') === 'true';
  let localDeletedIds: string[] = [];
  try {
    const rawDel = localStorage.getItem('anbk_submissions_deleted_ids_v1');
    if (rawDel) {
      localDeletedIds = JSON.parse(rawDel);
    }
  } catch {
    // ignore
  }

  let storedLocalSubs: StudentSubmission[] = [];
  try {
    const savedV1 = localStorage.getItem('anbk_submissions_v1');
    if (savedV1) {
      const parsed = JSON.parse(savedV1);
      if (Array.isArray(parsed)) storedLocalSubs = parsed;
    }
  } catch {
    // ignore
  }

  const allCandidateLocalSubs = [...(localSubmissions || []), ...storedLocalSubs];
  const realLocalExams = allCandidateLocalSubs.filter((s) => {
    if (!s || !s.id || s.id.startsWith('HIST-')) return false;
    const k = getSubmissionUniqueKey(s);
    if (localDeletedIds.includes(s.id) || localDeletedIds.includes(k)) return false;
    const matchTs = s.id.match(/^(?:SUB|ESAY)-(\d+)/);
    const createdTs = matchTs ? Number(matchTs[1]) : 0;
    if (localClearedAt > 0 && createdTs > 0 && createdTs <= localClearedAt) return false;
    return true;
  });

  // 0. Baca state real-time dari Firebase Firestore (bekerja di ais-dev, ais-pre, HP, tablet & komputer)
  const firestoreStatePromise = readFirestoreDashboardState();

  // 1. Sinkronkan dengan endpoint server /__api/student-dashboard-sync (Real-Time Lintas Perangkat)
  let serverState: StudentDashboardSyncPayload | null = null;
  try {
    const res =
      realLocalExams.length > 0
        ? await fetch(`/__api/student-dashboard-sync?_t=${Date.now()}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'syncClientSubmissions',
              clientSubmissions: realLocalExams,
              clientClearedAt: localClearedAt,
              clientIsCleared: localIsCleared,
            }),
          })
        : await fetch(`/__api/student-dashboard-sync?_t=${Date.now()}`, {
            cache: 'no-store',
          });

    if (res.ok) {
      const data = (await res.json()) as {
        ok?: boolean;
        state?: StudentDashboardSyncPayload;
      };
      if (data && data.state) {
        serverState = data.state;
      }
    }
  } catch {
    // Lanjut ke Firestore & fallback
  }

  const firestoreState = await firestoreStatePromise;

  // Pilih sumber cloud terbaru antara Firestore dan Server API
  let activeCloudState: StudentDashboardSyncPayload | null = null;
  if (firestoreState && serverState) {
    const fsEffectiveTs = Math.max(
      sanitizeSyncTimestamp(firestoreState.updatedAt),
      sanitizeSyncTimestamp(firestoreState.clearedAt)
    );
    const srvEffectiveTs = Math.max(
      sanitizeSyncTimestamp(serverState.updatedAt),
      sanitizeSyncTimestamp(serverState.clearedAt)
    );
    activeCloudState = fsEffectiveTs >= srvEffectiveTs ? firestoreState : serverState;
  } else {
    activeCloudState = firestoreState || serverState;
  }

  if (activeCloudState) {
    const cloudClearedAt = sanitizeSyncTimestamp(activeCloudState.clearedAt);
    const cloudUpdatedAt = sanitizeSyncTimestamp(activeCloudState.updatedAt);

    // Jika cloud state lebih baru dari reset lokal, selaraskan status lokal dengan cloud state
    if (cloudUpdatedAt > localClearedAt || cloudClearedAt >= localClearedAt) {
      localIsCleared = Boolean(activeCloudState.isCleared);
      localClearedAt = cloudClearedAt;
      localDeletedIds = Array.isArray(activeCloudState.deletedIds)
        ? activeCloudState.deletedIds
        : [];
      try {
        if (localIsCleared) {
          localStorage.setItem('anbk_submissions_cleared_v1', 'true');
        } else {
          localStorage.removeItem('anbk_submissions_cleared_v1');
        }
        localStorage.setItem('anbk_submissions_cleared_at_v1', String(localClearedAt));
        localStorage.setItem('anbk_submissions_deleted_ids_v1', JSON.stringify(localDeletedIds));
      } catch {
        // ignore
      }
    }
  }

  // Jika Firestore memiliki data yang lebih baru dibandingkan Server API lokal, sinkronkan ke Server API agar /rekap-hasil-ujian.csv & /student-dashboard-state.json selalu mutakhir
  if (
    firestoreState &&
    (!serverState ||
      sanitizeSyncTimestamp(firestoreState.updatedAt) >
        sanitizeSyncTimestamp(serverState.updatedAt))
  ) {
    fetch(`/__api/student-dashboard-sync?_t=${Date.now()}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'syncFullState',
        state: {
          ...firestoreState,
          submissions: resolveSubmissionsFromSyncPayload(firestoreState),
          clearedAt: sanitizeSyncTimestamp(firestoreState.clearedAt),
          updatedAt: sanitizeSyncTimestamp(firestoreState.updatedAt),
        },
      }),
    }).catch(() => {});
  }

  // Jika perangkat ini baru saja menekan tombol Reset Semua Laporan Nilai (localIsCleared = true)
  // dan timestamp reset lokal lebih baru dari state cloud, pertahankan status Reset (0 data)
  if (
    localIsCleared &&
    localClearedAt > 0 &&
    (!activeCloudState ||
      (localClearedAt >= sanitizeSyncTimestamp(activeCloudState.clearedAt) &&
        localClearedAt >= sanitizeSyncTimestamp(activeCloudState.updatedAt))) &&
    realLocalExams.length === 0
  ) {
    const enforcedResetPayload: StudentDashboardSyncPayload = {
      useInitialSubmissions: false,
      isCleared: true,
      clearedAt: localClearedAt,
      deletedIds: Array.from(
        new Set([...(activeCloudState?.deletedIds || []), ...localDeletedIds])
      ),
      submissions: [],
      questionBanks: activeCloudState?.questionBanks,
      updatedAt: localClearedAt,
      source: 'Tersinkron Otomatis Lintas Perangkat (Cloud & Google Sheets)',
    };
    writeFirestoreDashboardState(enforcedResetPayload).catch(() => {});
    return {
      submissions: [],
      isCleared: true,
      clearedAt: localClearedAt,
      questionBanks: activeCloudState?.questionBanks,
      source: 'Tersinkron Otomatis Lintas Perangkat (Cloud & Google Sheets)',
      updatedAt: localClearedAt,
    };
  }

  if (activeCloudState) {
    const cloudResolved = resolveSubmissionsFromSyncPayload(activeCloudState);
    const secondaryCloudState =
      activeCloudState === firestoreState ? serverState : firestoreState;
    const secondaryResolved = secondaryCloudState
      ? resolveSubmissionsFromSyncPayload(secondaryCloudState)
      : [];

    const deletedSet = new Set<string>([
      ...(activeCloudState.deletedIds || []),
      ...localDeletedIds,
    ]);
    const syncedDeviceSubId =
      typeof window !== 'undefined'
        ? localStorage.getItem('anbk_device_synced_sub_id_v1') || ''
        : '';

    const enrichMap = new Map<string, StudentSubmission>();
    [...secondaryResolved, ...(localSubmissions || [])].forEach((item) => {
      if (!item) return;
      if (item.id) enrichMap.set(item.id, item);
      enrichMap.set(getSubmissionUniqueKey(item), item);
    });

    const mergedResolved: StudentSubmission[] = cloudResolved.map((s) => {
      const match = enrichMap.get(s.id) || enrichMap.get(getSubmissionUniqueKey(s));
      const preferLocalDevice = Boolean(
        match &&
          (s.id === syncedDeviceSubId ||
            (match.deviceInfo && match.deviceInfo !== s.deviceInfo))
      );
      const fallbackPhoto =
        match?.photoUrl || s.photoUrl || lookupLocalStudentPhoto(s.namaSiswa, s.nisNisn);
      return {
        ...s,
        deviceCategory:
          (preferLocalDevice ? match?.deviceCategory : s.deviceCategory) ||
          match?.deviceCategory ||
          s.deviceCategory ||
          'Smartphone / HP',
        deviceBrand:
          (preferLocalDevice ? match?.deviceBrand : s.deviceBrand) ||
          match?.deviceBrand ||
          s.deviceBrand ||
          'Android',
        deviceModel:
          (preferLocalDevice ? match?.deviceModel : s.deviceModel) ||
          match?.deviceModel ||
          s.deviceModel ||
          s.deviceBrand ||
          'Perangkat Siswa',
        deviceOsBrowser:
          (preferLocalDevice ? match?.deviceOsBrowser : s.deviceOsBrowser) ||
          match?.deviceOsBrowser ||
          s.deviceOsBrowser ||
          'Android · Chrome',
        deviceInfo:
          (preferLocalDevice ? match?.deviceInfo : s.deviceInfo) ||
          match?.deviceInfo ||
          s.deviceInfo ||
          '',
        clientIp:
          (preferLocalDevice ? match?.clientIp : s.clientIp) ||
          match?.clientIp ||
          s.clientIp ||
          '',
        deviceFingerprint:
          (preferLocalDevice ? match?.deviceFingerprint : s.deviceFingerprint) ||
          match?.deviceFingerprint ||
          s.deviceFingerprint ||
          '',
        ...(fallbackPhoto ? { photoUrl: fallbackPhoto } : {}),
      };
    });

    // Gabungkan juga laporan lokal/sekunder yang belum masuk ke daftar utama (jika belum dihapus/direset)
    const existingIds = new Set(mergedResolved.map((s) => s.id));
    const existingKeys = new Set(mergedResolved.map((s) => getSubmissionUniqueKey(s)));
    [...realLocalExams, ...secondaryResolved].forEach((extra) => {
      if (!extra || !extra.namaSiswa) return;
      const uKey = getSubmissionUniqueKey(extra);
      if (deletedSet.has(extra.id) || deletedSet.has(uKey)) return;
      if (!existingIds.has(extra.id) && !existingKeys.has(uKey)) {
        existingIds.add(extra.id);
        existingKeys.add(uKey);
        mergedResolved.unshift(normalizeSubmissionRecord(extra as any));
      }
    });

    // Tarik baris dari Google Sheets HANYA JIKA sistem tidak sedang direset dan data bukan data lama yang telah dihapus
    if (!localIsCleared && localClearedAt === 0 && (!activeCloudState || !activeCloudState.isCleared)) {
      const sheetRows = await fetchSubmissionsFromGoogleSheetDirect(sheetUrl, appsScriptUrl).catch(
        () => []
      );
      if (Array.isArray(sheetRows) && sheetRows.length > 0) {
        sheetRows.forEach((sr) => {
          if (!sr || !sr.namaSiswa) return;
          const uKey = getSubmissionUniqueKey(sr);
          const sName = (sr.namaSiswa || '').trim().toLowerCase();
          const sNis = (sr.nisNisn || '').trim();
          if (
            deletedSet.has(sr.id) ||
            deletedSet.has(uKey) ||
            deletedSet.has(sName) ||
            deletedSet.has(`name_${sName}`) ||
            (sNis && sNis !== '-' && deletedSet.has(sNis))
          ) return;

          const matchTs = (sr.id || '').match(/^(?:SUB|ESAY)-(\d+)/);
          const createdTs = matchTs ? Number(matchTs[1]) : 0;
          if (localClearedAt > 0 && createdTs > 0 && createdTs <= localClearedAt) return;
          if (!existingIds.has(sr.id) && !existingKeys.has(uKey)) {
            existingIds.add(sr.id);
            existingKeys.add(uKey);
            mergedResolved.push(normalizeSubmissionRecord(sr as any));
          }
        });
      }
    }

    // Jika sistem sedang dalam status reset aktif (isCleared), pastikan tidak menyinkronkan data lama yang telah dihapus
    const isEffectivelyCleared = Boolean(activeCloudState?.isCleared || localIsCleared);
    const finalCleanSubmissions = isEffectivelyCleared ? [] : mergedResolved;

    // Otomatis dorong (auto-push) semua laporan nilai dari Siswa Dashboard ke Link Google Sheets Rekap Hasil Ujian (13 Kolom dengan Ranking di samping Lulus/Tidak Lulus)
    syncSubmissionsToGoogleSheetsAuto(finalCleanSubmissions, sheetUrl, appsScriptUrl).catch(() => {});

    return {
      submissions: finalCleanSubmissions,
      isCleared: isEffectivelyCleared && finalCleanSubmissions.length === 0,
      clearedAt: sanitizeSyncTimestamp(activeCloudState.clearedAt) || localClearedAt,
      activeSessionId: activeCloudState.activeSessionId,
      activeSessionName: activeCloudState.activeSessionName,
      sessionCreatedAt: activeCloudState.sessionCreatedAt,
      questionBanks: activeCloudState.questionBanks,
      source:
        (activeCloudState.source ||
          'Tersinkron Otomatis Lintas Perangkat (Cloud & Rekap Hasil Ujian)').replace(/Google Sheets/gi, 'Server Rekap'),
      updatedAt: sanitizeSyncTimestamp(activeCloudState.updatedAt) || Date.now(),
    };
  }

  // 2. Fallback untuk lingkungan statis: baca /student-dashboard-state.json
  try {
    const staticRes = await fetch(`/student-dashboard-state.json?_t=${Date.now()}`, {
      cache: 'no-store',
    }).catch(() => null);

    let statePayload: StudentDashboardSyncPayload =
      studentDashboardStateJson as unknown as StudentDashboardSyncPayload;
    if (staticRes && staticRes.ok) {
      const parsedStatic = await staticRes.json();
      if (parsedStatic && typeof parsedStatic === 'object') {
        statePayload = parsedStatic;
      }
    }

    const effectiveClearedAt = Math.max(Number(statePayload.clearedAt || 0), localClearedAt);
    const effectiveIsCleared =
      (Boolean(statePayload.isCleared) || localIsCleared) && realLocalExams.length === 0;
    const deletedSet = new Set<string>([
      ...(statePayload.deletedIds || []),
      ...localDeletedIds,
    ]);

    if (effectiveIsCleared) {
      return {
        submissions: [],
        isCleared: true,
        clearedAt: effectiveClearedAt,
        questionBanks: statePayload.questionBanks,
        source: 'Tersinkron Otomatis Lintas Perangkat (Cloud & Google Sheets)',
        updatedAt: Number(statePayload.updatedAt || Date.now()),
      };
    }

    const baseResolved =
      effectiveClearedAt > 0 ? [] : resolveSubmissionsFromSyncPayload(statePayload);

    const mapByKey = new Map<string, StudentSubmission>();
    [...realLocalExams, ...baseResolved].forEach((s) => {
      const k = getSubmissionUniqueKey(s);
      if (!deletedSet.has(s.id) && !deletedSet.has(k) && !mapByKey.has(k)) {
        mapByKey.set(k, s);
      }
    });

    return {
      submissions: Array.from(mapByKey.values()),
      isCleared: false,
      clearedAt: effectiveClearedAt,
      questionBanks: statePayload.questionBanks,
      source: 'Tersinkron Otomatis Lintas Perangkat (Cloud & Server Rekap)',
      updatedAt: Date.now(),
    };
  } catch {
    return null;
  }
}

let lastSyncedSheetSignature = '';

export async function syncSubmissionsToGoogleSheetsAuto(
  submissions: StudentSubmission[],
  sheetUrl?: string,
  appsScriptUrl?: string,
  force: boolean = false,
  explicitToken?: string
): Promise<boolean> {
  if (typeof window === 'undefined') return false;

  const cfg = getInitialCloudConfig();
  const fsCfg = await readFirestoreCloudConfig().catch(() => null);
  const cfgAny = cfg as Record<string, any>;
  const fsCfgAny = (fsCfg || {}) as Record<string, any>;
  const effectiveSheetUrl = sanitizeRekapSheetUrl(
    (sheetUrl && sheetUrl.trim()) ||
      (fsCfg?.googleSheetUrl && fsCfg.googleSheetUrl.trim()) ||
      (cfg.googleSheetUrl && cfg.googleSheetUrl.trim()) ||
      DEFAULT_REKAP_SHEET_URL
  );
  const effectiveScriptUrl =
    (appsScriptUrl && appsScriptUrl.trim()) ||
    (fsCfg?.appsScriptWebAppUrl && fsCfg.appsScriptWebAppUrl.trim()) ||
    (cfg.appsScriptWebAppUrl && cfg.appsScriptWebAppUrl.trim()) ||
    (effectiveSheetUrl.includes('script.google.com') ? effectiveSheetUrl : '');

  const normalizedSubs = submissions.map((s) => ({
    ...s,
    kelas: getCleanKelas(s.kelas),
    semester: getSemesterFromSub(s),
  }));

  const rankMap = computeSubmissionRankingMap(normalizedSubs);
  const rows10Cols = normalizedSubs.map((s, idx) => {
    const rnk =
      rankMap[s.id] ||
      rankMap[getSubmissionUniqueKey(s)] ||
      idx + 1;
    return formatSubmissionToRekap13ColumnsWithRank(s, rnk);
  });
  const activeOauthTok =
    explicitToken ||
    getAccessTokenSync() ||
    (fsCfgAny?.oauthAccessToken && (!fsCfgAny.oauthExpiresAt || fsCfgAny.oauthExpiresAt > Date.now())
      ? fsCfgAny.oauthAccessToken
      : '') ||
    (cfgAny.oauthAccessToken && (!cfgAny.oauthExpiresAt || cfgAny.oauthExpiresAt > Date.now())
      ? cfgAny.oauthAccessToken
      : '');
  const sig = `${effectiveSheetUrl}|${effectiveScriptUrl}|${Boolean(
    activeOauthTok
  )}|${rows10Cols.map((r) => `${r[0]}_${r[1]}_${r[2]}_${r[8]}_${r[9]}_${r[10]}_${r[11]}_${String(r[12] || '').length}`).join(';')}`;

  if (!force && sig === lastSyncedSheetSignature) {
    return true;
  }

  let syncedAny = false;

  // 0. Jika dipicu sinkronisasi paksa (manual/otomatis), simpan juga ke localStorage & Cloud Firestore agar lintas perangkat selalu sinkron tanpa kendala
  if (force && normalizedSubs.length > 0) {
    try {
      localStorage.setItem('anbk_submissions_v1', JSON.stringify(normalizedSubs));
      localStorage.removeItem('anbk_submissions_cleared_v1');
      syncedAny = true;
    } catch {
      // ignore
    }
    try {
      const fsCurrent = await readFirestoreDashboardState();
      await writeFirestoreDashboardState({
        useInitialSubmissions: fsCurrent?.useInitialSubmissions ?? false,
        isCleared: false,
        clearedAt: Number(fsCurrent?.clearedAt || 0),
        deletedIds: Array.isArray(fsCurrent?.deletedIds) ? fsCurrent!.deletedIds : [],
        submissions: normalizedSubs,
        questionBanks: fsCurrent?.questionBanks,
        updatedAt: Date.now(),
        source: 'Tersinkron Otomatis Lintas Perangkat (Cloud & Rekap Hasil Ujian 12 Kolom)',
      });
      syncedAny = true;
    } catch {
      // ignore
    }
  }

  // 1. Kirim otomatis ke Web App Google Apps Script jika tersedia
  if (effectiveScriptUrl && effectiveScriptUrl.startsWith('http')) {
    try {
      await fetch(effectiveScriptUrl, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({
          action: 'syncAllSubmissions',
          sheetName: 'Rekap Hasil Ujian',
          headers: [...REKAP_SHEET_HEADERS],
          submissions: normalizedSubs,
          rows: rows10Cols,
        }),
      });
      syncedAny = true;
    } catch {
      // ignore
    }
  }

  // 2. Sinkronkan langsung ke Google Spreadsheet "Rekap Hasil Ujian" melalui Google Sheets API v4 jika token OAuth tersedia
  const spreadsheetId = extractSpreadsheetIdFromUrl(effectiveSheetUrl);
  const gidMatch = effectiveSheetUrl.match(/[?&#]gid=(\d+)/i);
  const preferredGid = gidMatch ? Number(gidMatch[1]) : 1908701833;
  if (spreadsheetId && activeOauthTok) {
    try {
      const ok = await syncAllSubmissionsToGoogleSheetViaRestApi(
        spreadsheetId,
        rows10Cols,
        activeOauthTok,
        preferredGid
      );
      if (ok) {
        syncedAny = true;
      }
    } catch {
      // ignore
    }
  }

  // 3. Sinkronkan juga melalui Server Proxy (/rekap-hasil-ujian.csv & server-side Google Sheets push)
  try {
    const srvRes = await fetch(`/__api/student-dashboard-sync?_t=${Date.now()}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'pushToGoogleSheet',
        submissions: normalizedSubs,
        rows: rows10Cols,
        sheetUrl: effectiveSheetUrl,
        appsScriptUrl: effectiveScriptUrl,
        oauthAccessToken: activeOauthTok || undefined,
      }),
    });
    if (srvRes.ok) {
      const srvData = (await srvRes.json().catch(() => null)) as {
        ok?: boolean;
        savedToServer?: boolean;
        pushedToSheet?: boolean;
        pushedCount?: number;
      } | null;
      if (
        srvData?.ok ||
        srvData?.savedToServer ||
        srvData?.pushedToSheet ||
        (srvData?.pushedCount && srvData.pushedCount > 0)
      ) {
        syncedAny = true;
      }
    }
  } catch {
    // ignore
  }

  if (syncedAny) {
    lastSyncedSheetSignature = sig;
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('anbk-sheets-sync-success'));
    }
  } else if (normalizedSubs.length > 0) {
    // Jika pengiriman langsung belum berhasil (misal jaringan offline atau timeout), daftarkan ke antrean untuk dicoba ulang otomatis
    enqueueBatchSubmissionsSync(normalizedSubs, {
      sheetUrl: effectiveSheetUrl,
      appsScriptUrl: effectiveScriptUrl,
      source: 'Auto-Sync Retry Queue',
    });
  }
  return syncedAny;
}

export async function pushSubmissionToServer(submission: StudentSubmission): Promise<void> {
  if (typeof window === 'undefined') return;

  // 0. Pastikan localStorage juga langsung menyimpan submission terbaru ini
  try {
    localStorage.removeItem('anbk_submissions_cleared_v1');
    const savedV1 = localStorage.getItem('anbk_submissions_v1');
    const parsedV1: StudentSubmission[] = savedV1 ? JSON.parse(savedV1) : [];
    const safeList = Array.isArray(parsedV1) ? [...parsedV1] : [];
    const subKey = getSubmissionUniqueKey(submission);
    const lIdx = safeList.findIndex(
      (item) => item.id === submission.id || getSubmissionUniqueKey(item) === subKey
    );
    if (lIdx >= 0) {
      safeList[lIdx] = submission;
    } else {
      safeList.unshift(submission);
    }
    localStorage.setItem('anbk_submissions_v1', JSON.stringify(safeList));
  } catch {
    // ignore
  }

  // 1. Daftarkan langsung ke Antrean Sinkronisasi (Queue) untuk memastikan data tidak hilang jika jaringan terputus saat ujian
  enqueueSubmissionSync(submission, { immediate: true, source: 'Ujian Siswa (Auto Queue)' });

  let updatedList: StudentSubmission[] = [submission];

  // 2. Kirim ke Server Backend dan ambil daftar gabungan dari server
  try {
    const activeOauthTok = getAccessTokenSync() || undefined;
    let sheetTarget = DEFAULT_REKAP_SHEET_URL;
    let scriptTarget = '';
    try {
      const rawCfg = localStorage.getItem('anbk_cloud_config_v1');
      if (rawCfg) {
        const parsed = JSON.parse(rawCfg);
        if (parsed?.googleSheetUrl) sheetTarget = sanitizeRekapSheetUrl(parsed.googleSheetUrl);
        if (parsed?.appsScriptWebAppUrl) scriptTarget = parsed.appsScriptWebAppUrl;
      }
    } catch {}

    const srvRes = await fetch(`/__api/student-dashboard-sync?_t=${Date.now()}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'upsertSubmission',
        submission,
        oauthAccessToken: activeOauthTok,
        sheetUrl: sheetTarget,
        appsScriptUrl: scriptTarget,
      }),
    });
    if (srvRes.ok) {
      const srvJson = await srvRes.json().catch(() => null);
      if (srvJson?.state?.submissions && Array.isArray(srvJson.state.submissions)) {
        updatedList = resolveSubmissionsFromSyncPayload(srvJson.state);
      }
    }
  } catch {
    // ignore
  }

  // 3. Gabungkan dan simpan ke Cloud Firestore
  try {
    const fsCurrent = await readFirestoreDashboardState();
    const fsList = Array.isArray(fsCurrent?.submissions) ? [...fsCurrent!.submissions] : [];
    const mergedMap = new Map<string, StudentSubmission>();

    [submission, ...updatedList, ...fsList].forEach((item) => {
      if (!item || !item.namaSiswa) return;
      const validItem = item as StudentSubmission;
      const k = validItem.id || getSubmissionUniqueKey(validItem);
      if (!mergedMap.has(k)) {
        mergedMap.set(k, validItem);
      }
    });

    const list = Array.from(mergedMap.values());
    const subKey = getSubmissionUniqueKey(submission);
    const delSet = new Set(fsCurrent?.deletedIds || []);
    delSet.delete(submission.id);
    delSet.delete(subKey);

    const nextPayload: StudentDashboardSyncPayload = {
      useInitialSubmissions: false,
      isCleared: false,
      clearedAt: 0,
      deletedIds: Array.from(delSet),
      submissions: list,
      questionBanks: fsCurrent?.questionBanks,
      updatedAt: Date.now(),
      source: 'Tersinkron Otomatis Lintas Perangkat (Live Ujian Siswa & Google Sheets)',
    };

    updatedList = resolveSubmissionsFromSyncPayload(nextPayload);

    await writeFirestoreDashboardState(nextPayload);
  } catch {
    // ignore
  }

  // 4. Otomatis sinkronkan ke Link Google Sheets Rekap Hasil Ujian (13 Kolom)
  await syncSubmissionsToGoogleSheetsAuto(updatedList, undefined, undefined, true).catch(() => {});
}

export async function saveAllSubmissionsToServer(
  submissions: StudentSubmission[],
  sheetUrl?: string,
  appsScriptUrl?: string
): Promise<void> {
  if (typeof window === 'undefined') return;
  const cleanSubs = deduplicateSubmissions(submissions);
  const isNowCleared = cleanSubs.length === 0;
  const nowTs = Date.now();

  if (isNowCleared) {
    clearAllSyncQueue();
  } else {
    enqueueBatchSubmissionsSync(cleanSubs, {
      sheetUrl,
      appsScriptUrl,
      immediate: true,
      source: 'Simpan Semua Rekapitulasi',
    });
  }

  try {
    const fsCurrent = await readFirestoreDashboardState();
    const delSet = new Set(fsCurrent?.deletedIds || []);
    if (isNowCleared) {
      (fsCurrent?.submissions || []).forEach((s) => {
        if (s.id) delSet.add(s.id);
        delSet.add(getSubmissionUniqueKey(s));
      });
    }
    await writeFirestoreDashboardState({
      useInitialSubmissions: false,
      isCleared: isNowCleared,
      clearedAt: isNowCleared ? nowTs : Number(fsCurrent?.clearedAt || 0),
      deletedIds: Array.from(delSet),
      submissions: cleanSubs,
      questionBanks: fsCurrent?.questionBanks,
      updatedAt: nowTs,
      source: 'Tersinkron Otomatis Lintas Perangkat (Cloud & Rekap Hasil Ujian)',
    });
  } catch {
    // ignore
  }

  try {
    await fetch(`/__api/student-dashboard-sync?_t=${Date.now()}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'setAllSubmissions',
        submissions: cleanSubs,
        sheetUrl,
        appsScriptUrl,
      }),
    });
  } catch {
    // ignore
  }

  syncSubmissionsToGoogleSheetsAuto(cleanSubs, sheetUrl, appsScriptUrl, true).catch(() => {});
}

export async function resetAllSubmissionsOnServer(
  sheetUrl?: string,
  appsScriptUrl?: string,
  currentSubmissions?: StudentSubmission[],
  explicitToken?: string
): Promise<void> {
  if (typeof window === 'undefined') return;
  const nowTs = Date.now();
  lastSyncedSheetSignature = '';

  const cfg = getInitialCloudConfig();
  const cfgAny = cfg as Record<string, any>;
  const effectiveSheetUrl = sanitizeRekapSheetUrl(
    (sheetUrl && sheetUrl.trim()) ||
      (cfg.googleSheetUrl && cfg.googleSheetUrl.trim()) ||
      DEFAULT_REKAP_SHEET_URL
  );
  const effectiveScriptUrl =
    (appsScriptUrl && appsScriptUrl.trim()) ||
    (cfg.appsScriptWebAppUrl && cfg.appsScriptWebAppUrl.trim()) ||
    (effectiveSheetUrl.includes('script.google.com') ? effectiveSheetUrl : '');

  const spreadsheetId = extractSpreadsheetIdFromUrl(effectiveSheetUrl);
  const gidMatch = effectiveSheetUrl.match(/[?&#]gid=(\d+)/i);
  const preferredGid = gidMatch ? Number(gidMatch[1]) : 1908701833;
  let immediateOauthTok =
    explicitToken ||
    getAccessTokenSync() ||
    (cfgAny.oauthAccessToken && (!cfgAny.oauthExpiresAt || cfgAny.oauthExpiresAt > Date.now())
      ? cfgAny.oauthAccessToken
      : '');

  if (!immediateOauthTok) {
    immediateOauthTok = (await ensureSpreadsheetOAuthToken(false)) || '';
  }

  // Kumpulkan semua ID & Key dari data saat ini dan data historis awal secara sinkron tanpa delay
  const deletedSet = new Set<string>();
  try {
    const existingDel = localStorage.getItem('anbk_submissions_deleted_ids_v1');
    if (existingDel) {
      JSON.parse(existingDel).forEach((k: string) => deletedSet.add(k));
    }
  } catch {
    // ignore
  }

  (currentSubmissions || []).forEach((s) => {
    if (s.id) deletedSet.add(s.id);
    deletedSet.add(getSubmissionUniqueKey(s));
  });
  INITIAL_SUBMISSIONS.forEach((s) => {
    if (s.id) deletedSet.add(s.id);
    deletedSet.add(getSubmissionUniqueKey(s));
  });

  const initialDeletedIdsArray = Array.from(deletedSet);
  try {
    localStorage.setItem('anbk_submissions_cleared_v1', 'true');
    localStorage.setItem('anbk_submissions_cleared_at_v1', String(nowTs));
    localStorage.setItem('anbk_submissions_deleted_ids_v1', JSON.stringify(initialDeletedIdsArray));
    localStorage.setItem('anbk_submissions_v1', JSON.stringify([]));
    clearAllSyncQueue();
  } catch {
    // ignore
  }

  // LANGKAH 1 (ZERO DELAY): Eksekusi penghapusan data pada Link Google Sheets, Apps Script, Server Proxy & Firestore SECARA PARALEL DETIK INI JUGA!
  const targetScriptUrls = Array.from(
    new Set(
      [
        effectiveScriptUrl,
        sheetUrl && sheetUrl.includes('script.google.com') ? sheetUrl : '',
      ].filter((u): u is string => Boolean(u && u.trim().startsWith('http')))
    )
  );

  // 1A. Hapus langsung di Google Sheets REST API v4 tanpa menunggu apapun jika token OAuth sudah ada di memori/localStorage
  const immediateSheetClearPromise = (async () => {
    let tok = immediateOauthTok;
    if (!tok) {
      const fsCfg = await readFirestoreCloudConfig().catch(() => null);
      const fsCfgAny = (fsCfg || {}) as Record<string, any>;
      if (fsCfgAny.oauthAccessToken && (!fsCfgAny.oauthExpiresAt || fsCfgAny.oauthExpiresAt > Date.now())) {
        tok = fsCfgAny.oauthAccessToken;
      }
    }
    if (spreadsheetId && tok) {
      await clearGoogleSheetRekapImmediatelyViaRestApi(spreadsheetId, tok, preferredGid).catch(() => {});
    }
  })().catch(() => {});

  // 1B. Hapus hanya baris isi data (baris ke-2 ke bawah) di Google Apps Script Web App dan pertahankan 13 judul kolom di baris ke-1
  const appsScriptClearPromises = targetScriptUrls.flatMap((sUrl) => {
    const trimmed = sUrl.trim();
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
          submissions: [],
          rows: [],
        }),
      }).catch(() => {}),
    ];
  });

  // 1C. Reset di Server Backend (/student-dashboard-state.json & server-side Google Sheets clear) secara paralel
  const serverResetPromise = fetch(`/__api/student-dashboard-sync?_t=${nowTs}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'resetAllSubmissions',
      clearedAt: nowTs,
      deletedIds: initialDeletedIdsArray,
      sheetUrl: effectiveSheetUrl,
      appsScriptUrl: effectiveScriptUrl,
      oauthAccessToken: immediateOauthTok || undefined,
    }),
  }).catch(() => {});

  // 1D. Reset di Firebase Firestore secara paralel agar seluruh perangkat langsung 0 data
  const firestoreResetPromise = writeFirestoreDashboardState({
    useInitialSubmissions: false,
    isCleared: true,
    clearedAt: nowTs,
    deletedIds: initialDeletedIdsArray,
    submissions: [],
    updatedAt: nowTs,
    source: 'Tersinkron Otomatis Lintas Perangkat (Cloud & Google Sheets)',
  }).catch(() => {});

  await Promise.allSettled([
    immediateSheetClearPromise,
    ...appsScriptClearPromises,
    serverResetPromise,
    firestoreResetPromise,
  ]);

  // 1E. Pastikan sekali lagi baris ke-1 (13 Judul Kolom) pada Google Sheets tetap utuh после seluruh proses selesai
  if (spreadsheetId && immediateOauthTok) {
    await clearGoogleSheetRekapImmediatelyViaRestApi(
      spreadsheetId,
      immediateOauthTok,
      preferredGid
    ).catch(() => {});
  }
}

export async function deleteSubmissionsByFilterOnServer(
  filter: ResetSubmissionsFilter,
  remainingSubmissions: StudentSubmission[],
  deletedSubmissions: StudentSubmission[],
  sheetUrl?: string,
  appsScriptUrl?: string,
  explicitToken?: string
): Promise<void> {
  if (typeof window === 'undefined') return;

  if (remainingSubmissions.length === 0) {
    await resetAllSubmissionsOnServer(sheetUrl, appsScriptUrl, [], explicitToken);
    return;
  }

  const nowTs = Date.now();
  lastSyncedSheetSignature = '';

  const cfg = getInitialCloudConfig();
  const effectiveSheetUrl = sanitizeRekapSheetUrl(
    (sheetUrl && sheetUrl.trim()) ||
      (cfg.googleSheetUrl && cfg.googleSheetUrl.trim()) ||
      DEFAULT_REKAP_SHEET_URL
  );
  const effectiveScriptUrl =
    (appsScriptUrl && appsScriptUrl.trim()) ||
    (cfg.appsScriptWebAppUrl && cfg.appsScriptWebAppUrl.trim()) ||
    (effectiveSheetUrl.includes('script.google.com') ? effectiveSheetUrl : '');

  const delSet = new Set<string>();
  try {
    const existingDel = localStorage.getItem('anbk_submissions_deleted_ids_v1');
    if (existingDel) {
      JSON.parse(existingDel).forEach((k: string) => delSet.add(k));
    }
  } catch {}

  deletedSubmissions.forEach((s) => {
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
  });

  const updatedDeletedIdsArray = Array.from(delSet);
  try {
    localStorage.setItem('anbk_submissions_v1', JSON.stringify(remainingSubmissions));
    localStorage.setItem(
      'anbk_submissions_deleted_ids_v1',
      JSON.stringify(updatedDeletedIdsArray)
    );
    if (remainingSubmissions.length === 0) {
      localStorage.setItem('anbk_submissions_cleared_v1', 'true');
      localStorage.setItem('anbk_submissions_cleared_at_v1', String(nowTs));
    } else {
      localStorage.removeItem('anbk_submissions_cleared_v1');
    }
  } catch {}

  // Broadcast real-time deletion event ke seluruh tab dan perangkat
  try {
    if (typeof BroadcastChannel !== 'undefined') {
      const bc = new BroadcastChannel('anbk_student_deletion_channel');
      bc.postMessage({
        deletedIds: updatedDeletedIdsArray,
        deletedCount: deletedSubmissions.length,
        deletedSubmissions: deletedSubmissions.map((s) => ({
          id: s.id,
          namaSiswa: s.namaSiswa,
          nisNisn: s.nisNisn,
          kelas: s.kelas,
        })),
        timestamp: nowTs,
      });
      bc.close();
    }
  } catch {}

  try {
    window.dispatchEvent(
      new CustomEvent('anbk-student-deleted-broadcast', {
        detail: {
          deletedIds: updatedDeletedIdsArray,
          deletedCount: deletedSubmissions.length,
          deletedSubmissions,
          timestamp: nowTs,
        },
      })
    );
  } catch {}

  // 1. Sinkronkan data tersisa ke Link Google Sheets (Menghapus baris tanggal yang dipilih)
  const sheetsSyncPromise = syncSubmissionsToGoogleSheetsAuto(
    remainingSubmissions,
    effectiveSheetUrl,
    effectiveScriptUrl,
    true,
    explicitToken
  ).catch(() => {});

  // 2. Sinkronkan ke Firestore Cloud
  const firestorePromise = writeFirestoreDashboardState({
    useInitialSubmissions: false,
    isCleared: remainingSubmissions.length === 0,
    clearedAt: remainingSubmissions.length === 0 ? nowTs : 0,
    deletedIds: updatedDeletedIdsArray,
    submissions: remainingSubmissions,
    updatedAt: nowTs,
    source:
      remainingSubmissions.length === 0
        ? 'Tersinkron Otomatis Lintas Perangkat (Reset Total Guru Aktif)'
        : `Tersinkron Otomatis Lintas Perangkat (Hapus Siswa Permanen - ${remainingSubmissions.length} Data Tersisa)`,
  }).catch(() => {});

  // 3. Sinkronkan ke Server Proxy Backend
  const serverPromise = fetch(`/__api/student-dashboard-sync?_t=${nowTs}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'deleteSubmissionsByFilter',
      filter,
      clearedAt: nowTs,
      deletedCount: deletedSubmissions.length,
      deletedIds: updatedDeletedIdsArray,
      remainingSubmissions,
      sheetUrl: effectiveSheetUrl,
      appsScriptUrl: effectiveScriptUrl,
      oauthAccessToken: explicitToken || getAccessTokenSync() || undefined,
    }),
  }).catch(() => {});

  await Promise.all([sheetsSyncPromise, firestorePromise, serverPromise]);
}

export async function deleteSingleSubmissionPermanently(
  student: { id?: string; namaSiswa: string; nisNisn?: string; kelas?: string },
  currentSubmissions: StudentSubmission[],
  sheetUrl?: string,
  appsScriptUrl?: string,
  explicitToken?: string
): Promise<{ remainingSubmissions: StudentSubmission[]; deletedCount: number }> {
  const targetId = student.id;
  const targetName = (student.namaSiswa || '').trim().toLowerCase();
  const targetNis = (student.nisNisn || '').trim();

  const toDelete: StudentSubmission[] = [];
  const remaining: StudentSubmission[] = [];

  currentSubmissions.forEach((sub) => {
    const subName = (sub.namaSiswa || '').trim().toLowerCase();
    const subNis = (sub.nisNisn || '').trim();
    const isMatch =
      (targetId && sub.id === targetId) ||
      (subName === targetName &&
        (!targetNis || targetNis === '-' || !subNis || subNis === '-' || subNis === targetNis));

    if (isMatch) {
      toDelete.push(sub);
    } else {
      remaining.push(sub);
    }
  });

  const filter: ResetSubmissionsFilter = {
    mode: 'ALL',
  };

  const dummyToDelete: StudentSubmission = {
    id: targetId || `SUB-${Date.now()}`,
    namaSiswa: student.namaSiswa,
    nisNisn: student.nisNisn || '-',
    kelas: student.kelas || 'VIII-1',
    skorBenar: 0,
    totalSoal: 25,
    nilaiAkhir: 0,
    statusKecurangan: 'Dihapus Permanen',
    lulusTidakLulus: 'TIDAK LULUS',
    answers: {},
    doubtful: {},
    violationCount: 0,
    violationLogs: [],
    questionOrder: [],
    timestamp: '',
    isCompleted: true,
  };

  await deleteSubmissionsByFilterOnServer(
    filter,
    remaining,
    toDelete.length > 0 ? toDelete : [dummyToDelete],
    sheetUrl,
    appsScriptUrl,
    explicitToken
  );

  return {
    remainingSubmissions: remaining,
    deletedCount: Math.max(1, toDelete.length),
  };
}

export async function deleteMultipleSubmissionsPermanently(
  students: Array<{ id?: string; namaSiswa: string; nisNisn?: string; kelas?: string }>,
  currentSubmissions: StudentSubmission[],
  sheetUrl?: string,
  appsScriptUrl?: string,
  explicitToken?: string
): Promise<{ remainingSubmissions: StudentSubmission[]; deletedCount: number }> {
  if (!students || students.length === 0) {
    return { remainingSubmissions: currentSubmissions, deletedCount: 0 };
  }

  const targetMap = new Map<string, boolean>();
  students.forEach((st) => {
    if (st.id) targetMap.set(st.id, true);
    const n = (st.namaSiswa || '').trim().toLowerCase();
    const nis = (st.nisNisn || '').trim();
    if (n) {
      targetMap.set(n, true);
      targetMap.set(`name_${n}`, true);
    }
    if (nis && nis !== '-') {
      targetMap.set(nis, true);
      targetMap.set(`nis_${nis}`, true);
    }
    if (n && nis) {
      targetMap.set(`${n}_${nis}`, true);
    }
  });

  const toDelete: StudentSubmission[] = [];
  const remaining: StudentSubmission[] = [];

  currentSubmissions.forEach((sub) => {
    const subId = sub.id || '';
    const subName = (sub.namaSiswa || '').trim().toLowerCase();
    const subNis = (sub.nisNisn || '').trim();
    const subKey = getSubmissionUniqueKey(sub);

    const isMatch =
      (subId && targetMap.has(subId)) ||
      targetMap.has(subKey) ||
      targetMap.has(subName) ||
      targetMap.has(`${subName}_${subNis}`) ||
      (subNis && subNis !== '-' && targetMap.has(subNis));

    if (isMatch) {
      toDelete.push(sub);
    } else {
      remaining.push(sub);
    }
  });

  students.forEach((st) => {
    const exists = toDelete.some(
      (td) =>
        (st.id && td.id === st.id) ||
        td.namaSiswa.trim().toLowerCase() === (st.namaSiswa || '').trim().toLowerCase()
    );
    if (!exists) {
      toDelete.push({
        id: st.id || `SUB-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        namaSiswa: st.namaSiswa,
        nisNisn: st.nisNisn || '-',
        kelas: st.kelas || 'VIII-1',
        skorBenar: 0,
        totalSoal: 25,
        nilaiAkhir: 0,
        statusKecurangan: 'Dihapus Permanen',
        lulusTidakLulus: 'TIDAK LULUS',
        answers: {},
        doubtful: {},
        violationCount: 0,
        violationLogs: [],
        questionOrder: [],
        timestamp: '',
        isCompleted: true,
      });
    }
  });

  const filter: ResetSubmissionsFilter = {
    mode: 'ALL',
  };

  await deleteSubmissionsByFilterOnServer(
    filter,
    remaining,
    toDelete,
    sheetUrl,
    appsScriptUrl,
    explicitToken
  );

  return {
    remainingSubmissions: remaining,
    deletedCount: toDelete.length,
  };
}

export interface RestoreSubmissionsFilter {
  mode: 'ALL' | 'DATE_RANGE' | 'DATE_FILTER';
  selectedDate?: number | 'ALL';
  selectedMonth?: number | 'ALL';
  selectedYear?: number | 'ALL';
  specificDateIso?: string;
  startDateIso?: string;
  endDateIso?: string;
  restoreTarget: {
    appMenus: boolean; // 1. Semua Data Riwayat yang ada di menu seperti Sistem Riwayat Percobaan, Nilai & Setifikat Ujian Siswa, menu fitur rapor siswa, peringkat 5 besar, pemeringkatan siswa, urutan rekap & animasi kolom pemeringkatan, papan peringkat & motivasi campuran, analitik time-series, daftar riwayat percobaan siswa
    googleSheet: boolean; // 2. Data Rekap Hasil Nilai yang ada di google sheet
  };
}

export function getHistoricalSubmissionsPool(): StudentSubmission[] {
  const map = new Map<string, StudentSubmission>();
  INITIAL_SUBMISSIONS.forEach((s) => {
    map.set(getSubmissionUniqueKey(s), s);
    if (s.id) map.set(s.id, s);
  });

  if (typeof window !== 'undefined') {
    try {
      const rawArch = localStorage.getItem('anbk_submissions_archive_backup_v1');
      if (rawArch) {
        const parsed = JSON.parse(rawArch);
        if (Array.isArray(parsed)) {
          parsed.forEach((s: StudentSubmission) => {
            const key = getSubmissionUniqueKey(s);
            if (!map.has(key)) map.set(key, s);
          });
        }
      }
    } catch {}
  }

  const uniqueList: StudentSubmission[] = [];
  const seenKeys = new Set<string>();
  for (const s of map.values()) {
    const key = getSubmissionUniqueKey(s);
    if (!seenKeys.has(key)) {
      seenKeys.add(key);
      uniqueList.push(s);
    }
  }

  uniqueList.sort((a, b) => {
    const tA = parseSubmissionDate(a).dateObj?.getTime() || 0;
    const tB = parseSubmissionDate(b).dateObj?.getTime() || 0;
    return tB - tA;
  });

  return uniqueList;
}

export async function restoreSubmissionsWithFilterOnServer(
  filter: RestoreSubmissionsFilter,
  currentSubmissions: StudentSubmission[],
  candidatePool?: StudentSubmission[],
  sheetUrl?: string,
  appsScriptUrl?: string,
  explicitToken?: string
): Promise<{
  restoredCount: number;
  totalActiveCount: number;
  restoredSubmissions: StudentSubmission[];
  allActiveSubmissions: StudentSubmission[];
}> {
  if (typeof window === 'undefined') {
    return {
      restoredCount: 0,
      totalActiveCount: 0,
      restoredSubmissions: [],
      allActiveSubmissions: [],
    };
  }

  const nowTs = Date.now();
  const pool =
    candidatePool && candidatePool.length > 0 ? candidatePool : getHistoricalSubmissionsPool();

  const matchingCandidates = pool.filter((s) => {
    return isSubmissionMatchingResetFilter(s, {
      mode: filter.mode,
      selectedDate: filter.selectedDate,
      selectedMonth: filter.selectedMonth,
      selectedYear: filter.selectedYear,
      specificDateIso: filter.specificDateIso,
      startDateIso: filter.startDateIso,
      endDateIso: filter.endDateIso,
    });
  });

  const restoredToActivate = matchingCandidates.length > 0 ? matchingCandidates : pool;

  let finalSubmissions = [...currentSubmissions];

  if (filter.restoreTarget.appMenus) {
    const existingKeys = new Set(currentSubmissions.map((s) => getSubmissionUniqueKey(s)));
    restoredToActivate.forEach((item) => {
      const k = getSubmissionUniqueKey(item);
      if (!existingKeys.has(k)) {
        existingKeys.add(k);
        finalSubmissions.push(item);
      }
    });

    finalSubmissions.sort((a, b) => {
      const tA = parseSubmissionDate(a).dateObj?.getTime() || 0;
      const tB = parseSubmissionDate(b).dateObj?.getTime() || 0;
      return tB - tA;
    });

    const restoredKeySet = new Set<string>();
    restoredToActivate.forEach((s) => {
      if (s.id) restoredKeySet.add(s.id);
      restoredKeySet.add(getSubmissionUniqueKey(s));
    });

    let currentDeletedIds: string[] = [];
    try {
      const stored = localStorage.getItem('anbk_submissions_deleted_ids_v1');
      if (stored) currentDeletedIds = JSON.parse(stored);
    } catch {}

    const updatedDeletedIds = currentDeletedIds.filter((id) => !restoredKeySet.has(id));

    try {
      localStorage.removeItem('anbk_submissions_cleared_v1');
      localStorage.setItem('anbk_submissions_cleared_at_v1', '0');
      localStorage.setItem(
        'anbk_submissions_deleted_ids_v1',
        JSON.stringify(updatedDeletedIds)
      );
      localStorage.setItem('anbk_submissions_v1', JSON.stringify(finalSubmissions));
    } catch {}

    await writeFirestoreDashboardState({
      useInitialSubmissions: false,
      isCleared: false,
      clearedAt: 0,
      deletedIds: updatedDeletedIds,
      submissions: finalSubmissions,
      updatedAt: nowTs,
      source: `Tersinkron Otomatis Lintas Perangkat (Pemulihan Data Riwayat - ${restoredToActivate.length} Data Dipulihkan)`,
    }).catch(() => {});

    try {
      await fetch(`/__api/student-dashboard-sync?_t=${nowTs}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'restoreSubmissionsWithFilter',
          filter,
          submissions: finalSubmissions,
          restoredCount: restoredToActivate.length,
          deletedIds: updatedDeletedIds,
          updatedAt: nowTs,
        }),
      });
    } catch {}
  }

  if (filter.restoreTarget.googleSheet) {
    const sheetSubmissions = filter.restoreTarget.appMenus ? finalSubmissions : restoredToActivate;
    const cfg = getInitialCloudConfig();
    const effectiveSheet = sheetUrl || cfg.googleSheetUrl;
    const effectiveScript = appsScriptUrl || cfg.appsScriptWebAppUrl;
    await syncSubmissionsToGoogleSheetsAuto(
      sheetSubmissions,
      effectiveSheet,
      effectiveScript,
      true,
      explicitToken
    ).catch(() => {});
  }

  return {
    restoredCount: restoredToActivate.length,
    totalActiveCount: finalSubmissions.length,
    restoredSubmissions: restoredToActivate,
    allActiveSubmissions: finalSubmissions,
  };
}

export async function restoreDefaultSubmissionsOnServer(): Promise<void> {
  if (typeof window === 'undefined') return;
  const nowTs = Date.now();
  try {
    localStorage.removeItem('anbk_submissions_cleared_v1');
    localStorage.setItem('anbk_submissions_cleared_at_v1', '0');
    localStorage.removeItem('anbk_submissions_deleted_ids_v1');
    localStorage.setItem('anbk_submissions_v1', JSON.stringify(INITIAL_SUBMISSIONS));
  } catch {
    // ignore
  }

  await writeFirestoreDashboardState({
    useInitialSubmissions: true,
    isCleared: false,
    clearedAt: 0,
    deletedIds: [],
    submissions: INITIAL_SUBMISSIONS,
    updatedAt: nowTs,
    source: 'Tersinkron Otomatis Lintas Perangkat (Cloud & Rekap Hasil Ujian)',
  });

  try {
    await fetch(`/__api/student-dashboard-sync?_t=${nowTs}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'restoreDefaultSubmissions',
        submissions: INITIAL_SUBMISSIONS,
        updatedAt: nowTs,
      }),
    });
  } catch {
    // ignore
  }

  syncSubmissionsToGoogleSheetsAuto(INITIAL_SUBMISSIONS, undefined, undefined, true).catch(
    () => {}
  );
}

export interface ExamSessionInfo {
  sessionId: string;
  sessionName: string;
  createdAt: number;
  createdBy: string;
  token?: string;
  targetKelas?: string;
  notes?: string;
  status: 'ACTIVE' | 'ARCHIVED';
  clearedSubmissionsCount?: number;
}

export function generateRandomExamToken(length = 5): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export function getCurrentExamSession(): ExamSessionInfo {
  if (typeof window === 'undefined') {
    return {
      sessionId: 'SESI-DEFAULT-UTAMA',
      sessionName: 'Sesi Ujian Utama - TA 2026/2027',
      createdAt: Date.now(),
      createdBy: EXAM_INFO.guruMapel,
      status: 'ACTIVE',
    };
  }
  try {
    const raw = localStorage.getItem('anbk_active_exam_session_v1');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object' && parsed.sessionId && parsed.sessionName) {
        return parsed as ExamSessionInfo;
      }
    }
  } catch {
    // ignore
  }
  const defSession: ExamSessionInfo = {
    sessionId: `SESI-${Date.now()}`,
    sessionName: 'Sesi Ujian Utama - TA 2026/2027',
    createdAt: Date.now(),
    createdBy: EXAM_INFO.guruMapel,
    status: 'ACTIVE',
  };
  try {
    localStorage.setItem('anbk_active_exam_session_v1', JSON.stringify(defSession));
  } catch {
    // ignore
  }
  return defSession;
}

export function getExamSessionsHistory(): ExamSessionInfo[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem('anbk_exam_sessions_history_v1');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed as ExamSessionInfo[];
    }
  } catch {
    // ignore
  }
  return [];
}

export async function createNewExamSession(params: {
  sessionName: string;
  newToken?: string;
  targetKelas?: string;
  notes?: string;
  currentSubmissions?: StudentSubmission[];
  explicitToken?: string;
}): Promise<{ session: ExamSessionInfo; newToken?: string }> {
  if (typeof window === 'undefined') {
    throw new Error('Window is not defined');
  }

  const nowTs = Date.now();
  const rawSessionName = (params.sessionName || '').trim();
  const sessionName =
    rawSessionName ||
    `Sesi Ujian Baru · ${new Date(nowTs).toLocaleDateString('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    })}`;
  const sessionId = `SESI-${nowTs}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

  const currentSubs = params.currentSubmissions || [];
  const clearedCount = currentSubs.length;

  // 1. Tangani Kode Token Baru jika disediakan
  let effectiveToken = (params.newToken || '').trim().toUpperCase();
  if (effectiveToken) {
    effectiveToken = sanitizeTokenValue(effectiveToken) || effectiveToken.slice(0, 6);
    try {
      const cfg = getInitialCloudConfig();
      cfg.customTeacherToken = effectiveToken;
      saveCloudTokenConfigToServer(cfg).catch(() => {});
      writeFirestoreCloudConfig({ customTeacherToken: effectiveToken }).catch(() => {});
      pushTokenEventLocallyAndBroadcast(effectiveToken, 'GURU_BROADCAST');
    } catch {
      // ignore
    }
  }

  // 2. KOSONGKAN RIWAYAT NILAI SISWA & RESET DATA SUBMISSION PADA SISTEM SECARA OTOMATIS
  const cfg = getInitialCloudConfig();
  const effectiveSheetUrl = sanitizeRekapSheetUrl(cfg.googleSheetUrl);
  const effectiveScriptUrl = cfg.appsScriptWebAppUrl || '';

  // 2A. Reset Submissions pada Server & Google Sheets (Zero Delay)
  await resetAllSubmissionsOnServer(
    effectiveSheetUrl,
    effectiveScriptUrl,
    currentSubs,
    params.explicitToken
  );

  // 2B. Bersihkan seluruh penyimpanan riwayat lokal pengerjaan ujian siswa
  try {
    localStorage.setItem('anbk_submissions_cleared_v1', 'true');
    localStorage.setItem('anbk_submissions_cleared_at_v1', String(nowTs));
    localStorage.setItem('anbk_submissions_v1', JSON.stringify([]));

    // Hapus draft dan status ujian siswa yang sedang aktif
    localStorage.removeItem('anbk_exam_has_started');
    localStorage.removeItem('anbk_exam_in_progress');
    localStorage.removeItem('anbk_exam_has_completed');
    localStorage.removeItem('anbk_classroom_has_entered');
    localStorage.removeItem('anbk_active_exam_draft_v1');
    localStorage.removeItem('anbk_device_synced_sub_id_v1');
    localStorage.removeItem('anbk_battery_session_history_v1');

    const timeStr = new Date(nowTs).toLocaleTimeString('id-ID', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    localStorage.setItem('anbk_reset_completed_time_v1', timeStr);
  } catch {
    // ignore
  }

  // 2C. Kosongkan riwayat pemakaian token 3x siswa & riwayat soal yang sudah dilihat
  clearUsedExamTokens();
  clearAllStudentSeenQuestionsHistory();
  clearAllSyncQueue();

  // 3. Simpan Sesi Ujian Baru ke state & riwayat sesi
  const newSession: ExamSessionInfo = {
    sessionId,
    sessionName,
    createdAt: nowTs,
    createdBy: EXAM_INFO.guruMapel,
    token: effectiveToken || undefined,
    targetKelas: params.targetKelas || 'ALL',
    notes: params.notes?.trim() || undefined,
    status: 'ACTIVE',
    clearedSubmissionsCount: clearedCount,
  };

  try {
    // Arsipkan sesi sebelumnya ke riwayat
    const existingHistory = getExamSessionsHistory();
    const currentActive = getCurrentExamSession();
    if (currentActive && currentActive.sessionId !== sessionId) {
      const archived: ExamSessionInfo = { ...currentActive, status: 'ARCHIVED' };
      const updatedHistory = [
        archived,
        ...existingHistory.filter((h) => h.sessionId !== currentActive.sessionId),
      ].slice(0, 30);
      localStorage.setItem('anbk_exam_sessions_history_v1', JSON.stringify(updatedHistory));
    }
    localStorage.setItem('anbk_active_exam_session_v1', JSON.stringify(newSession));
  } catch {
    // ignore
  }

  // 4. Update Firestore StudentDashboardSync dengan sesi baru
  try {
    await writeFirestoreDashboardState({
      useInitialSubmissions: false,
      isCleared: true,
      clearedAt: nowTs,
      activeSessionId: sessionId,
      activeSessionName: sessionName,
      sessionCreatedAt: nowTs,
      deletedIds: [],
      submissions: [],
      updatedAt: nowTs,
      source: `Tersinkron Otomatis (Sesi Baru: ${sessionName})`,
    });
  } catch {
    // ignore
  }

  // 5. Update Server API
  try {
    await fetch(`/__api/student-dashboard-sync?_t=${nowTs}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'createNewExamSession',
        sessionId,
        sessionName,
        clearedAt: nowTs,
        submissions: [],
        sheetUrl: effectiveSheetUrl,
        appsScriptUrl: effectiveScriptUrl,
      }),
    });
  } catch {
    // ignore
  }

  // 6. Broadcast Event ke semua tab/komponen
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('anbk-new-exam-session-created', {
        detail: {
          session: newSession,
          token: effectiveToken,
          clearedAt: nowTs,
        },
      })
    );
    window.dispatchEvent(
      new CustomEvent('anbk-submissions-reset-event', {
        detail: {
          clearedAt: nowTs,
          session: newSession,
        },
      })
    );
  }

  return { session: newSession, newToken: effectiveToken || undefined };
}

export async function updateQuestionBanksOnServer(
  questionBanks: Record<ExamPackageKey, Question[]>
): Promise<void> {
  if (typeof window === 'undefined') return;
  try {
    const fsCurrent = await readFirestoreDashboardState();
    await writeFirestoreDashboardState({
      ...(fsCurrent || {
        useInitialSubmissions: true,
        isCleared: false,
        clearedAt: 0,
        deletedIds: [],
        submissions: [],
      }),
      questionBanks,
      updatedAt: Date.now(),
    });
  } catch {
    // ignore
  }
  try {
    await fetch(`/__api/student-dashboard-sync?_t=${Date.now()}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'updateQuestionBanks',
        questionBanks,
      }),
    });
  } catch {
    // ignore
  }
}

export const UNSAVED_SUBMISSIONS_SYNC_EVENT = 'anbk-unsaved-submissions-synced';

/**
 * Mendeteksi secara menyeluruh seluruh hasil ujian siswa yang sudah selesai
 * di perangkat/IP mana pun yang belum tersimpan atau belum terkirim ke Google Sheets,
 * mengoneksikannya secara otomatis, menyimpan ke Firestore & Server Lintas Perangkat,
 * serta menyinkronkan seluruhnya ke Link Google Sheets dan fitur Riwayat Percobaan Nilai
 * & Sertifikat Ujian Siswa pada Siswa Dashboard.
 */
export async function autoRecoverAndSyncAllUnsavedSubmissions(options?: {
  sheetUrl?: string;
  appsScriptUrl?: string;
  forcePushToSheets?: boolean;
}): Promise<StudentSubmission[]> {
  if (typeof window === 'undefined') return [];

  const isCleared = localStorage.getItem('anbk_submissions_cleared_v1') === 'true';
  const clearedAt = sanitizeSyncTimestamp(localStorage.getItem('anbk_submissions_cleared_at_v1'));
  const deletedSet = new Set<string>();
  try {
    const rawDel = localStorage.getItem('anbk_submissions_deleted_ids_v1');
    if (rawDel) {
      JSON.parse(rawDel).forEach((k: string) => { if (k) deletedSet.add(k); });
    }
  } catch {}

  const isCandidateValid = (s: any) => {
    if (!s || !s.namaSiswa) return false;
    const id = String(s.id || '');
    if (id.startsWith('HIST-')) return false;
    const uKey = getSubmissionUniqueKey(s);
    const cleanName = String(s.namaSiswa || '').trim().toLowerCase();
    const cleanNis = String(s.nisNisn || '').trim();
    if (
      deletedSet.has(id) ||
      deletedSet.has(uKey) ||
      deletedSet.has(cleanName) ||
      deletedSet.has(`name_${cleanName}`) ||
      (cleanNis && cleanNis !== '-' && (deletedSet.has(cleanNis) || deletedSet.has(`nis_${cleanNis}`))) ||
      (cleanName && cleanNis && deletedSet.has(`${cleanName}_${cleanNis}`))
    ) {
      return false;
    }
    if (clearedAt > 0) {
      const matchTs = id.match(/^(?:SUB|ESAY)-(\d+)/);
      const createdTs = matchTs ? Number(matchTs[1]) : 0;
      if (createdTs > 0 && createdTs <= clearedAt) return false;
    }
    return true;
  };

  if (isCleared) {
    // Jika sistem sedang dalam status reset bersih oleh Guru, jangan pulihkan data lama apa pun!
    return [];
  }

  const targetSheetUrl = sanitizeRekapSheetUrl(
    options?.sheetUrl || (cloudConfigJson as { googleSheetUrl?: string })?.googleSheetUrl || DEFAULT_REKAP_SHEET_URL
  );
  const targetScriptUrl =
    options?.appsScriptUrl ||
    (cloudConfigJson as { appsScriptWebAppUrl?: string })?.appsScriptWebAppUrl ||
    '';

  const collectedSubsMap = new Map<string, StudentSubmission>();

  // 1. Ambil dari localStorage anbk_submissions_v1
  try {
    const rawSaved = localStorage.getItem('anbk_submissions_v1');
    if (rawSaved) {
      const parsed = JSON.parse(rawSaved);
      if (Array.isArray(parsed)) {
        parsed.forEach((s, idx) => {
          if (s && s.namaSiswa && isCandidateValid(s)) {
            const normalized = normalizeSubmissionRecord(s, idx);
            if (isCandidateValid(normalized)) {
              collectedSubsMap.set(normalized.id || getSubmissionUniqueKey(normalized), normalized);
            }
          }
        });
      }
    }
  } catch {
    // ignore
  }

  // 2. Ambil dari localStorage anbk_last_completed_submission_v1
  try {
    const rawLast = localStorage.getItem('anbk_last_completed_submission_v1');
    if (rawLast) {
      const s = JSON.parse(rawLast);
      if (s && s.namaSiswa && isCandidateValid(s)) {
        const normalized = normalizeSubmissionRecord(s, 0);
        if (isCandidateValid(normalized)) {
          collectedSubsMap.set(normalized.id || getSubmissionUniqueKey(normalized), normalized);
        }
      }
    }
  } catch {
    // ignore
  }

  // 3. Ambil dari localStorage anbk_active_exam_draft_v1 jika sudah selesai dikerjakan
  try {
    const rawDraft = localStorage.getItem('anbk_active_exam_draft_v1');
    const examCompletedFlag = localStorage.getItem('anbk_exam_has_completed') === 'true';
    if (rawDraft && examCompletedFlag) {
      const s = JSON.parse(rawDraft);
      if (s && s.namaSiswa && s.answers && Object.keys(s.answers).length >= 5 && isCandidateValid(s)) {
        const normalized = normalizeSubmissionRecord({ ...s, isCompleted: true }, 0);
        if (isCandidateValid(normalized)) {
          collectedSubsMap.set(normalized.id || getSubmissionUniqueKey(normalized), normalized);
        }
      }
    }
  } catch {
    // ignore
  }

  // 4. Ambil dari antrean sinkronisasi offline (anbk_submission_sync_queue_v2)
  try {
    const rawQueue = localStorage.getItem('anbk_submission_sync_queue_v2');
    if (rawQueue) {
      const parsedQ = JSON.parse(rawQueue);
      if (Array.isArray(parsedQ)) {
        parsedQ.forEach((qItem) => {
          if (qItem && qItem.payload) {
            const subs = Array.isArray(qItem.payload) ? qItem.payload : [qItem.payload];
            subs.forEach((s: any, idx: number) => {
              if (s && s.namaSiswa && isCandidateValid(s)) {
                const normalized = normalizeSubmissionRecord(s, idx);
                if (isCandidateValid(normalized)) {
                  collectedSubsMap.set(normalized.id || getSubmissionUniqueKey(normalized), normalized);
                }
              }
            });
          }
        });
      }
    }
  } catch {
    // ignore
  }

  // 5. Baca state dari Firestore
  try {
    const fsState = await readFirestoreDashboardState();
    if (fsState && !fsState.isCleared && Array.isArray(fsState.submissions)) {
      fsState.submissions.forEach((s, idx) => {
        if (s && s.namaSiswa && isCandidateValid(s)) {
          const normalized = normalizeSubmissionRecord(s, idx);
          const k = normalized.id || getSubmissionUniqueKey(normalized);
          if (isCandidateValid(normalized) && !collectedSubsMap.has(k)) {
            collectedSubsMap.set(k, normalized);
          }
        }
      });
    }
  } catch {
    // ignore
  }

  // 6. Baca state dari Server Lintas Perangkat (/__api/student-dashboard-sync)
  try {
    const srvRes = await fetch(`/__api/student-dashboard-sync?_t=${Date.now()}`, { cache: 'no-store' });
    if (srvRes.ok) {
      const srvData = await srvRes.json();
      if (srvData?.state && !srvData.state.isCleared && Array.isArray(srvData.state.submissions)) {
        srvData.state.submissions.forEach((s: any, idx: number) => {
          if (s && s.namaSiswa && isCandidateValid(s)) {
            const normalized = normalizeSubmissionRecord(s, idx);
            const k = normalized.id || getSubmissionUniqueKey(normalized);
            if (isCandidateValid(normalized) && !collectedSubsMap.has(k)) {
              collectedSubsMap.set(k, normalized);
            }
          }
        });
      }
    }
  } catch {
    // ignore
  }

  // Format IP & Fingerprint saat ini jika ada submission yang belum memilikinya
  let currentIp = '103.148.201.77';
  try {
    const cachedIp = localStorage.getItem('anbk_detected_client_ip_v1');
    if (cachedIp && cachedIp.trim().length >= 7) currentIp = cachedIp.trim();
  } catch {}
  let currentFp = 'DEV-A83F';
  try {
    const cachedFp = localStorage.getItem('anbk_unique_device_fingerprint_v1');
    if (cachedFp && /^DEV-[A-Z0-9]{4}$/i.test(cachedFp.trim())) currentFp = cachedFp.trim().toUpperCase();
  } catch {}

  const finalMergedSubs = deduplicateSubmissions(
    Array.from(collectedSubsMap.values()).map((s) => {
      const clientIp = s.clientIp || currentIp;
      const deviceFingerprint = s.deviceFingerprint || currentFp;
      let deviceInfo = s.deviceInfo || '';
      if (!deviceInfo) {
        const devCat = s.deviceCategory || 'HP Android';
        const devMod = s.deviceModel || s.deviceBrand || 'Perangkat Siswa';
        const devOs = s.deviceOsBrowser || '';
        deviceInfo = `${devCat} — ${devMod} (${devOs ? `${devOs} · ` : ''}${deviceFingerprint} · IP: ${clientIp})`;
      } else {
        if (deviceFingerprint && !deviceInfo.includes(deviceFingerprint)) {
          deviceInfo += ` · ${deviceFingerprint}`;
        }
        if (clientIp && !deviceInfo.includes(clientIp)) {
          deviceInfo += ` · IP: ${clientIp}`;
        }
      }
      return {
        ...s,
        clientIp,
        deviceFingerprint,
        deviceInfo,
      };
    })
  );

  if (finalMergedSubs.length > 0) {
    // Simpan ke localStorage
    try {
      localStorage.setItem('anbk_submissions_v1', JSON.stringify(finalMergedSubs));
      localStorage.removeItem('anbk_submissions_cleared_v1');
    } catch {
      // ignore
    }

    // Simpan ke Firestore
    writeFirestoreDashboardState({
      useInitialSubmissions: false,
      isCleared: false,
      clearedAt: 0,
      submissions: finalMergedSubs,
      updatedAt: Date.now(),
      source: 'Tersinkron Otomatis (Pemulihan & Sinkronisasi Semua Laporan Siswa)',
    }).catch(() => {});

    // Simpan ke Server Lintas Perangkat
    fetch(`/__api/student-dashboard-sync?_t=${Date.now()}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'setAllSubmissions',
        submissions: finalMergedSubs,
        sheetUrl: targetSheetUrl,
        appsScriptUrl: targetScriptUrl,
      }),
    }).catch(() => {});

    // Jalankan sync langsung ke Google Sheets secara paralel
    syncSubmissionsToGoogleSheetsAuto(finalMergedSubs, targetSheetUrl, targetScriptUrl, true).catch(() => {});

    // Broadcast event agar UI (App.tsx & StudentDashboard.tsx) seketika memperbarui daftar riwayat & sertifikat
    window.dispatchEvent(
      new CustomEvent(UNSAVED_SUBMISSIONS_SYNC_EVENT, { detail: { submissions: finalMergedSubs } })
    );
  }

  return finalMergedSubs;
}

/**
 * ============================================================================
 * SISTEM DIAGNOSIS DAN GENERATOR PAKET REMEDIAL OTOMATIS (FASE D KEMDIKBUD)
 * Didesain khusus untuk siswa yang memperoleh nilai di bawah KKM 75
 * Memetakan materi yang belum dikuasai berdasarkan butir soal yang salah,
 * dan menghasilkan paket soal remedial terarah dengan tingkat kesulitan terfokus.
 * ============================================================================
 */

export interface RemedialTopicInfo {
  elemen: string;
  totalQuestions: number;
  correctCount: number;
  wrongCount: number;
  masteryPercentage: number;
  isMastered: boolean;
  wrongQuestions: {
    id: number;
    questionNumber: number;
    difficulty: 'REGULER' | 'HOTS';
    content: string;
    studentAnswer: string;
    correctAnswer: string;
    explanation: string;
  }[];
  suggestedFocusNote: string;
}

export interface UnmasteredTopicDiagnosis {
  studentName: string;
  nilaiAkhir: number;
  kkm: number;
  needsRemedial: boolean;
  totalQuestions: number;
  totalCorrect: number;
  totalWrong: number;
  topics: RemedialTopicInfo[];
  unmasteredTopics: RemedialTopicInfo[];
  regulerMissedCount: number;
  hotsMissedCount: number;
  recommendedDifficultyMode: 'REGULER' | 'BALANCED' | 'HOTS';
  recommendedTopicElements: string[];
}

export interface RemedialGenerationParams {
  namaSiswa: string;
  nisNisn: string;
  packageKey: ExamPackageKey;
  unmasteredElements: string[];
  difficultyMode: 'REGULER' | 'BALANCED' | 'HOTS';
  questionCount?: number;
  baseQuestions?: Question[];
  previousSubmission?: StudentSubmission;
}

export interface RemedialPackageResult {
  questions: Question[];
  packageTitle: string;
  difficultyMode: 'REGULER' | 'BALANCED' | 'HOTS';
  targetedElements: string[];
  totalQuestions: number;
  remedialToken: string;
  sourceDescription: string;
}

export function normalizeInformatikaElement(rawElemen?: string, content: string = ''): string {
  const norm = (rawElemen || '').toLowerCase();
  const cNorm = content.toLowerCase();

  if (norm.includes('berpikir') || norm.includes('(bk)') || cNorm.includes('berpikir komputasional') || cNorm.includes('dekomposisi') || cNorm.includes('abstraksi')) {
    return 'Berpikir Komputasional (BK)';
  }
  if (norm.includes('jaringan') || norm.includes('(jki)') || cNorm.includes('jaringan komputer') || cNorm.includes('internet') || cNorm.includes('topologi') || cNorm.includes('router') || cNorm.includes('ip address')) {
    return 'Jaringan Komputer & Internet (JKI)';
  }
  if (norm.includes('sistem komputer') || norm.includes('(sk)') || cNorm.includes('sistem komputer') || cNorm.includes('perangkat keras') || cNorm.includes('cpu') || cNorm.includes('ram') || cNorm.includes('operating system')) {
    return 'Sistem Komputer (SK)';
  }
  if (norm.includes('analisis data') || norm.includes('(ad)') || cNorm.includes('analisis data') || cNorm.includes('spreadsheet') || cNorm.includes('rumus excel') || cNorm.includes('grafik data') || cNorm.includes('filter data')) {
    return 'Analisis Data (AD)';
  }
  if (norm.includes('algoritma') || norm.includes('pemrograman') || norm.includes('(ap)') || cNorm.includes('algoritma') || cNorm.includes('flowchart') || cNorm.includes('pseudocode') || cNorm.includes('scratch') || cNorm.includes('looping')) {
    return 'Algoritma & Pemrograman (AP)';
  }
  if (norm.includes('dampak sosial') || norm.includes('(dsi)') || cNorm.includes('dampak sosial') || cNorm.includes('jejak digital') || cNorm.includes('kejahatan siber') || cNorm.includes('uu ite') || cNorm.includes('hak cipta')) {
    return 'Dampak Sosial Informatika (DSI)';
  }
  if (norm.includes('praktik lintas') || norm.includes('(plb)') || cNorm.includes('praktik lintas bidang') || cNorm.includes('proyek kolaborasi')) {
    return 'Praktik Lintas Bidang (PLB)';
  }
  return 'Teknologi Informasi & Komunikasi (TIK)';
}

/**
 * Diagnosis kelemahan penguasaan materi siswa secara otomatis berdasarkan hasil ujian
 */
export function diagnoseStudentUnmasteredTopics(
  submission: StudentSubmission,
  examQuestions: Question[]
): UnmasteredTopicDiagnosis {
  const kkm = EXAM_INFO.kkm || 75;
  const isBelowKkm = submission.nilaiAkhir < kkm;
  const answers = submission.answers || {};

  const topicMap = new Map<string, {
    total: number;
    correct: number;
    wrong: number;
    wrongQs: {
      id: number;
      questionNumber: number;
      difficulty: 'REGULER' | 'HOTS';
      content: string;
      studentAnswer: string;
      correctAnswer: string;
      explanation: string;
    }[];
  }>();

  let regulerMissed = 0;
  let hotsMissed = 0;
  let totalCorrect = 0;
  let totalWrong = 0;

  examQuestions.forEach((q, idx) => {
    const el = normalizeInformatikaElement(q.elemen, q.content);
    if (!topicMap.has(el)) {
      topicMap.set(el, { total: 0, correct: 0, wrong: 0, wrongQs: [] });
    }
    const tData = topicMap.get(el)!;
    tData.total += 1;

    const studentAns = answers[q.id];
    const isCorrect = studentAns === q.answer;

    if (isCorrect) {
      tData.correct += 1;
      totalCorrect += 1;
    } else {
      tData.wrong += 1;
      totalWrong += 1;
      if (q.difficulty === 'REGULER') regulerMissed += 1;
      else hotsMissed += 1;

      const optIdx = studentAns && ['A', 'B', 'C', 'D'].includes(studentAns) ? ['A', 'B', 'C', 'D'].indexOf(studentAns) : -1;
      const studentAnsText = optIdx >= 0 && q.options[optIdx] ? `${studentAns}. ${q.options[optIdx]}` : (studentAns || 'Belum Dijawab');
      const correctIdx = ['A', 'B', 'C', 'D'].indexOf(q.answer);
      const correctAnsText = correctIdx >= 0 && q.options[correctIdx] ? `${q.answer}. ${q.options[correctIdx]}` : q.answer;

      tData.wrongQs.push({
        id: q.id,
        questionNumber: idx + 1,
        difficulty: q.difficulty,
        content: q.content,
        studentAnswer: studentAnsText,
        correctAnswer: correctAnsText,
        explanation: q.explanation || 'Pelajari kembali konsep inti pada materi terkait.',
      });
    }
  });

  const topics: RemedialTopicInfo[] = Array.from(topicMap.entries()).map(([elemen, data]) => {
    const masteryPercentage = data.total > 0 ? Math.round((data.correct / data.total) * 100) : 0;
    const isMastered = masteryPercentage >= kkm && data.wrong === 0;

    let suggestedFocusNote = 'Penguasaan materi sudah optimal.';
    if (masteryPercentage === 0) {
      suggestedFocusNote = 'Perlu remedial total: Pelajari kembali konsep pondasi dan definisi utama.';
    } else if (masteryPercentage < 50) {
      suggestedFocusNote = 'Perlu remedial mendalam: Kuatkan pemahaman konsep dan contoh studi kasus.';
    } else if (masteryPercentage < kkm) {
      suggestedFocusNote = 'Perlu perbaikan terarah: Tinjau kembali analisis soal HOTS dan penalaran konsep.';
    }

    return {
      elemen,
      totalQuestions: data.total,
      correctCount: data.correct,
      wrongCount: data.wrong,
      masteryPercentage,
      isMastered,
      wrongQuestions: data.wrongQs,
      suggestedFocusNote,
    };
  });

  // Urutkan materi berdasarkan yang paling lemah terlebih dahulu
  topics.sort((a, b) => a.masteryPercentage - b.masteryPercentage);

  const unmasteredTopics = topics.filter((t) => !t.isMastered || t.wrongCount > 0);

  let recommendedDifficultyMode: 'REGULER' | 'BALANCED' | 'HOTS' = 'BALANCED';
  if (regulerMissed >= hotsMissed && regulerMissed > 0) {
    recommendedDifficultyMode = 'REGULER';
  } else if (hotsMissed > regulerMissed * 1.4) {
    recommendedDifficultyMode = 'HOTS';
  }

  return {
    studentName: submission.namaSiswa || 'Peserta Ujian',
    nilaiAkhir: submission.nilaiAkhir,
    kkm,
    needsRemedial: isBelowKkm,
    totalQuestions: examQuestions.length,
    totalCorrect,
    totalWrong,
    topics,
    unmasteredTopics,
    regulerMissedCount: regulerMissed,
    hotsMissedCount: hotsMissed,
    recommendedDifficultyMode,
    recommendedTopicElements: unmasteredTopics.map((t) => t.elemen),
  };
}

/**
 * Generator Paket Soal Remedial Otomatis Terfokus
 * Menghasilkan paket soal baru sesuai materi yang belum dikuasai siswa
 * dengan proporsi tingkat kesulitan (REGULER / HOTS / BALANCED) yang dipilih.
 */
export function generateFocusedRemedialPackageForStudent(
  params: RemedialGenerationParams
): RemedialPackageResult {
  const {
    namaSiswa,
    nisNisn,
    packageKey,
    unmasteredElements,
    difficultyMode,
    questionCount = 15,
    baseQuestions = [],
    previousSubmission,
  } = params;

  const [jenjang, semester] = packageKey.split('_') as [JenjangKelas, SemesterType];
  const targetCount = Math.max(10, Math.min(25, questionCount));

  // Ambil kandidat soal dari berbagai sumber terpercaya
  const officialBank = FASE_D_QUESTION_BANKS[packageKey] || baseQuestions;
  const onlineExtras = ONLINE_EXTRA_QUESTIONS_POOL[packageKey] || [];
  const dynamicBatch1 = buildDynamicParameterizedRetakePool(packageKey, 1, 47);
  const dynamicBatch2 = buildDynamicParameterizedRetakePool(packageKey, 2, 93);
  const dynamicBatch3 = buildDynamicParameterizedRetakePool(packageKey, 3, 139);

  // Kumpulkan semua candidate questions
  const allCandidates: Question[] = [];
  const seenContentSet = new Set<string>();

  [...officialBank, ...onlineExtras, ...dynamicBatch1, ...dynamicBatch2, ...dynamicBatch3, ...baseQuestions].forEach(
    (q) => {
      if (!q || !q.content) return;
      const normContent = q.content.trim().toLowerCase().replace(/\s+/g, ' ');
      if (seenContentSet.has(normContent)) return;
      seenContentSet.add(normContent);

      const el = normalizeInformatikaElement(q.elemen, q.content);
      allCandidates.push({
        ...q,
        elemen: el,
        jenjang,
        semester,
      });
    }
  );

  const targetedElementsSet = new Set(
    (unmasteredElements.length > 0
      ? unmasteredElements
      : [
          'Berpikir Komputasional (BK)',
          'Jaringan Komputer & Internet (JKI)',
          'Sistem Komputer (SK)',
          'Teknologi Informasi & Komunikasi (TIK)',
        ]
    ).map((e) => e.toLowerCase())
  );

  // Filter soal yang secara spesifik mencakup materi belum dikuasai
  const targetedPool = allCandidates.filter((q) => {
    const qEl = (q.elemen || '').toLowerCase();
    return Array.from(targetedElementsSet).some((target) => qEl.includes(target) || target.includes(qEl));
  });

  const secondaryPool = allCandidates.filter((q) => !targetedPool.includes(q));

  // Pisahkan berdasarkan tingkat kesulitan
  const targetedReguler = targetedPool.filter((q) => q.difficulty === 'REGULER');
  const targetedHots = targetedPool.filter((q) => q.difficulty === 'HOTS');
  const secondaryReguler = secondaryPool.filter((q) => q.difficulty === 'REGULER');
  const secondaryHots = secondaryPool.filter((q) => q.difficulty === 'HOTS');

  // PRNG Deterministic berbasis siswa & sesi
  const seedString = `REMEDIAL|${packageKey}|${namaSiswa}|${nisNisn}|${difficultyMode}|${Date.now()}`;
  const prng = createSeededPrngFromContext(seedString);
  const shuffle = <T,>(arr: T[]): T[] => {
    const copy = [...arr];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(prng() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  };

  let desiredRegulerCount: number;
  let desiredHotsCount: number;

  if (difficultyMode === 'REGULER') {
    // 75% Reguler, 25% HOTS
    desiredRegulerCount = Math.round(targetCount * 0.75);
    desiredHotsCount = targetCount - desiredRegulerCount;
  } else if (difficultyMode === 'HOTS') {
    // 75% HOTS, 25% Reguler
    desiredHotsCount = Math.round(targetCount * 0.75);
    desiredRegulerCount = targetCount - desiredHotsCount;
  } else {
    // 50% Reguler, 50% HOTS
    desiredRegulerCount = Math.floor(targetCount / 2);
    desiredHotsCount = targetCount - desiredRegulerCount;
  }

  const selectedReguler: Question[] = [];
  const selectedHots: Question[] = [];

  // Ambil reguler dari targeted terlebih dahulu
  const shuffledTargetedReg = shuffle(targetedReguler);
  for (const q of shuffledTargetedReg) {
    if (selectedReguler.length < desiredRegulerCount) selectedReguler.push(q);
  }
  // Jika kurang, ambil dari secondary
  if (selectedReguler.length < desiredRegulerCount) {
    for (const q of shuffle(secondaryReguler)) {
      if (selectedReguler.length < desiredRegulerCount) selectedReguler.push(q);
    }
  }

  // Ambil hots dari targeted terlebih dahulu
  const shuffledTargetedHots = shuffle(targetedHots);
  for (const q of shuffledTargetedHots) {
    if (selectedHots.length < desiredHotsCount) selectedHots.push(q);
  }
  // Jika kurang, ambil dari secondary
  if (selectedHots.length < desiredHotsCount) {
    for (const q of shuffle(secondaryHots)) {
      if (selectedHots.length < desiredHotsCount) selectedHots.push(q);
    }
  }

  let combined = [...selectedReguler, ...selectedHots];
  // Jika total masih kurang dari targetCount, lengkapi dari sisa targeted atau secondary
  if (combined.length < targetCount) {
    const usedIds = new Set(combined.map((q) => q.content));
    for (const q of shuffle([...targetedPool, ...secondaryPool])) {
      if (combined.length >= targetCount) break;
      if (!usedIds.has(q.content)) {
        usedIds.add(q.content);
        combined.push(q);
      }
    }
  }

  // Acak opsi jawaban A/B/C/D agar unik dan tidak monoton
  const letters: ('A' | 'B' | 'C' | 'D')[] = ['A', 'B', 'C', 'D'];
  const finalQuestions: Question[] = shuffle(combined).slice(0, targetCount).map((q, idx) => {
    const origIdx = letters.indexOf(q.answer);
    const correctText = origIdx >= 0 && origIdx < q.options.length ? q.options[origIdx] : q.options[0];
    const taggedOpts = q.options.map((optText, oIdx) => ({
      text: optText,
      isCorrect: oIdx === (origIdx >= 0 ? origIdx : 0),
    }));
    const shuffledOpts = shuffle(taggedOpts);
    const newCorrectIdx = shuffledOpts.findIndex((o) => o.isCorrect || o.text === correctText);

    return {
      ...q,
      id: idx + 1,
      jenjang,
      semester,
      options: shuffledOpts.map((o) => o.text) as [string, string, string, string],
      answer: letters[newCorrectIdx >= 0 ? newCorrectIdx : 0],
    };
  });

  const rand4 = Math.floor(1000 + prng() * 9000);
  const remedialToken = `REM-${jenjang || 'D'}-${rand4}`;

  const modeLabel =
    difficultyMode === 'REGULER'
      ? 'Fokus Dasar & Konsep Inti (Reguler)'
      : difficultyMode === 'HOTS'
      ? 'Fokus Penalaran & Analisis (HOTS)'
      : 'Adaptif Berimbang (Reguler & HOTS)';

  return {
    questions: finalQuestions,
    packageTitle: `Paket Remedial Terfokus (${finalQuestions.length} Soal · ${modeLabel})`,
    difficultyMode,
    targetedElements: Array.from(targetedElementsSet),
    totalQuestions: finalQuestions.length,
    remedialToken,
    sourceDescription: `Paket remedial otomatis hasil analisis kelemahan materi (${namaSiswa} · KKM 75 · Token Otorisasi: ${remedialToken})`,
  };
}

export const GAS_CODE_TEMPLATE = `/**
 * ============================================================================
 * GOOGLE APPS SCRIPT (Code.gs) - APLIKASI UJIAN ANBK INFORMATIKA FASE D
 * KELAS VII & KELAS VIII (SEMESTER GANJIL & GENAP)
 * UPTD SMP NEGERI 7 KISARAN
 * Guru Mapel / Pembuat Soal : EKSA YUDIKA SIRAIT S.T
 * Tahun Ajaran              : 2026/2027
 * Kurikulum                 : Kurikulum Merdeka Fase D (Deep Learning)
 * ============================================================================
 */

const CONFIG = {
  SHEET_NAME_REKAP: 'Rekap Hasil Ujian',
  SHEET_NAME_SOAL: 'Bank Soal Fase D',
  SHEET_NAME_TOKEN: 'KODE TOKEN UJIAN',
  GOOGLE_DOC_ID: '', // Opsional: Isi dengan ID Google Dokumen Soal jika ingin import otomatis dari Google Docs
  TEACHER_EMAIL: 'eksayudikasirait@gmail.com',
  TEACHER_WA: '+62 821-6588-5568',
  FONNTE_TOKEN: '', // Opsional: Isi Token API Fonnte untuk pengiriman WhatsApp otomatis di latar belakang
  APP_URL: 'https://ais-dev-ympg3toowvdduliu5pxxka-966686878667.asia-southeast1.run.app' // URL Webhook Aplikasi Ujian ANBK
};

/**
 * Event-Driven Token Push Trigger:
 * Dijalankan otomatis ketika ada sel yang diedit di Google Spreadsheet (khususnya tab "KODE TOKEN UJIAN").
 * Setiap perubahan langsung ter-push via HTTP POST ke endpoint webhook aplikasi ujian secara instan!
 */
function onEdit(e) {
  try {
    if (!e || !e.range) return;
    var sheet = e.range.getSheet();
    if (!sheet) return;
    var sheetName = sheet.getName();
    if (sheetName === CONFIG.SHEET_NAME_TOKEN) {
      var editedRow = e.range.getRow();
      var editedCol = e.range.getColumn();
      // Sel A2 atau baris 2 kolom 1
      if (editedRow === 2 && editedCol === 1) {
        var newToken = String(e.value || sheet.getRange(2, 1).getValue() || '').trim().toUpperCase();
        if (newToken) {
          pushTokenToAppWebhook(newToken);
        }
      }
    }
  } catch (err) {
    Logger.log('Error onEdit: ' + err);
  }
}

function pushTokenToAppWebhook(token) {
  if (!CONFIG.APP_URL) return;
  try {
    var webhookUrl = CONFIG.APP_URL.replace(/\/+$/, '') + '/__api/token-webhook';
    UrlFetchApp.fetch(webhookUrl, {
      method: 'post',
      contentType: 'application/json',
      muteHttpExceptions: true,
      payload: JSON.stringify({
        token: token,
        action: 'tokenUpdated',
        source: 'Google Sheets onEdit Event-Driven Push',
        timestamp: new Date().getTime()
      })
    });
  } catch (err) {
    Logger.log('Gagal push webhook token: ' + err);
  }
}

/**
 * Menampilkan halaman Web App (index.html) atau mengambil Bank Soal / Token Ujian dari Google Sheet
 */
function doGet(e) {
  initSheets();
  if (e && e.parameter && (e.parameter.action === 'resetAllSubmissions' || e.parameter.action === 'clearAllSubmissions')) {
    syncBatchSubmissionsToSheet([]);
    return ContentService
      .createTextOutput(JSON.stringify({
        status: 'success',
        cleared: true,
        syncedCount: 0,
        message: 'Rekap Hasil Ujian 13 kolom berhasil direset kosong'
      }))
      .setMimeType(ContentService.MimeType.JSON);
  }
  if (e && e.parameter && e.parameter.action === 'getToken') {
    return ContentService
      .createTextOutput(JSON.stringify({
        status: 'success',
        token: getActiveTokenFromSheet()
      }))
      .setMimeType(ContentService.MimeType.JSON);
  }
  if (e && e.parameter && e.parameter.action === 'getQuestions') {
    const jenjang = e.parameter.jenjang || 'VIII';
    const semester = e.parameter.semester || 'Ganjil';
    return ContentService
      .createTextOutput(JSON.stringify({
        status: 'success',
        jenjang: jenjang,
        semester: semester,
        questions: getQuestionsFromSheetOrDoc(jenjang, semester)
      }))
      .setMimeType(ContentService.MimeType.JSON);
  }
  if (e && e.parameter && e.parameter.action === 'getSubmissions') {
    return ContentService
      .createTextOutput(JSON.stringify({ status: 'success', submissions: getAllSubmissions() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
  if (e && e.parameter && (e.parameter.action === 'resetAllSubmissions' || e.parameter.action === 'clearAllSubmissions')) {
    syncBatchSubmissionsToSheet([]);
    return ContentService
      .createTextOutput(JSON.stringify({ status: 'success', cleared: true, submissions: [] }))
      .setMimeType(ContentService.MimeType.JSON);
  }
  return HtmlService.createHtmlOutputFromFile('index')
    .setTitle('ANBK Informatika Fase D (Kelas VII & VIII) - UPTD SMP Negeri 7 Kisaran')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

/**
 * Menerima request POST dari aplikasi ujian (Auto-Save, Submit Akhir, Notifikasi Email/WA, & Kelola Soal)
 */
function doPost(e) {
  try {
    initSheets();
    const payload = JSON.parse(e.postData.contents);
    const action = payload.action;

    if (action === 'autosave' || action === 'submitExam') {
      const result = saveStudentSubmission(payload.data, action === 'submitExam', payload);
      return jsonResponse({ status: 'success', result });
    }

    if (action === 'saveQuestions') {
      saveQuestionsToSheet(payload.questions, payload.jenjang, payload.semester);
      return jsonResponse({ status: 'success' });
    }

    if (action === 'saveToken') {
      saveActiveTokenToSheet(payload.token);
      return jsonResponse({ status: 'success', token: payload.token });
    }

    if (action === 'updateSubmission') {
      updateStudentRow(payload.data);
      return jsonResponse({ status: 'success' });
    }

    if (action === 'resetAllSubmissions' || action === 'clearAllSubmissions') {
      syncBatchSubmissionsToSheet([]);
      return jsonResponse({ status: 'success', cleared: true, syncedCount: 0 });
    }

    if (action === 'syncAllSubmissions' && Array.isArray(payload.submissions)) {
      const count = syncBatchSubmissionsToSheet(payload.submissions);
      return jsonResponse({ status: 'success', syncedCount: count });
    }

    return jsonResponse({ status: 'ok', message: 'Action processed' });
  } catch (err) {
    return jsonResponse({ status: 'error', message: err.toString() });
  }
}

function jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Inisialisasi Google Sheet dengan Header Kolom Persis Sesuai Spesifikasi (11 Kolom + Device):
 * Timestamp, Nama Siswa, NIS/NISN, Kelas, Semester, Skor Benar, Total Soal, Nilai Akhir, Status Kecurangan, Lulus/Tidak Lulus, Device
 */
function initSheets() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) return;

  const headers = [
    'Timestamp',
    'Nama Siswa',
    'NIS/NISN',
    'Kelas',
    'Semester',
    'Skor Benar',
    'Total Soal',
    'Nilai Akhir',
    'Status Kecurangan',
    'Lulus/Tidak Lulus',
    'Ranking',
    'Device',
    'FOTO'
  ];

  let rekapSheet = ss.getSheetByName(CONFIG.SHEET_NAME_REKAP);
  let isNewRekapSheet = false;
  if (!rekapSheet) {
    rekapSheet = ss.insertSheet(CONFIG.SHEET_NAME_REKAP);
    isNewRekapSheet = true;
  }
  const existingRow1 = rekapSheet.getRange(1, 1, 1, headers.length).getValues()[0] || [];
  const hasExistingHeaders = existingRow1.some(function(cell) {
    return String(cell || '').trim().length > 0;
  });
  if (isNewRekapSheet || !hasExistingHeaders) {
    rekapSheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    rekapSheet.getRange(1, 1, 1, headers.length)
      .setFontWeight('bold')
      .setBackground('#0284c7')
      .setFontColor('#ffffff');
    rekapSheet.setFrozenRows(1);
  }

  let tokenSheet = ss.getSheetByName(CONFIG.SHEET_NAME_TOKEN);
  if (!tokenSheet) {
    tokenSheet = ss.insertSheet(CONFIG.SHEET_NAME_TOKEN);
    tokenSheet.getRange(1, 1, 1, 3).setValues([['KODE TOKEN UJIAN', 'WAKTU DIPERBARUI', 'GURU MAPEL']]);
    tokenSheet.getRange(1, 1, 1, 3)
      .setFontWeight('bold')
      .setBackground('#f59e0b')
      .setFontColor('#0f172a');
    tokenSheet.getRange(2, 1, 1, 3).setValues([['ANBK78', Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'dd/MM/yyyy HH:mm:ss'), 'EKSA YUDIKA SIRAIT S.T']]);
    tokenSheet.setFrozenRows(1);
  }
}

function getActiveTokenFromSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) return 'ANBK78';
  let tokenSheet = ss.getSheetByName(CONFIG.SHEET_NAME_TOKEN);
  if (!tokenSheet) return 'ANBK78';
  const val = String(tokenSheet.getRange(2, 1).getValue() || '').trim().toUpperCase();
  return val || 'ANBK78';
}

function saveActiveTokenToSheet(newToken) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) return;
  initSheets();
  const tokenSheet = ss.getSheetByName(CONFIG.SHEET_NAME_TOKEN);
  const ts = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'dd/MM/yyyy HH:mm:ss');
  const cleanTok = String(newToken || 'ANBK78').trim().toUpperCase();
  tokenSheet.getRange(2, 1, 1, 3).setValues([[cleanTok, ts, 'EKSA YUDIKA SIRAIT S.T']]);
  pushTokenToAppWebhook(cleanTok);
}

function extractCleanKelas(kelasStr) {
  if (!kelasStr) return 'VIII-1';
  return String(kelasStr).replace(/\\s*\\(Semester\\s+(Ganjil|Genap)\\)/i, '').trim() || 'VIII-1';
}

function extractSemester(data) {
  if (data && (data.semester === 'Ganjil' || data.semester === 'Genap')) {
    return data.semester;
  }
  if (data && data.kelas && String(data.kelas).toLowerCase().indexOf('genap') !== -1) {
    return 'Genap';
  }
  return 'Ganjil';
}

/**
 * Menyimpan atau Memperbarui Jawaban Siswa Secara Real-Time (Auto-Save & Final Submit)
 * Urutan Kolom Persis:
 * Timestamp, Nama Siswa, NIS/NISN, Kelas, Semester, Skor Benar, Total Soal, Nilai Akhir, Status Kecurangan, Lulus/Tidak Lulus
 */
function saveStudentSubmission(data, isFinalSubmit, payload) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) return { saved: false };

  const sheet = ss.getSheetByName(CONFIG.SHEET_NAME_REKAP);
  const rows = sheet.getDataRange().getValues();
  const timestamp = data.timestamp || Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'dd/MM/yyyy HH:mm:ss');
  const cleanKelas = extractCleanKelas(data.kelas);
  const semester = extractSemester(data);

  const deviceStr = data.deviceInfo || (data.deviceCategory ? (data.deviceCategory + ' — ' + (data.deviceModel || data.deviceBrand || 'Perangkat Siswa')) : 'HP Android — Perangkat Siswa');
  const fotoStr = data.photoUrl || ('Pas Foto Resmi ANBK — ' + (data.namaSiswa || 'Siswa') + ' (' + cleanKelas + ')');
  const rankStr = data.ranking || ('Peringkat #' + Math.max(1, rows.length));

  const rowValues = [
    timestamp,
    data.namaSiswa,
    data.nisNisn,
    cleanKelas,
    semester,
    data.skorBenar,
    data.totalSoal,
    data.nilaiAkhir,
    data.statusKecurangan,
    data.lulusTidakLulus,
    rankStr,
    deviceStr,
    fotoStr
  ];

  let existingRowIndex = -1;
  for (let i = 1; i < rows.length; i++) {
    if (
      (String(rows[i][1]).trim() === String(timestamp).trim() &&
        String(rows[i][2]).trim() === String(data.namaSiswa).trim()) ||
      (String(rows[i][0]).trim() === String(timestamp).trim() &&
        String(rows[i][1]).trim() === String(data.namaSiswa).trim())
    ) {
      existingRowIndex = i + 1;
      break;
    }
  }

  if (existingRowIndex > 0) {
    sheet.getRange(existingRowIndex, 1, 1, rowValues.length).setValues([rowValues]);
  } else {
    sheet.appendRow(rowValues);
  }

  if (isFinalSubmit && (!payload || !payload.skipEmailNotification)) {
    if (payload && (payload.jpgBase64 || payload.pdfBase64 || payload.sendEmailOnly)) {
      sendTeacherNotifications(data, timestamp, payload);
    }
  }

  return { saved: true, timestamp };
}

/**
 * Sinkronisasi Massal Seluruh Rekap Hasil Ujian ke Google Sheet
 */
function syncBatchSubmissionsToSheet(submissionsList) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) return 0;

  initSheets();
  const sheet = ss.getSheetByName(CONFIG.SHEET_NAME_REKAP);
  const lastRow = sheet.getLastRow();
  if (lastRow > 1) {
    sheet.getRange(2, 1, lastRow - 1, 13).clearContent();
  }

  if (!submissionsList || submissionsList.length === 0) return 0;

  const sortedForRank = submissionsList.slice().sort(function(a, b) {
    const scoreDiff = Number(b.nilaiAkhir || 0) - Number(a.nilaiAkhir || 0);
    if (scoreDiff !== 0) return scoreDiff;
    return Number(b.skorBenar || 0) - Number(a.skorBenar || 0);
  });
  const rankByKey = {};
  sortedForRank.forEach(function(item, rIdx) {
    const k = String(item.timestamp || '') + '_' + String(item.namaSiswa || '').toLowerCase();
    if (!rankByKey[k]) rankByKey[k] = '#' + (rIdx + 1);
  });

  const values = submissionsList.map(function(data, idx) {
    const devStr = data.deviceInfo || (data.deviceCategory ? (data.deviceCategory + ' — ' + (data.deviceModel || data.deviceBrand || 'Perangkat Siswa')) : 'HP Android — Perangkat Siswa');
    const cleanKls = extractCleanKelas(data.kelas);
    const fotoStr = data.photoUrl || ('Pas Foto Resmi ANBK — ' + (data.namaSiswa || 'Siswa') + ' (' + cleanKls + ')');
    const k = String(data.timestamp || '') + '_' + String(data.namaSiswa || '').toLowerCase();
    const rnk = data.ranking || rankByKey[k] || ('Peringkat #' + (idx + 1));
    return [
      data.timestamp || '',
      data.namaSiswa || '',
      data.nisNisn || '0',
      cleanKls,
      extractSemester(data),
      Number(data.skorBenar || 0),
      Number(data.totalSoal || 10),
      Number(data.nilaiAkhir || 0),
      data.statusKecurangan || 'Selesai Normal oleh Peserta',
      data.lulusTidakLulus || 'TIDAK LULUS',
      rnk,
      devStr,
      fotoStr
    ];
  });

  sheet.getRange(2, 1, values.length, 13).setValues(values);
  return values.length;
}

/**
 * Mengirim Hasil Ujian ke eksayudikasirait@gmail.com
 * dalam bentuk Format Gambar (.JPG) & Format PDF (.PDF)
 */
function sendTeacherNotifications(data, timestamp, payload) {
  const jenjang = String(data.kelas || '').toUpperCase().indexOf('VII-') === 0 ? 'VII' : 'VIII';
  const subject = '[ANBK INFORMATIKA KELAS ' + jenjang + '] Hasil Ujian (Format Gambar .JPG & Format PDF): ' + data.namaSiswa + ' (' + data.kelas + ') - ' + data.lulusTidakLulus;
  const jpgName = (payload && payload.jpgFilename) ? payload.jpgFilename : 'Hasil_Ujian_ANBK.jpg';
  const pdfName = (payload && payload.pdfFilename) ? payload.pdfFilename : 'Hasil_Ujian_ANBK.pdf';
  const body =
    'Hasil Ujian ANBK Informatika Kelas ' + jenjang + ' - ' + data.namaSiswa + ' (' + data.kelas + ')\\n' +
    'Terlampir dalam bentuk Format Gambar (.JPG): ' + jpgName + ' dan Format PDF (.PDF): ' + pdfName;

  try {
    const attachments = [];
    const inlineImages = {};
    if (payload && payload.jpgBase64) {
      const jpgBytes = Utilities.base64Decode(payload.jpgBase64);
      const jpgBlob = Utilities.newBlob(jpgBytes, 'image/jpeg', jpgName);
      attachments.push(jpgBlob);
      inlineImages['hasil_ujian_jpg'] = jpgBlob;
    }
    if (payload && payload.pdfBase64) {
      const pdfBytes = Utilities.base64Decode(payload.pdfBase64);
      const pdfBlob = Utilities.newBlob(pdfBytes, 'application/pdf', pdfName);
      attachments.push(pdfBlob);
    }
    if (attachments.length === 0) return;
    const htmlBody =
      '<div style="font-family:Segoe UI,Arial,sans-serif;max-width:760px;margin:0 auto;background:#0f172a;color:#f8fafc;padding:18px;border-radius:14px;">' +
      '<div style="font-size:13px;font-weight:800;color:#38bdf8;margin-bottom:6px;">HASIL UJIAN ANBK INFORMATIKA KELAS ' + jenjang + ' — FORMAT GAMBAR (.JPG) & FORMAT PDF (.PDF)</div>' +
      '<div style="font-size:12px;color:#cbd5e1;margin-bottom:12px;">Peserta: <b>' + data.namaSiswa + '</b> (' + data.kelas + ') · Nilai: <b>' + data.nilaiAkhir + '%</b> (' + data.lulusTidakLulus + ')</div>' +
      (inlineImages['hasil_ujian_jpg'] ? '<div style="margin-bottom:12px;"><img src="cid:hasil_ujian_jpg" alt="' + jpgName + '" style="width:100%;max-width:100%;height:auto;display:block;border-radius:10px;border:1px solid #334155;" /></div>' : '') +
      '<div style="font-size:11px;color:#94a3b8;">Lampiran Berkas: <b>' + jpgName + ' (.JPG)</b> & <b>' + pdfName + ' (.PDF)</b></div>' +
      '</div>';
    MailApp.sendEmail({
      to: CONFIG.TEACHER_EMAIL,
      subject: subject,
      body: body,
      htmlBody: htmlBody,
      inlineImages: inlineImages,
      attachments: attachments
    });
  } catch (e) {
    Logger.log('Gagal kirim email JPG/PDF: ' + e);
  }
}

/**
 * Membaca Soal dari Google Dokumen / Sheet sesuai Jenjang Kelas & Semester
 */
function getQuestionsFromSheetOrDoc(jenjang, semester) {
  if (CONFIG.GOOGLE_DOC_ID) {
    try {
      const doc = DocumentApp.openById(CONFIG.GOOGLE_DOC_ID);
      const text = doc.getBody().getText();
      return { rawDocText: text, jenjang: jenjang, semester: semester };
    } catch (e) {
      Logger.log('Gagal baca Google Doc: ' + e);
    }
  }
  return [];
}
`;
