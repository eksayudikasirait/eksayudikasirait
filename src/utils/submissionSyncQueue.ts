import {
  StudentSubmission,
  REKAP_SHEET_HEADERS,
  DEFAULT_REKAP_SHEET_URL,
  getCleanKelas,
  getSemesterFromSub,
  formatSubmissionToRekap13ColumnsWithRank,
  computeSubmissionRankingMap,
  getSubmissionUniqueKey,
  sanitizeRekapSheetUrl,
  readFirestoreCloudConfig,
  readFirestoreDashboardState,
  writeFirestoreDashboardState,
  extractSpreadsheetIdFromUrl,
} from '../data/examData';
import {
  getAccessTokenSync,
  syncAllSubmissionsToGoogleSheetViaRestApi,
} from '../services/gmailAuthService';
import { useState, useEffect, useCallback } from 'react';

export type QueueItemType = 'single_submission' | 'batch_submissions';
export type QueueItemStatus = 'pending' | 'processing' | 'failed' | 'success';

export interface SyncQueueItem {
  id: string;
  type: QueueItemType;
  studentId?: string;
  studentName?: string;
  studentNis?: string;
  timestamp: number;
  payload: StudentSubmission | StudentSubmission[];
  sheetUrl?: string;
  appsScriptUrl?: string;
  attempts: number;
  maxAttempts: number;
  lastAttemptAt?: number;
  nextAttemptAt: number;
  status: QueueItemStatus;
  lastError?: string;
  source?: string;
}

export interface SyncQueueStats {
  pendingCount: number;
  processingCount: number;
  failedCount: number;
  completedCount: number;
  totalActiveCount: number;
  isOnline: boolean;
  isProcessing: boolean;
  lastSyncSuccessTime: string | null;
  lastSyncAttemptTime: string | null;
  lastError: string | null;
}

const STORAGE_QUEUE_KEY = 'anbk_submission_sync_queue_v2';
const STORAGE_HISTORY_KEY = 'anbk_submission_sync_history_v2';
const MAX_HISTORY_ITEMS = 25;
const DEFAULT_MAX_ATTEMPTS = 8;
const MIN_RETRY_DELAY_MS = 2500;
const MAX_RETRY_DELAY_MS = 60000;

export const SYNC_QUEUE_UPDATED_EVENT = 'anbk-sync-queue-updated';
export const SYNC_QUEUE_ITEM_SUCCESS_EVENT = 'anbk-sync-queue-item-success';

let isQueueWorkerRunning = false;
let workerScheduledTimeoutId: number | null = null;
let watchdogIntervalId: number | null = null;
let lastRecordedSuccessTime: string | null = null;
let lastRecordedError: string | null = null;

// Helper membaca antrean dari localStorage
function loadQueueFromStorage(): SyncQueueItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_QUEUE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    // Pulihkan item yang mungkin terhenti saat browser reload/crash
    return parsed.map((item) => {
      if (item && item.status === 'processing') {
        return {
          ...item,
          status: 'pending' as QueueItemStatus,
          nextAttemptAt: Date.now(),
        };
      }
      return item;
    });
  } catch {
    return [];
  }
}

// Helper menyimpan antrean ke localStorage
function saveQueueToStorage(queue: SyncQueueItem[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_QUEUE_KEY, JSON.stringify(queue));
  } catch (err) {
    console.warn('Gagal menyimpan antrean sinkronisasi ke storage:', err);
    // Jika penyimpanan penuh, bersihkan item history
    try {
      localStorage.removeItem(STORAGE_HISTORY_KEY);
      localStorage.setItem(STORAGE_QUEUE_KEY, JSON.stringify(queue.slice(0, 50)));
    } catch {
      // ignore
    }
  }
}

// Helper membaca riwayat pengiriman sukses
function loadHistoryFromStorage(): SyncQueueItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

