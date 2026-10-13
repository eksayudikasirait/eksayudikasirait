/**
 * ANTI-SPLIT-SCREEN & ORIENTATION PRECISION MONITOR
 * 
 * Modul pemantauan presisi tinggi anti-belah layar (Split-Screen / Multi-Window /
 * Floating Window / Slide Over) dengan pelacakan perubahan orientasi layar (Portrait vs Landscape)
 * secara akurat untuk mencegah manipulasi dan kecurangan pada perangkat mobile modern
 * (Android 10 - 15, iOS / iPadOS, Tablet, Laptop, Chromebook).
 */

export type ScreenOrientationMode = 'portrait' | 'landscape';

export interface OrientationDetail {
  mode: ScreenOrientationMode;
  angle: number;
  rawType: string;
  isLandscape: boolean;
  isPortrait: boolean;
  source: 'screen.orientation' | 'window.orientation' | 'matchMedia' | 'aspectRatio';
}

export interface SplitScreenDetectionResult {
  isSplitScreen: boolean;
  reason: string;
  orientation: ScreenOrientationMode;
  widthRatio: number;
  heightRatio: number;
  windowWidth: number;
  windowHeight: number;
  expectedWidth: number;
  expectedHeight: number;
  isInputFocused: boolean;
  violationDetail?: string;
}

/**
 * Mendapatkan informasi orientasi layar perangkat secara presisi melalui berbagai API standar modern
 */
export function getPreciseScreenOrientation(): OrientationDetail {
  if (typeof window === 'undefined') {
    return {
      mode: 'portrait',
      angle: 0,
      rawType: 'portrait-primary',
      isLandscape: false,
      isPortrait: true,
      source: 'aspectRatio',
    };
  }

  // 1. Standar Modern: screen.orientation API (Android Chrome, modern Safari, Edge)
  const screenOrientation = window.screen?.orientation;
  if (screenOrientation && typeof screenOrientation.type === 'string') {
    const rawType = screenOrientation.type.toLowerCase();
    const angle = screenOrientation.angle || 0;
    if (rawType.includes('landscape')) {
      return {
        mode: 'landscape',
        angle,
        rawType,
        isLandscape: true,
        isPortrait: false,
        source: 'screen.orientation',
      };
    }
    if (rawType.includes('portrait')) {
      return {
        mode: 'portrait',
        angle,
        rawType,
        isLandscape: false,
        isPortrait: true,
        source: 'screen.orientation',
      };
    }
  }

  // 2. Fallback sudut rotasi: screen.orientation.angle
  if (screenOrientation && typeof screenOrientation.angle === 'number') {
    const angle = Math.abs(screenOrientation.angle);
    if (angle === 90 || angle === 270) {
      return {
        mode: 'landscape',
        angle: screenOrientation.angle,
        rawType: `landscape-angle-${screenOrientation.angle}`,
        isLandscape: true,
        isPortrait: false,
        source: 'screen.orientation',
      };
    }
    if (angle === 0 || angle === 180) {
      return {
        mode: 'portrait',
        angle: screenOrientation.angle,
        rawType: `portrait-angle-${screenOrientation.angle}`,
        isLandscape: false,
        isPortrait: true,
        source: 'screen.orientation',
      };
    }
  }

  // 3. Fallback Legacy iOS / Safari: window.orientation
  if (typeof (window as any).orientation === 'number') {
    const winAngle = Math.abs((window as any).orientation);
    if (winAngle === 90 || winAngle === 270) {
      return {
        mode: 'landscape',
        angle: (window as any).orientation,
        rawType: `landscape-legacy-${(window as any).orientation}`,
        isLandscape: true,
        isPortrait: false,
        source: 'window.orientation',
      };
    }
    if (winAngle === 0 || winAngle === 180) {
      return {
        mode: 'portrait',
        angle: (window as any).orientation,
        rawType: `portrait-legacy-${(window as any).orientation}`,
        isLandscape: false,
        isPortrait: true,
        source: 'window.orientation',
      };
    }
  }

  // 4. CSS Media Query: window.matchMedia
  if (typeof window.matchMedia === 'function') {
    try {
      const matchLandscape = window.matchMedia('(orientation: landscape)').matches;
      if (matchLandscape) {
        return {
          mode: 'landscape',
          angle: 90,
          rawType: 'landscape-media-query',
          isLandscape: true,
          isPortrait: false,
          source: 'matchMedia',
        };
      }
      const matchPortrait = window.matchMedia('(orientation: portrait)').matches;
      if (matchPortrait) {
        return {
          mode: 'portrait',
          angle: 0,
          rawType: 'portrait-media-query',
          isLandscape: false,
          isPortrait: true,
          source: 'matchMedia',
        };
      }
    } catch {
      // Abaikan jika matchMedia gagal di environment tertentu
    }
  }

  // 5. Fallback terakhir: Rasio dimensi window
  const isLandscapeByRatio = window.innerWidth > window.innerHeight;
  return {
    mode: isLandscapeByRatio ? 'landscape' : 'portrait',
    angle: isLandscapeByRatio ? 90 : 0,
    rawType: isLandscapeByRatio ? 'landscape-ratio' : 'portrait-ratio',
    isLandscape: isLandscapeByRatio,
    isPortrait: !isLandscapeByRatio,
    source: 'aspectRatio',
  };
}

