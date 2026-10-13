import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
  User,
} from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';

export const SCOPES = [
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/spreadsheets',
];

const DISCOVERED_REKAP_SHEET_STORAGE_KEY = 'anbk_discovered_rekap_sheet_url_v1';
const OAUTH_TOKEN_STORAGE_KEY = 'anbk_google_oauth_token_sheets_v3';
const OAUTH_EXP_STORAGE_KEY = 'anbk_google_oauth_exp_sheets_v3';

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
const auth = getAuth(app);

const provider = new GoogleAuthProvider();
SCOPES.forEach((scope) => provider.addScope(scope));

let isSigningIn = false;
let cachedAccessToken: string | null = null;
let cachedTokenExpiresAt = 0;
let sharedCloudAccessToken: string | null = null;
let sharedTokenExpiresAt = 0;
let isSheetsRestApiDisabled = false;
const invalidatedTokens = new Set<string>();
const verifyingTokens = new Set<string>();

export function invalidateAccessToken(token?: string | null): void {
  if (token && token.trim()) {
    invalidatedTokens.add(token.trim());
  }
  if (!token || token.trim() === cachedAccessToken) {
    cachedAccessToken = null;
    cachedTokenExpiresAt = 0;
  }
  if (!token || token.trim() === sharedCloudAccessToken) {
    sharedCloudAccessToken = null;
    sharedTokenExpiresAt = 0;
  }
  if (typeof window !== 'undefined') {
    try {
      const saved = localStorage.getItem(OAUTH_TOKEN_STORAGE_KEY);
      if (!token || saved === token.trim()) {
        localStorage.removeItem(OAUTH_TOKEN_STORAGE_KEY);
        localStorage.removeItem(OAUTH_EXP_STORAGE_KEY);
      }
    } catch {
      // ignore
    }
  }
}

async function verifyAndActivateStoredToken(
  candidateToken: string,
  fallbackExpiresAt?: number
): Promise<boolean> {
  const clean = (candidateToken || '').trim();
  if (!clean || clean.length <= 10 || invalidatedTokens.has(clean)) {
    return false;
  }
  if (verifyingTokens.has(clean)) {
    return false;
  }
  verifyingTokens.add(clean);
  try {
    const res = await fetch(
      `https://www.googleapis.com/oauth2/v3/tokeninfo?access_token=${encodeURIComponent(clean)}`
    );
    if (!res.ok) {
      invalidateAccessToken(clean);
      return false;
    }
    const info = (await res.json()) as { expires_in?: string | number; scope?: string };
    const expiresInSec = Number(info?.expires_in || 0);
    const scopeStr = String(info?.scope || '');
    if (
      expiresInSec <= 45 ||
      (!scopeStr.includes('spreadsheets') && !scopeStr.includes('gmail'))
    ) {
      invalidateAccessToken(clean);
      return false;
    }
    isSheetsRestApiDisabled = false;
    const expTs = Date.now() + expiresInSec * 1000;
    cachedAccessToken = clean;
    cachedTokenExpiresAt = expTs;
    sharedCloudAccessToken = clean;
    sharedTokenExpiresAt = fallbackExpiresAt && fallbackExpiresAt < expTs ? fallbackExpiresAt : expTs;
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(OAUTH_TOKEN_STORAGE_KEY, clean);
        localStorage.setItem(OAUTH_EXP_STORAGE_KEY, String(expTs));
        window.dispatchEvent(
          new CustomEvent('anbk-sheets-oauth-ready', { detail: { accessToken: clean } })
        );
      } catch {
        // ignore
      }
    }
    broadcastAndPersistOAuthToken(clean, expTs);
    return true;
  } catch {
    return false;
  } finally {
    verifyingTokens.delete(clean);
  }
}

export function broadcastAndPersistOAuthToken(token: string, expTs: number): void {
  if (typeof window === 'undefined') return;
  const clean = (token || '').trim();
  if (clean.length <= 10) return;

  // 1. Kirim ke Server Proxy (/public/cloud-config.json & cachedServerOAuthToken)
  fetch(`/__api/student-dashboard-sync?_t=${Date.now()}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'saveOAuthToken',
      oauthAccessToken: clean,
      oauthExpiresAt: expTs,
    }),
  }).catch(() => {});

  // 2. Tulis langsung ke Cloud Firestore REST API agar semua HP, tablet & komputer siswa dapat mengakses token ini
  try {
    const fsUrl = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(
      firebaseConfig.projectId
    )}/databases/${encodeURIComponent(
      firebaseConfig.firestoreDatabaseId
    )}/documents/cloudTokenSync/globalConfig?key=${encodeURIComponent(
      firebaseConfig.apiKey
    )}&updateMask.fieldPaths=oauthAccessToken&updateMask.fieldPaths=oauthExpiresAt`;
    fetch(fsUrl, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fields: {
          oauthAccessToken: { stringValue: clean },
          oauthExpiresAt: { integerValue: String(expTs) },
        },
      }),
    }).catch(() => {});
  } catch {
    // ignore
  }
}