// Helper menambah item ke riwayat sukses
function recordCompletedItem(item: SyncQueueItem): void {
  if (typeof window === 'undefined') return;
  try {
    const history = loadHistoryFromStorage();
    const updated = [
      {
        ...item,
        status: 'success' as QueueItemStatus,
        lastAttemptAt: Date.now(),
      },
      ...history,
    ].slice(0, MAX_HISTORY_ITEMS);
    localStorage.setItem(STORAGE_HISTORY_KEY, JSON.stringify(updated));
  } catch {
    // ignore
  }
}

// Siarkan perubahan status antrean ke seluruh aplikasi (termasuk komponen React & Tab lain)
export function broadcastQueueStats(): void {
  if (typeof window === 'undefined') return;
  const stats = getSyncQueueStats();
  window.dispatchEvent(
    new CustomEvent(SYNC_QUEUE_UPDATED_EVENT, {
      detail: stats,
    })
  );
}

// Mendapatkan statistik lengkap antrean sinkronisasi saat ini
export function getSyncQueueStats(): SyncQueueStats {
  const queue = loadQueueFromStorage();
  const history = loadHistoryFromStorage();
  const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;

  const pending = queue.filter((i) => i.status === 'pending');
  const processing = queue.filter((i) => i.status === 'processing');
  const failed = queue.filter((i) => i.status === 'failed');

  return {
    pendingCount: pending.length,
    processingCount: processing.length,
    failedCount: failed.length,
    completedCount: history.length,
    totalActiveCount: queue.length,
    isOnline,
    isProcessing: isQueueWorkerRunning || processing.length > 0,
    lastSyncSuccessTime: lastRecordedSuccessTime,
    lastSyncAttemptTime: queue[0]?.lastAttemptAt
      ? new Date(queue[0].lastAttemptAt).toLocaleTimeString('id-ID', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        })
      : null,
    lastError: lastRecordedError,
  };
}

// Mendapatkan daftar item antrean yang belum selesai
export function getActiveQueueItems(): SyncQueueItem[] {
  return loadQueueFromStorage();
}

// Mendapatkan riwayat pengiriman yang telah sukses
export function getCompletedSyncHistory(): SyncQueueItem[] {
  return loadHistoryFromStorage();
}

// Cek apakah siswa tertentu sedang berada dalam antrean pengiriman
export function checkStudentSubmissionQueueStatus(
  submission: StudentSubmission
): 'synced' | 'pending' | 'processing' | 'failed' | 'not_in_queue' {
  const queue = loadQueueFromStorage();
  const subKey = getSubmissionUniqueKey(submission);
  const found = queue.find((i) => {
    if (i.type === 'single_submission') {
      const p = i.payload as StudentSubmission;
      return (
        p.id === submission.id ||
        getSubmissionUniqueKey(p) === subKey ||
        (i.studentName === submission.namaSiswa && i.studentNis === submission.nisNisn)
      );
    }
    return false;
  });

  if (found) {
    return found.status === 'success' ? 'synced' : found.status;
  }

  const history = loadHistoryFromStorage();
  const inHistory = history.some((i) => {
    if (i.type === 'single_submission') {
      const p = i.payload as StudentSubmission;
      return (
        p.id === submission.id ||
        getSubmissionUniqueKey(p) === subKey ||
        (i.studentName === submission.namaSiswa && i.studentNis === submission.nisNisn)
      );
    }
    return false;
  });

  return inHistory ? 'synced' : 'not_in_queue';
}

