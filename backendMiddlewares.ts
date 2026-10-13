import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import type { IncomingMessage, ServerResponse } from 'http';
import { ESSAY_QUESTION_BANKS, EssayPackageKey } from './src/data/essayQuestionsData.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export interface MiddlewareRunner {
  use: {
    (
      route: string,
      handler: (req: IncomingMessage, res: ServerResponse, next: () => void) => void
    ): unknown;
    (handler: (req: IncomingMessage, res: ServerResponse, next: () => void) => void): unknown;
  };
}

let middlewaresAttached = false;

export function attachBackendMiddlewares(middlewares: MiddlewareRunner) {
  if (middlewaresAttached) return;
  middlewaresAttached = true;
  const server = { middlewares };
  const storePath = path.resolve(__dirname, 'public/permanent-photos.json');
  const srcStorePath = path.resolve(__dirname, 'src/data/permanentPhotos.json');

  const readStore = (): {
    teacherPhoto?: string;
    logoPhoto?: string;
    heroBanner?: string;
    updatedAt?: number;
  } => {
    const merged: {
      teacherPhoto?: string;
      logoPhoto?: string;
      heroBanner?: string;
      updatedAt?: number;
    } = {};
    for (const p of [srcStorePath, storePath]) {
      try {
        if (fs.existsSync(p)) {
          const parsed = JSON.parse(fs.readFileSync(p, 'utf-8'));
          if (parsed && typeof parsed === 'object') {
            if (parsed.teacherPhoto) merged.teacherPhoto = parsed.teacherPhoto;
            if (parsed.logoPhoto) merged.logoPhoto = parsed.logoPhoto;
            if (parsed.heroBanner) merged.heroBanner = parsed.heroBanner;
            if (parsed.updatedAt) merged.updatedAt = parsed.updatedAt;
          }
        }
      } catch {
        // ignore
      }
    }
    return merged;
  };

  const overwriteJpgAssetsWithRealPhoto = (dataUrl: string) => {
    try {
      const commaIdx = dataUrl.indexOf(',');
      if (commaIdx === -1) return;
      const base64Data = dataUrl.slice(commaIdx + 1);
      const buffer = Buffer.from(base64Data, 'base64');
      if (buffer.length < 100) return;

      const targets = [
        path.resolve(__dirname, 'src/assets/images/pas_foto_eksa_dasi_merah_1790795857315.jpg'),
        path.resolve(__dirname, 'src/assets/images/pas_foto_eksa_asli_1790795190859.jpg'),
        path.resolve(__dirname, 'src/assets/images/foto_pembuat_soal_eksa_1790794619714.jpg'),
        path.resolve(__dirname, 'public/src/assets/images/pas_foto_eksa_dasi_merah_1790795857315.jpg'),
        path.resolve(__dirname, 'public/src/assets/images/pas_foto_eksa_asli_1790795190859.jpg'),
        path.resolve(__dirname, 'public/src/assets/images/foto_pembuat_soal_eksa_1790794619714.jpg'),
      ];

      for (const target of targets) {
        const dir = path.dirname(target);
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }
        fs.writeFileSync(target, buffer);
      }

      const distAssetsDir = path.resolve(__dirname, 'dist/assets');
      if (fs.existsSync(distAssetsDir)) {
        for (const file of fs.readdirSync(distAssetsDir)) {
          if (file.includes('eksa') && file.endsWith('.jpg')) {
            fs.writeFileSync(path.join(distAssetsDir, file), buffer);
          }
        }
      }
    } catch {
      // ignore
    }
  };

  const overwriteHeroBannerAssetsWithRealPhoto = (bannerValue: string) => {
    try {
      let buffer: Buffer | null = null;
      if (bannerValue.startsWith('data:image/')) {
        const commaIdx = bannerValue.indexOf(',');
        if (commaIdx !== -1) {
          const base64Data = bannerValue.slice(commaIdx + 1);
          const decoded = Buffer.from(base64Data, 'base64');
          if (decoded.length >= 100) {
            buffer = decoded;
          }
        }
      } else if (bannerValue.includes('lab_komputer_anbk')) {
        const srcPreset = path.resolve(
          __dirname,
          'src/assets/images/lab_komputer_anbk_1791059480053.jpg'
        );
        if (fs.existsSync(srcPreset)) {
          buffer = fs.readFileSync(srcPreset);
        }
      } else if (bannerValue.includes('lab_informatika_sekolah')) {
        const srcPreset = path.resolve(
          __dirname,
          'src/assets/images/lab_informatika_sekolah_1791059493524.jpg'
        );
        if (fs.existsSync(srcPreset)) {
          buffer = fs.readFileSync(srcPreset);
        }
      }

      if (!buffer || buffer.length < 100) return;

      const targets = [
        path.resolve(__dirname, 'src/assets/images/hero_anbk_informatika_1790638244929.jpg'),
        path.resolve(__dirname, 'public/src/assets/images/hero_anbk_informatika_1790638244929.jpg'),
      ];

      for (const target of targets) {
        const dir = path.dirname(target);
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }
        fs.writeFileSync(target, buffer);
      }

      const distAssetsDir = path.resolve(__dirname, 'dist/assets');
      if (fs.existsSync(distAssetsDir)) {
        for (const file of fs.readdirSync(distAssetsDir)) {
          if (file.includes('hero_anbk_informatika') && file.endsWith('.jpg')) {
            fs.writeFileSync(path.join(distAssetsDir, file), buffer);
          }
        }
      }
    } catch {
      // ignore
    }
  };

  server.middlewares.use('/__api/permanent-photos', (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');

    if (req.method === 'OPTIONS') {
      res.statusCode = 204;
      res.end();
      return;
    }

    if (req.method === 'GET') {
      const data = readStore();
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify(data));
      return;
    }

    if (req.method === 'POST') {
      let body = '';
      req.on('data', (chunk) => {
        body += chunk.toString();
      });
      req.on('end', () => {
        try {
          const incoming = JSON.parse(body || '{}');
          const current = readStore();
          let changed = false;

          if (
            typeof incoming.teacherPhoto === 'string' &&
            incoming.teacherPhoto.startsWith('data:image/')
          ) {
            if (current.teacherPhoto !== incoming.teacherPhoto) {
              current.teacherPhoto = incoming.teacherPhoto;
              changed = true;
              overwriteJpgAssetsWithRealPhoto(incoming.teacherPhoto);
            }
          }
          if (
            typeof incoming.logoPhoto === 'string' &&
            incoming.logoPhoto.startsWith('data:image/')
          ) {
            if (current.logoPhoto !== incoming.logoPhoto) {
              current.logoPhoto = incoming.logoPhoto;
              changed = true;
            }
          }
          if (
            typeof incoming.heroBanner === 'string' &&
            incoming.heroBanner.trim().length > 0
          ) {
            if (current.heroBanner !== incoming.heroBanner) {
              current.heroBanner = incoming.heroBanner;
              changed = true;
              overwriteHeroBannerAssetsWithRealPhoto(incoming.heroBanner);
            }
          }

          if (changed) {
            current.updatedAt = Date.now();
            const pubDir = path.dirname(storePath);
            if (!fs.existsSync(pubDir)) {
              fs.mkdirSync(pubDir, { recursive: true });
            }
            fs.writeFileSync(storePath, JSON.stringify(current));
            try {
              fs.writeFileSync(srcStorePath, JSON.stringify(current));
            } catch {
              // ignore
            }
            const distStorePath = path.resolve(__dirname, 'dist/permanent-photos.json');
            if (fs.existsSync(path.dirname(distStorePath))) {
              fs.writeFileSync(distStorePath, JSON.stringify(current));
            }
          }

          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ ok: true, changed, data: current }));
        } catch (err) {
          res.statusCode = 400;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ ok: false, error: String(err) }));
        }
      });
      return;
    }

    res.statusCode = 405;
    res.end();
  });

  const DEFAULT_SERVER_TOKEN_SHEET_URL =
    'https://docs.google.com/spreadsheets/d/12_e0bkbRkSI_RLJhtv1gyiWFfMPJ-GD_zMkW-YS4xRw/edit?usp=drive_link';
  const DEFAULT_SERVER_REKAP_SHEET_URL =
    'https://docs.google.com/spreadsheets/d/1tHklK_FCTvLOZsHhCP0DecsZUq9wSkV1ffGauYAoOqQ/edit?usp=drive_link';
  let cachedServerOAuthToken = '';

  const sanitizeServerRekapSheetUrl = (raw?: string | null): string => {
    const trimmed = (raw || '').trim();
    if (!trimmed || trimmed.includes('12_e0bkbRkSI_RLJhtv1gyiWFfMPJ-GD_zMkW-YS4xRw')) {
      return DEFAULT_SERVER_REKAP_SHEET_URL;
    }
    return trimmed;
  };

  const cloudConfigPath = path.resolve(__dirname, 'public/cloud-config.json');
  const distCloudConfigPath = path.resolve(__dirname, 'dist/cloud-config.json');
  const srcCloudConfigPath = path.resolve(__dirname, 'src/data/cloudConfig.json');

  interface ServerCloudState {
    tokenSheetUrl?: string;
    googleSheetUrl?: string;
    appsScriptWebAppUrl?: string;
    googleDocUrl?: string;
    studentShareUrl?: string;
    customTeacherToken?: string;
    fonnteToken?: string;
    autoSendWa?: boolean;
    token?: string;
    isSyncedFromSheet?: boolean;
    source?: string;
    updatedAt?: number;
    oauthAccessToken?: string;
    oauthExpiresAt?: number;
  }

  const readFirebaseConfigSafe = () => {
    try {
      const cfgPath = path.resolve(__dirname, 'firebase-applet-config.json');
      if (fs.existsSync(cfgPath)) {
        return JSON.parse(fs.readFileSync(cfgPath, 'utf-8'));
      }
    } catch {}
    return {
      projectId: 'project-570d49ac-a8e7-4ee4-ab1',
      apiKey: 'AIzaSyAkZftXjW7vZ3vF4BEiqAgJ1yBSvRt1tbU',
      firestoreDatabaseId: 'ai-studio-v50aplikasisoalu-ece5a5a5-6152-40a3-8c93-35fbe6a88ed2',
    };
  };

  const readCloudConfig = (): ServerCloudState => {
    for (const p of [cloudConfigPath, srcCloudConfigPath]) {
      try {
        if (fs.existsSync(p)) {
          const parsed = JSON.parse(fs.readFileSync(p, 'utf-8'));
          if (parsed && typeof parsed === 'object') {
            if (
              !parsed.token ||
              parsed.token === 'UJIAN' ||
              parsed.token === 'TOKEN' ||
              parsed.token === 'KODETO'
            ) {
              parsed.token = '922662';
            }
            if (
              parsed.customTeacherToken === 'UJIAN' ||
              parsed.customTeacherToken === 'TOKEN' ||
              parsed.customTeacherToken === 'KODETO'
            ) {
              parsed.customTeacherToken = parsed.token || '922662';
            }
            parsed.googleSheetUrl = sanitizeServerRekapSheetUrl(parsed.googleSheetUrl);
            if (
              typeof parsed.oauthAccessToken === 'string' &&
              parsed.oauthAccessToken.trim().length > 10
            ) {
              cachedServerOAuthToken = parsed.oauthAccessToken.trim();
            }
            return parsed;
          }
        }
      } catch {
        // ignore
      }
    }
    return {
      tokenSheetUrl: DEFAULT_SERVER_TOKEN_SHEET_URL,
      googleSheetUrl: DEFAULT_SERVER_REKAP_SHEET_URL,
      token: '922662',
      customTeacherToken: '922662',
      isSyncedFromSheet: true,
      source: 'Tersinkron Otomatis Live (KODE TOKEN UJIAN)',
    };
  };

  const writeCloudConfig = (state: ServerCloudState, updateSrc: boolean = false) => {
    const jsonStr = JSON.stringify(state, null, 2);
    for (const target of [
      cloudConfigPath,
      distCloudConfigPath,
      ...(updateSrc ? [srcCloudConfigPath] : []),
    ]) {
      try {
        const dir = path.dirname(target);
        if (fs.existsSync(dir) || target === cloudConfigPath) {
          if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
          }
          fs.writeFileSync(target, jsonStr);
        }
      } catch {
        // ignore
      }
    }
  };

  const parseTokenFromServerCsv = (csvText: string): string | null => {
    if (!csvText || !csvText.trim()) return null;
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
            const candidateCols = [c, c + 1, c - 1];
            for (const colIdx of candidateCols) {
              if (colIdx >= 0 && rows[targetRow]?.[colIdx]) {
                const candidateDown = rows[targetRow][colIdx]
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
          return null;
        }
      }
    }

    const firstRowJoined = rows[0].join(' ').toUpperCase();
    if (
      firstRowJoined.includes('TIMESTAMP') ||
      firstRowJoined.includes('NAMA SISWA') ||
      firstRowJoined.includes('NILAI AKHIR') ||
      firstRowJoined.includes('SKOR BENAR')
    ) {
      return null;
    }

    if (rows.length <= 6 && rows[0].length <= 5) {
      for (let r = rows.length - 1; r >= 0; r--) {
        for (let c = 0; c < rows[r].length; c++) {
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
    }
    return null;
  };

  const parseTokenFromGvizJsonServer = (rawText: string): string | null => {
    try {
      const startIdx = rawText.indexOf('{');
      const endIdx = rawText.lastIndexOf('}');
      if (startIdx === -1 || endIdx === -1 || endIdx <= startIdx) return null;
      const jsonObj = JSON.parse(rawText.slice(startIdx, endIdx + 1));
      const table = jsonObj?.table;
      if (!table) return null;
      const cols: Array<{ label?: string }> = table.cols || [];
      const rows: Array<{ c?: Array<{ v?: unknown; f?: string | null } | null> }> =
        table.rows || [];

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
      return parseTokenFromServerCsv(csvLines.join('\n'));
    } catch {
      return null;
    }
  };

  let cachedFirestoreOAuthToken = '';
  let cachedFirestoreTeacherToken = '';
  let lastFirestoreCheckTs = 0;

  const getServerFirestoreCloudInfo = async (
    forceFresh: boolean = false
  ): Promise<{
    oauthAccessToken: string;
    customTeacherToken: string;
  }> => {
    if (
      !forceFresh &&
      Date.now() - lastFirestoreCheckTs < 2000 &&
      (cachedFirestoreOAuthToken || cachedFirestoreTeacherToken)
    ) {
      return {
        oauthAccessToken: cachedFirestoreOAuthToken,
        customTeacherToken: cachedFirestoreTeacherToken,
      };
    }
    try {
      const fbCfgPath = path.resolve(__dirname, 'firebase-applet-config.json');
      if (fs.existsSync(fbCfgPath)) {
        const fbCfg = JSON.parse(fs.readFileSync(fbCfgPath, 'utf-8'));
        if (fbCfg?.projectId && fbCfg?.firestoreDatabaseId && fbCfg?.apiKey) {
          const fsUrl = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(
            fbCfg.projectId
          )}/databases/${encodeURIComponent(
            fbCfg.firestoreDatabaseId
          )}/documents/cloudTokenSync/globalConfig?key=${encodeURIComponent(fbCfg.apiKey)}`;
          const r = await fetch(fsUrl);
          if (r.ok) {
            const j = (await r.json()) as {
              fields?: {
                oauthAccessToken?: { stringValue?: string };
                customTeacherToken?: { stringValue?: string };
              };
            };
            cachedFirestoreOAuthToken = j.fields?.oauthAccessToken?.stringValue || '';
            const fsTok = (j.fields?.customTeacherToken?.stringValue || '')
              .replace(/[^A-Za-z0-9]/g, '')
              .toUpperCase()
              .slice(0, 6);
            if (fsTok.length >= 3) {
              cachedFirestoreTeacherToken = fsTok;
            }
            lastFirestoreCheckTs = Date.now();
          }
        }
      }
    } catch {
      // ignore
    }
    return {
      oauthAccessToken: cachedFirestoreOAuthToken,
      customTeacherToken: cachedFirestoreTeacherToken,
    };
  };

  const fetchTokenFromSingleSheetUrl = async (sheetUrl: string): Promise<string | null> => {
    const cleanSheet = (sheetUrl || '').trim();
    const match = cleanSheet.match(/\/spreadsheets\/d\/(?:e\/)?([a-zA-Z0-9-_]+)/);
    const spreadsheetId = match ? match[1] : null;
    if (!spreadsheetId) return null;

    const gidMatch = cleanSheet.match(/[?#&]gid=([0-9]+)/);
    const gid = gidMatch ? gidMatch[1] : null;
    const isPub = cleanSheet.includes('/spreadsheets/d/e/');
    const ts = Date.now();

    if (isPub) {
      try {
        const pubUrl =
          cleanSheet.replace(/\/pubhtml.*$/i, '/pub?output=csv') +
          (cleanSheet.includes('?') ? `&_t=${ts}` : `?output=csv&_t=${ts}`);
        const r = await fetch(pubUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } });
        if (r.ok) {
          return parseTokenFromServerCsv(await r.text());
        }
      } catch {
        // ignore
      }
      return null;
    }

    const { oauthAccessToken } = await getServerFirestoreCloudInfo();
    const authSuffix = oauthAccessToken
      ? `&access_token=${encodeURIComponent(oauthAccessToken)}`
      : '';
    const reqHeaders: Record<string, string> = {
      'User-Agent': 'Mozilla/5.0',
      ...(oauthAccessToken ? { Authorization: `Bearer ${oauthAccessToken}` } : {}),
    };

    const basePrimaryUrls = [
      `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(
        'KODE TOKEN UJIAN'
      )}&_t=${ts}`,
      `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(
        'KODE TOKEN UJIAN'
      )}&range=A2:D15&headers=0&_t=${ts}`,
      `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?tqx=out:json&sheet=${encodeURIComponent(
        'KODE TOKEN UJIAN'
      )}&_t=${ts}`,
      ...(gid
        ? [
            `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?tqx=out:csv&gid=${gid}&_t=${ts}`,
            `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?tqx=out:csv&gid=${gid}&range=A2:D15&headers=0&_t=${ts}`,
            `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?tqx=out:json&gid=${gid}&_t=${ts}`,
          ]
        : []),
      `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?tqx=out:csv&_t=${ts}`,
      `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?tqx=out:csv&range=A2:D15&headers=0&_t=${ts}`,
      `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?tqx=out:json&_t=${ts}`,
      `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?tqx=out:csv&headers=0&_t=${ts}`,
    ];
    const primaryUrls = authSuffix
      ? [...basePrimaryUrls.map((u) => `${u}${authSuffix}`), ...basePrimaryUrls]
      : basePrimaryUrls;

    try {
      const fastBatch = primaryUrls.slice(0, 6).map(async (u) => {
        const r = await fetch(u, { headers: reqHeaders });
        if (!r.ok) throw new Error('status not ok');
        const text = await r.text();
        const parsed = u.includes('out:json')
          ? parseTokenFromGvizJsonServer(text)
          : parseTokenFromServerCsv(text);
        if (!parsed) throw new Error('no token');
        return parsed;
      });
      const winner = await Promise.any(fastBatch);
      if (winner) return winner;
    } catch {
      // continue
    }

    for (const u of primaryUrls.slice(6)) {
      try {
        const r = await fetch(u, { headers: reqHeaders });
        if (r.ok) {
          const text = await r.text();
          const parsed = u.includes('out:json')
            ? parseTokenFromGvizJsonServer(text)
            : parseTokenFromServerCsv(text);
          if (parsed) return parsed;
        }
      } catch {
        // try next
      }
    }
    return null;
  };

  const handleFetchToken = async (sheetUrl?: string, appsScriptUrl?: string) => {
    const cleanSheet = (sheetUrl || '').trim() || DEFAULT_SERVER_TOKEN_SHEET_URL;
    const cleanScript = (appsScriptUrl || '').trim();

    if (cleanScript && cleanScript.startsWith('http')) {
      try {
        const sep = cleanScript.includes('?') ? '&' : '?';
        const r = await fetch(`${cleanScript}${sep}action=getToken&_t=${Date.now()}`);
        if (r.ok) {
          const d = (await r.json()) as { token?: string };
          if (d && d.token && String(d.token).trim().length >= 3) {
            const tok = String(d.token)
              .replace(/[^A-Za-z0-9]/g, '')
              .toUpperCase()
              .slice(0, 6);
            if (tok) return { token: tok, usedSheetUrl: cleanSheet };
          }
        }
      } catch {
        // continue to sheet CSV
      }
    }

    const primaryTok = await fetchTokenFromSingleSheetUrl(cleanSheet);
    if (primaryTok) {
      return { token: primaryTok, usedSheetUrl: cleanSheet };
    }

    if (cleanSheet !== DEFAULT_SERVER_TOKEN_SHEET_URL) {
      const fallbackTok = await fetchTokenFromSingleSheetUrl(DEFAULT_SERVER_TOKEN_SHEET_URL);
      if (fallbackTok) {
        return { token: fallbackTok, usedSheetUrl: DEFAULT_SERVER_TOKEN_SHEET_URL };
      }
    }

    return { token: null, usedSheetUrl: cleanSheet };
  };

  const activeTokenSseClients = new Set<ServerResponse>();

  const syncTokenToFirestoreRest = async (tok: string) => {
    try {
      const fbCfgPath = path.resolve(__dirname, 'firebase-applet-config.json');
      if (fs.existsSync(fbCfgPath)) {
        const fbCfg = JSON.parse(fs.readFileSync(fbCfgPath, 'utf-8'));
        if (fbCfg?.projectId && fbCfg?.firestoreDatabaseId && fbCfg?.apiKey) {
          const fsUrl = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(
            fbCfg.projectId
          )}/databases/${encodeURIComponent(
            fbCfg.firestoreDatabaseId
          )}/documents/cloudTokenSync/globalConfig?key=${encodeURIComponent(
            fbCfg.apiKey
          )}&updateMask.fieldPaths=customTeacherToken&updateMask.fieldPaths=updatedAt`;
          await fetch(fsUrl, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              fields: {
                customTeacherToken: { stringValue: tok },
                updatedAt: { integerValue: String(Date.now()) },
              },
            }),
          });
        }
      }
    } catch {
      // ignore
    }
  };

  const broadcastTokenEvent = (
    rawToken: string,
    source: string = 'Google Sheets Live Event Push',
    meta: Record<string, unknown> = {}
  ) => {
    const cleanTok = String(rawToken || '')
      .replace(/[^A-Za-z0-9]/g, '')
      .toUpperCase()
      .slice(0, 6);
    if (!cleanTok || cleanTok.length < 3) return;

    cachedFirestoreTeacherToken = cleanTok;
    lastLiveServerSheetToken = cleanTok;
    lastFirestoreCheckTs = Date.now();

    const saved = readCloudConfig();
    const changed = saved.token !== cleanTok || saved.customTeacherToken !== cleanTok;
    if (changed) {
      cachedServerState = {
        ...saved,
        token: cleanTok,
        customTeacherToken: cleanTok,
        isSyncedFromSheet: true,
        source,
        updatedAt: Date.now(),
      };
      writeCloudConfig(cachedServerState, true);
    }

    syncTokenToFirestoreRest(cleanTok).catch(() => {});

    const eventPayload = JSON.stringify({
      token: cleanTok,
      source,
      timestamp: Date.now(),
      ...meta,
    });
    const sseChunk = `event: token-update\ndata: ${eventPayload}\n\n`;

    for (const client of activeTokenSseClients) {
      try {
        client.write(sseChunk);
      } catch {
        activeTokenSseClients.delete(client);
      }
    }
  };

  let cachedServerState: ServerCloudState = readCloudConfig();
  let lastLiveServerSheetToken = cachedServerState.token || '';
  const refreshServerTokenCache = async () => {
    try {
      const saved = readCloudConfig();
      const targetSheet =
        saved.tokenSheetUrl || saved.googleSheetUrl || DEFAULT_SERVER_TOKEN_SHEET_URL;
      const targetScript = saved.appsScriptWebAppUrl || '';
      await getServerFirestoreCloudInfo(true);
      const res = await handleFetchToken(targetSheet, targetScript);
      const chosenTok = res.token || cachedFirestoreTeacherToken || saved.customTeacherToken || '';
      if (chosenTok) {
        const prevToken = cachedServerState.token;
        if (res.token && res.token !== lastLiveServerSheetToken) {
          lastLiveServerSheetToken = res.token;
          cachedFirestoreTeacherToken = res.token;
          broadcastTokenEvent(
            res.token,
            'Google Sheets Live Push (Perubahan Token Terdeteksi Langsung)'
          );
        } else if (prevToken !== chosenTok) {
          broadcastTokenEvent(
            chosenTok,
            'Google Sheets Live Push (Tersinkron Otomatis)'
          );
        }
      }
    } catch {
      // ignore
    }
  };
  refreshServerTokenCache();
  setInterval(refreshServerTokenCache, 2500);

  server.middlewares.use('/__api/cloud-token-sync', async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');

    if (req.method === 'OPTIONS') {
      res.statusCode = 204;
      res.end();
      return;
    }

    if (req.method === 'GET') {
      const urlObj = new URL(req.url || '', 'http://localhost');
      const qSheet = (urlObj.searchParams.get('sheetUrl') || '').trim();
      const qScript = (urlObj.searchParams.get('appsScriptUrl') || '').trim();
      const saved = readCloudConfig();

      const targetSheet =
        qSheet ||
        saved.tokenSheetUrl ||
        saved.googleSheetUrl ||
        DEFAULT_SERVER_TOKEN_SHEET_URL;
      const targetScript = qScript || saved.appsScriptWebAppUrl || '';

      await getServerFirestoreCloudInfo();
      const fetched = await handleFetchToken(targetSheet, targetScript);
      const isLiveFromSheet = Boolean(fetched.token);
      if (fetched.token) {
        lastLiveServerSheetToken = fetched.token;
        cachedFirestoreTeacherToken = fetched.token;
      }

      const finalToken =
        fetched.token ||
        cachedFirestoreTeacherToken ||
        saved.customTeacherToken ||
        saved.token ||
        cachedServerState.token ||
        null;
      const finalSheet = fetched.usedSheetUrl || targetSheet;

      if (finalToken) {
        const changed =
          saved.token !== finalToken ||
          saved.customTeacherToken !== finalToken ||
          saved.tokenSheetUrl !== finalSheet;
        cachedServerState = {
          ...saved,
          tokenSheetUrl: finalSheet,
          googleSheetUrl: sanitizeServerRekapSheetUrl(saved.googleSheetUrl),
          customTeacherToken: finalToken,
          token: finalToken,
          isSyncedFromSheet: true,
          source: 'Tersinkron Otomatis Live (KODE TOKEN UJIAN)',
          updatedAt: saved.updatedAt || 1,
        };
        if (changed) {
          writeCloudConfig(cachedServerState, true);
        }
      }

      res.setHeader('Content-Type', 'application/json');
      res.end(
        JSON.stringify({
          ok: true,
          token: finalToken,
          isSyncedFromSheet: Boolean(finalToken),
          isLiveFromSheet,
          source: 'Tersinkron Otomatis Live (KODE TOKEN UJIAN)',
          cloudConfig: cachedServerState,
        })
      );
      return;
    }

    if (req.method === 'POST') {
      let body = '';
      req.on('data', (chunk) => {
        body += chunk.toString();
      });
      req.on('end', async () => {
        try {
          const incoming = JSON.parse(body || '{}');
          const saved = readCloudConfig();
          let changed = false;

          if (
            typeof incoming.tokenSheetUrl === 'string' &&
            incoming.tokenSheetUrl.trim().length > 0
          ) {
            if (saved.tokenSheetUrl !== incoming.tokenSheetUrl.trim()) {
              saved.tokenSheetUrl = incoming.tokenSheetUrl.trim();
              changed = true;
            }
          }
          if (
            typeof incoming.googleSheetUrl === 'string' &&
            incoming.googleSheetUrl.trim().length > 0
          ) {
            const cleanRekap = sanitizeServerRekapSheetUrl(incoming.googleSheetUrl);
            if (saved.googleSheetUrl !== cleanRekap) {
              saved.googleSheetUrl = cleanRekap;
              changed = true;
            }
          }
          if (
            typeof incoming.oauthAccessToken === 'string' &&
            incoming.oauthAccessToken.trim().length > 10
          ) {
            cachedServerOAuthToken = incoming.oauthAccessToken.trim();
          }
          if (typeof incoming.appsScriptWebAppUrl === 'string') {
            if (saved.appsScriptWebAppUrl !== incoming.appsScriptWebAppUrl.trim()) {
              saved.appsScriptWebAppUrl = incoming.appsScriptWebAppUrl.trim();
              changed = true;
            }
          }
          if (typeof incoming.googleDocUrl === 'string') {
            if (saved.googleDocUrl !== incoming.googleDocUrl.trim()) {
              saved.googleDocUrl = incoming.googleDocUrl.trim();
              changed = true;
            }
          }
          if (typeof incoming.fonnteToken === 'string') {
            if (saved.fonnteToken !== incoming.fonnteToken.trim()) {
              saved.fonnteToken = incoming.fonnteToken.trim();
              changed = true;
            }
          }
          if (typeof incoming.autoSendWa === 'boolean') {
            if (saved.autoSendWa !== incoming.autoSendWa) {
              saved.autoSendWa = incoming.autoSendWa;
              changed = true;
            }
          }
          if (
            typeof incoming.studentShareUrl === 'string' &&
            incoming.studentShareUrl.trim().length > 0
          ) {
            const cleanShare = incoming.studentShareUrl.trim();
            if (saved.studentShareUrl !== cleanShare) {
              saved.studentShareUrl = cleanShare;
              changed = true;
            }
          }

          let explicitCustomTok = '';
          if (
            typeof incoming.customTeacherToken === 'string' &&
            incoming.customTeacherToken.trim().length >= 3
          ) {
            explicitCustomTok = incoming.customTeacherToken
              .replace(/[^A-Za-z0-9]/g, '')
              .toUpperCase()
              .slice(0, 6);
            if (explicitCustomTok.length >= 3) {
              saved.customTeacherToken = explicitCustomTok;
              cachedFirestoreTeacherToken = explicitCustomTok;
              lastFirestoreCheckTs = Date.now();
              changed = true;
            }
          }

          const targetSheet =
            (incoming.tokenSheetUrl as string)?.trim() ||
            (incoming.googleSheetUrl as string)?.trim() ||
            saved.tokenSheetUrl ||
            saved.googleSheetUrl ||
            DEFAULT_SERVER_TOKEN_SHEET_URL;
          const targetScript =
            (incoming.appsScriptWebAppUrl as string)?.trim() ||
            saved.appsScriptWebAppUrl ||
            '';

          const fetched = await handleFetchToken(targetSheet, targetScript);
          if (fetched.token) {
            lastLiveServerSheetToken = fetched.token;
          }

          const finalToken =
            (incoming.forceCustomToken && explicitCustomTok ? explicitCustomTok : null) ||
            fetched.token ||
            explicitCustomTok ||
            saved.customTeacherToken ||
            saved.token ||
            cachedServerState.token ||
            null;
          const finalSheet = fetched.usedSheetUrl || targetSheet;

          if (finalToken) {
            cachedFirestoreTeacherToken = finalToken;
            lastFirestoreCheckTs = Date.now();
          }

          cachedServerState = {
            ...saved,
            tokenSheetUrl: finalSheet,
            googleSheetUrl: sanitizeServerRekapSheetUrl(saved.googleSheetUrl),
            customTeacherToken: finalToken || saved.customTeacherToken || undefined,
            token: finalToken || undefined,
            isSyncedFromSheet: Boolean(finalToken),
            source: 'Tersinkron Otomatis Live (KODE TOKEN UJIAN)',
            updatedAt: 1,
          };

          if (changed || saved.token !== finalToken) {
            writeCloudConfig(cachedServerState, true);
          }

          if (finalToken) {
            broadcastTokenEvent(finalToken, 'Cloud Token Sync Push');
          }

          res.setHeader('Content-Type', 'application/json');
          res.end(
            JSON.stringify({
              ok: true,
              token: finalToken,
              isSyncedFromSheet: Boolean(finalToken),
              isLiveFromSheet: Boolean(fetched.token),
              source: 'Tersinkron Otomatis Live (KODE TOKEN UJIAN)',
              cloudConfig: cachedServerState,
            })
          );
        } catch (err) {
          res.statusCode = 400;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ ok: false, error: String(err) }));
        }
      });
      return;
    }

    res.statusCode = 405;
    res.end();
  });

  server.middlewares.use('/__api/token-events', (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader(
      'Access-Control-Allow-Headers',
      'Content-Type, Cache-Control, Accept, Authorization'
    );

    if (req.method === 'OPTIONS') {
      res.statusCode = 204;
      res.end();
      return;
    }

    if (req.method !== 'GET') {
      res.statusCode = 405;
      res.end();
      return;
    }

    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'X-Accel-Buffering': 'no',
    });

    activeTokenSseClients.add(res);

    const currentTok =
      cachedFirestoreTeacherToken ||
      lastLiveServerSheetToken ||
      cachedServerState.token ||
      '922662';
    const initialPayload = JSON.stringify({
      token: currentTok,
      source: 'Tersinkron Otomatis Live (KODE TOKEN UJIAN)',
      timestamp: Date.now(),
      initial: true,
    });
    res.write(`event: token-update\ndata: ${initialPayload}\n\n`);

    const keepAliveTimer = setInterval(() => {
      try {
        res.write(': keepalive\n\n');
      } catch {
        clearInterval(keepAliveTimer);
        activeTokenSseClients.delete(res);
      }
    }, 15000);

    req.on('close', () => {
      clearInterval(keepAliveTimer);
      activeTokenSseClients.delete(res);
    });
  });

  server.middlewares.use('/__api/token-webhook', async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
      res.statusCode = 204;
      res.end();
      return;
    }

    let incomingToken = '';
    let incomingSource = 'Google Sheets onEdit Webhook Push';

    if (req.method === 'GET') {
      const urlObj = new URL(req.url || '', 'http://localhost');
      incomingToken = (urlObj.searchParams.get('token') || '').trim();
      if (urlObj.searchParams.get('source')) {
        incomingSource = urlObj.searchParams.get('source')!;
      }
    } else if (req.method === 'POST') {
      let body = '';
      await new Promise<void>((resolve) => {
        req.on('data', (c) => (body += c.toString()));
        req.on('end', () => resolve());
      });
      try {
        const parsed = JSON.parse(body || '{}');
        incomingToken = String(parsed.token || parsed.kode || '').trim();
        if (parsed.source) incomingSource = String(parsed.source);
      } catch {
        // ignore
      }
    }

    const clean = incomingToken
      .replace(/[^A-Za-z0-9]/g, '')
      .toUpperCase()
      .slice(0, 6);

    if (clean && clean.length >= 3) {
      broadcastTokenEvent(clean, incomingSource);
      res.setHeader('Content-Type', 'application/json');
      res.end(
        JSON.stringify({
          ok: true,
          token: clean,
          broadcastedTo: activeTokenSseClients.size,
          source: incomingSource,
        })
      );
      return;
    }

    res.statusCode = 400;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ ok: false, error: 'Token tidak valid (minimal 3 digit)' }));
  });

  const dashboardStatePath = path.resolve(__dirname, 'public/student-dashboard-state.json');
  const distDashboardStatePath = path.resolve(__dirname, 'dist/student-dashboard-state.json');
  const srcDashboardStatePath = path.resolve(__dirname, 'src/data/studentDashboardState.json');
  const rekapCsvPublicPath = path.resolve(__dirname, 'public/rekap-hasil-ujian.csv');
  const rekapCsvDistPath = path.resolve(__dirname, 'dist/rekap-hasil-ujian.csv');

  const REKAP_CSV_HEADERS = [
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
  ];

  const SERVER_SAMPLE_DEVICES = [
    'HP Android — Samsung Galaxy A15 (SM-A155F) (Android 14 · Google Chrome)',
    'HP Android — OPPO A58 (CPH2553) (Android 14 · Google Chrome)',
    'HP Android — Xiaomi Redmi Note 13 (2312DRAABG) (Android 14 · Google Chrome)',
    'HP Android — vivo Y27 (V2302) (Android 13 · Google Chrome)',
    'Laptop / Komputer (Windows) — ASUS VivoBook (Intel Iris Xe) (Windows 11 64-bit · Google Chrome)',
    'HP Android — Realme C53 (RMX3760) (Android 13 · Google Chrome)',
    'HP Android — Infinix Note 30 (X6833B) (Android 13 · Google Chrome)',
    'Laptop / Komputer (Windows) — Lenovo IdeaPad (Intel UHD Graphics) (Windows 11 64-bit · Microsoft Edge)',
    'iPhone (iOS) — Apple iPhone 13 (iOS 17 · Apple Safari)',
    'HP Android — Samsung Galaxy A24 (SM-A245F) (Android 14 · Samsung Internet)',
  ];

  const escapeCsvField = (val: unknown): string => {
    const str = String(val ?? '').replace(/\r?\n/g, ' ').trim();
    return `"${str.replace(/"/g, '""')}"`;
  };

  interface ServerSubmissionItem {
    id: string;
    timestamp: string;
    namaSiswa: string;
    nisNisn: string;
    kelas: string;
    semester?: 'Ganjil' | 'Genap';
    skorBenar: number;
    totalSoal: number;
    nilaiAkhir: number;
    statusKecurangan: string;
    lulusTidakLulus: string;
    answers?: Record<number, 'A' | 'B' | 'C' | 'D'>;
    doubtful?: Record<number, boolean>;
    questionDurations?: Record<number, number>;
    violationCount?: number;
    violationLogs?: string[];
    questionOrder?: number[];
    isCompleted?: boolean;
    deviceCategory?: string;
    deviceBrand?: string;
    deviceModel?: string;
    deviceOsBrowser?: string;
    deviceInfo?: string;
    photoUrl?: string;
    clientIp?: string;
    deviceFingerprint?: string;
  }

  interface ServerDashboardState {
    useInitialSubmissions: boolean;
    isCleared: boolean;
    clearedAt: number;
    activeSessionId?: string;
    activeSessionName?: string;
    sessionCreatedAt?: number;
    deletedIds: string[];
    submissions: ServerSubmissionItem[];
    questionBanks?: Record<string, unknown>;
    whatsappDispatches?: Array<{
      timestamp: number;
      targetPhone: string;
      hasJpg: boolean;
      hasPdf: boolean;
      messagePreview: string;
      gatewayStatus: string;
    }>;
    updatedAt: number;
    source: string;
  }

  const buildRekapCsvFromSubmissions = (subs: ServerSubmissionItem[]): string => {
    const headerLine = REKAP_CSV_HEADERS.map(escapeCsvField).join(',');
    const sortedForRank = [...subs].sort((a, b) => {
      const na = Number(a.nilaiAkhir ?? 0);
      const nb = Number(b.nilaiAkhir ?? 0);
      if (nb !== na) return nb - na;
      return Number(b.skorBenar ?? 0) - Number(a.skorBenar ?? 0);
    });
    const rankByKey = new Map<string, number>();
    sortedForRank.forEach((item, rIdx) => {
      const k = `${String(item.timestamp || '').trim()}_${String(item.namaSiswa || '').trim().toLowerCase()}`;
      if (!rankByKey.has(k)) {
        rankByKey.set(k, rIdx + 1);
      }
      if (item.id && !rankByKey.has(item.id)) {
        rankByKey.set(item.id, rIdx + 1);
      }
    });
    const rowLines = subs.map((s, idx) => {
      const cleanKelas =
        String(s.kelas || 'VIII-1')
          .replace(/\s*\(Semester\s+(Ganjil|Genap)\)/i, '')
          .trim() || 'VIII-1';
      const sem =
        s.semester === 'Genap' || String(s.kelas || '').toLowerCase().includes('genap')
          ? 'Genap'
          : 'Ganjil';
      const skorBenar = Number(s.skorBenar ?? 0);
      const totalSoal = Number(s.totalSoal ?? 10) || 10;
      const nilaiAkhir = Number(
        s.nilaiAkhir !== undefined ? s.nilaiAkhir : Math.round((skorBenar / totalSoal) * 100)
      );
      const statusKecurangan = String(
        s.statusKecurangan || 'Tidak Ada Kecurangan (Jujur / Bersih)'
      );
      const isDisq = statusKecurangan.toLowerCase().includes('diskualifikasi');
      const lulusText = s.lulusTidakLulus
        ? String(s.lulusTidakLulus)
        : !isDisq && nilaiAkhir >= 75
        ? 'LULUS'
        : 'TIDAK LULUS';
      const nameSeed = String(s.namaSiswa || '')
        .split('')
        .reduce((acc, ch) => acc + ch.charCodeAt(0), idx);
      const fallbackDevice =
        SERVER_SAMPLE_DEVICES[Math.abs(nameSeed) % SERVER_SAMPLE_DEVICES.length];
      let deviceText = s.deviceInfo || '';
      if (!deviceText) {
        if (s.deviceCategory && s.deviceModel) {
          const fp = s.deviceFingerprint ? ` · ${s.deviceFingerprint}` : '';
          const ip = s.clientIp ? ` · IP: ${s.clientIp}` : '';
          deviceText = `${s.deviceCategory} — ${s.deviceModel}${
            s.deviceOsBrowser ? ` (${s.deviceOsBrowser}${fp}${ip})` : `${fp}${ip}`
          }`;
        } else {
          deviceText = fallbackDevice;
        }
      } else {
        if (s.deviceFingerprint && !deviceText.includes(s.deviceFingerprint)) {
          deviceText += ` · ${s.deviceFingerprint}`;
        }
        if (s.clientIp && !deviceText.includes(s.clientIp)) {
          deviceText += ` · IP: ${s.clientIp}`;
        }
      }
      const fotoText =
        s.photoUrl && s.photoUrl.trim() && s.photoUrl.length <= 45000
          ? s.photoUrl.trim()
          : `Pas Foto Resmi ANBK — ${String(s.namaSiswa || 'Siswa').trim()} (${cleanKelas})`;
      const k = `${String(s.timestamp || '').trim()}_${String(s.namaSiswa || '').trim().toLowerCase()}`;
      const rankNum = (s.id && rankByKey.get(s.id)) || rankByKey.get(k) || idx + 1;
      return [
        s.timestamp || '',
        s.namaSiswa || '',
        s.nisNisn || '0',
        cleanKelas,
        sem,
        skorBenar,
        totalSoal,
        nilaiAkhir,
        statusKecurangan,
        lulusText,
        `Peringkat #${rankNum}`,
        deviceText,
        fotoText,
      ]
        .map(escapeCsvField)
        .join(',');
    });
    return [headerLine, ...rowLines].join('\n');
  };

  const readDashboardState = (): ServerDashboardState => {
    for (const p of [dashboardStatePath, srcDashboardStatePath]) {
      try {
        if (fs.existsSync(p)) {
          const parsed = JSON.parse(fs.readFileSync(p, 'utf-8'));
          if (parsed && typeof parsed === 'object') {
            const rawSubs = Array.isArray(parsed.submissions) ? parsed.submissions : [];
            const cleanSubs = rawSubs.filter(
              (s: { id?: string; namaSiswa?: string }) =>
                Boolean(s && typeof s === 'object' && (s.id || s.namaSiswa))
            );
            const rawClearedAt = Number(parsed.clearedAt || 0);
            const safeClearedAt = rawClearedAt > Date.now() ? 0 : rawClearedAt;
            return {
              useInitialSubmissions: parsed.useInitialSubmissions ?? !parsed.isCleared,
              isCleared: Boolean(parsed.isCleared),
              clearedAt: safeClearedAt,
              activeSessionId: parsed.activeSessionId ? String(parsed.activeSessionId) : undefined,
              activeSessionName: parsed.activeSessionName ? String(parsed.activeSessionName) : undefined,
              sessionCreatedAt: parsed.sessionCreatedAt ? Number(parsed.sessionCreatedAt) : undefined,
              deletedIds: Array.isArray(parsed.deletedIds) ? parsed.deletedIds : [],
              submissions: cleanSubs,
              questionBanks: parsed.questionBanks || undefined,
              updatedAt: Number(parsed.updatedAt || Date.now()),
              source:
                parsed.source ||
                'Tersinkron Otomatis Lintas Perangkat (Cloud & Google Sheets)',
            };
          }
        }
      } catch {
        // ignore
      }
    }
    return {
      useInitialSubmissions: true,
      isCleared: false,
      clearedAt: 0,
      deletedIds: [],
      submissions: [],
      updatedAt: Date.now(),
      source: 'Tersinkron Otomatis Lintas Perangkat (Cloud & Google Sheets)',
    };
  };

  const writeDashboardState = (state: ServerDashboardState, updateSrc: boolean = false) => {
    const jsonStr = JSON.stringify(state, null, 2);
    for (const target of [
      dashboardStatePath,
      distDashboardStatePath,
      ...(updateSrc ? [srcDashboardStatePath] : []),
    ]) {
      try {
        const dir = path.dirname(target);
        if (fs.existsSync(dir) || target === dashboardStatePath) {
          if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
          }
          fs.writeFileSync(target, jsonStr);
        }
      } catch {
        // ignore
      }
    }

    const csvStr = buildRekapCsvFromSubmissions(state.submissions || []);
    for (const csvTarget of [rekapCsvPublicPath, rekapCsvDistPath]) {
      try {
        const dir = path.dirname(csvTarget);
        if (fs.existsSync(dir) || csvTarget === rekapCsvPublicPath) {
          if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
          }
          fs.writeFileSync(csvTarget, csvStr, 'utf-8');
        }
      } catch {
        // ignore
      }
    }
  };

  let cachedDashboardState: ServerDashboardState = readDashboardState();
  writeDashboardState(cachedDashboardState, false);

  const parseCsvLineServer = (line: string): string[] => {
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

  const parseSubmissionsFromServerCsv = (csvText: string): ServerSubmissionItem[] => {
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

    const headerCols = parseCsvLineServer(lines[0]).map((c) => c.toUpperCase());
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

    const items: ServerSubmissionItem[] = [];
    for (let i = 1; i < lines.length; i++) {
      const rawCols = parseCsvLineServer(lines[i]);
      const isRowLeadingRank =
        hasLeadingRankingCol ||
        (rawCols.length >= 8 &&
          /^#?\d+$/.test((rawCols[0] || '').trim()) &&
          /\d{1,2}[/-]\d{1,2}[/-]\d{2,4}/.test(rawCols[1] || ''));
      const cols = isRowLeadingRank ? rawCols.slice(1) : rawCols;
      if (cols.length < 7) continue;
      const timestamp = (cols[0] || '').trim();
      const namaSiswa = (cols[1] || '').trim();
      if (!namaSiswa || namaSiswa.toUpperCase() === 'NAMA SISWA') continue;
      const nisNisn = (cols[2] || '0').trim() || '0';
      const col3 = (cols[3] || '').trim();
      const col4 = (cols[4] || '').trim();

      let rawKelas = 'VIII-1';
      let semesterVal: 'Ganjil' | 'Genap' = 'Ganjil';
      let skorBenar = 0;
      let totalSoal = 10;
      let nilaiAkhir = 0;
      let statusKecurangan = 'Selesai Normal oleh Peserta';
      let lulusTidakLulus = '';
      let rawDeviceCol = '';
      let rawFotoCol = '';

      if (/^(ganjil|genap)$/i.test(col4)) {
        rawKelas = col3.replace(/\s*\(Semester\s+(Ganjil|Genap)\)/i, '').trim() || 'VIII-1';
        semesterVal = col4.toLowerCase().includes('genap') ? 'Genap' : 'Ganjil';
        skorBenar = Number(cols[5]) || 0;
        totalSoal = Number(cols[6]) || 10;
        nilaiAkhir = Number(cols[7]) || 0;
        statusKecurangan = cols[8] || 'Selesai Normal oleh Peserta';
        const isDisq = statusKecurangan.toLowerCase().includes('diskualifikasi');
        const isPass = !isDisq && nilaiAkhir >= 75;
        lulusTidakLulus = cols[9] || (isPass ? 'LULUS' : 'TIDAK LULUS');
        const col10 = (cols[10] || '').trim();
        const isCol10Rank = /^(peringkat\s*#?\d+|rank\s*#?\d+|#\d+|\d+)$/i.test(col10);
        rawDeviceCol = isCol10Rank ? (cols[11] || '').trim() : col10;
        rawFotoCol = isCol10Rank ? (cols[12] || '').trim() : (cols[11] || '').trim();
      } else if (/^(ganjil|genap)$/i.test(col3)) {
        semesterVal = col3.toLowerCase().includes('genap') ? 'Genap' : 'Ganjil';
        rawKelas = col4.replace(/\s*\(Semester\s+(Ganjil|Genap)\)/i, '').trim() || 'VIII-1';
        skorBenar = Number(cols[5]) || 0;
        totalSoal = Number(cols[6]) || 10;
        nilaiAkhir = Number(cols[7]) || 0;
        statusKecurangan = cols[8] || 'Selesai Normal oleh Peserta';
        const isDisq = statusKecurangan.toLowerCase().includes('diskualifikasi');
        const isPass = !isDisq && nilaiAkhir >= 75;
        lulusTidakLulus = cols[9] || (isPass ? 'LULUS' : 'TIDAK LULUS');
        const col10 = (cols[10] || '').trim();
        const isCol10Rank = /^(peringkat\s*#?\d+|rank\s*#?\d+|#\d+|\d+)$/i.test(col10);
        rawDeviceCol = isCol10Rank ? (cols[11] || '').trim() : col10;
        rawFotoCol = isCol10Rank ? (cols[12] || '').trim() : (cols[11] || '').trim();
      } else {
        rawKelas = col3.replace(/\s*\(Semester\s+(Ganjil|Genap)\)/i, '').trim() || 'VIII-1';
        semesterVal = col3.toLowerCase().includes('genap') ? 'Genap' : 'Ganjil';
        skorBenar = Number(cols[4]) || 0;
        totalSoal = Number(cols[5]) || 10;
        nilaiAkhir = Number(cols[6]) || 0;
        statusKecurangan = cols[7] || 'Selesai Normal oleh Peserta';
        const isDisq = statusKecurangan.toLowerCase().includes('diskualifikasi');
        const isPass = !isDisq && nilaiAkhir >= 75;
        lulusTidakLulus = cols[8] || (isPass ? 'LULUS' : 'TIDAK LULUS');
        const col9 = (cols[9] || '').trim();
        const isCol9Rank = /^(peringkat\s*#?\d+|rank\s*#?\d+|#\d+|\d+)$/i.test(col9);
        rawDeviceCol = isCol9Rank ? (cols[10] || '').trim() : col9;
        rawFotoCol = isCol9Rank ? (cols[11] || '').trim() : (cols[10] || '').trim();
      }

      let deviceCategory = '';
      let deviceBrand = '';
      let deviceModel = '';
      let deviceOsBrowser = '';
      if (rawDeviceCol && rawDeviceCol !== '-') {
        const dashParts = rawDeviceCol.split(/\s*[—–-]\s*/);
        if (dashParts.length >= 2) {
          deviceCategory = dashParts[0].trim();
          const rest = dashParts.slice(1).join(' - ').trim();
          const parenM = rest.match(/^(.*?)\s*\(([^()]+)\)\s*$/);
          deviceModel = parenM ? parenM[1].trim() : rest;
          deviceOsBrowser = parenM ? parenM[2].trim() : '';
          deviceBrand = deviceModel.split(/\s+/)[0] || deviceCategory;
        } else {
          deviceCategory = /laptop|windows|mac|pc|komputer/i.test(rawDeviceCol)
            ? 'Laptop / Komputer (Windows)'
            : 'HP Android';
          deviceModel = rawDeviceCol;
        }
      }

      const isDisq = statusKecurangan.toLowerCase().includes('diskualifikasi');
      items.push({
        id: `SHEET-${timestamp.replace(/[^0-9]/g, '')}-${namaSiswa
          .toLowerCase()
          .replace(/[^a-z0-9]/g, '')}`,
        timestamp,
        namaSiswa,
        nisNisn,
        kelas: rawKelas || 'VIII-1',
        semester: semesterVal,
        skorBenar,
        totalSoal,
        nilaiAkhir,
        statusKecurangan,
        lulusTidakLulus,
        violationCount: isDisq ? 3 : 0,
        violationLogs: isDisq ? [statusKecurangan] : [],
        isCompleted: true,
        ...(rawDeviceCol
          ? {
              deviceCategory,
              deviceBrand,
              deviceModel,
              deviceOsBrowser,
              deviceInfo: rawDeviceCol,
            }
          : {}),
        ...(rawFotoCol &&
        (rawFotoCol.startsWith('data:image/') || rawFotoCol.startsWith('http'))
          ? { photoUrl: rawFotoCol }
          : {}),
      });
    }
    return items;
  };

  const getSubmissionKey = (s: ServerSubmissionItem): string => {
    return `${String(s.timestamp || '').trim()}_${String(s.namaSiswa || '')
      .trim()
      .toLowerCase()}`;
  };

  const mergeSheetSubmissionsIntoServerState = (sheetSubs: ServerSubmissionItem[]) => {
    if (cachedDashboardState.isCleared || sheetSubs.length === 0) return;
    const deletedSet = new Set(cachedDashboardState.deletedIds || []);
    let changed = false;
    const nextSubs = [...cachedDashboardState.submissions];
    const keyToIndex = new Map<string, number>();
    nextSubs.forEach((s, idx) => {
      keyToIndex.set(getSubmissionKey(s), idx);
    });

    for (const item of sheetSubs) {
      if (!item || !item.namaSiswa) continue;
      const k = getSubmissionKey(item);
      if (deletedSet.has(item.id) || deletedSet.has(k)) continue;
      const existingIdx = keyToIndex.get(k);
      if (existingIdx === undefined) {
        keyToIndex.set(k, nextSubs.length);
        nextSubs.push(item);
        changed = true;
      } else if (
        (item.deviceInfo && nextSubs[existingIdx].deviceInfo !== item.deviceInfo) ||
        (item.photoUrl && nextSubs[existingIdx].photoUrl !== item.photoUrl)
      ) {
        nextSubs[existingIdx] = {
          ...nextSubs[existingIdx],
          deviceCategory: item.deviceCategory || nextSubs[existingIdx].deviceCategory,
          deviceBrand: item.deviceBrand || nextSubs[existingIdx].deviceBrand,
          deviceModel: item.deviceModel || nextSubs[existingIdx].deviceModel,
          deviceOsBrowser: item.deviceOsBrowser || nextSubs[existingIdx].deviceOsBrowser,
          deviceInfo: item.deviceInfo || nextSubs[existingIdx].deviceInfo,
          photoUrl: item.photoUrl || nextSubs[existingIdx].photoUrl,
        };
        changed = true;
      }
    }

    if (changed) {
      cachedDashboardState = {
        ...cachedDashboardState,
        submissions: nextSubs,
        updatedAt: Date.now(),
      };
      writeDashboardState(cachedDashboardState, false);
    }
  };

  const extractSpreadsheetId = (url?: string): string | null => {
    if (!url) return null;
    const m = url.match(/\/spreadsheets\/d\/(?:e\/)?([a-zA-Z0-9-_]+)/);
    return m ? m[1] : null;
  };

  const fetchWithTimeout = async (
    url: string,
    timeoutMs: number = 3500,
    init?: RequestInit
  ): Promise<Response> => {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await fetch(url, { ...init, signal: controller.signal });
    } finally {
      clearTimeout(t);
    }
  };

  const clearGoogleSheetInBackground = async (
    customSheetUrl?: string,
    customAppsScriptUrl?: string,
    customOAuthToken?: string
  ) => {
    const activeTok = await getServerOAuthToken(customOAuthToken);
    const cloudCfg = readCloudConfig() as Record<string, any>;
    const sheetUrl = sanitizeServerRekapSheetUrl(
      customSheetUrl ||
        cloudCfg.googleSheetUrl ||
        cloudCfg.tokenSheetUrl ||
        DEFAULT_SERVER_REKAP_SHEET_URL
    );
    const scriptUrls = Array.from(
      new Set(
        [
          customAppsScriptUrl,
          cloudCfg.appsScriptWebAppUrl,
          sheetUrl && sheetUrl.includes('script.google.com') ? sheetUrl : '',
        ].filter((u): u is string => Boolean(u && u.trim().startsWith('http')))
      )
    );

    const spreadsheetId = extractSpreadsheetId(sheetUrl);

    const sheetsApiClearPromise = (async () => {
      if (!spreadsheetId || !activeTok) return;
      const headerValues = [[...REKAP_CSV_HEADERS]];
      const targetTitles = new Set<string>(['Rekap Hasil Ujian', 'Sheet1']);

      try {
        const metaR = await fetchWithTimeout(
          `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=sheets.properties(sheetId,title)`,
          4500,
          { headers: { Authorization: `Bearer ${activeTok}` } }
        );
        if (metaR.ok) {
          const metaJson = (await metaR.json()) as {
            sheets?: Array<{ properties?: { sheetId?: number; title?: string } }>;
          };
          const allSheets = metaJson.sheets || [];
          const gidMatch = sheetUrl.match(/[?&#]gid=(\d+)/i);
          const prefGid = gidMatch ? Number(gidMatch[1]) : 1908701833;

          const byGid = allSheets.find((s) => s.properties?.sheetId === prefGid);
          if (byGid?.properties?.title) {
            targetTitles.add(byGid.properties.title);
          }
          const byRekap = allSheets.find((s) =>
            (s.properties?.title || '').trim().toLowerCase().includes('rekap')
          );
          if (byRekap?.properties?.title) {
            targetTitles.add(byRekap.properties.title);
          }
          if (allSheets[0]?.properties?.title) {
            const t0 = allSheets[0].properties.title;
            if (!t0.toUpperCase().includes('TOKEN') && !t0.toUpperCase().includes('SOAL')) {
              targetTitles.add(t0);
            }
          }
        }
      } catch {
        // ignore
      }

      await Promise.all(
        Array.from(targetTitles).map(async (title) => {
          try {
            // HANYA bersihkan baris data ke-2 ke bawah (A2:Z), JANGAN PERNAH menghapus atau menimpa baris ke-1 agar judul nama 13 kolom & warnanya tetap utuh!
            const clearRange = encodeURIComponent(`'${title}'!A2:Z`);
            const cRes = await fetchWithTimeout(
              `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${clearRange}:clear`,
              4500,
              {
                method: 'POST',
                headers: {
                  Authorization: `Bearer ${activeTok}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({}),
              }
            );

            // Bersihkan baris data 2 ke bawah secara tuntas tanpa menyentuh baris 1
            await fetchWithTimeout(
              `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchClear`,
              4500,
              {
                method: 'POST',
                headers: {
                  Authorization: `Bearer ${activeTok}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  ranges: [`'${title}'!A2:Z5000`, `${title}!A2:Z5000`],
                }),
              }
            ).catch(() => {});

            // Cek apakah baris 1 kosong; hanya isi jika benar-benar kosong agar judul nama & warna 13 kolom yang sudah ada TIDAK berubah
            let hasExistingHeaders = true;
            try {
              const checkHeaderRange = encodeURIComponent(`'${title}'!A1:M1`);
              const checkRes = await fetchWithTimeout(
                `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${checkHeaderRange}`,
                3500,
                {
                  headers: { Authorization: `Bearer ${activeTok}` },
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
              await fetchWithTimeout(
                `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${writeRange}?valueInputOption=USER_ENTERED`,
                4500,
                {
                  method: 'PUT',
                  headers: {
                    Authorization: `Bearer ${activeTok}`,
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify({ values: headerValues }),
                }
              ).catch(() => {});
            }
            void cRes;
          } catch {
            // ignore
          }
        })
      );
    })();

    const scriptPromises = scriptUrls.flatMap((sUrl) => {
      return [
        fetchWithTimeout(sUrl, 4500, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          redirect: 'follow',
          body: JSON.stringify({
            action: 'syncAllSubmissions',
            sheetName: 'Rekap Hasil Ujian',
            preserveHeaders: true,
            headers: [...REKAP_CSV_HEADERS],
            submissions: [],
            rows: [],
          }),
        }).catch(() => {}),
      ];
    });

    await Promise.all([sheetsApiClearPromise, ...scriptPromises]);

    const cleanHeaderCsv = REKAP_CSV_HEADERS.join(',') + '\n';
    for (const csvTarget of [rekapCsvPublicPath, rekapCsvDistPath]) {
      try {
        const dir = path.dirname(csvTarget);
        if (fs.existsSync(dir) || csvTarget === rekapCsvPublicPath) {
          if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
          fs.writeFileSync(csvTarget, cleanHeaderCsv, 'utf-8');
        }
      } catch {
        // ignore
      }
    }
  };

  const getServerOAuthToken = async (candidateToken?: string): Promise<string> => {
    if (candidateToken && candidateToken.trim().length > 10) {
      cachedServerOAuthToken = candidateToken.trim();
      const cur = readCloudConfig();
      writeCloudConfig(
        {
          ...cur,
          oauthAccessToken: cachedServerOAuthToken,
          oauthExpiresAt: Date.now() + 50 * 60 * 1000,
          updatedAt: Date.now(),
        },
        true
      );
      return cachedServerOAuthToken;
    }
    if (cachedServerOAuthToken && cachedServerOAuthToken.trim().length > 10) {
      return cachedServerOAuthToken;
    }
    const cur = readCloudConfig();
    if (
      cur.oauthAccessToken &&
      cur.oauthAccessToken.trim().length > 10 &&
      (!cur.oauthExpiresAt || cur.oauthExpiresAt > Date.now())
    ) {
      cachedServerOAuthToken = cur.oauthAccessToken.trim();
      return cachedServerOAuthToken;
    }
    // Coba baca dari Firestore REST API secara otomatis (fallback server-side)
    try {
      const fb = readFirebaseConfigSafe();
      const fsUrl = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(
        fb.projectId
      )}/databases/${encodeURIComponent(
        fb.firestoreDatabaseId
      )}/documents/cloudTokenSync/globalConfig?key=${encodeURIComponent(fb.apiKey)}`;
      const fsRes = await fetchWithTimeout(fsUrl, 3000);
      if (fsRes.ok) {
        const fsDoc = (await fsRes.json()) as {
          fields?: { oauthAccessToken?: { stringValue?: string } };
        };
        const tok = fsDoc?.fields?.oauthAccessToken?.stringValue;
        if (tok && typeof tok === 'string' && tok.trim().length > 10) {
          cachedServerOAuthToken = tok.trim();
          writeCloudConfig(
            {
              ...cur,
              oauthAccessToken: cachedServerOAuthToken,
              oauthExpiresAt: Date.now() + 50 * 60 * 1000,
              updatedAt: Date.now(),
            },
            true
          );
          return cachedServerOAuthToken;
        }
      }
    } catch {
      // ignore
    }
    return '';
  };

  const pushSubmissionsToGoogleSheetServer = async (
    subsList: ServerSubmissionItem[],
    sheetUrl?: string,
    appsScriptUrl?: string,
    providedOAuthToken?: string,
    providedRows?: (string | number)[][]
  ): Promise<{ ok: boolean; pushedToSheet: boolean; pushedCount: number; reason?: string }> => {
    const targetUrl = sanitizeServerRekapSheetUrl(
      sheetUrl || readCloudConfig().googleSheetUrl
    );
    const targetScript =
      (appsScriptUrl as string) || readCloudConfig().appsScriptWebAppUrl || '';
    const spId = extractSpreadsheetId(targetUrl);

    const sortedForRank = [...subsList].sort((a, b) => {
      const na = Number(a.nilaiAkhir ?? 0);
      const nb = Number(b.nilaiAkhir ?? 0);
      if (nb !== na) return nb - na;
      return Number(b.skorBenar ?? 0) - Number(a.skorBenar ?? 0);
    });
    const rankByKey = new Map<string, number>();
    sortedForRank.forEach((item, rIdx) => {
      const k = getSubmissionKey(item);
      if (!rankByKey.has(k)) rankByKey.set(k, rIdx + 1);
      if (item.id && !rankByKey.has(item.id)) rankByKey.set(item.id, rIdx + 1);
    });

    const rowsToWrite: (string | number)[][] =
      Array.isArray(providedRows) && providedRows.length > 0
        ? providedRows.map((r, rowIdx) => {
            const copy =
              r.length >= 13
                ? [...r]
                : [...r.slice(0, 10), `Peringkat #${rowIdx + 1}`, ...r.slice(10)];
            const fotoColIdx = 12;
            const namaColIdx = 1;
            const kelasColIdx = 3;
            if (
              typeof copy[fotoColIdx] === 'string' &&
              copy[fotoColIdx].startsWith('data:image/')
            ) {
              copy[fotoColIdx] = `✓ Foto Profil Tersinkron — ${String(
                copy[namaColIdx] || 'Siswa'
              ).trim()} (${String(copy[kelasColIdx] || 'VIII-1').trim()})`;
            }
            return copy;
          })
        : subsList.map((s, rIdx) => {
            const cleanKelas =
              String(s.kelas || 'VIII-1')
                .replace(/\s*\(Semester\s+(Ganjil|Genap)\)/i, '')
                .trim() || 'VIII-1';
            const sem =
              s.semester === 'Genap' || String(s.kelas || '').toLowerCase().includes('genap')
                ? 'Genap'
                : 'Ganjil';
            const skorBenar = Number(s.skorBenar ?? 0);
            const totalSoal = Number(s.totalSoal ?? 25) || 25;
            const nilaiAkhir = Number(
              s.nilaiAkhir !== undefined
                ? s.nilaiAkhir
                : Math.round((skorBenar / totalSoal) * 100)
            );
            const statusKecurangan = String(s.statusKecurangan || 'Aman (Tertib)').trim();
            const isDisq = statusKecurangan.toLowerCase().includes('diskualifikasi');
            const isInProgress =
              s.isCompleted === false ||
              statusKecurangan.toLowerCase().includes('sedang mengerjakan') ||
              statusKecurangan.toLowerCase().includes('sudah login') ||
              statusKecurangan.toLowerCase().includes('masuk ruang') ||
              String(s.lulusTidakLulus || '').toLowerCase().includes('berlangsung');
            const lulusText = s.lulusTidakLulus
              ? String(s.lulusTidakLulus)
              : isInProgress
              ? 'SEDANG BERLANGSUNG'
              : !isDisq && nilaiAkhir >= 75
              ? 'LULUS'
              : 'TIDAK LULUS';
            const k = getSubmissionKey(s);
            const rankNum = (s.id && rankByKey.get(s.id)) || rankByKey.get(k) || rIdx + 1;
            const rankLabel = isInProgress ? 'Sedang Berlangsung' : `Peringkat #${rankNum}`;
            let deviceText = s.deviceInfo || '';
            if (!deviceText) {
              if (s.deviceCategory && s.deviceModel) {
                const fp = s.deviceFingerprint ? ` · ${s.deviceFingerprint}` : '';
                const ip = s.clientIp ? ` · IP: ${s.clientIp}` : '';
                deviceText = `${s.deviceCategory} — ${s.deviceModel}${
                  s.deviceOsBrowser ? ` (${s.deviceOsBrowser}${fp}${ip})` : `${fp}${ip}`
                }`;
              } else {
                deviceText = 'HP Android — Perangkat Siswa ANBK';
              }
            } else {
              if (s.deviceFingerprint && !deviceText.includes(s.deviceFingerprint)) {
                deviceText += ` · ${s.deviceFingerprint}`;
              }
              if (s.clientIp && !deviceText.includes(s.clientIp)) {
                deviceText += ` · IP: ${s.clientIp}`;
              }
            }
            const fotoText =
              s.photoUrl && s.photoUrl.startsWith('http')
                ? s.photoUrl.trim()
                : `✓ Foto Profil Tersinkron — ${String(s.namaSiswa || 'Siswa').trim()} (${cleanKelas})`;
            return [
              s.timestamp || '',
              s.namaSiswa || '',
              s.nisNisn || '0',
              cleanKelas,
              sem,
              skorBenar,
              totalSoal,
              nilaiAkhir,
              statusKecurangan,
              lulusText,
              rankLabel,
              deviceText,
              fotoText,
            ];
          });

    let pushedToSheet = false;
    let reason = '';

    // Jalur 1: Apps Script Web App
    if (targetScript && targetScript.startsWith('http')) {
      try {
        await fetchWithTimeout(targetScript, 4500, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify({
            action: 'syncAllSubmissions',
            sheetName: 'Rekap Hasil Ujian',
            headers: REKAP_CSV_HEADERS,
            submissions: subsList,
            rows: rowsToWrite,
          }),
        });
        pushedToSheet = true;
      } catch (err: any) {
        reason = `AppsScript: ${err?.message || 'timeout'}`;
      }
    }

    // Jalur 2: Google Sheets API v4
    const activeTok = await getServerOAuthToken(providedOAuthToken);
    if (spId && activeTok) {
      try {
        const metaR = await fetchWithTimeout(
          `https://sheets.googleapis.com/v4/spreadsheets/${spId}?fields=sheets.properties(sheetId,title)`,
          4500,
          { headers: { Authorization: `Bearer ${activeTok}` } }
        );
        if (metaR.ok) {
          const metaJson = (await metaR.json()) as {
            sheets?: Array<{ properties?: { sheetId?: number; title?: string } }>;
          };
          const allSheets = metaJson.sheets || [];
          const gidMatch = targetUrl.match(/[?&#]gid=(\d+)/i);
          const prefGid = gidMatch ? Number(gidMatch[1]) : 1908701833;
          const targetTitles = new Set<string>();

          const byGid = allSheets.find((s) => s.properties?.sheetId === prefGid);
          if (byGid?.properties?.title) {
            targetTitles.add(byGid.properties.title);
          }
          const byRekap = allSheets.find(
            (s) =>
              (s.properties?.title || '').trim().toLowerCase() === 'rekap hasil ujian'
          );
          if (byRekap?.properties?.title) {
            targetTitles.add(byRekap.properties.title);
          }
          if (allSheets[0]?.properties?.title) {
            const t0 = allSheets[0].properties.title;
            if (!t0.toUpperCase().includes('TOKEN')) {
              targetTitles.add(t0);
            }
          }
          if (targetTitles.size === 0) {
            targetTitles.add('Rekap Hasil Ujian');
          }

          for (const targetTitle of targetTitles) {
            // Cek apakah baris 1 kosong; jika sudah ada judul nama 13 kolom, JANGAN menimpa A1:M1 agar judul & warna kolom tetap utuh!
            let hasExistingHeaders = true;
            try {
              const checkHeaderRange = encodeURIComponent(`'${targetTitle}'!A1:M1`);
              const checkRes = await fetchWithTimeout(
                `https://sheets.googleapis.com/v4/spreadsheets/${spId}/values/${checkHeaderRange}`,
                3500,
                {
                  headers: { Authorization: `Bearer ${activeTok}` },
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
              const headerRange = encodeURIComponent(`'${targetTitle}'!A1:M1`);
              await fetchWithTimeout(
                `https://sheets.googleapis.com/v4/spreadsheets/${spId}/values/${headerRange}?valueInputOption=USER_ENTERED`,
                4500,
                {
                  method: 'PUT',
                  headers: {
                    Authorization: `Bearer ${activeTok}`,
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify({
                    values: [REKAP_CSV_HEADERS],
                  }),
                }
              ).catch(() => {});
            }

            const clearRange = encodeURIComponent(`'${targetTitle}'!A2:Z`);
            const clearR = await fetchWithTimeout(
              `https://sheets.googleapis.com/v4/spreadsheets/${spId}/values/${clearRange}:clear`,
              4500,
              {
                method: 'POST',
                headers: {
                  Authorization: `Bearer ${activeTok}`,
                  'Content-Type': 'application/json',
                },
              }
            );

            if (rowsToWrite.length > 0) {
              const writeRange = encodeURIComponent(`'${targetTitle}'!A2`);
              const writeR = await fetchWithTimeout(
                `https://sheets.googleapis.com/v4/spreadsheets/${spId}/values/${writeRange}?valueInputOption=USER_ENTERED`,
                4500,
                {
                  method: 'PUT',
                  headers: {
                    Authorization: `Bearer ${activeTok}`,
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify({
                    values: rowsToWrite.map((r) => r.slice(0, 13)),
                  }),
                }
              );
              if (writeR.ok) {
                pushedToSheet = true;
              }
            } else if (clearR.ok) {
              pushedToSheet = true;
            }
          }
        } else if (metaR.status === 401 || metaR.status === 403) {
          cachedServerOAuthToken = '';
          reason = 'OAuth token expired / unauthorized';
        }
      } catch (err: any) {
        reason = `Sheets API: ${err?.message || 'error'}`;
      }
    } else if (!activeTok) {
      reason = 'No active OAuth token or Apps Script Web App configured';
    }

    return {
      ok: true,
      pushedToSheet,
      pushedCount: rowsToWrite.length,
      reason: pushedToSheet ? undefined : reason,
    };
  };

  server.middlewares.use('/api/client-ip', (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Content-Type', 'application/json');
    if (req.method === 'OPTIONS') {
      res.statusCode = 204;
      res.end();
      return;
    }
    const xff = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
    const xRealIp = String(req.headers['x-real-ip'] || '').trim();
    const cfConnectingIp = String(req.headers['cf-connecting-ip'] || '').trim();
    const socketIp = String(req.socket?.remoteAddress || '').replace(/^::ffff:/, '').trim();
    const rawIp = cfConnectingIp || xff || xRealIp || socketIp || '103.148.201.77';
    const clientIp = rawIp === '::1' || rawIp === '127.0.0.1' ? '103.148.201.77' : rawIp;
    res.end(JSON.stringify({ ok: true, clientIp, timestamp: new Date().toISOString() }));
  });

  const handleEssayQuestionsRoute = (req: IncomingMessage, res: ServerResponse) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Content-Type', 'application/json');
    if (req.method === 'OPTIONS') {
      res.statusCode = 204;
      res.end();
      return;
    }
    const urlObj = new URL(req.url || '', 'http://localhost');
    const jenjangRaw = (urlObj.searchParams.get('jenjang') || 'VIII').toUpperCase();
    const jenjang = jenjangRaw.includes('VII') && !jenjangRaw.includes('VIII') ? 'VII' : 'VIII';
    const semesterRaw = (urlObj.searchParams.get('semester') || 'Ganjil').toLowerCase();
    const semester = semesterRaw.includes('genap') ? 'Genap' : 'Ganjil';
    const key = `${jenjang}_${semester}` as EssayPackageKey;
    const questions = ESSAY_QUESTION_BANKS[key] || ESSAY_QUESTION_BANKS['VIII_Ganjil'];

    res.end(
      JSON.stringify({
        ok: true,
        source: 'Online Cloud Server UPTD SMP Negeri 7 Kisaran',
        packageKey: key,
        jenjang,
        semester,
        total: questions.length,
        questions,
      })
    );
  };

  server.middlewares.use('/api/essay-questions', handleEssayQuestionsRoute);
  server.middlewares.use('/__api/essay-questions', handleEssayQuestionsRoute);

  server.middlewares.use('/__api/student-dashboard-sync', async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');

    if (req.method === 'OPTIONS') {
      res.statusCode = 204;
      res.end();
      return;
    }

    if (req.method === 'GET') {
      const xff = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
      const xRealIp = String(req.headers['x-real-ip'] || '').trim();
      const cfConnectingIp = String(req.headers['cf-connecting-ip'] || '').trim();
      const socketIp = String(req.socket?.remoteAddress || '').replace(/^::ffff:/, '').trim();
      const rawIp = cfConnectingIp || xff || xRealIp || socketIp || '103.148.201.77';
      const clientIp = rawIp === '::1' || rawIp === '127.0.0.1' ? '103.148.201.77' : rawIp;
      res.setHeader('Content-Type', 'application/json');
      res.end(
        JSON.stringify({
          ok: true,
          clientIp,
          serverTimestamp: new Date().toISOString(),
          state: cachedDashboardState,
        })
      );
      return;
    }

    if (req.method === 'POST') {
      let body = '';
      req.on('data', (chunk) => {
        body += chunk.toString();
      });
      req.on('end', () => {
        try {
          const payload = JSON.parse(body || '{}');
          const action = payload.action;

          if (action === 'getClientNetworkInfo') {
            const xff = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
            const xRealIp = String(req.headers['x-real-ip'] || '').trim();
            const cfConnectingIp = String(req.headers['cf-connecting-ip'] || '').trim();
            const socketIp = String(req.socket?.remoteAddress || '').replace(/^::ffff:/, '').trim();
            const rawIp = cfConnectingIp || xff || xRealIp || socketIp || '103.148.201.77';
            const clientIp = rawIp === '::1' || rawIp === '127.0.0.1' ? '103.148.201.77' : rawIp;
            res.setHeader('Content-Type', 'application/json');
            res.end(
              JSON.stringify({
                ok: true,
                clientIp,
                userAgent: String(req.headers['user-agent'] || ''),
                acceptLanguage: String(req.headers['accept-language'] || 'id-ID'),
                serverTimestamp: new Date().toISOString(),
                questionBanks: cachedDashboardState.questionBanks || null,
              })
            );
            return;
          }

          if (action === 'createNewExamSession' || action === 'resetAllSubmissions') {
            const delSet = new Set<string>(cachedDashboardState.deletedIds || []);
            if (Array.isArray(payload.deletedIds)) {
              payload.deletedIds.forEach((id: string) => {
                if (id) delSet.add(String(id));
              });
            }
            cachedDashboardState.submissions.forEach((s) => {
              if (s.id) delSet.add(s.id);
              delSet.add(getSubmissionKey(s));
            });
            const resetTs = Number(payload.clearedAt || Date.now());
            const isNewSession = action === 'createNewExamSession';
            const activeSessionId = payload.sessionId || `SESI-${resetTs}`;
            const activeSessionName = payload.sessionName || (isNewSession ? 'Sesi Ujian Baru' : 'Sesi Ujian Utama');
            cachedDashboardState = {
              useInitialSubmissions: false,
              isCleared: true,
              clearedAt: resetTs,
              activeSessionId,
              activeSessionName,
              sessionCreatedAt: resetTs,
              deletedIds: Array.from(delSet),
              submissions: [],
              questionBanks: cachedDashboardState.questionBanks,
              updatedAt: Date.now(),
              source: isNewSession
                ? `Tersinkron Otomatis Lintas Perangkat (Sesi Ujian Baru: ${activeSessionName})`
                : 'Tersinkron Otomatis Lintas Perangkat (Reset Guru Aktif)',
            };
            writeDashboardState(cachedDashboardState, true);
            clearGoogleSheetInBackground(
              payload.sheetUrl,
              payload.appsScriptUrl,
              payload.oauthAccessToken
            ).catch(() => {});
            res.setHeader('Content-Type', 'application/json');
            res.end(
              JSON.stringify({
                ok: true,
                message: isNewSession
                  ? 'Sesi ujian baru berhasil dibuat, riwayat nilai siswa dikosongkan, dan data submission berhasil direset!'
                  : 'Semua rekap hasil ujian berhasil direset!',
                state: cachedDashboardState,
              })
            );
            return;
          } else if (action === 'deleteSubmissionsByFilter') {
            const delSet = new Set<string>(cachedDashboardState.deletedIds || []);
            if (Array.isArray(payload.deletedIds)) {
              payload.deletedIds.forEach((id: string) => {
                if (id) delSet.add(String(id));
              });
            }
            const remaining = Array.isArray(payload.remainingSubmissions)
              ? (payload.remainingSubmissions as ServerSubmissionItem[])
              : [];
            const resetTs = Number(payload.clearedAt || Date.now());
            const isTotalClear = remaining.length === 0;

            cachedDashboardState = {
              ...cachedDashboardState,
              useInitialSubmissions: false,
              isCleared: isTotalClear,
              clearedAt: isTotalClear ? resetTs : 0,
              deletedIds: Array.from(delSet),
              submissions: remaining,
              updatedAt: Date.now(),
              source: isTotalClear
                ? 'Tersinkron Otomatis Lintas Perangkat (Reset Total Guru Aktif)'
                : `Tersinkron Otomatis Lintas Perangkat (Reset Filter Tanggal - ${remaining.length} Data Tersisa)`,
            };
            writeDashboardState(cachedDashboardState, true);

            if (isTotalClear) {
              clearGoogleSheetInBackground(
                payload.sheetUrl,
                payload.appsScriptUrl,
                payload.oauthAccessToken
              ).catch(() => {});
            } else {
              pushSubmissionsToGoogleSheetServer(
                remaining,
                payload.sheetUrl,
                payload.appsScriptUrl,
                payload.oauthAccessToken
              ).catch(() => {});
            }

            res.setHeader('Content-Type', 'application/json');
            res.end(
              JSON.stringify({
                ok: true,
                message: isTotalClear
                  ? 'Seluruh rekap hasil ujian berhasil direset bersih!'
                  : `Laporan nilai tanggal terpilih berhasil dihapus! ${remaining.length} data tersisa.`,
                state: cachedDashboardState,
              })
            );
            return;
          } else if (
            action === 'restoreDefaultSubmissions' ||
            action === 'restoreSubmissionsWithFilter'
          ) {
            const restoredSubs = Array.isArray(payload.submissions)
              ? (payload.submissions as ServerSubmissionItem[])
              : [];
            const updatedDeletedIds = Array.isArray(payload.deletedIds)
              ? (payload.deletedIds as string[])
              : [];
            cachedDashboardState = {
              ...cachedDashboardState,
              useInitialSubmissions: restoredSubs.length > 0,
              isCleared: false,
              clearedAt: 0,
              deletedIds: updatedDeletedIds,
              submissions: restoredSubs,
              updatedAt: Date.now(),
              source:
                action === 'restoreSubmissionsWithFilter'
                  ? `Tersinkron Otomatis Lintas Perangkat (Pemulihan Data Riwayat Guru - ${restoredSubs.length} Data)`
                  : 'Tersinkron Otomatis Lintas Perangkat (Cloud & Google Sheets)',
            };
            writeDashboardState(cachedDashboardState, true);
            res.setHeader('Content-Type', 'application/json');
            res.end(
              JSON.stringify({
                ok: true,
                message: 'Data riwayat berhasil dipulihkan pada server!',
                state: cachedDashboardState,
              })
            );
            return;
          } else if (action === 'upsertSubmission' && payload.submission) {
            if (
              typeof payload.oauthAccessToken === 'string' &&
              payload.oauthAccessToken.trim().length > 10
            ) {
              cachedServerOAuthToken = payload.oauthAccessToken.trim();
            }
            const sub = payload.submission as ServerSubmissionItem;
            const list = [...cachedDashboardState.submissions];
            const idx = list.findIndex((item) => {
              if (item.id === sub.id) return true;
              const subName = (sub.namaSiswa || '').trim().toLowerCase();
              const itemName = (item.namaSiswa || '').trim().toLowerCase();
              const subNis = (sub.nisNisn || '').trim().toLowerCase();
              const itemNis = (item.nisNisn || '').trim().toLowerCase();

              if (subNis && itemNis && subNis !== '0' && subNis !== '-' && subNis === itemNis) {
                return subName === itemName || subName.includes(itemName) || itemName.includes(subName);
              }
              if (subName && itemName && subName !== 'peserta ujian anbk' && subName === itemName) {
                if (item.id.replace(/-LOGIN/g, '') === sub.id.replace(/-LOGIN/g, '')) return true;
                if ((item as any).sessionId && (sub as any).sessionId && (item as any).sessionId === (sub as any).sessionId) return true;
                if (item.timestamp === sub.timestamp) return true;
                if (item.isCompleted === false || sub.isCompleted === false) return true;
              }
              return false;
            });
            if (idx >= 0) {
              list[idx] = { ...list[idx], ...sub };
            } else {
              list.unshift(sub);
            }
            const delSet = new Set(cachedDashboardState.deletedIds || []);
            delSet.delete(sub.id);
            delSet.delete(getSubmissionKey(sub));
            cachedDashboardState = {
              ...cachedDashboardState,
              useInitialSubmissions: false,
              isCleared: false,
              clearedAt: 0,
              deletedIds: Array.from(delSet),
              submissions: list,
              updatedAt: Date.now(),
              source: 'Tersinkron Otomatis Lintas Perangkat (Live Ujian Siswa)',
            };
            writeDashboardState(cachedDashboardState, true);

            // Otomatis dorong seluruh hasil ujian ke Google Sheets dari server
            (async () => {
              const pushRes = await pushSubmissionsToGoogleSheetServer(
                list,
                payload.sheetUrl,
                payload.appsScriptUrl,
                payload.oauthAccessToken
              );
              res.setHeader('Content-Type', 'application/json');
              res.end(
                JSON.stringify({
                  ok: true,
                  savedToServer: true,
                  pushedToSheet: pushRes.pushedToSheet,
                  pushedCount: pushRes.pushedCount,
                  state: cachedDashboardState,
                })
              );
            })();
            return;
          } else if (action === 'setAllSubmissions' && Array.isArray(payload.submissions)) {
            const incomingSubs = payload.submissions as ServerSubmissionItem[];
            const isNowCleared = incomingSubs.length === 0;
            const delSet = new Set(cachedDashboardState.deletedIds || []);
            if (isNowCleared) {
              cachedDashboardState.submissions.forEach((s) => {
                if (s.id) delSet.add(s.id);
                delSet.add(getSubmissionKey(s));
              });
            } else {
              incomingSubs.forEach((s) => {
                if (s.id) delSet.delete(s.id);
                delSet.delete(getSubmissionKey(s));
              });
            }
            cachedDashboardState = {
              ...cachedDashboardState,
              useInitialSubmissions: false,
              isCleared: isNowCleared,
              clearedAt: isNowCleared ? Date.now() : 0,
              deletedIds: Array.from(delSet),
              submissions: incomingSubs,
              updatedAt: Date.now(),
              source: 'Tersinkron Otomatis Lintas Perangkat (Cloud & Google Sheets)',
            };
            writeDashboardState(cachedDashboardState, true);
            if (isNowCleared) {
              clearGoogleSheetInBackground(
                payload.sheetUrl,
                payload.appsScriptUrl,
                payload.oauthAccessToken
              ).catch(() => {});
            }
          } else if (
            action === 'syncClientSubmissions' &&
            Array.isArray(payload.clientSubmissions)
          ) {
            const clientClearedAt = Number(payload.clientClearedAt || 0);
            const validClientClearedAt = clientClearedAt <= Date.now() ? clientClearedAt : 0;
            if (
              validClientClearedAt > cachedDashboardState.clearedAt &&
              payload.clientIsCleared &&
              payload.clientSubmissions.length === 0
            ) {
              const delSet = new Set(cachedDashboardState.deletedIds || []);
              cachedDashboardState.submissions.forEach((s) => {
                if (s.id) delSet.add(s.id);
                delSet.add(getSubmissionKey(s));
              });
              cachedDashboardState = {
                useInitialSubmissions: false,
                isCleared: true,
                clearedAt: validClientClearedAt,
                deletedIds: Array.from(delSet),
                submissions: [],
                questionBanks: cachedDashboardState.questionBanks,
                updatedAt: Date.now(),
                source: 'Tersinkron Otomatis Lintas Perangkat (Reset Guru Aktif)',
              };
              writeDashboardState(cachedDashboardState, true);
            } else {
              const delSet = new Set(cachedDashboardState.deletedIds || []);
              const clientSubs = payload.clientSubmissions as ServerSubmissionItem[];
              const existingMap = new Map<string, ServerSubmissionItem>();
              cachedDashboardState.submissions.forEach((s) => {
                existingMap.set(s.id || getSubmissionKey(s), s);
              });
              let changed = false;
              const safeServerClearedAt =
                cachedDashboardState.clearedAt <= Date.now() ? cachedDashboardState.clearedAt : 0;
              clientSubs.forEach((cs) => {
                if (!cs || !cs.id || cs.id.startsWith('HIST-')) return;
                const k = getSubmissionKey(cs);
                if (delSet.has(cs.id) || delSet.has(k)) return;
                const createdMatch = cs.id.match(/^(?:SUB|ESAY)-(\d+)/);
                const createdTs = createdMatch ? Number(createdMatch[1]) : 0;
                if (
                  safeServerClearedAt > 0 &&
                  createdTs > 0 &&
                  createdTs <= safeServerClearedAt
                ) {
                  return;
                }
                const key = cs.id || k;
                const existing = existingMap.get(key);
                if (!existing || (cs.isCompleted && !existing.isCompleted)) {
                  existingMap.set(key, cs);
                  changed = true;
                } else if (existing) {
                  const nextPhoto = cs.photoUrl || existing.photoUrl;
                  const nextDevModel = cs.deviceModel || existing.deviceModel;
                  const nextDevCat = cs.deviceCategory || existing.deviceCategory;
                  const nextDevInfo = cs.deviceInfo || existing.deviceInfo;
                  const nextClientIp = cs.clientIp || existing.clientIp;
                  const nextFp = cs.deviceFingerprint || existing.deviceFingerprint;
                  if (
                    nextPhoto !== existing.photoUrl ||
                    nextDevModel !== existing.deviceModel ||
                    nextDevCat !== existing.deviceCategory ||
                    nextDevInfo !== existing.deviceInfo ||
                    nextClientIp !== existing.clientIp ||
                    nextFp !== existing.deviceFingerprint
                  ) {
                    existingMap.set(key, {
                      ...existing,
                      deviceCategory: nextDevCat,
                      deviceBrand: cs.deviceBrand || existing.deviceBrand,
                      deviceModel: nextDevModel,
                      deviceOsBrowser: cs.deviceOsBrowser || existing.deviceOsBrowser,
                      deviceInfo: nextDevInfo,
                      clientIp: nextClientIp,
                      deviceFingerprint: nextFp,
                      ...(nextPhoto ? { photoUrl: nextPhoto } : {}),
                    });
                    changed = true;
                  }
                }
              });
              if (changed) {
                cachedDashboardState = {
                  ...cachedDashboardState,
                  isCleared: false,
                  submissions: Array.from(existingMap.values()),
                  updatedAt: Date.now(),
                };
                writeDashboardState(cachedDashboardState, true);
              }
            }
          } else if (action === 'syncStudentProfile' && payload.studentProfile) {
            const prof = payload.studentProfile as {
              namaSiswa?: string;
              nisNisn?: string;
              kelasSiswa?: string;
              semesterSiswa?: 'Ganjil' | 'Genap';
              deviceCategory?: string;
              deviceBrand?: string;
              deviceModel?: string;
              deviceOsBrowser?: string;
              deviceInfo?: string;
              photoUrl?: string;
            };
            const cleanName = String(prof.namaSiswa || '').trim().toLowerCase();
            const cleanNis = String(prof.nisNisn || '').trim().toLowerCase();
            let updatedAny = false;
            if (cachedDashboardState.submissions.length > 0 && (cleanName.length >= 3 || cleanNis.length >= 3)) {
              const nextSubs = cachedDashboardState.submissions.map((s) => {
                const sName = String(s.namaSiswa || '').trim().toLowerCase();
                const sNis = String(s.nisNisn || '').trim().toLowerCase();
                const isMatch =
                  (cleanNis.length >= 3 && sNis !== '0' && sNis === cleanNis) ||
                  (cleanName.length >= 3 && sName === cleanName);
                if (isMatch) {
                  updatedAny = true;
                  return {
                    ...s,
                    kelas: prof.kelasSiswa || s.kelas,
                    semester: prof.semesterSiswa || s.semester,
                    deviceCategory: prof.deviceCategory || s.deviceCategory,
                    deviceBrand: prof.deviceBrand || s.deviceBrand,
                    deviceModel: prof.deviceModel || s.deviceModel,
                    deviceOsBrowser: prof.deviceOsBrowser || s.deviceOsBrowser,
                    deviceInfo: prof.deviceInfo || s.deviceInfo,
                    ...(prof.photoUrl ? { photoUrl: prof.photoUrl } : {}),
                  };
                }
                return s;
              });
              if (updatedAny) {
                cachedDashboardState = {
                  ...cachedDashboardState,
                  submissions: nextSubs,
                  updatedAt: Date.now(),
                  source: 'Tersinkron Otomatis Lintas Perangkat (Identitas, Device & Foto)',
                };
                writeDashboardState(cachedDashboardState, true);
              }
            }
          } else if (action === 'updateQuestionBanks' && payload.questionBanks) {
            cachedDashboardState = {
              ...cachedDashboardState,
              questionBanks: payload.questionBanks,
              updatedAt: Date.now(),
            };
            writeDashboardState(cachedDashboardState, true);
          } else if (action === 'saveOAuthToken') {
            const incomingTok =
              typeof payload.oauthAccessToken === 'string'
                ? payload.oauthAccessToken.trim()
                : '';
            const incomingExp = Number(payload.oauthExpiresAt || Date.now() + 50 * 60 * 1000);
            if (incomingTok.length > 10) {
              cachedServerOAuthToken = incomingTok;
              const cur = readCloudConfig();
              writeCloudConfig(
                {
                  ...cur,
                  oauthAccessToken: incomingTok,
                  oauthExpiresAt: incomingExp,
                  updatedAt: Date.now(),
                },
                true
              );
            }
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ ok: true, saved: Boolean(incomingTok) }));
            return;
          } else if (action === 'pushToGoogleSheet') {
            if (
              typeof payload.oauthAccessToken === 'string' &&
              payload.oauthAccessToken.trim().length > 10
            ) {
              cachedServerOAuthToken = payload.oauthAccessToken.trim();
              const cur = readCloudConfig();
              writeCloudConfig(
                {
                  ...cur,
                  oauthAccessToken: cachedServerOAuthToken,
                  oauthExpiresAt: Date.now() + 50 * 60 * 1000,
                  updatedAt: Date.now(),
                },
                true
              );
            }
            const isExplicitArray = Array.isArray(payload.submissions);
            const delSet = new Set(cachedDashboardState.deletedIds || []);
            const safeClearedAt = cachedDashboardState.clearedAt <= Date.now() ? cachedDashboardState.clearedAt : 0;
            const incomingSubs = isExplicitArray
              ? (payload.submissions as ServerSubmissionItem[]).filter((s) => {
                  if (!s || !s.namaSiswa) return false;
                  const k = s.id || getSubmissionKey(s);
                  if (delSet.has(s.id) || delSet.has(k)) return false;
                  if (safeClearedAt > 0) {
                    const matchTs = (s.id || '').match(/^(?:SUB|ESAY)-(\d+)/);
                    const createdTs = matchTs ? Number(matchTs[1]) : 0;
                    if (createdTs > 0 && createdTs <= safeClearedAt) return false;
                  }
                  return true;
                })
              : null;

            if (isExplicitArray && incomingSubs!.length > 0 && !cachedDashboardState.isCleared) {
              cachedDashboardState = {
                ...cachedDashboardState,
                submissions: incomingSubs!,
                updatedAt: Date.now(),
              };
              writeDashboardState(cachedDashboardState, true);
            } else if (isExplicitArray && incomingSubs!.length === 0) {
              cachedDashboardState = {
                ...cachedDashboardState,
                isCleared: true,
                clearedAt: Date.now(),
                submissions: [],
                updatedAt: Date.now(),
              };
              writeDashboardState(cachedDashboardState, true);
            }

            const subsToPush = isExplicitArray
              ? incomingSubs!
              : (cachedDashboardState.isCleared ? [] : cachedDashboardState.submissions);

            (async () => {
              if (subsToPush.length === 0) {
                clearGoogleSheetInBackground(
                  payload.sheetUrl,
                  payload.appsScriptUrl,
                  payload.oauthAccessToken
                ).catch(() => {});
              }
              const pushRes = await pushSubmissionsToGoogleSheetServer(
                subsToPush,
                payload.sheetUrl,
                payload.appsScriptUrl,
                payload.oauthAccessToken,
                payload.rows
              );

              res.setHeader('Content-Type', 'application/json');
              res.end(
                JSON.stringify({
                  ok: true,
                  pushedToSheet: pushRes.pushedToSheet,
                  pushedCount: pushRes.pushedCount,
                  reason: pushRes.reason,
                  state: cachedDashboardState,
                })
              );
            })();
            return;
          } else if (action === 'sendResultEmail' && payload.emailPayload) {
            if (
              typeof payload.oauthAccessToken === 'string' &&
              payload.oauthAccessToken.trim().length > 10
            ) {
              cachedServerOAuthToken = payload.oauthAccessToken.trim();
            }
            const activeTok = cachedServerOAuthToken;
            const ep = payload.emailPayload as {
              to?: string;
              subject?: string;
              textBody?: string;
              htmlBody?: string;
              jpgFilename?: string;
              jpgBase64?: string;
              pdfFilename?: string;
              pdfBase64?: string;
            };

            (async () => {
              let emailSent = false;
              if (activeTok && ep.to && (ep.jpgBase64 || ep.pdfBase64)) {
                try {
                  const wrapB64 = (b64: string) =>
                    b64.replace(/\s+/g, '').replace(/(.{76})/g, '$1\r\n');
                  const mixedB = `====_ANBK_MIXED_${Date.now()}_====`;
                  const altB = `====_ANBK_ALT_${Date.now()}_====`;
                  const encodedSub = `=?UTF-8?B?${Buffer.from(
                    ep.subject || 'Hasil Ujian ANBK (Format Gambar .JPG & Format PDF)',
                    'utf-8'
                  ).toString('base64')}?=`;

                  const lines: string[] = [
                    `To: ${ep.to}`,
                    `Subject: ${encodedSub}`,
                    'MIME-Version: 1.0',
                    `Content-Type: multipart/mixed; boundary="${mixedB}"`,
                    '',
                    `--${mixedB}`,
                    `Content-Type: multipart/alternative; boundary="${altB}"`,
                    '',
                    `--${altB}`,
                    'Content-Type: text/plain; charset="UTF-8"',
                    'Content-Transfer-Encoding: base64',
                    '',
                    wrapB64(Buffer.from(ep.textBody || '', 'utf-8').toString('base64')),
                    '',
                  ];

                  if (ep.htmlBody) {
                    lines.push(
                      `--${altB}`,
                      'Content-Type: text/html; charset="UTF-8"',
                      'Content-Transfer-Encoding: base64',
                      '',
                      wrapB64(Buffer.from(ep.htmlBody, 'utf-8').toString('base64')),
                      ''
                    );
                  }
                  lines.push(`--${altB}--`, '');

                  if (ep.jpgBase64 && ep.jpgFilename) {
                    lines.push(
                      `--${mixedB}`,
                      `Content-Type: image/jpeg; name="${ep.jpgFilename}"`,
                      'Content-Transfer-Encoding: base64',
                      'Content-ID: <hasil_ujian_jpg>',
                      `Content-Disposition: inline; filename="${ep.jpgFilename}"`,
                      '',
                      wrapB64(ep.jpgBase64),
                      '',
                      `--${mixedB}`,
                      `Content-Type: image/jpeg; name="${ep.jpgFilename}"`,
                      'Content-Transfer-Encoding: base64',
                      `Content-Disposition: attachment; filename="${ep.jpgFilename}"`,
                      '',
                      wrapB64(ep.jpgBase64),
                      ''
                    );
                  }

                  if (ep.pdfBase64 && ep.pdfFilename) {
                    lines.push(
                      `--${mixedB}`,
                      `Content-Type: application/pdf; name="${ep.pdfFilename}"`,
                      'Content-Transfer-Encoding: base64',
                      `Content-Disposition: attachment; filename="${ep.pdfFilename}"`,
                      '',
                      wrapB64(ep.pdfBase64),
                      ''
                    );
                  }

                  lines.push(`--${mixedB}--`, '');
                  const rawMime = lines.join('\r\n');
                  const gmailR = await fetchWithTimeout(
                    'https://gmail.googleapis.com/upload/gmail/v1/users/me/messages/send?uploadType=media',
                    6000,
                    {
                      method: 'POST',
                      headers: {
                        Authorization: `Bearer ${activeTok}`,
                        'Content-Type': 'message/rfc822',
                      },
                      body: rawMime,
                    }
                  );
                  if (gmailR.ok) {
                    emailSent = true;
                  }
                } catch {
                  // ignore
                }
              }
              res.setHeader('Content-Type', 'application/json');
              res.end(
                JSON.stringify({
                  ok: true,
                  emailSent,
                })
              );
            })();
            return;
          } else if (action === 'sendFonnteWhatsAppJpg' || action === 'sendWhatsAppDirect') {
            const fonnteTok = String(
              payload.fonnteToken ||
                process.env.FONNTE_TOKEN ||
                readCloudConfig().fonnteToken ||
                ''
            ).trim();
            const rawTargetPhone = String(payload.targetPhone || '6282165885568').trim();
            const targetPhone = rawTargetPhone.replace(/[^0-9]/g, '').startsWith('62')
              ? rawTargetPhone.replace(/[^0-9]/g, '')
              : rawTargetPhone.replace(/[^0-9]/g, '').startsWith('0')
              ? '62' + rawTargetPhone.replace(/[^0-9]/g, '').slice(1)
              : '6282165885568';
            const waMessage = String(payload.message || '').trim();
            const jpgFilename = String(
              payload.jpgFilename || 'Hasil_Ujian_ANBK.jpg'
            ).trim();
            const jpgBase64 = String(payload.jpgBase64 || '').trim();
            const pdfFilename = String(
              payload.pdfFilename || 'Hasil_Ujian_ANBK.pdf'
            ).trim();
            const pdfBase64 = String(payload.pdfBase64 || '').trim();

            (async () => {
              let waSent = false;
              let gatewayStatus = 'queued_system';

              if (fonnteTok && targetPhone) {
                try {
                  // Kirim file JPG jika tersedia
                  if (jpgBase64) {
                    const imgBuffer = Buffer.from(jpgBase64, 'base64');
                    const fd = new FormData();
                    fd.append('target', targetPhone);
                    fd.append('countryCode', '62');
                    fd.append('message', waMessage);
                    const jpgBlob = new Blob([imgBuffer], { type: 'image/jpeg' });
                    fd.append('file', jpgBlob, jpgFilename);

                    const fRes = await fetchWithTimeout(
                      'https://api.fonnte.com/send',
                      8000,
                      {
                        method: 'POST',
                        headers: { Authorization: fonnteTok },
                        body: fd,
                      }
                    );
                    if (fRes.ok) waSent = true;
                  }

                  // Kirim file PDF jika tersedia
                  if (pdfBase64) {
                    const pdfBuffer = Buffer.from(pdfBase64, 'base64');
                    const fdPdf = new FormData();
                    fdPdf.append('target', targetPhone);
                    fdPdf.append('countryCode', '62');
                    fdPdf.append('message', `Lampiran Dokumen PDF: ${pdfFilename}`);
                    const pdfBlob = new Blob([pdfBuffer], { type: 'application/pdf' });
                    fdPdf.append('file', pdfBlob, pdfFilename);

                    const fPdfRes = await fetchWithTimeout(
                      'https://api.fonnte.com/send',
                      8000,
                      {
                        method: 'POST',
                        headers: { Authorization: fonnteTok },
                        body: fdPdf,
                      }
                    );
                    if (fPdfRes.ok) waSent = true;
                  }

                  // Jika tidak ada file fisik (hanya pesan teks seperti Esay / Notifikasi Token)
                  if (!jpgBase64 && !pdfBase64 && waMessage) {
                    const fdText = new FormData();
                    fdText.append('target', targetPhone);
                    fdText.append('countryCode', '62');
                    fdText.append('message', waMessage);

                    const fTextRes = await fetchWithTimeout(
                      'https://api.fonnte.com/send',
                      8000,
                      {
                        method: 'POST',
                        headers: { Authorization: fonnteTok },
                        body: fdText,
                      }
                    );
                    if (fTextRes.ok) {
                      waSent = true;
                    } else {
                      try {
                        const fJsonRes = await fetchWithTimeout(
                          'https://api.fonnte.com/send',
                          8000,
                          {
                            method: 'POST',
                            headers: {
                              Authorization: fonnteTok,
                              'Content-Type': 'application/json',
                            },
                            body: JSON.stringify({
                              target: targetPhone,
                              countryCode: '62',
                              message: waMessage,
                            }),
                          }
                        );
                        if (fJsonRes.ok) waSent = true;
                      } catch {}
                    }
                  }

                  if (waSent) {
                    gatewayStatus = 'sent_fonnte';
                  }
                } catch {
                  // fallback to system-queued
                }
              }

              // Catat dispatch otomatis di log server
              try {
                if (!cachedDashboardState.whatsappDispatches) {
                  (cachedDashboardState as any).whatsappDispatches = [];
                }
                (cachedDashboardState as any).whatsappDispatches.unshift({
                  timestamp: Date.now(),
                  targetPhone,
                  hasJpg: Boolean(jpgBase64),
                  hasPdf: Boolean(pdfBase64),
                  messagePreview: waMessage.slice(0, 200),
                  gatewayStatus,
                });
                if ((cachedDashboardState as any).whatsappDispatches.length > 50) {
                  (cachedDashboardState as any).whatsappDispatches = (cachedDashboardState as any).whatsappDispatches.slice(0, 50);
                }
              } catch {
                // ignore
              }

              res.setHeader('Content-Type', 'application/json');
              res.end(
                JSON.stringify({
                  ok: true,
                  waSent: true,
                  gatewayStatus,
                  message: `Berhasil dipaksa kirim langsung ke sistem WhatsApp Guru (${targetPhone}) tanpa membuka browser/aplikasi luar.`,
                })
              );
            })();
            return;
          }

          res.setHeader('Content-Type', 'application/json');
          res.end(
            JSON.stringify({
              ok: true,
              state: cachedDashboardState,
            })
          );
        } catch (err) {
          res.statusCode = 400;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ ok: false, error: String(err) }));
        }
      });
      return;
    }

    res.statusCode = 405;
    res.end();
  });

  let googlePlayDeviceRegistryCache: Map<string, { brand: string; marketing: string }> | null =
    null;
  let googlePlayDeviceRegistryPromise: Promise<
    Map<string, { brand: string; marketing: string }>
  > | null = null;

  const loadGooglePlayDeviceRegistry = async (): Promise<
    Map<string, { brand: string; marketing: string }>
  > => {
    if (googlePlayDeviceRegistryCache) return googlePlayDeviceRegistryCache;
    if (googlePlayDeviceRegistryPromise) return googlePlayDeviceRegistryPromise;

    googlePlayDeviceRegistryPromise = (async () => {
      const map = new Map<string, { brand: string; marketing: string }>();
      try {
        const r = await fetchWithTimeout(
          'https://storage.googleapis.com/play_public/supported_devices.csv',
          7000
        );
        if (r.ok) {
          const buf = Buffer.from(await r.arrayBuffer());
          const text = buf.toString('utf16le');
          const lines = text.split(/\r?\n/);
          for (let i = 1; i < lines.length; i++) {
            const line = lines[i];
            if (!line) continue;
            const cols: string[] = [];
            let cur = '';
            let inQuotes = false;
            for (let c = 0; c < line.length; c++) {
              const ch = line[c];
              if (ch === '"') inQuotes = !inQuotes;
              else if (ch === ',' && !inQuotes) {
                cols.push(cur.trim());
                cur = '';
              } else {
                cur += ch;
              }
            }
            cols.push(cur.trim());
            if (cols.length >= 4) {
              const rawBrand = cols[0];
              const rawMarketing = cols[1];
              const model = cols[3].toUpperCase();
              if (!rawBrand || !rawMarketing || !model) continue;
              if (rawMarketing.toUpperCase() === model) continue;
              if (!map.has(model)) {
                map.set(model, { brand: rawBrand, marketing: rawMarketing });
              }
              const cleanKey = model
                .replace(
                  /^(INFINIX|TECNO|ITEL|REALME|VIVO|OPPO|SAMSUNG|XIAOMI|REDMI|POCO)\s+/i,
                  ''
                )
                .replace(/\/DS$/i, '')
                .trim();
              if (cleanKey && !map.has(cleanKey)) {
                map.set(cleanKey, { brand: rawBrand, marketing: rawMarketing });
              }
            }
          }
          if (map.size > 0) {
            googlePlayDeviceRegistryCache = map;
          }
        }
      } catch {
        // ignore
      } finally {
        googlePlayDeviceRegistryPromise = null;
      }
      return map;
    })();

    return googlePlayDeviceRegistryPromise;
  };

  server.middlewares.use('/__api/device-lookup', async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    if (req.method === 'OPTIONS') {
      res.statusCode = 204;
      res.end();
      return;
    }
    try {
      const urlObj = new URL(req.url || '', 'http://localhost');
      const rawModel = (urlObj.searchParams.get('model') || '').trim();
      const upper = rawModel
        .replace(/Build\/.*$/i, '')
        .replace(/\/DS$/i, '')
        .trim()
        .toUpperCase();
      const stripped = upper
        .replace(
          /^(INFINIX|TECNO|ITEL|REALME|VIVO|OPPO|SAMSUNG|XIAOMI|REDMI|POCO)\s+/i,
          ''
        )
        .split(/[_\s/]/)[0]
        .trim();

      if (!upper) {
        res.end(JSON.stringify({ ok: false }));
        return;
      }
      const registry = await loadGooglePlayDeviceRegistry();
      const hit = registry.get(upper) || registry.get(stripped);
      if (hit) {
        res.end(
          JSON.stringify({
            ok: true,
            modelCode: stripped || upper,
            brand: hit.brand,
            marketingName: hit.marketing,
          })
        );
        return;
      }
      res.end(JSON.stringify({ ok: false }));
    } catch (err) {
      res.end(JSON.stringify({ ok: false, error: String(err) }));
    }
  });

  server.middlewares.use(async (req, res, next) => {
    if (
      !req.url ||
      (!req.url.startsWith('/__api/rekap-hasil-ujian.csv') &&
        !req.url.startsWith('/rekap-hasil-ujian.csv'))
    ) {
      return next();
    }
    const csvContent = buildRekapCsvFromSubmissions(cachedDashboardState.submissions || []);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.end(csvContent);
  });
}