if (typeof window !== 'undefined') {
  try {
    // Bersihkan cache URL penemuan lama jika menunjuk ke sheet token
    const discUrl = localStorage.getItem(DISCOVERED_REKAP_SHEET_STORAGE_KEY);
    if (discUrl && discUrl.includes('12_e0bkbRkSI_RLJhtv1gyiWFfMPJ-GD_zMkW-YS4xRw')) {
      localStorage.removeItem(DISCOVERED_REKAP_SHEET_STORAGE_KEY);
    }

    const savedTok = localStorage.getItem(OAUTH_TOKEN_STORAGE_KEY);
    const savedExp = Number(localStorage.getItem(OAUTH_EXP_STORAGE_KEY) || 0);
    if (savedTok && savedTok.trim().length > 10 && savedExp > Date.now() + 60000) {
      verifyAndActivateStoredToken(savedTok.trim(), savedExp).catch(() => {});
    } else if (savedTok) {
      localStorage.removeItem(OAUTH_TOKEN_STORAGE_KEY);
      localStorage.removeItem(OAUTH_EXP_STORAGE_KEY);
    }
  } catch {
    // ignore
  }
}

export function saveStoredAccessToken(token: string | null, expiresInSeconds: number = 3300): void {
  const clean = token ? token.trim() : null;
  cachedAccessToken = clean;
  cachedTokenExpiresAt = clean ? Date.now() + expiresInSeconds * 1000 : 0;
  if (clean) {
    isSheetsRestApiDisabled = false;
    sharedCloudAccessToken = clean;
    sharedTokenExpiresAt = cachedTokenExpiresAt;
    invalidatedTokens.delete(clean);
  }
  if (typeof window !== 'undefined') {
    try {
      if (clean) {
        localStorage.setItem(OAUTH_TOKEN_STORAGE_KEY, clean);
        localStorage.setItem(OAUTH_EXP_STORAGE_KEY, String(cachedTokenExpiresAt));
        broadcastAndPersistOAuthToken(clean, cachedTokenExpiresAt);
      } else {
        localStorage.removeItem(OAUTH_TOKEN_STORAGE_KEY);
        localStorage.removeItem(OAUTH_EXP_STORAGE_KEY);
      }
    } catch {
      // ignore
    }
  }
}

export function setSharedCloudAccessToken(token: string | null, expiresAt?: number): void {
  const clean = token ? token.trim() : '';
  if (
    clean &&
    clean.length > 10 &&
    !invalidatedTokens.has(clean) &&
    (!expiresAt || expiresAt > Date.now() + 60000)
  ) {
    if (cachedAccessToken === clean && cachedTokenExpiresAt > Date.now() + 30000) {
      return;
    }
    verifyAndActivateStoredToken(clean, expiresAt).catch(() => {});
  }
}

export const initAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
) => {
  return onAuthStateChanged(auth, async (user: User | null) => {
    const activeTok = getAccessTokenSync();
    if (user) {
      if (activeTok) {
        if (onAuthSuccess) onAuthSuccess(user, activeTok);
      } else if (!isSigningIn) {
        if (onAuthFailure) onAuthFailure();
      }
    } else {
      if (onAuthFailure) onAuthFailure();
    }
  });
};

export function saveManualGoogleAccessToken(token: string, expiresInSeconds: number = 3600): boolean {
  const clean = (token || '').trim();
  if (clean.length < 10) return false;
  saveStoredAccessToken(clean, expiresInSeconds);
  if (typeof window !== 'undefined') {
    try {
      window.dispatchEvent(
        new CustomEvent('anbk-sheets-oauth-ready', {
          detail: { accessToken: clean },
        })
      );
    } catch {
      // ignore
    }
  }
  return true;
}

export async function requestGoogleTokenViaGIS(): Promise<{
  user: User | null;
  accessToken: string;
} | null> {
  if (typeof window === 'undefined') return null;
  const clientId = firebaseConfig.oAuthClientId;
  if (!clientId) return null;

  const w = window as any;

  // Pastikan skrip Google Identity Services (GSI) terpasang jika belum ada
  if (!w.google?.accounts?.oauth2?.initTokenClient) {
    await new Promise<void>((resolve) => {
      const existing = document.getElementById('google-gsi-client-script');
      if (existing) {
        existing.addEventListener('load', () => resolve());
        setTimeout(resolve, 1500);
        return;
      }
      const s = document.createElement('script');
      s.id = 'google-gsi-client-script';
      s.src = 'https://accounts.google.com/gsi/client';
      s.async = true;
      s.defer = true;
      s.onload = () => resolve();
      s.onerror = () => resolve();
      document.head.appendChild(s);
      setTimeout(resolve, 1500);
    });
  }

  if (!w.google?.accounts?.oauth2?.initTokenClient) {
    return null;
  }

  return new Promise((resolve, reject) => {
    try {
      const tokenClient = w.google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: SCOPES.join(' '),
        callback: (resp: any) => {
          if (resp && resp.access_token) {
            const expSec = Number(resp.expires_in) || 3300;
            saveStoredAccessToken(resp.access_token, expSec);
            if (typeof window !== 'undefined') {
              try {
                window.dispatchEvent(
                  new CustomEvent('anbk-sheets-oauth-ready', {
                    detail: { accessToken: resp.access_token },
                  })
                );
              } catch {
                // ignore
              }
            }
            resolve({
              user: auth.currentUser,
              accessToken: resp.access_token,
            });
          } else if (resp?.error) {
            reject(
              new Error(
                resp.error_description || resp.error || 'Otorisasi Google dibatalkan atau ditolak.'
              )
            );
          } else {
            reject(new Error('Token akses tidak diterima dari akun Google.'));
          }
        },
        error_callback: (err: any) => {
          reject(
            new Error(
              err?.message || 'Gagal membuka jendela otorisasi Google Identity Services.'
            )
          );
        },
      });

      tokenClient.requestAccessToken({ prompt: '' });
    } catch (err) {
      reject(err);
    }
  });
}

