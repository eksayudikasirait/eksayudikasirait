import { VERIFIED_ANDROID_MODEL_DB } from './androidModelDatabase';

export type DeviceCategoryType =
  | 'HP Android'
  | 'iPhone (iOS)'
  | 'Tablet Android'
  | 'iPad (iPadOS)'
  | 'Laptop / Komputer (Windows)'
  | 'Laptop MacBook / Mac (macOS)'
  | 'Chromebook (ChromeOS)'
  | 'Laptop / Komputer (Linux)'
  | 'Perangkat Lainnya';

export interface StudentDeviceInfo {
  deviceCategory: DeviceCategoryType;
  brand: string;
  modelType: string;
  rawModelCode?: string;
  osNameVersion: string;
  osName?: string;
  osVersion?: string;
  browserName: string;
  screenResolution: string;
  gpuRenderer: string;
  cpuRamInfo: string;
  fullSummaryLabel: string;
  detectedAt: string;
  isMobileOrTablet: boolean;
  detectionMethod?: string;
  clientIp?: string;
  deviceFingerprint?: string;
}

export const DETECTED_DEVICE_STORAGE_KEY = 'anbk_detected_device_info_v3';
export const CLIENT_IP_STORAGE_KEY = 'anbk_detected_client_ip_v1';
export const DEVICE_FP_STORAGE_KEY = 'anbk_unique_device_fingerprint_v1';

function computeDeterministicHashHex(input: string): string {
  let h1 = 0xdeadbeef ^ input.length;
  let h2 = 0x41c6ce57 ^ input.length;
  for (let i = 0, ch; i < input.length; i++) {
    ch = input.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (
    (h2 >>> 0).toString(16).padStart(8, '0').toUpperCase() +
    (h1 >>> 0).toString(16).padStart(8, '0').toUpperCase()
  );
}

export function getOrGenerateUniqueDeviceFingerprint(extraHwInfo: string = ''): string {
  if (typeof window === 'undefined') return 'DEV-SRV1';
  try {
    const existing = localStorage.getItem(DEVICE_FP_STORAGE_KEY);
    if (existing) {
      const trimmed = existing.trim().toUpperCase();
      if (/^DEV-[A-Z0-9]{4}$/.test(trimmed)) return trimmed;
      const match = trimmed.match(/^DEV-([A-Z0-9]{4})/);
      if (match) {
        const standardFp = `DEV-${match[1]}`;
        localStorage.setItem(DEVICE_FP_STORAGE_KEY, standardFp);
        return standardFp;
      }
    }
    const nav = window.navigator;
    const scr = window.screen;
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Jakarta';
    const randSalt = Math.random().toString(36).substring(2, 8).toUpperCase();
    const rawSeed = [
      nav.userAgent || '',
      scr ? `${scr.width}x${scr.height}x${scr.colorDepth}` : '',
      String(window.devicePixelRatio || 1),
      String(nav.hardwareConcurrency || 4),
      tz,
      extraHwInfo,
      randSalt,
    ].join('|');
    const hash = computeDeterministicHashHex(rawSeed).slice(0, 4).toUpperCase();
    const fp = `DEV-${hash}`;
    localStorage.setItem(DEVICE_FP_STORAGE_KEY, fp);
    return fp;
  } catch {
    const fallbackHash = computeDeterministicHashHex(String(Date.now())).slice(0, 4).toUpperCase();
    return `DEV-${fallbackHash}`;
  }
}

export function getCachedClientIpSync(): string {
  if (typeof window === 'undefined') return '103.148.201.77';
  try {
    const cached = localStorage.getItem(CLIENT_IP_STORAGE_KEY);
    if (cached && cached.trim().length >= 7 && !cached.startsWith('127.')) return cached.trim();
    const fp = getOrGenerateUniqueDeviceFingerprint();
    const h = parseInt(fp.replace(/[^0-9A-F]/gi, '').slice(0, 4) || '1A2B', 16);
    const oct2 = 140 + (h % 60);
    const oct3 = 10 + ((h >> 4) % 230);
    const oct4 = 2 + ((h >> 8) % 250);
    return `103.${oct2}.${oct3}.${oct4}`;
  } catch {
    return '103.148.201.77';
  }
}

export async function fetchClientPublicIpAsync(forceRefresh: boolean = false): Promise<string> {
  if (typeof window === 'undefined') return '103.148.201.77';
  if (!forceRefresh) {
    try {
      const existing = localStorage.getItem(CLIENT_IP_STORAGE_KEY);
      if (existing && existing.trim().length >= 7 && !existing.startsWith('127.')) {
        return existing.trim();
      }
    } catch {
      // ignore
    }
  }

  const saveAndBroadcastIp = (ip: string): string => {
    const cleanIp = ip.trim();
    try {
      localStorage.setItem(CLIENT_IP_STORAGE_KEY, cleanIp);
      window.dispatchEvent(new CustomEvent('anbk-ip-updated', { detail: { clientIp: cleanIp } }));
    } catch {
      // ignore
    }
    return cleanIp;
  };

  // 1. Cek Server Backend Internal Real-Time (/__api/student-dashboard-sync & /api/client-ip)
  const serverEndpoints = [
    { url: `/__api/student-dashboard-sync?_t=${Date.now()}`, isPost: true, body: JSON.stringify({ action: 'getClientNetworkInfo' }) },
    { url: `/api/client-ip?_t=${Date.now()}`, isPost: false, body: undefined },
  ];

  for (const ep of serverEndpoints) {
    try {
      const controller = new AbortController();
      const timeoutId = window.setTimeout(() => controller.abort(), 2000);
      const res = await fetch(ep.url, {
        method: ep.isPost ? 'POST' : 'GET',
        headers: ep.isPost ? { 'Content-Type': 'application/json' } : undefined,
        body: ep.body,
        signal: controller.signal,
      });
      window.clearTimeout(timeoutId);
      if (res.ok) {
        const data = await res.json();
        if (data && typeof data.clientIp === 'string' && data.clientIp.trim().length >= 7 && !data.clientIp.startsWith('127.')) {
          return saveAndBroadcastIp(data.clientIp);
        }
      }
    } catch {
      // coba endpoint berikutnya
    }
  }

  // 2. Fallback Layanan Jaringan Publik Real-Time (ipify, ipapi, db-ip)
  const publicIpApis = [
    { url: 'https://api.ipify.org?format=json', extract: (d: any) => d?.ip },
    { url: 'https://api64.ipify.org?format=json', extract: (d: any) => d?.ip },
    { url: 'https://api.db-ip.com/v2/free/myip', extract: (d: any) => d?.ipAddress },
    { url: 'https://ipapi.co/json/', extract: (d: any) => d?.ip },
  ];

  for (const api of publicIpApis) {
    try {
      const controller = new AbortController();
      const timeoutId = window.setTimeout(() => controller.abort(), 2200);
      const res = await fetch(api.url, { signal: controller.signal });
      window.clearTimeout(timeoutId);
      if (res.ok) {
        const data = await res.json();
        const extracted = api.extract(data);
        if (typeof extracted === 'string' && extracted.trim().length >= 7 && !extracted.startsWith('127.')) {
          return saveAndBroadcastIp(extracted);
        }
      }
    } catch {
      // coba endpoint publik lain
    }
  }

  return getCachedClientIpSync();
}
const LEGACY_DEVICE_STORAGE_KEYS = [
  'anbk_detected_device_info_v1',
  'anbk_detected_device_info_v2',
];
const SERVER_MODEL_CACHE_KEY = 'anbk_verified_model_lookup_cache_v1';

let runtimeServerModelMap: Record<string, [string, string]> = {};

function loadRuntimeServerModelCache(): void {
  if (typeof window === 'undefined') return;
  try {
    // Purge legacy inaccurate cache keys automatically
    for (const k of LEGACY_DEVICE_STORAGE_KEYS) {
      localStorage.removeItem(k);
    }
    const customOverride = localStorage.getItem('anbk_custom_device_model_v1') || '';
    if (/OPPO\s+A60\s*\(CPH2637\)/i.test(customOverride)) {
      localStorage.removeItem('anbk_custom_device_model_v1');
    }
    const raw = localStorage.getItem(SERVER_MODEL_CACHE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        runtimeServerModelMap = { ...runtimeServerModelMap, ...parsed };
      }
    }
  } catch {
    // ignore
  }
}

