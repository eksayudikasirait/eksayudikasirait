import React, { useState, useEffect, useRef, useCallback } from 'react';
import jsQR from 'jsqr';
import QRCode from 'qrcode';
import {
  QrCode,
  Camera,
  Upload,
  X,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  KeyRound,
  Layers,
  Download,
  Sparkles,
  Play,
  ShieldCheck,
  SwitchCamera,
  UserCheck,
} from 'lucide-react';
import {
  EXAM_INFO,
  StudentSubmission,
  sanitizeTokenValue,
  checkStudentTokenUsage,
} from '../data/examData';

export interface ScannedExamQrResult {
  rawText: string;
  examToken?: string;
  kelas?: string;
  semester?: 'Ganjil' | 'Genap';
  namaSiswa?: string;
  nisNisn?: string;
}

interface QrCodeScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeOnlineToken: string;
  currentKelas: string;
  currentSemester: 'Ganjil' | 'Genap';
  currentNamaSiswa: string;
  currentNisNisn: string;
  availableKelasList: string[];
  submissions: StudentSubmission[];
  onApplyScannedData: (
    data: ScannedExamQrResult,
    autoProceedToExam?: boolean
  ) => void;
  onRequestNewTokenFromTeacher?: () => void;
  onCameraActiveChange?: (isActive: boolean) => void;
}

const ALL_VALID_KELAS = [
  ...EXAM_INFO.kelasVIIList,
  ...EXAM_INFO.kelasList,
];

function normalizeKelasCode(raw: string): string | undefined {
  const upper = raw.trim().toUpperCase().replace(/\s+/g, '');
  const cleaned = upper.replace(/^KELAS[-:_]?/, '');
  for (const k of ALL_VALID_KELAS) {
    if (cleaned === k.toUpperCase() || upper.includes(k.toUpperCase())) {
      return k;
    }
  }
  // Support numeric shorthand like 7-1..7-5 or 8-1..8-6
  const shortMatch = cleaned.match(/^([78])[-_.]?([1-6])$/);
  if (shortMatch) {
    const roman = shortMatch[1] === '7' ? 'VII' : 'VIII';
    const candidate = `${roman}-${shortMatch[2]}`;
    if (ALL_VALID_KELAS.includes(candidate)) {
      return candidate;
    }
  }
  return undefined;
}

function normalizeSemesterValue(raw: string): 'Ganjil' | 'Genap' | undefined {
  const lower = raw.trim().toLowerCase();
  if (lower.includes('ganjil') || lower === '1' || lower === 'i') return 'Ganjil';
  if (lower.includes('genap') || lower === '2' || lower === 'ii') return 'Genap';
  return undefined;
}