export const googleSignIn = async (): Promise<{
  user: User | null;
  accessToken: string;
} | null> => {
  if (isSigningIn) {
    // Tunggu jika ada proses login yang sedang berlangsung
    for (let i = 0; i < 20; i++) {
      await new Promise((r) => setTimeout(r, 150));
      const tok = getAccessTokenSync();
      if (tok) {
        return { user: auth.currentUser, accessToken: tok };
      }
      if (!isSigningIn) break;
    }
  }

  try {
    isSigningIn = true;

    // 1. Coba jalur Google Identity Services (GIS tokenClient) terlebih dahulu
    if (typeof window !== 'undefined' && firebaseConfig.oAuthClientId) {
      try {
        const gisResult = await requestGoogleTokenViaGIS();
        if (gisResult?.accessToken) {
          return gisResult;
        }
      } catch (gisErr: any) {
        console.warn('[v0] GIS token client note:', gisErr?.message || gisErr);
        // Jika GIS menolak atau popup ditutup, jangan langsung keluar jika Firebase masih bisa dicoba
      }
    }

    // 2. Jalur Firebase signInWithPopup
    try {
      const result = await signInWithPopup(auth, provider);
      const credential = GoogleAuthProvider.credentialFromResult(result);
      if (!credential?.accessToken) {
        throw new Error('Tidak ada Access Token yang diterima dari akun Google.');
      }

      saveStoredAccessToken(credential.accessToken, 3300);
      if (typeof window !== 'undefined') {
        try {
          window.dispatchEvent(
            new CustomEvent('anbk-sheets-oauth-ready', {
              detail: { accessToken: credential.accessToken },
            })
          );
        } catch {
          // ignore
        }
      }
      return { user: result.user, accessToken: credential.accessToken };
    } catch (firebaseErr: any) {
      const code = String(firebaseErr?.code || '');
      let friendlyMessage = 'Gagal menghubungkan Akun Google.';

      if (code === 'auth/popup-blocked') {
        friendlyMessage =
          'Jendela pop-up Google diblokir oleh browser. Harap klik ikon gembok/pop-up di bilah alamat browser Anda dan pilih "Izinkan Pop-up (Always allow)", lalu klik Hubungkan lagi.';
      } else if (code === 'auth/unauthorized-domain') {
        friendlyMessage =
          'Domain web saat ini belum terdaftar di Firebase Console Authorized Domains. Anda dapat menggunakan opsi "Input Token Manual" di bawah untuk tetap menghubungkan Google Sheets.';
      } else if (code === 'auth/popup-closed-by-user') {
        friendlyMessage = 'Jendela otorisasi Google ditutup sebelum selesai.';
      } else if (code === 'auth/cancelled-popup-request') {
        friendlyMessage = 'Otorisasi login sedang berlangsung di jendela lain.';
      } else if (firebaseErr?.message) {
        friendlyMessage = firebaseErr.message;
      }

      throw new Error(friendlyMessage);
    }
  } finally {
    isSigningIn = false;
  }
};

export const getAccessToken = async (): Promise<string | null> => {
  return getAccessTokenSync();
};

export const getAccessTokenSync = (): string | null => {
  const now = Date.now();
  if (
    cachedAccessToken &&
    !invalidatedTokens.has(cachedAccessToken) &&
    (!cachedTokenExpiresAt || cachedTokenExpiresAt > now + 15000)
  ) {
    return cachedAccessToken;
  }
  if (
    sharedCloudAccessToken &&
    !invalidatedTokens.has(sharedCloudAccessToken) &&
    (!sharedTokenExpiresAt || sharedTokenExpiresAt > now + 15000)
  ) {
    return sharedCloudAccessToken;
  }
  return null;
};

export const getCurrentGoogleUser = (): User | null => {
  return auth.currentUser;
};

export const logoutGoogle = async () => {
  await auth.signOut();
  invalidateAccessToken();
};

export const REKAP_EXACT_HEADERS = [
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

export function getDiscoveredRekapSheetUrl(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const val = localStorage.getItem(DISCOVERED_REKAP_SHEET_STORAGE_KEY) || null;
    if (val && val.includes('12_e0bkbRkSI_RLJhtv1gyiWFfMPJ-GD_zMkW-YS4xRw')) {
      localStorage.removeItem(DISCOVERED_REKAP_SHEET_STORAGE_KEY);
      return null;
    }
    return val;
  } catch {
    return null;
  }
}

export async function findRekapSpreadsheetInDrive(
  explicitToken?: string | null
): Promise<{ spreadsheetId: string; url: string; name: string } | null> {
  const token = explicitToken || getAccessTokenSync();
  if (!token) return null;
  try {
    const q = encodeURIComponent(
      "name contains 'Rekap Hasil Ujian' and mimeType = 'application/vnd.google-apps.spreadsheet' and trashed = false"
    );
    const res = await fetch(
      `https://www.googleapis.com/drive/v3/files?q=${q}&orderBy=modifiedTime desc&pageSize=5&fields=files(id,name,webViewLink)`,
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );
    if (!res.ok) return null;
    const data = (await res.json()) as {
      files?: Array<{ id?: string; name?: string; webViewLink?: string }>;
    };
    const file = (data.files || []).find((f) => f && f.id);
    if (!file || !file.id) return null;
    const url =
      file.webViewLink || `https://docs.google.com/spreadsheets/d/${file.id}/edit?usp=sharing`;
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(DISCOVERED_REKAP_SHEET_STORAGE_KEY, url);
      } catch {
        // ignore
      }
    }
    return {
      spreadsheetId: file.id,
      url,
      name: file.name || 'Rekap Hasil Ujian',
    };
  } catch {
    return null;
  }
}