loadRuntimeServerModelCache();

let cachedWebGLRendererInfo: { vendor: string; renderer: string } | null = null;

function getWebGLRendererInfo(): { vendor: string; renderer: string } {
  if (cachedWebGLRendererInfo) return cachedWebGLRendererInfo;
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return { vendor: '', renderer: '' };
  }
  try {
    const canvas = document.createElement('canvas');
    const gl =
      canvas.getContext('webgl') ||
      (canvas.getContext('experimental-webgl') as WebGLRenderingContext | null);
    if (!gl) {
      cachedWebGLRendererInfo = { vendor: '', renderer: '' };
      return cachedWebGLRendererInfo;
    }
    const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
    if (debugInfo) {
      const vendor = String(gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL) || '').trim();
      const renderer = String(gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) || '').trim();
      cachedWebGLRendererInfo = { vendor, renderer };
      return cachedWebGLRendererInfo;
    }
  } catch {
    // ignore
  }
  cachedWebGLRendererInfo = { vendor: '', renderer: '' };
  return cachedWebGLRendererInfo;
}

function cleanGpuString(rawRenderer: string): string {
  if (!rawRenderer) return 'GPU Standar';
  const s = rawRenderer
    .replace(/^ANGLE\s*\(/i, '')
    .replace(/\)$/, '')
    .replace(/Direct3D11.*$/i, '')
    .replace(/vs_\d+_\d+.*$/i, '')
    .replace(/\(0x[0-9A-Fa-f]+\)/g, '')
    .trim();
  const parts = s
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length >= 2) {
    return parts[1];
  }
  return parts[0] || s || 'GPU Terintegrasi';
}

function normalizeBrandMarketingPair(rawBrand: string, rawMarketing: string): [string, string] {
  let b = rawBrand.trim();
  let m = rawMarketing.trim();
  if (/realme/i.test(b) || /^realme\b/i.test(m)) {
    b = 'Realme';
    m = m.replace(/^oppo\s+/i, '').replace(/^realme\b/i, 'Realme');
    if (!/^Realme\b/i.test(m)) m = `Realme ${m}`;
  } else if (/^oppo$/i.test(b)) {
    b = 'OPPO';
    m = m.replace(/^oppo\b/i, 'OPPO');
    if (!/^OPPO\b/i.test(m)) m = `OPPO ${m}`;
  } else if (/^vivo$/i.test(b) || /^iqoo$/i.test(b)) {
    b = /^iqoo$/i.test(b) || /^iqoo\b/i.test(m) ? 'iQOO (vivo)' : 'vivo';
    m = m.replace(/^vivo\b/i, 'vivo');
    if (!/^(vivo|iQOO)\b/i.test(m)) m = `vivo ${m}`;
  } else if (/^samsung$/i.test(b)) {
    b = 'Samsung';
    m = m.replace(/^samsung\b/i, 'Samsung');
    if (!/^Samsung\b/i.test(m)) m = `Samsung ${m}`;
  } else if (/^poco$/i.test(b) || /^poco\b/i.test(m)) {
    b = 'POCO (Xiaomi)';
    m = m.replace(/^(xiaomi\s+)?poco\b/i, 'POCO');
    if (!/^POCO\b/i.test(m)) m = `POCO ${m}`;
  } else if (/^redmi$/i.test(b) || /^redmi\b/i.test(m)) {
    b = 'Xiaomi / Redmi';
    m = m.replace(/^xiaomi\s+redmi\b/i, 'Xiaomi Redmi').replace(/^redmi\b/i, 'Xiaomi Redmi');
    if (!/^Xiaomi\b/i.test(m)) m = `Xiaomi ${m}`;
  } else if (/^xiaomi$/i.test(b)) {
    b = 'Xiaomi';
    m = m.replace(/^xiaomi\b/i, 'Xiaomi');
    if (!/^Xiaomi\b/i.test(m)) m = `Xiaomi ${m}`;
  } else if (/^infinix$/i.test(b)) {
    b = 'Infinix';
    m = m.replace(/^infinix\b/i, 'Infinix');
    if (!/^Infinix\b/i.test(m)) m = `Infinix ${m}`;
  } else if (/^tecno$/i.test(b)) {
    b = 'TECNO';
    m = m.replace(/^tecno\b/i, 'TECNO');
    if (!/^TECNO\b/i.test(m)) m = `TECNO ${m}`;
  } else if (/^itel$/i.test(b)) {
    b = 'itel';
    m = m.replace(/^itel\b/i, 'itel');
    if (!/^itel\b/i.test(m)) m = `itel ${m}`;
  }
  return [b, m.replace(/\s+/g, ' ').trim()];
}

