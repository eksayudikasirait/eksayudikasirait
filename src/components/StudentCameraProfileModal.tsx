import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Camera,
  Upload,
  RefreshCw,
  CheckCircle2,
  Trash2,
  X,
  UserCheck,
  FlipHorizontal,
  Sparkles,
  AlertTriangle,
  Timer,
  Image as ImageIcon,
  Lock,
  ShieldAlert,
} from 'lucide-react';

export const STUDENT_PROFILE_STORAGE_KEY = 'anbk_student_profile_v1';
export const STUDENT_PHOTO_STORAGE_KEY = 'anbk_student_photo_v1';
export const STUDENT_NAME_STORAGE_KEY = 'anbk_student_name_v1';
export const STUDENT_PHOTOS_MAP_STORAGE_KEY = 'anbk_student_photos_by_user_v1';

export interface StoredStudentProfile {
  namaSiswa: string;
  nisNisn: string;
  kelasSiswa: string;
  semesterSiswa: 'Ganjil' | 'Genap' | '';
  photoDataUrl: string;
  updatedAt: number;
}

// In-memory cache to avoid repeated synchronous localStorage.getItem & JSON.parse on every render
let cachedProfileMemory: StoredStudentProfile | null = null;
let cachedPhotosMapMemory: Record<string, string> | null = null;
let storageCacheListenerAttached = false;

function ensureStorageCacheListener(): void {
  if (storageCacheListenerAttached || typeof window === 'undefined') return;
  storageCacheListenerAttached = true;
  window.addEventListener('storage', (e) => {
    if (
      !e.key ||
      e.key === STUDENT_PROFILE_STORAGE_KEY ||
      e.key === STUDENT_PHOTO_STORAGE_KEY ||
      e.key === STUDENT_NAME_STORAGE_KEY ||
      e.key === STUDENT_PHOTOS_MAP_STORAGE_KEY
    ) {
      cachedProfileMemory = null;
      cachedPhotosMapMemory = null;
    }
  });
}

function getCachedPhotosMap(): Record<string, string> {
  ensureStorageCacheListener();
  if (cachedPhotosMapMemory) return cachedPhotosMapMemory;
  if (typeof window === 'undefined') return {};
  try {
    const mapRaw = localStorage.getItem(STUDENT_PHOTOS_MAP_STORAGE_KEY);
    cachedPhotosMapMemory = mapRaw ? (JSON.parse(mapRaw) as Record<string, string>) : {};
  } catch {
    cachedPhotosMapMemory = {};
  }
  return cachedPhotosMapMemory;
}

export function loadStoredStudentProfile(): StoredStudentProfile {
  if (typeof window === 'undefined') {
    return {
      namaSiswa: '',
      nisNisn: '',
      kelasSiswa: '',
      semesterSiswa: '',
      photoDataUrl: '',
      updatedAt: 0,
    };
  }
  ensureStorageCacheListener();
  if (cachedProfileMemory) {
    return cachedProfileMemory;
  }
  try {
    const raw = localStorage.getItem(STUDENT_PROFILE_STORAGE_KEY);
    const directPhoto = localStorage.getItem(STUDENT_PHOTO_STORAGE_KEY) || '';
    const rawDirectName = localStorage.getItem(STUDENT_NAME_STORAGE_KEY) || '';
    const directName =
      rawDirectName === 'Peserta Ujian ANBK' || rawDirectName === 'Belum Mengisi Nama Siswa'
        ? ''
        : rawDirectName;
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<StoredStudentProfile>;
      // Kolom Nama Lengkap Siswa, NIS/NISN, Kelas, dan Semester selalu dikosongkan sebelum diketik/dipilih siswa
      cachedProfileMemory = {
        namaSiswa: '',
        nisNisn: '',
        kelasSiswa: '',
        semesterSiswa: '',
        photoDataUrl:
          typeof parsed.photoDataUrl === 'string' && parsed.photoDataUrl
            ? parsed.photoDataUrl
            : directPhoto,
        updatedAt: typeof parsed.updatedAt === 'number' ? parsed.updatedAt : Date.now(),
      };
      return cachedProfileMemory;
    }
    cachedProfileMemory = {
      namaSiswa: '',
      nisNisn: '',
      kelasSiswa: '',
      semesterSiswa: '',
      photoDataUrl: directPhoto,
      updatedAt: 0,
    };
    return cachedProfileMemory;
  } catch {
    return {
      namaSiswa: '',
      nisNisn: '',
      kelasSiswa: '',
      semesterSiswa: '',
      photoDataUrl: '',
      updatedAt: 0,
    };
  }
}

export function getPhotoForStudentIdentity(
  namaSiswa?: string,
  nisNisn?: string,
  allowLatestFallback: boolean = false
): string {
  if (typeof window === 'undefined') return '';
  try {
    const cleanName = (namaSiswa || '').trim().toLowerCase();
    const cleanNis = (nisNisn || '').trim().toLowerCase();
    const hasSpecificIdentity = Boolean(
      (cleanName &&
        cleanName !== 'peserta ujian anbk' &&
        cleanName !== 'peserta ujian' &&
        cleanName !== 'belum mengisi nama siswa') ||
        (cleanNis && cleanNis !== '0' && cleanNis !== '-')
    );

    const map = getCachedPhotosMap();
    if (cleanName && cleanNis && map[`${cleanName}_${cleanNis}`]) {
      return map[`${cleanName}_${cleanNis}`];
    }
    if (cleanNis && cleanNis !== '0' && cleanNis !== '-' && map[`nis_${cleanNis}`]) {
      return map[`nis_${cleanNis}`];
    }
    if (cleanName && map[`name_${cleanName}`]) {
      return map[`name_${cleanName}`];
    }

    const parsedProfile = loadStoredStudentProfile();
    const pName = (parsedProfile.namaSiswa || '').trim().toLowerCase();
    const pNis = (parsedProfile.nisNisn || '').trim().toLowerCase();
    if (
      parsedProfile.photoDataUrl &&
      ((cleanName && pName === cleanName) ||
        (cleanNis && cleanNis !== '-' && pNis === cleanNis))
    ) {
      return parsedProfile.photoDataUrl;
    }

    if ((!hasSpecificIdentity || allowLatestFallback) && map['__latest_active_photo__']) {
      return map['__latest_active_photo__'];
    }
    if (!hasSpecificIdentity || allowLatestFallback) {
      return parsedProfile.photoDataUrl || '';
    }
    return '';
  } catch {
    return '';
  }
}

export function saveStoredStudentProfile(
  partial: Partial<StoredStudentProfile>
): StoredStudentProfile {
  const current = loadStoredStudentProfile();
  const incomingName = partial.namaSiswa !== undefined ? partial.namaSiswa : undefined;
  const resolvedName =
    incomingName !== undefined
      ? incomingName.trim() === 'Peserta Ujian ANBK' ||
        incomingName.trim() === 'Belum Mengisi Nama Siswa' ||
        incomingName.trim() === 'Peserta Ujian'
        ? ''
        : incomingName
      : current.namaSiswa;

  const incomingNis = partial.nisNisn !== undefined ? partial.nisNisn.trim() : undefined;
  const resolvedNis =
    incomingNis !== undefined ? incomingNis : current.nisNisn;

  const next: StoredStudentProfile = {
    namaSiswa: resolvedName,
    nisNisn: resolvedNis,
    kelasSiswa: partial.kelasSiswa !== undefined ? partial.kelasSiswa : current.kelasSiswa,
    semesterSiswa:
      partial.semesterSiswa !== undefined ? partial.semesterSiswa : current.semesterSiswa,
    photoDataUrl:
      partial.photoDataUrl !== undefined ? partial.photoDataUrl : current.photoDataUrl,
    updatedAt: Date.now(),
  };

  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(STUDENT_PROFILE_STORAGE_KEY, JSON.stringify(next));
      if (next.photoDataUrl) {
        localStorage.setItem(STUDENT_PHOTO_STORAGE_KEY, next.photoDataUrl);
      } else {
        localStorage.removeItem(STUDENT_PHOTO_STORAGE_KEY);
      }
      if (next.namaSiswa.trim()) {
        localStorage.setItem(STUDENT_NAME_STORAGE_KEY, next.namaSiswa.trim());
      } else {
        localStorage.removeItem(STUDENT_NAME_STORAGE_KEY);
      }

      const mapRaw = localStorage.getItem(STUDENT_PHOTOS_MAP_STORAGE_KEY);
      const map: Record<string, string> = mapRaw ? JSON.parse(mapRaw) : {};
      const cleanName = next.namaSiswa.trim().toLowerCase();
      const cleanNis = next.nisNisn.trim().toLowerCase();
      if (next.photoDataUrl) {
        map['__latest_active_photo__'] = next.photoDataUrl;
        if (cleanName && cleanNis) {
          map[`${cleanName}_${cleanNis}`] = next.photoDataUrl;
        }
        if (cleanNis) {
          map[`nis_${cleanNis}`] = next.photoDataUrl;
        }
        if (cleanName) {
          map[`name_${cleanName}`] = next.photoDataUrl;
        }
      } else {
        delete map['__latest_active_photo__'];
        if (cleanName && cleanNis) {
          delete map[`${cleanName}_${cleanNis}`];
        }
        if (cleanNis) {
          delete map[`nis_${cleanNis}`];
        }
        if (cleanName) {
          delete map[`name_${cleanName}`];
        }
      }
      localStorage.setItem(STUDENT_PHOTOS_MAP_STORAGE_KEY, JSON.stringify(map));
      cachedProfileMemory = next;
      cachedPhotosMapMemory = map;

      // Otomatis sinkronkan foto profil ke bangku siswa yang bersangkutan di Design Classroom (anbk_classroom_manual_students_v1)
      try {
        const rawStudents = localStorage.getItem('anbk_classroom_manual_students_v1');
        const rawActiveSync = localStorage.getItem('anbk_classroom_active_student_sync_v1');
        const parsedActiveSync = rawActiveSync ? JSON.parse(rawActiveSync) : null;
        if (rawStudents) {
          const studentsList = JSON.parse(rawStudents);
          if (Array.isArray(studentsList)) {
            let anySeatUpdated = false;
            const updatedStudentsList = studentsList.map((st: any) => {
              const stName = String(st?.namaSiswa || '').trim().toLowerCase();
              const stNis = String(st?.nisNisn || '').trim().toLowerCase();
              const matchByIdentity =
                (cleanName && stName === cleanName) ||
                (cleanNis && cleanNis !== '-' && stNis === cleanNis);
              const matchByActiveSeat =
                !cleanName &&
                !cleanNis &&
                parsedActiveSync &&
                st?.kelas === parsedActiveSync.kelas &&
                st?.seatNumber === parsedActiveSync.seatNumber;

              if (matchByIdentity || matchByActiveSeat) {
                anySeatUpdated = true;
                return {
                  ...st,
                  photoUrl: next.photoDataUrl || undefined,
                };
              }
              return st;
            });

            if (anySeatUpdated) {
              localStorage.setItem(
                'anbk_classroom_manual_students_v1',
                JSON.stringify(updatedStudentsList)
              );
              if (parsedActiveSync) {
                localStorage.setItem(
                  'anbk_classroom_active_student_sync_v1',
                  JSON.stringify({
                    ...parsedActiveSync,
                    photoUrl: next.photoDataUrl || undefined,
                  })
                );
              }
              window.dispatchEvent(
                new CustomEvent('anbk-classroom-students-updated', {
                  detail: { photoUpdated: true, profile: next },
                })
              );
            }
          }
        }
      } catch {
        // ignore
      }

      window.dispatchEvent(new CustomEvent('anbk-student-profile-updated', { detail: next }));
    } catch {
      // ignore storage quota errors
    }
  }

  return next;
}