async function writeRekap10ColsToSingleSpreadsheet(
  spreadsheetId: string,
  rows10Cols: (string | number)[][],
  token: string,
  preferredGid?: number | null
): Promise<boolean> {
  try {
    const metaRes = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=sheets.properties(sheetId,title)`,
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );
    if (!metaRes.ok) {
      if (metaRes.status === 401 || metaRes.status === 403) {
        invalidateAccessToken(token);
      }
      return false;
    }

    const metaData = (await metaRes.json()) as {
      sheets?: Array<{ properties?: { sheetId?: number; title?: string } }>;
    };
    const sheets = metaData.sheets || [];
    const targetSheetsToWrite: Array<{ title: string; sheetId?: number }> = [];

    const effectiveGid =
      typeof preferredGid === 'number' && Number.isFinite(preferredGid)
        ? preferredGid
        : spreadsheetId === '1tHklK_FCTvLOZsHhCP0DecsZUq9wSkV1ffGauYAoOqQ'
        ? 1908701833
        : null;

    if (effectiveGid !== null) {
      const byGid = sheets.find((s) => s.properties?.sheetId === effectiveGid);
      if (byGid?.properties?.title) {
        targetSheetsToWrite.push({
          title: byGid.properties.title,
          sheetId: byGid.properties.sheetId,
        });
      }
    }

    const existingRekap = sheets.find(
      (s) => (s.properties?.title || '').trim().toLowerCase() === 'rekap hasil ujian'
    );
    if (
      existingRekap?.properties?.title &&
      !targetSheetsToWrite.some((t) => t.title === existingRekap.properties?.title)
    ) {
      targetSheetsToWrite.push({
        title: existingRekap.properties.title,
        sheetId: existingRekap.properties.sheetId,
      });
    }

    if (sheets.length > 0) {
      const firstSheet = sheets[0]?.properties;
      const firstTitle = firstSheet?.title || 'Sheet1';
      let isTokenSheet =
        firstTitle.toUpperCase().includes('TOKEN') ||
        spreadsheetId === '12_e0bkbRkSI_RLJhtv1gyiWFfMPJ-GD_zMkW-YS4xRw';

      if (!isTokenSheet) {
        try {
          const a1Res = await fetch(
            `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(
              `'${firstTitle}'!A1:D5`
            )}`,
            { headers: { Authorization: `Bearer ${token}` } }
          );
          if (a1Res.ok) {
            const a1Data = (await a1Res.json()) as { values?: string[][] };
            const flatText = (a1Data.values || [])
              .flat()
              .join(' ')
              .toUpperCase();
            if (flatText.includes('KODE TOKEN') || flatText.includes('TOKEN UJIAN')) {
              isTokenSheet = true;
            }
          }
        } catch {
          // ignore
        }
      }

      if (isTokenSheet && targetSheetsToWrite.length === 0) {
        const addRes = await fetch(
          `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              requests: [
                {
                  addSheet: {
                    properties: {
                      title: 'Rekap Hasil Ujian',
                    },
                  },
                },
              ],
            }),
          }
        );
        if (addRes.ok) {
          const addData = await addRes.json();
          targetSheetsToWrite.push({
            title: 'Rekap Hasil Ujian',
            sheetId: addData?.replies?.[0]?.addSheet?.properties?.sheetId,
          });
        }
      } else if (!isTokenSheet) {
        let finalFirstTitle = firstTitle;
        if (
          targetSheetsToWrite.length === 0 &&
          firstSheet?.sheetId !== undefined &&
          firstTitle !== 'Rekap Hasil Ujian'
        ) {
          try {
            const renameRes = await fetch(
              `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`,
              {
                method: 'POST',
                headers: {
                  Authorization: `Bearer ${token}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  requests: [
                    {
                      updateSheetProperties: {
                        properties: {
                          sheetId: firstSheet.sheetId,
                          title: 'Rekap Hasil Ujian',
                        },
                        fields: 'title',
                      },
                    },
                  ],
                }),
              }
            );
            if (renameRes.ok) {
              finalFirstTitle = 'Rekap Hasil Ujian';
            }
          } catch {
            // ignore
          }
        }
        if (!targetSheetsToWrite.some((t) => t.title === finalFirstTitle)) {
          targetSheetsToWrite.push({
            title: finalFirstTitle,
            sheetId: firstSheet?.sheetId,
          });
        }
      }
    }

    if (targetSheetsToWrite.length === 0) {
      targetSheetsToWrite.push({ title: 'Rekap Hasil Ujian' });
    }

    const dataRowsToWrite: (string | number)[][] = rows10Cols.map((r, rowIdx) => {
      const sliced =
        r.length >= 13 ? r.slice(0, 13) : [`#${rowIdx + 1}`, ...r.slice(0, 12)];
      const fotoColIdx = sliced.length >= 13 ? 12 : 11;
      const namaColIdx = sliced.length >= 13 ? 2 : 1;
      const kelasColIdx = sliced.length >= 13 ? 4 : 3;
      if (typeof sliced[fotoColIdx] === 'string' && sliced[fotoColIdx].startsWith('data:image/')) {
        sliced[fotoColIdx] = `✓ Foto Profil Tersinkron — ${String(
          sliced[namaColIdx] || 'Siswa'
        ).trim()} (${String(sliced[kelasColIdx] || 'VIII-1').trim()})`;
      }
      return sliced;
    });

    let anyWriteOk = false;

    for (const target of targetSheetsToWrite) {
      // 1. Cek apakah baris ke-1 (A1:M1) sudah memiliki judul kolom. Jika sudah ada, JANGAN PERNAH menimpa teks atau mengubah warna kolom pada baris ke-1!
      let hasExistingHeaders = true;
      try {
        const checkHeaderRange = encodeURIComponent(`'${target.title}'!A1:M1`);
        const checkRes = await fetch(
          `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${checkHeaderRange}`,
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );
        if (checkRes.ok) {
          const checkData = (await checkRes.json()) as { values?: string[][] };
          const row1 = checkData?.values?.[0] || [];
          const nonEmptyCount = row1.filter((cell) => String(cell ?? '').trim().length > 0).length;
          hasExistingHeaders = nonEmptyCount > 0;
        }
      } catch {
        hasExistingHeaders = true;
      }

      if (!hasExistingHeaders) {
        const headerRange = encodeURIComponent(`'${target.title}'!A1:M1`);
        await fetch(
          `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${headerRange}?valueInputOption=USER_ENTERED`,
          {
            method: 'PUT',
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              values: [[...REKAP_EXACT_HEADERS]],
            }),
          }
        ).catch(() => {});
      }

      // 2. Hanya bersihkan baris isi data mulai dari baris ke-2 ke bawah (A2:Z) agar judul nama 13 kolom & warnanya pada baris ke-1 TIDAK PERNAH terhapus atau berubah!
      const clearRange = encodeURIComponent(`'${target.title}'!A2:Z`);
      const clearRes = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${clearRange}:clear`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({}),
        }
      );

      // 3. Tulis baris data siswa mulai dari A2 (JANGAN menulis ke A1 agar judul nama & warna 13 kolom di baris 1 tetap utuh)
      if (dataRowsToWrite.length > 0) {
        const writeRange = encodeURIComponent(`'${target.title}'!A2`);
        const writeRes = await fetch(
          `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${writeRange}?valueInputOption=USER_ENTERED`,
          {
            method: 'PUT',
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              values: dataRowsToWrite,
            }),
          }
        );

        if (writeRes.ok) {
          anyWriteOk = true;
        }
      } else if (clearRes.ok) {
        anyWriteOk = true;
      }
    }

    if (anyWriteOk && typeof window !== 'undefined') {
      try {
        window.dispatchEvent(
          new CustomEvent('anbk-sheets-sync-success', {
            detail: { spreadsheetId, rowsCount: rows10Cols.length, timestamp: Date.now() },
          })
        );
      } catch {
        // ignore
      }
    }

    return anyWriteOk;
  } catch {
    return false;
  }
}

export async function ensureSpreadsheetOAuthToken(forceInteractive: boolean = false): Promise<string | null> {
  let tok = getAccessTokenSync();
  if (tok) return tok;

  if (typeof window !== 'undefined') {
    try {
      const saved = localStorage.getItem(OAUTH_TOKEN_STORAGE_KEY);
      const savedExp = Number(localStorage.getItem(OAUTH_EXP_STORAGE_KEY) || 0);
      if (saved && saved.length > 10 && savedExp > Date.now() + 15000) {
        const ok = await verifyAndActivateStoredToken(saved, savedExp);
        if (ok) return saved;
      }
    } catch {
      // ignore
    }
  }

  try {
    const fsUrl = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(
      firebaseConfig.projectId
    )}/databases/${encodeURIComponent(
      firebaseConfig.firestoreDatabaseId
    )}/documents/cloudTokenSync/globalConfig?key=${encodeURIComponent(
      firebaseConfig.apiKey
    )}`;
    const fsRes = await fetch(fsUrl);
    if (fsRes.ok) {
      const fsDoc = (await fsRes.json()) as {
        fields?: {
          oauthAccessToken?: { stringValue?: string };
          oauthExpiresAt?: { integerValue?: string | number };
        };
      };
      const tokVal = fsDoc?.fields?.oauthAccessToken?.stringValue;
      const expVal = Number(fsDoc?.fields?.oauthExpiresAt?.integerValue || 0);
      if (tokVal && tokVal.length > 10 && expVal > Date.now() + 15000) {
        const ok = await verifyAndActivateStoredToken(tokVal, expVal);
        if (ok) return tokVal;
      }
    }
  } catch {
    // ignore
  }

  if (forceInteractive && typeof window !== 'undefined') {
    try {
      const authRes = await googleSignIn();
      if (authRes?.accessToken) {
        return authRes.accessToken;
      }
    } catch {
      // ignore
    }
  }

  return null;
}

export async function clearGoogleSheetRekapImmediatelyViaRestApi(
  spreadsheetId: string,
  explicitToken?: string | null,
  preferredGid?: number | null
): Promise<boolean> {
  let token = explicitToken || getAccessTokenSync();
  if (!token) {
    token = await ensureSpreadsheetOAuthToken(false);
  }
  if (!token || !spreadsheetId) return false;

  const cleanId = spreadsheetId.trim();
  const headerValues = [[...REKAP_EXACT_HEADERS]];

  // 1. Bersihkan HANYA baris isi data (baris ke-2 ke bawah: A2:Z) dan pertahankan 13 judul kolom beserta warnanya pada baris ke-1 (A1:M1) tetap utuh!
  try {
    const metaRes = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${cleanId}?fields=sheets.properties(sheetId,title)`,
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );

    const targetSheets: Array<{ title: string; sheetId?: number }> = [];
    const seenTitles = new Set<string>();
    const addTargetSheet = (title: string, sheetId?: number) => {
      const cleanTitle = title.trim();
      if (!cleanTitle || seenTitles.has(cleanTitle)) return;
      seenTitles.add(cleanTitle);
      targetSheets.push({ title: cleanTitle, sheetId });
    };

    if (metaRes.ok) {
      const metaData = (await metaRes.json()) as {
        sheets?: Array<{ properties?: { sheetId?: number; title?: string } }>;
      };
      const sheets = metaData.sheets || [];
      const effectiveGid =
        typeof preferredGid === 'number' && Number.isFinite(preferredGid)
          ? preferredGid
          : cleanId === '1tHklK_FCTvLOZsHhCP0DecsZUq9wSkV1ffGauYAoOqQ'
          ? 1908701833
          : null;

      sheets.forEach((s) => {
        const title = s.properties?.title || '';
        const sId = s.properties?.sheetId;
        if (!title) return;
        const upper = title.toUpperCase();
        if (upper.includes('TOKEN') || upper.includes('SOAL')) return;
        const isTarget =
          (effectiveGid !== null && sId === effectiveGid) ||
          upper.includes('REKAP') ||
          sheets.length === 1;
        if (isTarget) {
          addTargetSheet(title, sId);
        }
      });
    } else if (metaRes.status === 401 || metaRes.status === 403) {
      invalidateAccessToken(token);
      return false;
    }

    if (targetSheets.length === 0) {
      addTargetSheet('Rekap Hasil Ujian');
      addTargetSheet('Sheet1');
    }

    const results = await Promise.all(
      targetSheets.map(async ({ title }) => {
        try {
          // PENTING: Hanya bersihkan A2:Z (baris ke-2 ke bawah), JANGAN PERNAH menghapus atau mengubah warna baris 1 (A1:M1)!
          const clearRange = encodeURIComponent(`'${title}'!A2:Z`);
          const cRes = await fetch(
            `https://sheets.googleapis.com/v4/spreadsheets/${cleanId}/values/${clearRange}:clear`,
            {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({}),
            }
          );

          await fetch(
            `https://sheets.googleapis.com/v4/spreadsheets/${cleanId}/values:batchClear`,
            {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                ranges: [`'${title}'!A2:Z5000`, `${title}!A2:Z5000`],
              }),
            }
          ).catch(() => {});

          // Cek apakah baris ke-1 (A1:M1) kosong; jika sudah ada judul nama 13 kolom, JANGAN disentuh sama sekali agar judul & warnanya tetap utuh!
          let hasExistingHeaders = true;
          try {
            const checkHeaderRange = encodeURIComponent(`'${title}'!A1:M1`);
            const checkRes = await fetch(
              `https://sheets.googleapis.com/v4/spreadsheets/${cleanId}/values/${checkHeaderRange}`,
              {
                headers: { Authorization: `Bearer ${token}` },
              }
            );
            if (checkRes.ok) {
              const checkData = (await checkRes.json()) as { values?: string[][] };
              const row1 = checkData?.values?.[0] || [];
              const nonEmptyCount = row1.filter((cell) => String(cell ?? '').trim().length > 0).length;
              hasExistingHeaders = nonEmptyCount > 0;
            }
          } catch {
            hasExistingHeaders = true;
          }

          if (!hasExistingHeaders) {
            const writeRange = encodeURIComponent(`'${title}'!A1:M1`);
            await fetch(
              `https://sheets.googleapis.com/v4/spreadsheets/${cleanId}/values/${writeRange}?valueInputOption=USER_ENTERED`,
              {
                method: 'PUT',
                headers: {
                  Authorization: `Bearer ${token}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({ values: headerValues }),
              }
            ).catch(() => {});
          }

          return cRes.ok;
        } catch {
          return false;
        }
      })
    );

    const anyOk = results.some(Boolean);
    if (anyOk && typeof window !== 'undefined') {
      try {
        window.dispatchEvent(
          new CustomEvent('anbk-sheets-sync-success', {
            detail: { spreadsheetId: cleanId, rowsCount: 0, timestamp: Date.now() },
          })
        );
      } catch {
        // ignore
      }
    }
    return anyOk;
  } catch {
    return false;
  }
}

export async function syncAllSubmissionsToGoogleSheetViaRestApi(
  spreadsheetId: string,
  rows10Cols: (string | number)[][],
  explicitToken?: string | null,
  preferredGid?: number | null
): Promise<boolean> {
  const token = explicitToken || getAccessTokenSync();
  if (!token) return false;

  const targetIds = new Set<string>();
  if (spreadsheetId && spreadsheetId.trim()) {
    targetIds.add(spreadsheetId.trim());
  } else {
    const discovered = await findRekapSpreadsheetInDrive(token).catch(() => null);
    if (discovered?.spreadsheetId) {
      targetIds.add(discovered.spreadsheetId);
    }
  }

  if (targetIds.size === 0) return false;

  let anyOk = false;
  for (const id of targetIds) {
    if (rows10Cols.length === 0) {
      const cleared = await clearGoogleSheetRekapImmediatelyViaRestApi(id, token, preferredGid);
      if (cleared) {
        anyOk = true;
        continue;
      }
    }
    const ok = await writeRekap10ColsToSingleSpreadsheet(id, rows10Cols, token, preferredGid);
    if (ok) anyOk = true;
  }
  return anyOk;
}

function extractValidTokenFromMatrix(values: string[][]): string | null {
  if (!Array.isArray(values) || values.length === 0) return null;
  const rows = values.map((row) =>
    (Array.isArray(row) ? row : []).map((c) => String(c ?? '').trim())
  );

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
      }
    }
  }

  const firstRowJoined = (rows[0] || []).join(' ').toUpperCase();
  if (
    firstRowJoined.includes('TIMESTAMP') ||
    firstRowJoined.includes('NAMA SISWA') ||
    firstRowJoined.includes('NILAI AKHIR') ||
    firstRowJoined.includes('SKOR BENAR')
  ) {
    return null;
  }

  for (let r = Math.min(rows.length - 1, 10); r >= 0; r--) {
    for (let c = 0; c < Math.min(rows[r].length, 6); c++) {
      const upper = rows[r][c].trim().toUpperCase();
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

  return null;
}

export async function readTokenFromGoogleSheetViaRestApi(
  spreadsheetId: string,
  explicitToken?: string | null
): Promise<string | null> {
  if (isSheetsRestApiDisabled) return null;
  const token = explicitToken || getAccessTokenSync();
  if (!token || !spreadsheetId) return null;

  try {
    const metaRes = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=sheets.properties(sheetId,title)`,
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );
    if (!metaRes.ok) {
      if (metaRes.status === 403) {
        isSheetsRestApiDisabled = true;
      } else if (metaRes.status === 401 && token === cachedAccessToken) {
        saveStoredAccessToken(null);
      }
      return null;
    }

    const metaData = (await metaRes.json()) as {
      sheets?: Array<{ properties?: { sheetId?: number; title?: string } }>;
    };
    const sheets = metaData.sheets || [];
    const candidateTitles: string[] = [];

    for (const s of sheets) {
      const title = s.properties?.title;
      if (title && title.toUpperCase().includes('TOKEN')) {
        candidateTitles.push(title);
      }
    }
    for (const s of sheets) {
      const title = s.properties?.title;
      if (
        title &&
        !candidateTitles.includes(title) &&
        !title.toUpperCase().includes('REKAP')
      ) {
        candidateTitles.push(title);
      }
    }
    if (candidateTitles.length === 0 && sheets[0]?.properties?.title) {
      candidateTitles.push(sheets[0].properties.title);
    }

    for (const title of candidateTitles) {
      const range = encodeURIComponent(`'${title}'!A1:D12`);
      const valRes = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      if (valRes.ok) {
        const valData = (await valRes.json()) as { values?: string[][] };
        const extracted = extractValidTokenFromMatrix(valData.values || []);
        if (extracted) return extracted;
      }
    }
  } catch {
    // ignore
  }
  return null;
}

export async function writeTokenToGoogleSheetViaRestApi(
  spreadsheetId: string,
  newToken: string,
  explicitToken?: string | null
): Promise<boolean> {
  const token = explicitToken || getAccessTokenSync();
  const cleanTok = (newToken || '')
    .replace(/[^A-Za-z0-9]/g, '')
    .toUpperCase()
    .slice(0, 6);
  if (!token || !spreadsheetId || cleanTok.length < 3) return false;

  try {
    const metaRes = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=sheets.properties(sheetId,title)`,
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );
    if (!metaRes.ok) {
      if (metaRes.status === 401 && token === cachedAccessToken) {
        saveStoredAccessToken(null);
      }
      return false;
    }

    const metaData = (await metaRes.json()) as {
      sheets?: Array<{ properties?: { sheetId?: number; title?: string } }>;
    };
    const sheets = metaData.sheets || [];
    let tokenSheetTitle =
      sheets.find((s) => (s.properties?.title || '').trim().toUpperCase() === 'KODE TOKEN UJIAN')
        ?.properties?.title ||
      sheets.find((s) => (s.properties?.title || '').toUpperCase().includes('TOKEN'))
        ?.properties?.title ||
      '';

    if (!tokenSheetTitle) {
      const addRes = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            requests: [
              {
                addSheet: {
                  properties: {
                    title: 'KODE TOKEN UJIAN',
                  },
                },
              },
            ],
          }),
        }
      );
      if (addRes.ok) {
        tokenSheetTitle = 'KODE TOKEN UJIAN';
      } else if (
        sheets[0]?.properties?.title &&
        !sheets[0].properties.title.toUpperCase().includes('REKAP')
      ) {
        tokenSheetTitle = sheets[0].properties.title;
      }
    }

    if (!tokenSheetTitle) return false;

    const nowTs = new Date().toLocaleString('id-ID');
    const valuesToWrite = [
      ['KODE TOKEN UJIAN', 'WAKTU DIPERBARUI', 'GURU MAPEL'],
      [cleanTok, nowTs, 'EKSA YUDIKA SIRAIT S.T'],
    ];

    const writeRange = encodeURIComponent(`'${tokenSheetTitle}'!A1:C2`);
    const writeRes = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${writeRange}?valueInputOption=RAW`,
      {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          values: valuesToWrite,
        }),
      }
    );

    const firstTitle = sheets[0]?.properties?.title;
    if (
      firstTitle &&
      firstTitle !== tokenSheetTitle &&
      !firstTitle.toUpperCase().includes('REKAP') &&
      !firstTitle.toUpperCase().includes('SOAL')
    ) {
      try {
        const firstCheck = await fetch(
          `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(
            `'${firstTitle}'!A1:D3`
          )}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (firstCheck.ok) {
          const checkData = (await firstCheck.json()) as { values?: string[][] };
          const flat = (checkData.values || []).flat().join(' ').toUpperCase();
          if (!flat.includes('TIMESTAMP') && !flat.includes('NAMA SISWA')) {
            await fetch(
              `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(
                `'${firstTitle}'!A1:C2`
              )}?valueInputOption=RAW`,
              {
                method: 'PUT',
                headers: {
                  Authorization: `Bearer ${token}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({ values: valuesToWrite }),
              }
            );
          }
        }
      } catch {
        // ignore
      }
    }

    return writeRes.ok;
  } catch {
    return false;
  }
}