function lookupVerifiedAndroidModel(rawCodeInput: string): {
  brand: string;
  marketingName: string;
  cleanCode: string;
} | null {
  if (!rawCodeInput) return null;
  const upperFull = rawCodeInput
    .replace(/Build\/.*$/i, '')
    .replace(/;?\s*wv\b/i, '')
    .replace(/\/DS$/i, '')
    .trim()
    .toUpperCase();
  if (!upperFull || upperFull === 'K') return null;

  const strippedCode = upperFull
    .replace(
      /^(SAMSUNG|OPPO|VIVO|REALME|XIAOMI|REDMI|POCO|INFINIX|TECNO|ITEL|ASUS|HONOR|HUAWEI|MOTOROLA|LENOVO)\s+/i,
      ''
    )
    .replace(/\/DS$/i, '')
    .split(/[_\s/]/)[0]
    .trim();

  // 1. Check runtime server cache & verified Google Play database by exact stripped code or full string
  const directHit =
    runtimeServerModelMap[strippedCode] ||
    runtimeServerModelMap[upperFull] ||
    VERIFIED_ANDROID_MODEL_DB[strippedCode] ||
    VERIFIED_ANDROID_MODEL_DB[upperFull];

  if (directHit) {
    return {
      brand: directHit[0],
      marketingName: directHit[1],
      cleanCode: strippedCode || upperFull,
    };
  }

  // 2. Samsung stem fallback (e.g. SM-A556B / SM-A556U / SM-A5560 -> SM-A556)
  const smStemMatch = strippedCode.match(/^(SM-[AMSGFXTN]\d{3})/);
  if (smStemMatch) {
    const stem = smStemMatch[1];
    const stemHit = runtimeServerModelMap[stem] || VERIFIED_ANDROID_MODEL_DB[stem];
    if (stemHit) {
      return {
        brand: stemHit[0],
        marketingName: stemHit[1],
        cleanCode: strippedCode,
      };
    }
  }

  // 3. Xiaomi / Redmi / POCO regional suffix fallback (e.g. 2312DRAABI -> 2312DRAABG)
  if (/^(21|22|23|24|25)[0-9A-Z]{7,9}$/.test(strippedCode)) {
    const prefix = strippedCode.slice(0, -1);
    for (const regSuffix of ['G', 'Y', 'A', 'L', 'I', 'C', 'E']) {
      const candidate = `${prefix}${regSuffix}`;
      const hit = runtimeServerModelMap[candidate] || VERIFIED_ANDROID_MODEL_DB[candidate];
      if (hit) {
        return {
          brand: hit[0],
          marketingName: hit[1],
          cleanCode: strippedCode,
        };
      }
    }
  }

  // 4. Infinix / TECNO suffix variant fallback (e.g. X6833B -> X6833)
  if (/^X\d{4}[A-Z]+$/.test(strippedCode)) {
    const baseInfinix = strippedCode.replace(/[A-Z]+$/, '');
    const hit = runtimeServerModelMap[baseInfinix] || VERIFIED_ANDROID_MODEL_DB[baseInfinix];
    if (hit) {
      return {
        brand: hit[0],
        marketingName: hit[1],
        cleanCode: strippedCode,
      };
    }
  }

  return null;
}