/**
 * Mendeteksi apakah perangkat pengguna adalah perangkat genggam (Mobile / Tablet)
 */
export function isMobileOrTabletDevice(): boolean {
  if (typeof window === 'undefined') return false;
  const ua = navigator.userAgent || '';
  const isTouchDevice =
    (navigator.maxTouchPoints && navigator.maxTouchPoints > 1) ||
    'ontouchstart' in window;
  const isMobileUa = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);
  return isMobileUa || (isTouchDevice && !/Windows NT/i.test(ua));
}

/**
 * Cek apakah pengguna saat ini sedang aktif mengetik di elemen form (Input / Textarea).
 * Ini penting agar saat virtual keyboard HP naik di mode Portrait, sistem tidak salah
 * mengira penyusutan tinggi layar sebagai split-screen palsu.
 */
export function isFormInputFocused(): boolean {
  if (typeof document === 'undefined') return false;
  const activeEl = document.activeElement;
  if (!activeEl) return false;
  const tagName = activeEl.tagName.toUpperCase();
  if (tagName === 'INPUT' || tagName === 'TEXTAREA') return true;
  if ((activeEl as HTMLElement).isContentEditable) return true;
  return false;
}

/**
 * Evaluasi Presisi Tinggi Apakah Layar Berada dalam Kondisi Split-Screen / Multi-Window
 * dengan mempertimbangkan Orientasi Layar (Portrait / Landscape) secara Real-Time.
 */