function encodeUtf8Base64(str: string): string {
  const bytes = new TextEncoder().encode(str);
  const chunkSize = 0x8000;
  const chunks: string[] = [];
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const sub = bytes.subarray(i, i + chunkSize);
    chunks.push(String.fromCharCode.apply(null, Array.from(sub)));
  }
  return btoa(chunks.join(''));
}

function toBase64Url(base64Str: string): string {
  return base64Str.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function wrapBase64Lines(b64: string, lineLength: number = 76): string {
  const clean = b64.replace(/[\r\n\s]+/g, '');
  const lines: string[] = [];
  for (let i = 0; i < clean.length; i += lineLength) {
    lines.push(clean.slice(i, i + lineLength));
  }
  return lines.join('\r\n');
}

export interface GmailSendAttachmentsPayload {
  to: string;
  subject: string;
  textBody: string;
  htmlBody: string;
  jpgFilename?: string;
  jpgBase64?: string;
  pdfFilename?: string;
  pdfBase64?: string;
}

/**
 * Mengirim email beserta lampiran file Gambar (.JPG) dan Dokumen (.PDF)
 * secara langsung menggunakan Gmail REST API (users/me/messages/send).
 */
export async function sendEmailWithJpgAndPdfViaGmailApi(
  accessToken: string,
  payload: GmailSendAttachmentsPayload
): Promise<{ id: string; threadId: string }> {
  const mixedBoundary = `anbk_mixed_boundary_${Date.now()}`;
  const altBoundary = `anbk_alt_boundary_${Date.now()}`;

  const encodedSubject = `=?UTF-8?B?${encodeUtf8Base64(payload.subject)}?=`;

  const mimeParts: string[] = [
    `To: ${payload.to}`,
    `Subject: ${encodedSubject}`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/mixed; boundary="${mixedBoundary}"`,
    '',
    `--${mixedBoundary}`,
    `Content-Type: multipart/alternative; boundary="${altBoundary}"`,
    '',
    `--${altBoundary}`,
    'Content-Type: text/plain; charset="UTF-8"',
    'Content-Transfer-Encoding: base64',
    '',
    wrapBase64Lines(encodeUtf8Base64(payload.textBody)),
    '',
    `--${altBoundary}`,
    'Content-Type: text/html; charset="UTF-8"',
    'Content-Transfer-Encoding: base64',
    '',
    wrapBase64Lines(encodeUtf8Base64(payload.htmlBody)),
    '',
    `--${altBoundary}--`,
  ];

  if (payload.jpgBase64 && payload.jpgFilename) {
    mimeParts.push(
      '',
      `--${mixedBoundary}`,
      `Content-Type: image/jpeg; name="${payload.jpgFilename}"`,
      'Content-Transfer-Encoding: base64',
      'Content-ID: <hasil_ujian_jpg>',
      `Content-Disposition: attachment; filename="${payload.jpgFilename}"`,
      '',
      wrapBase64Lines(payload.jpgBase64)
    );
  }

  if (payload.pdfBase64 && payload.pdfFilename) {
    mimeParts.push(
      '',
      `--${mixedBoundary}`,
      `Content-Type: application/pdf; name="${payload.pdfFilename}"`,
      'Content-Transfer-Encoding: base64',
      `Content-Disposition: attachment; filename="${payload.pdfFilename}"`,
      '',
      wrapBase64Lines(payload.pdfBase64)
    );
  }

  mimeParts.push('', `--${mixedBoundary}--`, '');

  const rawMimeString = mimeParts.join('\r\n');
  const rawBase64Url = toBase64Url(encodeUtf8Base64(rawMimeString));

  const response = await fetch(
    'https://gmail.googleapis.com/gmail/v1/users/me/messages/send',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        raw: rawBase64Url,
      }),
    }
  );

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      invalidateAccessToken(accessToken);
    }
    const errText = await response.text();
    throw new Error(`Gmail API Error (${response.status}): ${errText}`);
  }

  return response.json();
}