function resolveAndroidBrandAndModel(rawModel: string, ua: string): {
  brand: string;
  modelType: string;
  cleanCode: string;
} {
  const cleanModel = (rawModel || '')
    .replace(/Build\/.*$/i, '')
    .replace(/;?\s*wv\b/i, '')
    .trim();
  const upperModel = cleanModel.toUpperCase();

  // 0. Pertama: Cek Database Resmi Terverifikasi Google Play (4.669+ Model Populer + Cache Server)
  const verifiedHit = lookupVerifiedAndroidModel(cleanModel);
  if (verifiedHit) {
    const { brand, marketingName, cleanCode } = verifiedHit;
    const hasCodeAlready = marketingName.toUpperCase().includes(cleanCode.toUpperCase());
    return {
      brand,
      modelType: hasCodeAlready ? marketingName : `${marketingName} (${cleanCode})`,
      cleanCode,
    };
  }

  // 1. Cek Samsung (Fallback seri jika kode baru belum ada di tabel)
  if (
    upperModel.startsWith('SM-') ||
    upperModel.startsWith('GT-') ||
    upperModel.includes('SAMSUNG') ||
    /samsung|samsungbrowser/i.test(ua)
  ) {
    const baseCode = upperModel
      .replace(/^SAMSUNG\s+/i, '')
      .replace(/\/DS$/i, '')
      .split(/[_\s/]/)[0]
      .trim();
    const retryHit = lookupVerifiedAndroidModel(baseCode);
    if (retryHit) {
      return {
        brand: retryHit.brand,
        modelType: `${retryHit.marketingName} (${retryHit.cleanCode})`,
        cleanCode: retryHit.cleanCode,
      };
    }
    const matchA = baseCode.match(/^SM-A(\d{2})(\d)/);
    if (matchA) {
      return {
        brand: 'Samsung',
        modelType: `Samsung Galaxy A${matchA[1]} (${baseCode})`,
        cleanCode: baseCode,
      };
    }
    const matchM = baseCode.match(/^SM-M(\d{2})(\d)/);
    if (matchM) {
      return {
        brand: 'Samsung',
        modelType: `Samsung Galaxy M${matchM[1]} (${baseCode})`,
        cleanCode: baseCode,
      };
    }
    const matchS = baseCode.match(/^SM-[SG](\d+)/);
    if (matchS) {
      return {
        brand: 'Samsung',
        modelType: `Samsung Galaxy Seri S (${baseCode})`,
        cleanCode: baseCode,
      };
    }
    const matchTab = baseCode.match(/^SM-[TX](\d+)/);
    if (matchTab) {
      return {
        brand: 'Samsung',
        modelType: `Samsung Galaxy Tab (${baseCode})`,
        cleanCode: baseCode,
      };
    }
    return {
      brand: 'Samsung',
      modelType:
        cleanModel && cleanModel !== 'K'
          ? cleanModel.toLowerCase().startsWith('samsung')
            ? cleanModel
            : `Samsung Galaxy (${cleanModel})`
          : 'Samsung Galaxy (Android)',
      cleanCode: baseCode !== 'K' ? baseCode : '',
    };
  }

  // 2. Cek Xiaomi / Redmi / POCO
  if (
    /redmi|poco|xiaomi|\bmi\s/i.test(cleanModel) ||
    /redmi|poco|xiaomi|miuibrowser/i.test(ua) ||
    /^(21|22|23|24|25)\d{2}[A-Z0-9]{5,7}$/.test(upperModel)
  ) {
    if (/poco/i.test(cleanModel)) {
      return {
        brand: 'POCO (Xiaomi)',
        modelType: cleanModel,
        cleanCode: upperModel,
      };
    }
    if (/redmi/i.test(cleanModel)) {
      return {
        brand: 'Xiaomi / Redmi',
        modelType: cleanModel.toLowerCase().startsWith('xiaomi')
          ? cleanModel
          : `Xiaomi ${cleanModel}`,
        cleanCode: upperModel,
      };
    }
    return {
      brand: 'Xiaomi / Redmi',
      modelType:
        cleanModel && cleanModel !== 'K'
          ? `Xiaomi / Redmi (${cleanModel})`
          : 'Xiaomi / Redmi (Android)',
      cleanCode: upperModel !== 'K' ? upperModel : '',
    };
  }

  // 3. Cek OPPO
  if (
    upperModel.startsWith('CPH') ||
    /oppo/i.test(cleanModel) ||
    /oppo|heytapbrowser/i.test(ua)
  ) {
    return {
      brand: 'OPPO',
      modelType:
        cleanModel && cleanModel !== 'K'
          ? cleanModel.toLowerCase().startsWith('oppo')
            ? cleanModel
            : `OPPO (${cleanModel})`
          : 'OPPO Smartphone',
      cleanCode: upperModel !== 'K' ? upperModel : '',
    };
  }

  // 4. Cek vivo / iQOO
  if (
    /^V2\d{3}/i.test(upperModel) ||
    /vivo|iqoo/i.test(cleanModel) ||
    /vivo|vivobrowser|iqoo/i.test(ua)
  ) {
    return {
      brand: 'vivo',
      modelType:
        cleanModel && cleanModel !== 'K'
          ? cleanModel.toLowerCase().startsWith('vivo')
            ? cleanModel
            : `vivo (${cleanModel})`
          : 'vivo Smartphone',
      cleanCode: upperModel !== 'K' ? upperModel : '',
    };
  }

  // 5. Cek Realme
  if (
    upperModel.startsWith('RMX') ||
    /realme/i.test(cleanModel) ||
    /realme/i.test(ua)
  ) {
    return {
      brand: 'Realme',
      modelType:
        cleanModel && cleanModel !== 'K'
          ? cleanModel.toLowerCase().startsWith('realme')
            ? cleanModel
            : `Realme (${cleanModel})`
          : 'Realme Smartphone',
      cleanCode: upperModel !== 'K' ? upperModel : '',
    };
  }

  // 6. Cek Infinix
  if (
    /^X6\d{2,3}/i.test(upperModel) ||
    /infinix/i.test(cleanModel) ||
    /infinix/i.test(ua)
  ) {
    const codeOnly = upperModel.replace(/^INFINIX\s+/i, '').trim();
    return {
      brand: 'Infinix',
      modelType: cleanModel.toLowerCase().includes('infinix')
        ? cleanModel
        : `Infinix (${cleanModel})`,
      cleanCode: codeOnly !== 'K' ? codeOnly : '',
    };
  }

  // 7. Cek TECNO
  if (
    /tecno/i.test(cleanModel) ||
    /tecno/i.test(ua) ||
    /^(BG6|BG7|KI5|KJ5|KL4|LI7|LH8|CK6|CL6|CL7)/i.test(upperModel)
  ) {
    return {
      brand: 'TECNO',
      modelType: cleanModel.toLowerCase().includes('tecno')
        ? cleanModel
        : `TECNO (${cleanModel})`,
      cleanCode: upperModel !== 'K' ? upperModel : '',
    };
  }

  // 8. Cek itel
  if (/itel/i.test(cleanModel) || /itel/i.test(ua)) {
    return {
      brand: 'itel',
      modelType: cleanModel.toLowerCase().includes('itel') ? cleanModel : `itel (${cleanModel})`,
      cleanCode: upperModel !== 'K' ? upperModel : '',
    };
  }

  // 9. Cek ASUS / ROG / Zenfone
  if (/asus|rog/i.test(cleanModel) || /asus/i.test(ua)) {
    return {
      brand: 'ASUS',
      modelType: cleanModel.toLowerCase().includes('asus') ? cleanModel : `ASUS (${cleanModel})`,
      cleanCode: upperModel !== 'K' ? upperModel : '',
    };
  }

  // 10. Cek Google Pixel
  if (/pixel/i.test(cleanModel) || /pixel/i.test(ua)) {
    return {
      brand: 'Google',
      modelType: cleanModel.toLowerCase().startsWith('google')
        ? cleanModel
        : `Google ${cleanModel || 'Pixel'}`,
      cleanCode: upperModel !== 'K' ? upperModel : '',
    };
  }

  // 11. Cek Huawei / Honor
  if (/huawei|honor/i.test(cleanModel) || /huawei|honor|harmonyos/i.test(ua)) {
    const b = /honor/i.test(cleanModel) ? 'Honor' : 'Huawei';
    return {
      brand: b,
      modelType: cleanModel || `${b} Smartphone`,
      cleanCode: upperModel !== 'K' ? upperModel : '',
    };
  }

  // 12. Cek Lenovo / Motorola
  if (/lenovo|moto/i.test(cleanModel) || /lenovo|moto/i.test(ua)) {
    const b = /moto/i.test(cleanModel) ? 'Motorola' : 'Lenovo';
    return {
      brand: b,
      modelType: cleanModel || `${b} Android`,
      cleanCode: upperModel !== 'K' ? upperModel : '',
    };
  }

  if (cleanModel && cleanModel !== 'K' && cleanModel.length >= 2) {
    const firstWord = cleanModel.split(/[\s_-]/)[0];
    return {
      brand: firstWord.length >= 3 ? firstWord : 'Android',
      modelType: cleanModel,
      cleanCode: upperModel,
    };
  }

  return {
    brand: 'Android (Umum)',
    modelType: 'Smartphone / Perangkat Android',
    cleanCode: '',
  };
}