// Enqueue satu hasil ujian siswa ke dalam antrean (FIFO + deduplikasi pintar)
export function enqueueSubmissionSync(
  submission: StudentSubmission,
  options?: {
    sheetUrl?: string;
    appsScriptUrl?: string;
    immediate?: boolean;
    source?: string;
  }
): SyncQueueItem {
  const queue = loadQueueFromStorage();
  const subKey = getSubmissionUniqueKey(submission);
  const existingIdx = queue.findIndex((item) => {
    if (item.type === 'single_submission') {
      const p = item.payload as StudentSubmission;
      return (
        p.id === submission.id ||
        getSubmissionUniqueKey(p) === subKey ||
        (item.studentName === submission.namaSiswa && item.studentNis === submission.nisNisn)
      );
    }
    return false;
  });

  const now = Date.now();
  let targetItem: SyncQueueItem;

  if (existingIdx >= 0) {
    // Perbarui data yang sudah ada di antrean
    targetItem = {
      ...queue[existingIdx],
      payload: submission,
      sheetUrl: options?.sheetUrl || queue[existingIdx].sheetUrl,
      appsScriptUrl: options?.appsScriptUrl || queue[existingIdx].appsScriptUrl,
      source: options?.source || queue[existingIdx].source || 'Live Ujian Siswa',
      status: 'pending',
      nextAttemptAt: options?.immediate ? now : Math.min(queue[existingIdx].nextAttemptAt, now),
    };
    queue[existingIdx] = targetItem;
  } else {
    // Buat item baru di antrean
    targetItem = {
      id: `queue_${now}_${Math.random().toString(36).slice(2, 9)}`,
      type: 'single_submission',
      studentId: submission.id,
      studentName: submission.namaSiswa,
      studentNis: submission.nisNisn,
      timestamp: now,
      payload: submission,
      sheetUrl: options?.sheetUrl,
      appsScriptUrl: options?.appsScriptUrl,
      attempts: 0,
      maxAttempts: DEFAULT_MAX_ATTEMPTS,
      nextAttemptAt: now,
      status: 'pending',
      source: options?.source || 'Live Ujian Siswa',
    };
    queue.push(targetItem);
  }

  saveQueueToStorage(queue);
  broadcastQueueStats();

  // Picu pemrosesan antrean
  scheduleQueueProcessing(0);

  return targetItem;
}

// Enqueue sekumpulan (batch) hasil ujian ke dalam antrean
export function enqueueBatchSubmissionsSync(
  submissions: StudentSubmission[],
  options?: {
    sheetUrl?: string;
    appsScriptUrl?: string;
    immediate?: boolean;
    source?: string;
  }
): SyncQueueItem {
  const queue = loadQueueFromStorage();
  const now = Date.now();

  const existingIdx = queue.findIndex(
    (item) => item.type === 'batch_submissions' && item.status === 'pending'
  );

  let targetItem: SyncQueueItem;

  if (existingIdx >= 0) {
    targetItem = {
      ...queue[existingIdx],
      payload: submissions,
      sheetUrl: options?.sheetUrl || queue[existingIdx].sheetUrl,
      appsScriptUrl: options?.appsScriptUrl || queue[existingIdx].appsScriptUrl,
      source: options?.source || queue[existingIdx].source || 'Rekapitulasi Batch',
      nextAttemptAt: options?.immediate ? now : Math.min(queue[existingIdx].nextAttemptAt, now),
    };
    queue[existingIdx] = targetItem;
  } else {
    targetItem = {
      id: `batch_${now}_${Math.random().toString(36).slice(2, 9)}`,
      type: 'batch_submissions',
      timestamp: now,
      payload: submissions,
      sheetUrl: options?.sheetUrl,
      appsScriptUrl: options?.appsScriptUrl,
      attempts: 0,
      maxAttempts: DEFAULT_MAX_ATTEMPTS,
      nextAttemptAt: now,
      status: 'pending',
      source: options?.source || 'Rekapitulasi Batch',
    };
    queue.push(targetItem);
  }

  saveQueueToStorage(queue);
  broadcastQueueStats();
  scheduleQueueProcessing(0);

  return targetItem;
}