export function savePhotoForStudentIdentity(
  namaSiswa: string,
  nisNisn: string,
  photoDataUrl: string
): void {
  if (typeof window === 'undefined') return;
  try {
    const mapRaw = localStorage.getItem(STUDENT_PHOTOS_MAP_STORAGE_KEY);
    const map: Record<string, string> = mapRaw ? JSON.parse(mapRaw) : {};
    const cleanName = (namaSiswa || '').trim().toLowerCase();
    const cleanNis = (nisNisn || '').trim().toLowerCase();

    if (photoDataUrl) {
      if (cleanName && cleanNis && cleanNis !== '-') {
        map[`${cleanName}_${cleanNis}`] = photoDataUrl;
      }
      if (cleanNis && cleanNis !== '-') {
        map[`nis_${cleanNis}`] = photoDataUrl;
      }
      if (cleanName) {
        map[`name_${cleanName}`] = photoDataUrl;
      }
    } else {
      if (cleanName && cleanNis && cleanNis !== '-') {
        delete map[`${cleanName}_${cleanNis}`];
      }
      if (cleanNis && cleanNis !== '-') {
        delete map[`nis_${cleanNis}`];
      }
      if (cleanName) {
        delete map[`name_${cleanName}`];
      }
    }
    localStorage.setItem(STUDENT_PHOTOS_MAP_STORAGE_KEY, JSON.stringify(map));
    cachedPhotosMapMemory = map;

    // Sinkronkan ke profil aktif jika identitas sesuai
    const current = loadStoredStudentProfile();
    const curName = (current.namaSiswa || '').trim().toLowerCase();
    const curNis = (current.nisNisn || '').trim().toLowerCase();
    if (
      (cleanName && curName === cleanName) ||
      (cleanNis && cleanNis !== '-' && curNis === cleanNis)
    ) {
      current.photoDataUrl = photoDataUrl;
      try {
        localStorage.setItem(STUDENT_PROFILE_STORAGE_KEY, JSON.stringify(current));
        if (photoDataUrl) {
          localStorage.setItem(STUDENT_PHOTO_STORAGE_KEY, photoDataUrl);
        } else {
          localStorage.removeItem(STUDENT_PHOTO_STORAGE_KEY);
        }
      } catch {}
    }

    // Sinkronkan pula ke daftar siswa denah lab komputer
    try {
      const rawStudents = localStorage.getItem('anbk_classroom_manual_students_v1');
      if (rawStudents) {
        const studentsList = JSON.parse(rawStudents);
        if (Array.isArray(studentsList)) {
          let anyUpdated = false;
          const updatedList = studentsList.map((st: any) => {
            const stName = String(st?.namaSiswa || '').trim().toLowerCase();
            const stNis = String(st?.nisNisn || '').trim().toLowerCase();
            if (
              (cleanName && stName === cleanName) ||
              (cleanNis && cleanNis !== '-' && stNis === cleanNis)
            ) {
              anyUpdated = true;
              return { ...st, photoUrl: photoDataUrl || undefined };
            }
            return st;
          });
          if (anyUpdated) {
            localStorage.setItem('anbk_classroom_manual_students_v1', JSON.stringify(updatedList));
          }
        }
      }
    } catch {}

    window.dispatchEvent(
      new CustomEvent('anbk-student-photos-map-updated', {
        detail: { namaSiswa, nisNisn, photoDataUrl },
      })
    );
  } catch {}
}

export function compressImageToDataUrl(
  source: HTMLVideoElement | HTMLImageElement,
  sourceWidth: number,
  sourceHeight: number,
  mirrorHorizontal: boolean = false,
  targetSize: number = 320
): string {
  const canvas = document.createElement('canvas');
  canvas.width = targetSize;
  canvas.height = targetSize;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  const validW = sourceWidth > 0 ? sourceWidth : 320;
  const validH = sourceHeight > 0 ? sourceHeight : 320;

  // Center-crop square
  const minSide = Math.min(validW, validH);
  const sx = Math.max(0, (validW - minSide) / 2);
  const sy = Math.max(0, (validH - minSide) / 2);

  ctx.save();
  if (mirrorHorizontal) {
    ctx.translate(targetSize, 0);
    ctx.scale(-1, 1);
  }
  try {
    ctx.drawImage(source, sx, sy, minSide, minSide, 0, 0, targetSize, targetSize);
  } catch {
    ctx.restore();
    return '';
  }
  ctx.restore();

  let out = canvas.toDataURL('image/jpeg', 0.8);
  if (out.length > 36000) {
    out = canvas.toDataURL('image/jpeg', 0.62);
  }
  if (out.length > 36000) {
    out = canvas.toDataURL('image/jpeg', 0.48);
  }
  return out;
}

export function getStudentInitials(name: string): string {
  const cleaned = (name || '').trim();
  if (!cleaned) return 'SW';
  const parts = cleaned.split(/\s+/).filter(Boolean);
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }
  return `${parts[0][0] || ''}${parts[parts.length - 1][0] || ''}`.toUpperCase();
}

export type StudentAvatarPresetStyle = 'putra' | 'putri' | 'hijab' | 'inisial';
export type StudentPhotoBgColor = 'merah' | 'biru';

const formalAvatarMemoryCache = new Map<string, string>();
let sharedAvatarCanvas: HTMLCanvasElement | null = null;