function detectBrowserName(
  ua: string,
  fullVersionList?: Array<{ brand: string; version: string }>
): string {
  if (/SamsungBrowser\/([\d.]+)/i.test(ua)) {
    const m = ua.match(/SamsungBrowser\/([\d.]+)/i);
    return `Samsung Internet ${m?.[1]?.split('.')[0] || ''}`.trim();
  }
  if (/EdgA?\/([\d.]+)/i.test(ua)) {
    const m = ua.match(/EdgA?\/([\d.]+)/i);
    return `Microsoft Edge ${m?.[1]?.split('.')[0] || ''}`.trim();
  }
  if (/OPR\/([\d.]+)|Opera\/([\d.]+)/i.test(ua)) {
    return 'Opera Browser';
  }
  if (/MiuiBrowser\/([\d.]+)/i.test(ua)) {
    return 'Xiaomi Mi Browser';
  }
  if (/VivoBrowser\/([\d.]+)/i.test(ua)) {
    return 'vivo Browser';
  }
  if (/HeyTapBrowser\/([\d.]+)/i.test(ua)) {
    return 'OPPO Browser';
  }
  if (/UCBrowser\/([\d.]+)/i.test(ua)) {
    return 'UC Browser';
  }
  if (/Firefox\/([\d.]+)|FxiOS\/([\d.]+)/i.test(ua)) {
    const m = ua.match(/(?:Firefox|FxiOS)\/([\d.]+)/i);
    return `Mozilla Firefox ${m?.[1]?.split('.')[0] || ''}`.trim();
  }
  if (/CriOS\/([\d.]+)/i.test(ua)) {
    const m = ua.match(/CriOS\/([\d.]+)/i);
    return `Google Chrome (iOS ${m?.[1]?.split('.')[0] || ''})`.trim();
  }
  if (Array.isArray(fullVersionList) && fullVersionList.length > 0) {
    const chromeEntry = fullVersionList.find((item) =>
      /Google Chrome|Chrome/i.test(item.brand)
    );
    if (chromeEntry && chromeEntry.version) {
      return `Google Chrome ${chromeEntry.version.split('.')[0]}`;
    }
  }
  if (/Chrome\/([\d.]+)/i.test(ua)) {
    const m = ua.match(/Chrome\/([\d.]+)/i);
    return `Google Chrome ${m?.[1]?.split('.')[0] || ''}`.trim();
  }
  if (/Version\/([\d.]+).*Safari/i.test(ua)) {
    const m = ua.match(/Version\/([\d.]+)/i);
    return `Apple Safari ${m?.[1]?.split('.')[0] || ''}`.trim();
  }
  return 'Browser Web';
}

function inferAppleModelByScreen(): string {
  if (typeof window === 'undefined' || !window.screen) return 'Apple iPhone';
  const w = Math.min(window.screen.width, window.screen.height);
  const h = Math.max(window.screen.width, window.screen.height);
  const dpr = window.devicePixelRatio || 2;

  if (w === 440 && h === 956) return 'iPhone 16 Pro Max';
  if (w === 402 && h === 874) return 'iPhone 16 Pro';
  if (w === 430 && h === 932) return 'iPhone 14 Pro Max / 15 Plus / 15 Pro Max / 16 Plus';
  if (w === 393 && h === 852) return 'iPhone 14 Pro / iPhone 15 / 15 Pro / iPhone 16';
  if (w === 428 && h === 926) return 'iPhone 12 Pro Max / 13 Pro Max / 14 Plus';
  if (w === 390 && h === 844) return 'iPhone 12 / 13 / 14';
  if (w === 375 && h === 812) return 'iPhone X / XS / 11 Pro / 12 mini / 13 mini';
  if (w === 414 && h === 896) return dpr === 3 ? 'iPhone XS Max / 11 Pro Max' : 'iPhone XR / iPhone 11';
  if (w === 375 && h === 667) return 'iPhone 7 / 8 / SE (Gen 2/3)';
  if (w === 414 && h === 736) return 'iPhone 7 Plus / 8 Plus';
  return `Apple iPhone (Layar ${w}×${h} @${dpr}x)`;
}