export function evaluatePrecisionSplitScreen(): SplitScreenDetectionResult {
  if (typeof window === 'undefined') {
    return {
      isSplitScreen: false,
      reason: '',
      orientation: 'portrait',
      widthRatio: 1,
      heightRatio: 1,
      windowWidth: 1024,
      windowHeight: 768,
      expectedWidth: 1024,
      expectedHeight: 768,
      isInputFocused: false,
    };
  }

  const orient = getPreciseScreenOrientation();
  const isMobile = isMobileOrTabletDevice();
  const isInputFocused = isFormInputFocused();

  const winW = window.innerWidth;
  const winH = window.innerHeight;

  const rawScreenW = window.screen.width || winW;
  const rawScreenH = window.screen.height || winH;
  const rawAvailW = window.screen.availWidth || rawScreenW;
  const rawAvailH = window.screen.availHeight || rawScreenH;

  // Nilai ekstrem dimensi layar fisik (tidak berubah meski layar diputar)
  const physicalMinDim = Math.min(rawScreenW, rawScreenH);
  const physicalMaxDim = Math.max(rawScreenW, rawScreenH);

  let expectedW = rawAvailW;
  let expectedH = rawAvailH;

  if (isMobile) {
    if (orient.mode === 'portrait') {
      // Pada mode Portrait HP: Lebar fisik adalah sisi pendek, tinggi fisik adalah sisi panjang
      expectedW = physicalMinDim > 0 ? physicalMinDim : winW;
      expectedH = physicalMaxDim > 0 ? physicalMaxDim : winH;
    } else {
      // Pada mode Landscape HP: Lebar fisik adalah sisi panjang, tinggi fisik adalah sisi pendek
      expectedW = physicalMaxDim > 0 ? physicalMaxDim : winW;
      expectedH = physicalMinDim > 0 ? physicalMinDim : winH;
    }
  } else {
    // Desktop / Laptop / Chromebook
    expectedW = rawAvailW > 0 ? rawAvailW : rawScreenW;
    expectedH = rawAvailH > 0 ? rawAvailH : rawScreenH;
  }

  const widthRatio = expectedW > 0 ? winW / expectedW : 1;
  const heightRatio = expectedH > 0 ? winH / expectedH : 1;

  let isSplit = false;
  let reason = '';
  let violationDetail = '';

  if (isMobile) {
    // -------------------------------------------------------------
    // LOGIKA PERANGKAT MOBILE (HP Android, iPhone, Tablet)
    // -------------------------------------------------------------

    // 1. Deteksi Jendela Mengambang (Floating Window / Pop-up View)
    if (widthRatio < 0.70 && heightRatio < 0.70) {
      isSplit = true;
      reason = `Terdeteksi Jendela Mengambang (Floating / Pop-up Window) [Orientasi: ${orient.mode.toUpperCase()}]`;
      violationDetail = `Layar ujian berada dalam jendela mengambang/pop-up kecil (Lebar: ${Math.round(widthRatio * 100)}%, Tinggi: ${Math.round(heightRatio * 100)}%).`;
    }
    // 2. Deteksi Split-Screen pada Mode LANDSCAPE (Bilah samping / Side-by-Side)
    else if (orient.mode === 'landscape') {
      // Pada orientasi landscape, membelah layar (split screen) membagi lebar layar secara drastis
      if (widthRatio < 0.68) {
        isSplit = true;
        reason = `Terdeteksi Layar Terbelah Samping (Split-Screen Landscape / Multi-Window)`;
        violationDetail = `Lebar layar ujian terbelah menjadi ${Math.round(widthRatio * 100)}% dari ukuran layar penuh perangkat landscape.`;
      } else if (heightRatio < 0.58 && !isInputFocused) {
        // Layar dibelah atas-bawah pada posisi landscape saat tidak sedang mengetik
        isSplit = true;
        reason = `Terdeteksi Layar Terbelah (Split-Screen Landscape Atas-Bawah)`;
        violationDetail = `Tinggi layar ujian terpotong menjadi ${Math.round(heightRatio * 100)}% pada orientasi landscape.`;
      }
    }
    // 3. Deteksi Split-Screen pada Mode PORTRAIT (Bilah atas-bawah / Multi-Window)
    else {
      // Pada orientasi portrait, membelah layar membagi tinggi layar menjadi setengah (atas/bawah)
      if (widthRatio < 0.70) {
        // Split screen menyamping pada portrait atau multi-window
        isSplit = true;
        reason = `Terdeteksi Layar Terbelah Menyamping (Split-Screen Portrait)`;
        violationDetail = `Lebar layar ujian menyusut drastis menjadi ${Math.round(widthRatio * 100)}% pada mode portrait.`;
      } else if (heightRatio < 0.58) {
        // Jika sedang mengetik di input/textarea, virtual keyboard Android/iOS bisa menyusutkan tinggi
        // Namun jika tinggi < 0.35 (sangat kerdil) atau TIDAK sedang mengetik, ini adalah split-screen nyata
        if (!isInputFocused || heightRatio < 0.35) {
          isSplit = true;
          reason = `Terdeteksi Layar Terbelah Atas-Bawah (Split-Screen Portrait / Multi-Window)`;
          violationDetail = `Tinggi layar ujian terpotong menjadi ${Math.round(heightRatio * 100)}% karena aplikasi lain dibuka bersamaan.`;
        }
      }
    }
  } else {
    // -------------------------------------------------------------
    // LOGIKA DESKTOP / LAPTOP / CHROMEBOOK
    // -------------------------------------------------------------
    if (widthRatio < 0.68) {
      isSplit = true;
      reason = `Terdeteksi Layar Terbelah (Split-Screen Snap Window / Multi-Window)`;
      violationDetail = `Jendela browser di-snap ke setengah layar (Lebar tersisa: ${Math.round(widthRatio * 100)}%).`;
    } else if (heightRatio < 0.60) {
      isSplit = true;
      reason = `Terdeteksi Jendela Browser Diperkecil (Minimized / Windowed Mode)`;
      violationDetail = `Tinggi jendela browser menyusut menjadi ${Math.round(heightRatio * 100)}% dari layar monitor.`;
    }
  }

  return {
    isSplitScreen: isSplit,
    reason,
    orientation: orient.mode,
    widthRatio,
    heightRatio,
    windowWidth: winW,
    windowHeight: winH,
    expectedWidth: expectedW,
    expectedHeight: expectedH,
    isInputFocused,
    violationDetail,
  };
}