export function parseScannedExamQrPayload(rawText: string): ScannedExamQrResult {
  const trimmed = (rawText || '').trim();
  const result: ScannedExamQrResult = { rawText: trimmed };
  if (!trimmed) return result;

  // 1. Try JSON format: {"token":"922662","kelas":"VIII-1","semester":"Ganjil",...}
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    try {
      const obj = JSON.parse(trimmed) as Record<string, unknown>;
      const tokCandidate =
        obj.token ?? obj.examCode ?? obj.kodeToken ?? obj.kode ?? obj.exam_token;
      const klsCandidate =
        obj.kelas ?? obj.classroomId ?? obj.classId ?? obj.classroom ?? obj.ruang;
      const semCandidate = obj.semester ?? obj.sem;
      const nameCandidate = obj.namaSiswa ?? obj.nama ?? obj.studentName ?? obj.name;
      const nisCandidate = obj.nisNisn ?? obj.nis ?? obj.nisn ?? obj.studentId;

      if (typeof tokCandidate === 'string' || typeof tokCandidate === 'number') {
        const cleanTok = sanitizeTokenValue(String(tokCandidate));
        if (cleanTok.length >= 3) result.examToken = cleanTok;
      }
      if (typeof klsCandidate === 'string') {
        const normKls = normalizeKelasCode(klsCandidate);
        if (normKls) result.kelas = normKls;
      }
      if (typeof semCandidate === 'string' || typeof semCandidate === 'number') {
        const normSem = normalizeSemesterValue(String(semCandidate));
        if (normSem) result.semester = normSem;
      }
      if (typeof nameCandidate === 'string' && nameCandidate.trim()) {
        result.namaSiswa = nameCandidate.trim();
      }
      if (typeof nisCandidate === 'string' || typeof nisCandidate === 'number') {
        result.nisNisn = String(nisCandidate).trim();
      }
      if (result.examToken || result.kelas || result.namaSiswa || result.nisNisn) {
        return result;
      }
    } catch {
      // Fall through to URL or key-value parsing
    }
  }

  // 2. Try URL with query parameters: https://...?token=922662&kelas=VIII-1&semester=Ganjil
  if (trimmed.includes('?') || trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    try {
      const urlObj = trimmed.startsWith('http')
        ? new URL(trimmed)
        : new URL(trimmed, 'https://anbk.local');
      const params = urlObj.searchParams;
      const tokParam =
        params.get('token') ||
        params.get('kode') ||
        params.get('examCode') ||
        params.get('code');
      const klsParam =
        params.get('kelas') ||
        params.get('classroom') ||
        params.get('classroomId') ||
        params.get('class');
      const semParam = params.get('semester') || params.get('sem');
      const nameParam = params.get('nama') || params.get('namaSiswa') || params.get('name');
      const nisParam = params.get('nis') || params.get('nisn') || params.get('nisNisn');

      if (tokParam) {
        const cleanTok = sanitizeTokenValue(tokParam);
        if (cleanTok.length >= 3) result.examToken = cleanTok;
      }
      if (klsParam) {
        const normKls = normalizeKelasCode(klsParam);
        if (normKls) result.kelas = normKls;
      }
      if (semParam) {
        const normSem = normalizeSemesterValue(semParam);
        if (normSem) result.semester = normSem;
      }
      if (nameParam && nameParam.trim()) {
        result.namaSiswa = nameParam.trim();
      }
      if (nisParam && nisParam.trim()) {
        result.nisNisn = nisParam.trim();
      }
      if (result.examToken || result.kelas || result.namaSiswa || result.nisNisn) {
        return result;
      }
    } catch {
      // Fall through
    }
  }

  // 3. Try Pipe / Semicolon / Line Key-Value format: e.g. "ANBK|KELAS:VIII-1|SEMESTER:Ganjil|TOKEN:922662"
  if (trimmed.includes('|') || trimmed.includes(';') || trimmed.includes(':') || trimmed.includes('=')) {
    const segments = trimmed.split(/[|;\n\r]+/);
    for (const seg of segments) {
      const parts = seg.split(/[:=]/);
      if (parts.length >= 2) {
        const key = parts[0].trim().toLowerCase();
        const val = parts.slice(1).join(':').trim();
        if (
          key.includes('token') ||
          key.includes('kode') ||
          key.includes('exam') ||
          key === 'code'
        ) {
          const cleanTok = sanitizeTokenValue(val);
          if (cleanTok.length >= 3) result.examToken = cleanTok;
        } else if (
          key.includes('kelas') ||
          key.includes('class') ||
          key.includes('ruang')
        ) {
          const normKls = normalizeKelasCode(val);
          if (normKls) result.kelas = normKls;
        } else if (key.includes('sem')) {
          const normSem = normalizeSemesterValue(val);
          if (normSem) result.semester = normSem;
        } else if (key.includes('nama') || key.includes('name')) {
          if (val) result.namaSiswa = val;
        } else if (key.includes('nis')) {
          if (val) result.nisNisn = val;
        }
      } else {
        const maybeKls = normalizeKelasCode(seg);
        if (maybeKls && !result.kelas) {
          result.kelas = maybeKls;
        }
      }
    }
    if (result.examToken || result.kelas || result.namaSiswa || result.nisNisn) {
      return result;
    }
  }

  // 4. Direct Classroom ID check (e.g. "VIII-1", "KELAS VII-3")
  const directKelas = normalizeKelasCode(trimmed);
  if (directKelas) {
    result.kelas = directKelas;
  }

  // 5. Direct Exam Code / Token check (3-6 alphanumeric chars, e.g. "922662")
  const cleanCandidate = sanitizeTokenValue(trimmed);
  if (
    !directKelas &&
    cleanCandidate.length >= 3 &&
    cleanCandidate.length <= 6 &&
    /^[A-Z0-9]{3,6}$/.test(cleanCandidate)
  ) {
    result.examToken = cleanCandidate;
  }

  return result;
}