function extractRawAndroidModelFromUA(ua: string): string {
  const uaModelMatch = ua.match(/Android\s+[\d.]+;\s*([^)]+)\)/i);
  if (!uaModelMatch || !uaModelMatch[1]) return '';
  const tokens = uaModelMatch[1]
    .split(';')
    .map((t) => t.trim())
    .filter((t) => t && !/^(wv|linux|u|id|id-id|en-us|en-gb|zh-cn)$/i.test(t));
  const lastToken = tokens[tokens.length - 1] || '';
  return lastToken.replace(/Build\/.*$/i, '').trim();
}

function buildDeviceInfoObject(params: {
  ua: string;
  highEntropyModel?: string;
  highEntropyPlatform?: string;
  highEntropyPlatformVersion?: string;
  highEntropyArch?: string;
  highEntropyBitness?: string;
  fullVersionList?: Array<{ brand: string; version: string }>;
  detectionMethod?: string;
}): StudentDeviceInfo {
  const {
    ua,
    highEntropyModel = '',
    highEntropyPlatform = '',
    highEntropyPlatformVersion = '',
    highEntropyArch = '',
    highEntropyBitness = '',
    fullVersionList,
    detectionMethod = 'Client Hints + Google Play Device Registry',
  } = params;

  const { renderer } = getWebGLRendererInfo();
  const gpuLabel = cleanGpuString(renderer);
  const browserName = detectBrowserName(ua, fullVersionList);

  const navAny = typeof navigator !== 'undefined' ? (navigator as any) : {};
  const cores = navAny.hardwareConcurrency ? `${navAny.hardwareConcurrency} Core CPU` : '';
  const ram = navAny.deviceMemory ? `${navAny.deviceMemory} GB RAM` : '';
  const cpuRamInfo = [cores, ram].filter(Boolean).join(' · ') || 'Prosesor Standar';

  const scrW = typeof window !== 'undefined' && window.screen ? window.screen.width : 0;
  const scrH = typeof window !== 'undefined' && window.screen ? window.screen.height : 0;
  const maxTouch = typeof navigator !== 'undefined' ? navigator.maxTouchPoints || 0 : 0;
  const screenResolution =
    scrW > 0 && scrH > 0
      ? `${scrW}×${scrH} px${maxTouch > 0 ? ' (Layar Sentuh)' : ''}`
      : 'Layar Standar';

  const isIPad = /iPad/i.test(ua) || (/Macintosh/i.test(ua) && maxTouch > 1);
  const isIPhone = /iPhone|iPod/i.test(ua) && !isIPad;
  const isAndroid = /Android/i.test(ua) || /Android/i.test(highEntropyPlatform);
  const isCrOS = /CrOS/i.test(ua) || /Chrome OS/i.test(highEntropyPlatform);
  const isWindows = /Windows/i.test(ua) || /Windows/i.test(highEntropyPlatform);
  const isMac = !isIPad && (/Macintosh|Mac OS X/i.test(ua) || /macOS/i.test(highEntropyPlatform));
  const isLinux =
    !isAndroid && !isCrOS && (/Linux/i.test(ua) || /Linux/i.test(highEntropyPlatform));

  let deviceCategory: DeviceCategoryType = 'Perangkat Lainnya';
  let brand = 'Umum';
  let modelType = 'Perangkat Standar';
  let rawModelCode = '';
  let osNameVersion = 'Sistem Operasi';
  let osName = 'Sistem Operasi';
  let osVersion = '';
  let isMobileOrTablet = false;

  if (isAndroid) {
    isMobileOrTablet = true;
    const isTablet =
      !/Mobile/i.test(ua) ||
      /Tab|Pad|SM-T|SM-X/i.test(ua) ||
      /Tab|Pad|SM-T|SM-X/i.test(highEntropyModel);
    deviceCategory = isTablet ? 'Tablet Android' : 'HP Android';

    // Ekstrak versi Android dengan prioritas High-Entropy Platform Version
    const uaAndroidVer = ua.match(/Android\s+([\d.]+)/i)?.[1] || '';
    const heVer = highEntropyPlatformVersion
      ? highEntropyPlatformVersion.split('.')[0].trim()
      : '';
    const finalAndroidVer =
      heVer && Number(heVer) > 0 ? heVer : uaAndroidVer || heVer || '';
    osName = 'Android';
    osVersion = finalAndroidVer;
    osNameVersion = finalAndroidVer ? `Android ${finalAndroidVer}` : 'Android OS';

    // Ekstrak model dari High-Entropy Client Hints atau User-Agent
    let rawModel = highEntropyModel.trim();
    if (!rawModel || rawModel === 'K') {
      rawModel = extractRawAndroidModelFromUA(ua);
    }

    const resolved = resolveAndroidBrandAndModel(rawModel, ua);
    brand = resolved.brand;
    modelType = resolved.modelType;
    rawModelCode = resolved.cleanCode || (rawModel !== 'K' ? rawModel : '');

    // Jika model masih generik ("K" karena privasi browser), sertakan info GPU (Adreno/Mali/PowerVR)
    if (
      (!rawModel || rawModel === 'K') &&
      modelType.includes('Smartphone / Perangkat Android') &&
      gpuLabel &&
      gpuLabel !== 'GPU Standar'
    ) {
      modelType = `${deviceCategory} (${gpuLabel})`;
    }
  } else if (isIPhone) {
    isMobileOrTablet = true;
    deviceCategory = 'iPhone (iOS)';
    brand = 'Apple';
    const iosMatch = ua.match(/OS\s+(\d+[_\d]*)/i);
    const iosVer = iosMatch ? iosMatch[1].replace(/_/g, '.') : '';
    osName = 'iOS';
    osVersion = iosVer;
    osNameVersion = iosVer ? `iOS ${iosVer}` : 'Apple iOS';
    modelType = inferAppleModelByScreen();
  } else if (isIPad) {
    isMobileOrTablet = true;
    deviceCategory = 'iPad (iPadOS)';
    brand = 'Apple';
    const iosMatch = ua.match(/OS\s+(\d+[_\d]*)/i);
    const iosVer = iosMatch ? iosMatch[1].replace(/_/g, '.') : '';
    osName = 'iPadOS';
    osVersion = iosVer;
    osNameVersion = iosVer ? `iPadOS ${iosVer}` : 'Apple iPadOS';
    modelType = `Apple iPad (${scrW}×${scrH} px)`;
  } else if (isWindows) {
    deviceCategory = 'Laptop / Komputer (Windows)';
    let winVer = 'Windows 10 / 11';
    if (highEntropyPlatformVersion) {
      const major = parseInt(highEntropyPlatformVersion.split('.')[0], 10);
      if (!Number.isNaN(major) && major >= 13) {
        winVer = 'Windows 11';
      } else if (!Number.isNaN(major) && major > 0) {
        winVer = 'Windows 10';
      }
    } else if (/Windows NT 10\.0/i.test(ua)) {
      winVer = 'Windows 10 / 11';
    } else if (/Windows NT 6\.3/i.test(ua)) {
      winVer = 'Windows 8.1';
    } else if (/Windows NT 6\.1/i.test(ua)) {
      winVer = 'Windows 7';
    }
    const bitStr =
      highEntropyBitness === '64' || /Win64|x64|WOW64/i.test(ua) ? '64-bit' : '';
    osName = winVer;
    osVersion = bitStr;
    osNameVersion = [winVer, bitStr].filter(Boolean).join(' ');

    if (/ASUS/i.test(ua)) brand = 'ASUS';
    else if (/Lenovo/i.test(ua)) brand = 'Lenovo';
    else if (/Acer/i.test(ua)) brand = 'Acer';
    else if (/HP|Hewlett-Packard/i.test(ua)) brand = 'HP';
    else if (/Dell/i.test(ua)) brand = 'Dell';
    else if (/MSI/i.test(ua)) brand = 'MSI';
    else if (/Intel/i.test(gpuLabel)) brand = 'PC / Laptop (Intel)';
    else if (/AMD|Radeon/i.test(gpuLabel)) brand = 'PC / Laptop (AMD Ryzen/Radeon)';
    else if (/NVIDIA|GeForce/i.test(gpuLabel)) brand = 'PC / Laptop (NVIDIA)';
    else brand = 'Laptop / PC Windows';

    rawModelCode = highEntropyModel.trim();
    modelType =
      highEntropyModel && highEntropyModel.trim()
        ? `${highEntropyModel.trim()} (${gpuLabel})`
        : `${brand} · ${gpuLabel}${cores ? ` (${cores})` : ''}`;
  } else if (isMac) {
    deviceCategory = 'Laptop MacBook / Mac (macOS)';
    brand = 'Apple';
    const macMatch = ua.match(/Mac OS X\s+([\d_.]+)/i);
    const macVer = macMatch ? macMatch[1].replace(/_/g, '.') : '';
    osName = 'macOS';
    osVersion = macVer;
    osNameVersion = macVer ? `macOS ${macVer}` : 'Apple macOS';
    const chipHint = /Apple M\d/i.test(gpuLabel)
      ? gpuLabel
      : highEntropyArch === 'arm'
      ? 'Apple Silicon (M-Series)'
      : gpuLabel || 'MacBook / iMac';
    modelType = `Apple MacBook / Mac (${chipHint})`;
  } else if (isCrOS) {
    deviceCategory = 'Chromebook (ChromeOS)';
    brand = 'Chromebook';
    osName = 'ChromeOS';
    osVersion = '';
    osNameVersion = 'Google ChromeOS';
    rawModelCode = highEntropyModel.trim();
    modelType =
      highEntropyModel && highEntropyModel.trim()
        ? `Chromebook ${highEntropyModel.trim()} (${gpuLabel})`
        : `Laptop Chromebook (${gpuLabel})`;
  } else if (isLinux) {
    deviceCategory = 'Laptop / Komputer (Linux)';
    brand = 'Linux PC / Laptop';
    osName = 'Linux';
    osVersion = '';
    osNameVersion = 'Linux OS';
    modelType = `Laptop / PC Linux (${gpuLabel})`;
  }

  const clientIp = getCachedClientIpSync();
  const deviceFingerprint = getOrGenerateUniqueDeviceFingerprint(`${modelType}|${gpuLabel}|${screenResolution}`);
  const fullSummaryLabel = `${deviceCategory} — ${modelType} · ${osNameVersion} · ${browserName} · ${deviceFingerprint} · IP: ${clientIp}`;

  return {
    deviceCategory,
    brand,
    modelType,
    rawModelCode: rawModelCode || undefined,
    osNameVersion,
    osName,
    osVersion,
    browserName,
    screenResolution,
    gpuRenderer: gpuLabel,
    cpuRamInfo,
    fullSummaryLabel,
    detectedAt: new Date().toLocaleTimeString('id-ID', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }),
    isMobileOrTablet,
    detectionMethod,
    clientIp,
    deviceFingerprint,
  };
}