// Jalankan sync untuk 1 item antrean menggunakan jalur redundan anti-gagal
async function executeSyncItem(item: SyncQueueItem): Promise<boolean> {
  const submissionsList: StudentSubmission[] =
    item.type === 'single_submission'
      ? [item.payload as StudentSubmission]
      : (item.payload as StudentSubmission[]);

  if (!submissionsList || submissionsList.length === 0) {
    return true; // Tidak ada yang perlu dikirim
  }

  const fsCfg = await readFirestoreCloudConfig().catch(() => null);
  const targetSheetUrl = sanitizeRekapSheetUrl(
    item.sheetUrl || fsCfg?.googleSheetUrl || DEFAULT_REKAP_SHEET_URL
  );
  const targetScriptUrl =
    (item.appsScriptUrl && item.appsScriptUrl.trim()) ||
    (fsCfg?.appsScriptWebAppUrl && fsCfg.appsScriptWebAppUrl.trim()) ||
    (targetSheetUrl.includes('script.google.com') ? targetSheetUrl : '');

  // Gabungkan dengan data di localStorage dan Firestore agar tidak menimpa data siswa lain
  let storedLocalSubs: StudentSubmission[] = [];
  if (typeof window !== 'undefined') {
    try {
      const savedV1 = localStorage.getItem('anbk_submissions_v1');
      if (savedV1) {
        const parsed = JSON.parse(savedV1);
        if (Array.isArray(parsed)) storedLocalSubs = parsed;
      }
    } catch {
      // ignore
    }
  }

  const fsCurrent = await readFirestoreDashboardState().catch(() => null);
  const existingFsList: StudentSubmission[] = Array.isArray(fsCurrent?.submissions)
    ? (fsCurrent!.submissions as StudentSubmission[])
    : [];

  const currentFallbackIp = typeof window !== 'undefined' ? localStorage.getItem('anbk_detected_client_ip_v1') || '103.148.201.77' : '103.148.201.77';
  const currentFallbackFp = typeof window !== 'undefined' ? localStorage.getItem('anbk_unique_device_fingerprint_v1') || 'DEV-A83F' : 'DEV-A83F';

  const mergedMap = new Map<string, StudentSubmission>();
  [...submissionsList, ...storedLocalSubs, ...existingFsList].forEach((s) => {
    if (!s || !s.namaSiswa) return;
    const norm: StudentSubmission = {
      ...s,
      kelas: getCleanKelas(s.kelas),
      semester: getSemesterFromSub(s),
      clientIp: s.clientIp || currentFallbackIp,
      deviceFingerprint: s.deviceFingerprint || currentFallbackFp,
    };
    const k = norm.id || getSubmissionUniqueKey(norm);
    if (!mergedMap.has(k)) {
      mergedMap.set(k, norm);
    }
  });

  const normalizedSubs = Array.from(mergedMap.values());
  const singleNormalized: StudentSubmission = {
    ...submissionsList[0],
    kelas: getCleanKelas(submissionsList[0].kelas),
    semester: getSemesterFromSub(submissionsList[0]),
    clientIp: submissionsList[0].clientIp || currentFallbackIp,
    deviceFingerprint: submissionsList[0].deviceFingerprint || currentFallbackFp,
  };

  const rankMap = computeSubmissionRankingMap(normalizedSubs);
  const rows13Cols = normalizedSubs.map((s, idx) => {
    const rnk = rankMap[s.id] || rankMap[getSubmissionUniqueKey(s)] || idx + 1;
    return formatSubmissionToRekap13ColumnsWithRank(s, rnk);
  });
  const singleRank =
    rankMap[singleNormalized.id] || rankMap[getSubmissionUniqueKey(singleNormalized)] || 1;
  const singleRow13 = formatSubmissionToRekap13ColumnsWithRank(singleNormalized, singleRank);

  const activeOauthTok =
    getAccessTokenSync() ||
    (fsCfg?.oauthAccessToken && (!fsCfg.oauthExpiresAt || fsCfg.oauthExpiresAt > Date.now())
      ? fsCfg.oauthAccessToken
      : '');

  let succeeded = false;
  let lastErrorDetail = '';

  // Jalur 1: Kirim langsung ke Google Apps Script Web App
  if (targetScriptUrl && targetScriptUrl.startsWith('http')) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 12000);

      const scriptPayload = {
        action: 'syncAllSubmissions',
        sheetName: 'Rekap Hasil Ujian',
        skipEmailNotification: true,
        headers: [...REKAP_SHEET_HEADERS],
        submissions: normalizedSubs,
        rows: rows13Cols,
        data: singleNormalized,
        row: singleRow13,
      };

      await fetch(targetScriptUrl, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(scriptPayload),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      succeeded = true;
    } catch (err: any) {
      lastErrorDetail = `Apps Script: ${err?.message || 'Gagal terhubung'}`;
    }
  }

  // Jalur 2: Google Sheets API v4 via OAuth Access Token
  const spreadsheetId = extractSpreadsheetIdFromUrl(targetSheetUrl);
  if (spreadsheetId && activeOauthTok) {
    try {
      const gidMatch = targetSheetUrl.match(/[?&#]gid=(\d+)/i);
      const preferredGid = gidMatch ? Number(gidMatch[1]) : 1908701833;
      const apiOk = await syncAllSubmissionsToGoogleSheetViaRestApi(
        spreadsheetId,
        rows13Cols,
        activeOauthTok,
        preferredGid
      );
      if (apiOk) {
        succeeded = true;
      }
    } catch (err: any) {
      lastErrorDetail = `Google Sheets REST: ${err?.message || 'Token/OAuth bermasalah'}`;
    }
  }

  // Jalur 3: Server Proxy Internal (/__api/student-dashboard-sync)
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 9000);

    const srvRes = await fetch(`/__api/student-dashboard-sync?_t=${Date.now()}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(
        item.type === 'single_submission'
          ? {
              action: 'upsertSubmission',
              submission: singleNormalized,
              sheetUrl: targetSheetUrl,
              appsScriptUrl: targetScriptUrl,
              oauthAccessToken: activeOauthTok || undefined,
            }
          : {
              action: 'pushToGoogleSheet',
              submissions: normalizedSubs,
              rows: rows13Cols,
              sheetUrl: targetSheetUrl,
              appsScriptUrl: targetScriptUrl,
              oauthAccessToken: activeOauthTok || undefined,
            }
      ),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (srvRes.ok) {
      const srvData = await srvRes.json().catch(() => null);
      if (
        srvData?.ok ||
        srvData?.savedToServer ||
        srvData?.pushedToSheet ||
        (srvData?.pushedCount && srvData.pushedCount > 0)
      ) {
        succeeded = true;
      }
    }
  } catch (err: any) {
    if (!lastErrorDetail) {
      lastErrorDetail = `Server Sync: ${err?.message || 'Koneksi terputus'}`;
    }
  }

  // Jalur 4: Cloud Firestore State Persistence (memastikan data tersimpan online di database)
  try {
    await writeFirestoreDashboardState({
      useInitialSubmissions: false,
      isCleared: false,
      clearedAt: 0,
      deletedIds: Array.isArray(fsCurrent?.deletedIds) ? fsCurrent!.deletedIds : [],
      submissions: normalizedSubs,
      questionBanks: fsCurrent?.questionBanks,
      updatedAt: Date.now(),
      source: `Tersinkron Antrean (Queue: ${item.source || 'Otomatis'})`,
    });
    succeeded = true;
  } catch {
    // ignore
  }

  if (!succeeded && lastErrorDetail) {
    lastRecordedError = lastErrorDetail;
  }

  return succeeded;
}

// Inti Loop Pemrosesan Antrean (Sequential FIFO dengan Kunci Mutex)
async function processQueueLoop(): Promise<void> {
  if (isQueueWorkerRunning) return;
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    // Tunggu sampai koneksi kembali online
    return;
  }

  isQueueWorkerRunning = true;
  broadcastQueueStats();

  try {
    let queue = loadQueueFromStorage();
    const now = Date.now();

    // Cari item tertua yang sudah tiba jadwal pengirimannya
    const eligibleIdx = queue.findIndex(
      (item) => (item.status === 'pending' || item.status === 'failed') && item.nextAttemptAt <= now
    );

    if (eligibleIdx === -1) {
      // Tidak ada item yang siap dikirim saat ini
      // Cek apakah ada item berikutnya yang sedang menunggu backoff
      const nextItem = queue
        .filter((i) => i.status === 'pending' || i.status === 'failed')
        .sort((a, b) => a.nextAttemptAt - b.nextAttemptAt)[0];

      if (nextItem && nextItem.nextAttemptAt > now) {
        scheduleQueueProcessing(Math.max(500, nextItem.nextAttemptAt - now));
      }
      return;
    }

    const currentItem = { ...queue[eligibleIdx], status: 'processing' as QueueItemStatus };
    queue[eligibleIdx] = currentItem;
    saveQueueToStorage(queue);
    broadcastQueueStats();

    // Jalankan sinkronisasi
    const success = await executeSyncItem(currentItem);

    // Muat ulang antrean terbaru jika ada penambahan saat sync sedang berjalan
    queue = loadQueueFromStorage();
    const updatedIdx = queue.findIndex((i) => i.id === currentItem.id);

    if (success) {
      // Hapus dari antrean aktif dan catat ke riwayat
      if (updatedIdx >= 0) {
        queue.splice(updatedIdx, 1);
        saveQueueToStorage(queue);
      }
      recordCompletedItem(currentItem);
      lastRecordedSuccessTime = new Date().toLocaleTimeString('id-ID', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
      lastRecordedError = null;

      // Siarkan event keberhasilan
      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent(SYNC_QUEUE_ITEM_SUCCESS_EVENT, { detail: currentItem })
        );
        window.dispatchEvent(new CustomEvent('anbk-sheets-sync-success'));
      }

      broadcastQueueStats();

      // Lanjutkan memproses item berikutnya dengan jeda sopan (350ms)
      scheduleQueueProcessing(350);
    } else {
      // Gagal: terapkan exponential backoff + jitter
      const nextAttempts = currentItem.attempts + 1;
      const delay = Math.min(
        MAX_RETRY_DELAY_MS,
        Math.round(MIN_RETRY_DELAY_MS * Math.pow(1.8, Math.min(nextAttempts - 1, 5))) +
          Math.floor(Math.random() * 800)
      );

      const hasReachedMax = nextAttempts >= currentItem.maxAttempts;
      const updatedItem: SyncQueueItem = {
        ...currentItem,
        attempts: nextAttempts,
        lastAttemptAt: Date.now(),
        nextAttemptAt: Date.now() + delay,
        status: hasReachedMax ? 'failed' : 'pending',
        lastError: lastRecordedError || 'Koneksi jaringan terganggu atau timeout',
      };

      if (updatedIdx >= 0) {
        queue[updatedIdx] = updatedItem;
      } else {
        queue.push(updatedItem);
      }
      saveQueueToStorage(queue);
      broadcastQueueStats();

      // Jadwalkan percobaan ulang untuk delay berikutnya
      scheduleQueueProcessing(delay);
    }
  } finally {
    isQueueWorkerRunning = false;
    broadcastQueueStats();
  }
}

// Jadwalkan pemrosesan antrean
function scheduleQueueProcessing(delayMs: number = 0): void {
  if (typeof window === 'undefined') return;
  if (workerScheduledTimeoutId) {
    clearTimeout(workerScheduledTimeoutId);
    workerScheduledTimeoutId = null;
  }
  workerScheduledTimeoutId = window.setTimeout(() => {
    workerScheduledTimeoutId = null;
    processQueueLoop().catch(() => {});
  }, Math.max(0, delayMs));
}

// Paksa sinkronisasi seluruh antrean sekarang juga (misal tombol "Kirim Antrean Sekarang")
export async function forceProcessQueueNow(): Promise<void> {
  const queue = loadQueueFromStorage();
  const now = Date.now();
  const updated = queue.map((item) => ({
    ...item,
    status: 'pending' as QueueItemStatus,
    nextAttemptAt: now,
  }));
  saveQueueToStorage(updated);
  broadcastQueueStats();
  await processQueueLoop();
}

// Coba ulang item yang berstatus gagal (failed)
export async function retryFailedQueueItems(): Promise<void> {
  const queue = loadQueueFromStorage();
  const now = Date.now();
  const updated = queue.map((item) => {
    if (item.status === 'failed') {
      return {
        ...item,
        attempts: 0,
        status: 'pending' as QueueItemStatus,
        nextAttemptAt: now,
        lastError: undefined,
      };
    }
    return item;
  });
  saveQueueToStorage(updated);
  broadcastQueueStats();
  await processQueueLoop();
}

// Bersihkan antrean (jika guru mereset semua data)
export function clearAllSyncQueue(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(STORAGE_QUEUE_KEY);
    broadcastQueueStats();
  } catch {
    // ignore
  }
}

// Bersihkan riwayat pengiriman
export function clearCompletedSyncHistory(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(STORAGE_HISTORY_KEY);
    broadcastQueueStats();
  } catch {
    // ignore
  }
}

// Inisialisasi pendengar event koneksi online/offline & watchdog
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    // Koneksi kembali aktif! Langsung bangunkan antrean
    const queue = loadQueueFromStorage();
    const now = Date.now();
    const updated = queue.map((item) => {
      if (item.status === 'pending' || item.status === 'failed') {
        return {
          ...item,
          nextAttemptAt: Math.min(item.nextAttemptAt, now),
        };
      }
      return item;
    });
    saveQueueToStorage(updated);
    broadcastQueueStats();
    scheduleQueueProcessing(300);
  });

  window.addEventListener('offline', () => {
    broadcastQueueStats();
  });

  // Watchdog berkala setiap 12 detik
  if (!watchdogIntervalId) {
    watchdogIntervalId = window.setInterval(() => {
      const queue = loadQueueFromStorage();
      if (queue.length > 0 && !isQueueWorkerRunning) {
        const now = Date.now();
        const hasDueItem = queue.some(
          (i) => (i.status === 'pending' || i.status === 'failed') && i.nextAttemptAt <= now
        );
        if (hasDueItem && navigator.onLine) {
          scheduleQueueProcessing(0);
        }
      }
    }, 12000);
  }

  // Mulai periksa antrean saat awal halaman dimuat
  setTimeout(() => {
    const queue = loadQueueFromStorage();
    if (queue.length > 0 && navigator.onLine) {
      scheduleQueueProcessing(800);
    }
  }, 1000);
}

// Custom React Hook untuk memantau status antrean sinkronisasi secara reaktif
export function useSubmissionSyncQueue() {
  const [stats, setStats] = useState<SyncQueueStats>(() => getSyncQueueStats());
  const [items, setItems] = useState<SyncQueueItem[]>(() => getActiveQueueItems());
  const [history, setHistory] = useState<SyncQueueItem[]>(() => getCompletedSyncHistory());

  const refresh = useCallback(() => {
    setStats(getSyncQueueStats());
    setItems(getActiveQueueItems());
    setHistory(getCompletedSyncHistory());
  }, []);

  useEffect(() => {
    const handleUpdate = () => refresh();
    window.addEventListener(SYNC_QUEUE_UPDATED_EVENT, handleUpdate);
    window.addEventListener('storage', handleUpdate);
    window.addEventListener('online', handleUpdate);
    window.addEventListener('offline', handleUpdate);

    return () => {
      window.removeEventListener(SYNC_QUEUE_UPDATED_EVENT, handleUpdate);
      window.removeEventListener('storage', handleUpdate);
      window.removeEventListener('online', handleUpdate);
      window.removeEventListener('offline', handleUpdate);
    };
  }, [refresh]);

  return {
    stats,
    items,
    history,
    refresh,
    forceProcessNow: forceProcessQueueNow,
    retryFailed: retryFailedQueueItems,
    clearQueue: clearAllSyncQueue,
    clearHistory: clearCompletedSyncHistory,
    enqueueSingle: enqueueSubmissionSync,
    enqueueBatch: enqueueBatchSubmissionsSync,
  };
}