export function generateFormalStudentAvatarDataUrl(
  namaSiswa: string,
  kelasSiswa: string,
  style: StudentAvatarPresetStyle = 'putra',
  bgColor: StudentPhotoBgColor = 'merah'
): string {
  const cleanName = (namaSiswa || 'PESERTA ANBK').trim().toUpperCase();
  const cleanKelas = (kelasSiswa || 'VIII-1').trim().toUpperCase();
  const cacheKey = `${cleanName}__${cleanKelas}__${style}__${bgColor}`;
  const cached = formalAvatarMemoryCache.get(cacheKey);
  if (cached) return cached;

  const size = 320;
  if (!sharedAvatarCanvas && typeof document !== 'undefined') {
    sharedAvatarCanvas = document.createElement('canvas');
    sharedAvatarCanvas.width = size;
    sharedAvatarCanvas.height = size;
  }
  const canvas = sharedAvatarCanvas || document.createElement('canvas');
  if (canvas.width !== size) canvas.width = size;
  if (canvas.height !== size) canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';
  ctx.clearRect(0, 0, size, size);

  // 1. Background Pas Foto Resmi (Merah #DC2626 / Biru #0284C7)
  const grad = ctx.createLinearGradient(0, 0, 0, size);
  if (bgColor === 'merah') {
    grad.addColorStop(0, '#ef4444');
    grad.addColorStop(1, '#991b1b');
  } else {
    grad.addColorStop(0, '#0284c7');
    grad.addColorStop(1, '#1e3a8a');
  }
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  // Subtle radial glow behind head
  const glow = ctx.createRadialGradient(size / 2, size * 0.42, 10, size / 2, size * 0.42, 140);
  glow.addColorStop(0, 'rgba(255,255,255,0.24)');
  glow.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, size, size);

  const initials = getStudentInitials(namaSiswa || 'Siswa ANBK');

  if (style === 'inisial') {
    // Formal Emblem Badge
    ctx.beginPath();
    ctx.arc(size / 2, size * 0.44, 74, 0, Math.PI * 2);
    ctx.fillStyle = '#0f172a';
    ctx.fill();
    ctx.lineWidth = 5;
    ctx.strokeStyle = '#fbbf24';
    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.font = '800 56px "Plus Jakarta Sans", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(initials, size / 2, size * 0.44);
  } else {
    // Draw Formal SMP Student Silhouette & Uniform (Putih-Biru SMP)
    const cx = size / 2;

    // Shoulders / White Shirt (Seragam Putih SMP)
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(cx - 108, size);
    ctx.quadraticCurveTo(cx - 98, size * 0.68, cx - 42, size * 0.64);
    ctx.lineTo(cx + 42, size * 0.64);
    ctx.quadraticCurveTo(cx + 98, size * 0.68, cx + 108, size);
    ctx.closePath();
    ctx.fillStyle = '#f8fafc';
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#cbd5e1';
    ctx.stroke();

    // Shirt shadow & collar V-neck
    ctx.beginPath();
    ctx.moveTo(cx - 26, size * 0.63);
    ctx.lineTo(cx, size * 0.77);
    ctx.lineTo(cx + 26, size * 0.63);
    ctx.closePath();
    ctx.fillStyle = '#e2e8f0';
    ctx.fill();

    // Navy Blue SMP Tie (Dasi SMP Biru Dongker)
    ctx.beginPath();
    ctx.moveTo(cx - 9, size * 0.69);
    ctx.lineTo(cx + 9, size * 0.69);
    ctx.lineTo(cx + 13, size * 0.92);
    ctx.lineTo(cx, size * 0.98);
    ctx.lineTo(cx - 13, size * 0.92);
    ctx.closePath();
    ctx.fillStyle = '#1e3a8a';
    ctx.fill();

    // Tie knot
    ctx.beginPath();
    ctx.moveTo(cx - 11, size * 0.67);
    ctx.lineTo(cx + 11, size * 0.67);
    ctx.lineTo(cx + 8, size * 0.73);
    ctx.lineTo(cx - 8, size * 0.73);
    ctx.closePath();
    ctx.fillStyle = '#172554';
    ctx.fill();

    // Collar flaps
    ctx.beginPath();
    ctx.moveTo(cx - 38, size * 0.62);
    ctx.lineTo(cx - 6, size * 0.71);
    ctx.lineTo(cx - 24, size * 0.76);
    ctx.closePath();
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(cx + 38, size * 0.62);
    ctx.lineTo(cx + 6, size * 0.71);
    ctx.lineTo(cx + 24, size * 0.76);
    ctx.closePath();
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.stroke();

    // OSIS Pocket Badge
    ctx.fillStyle = '#f59e0b';
    ctx.beginPath();
    ctx.arc(cx + 50, size * 0.82, 10, 0, Math.PI * 2);
    ctx.fill();

    // Neck
    ctx.fillStyle = '#f1c27d';
    ctx.fillRect(cx - 18, size * 0.52, 36, 36);

    if (style === 'hijab') {
      // White Hijab SMP
      ctx.beginPath();
      ctx.arc(cx, size * 0.39, 58, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.fill();

      ctx.beginPath();
      ctx.moveTo(cx - 58, size * 0.41);
      ctx.quadraticCurveTo(cx - 68, size * 0.68, cx - 48, size * 0.77);
      ctx.quadraticCurveTo(cx, size * 0.86, cx + 48, size * 0.77);
      ctx.quadraticCurveTo(cx + 68, size * 0.68, cx + 58, size * 0.41);
      ctx.closePath();
      ctx.fillStyle = '#f8fafc';
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#e2e8f0';
      ctx.stroke();
    } else if (style === 'putri') {
      // Back hair for female student
      ctx.beginPath();
      ctx.arc(cx, size * 0.4, 56, 0, Math.PI * 2);
      ctx.fillStyle = '#1e293b';
      ctx.fill();
      ctx.fillRect(cx - 54, size * 0.38, 108, 65);
    }

    // Face
    ctx.beginPath();
    ctx.arc(cx, size * 0.39, 44, 0, Math.PI * 2);
    ctx.fillStyle = '#f6d096';
    ctx.fill();

    // Hair top
    if (style === 'putra') {
      ctx.beginPath();
      ctx.arc(cx, size * 0.35, 46, Math.PI, Math.PI * 2);
      ctx.fillStyle = '#0f172a';
      ctx.fill();
      // Neat side part
      ctx.beginPath();
      ctx.moveTo(cx - 45, size * 0.36);
      ctx.quadraticCurveTo(cx, size * 0.25, cx + 45, size * 0.36);
      ctx.quadraticCurveTo(cx + 46, size * 0.2, cx, size * 0.2);
      ctx.quadraticCurveTo(cx - 46, size * 0.2, cx - 45, size * 0.36);
      ctx.fillStyle = '#0f172a';
      ctx.fill();
    } else if (style === 'putri') {
      ctx.beginPath();
      ctx.arc(cx, size * 0.34, 46, Math.PI * 0.95, Math.PI * 2.05);
      ctx.fillStyle = '#0f172a';
      ctx.fill();
    } else if (style === 'hijab') {
      // Inner hijab cap
      ctx.beginPath();
      ctx.arc(cx, size * 0.35, 44, Math.PI * 1.08, Math.PI * 1.92);
      ctx.fillStyle = '#e2e8f0';
      ctx.fill();
    }

    // Eyes & Smile
    ctx.fillStyle = '#1e293b';
    ctx.beginPath();
    ctx.arc(cx - 15, size * 0.39, 4, 0, Math.PI * 2);
    ctx.arc(cx + 15, size * 0.39, 4, 0, Math.PI * 2);
    ctx.fill();

    // Friendly confident smile
    ctx.beginPath();
    ctx.arc(cx, size * 0.43, 12, 0.15 * Math.PI, 0.85 * Math.PI);
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#9a3412';
    ctx.stroke();
    ctx.restore();
  }

  // Top corner badge (MERAH / BIRU indicator)
  ctx.fillStyle = bgColor === 'merah' ? 'rgba(127, 29, 29, 0.85)' : 'rgba(12, 74, 110, 0.85)';
  ctx.fillRect(0, 0, size, 26);
  ctx.fillStyle = '#fde047';
  ctx.font = '800 10px "IBM Plex Mono", monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(
    bgColor === 'merah'
      ? 'PAS FOTO RESMI ANBK · LATAR MERAH'
      : 'PAS FOTO RESMI ANBK · LATAR BIRU',
    size / 2,
    13
  );

  // Bottom Nameplate Overlay
  ctx.fillStyle = 'rgba(2, 6, 23, 0.86)';
  ctx.fillRect(0, size - 52, size, 52);
  ctx.fillStyle = '#fbbf24';
  ctx.fillRect(0, size - 52, size, 3);

  ctx.fillStyle = '#ffffff';
  ctx.font = '800 15px "Plus Jakarta Sans", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const truncatedName = cleanName.length > 22 ? cleanName.slice(0, 20) + '…' : cleanName;
  ctx.fillText(truncatedName, size / 2, size - 32);

  ctx.fillStyle = '#38bdf8';
  ctx.font = '700 12px "IBM Plex Mono", monospace';
  ctx.fillText(`KELAS ${cleanKelas} · SMPN 7 KISARAN`, size / 2, size - 14);

  const dataUrl = canvas.toDataURL('image/jpeg', 0.82);
  if (formalAvatarMemoryCache.size > 250) {
    formalAvatarMemoryCache.clear();
  }
  formalAvatarMemoryCache.set(cacheKey, dataUrl);
  return dataUrl;
}

/**
 * Menerapkan Latar Merah (#EE0000) atau Latar Biru (#0284C7) pada foto kamera / unggahan siswa
 * dengan mengganti latar belakang terang/polos serta menambahkan bingkai Pas Foto Resmi ANBK.
 */
export function applyFormalBackdropToPhotoDataUrl(
  rawPhotoDataUrl: string,
  namaSiswa: string,
  kelasSiswa: string,
  bgColor: StudentPhotoBgColor
): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const size = 320;
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(rawPhotoDataUrl);
        return;
      }

      // 1. Gambar latar belakang Pas Foto Resmi (Merah / Biru)
      const grad = ctx.createLinearGradient(0, 0, 0, size);
      if (bgColor === 'merah') {
        grad.addColorStop(0, '#ef4444');
        grad.addColorStop(1, '#991b1b');
      } else {
        grad.addColorStop(0, '#0284c7');
        grad.addColorStop(1, '#1e3a8a');
      }
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, size, size);

      // Cahaya studio lembut di tengah
      const glow = ctx.createRadialGradient(size / 2, size * 0.42, 10, size / 2, size * 0.42, 155);
      glow.addColorStop(0, 'rgba(255,255,255,0.22)');
      glow.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, size, size);

      // 2. Proses foto asli pada kanvas sementara untuk mengganti latar polos (chroma/corner key)
      //    dan membingkai subjek di tengah latar Merah/Biru
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = size;
      tempCanvas.height = size;
      const tempCtx = tempCanvas.getContext('2d');
      if (tempCtx) {
        tempCtx.drawImage(img, 0, 0, size, size);
        try {
          const imgData = tempCtx.getImageData(0, 0, size, size);
          const data = imgData.data;
          // Ambil sampel warna sudut kiri atas & kanan atas sebagai referensi warna latar asli
          const c1 = [data[0], data[1], data[2]];
          const idxTR = (size - 1) * 4;
          const c2 = [data[idxTR], data[idxTR + 1], data[idxTR + 2]];

          for (let y = 0; y < size; y++) {
            for (let x = 0; x < size; x++) {
              const i = (y * size + x) * 4;
              const r = data[i];
              const g = data[i + 1];
              const b = data[i + 2];

              // Jarak ke warna sudut (background wall)
              const d1 = Math.hypot(r - c1[0], g - c1[1], b - c1[2]);
              const d2 = Math.hypot(r - c2[0], g - c2[1], b - c2[2]);
              const minCornerDist = Math.min(d1, d2);

              // Lindungi area wajah & tubuh tengah (elips tengah)
              const nx = (x - size / 2) / (size * 0.36);
              const ny = (y - size * 0.5) / (size * 0.44);
              const radialDist = Math.sqrt(nx * nx + ny * ny);

              if (radialDist > 0.72 && minCornerDist < 42) {
                const fade = Math.max(0, Math.min(1, (42 - minCornerDist) / 28));
                data[i + 3] = Math.round(data[i + 3] * (1 - fade * 0.92));
              }
            }
          }
          tempCtx.putImageData(imgData, 0, 0);
        } catch {
          // Abaikan jika canvas tainted
        }

        // Gambar foto di dalam bingkai Pas Foto Studio dengan tepi latar Merah/Biru yang jelas terlihat
        const pad = 18;
        const frameW = size - pad * 2;
        const frameH = size - 52 - pad;

        ctx.save();
        ctx.beginPath();
        ctx.roundRect(pad, 26, frameW, frameH - 12, 18);
        ctx.clip();
        ctx.drawImage(tempCanvas, pad, 26, frameW, frameH - 12);
        ctx.restore();

        // Garis tepi emas tipis pada bingkai pas foto dalam
        ctx.save();
        ctx.beginPath();
        ctx.roundRect(pad, 26, frameW, frameH - 12, 18);
        ctx.lineWidth = 2.5;
        ctx.strokeStyle = 'rgba(251, 191, 36, 0.85)';
        ctx.stroke();
        ctx.restore();
      }

      // 3. Header Latar Merah / Biru
      ctx.fillStyle = bgColor === 'merah' ? 'rgba(153, 27, 27, 0.92)' : 'rgba(12, 74, 110, 0.92)';
      ctx.fillRect(0, 0, size, 22);
      ctx.fillStyle = '#fde047';
      ctx.font = '800 10px "IBM Plex Mono", monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(
        bgColor === 'merah'
          ? 'PAS FOTO RESMI ANBK · LATAR MERAH'
          : 'PAS FOTO RESMI ANBK · LATAR BIRU',
        size / 2,
        11
      );

      // 4. Papan Nama Bawah
      const cleanName = (namaSiswa || 'PESERTA ANBK').trim().toUpperCase();
      ctx.fillStyle = 'rgba(2, 6, 23, 0.88)';
      ctx.fillRect(0, size - 52, size, 52);
      ctx.fillStyle = '#fbbf24';
      ctx.fillRect(0, size - 52, size, 3);

      ctx.fillStyle = '#ffffff';
      ctx.font = '800 15px "Plus Jakarta Sans", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const truncatedName = cleanName.length > 22 ? cleanName.slice(0, 20) + '…' : cleanName;
      ctx.fillText(truncatedName, size / 2, size - 32);

      ctx.fillStyle = '#38bdf8';
      ctx.font = '700 12px "IBM Plex Mono", monospace';
      ctx.fillText(`KELAS ${kelasSiswa || 'VIII-1'} · SMPN 7 KISARAN`, size / 2, size - 14);

      resolve(canvas.toDataURL('image/jpeg', 0.9));
    };
    img.onerror = () => resolve(rawPhotoDataUrl);
    img.src = rawPhotoDataUrl;
  });
}