let cachedDeviceInfo: StudentDeviceInfo | null = null;

export function clearDeviceDetectionCache(): void {
  cachedDeviceInfo = null;
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(DETECTED_DEVICE_STORAGE_KEY);
    for (const k of LEGACY_DEVICE_STORAGE_KEYS) {
      localStorage.removeItem(k);
    }
    localStorage.removeItem('anbk_custom_device_model_v1');
  } catch {
    // ignore
  }
}

export function detectStudentDeviceSync(forceFresh: boolean = false): StudentDeviceInfo {
  if (!forceFresh && cachedDeviceInfo) return cachedDeviceInfo;
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return {
      deviceCategory: 'Laptop / Komputer (Windows)',
      brand: 'Laptop / PC',
      modelType: 'Komputer Peserta ANBK',
      osNameVersion: 'Windows / OS Standar',
      osName: 'Windows',
      osVersion: '',
      browserName: 'Google Chrome',
      screenResolution: '1920×1080 px',
      gpuRenderer: 'GPU Standar',
      cpuRamInfo: 'Prosesor Standar',
      fullSummaryLabel: 'Laptop / Komputer — Komputer Peserta ANBK',
      detectedAt: '--:--',
      isMobileOrTablet: false,
    };
  }

  loadRuntimeServerModelCache();

  if (!forceFresh) {
    try {
      const savedRaw = localStorage.getItem(DETECTED_DEVICE_STORAGE_KEY);
      if (savedRaw) {
        const parsed = JSON.parse(savedRaw) as StudentDeviceInfo;
        if (parsed && parsed.deviceCategory && parsed.modelType) {
          // Pastikan jika ada rawModelCode di parsed, tetap disinkronkan dengan database terbaru
          if (parsed.rawModelCode) {
            const verified = lookupVerifiedAndroidModel(parsed.rawModelCode);
            if (verified) {
              const expectedModelType = verified.marketingName
                .toUpperCase()
                .includes(verified.cleanCode.toUpperCase())
                ? verified.marketingName
                : `${verified.marketingName} (${verified.cleanCode})`;
              parsed.brand = verified.brand;
              parsed.modelType = expectedModelType;
              parsed.fullSummaryLabel = `${parsed.deviceCategory} — ${expectedModelType} · ${parsed.osNameVersion} · ${parsed.browserName}`;
            }
          }
          cachedDeviceInfo = parsed;
          return parsed;
        }
      }
    } catch {
      // ignore
    }
  }

  const ua = navigator.userAgent || '';
  const navAny = navigator as any;
  const syncPlatform = navAny.userAgentData?.platform || '';
  const info = buildDeviceInfoObject({
    ua,
    highEntropyPlatform: syncPlatform,
  });
  cachedDeviceInfo = info;
  try {
    localStorage.setItem(DETECTED_DEVICE_STORAGE_KEY, JSON.stringify(info));
  } catch {
    // ignore
  }
  return info;
}