export const QrCodeScannerModal: React.FC<QrCodeScannerModalProps> = ({
  isOpen,
  onClose,
  activeOnlineToken,
  currentKelas,
  currentSemester,
  currentNamaSiswa,
  currentNisNisn,
  availableKelasList,
  submissions,
  onApplyScannedData,
  onRequestNewTokenFromTeacher,
  onCameraActiveChange,
}) => {
  const [activeTab, setActiveTab] = useState<'SCANNER' | 'QR_GENERATOR'>('SCANNER');
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [isCameraActive, setIsCameraActive] = useState<boolean>(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [scannedResult, setScannedResult] = useState<ScannedExamQrResult | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);

  // Generator state for Classroom ID + Exam Code QR Card
  const [genKelas, setGenKelas] = useState<string>(currentKelas || 'VIII-1');
  const [genSemester, setGenSemester] = useState<'Ganjil' | 'Genap'>(currentSemester || 'Ganjil');
  const [genIncludeToken, setGenIncludeToken] = useState<boolean>(true);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafIdRef = useRef<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      setGenKelas(currentKelas || 'VIII-1');
      setGenSemester(currentSemester || 'Ganjil');
      setScanError(null);
      setScannedResult(null);
    }
  }, [isOpen, currentKelas, currentSemester]);

  const stopCameraStream = useCallback(() => {
    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsCameraActive(false);
  }, []);

  const handleDecodedQrText = useCallback((rawText: string) => {
    const parsed = parseScannedExamQrPayload(rawText);
    if (!parsed.examToken && !parsed.kelas && !parsed.namaSiswa && !parsed.nisNisn) {
      setScanError(
        `QR Code terbaca ("${rawText.slice(0, 45)}"), namun tidak ditemukan ID Kelas (VII/VIII) atau Kode Token Ujian (6 karakter) yang valid.`
      );
      return;
    }
    setScanError(null);
    setScannedResult(parsed);
    stopCameraStream();
  }, [stopCameraStream]);

  const startCameraScanner = useCallback(async () => {
    stopCameraStream();
    setCameraError(null);
    setScanError(null);

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setCameraError(
        'Browser pada perangkat ini tidak mendukung akses kamera langsung. Silakan gunakan tombol "Unggah Gambar QR Code" di bawah.'
      );
      return;
    }

    try {
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: facingMode },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        });
      } catch {
        stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false,
        });
      }

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute('playsinline', 'true');
        await videoRef.current.play();
      }
      setIsCameraActive(true);

      const scanFrame = () => {
        const video = videoRef.current;
        const canvas = canvasRef.current;
        if (!video || !canvas || !streamRef.current) return;

        if (video.readyState === video.HAVE_ENOUGH_DATA && video.videoWidth > 0) {
          const width = video.videoWidth;
          const height = video.videoHeight;
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d', { willReadFrequently: true });
          if (ctx) {
            ctx.drawImage(video, 0, 0, width, height);
            const imageData = ctx.getImageData(0, 0, width, height);
            const code = jsQR(imageData.data, imageData.width, imageData.height, {
              inversionAttempts: 'attemptBoth',
            });
            if (code && code.data && code.data.trim()) {
              handleDecodedQrText(code.data.trim());
              return;
            }
          }
        }
        rafIdRef.current = requestAnimationFrame(scanFrame);
      };

      rafIdRef.current = requestAnimationFrame(scanFrame);
    } catch {
      setCameraError(
        'Tidak dapat mengakses kamera perangkat (izin kamera ditolak atau kamera sedang digunakan aplikasi lain). Anda tetap dapat memindai melalui tombol "Unggah Gambar QR Code".'
      );
      setIsCameraActive(false);
    }
  }, [facingMode, handleDecodedQrText, stopCameraStream]);

  useEffect(() => {
    onCameraActiveChange?.(isCameraActive);
  }, [isCameraActive, onCameraActiveChange]);

  useEffect(() => {
    if (isOpen && activeTab === 'SCANNER' && !scannedResult) {
      startCameraScanner();
    } else {
      stopCameraStream();
    }
    return () => {
      stopCameraStream();
    };
  }, [isOpen, activeTab, scannedResult, startCameraScanner, stopCameraStream]);

  // Generate Classroom ID + Exam Code QR Image whenever generator options change
  useEffect(() => {
    if (!isOpen) return;
    const cleanToken = sanitizeTokenValue(activeOnlineToken);
    const payloadObj: Record<string, string> = {
      app: 'ANBK-SMPN4-PADANG',
      kelas: genKelas,
      semester: genSemester,
    };
    if (genIncludeToken && cleanToken) {
      payloadObj.token = cleanToken;
    }
    const payloadStr = JSON.stringify(payloadObj);

    QRCode.toDataURL(payloadStr, {
      width: 320,
      margin: 2,
      color: {
        dark: '#0f172a',
        light: '#ffffff',
      },
      errorCorrectionLevel: 'M',
    })
      .then((url) => setQrDataUrl(url))
      .catch(() => setQrDataUrl(''));
  }, [isOpen, genKelas, genSemester, genIncludeToken, activeOnlineToken]);

  const handleUploadQrImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setScanError(null);

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = typeof reader.result === 'string' ? reader.result : '';
      if (!dataUrl) return;
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const maxDim = 1200;
        let w = img.naturalWidth || img.width;
        let h = img.naturalHeight || img.height;
        if (w > maxDim || h > maxDim) {
          const scale = maxDim / Math.max(w, h);
          w = Math.round(w * scale);
          h = Math.round(h * scale);
        }
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.drawImage(img, 0, 0, w, h);
        const imageData = ctx.getImageData(0, 0, w, h);
        const code = jsQR(imageData.data, imageData.width, imageData.height, {
          inversionAttempts: 'attemptBoth',
        });
        if (code && code.data && code.data.trim()) {
          handleDecodedQrText(code.data.trim());
        } else {
          setScanError(
            'QR Code tidak terdeteksi pada gambar yang diunggah. Pastikan gambar QR Code terlihat jelas dan tidak terpotong.'
          );
        }
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleDownloadGeneratedQr = () => {
    if (!qrDataUrl) return;
    const a = document.createElement('a');
    a.href = qrDataUrl;
    a.download = `QR-Login-ANBK-Kelas-${genKelas}-${genSemester}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  if (!isOpen) return null;

  const scannedTokenUsage = scannedResult?.examToken
    ? checkStudentTokenUsage(
        scannedResult.examToken,
        scannedResult.namaSiswa || currentNamaSiswa,
        scannedResult.nisNisn || currentNisNisn,
        submissions
      )
    : null;

  const isScannedTokenAlreadyUsed = Boolean(scannedTokenUsage?.isAlreadyUsed);
  const canAutoProceed =
    Boolean(
      (scannedResult?.namaSiswa || currentNamaSiswa.trim()) &&
        (scannedResult?.nisNisn || currentNisNisn.trim()) &&
        (scannedResult?.examToken || activeOnlineToken)
    ) && !isScannedTokenAlreadyUsed;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-2.5 sm:p-3 overflow-y-auto">
      <div className="max-w-lg w-full rounded-xl border border-amber-400/60 bg-gradient-to-br from-slate-950 via-slate-900 to-sky-950 text-white shadow-2xl overflow-hidden my-auto">
        {/* Header Modal */}
        <div className="px-3.5 py-2.5 bg-gradient-to-r from-slate-950 via-sky-950 to-slate-900 border-b border-white/15 flex items-center justify-between gap-2.5">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-amber-400/20 border border-amber-400/50 flex items-center justify-center text-amber-300 shrink-0">
              <QrCode className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[9px] font-mono font-bold uppercase tracking-widest text-amber-300 block leading-tight">
                SMART QR ACCESS · FAST &amp; SECURE LOGIN
              </span>
              <h3 className="text-xs sm:text-sm font-extrabold text-white leading-tight">
                Pemindai QR ID Kelas &amp; Kode Token Ujian
              </h3>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              stopCameraStream();
              onClose();
            }}
            className="p-1 rounded-lg bg-white/10 hover:bg-white/20 text-slate-300 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Navigasi Tab: Kamera Pemindai QR vs Kartu QR Kelas & Token */}
        <div className="px-3.5 pt-2.5 flex items-center gap-1.5 border-b border-white/10 pb-2">
          <button
            type="button"
            onClick={() => setActiveTab('SCANNER')}
            className={`relative flex-1 py-1.5 px-2.5 rounded-lg text-[11px] font-extrabold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'SCANNER'
                ? isCameraActive
                  ? 'bg-emerald-400 text-slate-950 shadow-md ring-1 ring-emerald-300/80 qr-camera-active-glow'
                  : 'bg-amber-400 text-slate-950 shadow-sm'
                : 'bg-white/5 hover:bg-white/10 text-slate-300 border border-white/15'
            }`}
          >
            {isCameraActive ? (
              <span className="relative flex h-2.5 w-2.5 shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-slate-950 opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-slate-950" />
              </span>
            ) : (
              <Camera className="w-3.5 h-3.5 shrink-0" />
            )}
            <span>
              {isCameraActive
                ? 'Pindai QR (Kamera Aktif...)'
                : 'Pindai QR (Kamera / Galeri)'}
            </span>
            {isCameraActive && (
              <span className="px-1 py-0.2 rounded bg-slate-950 text-emerald-300 font-mono text-[8.5px] font-extrabold uppercase tracking-wider animate-pulse">
                LIVE
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('QR_GENERATOR')}
            className={`flex-1 py-1.5 px-2.5 rounded-lg text-[11px] font-extrabold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'QR_GENERATOR'
                ? 'bg-sky-500 text-white shadow-sm'
                : 'bg-white/5 hover:bg-white/10 text-slate-300 border border-white/15'
            }`}
          >
            <QrCode className="w-3.5 h-3.5" />
            <span>Kartu QR Kelas &amp; Token</span>
          </button>
        </div>

        <div className="p-3.5 space-y-2.5">
          {activeTab === 'SCANNER' ? (
            <>
              {/* Panduan Singkat */}
              <div className="p-2 rounded-lg bg-sky-950/60 border border-sky-400/30 text-[10.5px] text-sky-100 flex items-start gap-2">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                <div className="leading-snug">
                  Arahkan kamera ke <strong className="text-amber-300">QR Code Ruang Kelas (VII-1 s/d VIII-6)</strong> atau{' '}
                  <strong className="text-amber-300">QR Code Token Ujian</strong> untuk mengisi Kelas, Semester, dan Kode Token otomatis.
                </div>
              </div>

              {/* Area Kamera Pemindai QR */}
              {!scannedResult && (
                <div className="space-y-2">
                  <div className="relative h-44 sm:h-52 w-full rounded-xl overflow-hidden border border-sky-400/50 bg-slate-950 flex items-center justify-center shadow-inner">
                    <video
                      ref={videoRef}
                      className={`w-full h-full object-cover ${isCameraActive ? 'block' : 'hidden'}`}
                      muted
                      playsInline
                    />
                    <canvas ref={canvasRef} className="hidden" />

                    {/* Bingkai Viewfinder Pemindai QR */}
                    {isCameraActive && (
                      <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center p-3">
                        <div className="relative w-32 h-32 sm:w-36 sm:h-36 border-2 border-amber-400/40 rounded-xl">
                          <span className="absolute -top-1 -left-1 w-5 h-5 border-t-3 border-l-3 border-amber-400 rounded-tl-lg" />
                          <span className="absolute -top-1 -right-1 w-5 h-5 border-t-3 border-r-3 border-amber-400 rounded-tr-lg" />
                          <span className="absolute -bottom-1 -left-1 w-5 h-5 border-b-3 border-l-3 border-amber-400 rounded-bl-lg" />
                          <span className="absolute -bottom-1 -right-1 w-5 h-5 border-b-3 border-r-3 border-amber-400 rounded-br-lg" />
                          <div className="absolute inset-x-2 top-1/2 h-0.5 bg-gradient-to-r from-transparent via-emerald-400 to-transparent animate-pulse shadow-[0_0_12px_#34d399]" />
                        </div>
                        <span className="mt-2 px-2.5 py-0.5 rounded-full bg-slate-950/85 border border-emerald-400/40 text-[10px] font-mono font-bold text-emerald-300">
                          Memindai QR ID Kelas / Kode Token Ujian...
                        </span>
                      </div>
                    )}

                    {!isCameraActive && (
                      <div className="p-4 text-center space-y-2 max-w-md">
                        <QrCode className="w-9 h-9 text-amber-300 mx-auto opacity-80" />
                        {cameraError ? (
                          <p className="text-[11px] text-rose-200 leading-snug">{cameraError}</p>
                        ) : (
                          <p className="text-[11px] text-slate-300">Menyiapkan kamera pemindai QR Code...</p>
                        )}
                        <button
                          type="button"
                          onClick={startCameraScanner}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-sky-500 hover:bg-sky-400 text-slate-950 font-extrabold text-[11px] cursor-pointer"
                        >
                          <RefreshCw className="w-3 h-3" />
                          Aktifkan Ulang Kamera
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Kontrol Kamera & Unggah File Gambar QR */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                    <button
                      type="button"
                      onClick={() =>
                        setFacingMode((prev) => (prev === 'environment' ? 'user' : 'environment'))
                      }
                      className="py-1.5 px-3 rounded-lg bg-white/10 hover:bg-white/15 border border-white/20 text-white font-bold text-[11px] flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <SwitchCamera className="w-3.5 h-3.5 text-sky-300" />
                      <span>
                        Ganti Kamera ({facingMode === 'environment' ? 'Belakang' : 'Depan'})
                      </span>
                    </button>

                    <label
                      htmlFor="qr-scanner-file-upload"
                      className="py-1.5 px-3 rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 font-extrabold text-[11px] flex items-center justify-center gap-1.5 shadow-sm cursor-pointer select-none"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      <span>Unggah Gambar QR dari Galeri</span>
                      <input
                        id="qr-scanner-file-upload"
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleUploadQrImage}
                        className="sr-only"
                      />
                    </label>
                  </div>
                </div>
              )}

              {scanError && (
                <div className="p-2.5 rounded-lg bg-rose-950/90 border border-rose-500/70 text-rose-200 text-[11px] flex items-start gap-2">
                  <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0 mt-0.5" />
                  <span>{scanError}</span>
                </div>
              )}

              {/* Hasil Pemindaian QR Code */}
              {scannedResult && (
                <div className="p-3 rounded-xl border border-emerald-400/60 bg-slate-900/95 space-y-2.5 shadow-lg">
                  <div className="flex items-center justify-between border-b border-white/10 pb-2">
                    <div className="flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span className="text-xs font-extrabold text-emerald-300 uppercase tracking-wide">
                        QR Code Berhasil Dipindai!
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setScannedResult(null);
                        setScanError(null);
                      }}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-white/10 hover:bg-white/20 text-[10px] font-bold text-sky-200 cursor-pointer"
                    >
                      <RefreshCw className="w-2.5 h-2.5" />
                      Pindai Ulang
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                    {scannedResult.kelas && (
                      <div className="p-2 rounded-lg bg-sky-950/70 border border-sky-400/40">
                        <span className="text-[9.5px] font-mono uppercase text-sky-300 block">
                          ID Ruang Kelas:
                        </span>
                        <span className="text-xs font-extrabold text-white flex items-center gap-1 mt-0.5">
                          <Layers className="w-3.5 h-3.5 text-amber-300" />
                          Kelas {scannedResult.kelas}
                        </span>
                      </div>
                    )}

                    {scannedResult.semester && (
                      <div className="p-2 rounded-lg bg-sky-950/70 border border-sky-400/40">
                        <span className="text-[9.5px] font-mono uppercase text-sky-300 block">
                          Semester:
                        </span>
                        <span className="text-xs font-extrabold text-amber-300 block mt-0.5">
                          Semester {scannedResult.semester}
                        </span>
                      </div>
                    )}

                    {scannedResult.examToken && (
                      <div
                        className={`p-2.5 rounded-lg border sm:col-span-2 ${
                          isScannedTokenAlreadyUsed
                            ? 'bg-rose-950/80 border-rose-500/70'
                            : 'bg-emerald-950/70 border-emerald-400/50'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-[9.5px] font-mono uppercase text-amber-300 block">
                            Kode Token Ujian:
                          </span>
                          <span
                            className={`px-1.5 py-0.2 rounded text-[9px] font-mono font-extrabold ${
                              isScannedTokenAlreadyUsed
                                ? 'bg-rose-500/30 text-rose-200'
                                : 'bg-emerald-500/30 text-emerald-200'
                            }`}
                          >
                            {isScannedTokenAlreadyUsed
                              ? 'SUDAH TERPAKAI 3x'
                              : 'VALID · TERSEDIA (3x)'}
                          </span>
                        </div>
                        <div className="text-base font-mono font-extrabold tracking-widest text-white mt-0.5 flex items-center gap-1.5">
                          <KeyRound className="w-4 h-4 text-amber-300" />
                          <span>{scannedResult.examToken}</span>
                        </div>
                        {isScannedTokenAlreadyUsed && (
                          <div className="mt-1.5 text-[10.5px] text-rose-200 space-y-1.5">
                            <p>
                              Kode token <strong>[{scannedResult.examToken}]</strong> sudah terpakai 3x. Mintalah Kode Token Baru kepada Guru Mapel.
                            </p>
                            {onRequestNewTokenFromTeacher && (
                              <button
                                type="button"
                                onClick={onRequestNewTokenFromTeacher}
                                className="px-2.5 py-1 rounded-md bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold text-[10.5px] cursor-pointer"
                              >
                                Minta Kode Token Baru ke Guru Mapel
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    {(scannedResult.namaSiswa || scannedResult.nisNisn) && (
                      <div className="p-2 rounded-lg bg-white/5 border border-white/15 sm:col-span-2 flex items-center gap-2">
                        <UserCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        <div>
                          <span className="text-[9.5px] font-mono uppercase text-sky-300 block">
                            Identitas Peserta pada QR:
                          </span>
                          <span className="text-[11px] font-bold text-white">
                            {scannedResult.namaSiswa || '-'} · NIS/NISN: {scannedResult.nisNisn || '-'}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center justify-end gap-1.5 pt-1.5 border-t border-white/10">
                    <button
                      type="button"
                      onClick={() => {
                        onApplyScannedData(scannedResult, false);
                        onClose();
                      }}
                      className="px-3 py-1.5 rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 font-extrabold text-[11px] flex items-center gap-1 shadow-sm cursor-pointer"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Terapkan ke Form Login
                    </button>

                    {canAutoProceed && (
                      <button
                        type="button"
                        onClick={() => {
                          onApplyScannedData(scannedResult, true);
                          onClose();
                        }}
                        className="px-3.5 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold text-[11px] flex items-center gap-1 shadow-md cursor-pointer"
                      >
                        <Play className="w-3.5 h-3.5 fill-current" />
                        Terapkan &amp; Langsung Masuk Ujian
                      </button>
                    )}
                  </div>
                </div>
              )}
            </>
          ) : (
            /* TAB 2: KARTU QR KELAS & KODE TOKEN UJIAN */
            <div className="space-y-2.5">
              <div className="p-2 rounded-lg bg-sky-950/60 border border-sky-400/30 text-[10.5px] text-sky-100 leading-snug">
                Buat atau unduh <strong className="text-amber-300">Kartu QR ID Kelas &amp; Kode Token Ujian</strong> untuk dipindai siswa.
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] font-bold text-sky-200 mb-0.5">
                    Pilih ID Ruang Kelas:
                  </label>
                  <select
                    value={genKelas}
                    onChange={(e) => setGenKelas(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-lg border border-white/20 bg-slate-950 text-white text-[11px] font-bold focus:outline-none focus:ring-1 focus:ring-amber-400"
                  >
                    {(availableKelasList.length > 0 ? availableKelasList : ALL_VALID_KELAS).map(
                      (kls) => (
                        <option key={kls} value={kls} className="bg-slate-900 text-white">
                          Kelas {kls}
                        </option>
                      )
                    )}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-sky-200 mb-0.5">
                    Pilih Semester:
                  </label>
                  <select
                    value={genSemester}
                    onChange={(e) => setGenSemester(e.target.value as 'Ganjil' | 'Genap')}
                    className="w-full px-2.5 py-1.5 rounded-lg border border-white/20 bg-slate-950 text-white text-[11px] font-bold focus:outline-none focus:ring-1 focus:ring-amber-400"
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

              <label className="flex items-center gap-1.5 text-[11px] text-slate-200 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={genIncludeToken}
                  onChange={(e) => setGenIncludeToken(e.target.checked)}
                  className="rounded border-white/30 text-amber-400 focus:ring-amber-400"
                />
                <span>
                  Sertakan Kode Token Aktif (<strong className="font-mono text-amber-300">{activeOnlineToken || '-'}</strong>)
                </span>
              </label>

              {/* Preview Kartu QR */}
              <div className="p-3 rounded-xl bg-white text-slate-900 flex flex-col items-center text-center space-y-1.5 shadow-md border-2 border-amber-400">
                <div className="text-[9.5px] font-extrabold uppercase tracking-widest text-sky-800">
                  {EXAM_INFO.namaSekolah} · ANBK INFORMATIKA
                </div>
                {qrDataUrl ? (
                  <img
                    src={qrDataUrl}
                    alt={`QR Kelas ${genKelas}`}
                    className="w-36 h-36 object-contain rounded-lg border border-slate-200 p-1"
                  />
                ) : (
                  <div className="w-36 h-36 flex items-center justify-center text-[11px] text-slate-400">
                    Membuat QR Code...
                  </div>
                )}
                <div className="space-y-0.5">
                  <div className="text-xs font-extrabold text-slate-900">
                    ID RUANG: KELAS {genKelas} ({genSemester.toUpperCase()})
                  </div>
                  {genIncludeToken && activeOnlineToken && (
                    <div className="text-[10.5px] font-mono font-bold text-emerald-700">
                      KODE TOKEN: {activeOnlineToken} (Kuota 3x Pakai)
                    </div>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5">
                <button
                  type="button"
                  onClick={handleDownloadGeneratedQr}
                  className="flex-1 py-1.5 px-3 rounded-lg bg-white/10 hover:bg-white/20 border border-white/20 text-white font-bold text-[11px] flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5 text-sky-300" />
                  Unduh Kartu QR (.PNG)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const simulatedPayload = JSON.stringify({
                      kelas: genKelas,
                      semester: genSemester,
                      ...(genIncludeToken && activeOnlineToken
                        ? { token: sanitizeTokenValue(activeOnlineToken) }
                        : {}),
                    });
                    setActiveTab('SCANNER');
                    handleDecodedQrText(simulatedPayload);
                  }}
                  className="flex-1 py-1.5 px-3 rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 font-extrabold text-[11px] flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  Gunakan QR Kelas Ini
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