const ALL_KELAS_OPTIONS = [
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

interface StudentCameraProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  namaSiswa: string;
  nisNisn: string;
  kelasSiswa?: string;
  semesterSiswa?: 'Ganjil' | 'Genap';
  currentPhotoUrl: string;
  isLocked?: boolean;
  lockReason?: string;
  onSaveProfile: (updated: {
    namaSiswa: string;
    nisNisn: string;
    kelasSiswa?: string;
    semesterSiswa?: 'Ganjil' | 'Genap';
    photoDataUrl: string;
  }) => void;
}

export const StudentCameraProfileModal: React.FC<StudentCameraProfileModalProps> = ({
  isOpen,
  onClose,
  namaSiswa,
  nisNisn,
  kelasSiswa = 'VIII-1',
  semesterSiswa = 'Ganjil',
  currentPhotoUrl,
  isLocked = false,
  lockReason = '',
  onSaveProfile,
}) => {
  // Status Penguncian Khusus Identitas Siswa (Nama Lengkap, NIS/NISN, Kelas, Semester): TIDAK BISA DI EDIT setelah memulai ujian, selesai ujian, maupun masuk ke menu Classroom
  const isExamStartedStored =
    typeof window !== 'undefined' &&
    (localStorage.getItem('anbk_exam_has_started') === 'true' ||
      localStorage.getItem('anbk_exam_in_progress') === 'true');

  const isExamCompletedStored =
    typeof window !== 'undefined' &&
    localStorage.getItem('anbk_exam_has_completed') === 'true';

  const isClassroomEnteredStored =
    typeof window !== 'undefined' &&
    localStorage.getItem('anbk_classroom_has_entered') === 'true';

  // Status Penguncian Khusus Identitas Siswa: hanya terkunci jika siswa sudah mengisi identitas (Nama Lengkap) dan sudah memulai/menyelesaikan ujian
  const hasRealTypedIdentity = Boolean(
    namaSiswa &&
      namaSiswa.trim() &&
      namaSiswa.trim().toLowerCase() !== 'peserta ujian' &&
      namaSiswa.trim().toLowerCase() !== 'peserta ujian anbk' &&
      namaSiswa.trim().toLowerCase() !== 'belum mengisi nama siswa'
  );

  const isIdentityLocked =
    hasRealTypedIdentity &&
    (Boolean(isLocked) ||
      isExamStartedStored ||
      isExamCompletedStored ||
      isClassroomEnteredStored);

  const identityLockReason =
    lockReason ||
    (isExamCompletedStored
      ? 'Ujian Telah Selesai Dikerjakan'
      : isExamStartedStored
      ? 'Sesi Ujian Telah Dimulai'
      : isClassroomEnteredStored
      ? 'Telah Masuk ke Menu Classroom'
      : 'Ujian Telah Dimulai / Selesai / Masuk Classroom');

  // Fitur kamera & foto profil tetap terbuka normal
  const effectiveIsLocked = false;
  const effectiveLockReason = '';

  const sanitizeStudentNameValue = (val?: string): string => {
    if (!val) return '';
    const trimmed = val.trim();
    const lower = trimmed.toLowerCase();
    if (
      lower === 'peserta ujian' ||
      lower === 'peserta ujian anbk' ||
      lower === 'belum mengisi nama siswa' ||
      lower === 'belum mengisi nama'
    ) {
      return '';
    }
    return val;
  };

  const [nameInput, setNameInput] = useState<string>(() => sanitizeStudentNameValue(namaSiswa));
  const [nameInputError, setNameInputError] = useState<string | null>(null);
  const nameInputErrorTimerRef = useRef<number | null>(null);
  const triggerModalNameError = (msg: string) => {
    setNameInputError(msg);
    if (nameInputErrorTimerRef.current) {
      window.clearTimeout(nameInputErrorTimerRef.current);
    }
    nameInputErrorTimerRef.current = window.setTimeout(() => {
      setNameInputError(null);
    }, 4500);
  };
  const [nisInput, setNisInput] = useState<string>(() => {
    if (!nisNisn || nisNisn === '0098123456' || nisNisn === '0' || nisNisn === '-') {
      return '';
    }
    return nisNisn;
  });
  const [kelasInput, setKelasInput] = useState<string>(kelasSiswa || 'VIII-1');
  const [semesterInput, setSemesterInput] = useState<'Ganjil' | 'Genap'>(
    semesterSiswa || 'Ganjil'
  );
  const [previewPhoto, setPreviewPhoto] = useState<string>(currentPhotoUrl);
  const [rawCapturedOrUploadedPhoto, setRawCapturedOrUploadedPhoto] = useState<string>('');
  const [selectedAvatarStyle, setSelectedAvatarStyle] =
    useState<StudentAvatarPresetStyle>('putra');
  const [photoSourceMode, setPhotoSourceMode] = useState<'raw' | 'framed' | 'avatar'>('avatar');
  const [isCameraActive, setIsCameraActive] = useState<boolean>(false);
  const [isVideoReady, setIsVideoReady] = useState<boolean>(false);
  const [isStartingCamera, setIsStartingCamera] = useState<boolean>(false);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');
  const [mirrorVideo, setMirrorVideo] = useState<boolean>(true);
  const [countdownSec, setCountdownSec] = useState<number | null>(null);
  const [shutterFlash, setShutterFlash] = useState<boolean>(false);
  const [isDraggingOver, setIsDraggingOver] = useState<boolean>(false);
  const [avatarBgColor, setAvatarBgColor] = useState<StudentPhotoBgColor>('merah');
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const stopCameraStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch {
          // ignore
        }
      });
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsCameraActive(false);
    setIsVideoReady(false);
    setIsStartingCamera(false);
    setCountdownSec(null);
  }, []);

  // Callback ref untuk memastikan elemen <video> langsung terhubung ke MediaStream begitu di-render
  const setVideoElementRef = useCallback((el: HTMLVideoElement | null) => {
    videoRef.current = el;
    if (el && streamRef.current) {
      el.srcObject = streamRef.current;
      el.play().catch(() => {});
    }
  }, []);

  useEffect(() => {
    if (isCameraActive && videoRef.current && streamRef.current) {
      if (videoRef.current.srcObject !== streamRef.current) {
        videoRef.current.srcObject = streamRef.current;
      }
      videoRef.current.play().catch(() => {});
    }
  }, [isCameraActive]);

  const refreshVideoDevices = useCallback(async () => {
    if (
      typeof navigator === 'undefined' ||
      !navigator.mediaDevices ||
      typeof navigator.mediaDevices.enumerateDevices !== 'function'
    ) {
      return;
    }
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const cams = devices.filter((d) => d.kind === 'videoinput');
      setVideoDevices(cams);
    } catch {
      // ignore
    }
  }, []);

  const startCameraStream = useCallback(
    async (mode: 'user' | 'environment' = facingMode, specificDeviceId?: string) => {
      setCameraError(null);
      setStatusMessage(null);
      if (effectiveIsLocked) {
        setCameraError('Identitas dan foto siswa telah terkunci permanen.');
        return;
      }
      setIsStartingCamera(true);
      stopCameraStream();

      if (
        typeof navigator === 'undefined' ||
        !navigator.mediaDevices ||
        typeof navigator.mediaDevices.getUserMedia !== 'function'
      ) {
        setIsStartingCamera(false);
        setCameraError(
          'Browser pada perangkat ini tidak mendukung kamera WebRTC langsung. Silakan klik tombol "Pilih File / Galeri" atau pilih "Pas Foto Siswa SMP Otomatis" di bawah.'
        );
        return;
      }

      try {
        let mediaStream: MediaStream;
        const targetDevId = specificDeviceId !== undefined ? specificDeviceId : selectedDeviceId;

        const isPortrait = typeof window !== 'undefined' && window.innerHeight > window.innerWidth;
        try {
          if (targetDevId) {
            mediaStream = await navigator.mediaDevices.getUserMedia({
              video: {
                deviceId: { exact: targetDevId },
                width: { ideal: isPortrait ? 2160 : 3840 },
                height: { ideal: isPortrait ? 3840 : 2160 },
              },
              audio: false,
            });
          } else {
            mediaStream = await navigator.mediaDevices.getUserMedia({
              video: {
                facingMode: { ideal: mode },
                width: { ideal: isPortrait ? 2160 : 3840 },
                height: { ideal: isPortrait ? 3840 : 2160 },
              },
              audio: false,
            });
          }
        } catch {
          try {
            mediaStream = await navigator.mediaDevices.getUserMedia({
              video: {
                facingMode: { ideal: mode },
                width: { ideal: isPortrait ? 1080 : 1920 },
                height: { ideal: isPortrait ? 1920 : 1080 },
              },
              audio: false,
            });
          } catch {
            mediaStream = await navigator.mediaDevices.getUserMedia({
              video: true,
              audio: false,
            });
          }
        }

        streamRef.current = mediaStream;
        setIsCameraActive(true);
        setIsStartingCamera(false);
        refreshVideoDevices();

        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
          videoRef.current.play().catch(() => {});
        }
      } catch (err) {
        setIsStartingCamera(false);
        setIsCameraActive(false);
        const msg = err instanceof Error ? err.message : '';
        setCameraError(
          `Kamera perangkat tidak ditemukan atau izin kamera ditolak (${
            msg || 'NotAllowedError'
          }). Anda tetap dapat langsung memilih Latar Merah / Latar Biru atau mengunggah file foto di bawah!`
        );
      }
    },
    [facingMode, selectedDeviceId, stopCameraStream, refreshVideoDevices]
  );

  useEffect(() => {
    if (isOpen) {
      const stored = loadStoredStudentProfile();
      const initialName = sanitizeStudentNameValue(namaSiswa).trim();
      const initialNis =
        !nisNisn || nisNisn === '0098123456' || nisNisn === '0' || nisNisn === '-'
          ? ''
          : nisNisn.trim();
      const initialKls = kelasSiswa || 'VIII-1';
      const initialSem = semesterSiswa || 'Ganjil';
      const initialPhoto =
        currentPhotoUrl ||
        stored.photoDataUrl ||
        getPhotoForStudentIdentity(initialName, initialNis) ||
        '';

      setNameInput(initialName);
      setNisInput(initialNis);
      setKelasInput(initialKls);
      setSemesterInput(initialSem);
      setPreviewPhoto(initialPhoto);
      setRawCapturedOrUploadedPhoto(initialPhoto);
      setPhotoSourceMode(initialPhoto ? 'raw' : 'avatar');
      setCameraError(null);
      setStatusMessage(null);
      refreshVideoDevices();

      // Otomatis nyalakan kamera jika belum ada foto profil tersimpan (hanya jika belum terkunci)
      if (!initialPhoto && !effectiveIsLocked) {
        startCameraStream('user');
      }
    } else {
      stopCameraStream();
    }
    return () => {
      stopCameraStream();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  // Perbarui otomatis Nama & Kelas pada Pas Foto jika siswa sedang menggunakan mode Pas Foto / Bingkai Latar Merah-Biru
  useEffect(() => {
    if (!isOpen || isCameraActive) return;
    if (photoSourceMode === 'avatar' && previewPhoto) {
      const updated = generateFormalStudentAvatarDataUrl(
        nameInput.trim() || namaSiswa.trim() || 'Peserta Ujian ANBK',
        kelasInput || kelasSiswa || 'VIII-1',
        selectedAvatarStyle,
        avatarBgColor
      );
      if (updated) {
        setPreviewPhoto(updated);
      }
    } else if (photoSourceMode === 'framed' && rawCapturedOrUploadedPhoto) {
      applyFormalBackdropToPhotoDataUrl(
        rawCapturedOrUploadedPhoto,
        nameInput.trim() || namaSiswa.trim() || 'Peserta Ujian ANBK',
        kelasInput || kelasSiswa || 'VIII-1',
        avatarBgColor
      ).then((framedUrl) => {
        if (framedUrl) setPreviewPhoto(framedUrl);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nameInput, kelasInput]);

  const captureCurrentVideoFrame = useCallback((): string => {
    const video = videoRef.current;
    if (!video || !isCameraActive) return '';
    const vw = video.videoWidth || video.clientWidth || 640;
    const vh = video.videoHeight || video.clientHeight || 480;
    return compressImageToDataUrl(
      video,
      vw,
      vh,
      facingMode === 'user' && mirrorVideo,
      320
    );
  }, [isCameraActive, facingMode, mirrorVideo]);

  const handleCaptureFromVideo = useCallback(() => {
    const dataUrl = captureCurrentVideoFrame();
    if (dataUrl) {
      setShutterFlash(true);
      setTimeout(() => setShutterFlash(false), 220);
      setRawCapturedOrUploadedPhoto(dataUrl);
      setPhotoSourceMode('raw');
      setPreviewPhoto(dataUrl);
      stopCameraStream();
      setStatusMessage(
        'Foto profil berhasil dijepret dari kamera! Anda dapat memilih "Latar Merah" / "Latar Biru" atau langsung klik "Simpan Foto & Tampilkan di Header".'
      );
    } else {
      setCameraError(
        'Gambar kamera sedang dimuat. Tunggu 1 detik hingga video tampil lalu tekan Jepret Foto kembali, atau gunakan Pas Foto Otomatis.'
      );
    }
  }, [captureCurrentVideoFrame, stopCameraStream]);

  // Countdown Timer 3 Detik sebelum jepret otomatis
  useEffect(() => {
    if (countdownSec === null) return;
    if (countdownSec <= 0) {
      setCountdownSec(null);
      handleCaptureFromVideo();
      return;
    }
    const timer = setTimeout(() => {
      setCountdownSec((prev) => (prev !== null ? prev - 1 : null));
    }, 1000);
    return () => clearTimeout(timer);
  }, [countdownSec, handleCaptureFromVideo]);

  const handleSwitchCameraFacing = () => {
    if (videoDevices.length > 1) {
      const currentIdx = videoDevices.findIndex((d) => d.deviceId === selectedDeviceId);
      const nextDevice = videoDevices[(currentIdx + 1) % videoDevices.length];
      if (nextDevice) {
        setSelectedDeviceId(nextDevice.deviceId);
        startCameraStream(facingMode, nextDevice.deviceId);
        return;
      }
    }
    const nextMode = facingMode === 'user' ? 'environment' : 'user';
    setFacingMode(nextMode);
    setMirrorVideo(nextMode === 'user');
    startCameraStream(nextMode, '');
  };

  const processImageFile = useCallback(
    (file: File) => {
      if (!file.type.startsWith('image/')) {
        setCameraError('File yang dipilih harus berupa gambar (.JPG, .PNG, .WEBP).');
        return;
      }
      setCameraError(null);

      const reader = new FileReader();
      reader.onload = () => {
        const resultStr = typeof reader.result === 'string' ? reader.result : '';
        if (!resultStr) return;

        const img = new Image();
        img.onload = () => {
          const compressed = compressImageToDataUrl(
            img,
            img.naturalWidth || img.width || 320,
            img.naturalHeight || img.height || 320,
            false,
            320
          );
          if (compressed) {
            setRawCapturedOrUploadedPhoto(compressed);
            setPhotoSourceMode('raw');
            setPreviewPhoto(compressed);
            stopCameraStream();
            setStatusMessage(
              'Foto berhasil dimuat! Anda juga dapat menekan tombol "Latar Merah" atau "Latar Biru" untuk memberi latar pas foto resmi, lalu klik Simpan.'
            );
          }
        };
        img.onerror = () => {
          setCameraError('Gagal membaca file gambar. Silakan pilih file foto lain.');
        };
        img.src = resultStr;
      };
      reader.readAsDataURL(file);
    },
    [stopCameraStream]
  );

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processImageFile(file);
    }
    e.target.value = '';
  };

  const handleDropFile = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      processImageFile(file);
    }
  };

  // Handler Klik Tombol Latar Merah / Latar Biru -> Langsung aktif & menerapkan warna latar pada Pas Foto!
  const handleSelectBgColor = async (nextBg: StudentPhotoBgColor) => {
    setAvatarBgColor(nextBg);
    setCameraError(null);

    const activeName = nameInput.trim() || namaSiswa.trim() || 'Peserta Ujian ANBK';
    const activeKls = kelasInput || kelasSiswa || 'VIII-1';

    // Jika kamera sedang aktif, cek apakah bisa jepret frame kamera terlebih dahulu
    let currentRaw = rawCapturedOrUploadedPhoto;
    if (isCameraActive && isVideoReady) {
      const snapped = captureCurrentVideoFrame();
      if (snapped) {
        currentRaw = snapped;
        setRawCapturedOrUploadedPhoto(snapped);
      }
    }
    stopCameraStream();

    // Jika sebelumnya sudah ada foto asli dari kamera/file (mode 'raw' atau 'framed'), terapkan Latar Merah/Biru pada foto tersebut
    if (currentRaw && (photoSourceMode === 'raw' || photoSourceMode === 'framed')) {
      setPhotoSourceMode('framed');
      const framedUrl = await applyFormalBackdropToPhotoDataUrl(
        currentRaw,
        activeName,
        activeKls,
        nextBg
      );
      if (framedUrl) {
        setPreviewPhoto(framedUrl);
        setStatusMessage(
          nextBg === 'merah'
            ? '✓ Latar Merah Resmi ANBK berhasil diterapkan pada Foto Profil Siswa!'
            : '✓ Latar Biru Resmi ANBK berhasil diterapkan pada Foto Profil Siswa!'
        );
        return;
      }
    }

    // Jika menggunakan Pas Foto Siswa SMP Otomatis (atau belum ada foto sama sekali), langsung generate dengan Latar Merah / Latar Biru
    setPhotoSourceMode('avatar');
    const generated = generateFormalStudentAvatarDataUrl(
      activeName,
      activeKls,
      selectedAvatarStyle,
      nextBg
    );
    if (generated) {
      setPreviewPhoto(generated);
      setStatusMessage(
        nextBg === 'merah'
          ? '✓ Pas Foto Siswa SMP dengan Latar Merah berhasil diterapkan! Klik "Simpan Foto & Tampilkan di Header" untuk menyimpan.'
          : '✓ Pas Foto Siswa SMP dengan Latar Biru berhasil diterapkan! Klik "Simpan Foto & Tampilkan di Header" untuk menyimpan.'
      );
    }
  };

  const handleApplyPresetAvatar = (style: StudentAvatarPresetStyle) => {
    stopCameraStream();
    setCameraError(null);
    setSelectedAvatarStyle(style);
    setPhotoSourceMode('avatar');
    const generated = generateFormalStudentAvatarDataUrl(
      nameInput.trim() || namaSiswa.trim() || 'Peserta Ujian ANBK',
      kelasInput || kelasSiswa || 'VIII-1',
      style,
      avatarBgColor
    );
    if (generated) {
      setPreviewPhoto(generated);
      setStatusMessage(
        `✓ Pas Foto Siswa SMP (${
          avatarBgColor === 'merah' ? 'Latar Merah' : 'Latar Biru'
        }) berhasil dibuat! Klik "Simpan Foto & Tampilkan di Header" untuk menyimpan.`
      );
    }
  };

  const handleSaveAndClose = (e: React.FormEvent) => {
    e.preventDefault();
    if (effectiveIsLocked) {
      stopCameraStream();
      onClose();
      return;
    }
    const actualName = isIdentityLocked
      ? sanitizeStudentNameValue(namaSiswa).trim()
      : sanitizeStudentNameValue(nameInput).trim();
    const displayNameForAvatar = actualName || 'Peserta Ujian ANBK';
    const finalNis = isIdentityLocked
      ? nisNisn.trim()
      : (nisInput.trim() || nisNisn.trim());
    const finalKelas = isIdentityLocked
      ? (kelasSiswa || 'VIII-1')
      : (kelasInput || kelasSiswa || 'VIII-1');
    const finalSemester = isIdentityLocked
      ? (semesterSiswa || 'Ganjil')
      : (semesterInput || semesterSiswa || 'Ganjil');

    let finalPhoto = previewPhoto;
    if (isCameraActive && !finalPhoto) {
      const captured = captureCurrentVideoFrame();
      if (captured) {
        finalPhoto = captured;
      }
    }
    if (!finalPhoto) {
      finalPhoto = generateFormalStudentAvatarDataUrl(
        displayNameForAvatar,
        finalKelas,
        selectedAvatarStyle,
        avatarBgColor
      );
    }

    saveStoredStudentProfile({
      namaSiswa: actualName,
      nisNisn: finalNis,
      kelasSiswa: finalKelas,
      semesterSiswa: finalSemester,
      photoDataUrl: finalPhoto,
    });

    onSaveProfile({
      namaSiswa: actualName,
      nisNisn: finalNis,
      kelasSiswa: finalKelas,
      semesterSiswa: finalSemester,
      photoDataUrl: finalPhoto,
    });

    stopCameraStream();
    onClose();
  };

  const handleRemovePhoto = () => {
    if (effectiveIsLocked) return;
    setPreviewPhoto('');
    setRawCapturedOrUploadedPhoto('');
    setPhotoSourceMode('avatar');
    const actualName = isIdentityLocked
      ? sanitizeStudentNameValue(namaSiswa).trim()
      : sanitizeStudentNameValue(nameInput).trim();
    const finalNis = isIdentityLocked
      ? nisNisn.trim()
      : (nisInput.trim() || nisNisn.trim());
    const finalKelas = isIdentityLocked
      ? (kelasSiswa || 'VIII-1')
      : (kelasInput || kelasSiswa || 'VIII-1');
    const finalSemester = isIdentityLocked
      ? (semesterSiswa || 'Ganjil')
      : (semesterInput || semesterSiswa || 'Ganjil');

    saveStoredStudentProfile({
      namaSiswa: actualName,
      nisNisn: finalNis,
      kelasSiswa: finalKelas,
      semesterSiswa: finalSemester,
      photoDataUrl: '',
    });
    onSaveProfile({
      namaSiswa: actualName,
      nisNisn: finalNis,
      kelasSiswa: finalKelas,
      semesterSiswa: finalSemester,
      photoDataUrl: '',
    });
    setStatusMessage('Foto profil siswa telah dihapus dari penyimpanan perangkat (localStorage).');
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-2 sm:p-3 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="student-camera-modal-title"
      onPaste={(e) => {
        const items = e.clipboardData?.items;
        if (!items) return;
        for (let i = 0; i < items.length; i++) {
          if (items[i].type.startsWith('image/')) {
            const file = items[i].getAsFile();
            if (file) {
              processImageFile(file);
              break;
            }
          }
        }
      }}
    >
      <div className="max-w-lg w-full rounded-xl border border-sky-500/40 bg-gradient-to-br from-slate-950 via-slate-900 to-sky-950 text-white shadow-2xl overflow-hidden my-auto">
        {/* Header Modal (Kompak, Rapi & Profesional) */}
        <div className="px-3 sm:px-3.5 py-2 border-b border-white/15 bg-slate-950/90 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-amber-400/20 border border-amber-400/40 flex items-center justify-center text-amber-300 shrink-0">
              <Camera className="w-3.5 h-3.5" />
            </div>
            <div>
              <span className="text-[8.5px] font-mono font-extrabold uppercase tracking-widest text-amber-300 block leading-tight">
                KAMERA PERANGKAT · UNGGAH FILE · PAS FOTO RESMI ANBK
              </span>
              <h3
                id="student-camera-modal-title"
                className="text-xs sm:text-sm font-extrabold text-white leading-tight"
              >
                Foto Profil &amp; Identitas Siswa
              </h3>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              stopCameraStream();
              onClose();
            }}
            className="p-1 rounded-md bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        <form onSubmit={handleSaveAndClose} className="p-2.5 sm:p-3.5 space-y-2.5">
          {/* Area Preview Kamera Live atau Hasil Foto Profil Siswa */}
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 sm:gap-3 items-start">
            {/* Bingkai Kamera / Foto Siswa (5 Kolom) */}
            <div className="sm:col-span-5 flex flex-col items-center gap-1.5">
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDraggingOver(true);
                }}
                onDragLeave={() => setIsDraggingOver(false)}
                onDrop={handleDropFile}
                className={`relative w-32 h-32 sm:w-36 sm:h-36 rounded-xl overflow-hidden border-2 shadow-lg flex items-center justify-center transition-all ${
                  isDraggingOver
                    ? 'border-emerald-400 ring-4 ring-emerald-400/30 scale-[1.02] bg-slate-900'
                    : avatarBgColor === 'merah'
                    ? 'border-rose-400/90 bg-gradient-to-b from-rose-600 to-rose-900'
                    : 'border-sky-400/90 bg-gradient-to-b from-sky-600 to-blue-900'
                }`}
              >
                {isCameraActive ? (
                  <>
                    <video
                      ref={setVideoElementRef}
                      autoPlay
                      playsInline
                      muted
                      onLoadedMetadata={() => setIsVideoReady(true)}
                      onCanPlay={() => setIsVideoReady(true)}
                      onPlaying={() => setIsVideoReady(true)}
                      className={`w-full h-full object-cover ${
                        facingMode === 'user' && mirrorVideo ? '-scale-x-100' : ''
                      }`}
                    />
                    {/* Garis Panduan Bingkai Wajah */}
                    <div className="absolute inset-2.5 rounded-full border-2 border-dashed border-amber-300/60 pointer-events-none" />
                    <span className="absolute top-1.5 left-1.5 px-1.5 py-0.2 rounded bg-rose-600/90 text-[9px] font-mono font-extrabold text-white flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
                      {isVideoReady ? 'LIVE KAMERA' : 'MEMUAT...'}
                    </span>
                    {countdownSec !== null && (
                      <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                        <span className="font-mono text-5xl font-extrabold text-amber-300 drop-shadow-lg animate-ping">
                          {countdownSec}
                        </span>
                      </div>
                    )}
                  </>
                ) : previewPhoto ? (
                  <>
                    <img
                      src={previewPhoto}
                      alt="Foto Profil Siswa"
                      className="w-full h-full object-cover"
                    />
                    <span className="absolute top-1.5 right-1.5 px-1.5 py-0.2 rounded bg-emerald-950/90 border border-emerald-400/60 text-[8.5px] font-mono font-extrabold text-emerald-300">
                      ✓ SIAP SIMPAN
                    </span>
                  </>
                ) : (
                  <div className="flex flex-col items-center justify-center text-center p-3 space-y-1.5">
                    <div className="w-12 h-12 rounded-full bg-slate-950/85 border-2 border-amber-300 flex items-center justify-center text-base font-mono font-extrabold text-white shadow-md">
                      {getStudentInitials(nameInput || namaSiswa)}
                    </div>
                    <span className="text-[10px] text-white font-bold leading-tight drop-shadow">
                      Latar Merah / Biru / Pilih Foto
                    </span>
                  </div>
                )}

                {shutterFlash && (
                  <div className="absolute inset-0 bg-white animate-pulse pointer-events-none" />
                )}
              </div>

              {/* Kontrol Cepat Kamera saat Live */}
              {isCameraActive && (
                <div className="flex flex-wrap items-center gap-1 w-full justify-center">
                  <button
                    type="button"
                    onClick={handleSwitchCameraFacing}
                    className="px-2 py-1 rounded-md bg-slate-800 hover:bg-slate-700 border border-white/15 text-[10px] font-bold text-sky-200 flex items-center gap-1 cursor-pointer"
                  >
                    <RefreshCw className="w-3 h-3" />
                    <span>Putar Kamera</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setMirrorVideo((prev) => !prev)}
                    className="px-2 py-1 rounded-md bg-slate-800 hover:bg-slate-700 border border-white/15 text-[10px] font-bold text-amber-200 flex items-center gap-1 cursor-pointer"
                  >
                    <FlipHorizontal className="w-3 h-3" />
                    <span>Cermin</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setCountdownSec(3)}
                    disabled={countdownSec !== null}
                    className="px-2 py-1 rounded-md bg-slate-800 hover:bg-slate-700 border border-white/15 text-[10px] font-bold text-emerald-300 flex items-center gap-1 cursor-pointer disabled:opacity-50"
                  >
                    <Timer className="w-3 h-3" />
                    <span>Timer 3d</span>
                  </button>
                </div>
              )}

              {/* Pemilih Perangkat Webcam jika terdeteksi lebih dari 1 kamera */}
              {isCameraActive && videoDevices.length > 1 && (
                <select
                  value={selectedDeviceId}
                  onChange={(e) => {
                    const devId = e.target.value;
                    setSelectedDeviceId(devId);
                    startCameraStream(facingMode, devId);
                  }}
                  className="w-full px-2 py-1 rounded-md bg-slate-900 border border-white/15 text-[10px] text-slate-200 font-medium focus:outline-none focus:ring-1 focus:ring-amber-400"
                >
                  {videoDevices.map((dev, idx) => (
                    <option key={dev.deviceId || idx} value={dev.deviceId}>
                      {dev.label || `Kamera Perangkat #${idx + 1}`}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Tombol Aksi Kamera, Pas Foto Otomatis & Input Identitas Siswa (7 Kolom) */}
            <div className="sm:col-span-7 space-y-2.5">
              {/* 1. Tombol Utama Kamera Perangkat & Unggah Foto */}
              <div className="space-y-1.5">
                <label className="block text-[11px] font-extrabold uppercase tracking-wider text-amber-300">
                  1. Ambil Foto Kamera / Unggah
                </label>

                <div className="flex flex-wrap items-center gap-1.5">
                  {isCameraActive ? (
                    <button
                      type="button"
                      disabled={effectiveIsLocked}
                      onClick={handleCaptureFromVideo}
                      className="flex-1 py-1.5 px-3 rounded-lg bg-amber-400 hover:bg-amber-300 disabled:opacity-50 text-slate-950 font-extrabold text-[11px] flex items-center justify-center gap-1.5 shadow-md cursor-pointer disabled:cursor-not-allowed"
                    >
                      <Camera className="w-3.5 h-3.5 shrink-0" />
                      <span>Jepret Foto Sekarang</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={isStartingCamera || effectiveIsLocked}
                      onClick={() => {
                        if (effectiveIsLocked) return;
                        startCameraStream(facingMode);
                      }}
                      className={`flex-1 py-1.5 px-3 rounded-lg font-extrabold text-[11px] flex items-center justify-center gap-1.5 shadow-sm transition-all ${
                        effectiveIsLocked
                          ? 'bg-slate-800 border border-slate-700 text-slate-400 cursor-not-allowed'
                          : 'bg-sky-500 hover:bg-sky-400 disabled:opacity-60 text-slate-950 cursor-pointer'
                      }`}
                    >
                      {effectiveIsLocked ? (
                        <Lock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                      ) : (
                        <Camera className="w-3.5 h-3.5 shrink-0" />
                      )}
                      <span>
                        {effectiveIsLocked
                          ? 'Kamera Terkunci'
                          : isStartingCamera
                          ? 'Membuka...'
                          : previewPhoto
                          ? 'Foto Ulang'
                          : 'Buka Kamera Live'}
                      </span>
                    </button>
                  )}

                  <label
                    htmlFor={effectiveIsLocked ? undefined : 'student-gallery-upload-input'}
                    className={`py-1.5 px-3 rounded-lg border text-[11px] font-bold flex items-center justify-center gap-1.5 select-none transition-all ${
                      effectiveIsLocked
                        ? 'bg-slate-800/80 border-slate-700 text-slate-400 cursor-not-allowed'
                        : 'bg-white/10 hover:bg-white/20 border-white/20 text-white cursor-pointer'
                    }`}
                  >
                    {effectiveIsLocked ? (
                      <Lock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    ) : (
                      <Upload className="w-3.5 h-3.5 text-amber-300 shrink-0" />
                    )}
                    <span>{effectiveIsLocked ? 'Terkunci' : 'Pilih File'}</span>
                    {!effectiveIsLocked && (
                      <input
                        id="student-gallery-upload-input"
                        type="file"
                        accept="image/*"
                        onChange={handleFileInputChange}
                        className="sr-only"
                      />
                    )}
                  </label>

                  {previewPhoto && !effectiveIsLocked && (
                    <button
                      type="button"
                      onClick={handleRemovePhoto}
                      className="p-1.5 rounded-lg bg-rose-600/25 hover:bg-rose-600/40 border border-rose-400/40 text-rose-200 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* 2. Generator Pas Foto Siswa SMP Otomatis & Pilihan Warna Latar Merah / Biru */}
              <div className="p-2 rounded-lg bg-slate-950/85 border border-sky-500/30 space-y-1.5">
                <div className="flex flex-wrap items-center justify-between gap-1.5">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-sky-300 flex items-center gap-1">
                    <ImageIcon className="w-3 h-3 text-amber-300 shrink-0" />
                    <span>Latar Pas Foto Siswa:</span>
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      disabled={effectiveIsLocked}
                      onClick={() => {
                        if (effectiveIsLocked) return;
                        handleSelectBgColor('merah');
                      }}
                      className={`px-2 py-0.5 rounded-md text-[10.5px] font-extrabold border transition-all flex items-center gap-1 shadow-xs active:scale-95 ${
                        effectiveIsLocked
                          ? 'bg-slate-900 border-slate-700 text-slate-500 cursor-not-allowed'
                          : avatarBgColor === 'merah'
                          ? 'bg-rose-600 text-white border-amber-300 ring-1 ring-rose-500/40 cursor-pointer'
                          : 'bg-rose-950/70 hover:bg-rose-800/80 text-rose-200 border-rose-500/40 cursor-pointer'
                      }`}
                    >
                      <span className="w-2 h-2 rounded-full bg-red-400 border border-white shrink-0" />
                      <span>{avatarBgColor === 'merah' ? '✓ Merah' : 'Merah'}</span>
                    </button>
                    <button
                      type="button"
                      disabled={effectiveIsLocked}
                      onClick={() => {
                        if (effectiveIsLocked) return;
                        handleSelectBgColor('biru');
                      }}
                      className={`px-2 py-0.5 rounded-md text-[10.5px] font-extrabold border transition-all flex items-center gap-1 shadow-xs active:scale-95 ${
                        effectiveIsLocked
                          ? 'bg-slate-900 border-slate-700 text-slate-500 cursor-not-allowed'
                          : avatarBgColor === 'biru'
                          ? 'bg-sky-600 text-white border-amber-300 ring-1 ring-sky-500/40 cursor-pointer'
                          : 'bg-sky-950/70 hover:bg-sky-800/80 text-sky-200 border-sky-500/40 cursor-pointer'
                      }`}
                    >
                      <span className="w-2 h-2 rounded-full bg-sky-300 border border-white shrink-0" />
                      <span>{avatarBgColor === 'biru' ? '✓ Biru' : 'Biru'}</span>
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1">
                  <button
                    type="button"
                    disabled={effectiveIsLocked}
                    onClick={() => {
                      if (effectiveIsLocked) return;
                      handleApplyPresetAvatar('putra');
                    }}
                    className={`px-1.5 py-1 rounded-md border text-[10px] font-bold transition-colors text-center ${
                      effectiveIsLocked
                        ? 'bg-slate-900/60 border-slate-800 text-slate-500 cursor-not-allowed'
                        : photoSourceMode === 'avatar' && selectedAvatarStyle === 'putra'
                        ? 'bg-amber-400 text-slate-950 border-amber-300 font-extrabold shadow-xs cursor-pointer'
                        : 'bg-slate-900 hover:bg-slate-800 border-white/15 hover:border-amber-400/50 text-white cursor-pointer'
                    }`}
                  >
                    👦 Putra
                  </button>
                  <button
                    type="button"
                    disabled={effectiveIsLocked}
                    onClick={() => {
                      if (effectiveIsLocked) return;
                      handleApplyPresetAvatar('putri');
                    }}
                    className={`px-1.5 py-1 rounded-md border text-[10px] font-bold transition-colors text-center ${
                      effectiveIsLocked
                        ? 'bg-slate-900/60 border-slate-800 text-slate-500 cursor-not-allowed'
                        : photoSourceMode === 'avatar' && selectedAvatarStyle === 'putri'
                        ? 'bg-amber-400 text-slate-950 border-amber-300 font-extrabold shadow-xs cursor-pointer'
                        : 'bg-slate-900 hover:bg-slate-800 border-white/15 hover:border-amber-400/50 text-white cursor-pointer'
                    }`}
                  >
                    👧 Putri
                  </button>
                  <button
                    type="button"
                    disabled={effectiveIsLocked}
                    onClick={() => {
                      if (effectiveIsLocked) return;
                      handleApplyPresetAvatar('hijab');
                    }}
                    className={`px-1.5 py-1 rounded-md border text-[10px] font-bold transition-colors text-center ${
                      effectiveIsLocked
                        ? 'bg-slate-900/60 border-slate-800 text-slate-500 cursor-not-allowed'
                        : photoSourceMode === 'avatar' && selectedAvatarStyle === 'hijab'
                        ? 'bg-amber-400 text-slate-950 border-amber-300 font-extrabold shadow-xs cursor-pointer'
                        : 'bg-slate-900 hover:bg-slate-800 border-white/15 hover:border-amber-400/50 text-white cursor-pointer'
                    }`}
                  >
                    🧕 Hijab
                  </button>
                  <button
                    type="button"
                    disabled={effectiveIsLocked}
                    onClick={() => {
                      if (effectiveIsLocked) return;
                      handleApplyPresetAvatar('inisial');
                    }}
                    className={`px-1.5 py-1 rounded-md border text-[10px] font-bold transition-colors text-center ${
                      effectiveIsLocked
                        ? 'bg-slate-900/60 border-slate-800 text-slate-500 cursor-not-allowed'
                        : photoSourceMode === 'avatar' && selectedAvatarStyle === 'inisial'
                        ? 'bg-amber-400 text-slate-950 border-amber-300 font-extrabold shadow-xs cursor-pointer'
                        : 'bg-slate-900 hover:bg-slate-800 border-white/15 hover:border-amber-400/50 text-amber-300 cursor-pointer'
                    }`}
                  >
                    🎓 Inisial
                  </button>
                </div>
              </div>

              {/* 3. Input Nama Lengkap Siswa, NIS/NISN, Kelas & Semester (Tersimpan Permanen di localStorage) */}
              <div className="space-y-1.5 pt-0.5 border-t border-white/10">
                <div className="flex flex-wrap items-center justify-between gap-1">
                  <label className="block text-[10.5px] font-extrabold uppercase tracking-wider text-sky-300">
                    2. Identitas Siswa di Header Ujian
                  </label>
                  {isIdentityLocked && (
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded-full bg-rose-500/20 border border-rose-500/50 text-[9px] font-mono font-extrabold text-rose-300 uppercase shadow-xs">
                      <Lock className="w-2.5 h-2.5 text-rose-400" />
                      Terkunci
                    </span>
                  )}
                </div>

                {/* Banner Status Penguncian Khusus (Setelah Memulai Ujian / Selesai Ujian / Masuk Classroom) */}
                {isIdentityLocked && (
                  <div className="p-2 rounded-lg bg-amber-950/90 border border-amber-400/70 text-amber-200 text-[10.5px] space-y-1 shadow-sm">
                    <div className="flex items-center gap-1.5 font-extrabold text-amber-300">
                      <ShieldAlert className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                      <span className="uppercase tracking-wide">
                        Fitur Identitas Siswa Terkunci
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-200 leading-normal">
                      Identitas tidak dapat diedit lagi demi menjamin keaslian data peserta ujian.
                    </p>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-300 mb-0.5 flex items-center justify-between">
                      <span>Nama Lengkap Siswa</span>
                    </label>
                    <input
                      type="search"
                      id="anbk_modal_nama_lengkap_siswa_clean"
                      name="anbk_modal_nama_lengkap_siswa_clean"
                      autoComplete="off"
                      aria-autocomplete="none"
                      autoCorrect="off"
                      autoCapitalize="words"
                      spellCheck={false}
                      data-lpignore="true"
                      data-1p-ignore="true"
                      data-bwignore="true"
                      data-form-type="other"
                      readOnly={isIdentityLocked}
                      disabled={isIdentityLocked}
                      value={sanitizeStudentNameValue(nameInput)}
                      onKeyDown={(e) => {
                        if (isIdentityLocked) return;
                        if (
                          e.ctrlKey ||
                          e.metaKey ||
                          e.altKey ||
                          [
                            'Backspace',
                            'Delete',
                            'ArrowLeft',
                            'ArrowRight',
                            'Tab',
                            'Enter',
                            'Home',
                            'End',
                            'Shift',
                            'CapsLock',
                          ].includes(e.key)
                        ) {
                          return;
                        }
                        if (e.key.length === 1 && !/^[a-zA-Z\s]$/.test(e.key)) {
                          e.preventDefault();
                          triggerModalNameError(
                            'Nama Lengkap Siswa hanya menerima huruf dan spasi (angka atau karakter khusus tidak diizinkan).'
                          );
                        }
                      }}
                      onPaste={(e) => {
                        if (isIdentityLocked) return;
                        e.preventDefault();
                        const pasted = e.clipboardData.getData('text');
                        const lettersAndSpaces = pasted.replace(/[^a-zA-Z\s]/g, '');
                        if (pasted !== lettersAndSpaces) {
                          triggerModalNameError(
                            'Nama Lengkap Siswa hanya menerima huruf dan spasi (angka atau karakter khusus tidak diizinkan).'
                          );
                        } else {
                          setNameInputError(null);
                        }
                        setNameInput(sanitizeStudentNameValue(lettersAndSpaces));
                      }}
                      onChange={(e) => {
                        if (isIdentityLocked) return;
                        const rawVal = e.target.value;
                        const lettersAndSpaces = rawVal.replace(/[^a-zA-Z\s]/g, '');
                        if (rawVal !== lettersAndSpaces) {
                          triggerModalNameError(
                            'Nama Lengkap Siswa hanya menerima huruf dan spasi (angka atau karakter khusus tidak diizinkan).'
                          );
                        } else if (nameInputError) {
                          setNameInputError(null);
                        }
                        setNameInput(sanitizeStudentNameValue(lettersAndSpaces));
                      }}
                      placeholder="Ketik nama lengkap..."
                      className={`w-full px-2.5 py-1 rounded-lg border text-xs font-bold transition-all [&::-webkit-search-cancel-button]:hidden [&::-webkit-search-decoration]:hidden ${
                        isIdentityLocked
                          ? 'border-slate-700 bg-slate-900/90 text-slate-400 cursor-not-allowed select-none'
                          : nameInputError
                          ? 'border-rose-500 bg-slate-950/90 text-white placeholder:text-slate-500 placeholder:font-normal focus:outline-none focus:ring-1 focus:ring-rose-500'
                          : 'border-white/20 bg-slate-950/90 text-white placeholder:text-slate-500 placeholder:font-normal focus:outline-none focus:ring-1 focus:ring-amber-400'
                      }`}
                    />
                    {nameInputError && (
                      <p
                        role="alert"
                        className="mt-1 text-[9.5px] font-semibold text-rose-400 flex items-center gap-1 leading-tight"
                      >
                        <AlertTriangle className="w-3 h-3 text-rose-400 shrink-0" />
                        <span>{nameInputError}</span>
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-[10px] font-semibold text-slate-300 mb-0.5 flex items-center justify-between">
                      <span>NIS / NISN</span>
                    </label>
                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      readOnly={isIdentityLocked}
                      disabled={isIdentityLocked}
                      value={nisInput}
                      onChange={(e) => {
                        if (isIdentityLocked) return;
                        const digitsOnly = e.target.value.replace(/[^0-9]/g, '');
                        setNisInput(digitsOnly);
                      }}
                      onKeyDown={(e) => {
                        if (isIdentityLocked) return;
                        if (
                          e.ctrlKey ||
                          e.metaKey ||
                          e.altKey ||
                          ['Backspace', 'Delete', 'ArrowLeft', 'ArrowRight', 'Tab', 'Enter', 'Home', 'End'].includes(
                            e.key
                          )
                        ) {
                          return;
                        }
                        if (!/^[0-9]$/.test(e.key)) {
                          e.preventDefault();
                        }
                      }}
                      onPaste={(e) => {
                        if (isIdentityLocked) return;
                        e.preventDefault();
                        const pasted = e.clipboardData.getData('text');
                        const digitsOnly = pasted.replace(/[^0-9]/g, '');
                        setNisInput(digitsOnly);
                      }}
                      placeholder="Contoh: 0098123456"
                      className={`w-full px-2.5 py-1 rounded-lg border text-xs font-mono font-bold transition-all ${
                        isIdentityLocked
                          ? 'border-slate-700 bg-slate-900/90 text-slate-400 cursor-not-allowed select-none'
                          : 'border-white/20 bg-slate-950/90 text-white focus:outline-none focus:ring-1 focus:ring-amber-400'
                      }`}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-1.5">
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-300 mb-0.5">
                      <span>Kelas Siswa</span>
                    </label>
                    <select
                      disabled={isIdentityLocked}
                      value={kelasInput}
                      onChange={(e) => {
                        if (isIdentityLocked) return;
                        setKelasInput(e.target.value);
                      }}
                      className={`w-full px-2 py-1 rounded-lg border text-xs font-bold transition-all ${
                        isIdentityLocked
                          ? 'border-slate-700 bg-slate-900/90 text-slate-400 cursor-not-allowed select-none'
                          : 'border-white/20 bg-slate-950/90 text-white focus:outline-none focus:ring-1 focus:ring-amber-400 cursor-pointer'
                      }`}
                    >
                      {ALL_KELAS_OPTIONS.map((kls) => (
                        <option key={kls} value={kls} className="bg-slate-900 text-white">
                          Kelas {kls}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-semibold text-slate-300 mb-0.5">
                      <span>Semester</span>
                    </label>
                    <select
                      disabled={isIdentityLocked}
                      value={semesterInput}
                      onChange={(e) => {
                        if (isIdentityLocked) return;
                        setSemesterInput(e.target.value as 'Ganjil' | 'Genap');
                      }}
                      className={`w-full px-2 py-1 rounded-lg border text-xs font-bold transition-all ${
                        isIdentityLocked
                          ? 'border-slate-700 bg-slate-900/90 text-slate-400 cursor-not-allowed select-none'
                          : 'border-white/20 bg-slate-950/90 text-white focus:outline-none focus:ring-1 focus:ring-amber-400 cursor-pointer'
                      }`}
                    >
                      <option value="Ganjil" className="bg-slate-900 text-white">
                        Semester Ganjil
                      </option>
                      <option value="Genap" className="bg-slate-900 text-white">
                        Semester Genap
                      </option>
                    </select>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Notifikasi Error Kamera atau Status Berhasil */}
          {cameraError && (
            <div className="p-2 rounded-lg bg-amber-500/15 border border-amber-400/50 text-amber-200 text-[10.5px] flex items-start gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-300 shrink-0 mt-0.5" />
              <span>{cameraError}</span>
            </div>
          )}

          {statusMessage && (
            <div className="p-2 rounded-lg bg-emerald-950/90 border border-emerald-400/50 text-emerald-200 text-[10.5px] font-semibold flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span>{statusMessage}</span>
            </div>
          )}

          <div className="p-2 rounded-lg bg-slate-950/80 border border-sky-500/25 text-[10px] text-slate-300 leading-normal flex items-center gap-1.5">
            <UserCheck className="w-3.5 h-3.5 text-sky-400 shrink-0" />
            <span>
              <strong className="text-sky-300">Penyimpanan Otomatis (`localStorage`):</strong> Foto profil dan identitas tersimpan di perangkat Anda.
            </span>
          </div>

          {/* Footer Tombol Simpan */}
          <div className="flex flex-wrap items-center justify-end gap-2 pt-1.5 border-t border-white/15">
            <button
              type="button"
              onClick={() => {
                stopCameraStream();
                onClose();
              }}
              className="px-3 py-1.5 rounded-lg text-xs font-bold border border-white/20 bg-white/10 hover:bg-white/20 text-white cursor-pointer"
            >
              {effectiveIsLocked ? 'Tutup Jendela' : 'Batal'}
            </button>
            {effectiveIsLocked ? (
              <button
                type="button"
                onClick={() => {
                  stopCameraStream();
                  onClose();
                }}
                className="px-3.5 py-1.5 rounded-lg text-xs font-bold bg-slate-800 border border-slate-700 text-slate-300 hover:bg-slate-700 flex items-center gap-1.5 cursor-pointer shadow-sm"
              >
                <Lock className="w-3.5 h-3.5 text-amber-400" />
                <span>Identitas Terkunci (Hanya Lihat)</span>
              </button>
            ) : (
              <button
                type="submit"
                className="px-3.5 py-1.5 rounded-lg text-xs font-extrabold bg-emerald-500 hover:bg-emerald-400 text-slate-950 flex items-center gap-1.5 shadow-md cursor-pointer"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Simpan Foto &amp; Identitas</span>
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
};