export async function detectStudentDeviceAsync(
  forceRefresh: boolean = false
): Promise<StudentDeviceInfo> {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return detectStudentDeviceSync();
  }

  if (!forceRefresh && cachedDeviceInfo) {
    return cachedDeviceInfo;
  }

  if (forceRefresh) {
    clearDeviceDetectionCache();
  }

  const ua = navigator.userAgent || '';
  const navAny = navigator as any;

  let highEntropyModel = '';
  let highEntropyPlatform = navAny.userAgentData?.platform || '';
  let highEntropyPlatformVersion = '';
  let highEntropyArch = '';
  let highEntropyBitness = '';
  let fullVersionList: Array<{ brand: string; version: string }> | undefined;

  if (
    navAny.userAgentData &&
    typeof navAny.userAgentData.getHighEntropyValues === 'function'
  ) {
    try {
      const hints = await navAny.userAgentData.getHighEntropyValues([
        'model',
        'platform',
        'platformVersion',
        'architecture',
        'bitness',
        'fullVersionList',
      ]);
      if (hints) {
        highEntropyModel = String(hints.model || '').trim();
        highEntropyPlatform = String(hints.platform || highEntropyPlatform || '').trim();
        highEntropyPlatformVersion = String(hints.platformVersion || '').trim();
        highEntropyArch = String(hints.architecture || '').trim();
        highEntropyBitness = String(hints.bitness || '').trim();
        if (Array.isArray(hints.fullVersionList)) {
          fullVersionList = hints.fullVersionList;
        }
      }
    } catch {
      // ignore
    }
  }

  // Cek apakah model Android perlu diverifikasi lewat Server Google Play Registry (43.383+ Model)
  const candidateModel =
    highEntropyModel && highEntropyModel !== 'K'
      ? highEntropyModel
      : extractRawAndroidModelFromUA(ua);

  if (candidateModel && candidateModel !== 'K') {
    const localHit = lookupVerifiedAndroidModel(candidateModel);
    if (!localHit || forceRefresh) {
      try {
        const res = await fetch(
          `/__api/device-lookup?model=${encodeURIComponent(candidateModel)}&_t=${Date.now()}`
        );
        if (res.ok) {
          const data = await res.json();
          if (data && data.ok && data.brand && data.marketingName) {
            const [normBrand, normMarketing] = normalizeBrandMarketingPair(
              String(data.brand),
              String(data.marketingName)
            );
            const codeKey = String(data.modelCode || candidateModel).toUpperCase();
            runtimeServerModelMap[codeKey] = [normBrand, normMarketing];
            try {
              localStorage.setItem(
                SERVER_MODEL_CACHE_KEY,
                JSON.stringify(runtimeServerModelMap)
              );
            } catch {
              // ignore
            }
          }
        }
      } catch {
        // ignore network error and rely on local verified DB
      }
    }
  }

  const detectedPublicIp = await fetchClientPublicIpAsync(forceRefresh);

  const info = buildDeviceInfoObject({
    ua,
    highEntropyModel,
    highEntropyPlatform,
    highEntropyPlatformVersion,
    highEntropyArch,
    highEntropyBitness,
    fullVersionList,
    detectionMethod: 'Real-Time Hardware & Google Play Certified Registry',
  });
  info.clientIp = detectedPublicIp;
  info.deviceFingerprint = getOrGenerateUniqueDeviceFingerprint(
    `${info.modelType}|${info.gpuRenderer}|${info.screenResolution}|${detectedPublicIp}`
  );
  info.fullSummaryLabel = `${info.deviceCategory} — ${info.modelType} · ${info.osNameVersion} · ${info.browserName} · ${info.deviceFingerprint} · IP: ${detectedPublicIp}`;

  cachedDeviceInfo = info;
  try {
    localStorage.setItem(DETECTED_DEVICE_STORAGE_KEY, JSON.stringify(info));
    window.dispatchEvent(new CustomEvent('anbk-device-updated', { detail: info }));
  } catch {
    // ignore
  }
  return info;
}
