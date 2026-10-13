import React, { useState, useEffect } from 'react';
import {
  Maximize2,
  ShieldAlert,
  Smartphone,
  Laptop,
  CopyX,
  CameraOff,
  Split,
  Lock,
  EyeOff,
  Sparkles,
  Zap,
  RotateCw,
  Compass,
} from 'lucide-react';
import { StudentDeviceInfo } from '../utils/deviceDetector';
import {
  getPreciseScreenOrientation,
  evaluatePrecisionSplitScreen,
  OrientationDetail,
} from '../utils/antiSplitScreenDetector';

interface FullscreenAntiSplitScreenCardProps {
  detectedDevice: StudentDeviceInfo;
  effectiveDeviceModel: string;
  darkMode?: boolean;
}

export const FullscreenAntiSplitScreenCard: React.FC<FullscreenAntiSplitScreenCardProps> = ({
  detectedDevice,
  effectiveDeviceModel,
  darkMode = true,
}) => {
  const [testSimulated, setTestSimulated] = useState<boolean>(false);
  const [currentOrientation, setCurrentOrientation] = useState<OrientationDetail>(() =>
    getPreciseScreenOrientation()
  );

  useEffect(() => {
    const updateOrient = () => {
      setCurrentOrientation(getPreciseScreenOrientation());
    };
    window.addEventListener('resize', updateOrient);
    window.addEventListener('orientationchange', updateOrient);
    if (window.screen?.orientation) {
      window.screen.orientation.addEventListener('change', updateOrient);
    }
    return () => {
      window.removeEventListener('resize', updateOrient);
      window.removeEventListener('orientationchange', updateOrient);
      if (window.screen?.orientation) {
        window.screen.orientation.removeEventListener('change', updateOrient);
      }
    };
  }, []);

  const handleTestScreenshotShield = () => {
    setTestSimulated(true);
    window.dispatchEvent(
      new CustomEvent('anbk-test-screenshot-shield', {
        detail: {
          label: 'Simulasi Pengujian Sensor Anti-Screenshot Lintas Perangkat',
        },
      })
    );
    setTimeout(() => setTestSimulated(false), 3000);
  };

  const getPlatformIcon = () => {
    if (detectedDevice.deviceCategory === 'Chromebook (ChromeOS)') {
      return <Laptop className="w-4 h-4 text-sky-400" />;
    }
    if (detectedDevice.isMobileOrTablet) {
      return <Smartphone className="w-4 h-4 text-emerald-400" />;
    }
    return <Laptop className="w-4 h-4 text-sky-400" />;
  };

  return (
    <div
      className={`rounded-xl border p-3.5 sm:p-4 space-y-3 transition-all duration-300 shadow-lg ${
        darkMode
          ? 'bg-gradient-to-br from-slate-950/95 via-slate-900/95 to-sky-950/85 border-sky-500/40 text-white'
          : 'bg-gradient-to-br from-slate-950 via-sky-950 to-slate-900 border-sky-500/50 text-white'
      }`}
    >
      {/* Header Komponen */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/15 pb-2.5">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-rose-500/20 border border-rose-400/50 flex items-center justify-center text-rose-300 shrink-0">
            <ShieldAlert className="w-4 h-4 text-rose-400" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h2 className="text-xs sm:text-sm font-extrabold uppercase tracking-wider text-rose-300">
                PENGUNCIAN FULLSCREEN & ANTI SPLIT-SCREEN
              </h2>
            </div>
            <span className="text-[9.5px] font-mono text-sky-300 block">
              Sistem Keamanan Ujian ANBK Terintegrasi · UPTD SMPN 7 Kisaran
            </span>
          </div>
        </div>

        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-400/50 text-[9px] font-mono font-extrabold text-emerald-300">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          LOCK FULL SCREEN OTOMATIS
        </span>
      </div>

      {/* Badge Dukungan Multi-Perangkat (Laptop, Chromebook, Android, iPhone) */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-[10px] font-bold text-slate-300">
          <span className="uppercase tracking-wider text-sky-200">
            Kompatibilitas Penguncian Layar Penuh Otomatis:
          </span>
          <span className="text-emerald-300 font-mono text-[9.5px]">4 Platform Terkunci</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 text-[10px]">
          <div className="p-1.5 rounded-lg border border-sky-400/35 bg-slate-900/80 flex items-center gap-1.5">
            <Laptop className="w-3.5 h-3.5 text-sky-300 shrink-0" />
            <div className="leading-tight truncate">
              <span className="font-bold text-white block truncate">Laptop / PC</span>
              <span className="text-[8.5px] text-sky-300 font-mono">Escape & Wake Lock</span>
            </div>
          </div>

          <div className="p-1.5 rounded-lg border border-cyan-400/35 bg-slate-900/80 flex items-center gap-1.5">
            <Laptop className="w-3.5 h-3.5 text-cyan-300 shrink-0" />
            <div className="leading-tight truncate">
              <span className="font-bold text-white block truncate">Chromebook</span>
              <span className="text-[8.5px] text-cyan-300 font-mono">navigationUI: hide</span>
            </div>
          </div>

          <div className="p-1.5 rounded-lg border border-emerald-400/35 bg-slate-900/80 flex items-center gap-1.5">
            <Smartphone className="w-3.5 h-3.5 text-emerald-300 shrink-0" />
            <div className="leading-tight truncate">
              <span className="font-bold text-white block truncate">Android</span>
              <span className="text-[8.5px] text-emerald-300 font-mono">Immersive Fullscreen</span>
            </div>
          </div>

          <div className="p-1.5 rounded-lg border border-amber-400/35 bg-slate-900/80 flex items-center gap-1.5">
            <Smartphone className="w-3.5 h-3.5 text-amber-300 shrink-0" />
            <div className="leading-tight truncate">
              <span className="font-bold text-white block truncate">iPhone</span>
              <span className="text-[8.5px] text-amber-300 font-mono">iOS Immersive 100dvh</span>
            </div>
          </div>
        </div>
      </div>

      {/* 4 Pilar Fitur Keamanan Sesuai Spesifikasi */}
      <div className="space-y-2 text-xs">
        {/* Fitur 1: Penguncian Layar Penuh Otomatis */}
        <div className="p-2.5 rounded-lg border border-sky-400/30 bg-slate-950/80 flex items-start gap-2.5">
          <div className="w-6 h-6 rounded-md bg-sky-500/20 text-sky-300 flex items-center justify-center shrink-0 mt-0.5">
            <Maximize2 className="w-3.5 h-3.5" />
          </div>
          <div className="leading-relaxed flex-1">
            <div className="flex items-center justify-between gap-1">
              <strong className="text-white font-bold text-[11px]">
                Otomatis Lock Full Screen Saat Membuka Link (Tanpa Klik Tombol)
              </strong>
              <span className="px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 text-[8.5px] font-mono font-bold">
                Auto Re-Lock
              </span>
            </div>
            <p className="text-[10px] text-slate-300 mt-0.5">
              Saat <strong className="text-sky-300">mengklik atau membuka link di browser</strong> pada <strong>Laptop/PC, Chromebook, Android, dan iPhone</strong>, sistem langsung berjalan otomatis dalam <strong className="text-emerald-300">Mode Full Screen (Otomatis Lock Full Screen)</strong> secara berkelanjutan tanpa perlu mengklik tombol.
            </p>
          </div>
        </div>

        {/* Fitur 3: Layar Tidak Bisa di-Screenshot (Lintas Perangkat: Samsung, Xiaomi, Oppo, Vivo, Realme, Infinix, iPhone, iPad, Windows, Mac, Chromebook) */}
        <div className="p-2.5 sm:p-3.5 rounded-xl border border-purple-400/50 bg-gradient-to-r from-purple-950/60 via-slate-950/90 to-purple-950/60 flex items-start gap-2.5 shadow-md">
          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-purple-500/25 border border-purple-400/50 text-purple-300 flex items-center justify-center shrink-0 mt-0.5 shadow-inner">
            <CameraOff className="w-4 h-4 text-purple-300 animate-pulse" />
          </div>
          <div className="leading-relaxed flex-1 space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-1.5 border-b border-purple-500/20 pb-1.5">
              <div className="flex items-center gap-1.5">
                <strong className="text-white font-extrabold text-[11px] sm:text-xs tracking-wide">
                  Anti-Screenshot &amp; Capture Protection Lintas Perangkat (Semua Tipe Device)
                </strong>
              </div>
              <div className="flex flex-wrap items-center gap-1">
                <span className="px-2 py-0.5 rounded-full bg-purple-500/20 border border-purple-400/50 text-purple-200 text-[8.5px] font-mono font-extrabold shadow-2xs">
                  🛡️ Blackout Buffer 100%
                </span>
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-400/50 text-emerald-300 text-[8.5px] font-mono font-extrabold shadow-2xs">
                  ✓ Multi-Touch Terkunci
                </span>
              </div>
            </div>

            <p className="text-[10px] sm:text-[10.5px] text-slate-200 leading-snug">
              Sistem keamanan <strong className="text-purple-300 font-extrabold">mengunci dan memblokir tangkapan layar (screenshot) pada seluruh merek dan tipe perangkat</strong>: HP Android (Samsung OneUI, Xiaomi HyperOS/MIUI, OPPO ColorOS, Vivo FuntouchOS, Realme UI, Infinix XOS), iPhone/iPad (iOS), Laptop Windows, MacBook (macOS), dan Chromebook.
            </p>

            {/* Matriks Proteksi Spesifik per Merek & Tipe Perangkat */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-[9.5px]">
              <div className="p-2 rounded-lg bg-slate-900/90 border border-purple-400/30 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-extrabold text-purple-300 flex items-center gap-1">
                    <Smartphone className="w-3 h-3 text-emerald-400" />
                    HP Android (Semua Merk) &amp; iPhone:
                  </span>
                  <span className="text-[8px] font-mono px-1 rounded bg-purple-950 text-purple-200 border border-purple-500/40">
                    Sensor Gelap Instan
                  </span>
                </div>
                <div className="text-slate-300 space-y-0.5 text-[9px] sm:text-[9.5px] leading-tight">
                  <div>• <strong>Gesture Usap 3 Jari</strong> (Xiaomi, Oppo, Realme, Vivo, Infinix) dibatalkan instan.</div>
                  <div>• <strong>Tombol Fisik (Power + Volume)</strong> memicu sensor blackout gelap murni 0 byte.</div>
                  <div>• <strong>Smart Sidebar / Edge Panel / AssistiveTouch</strong> memicu sensor blur otomatis saat ditarik.</div>
                  <div>• <strong>Papan Klip (Clipboard)</strong> dibersihkan otomatis 0 byte tanpa bekas.</div>
                </div>
              </div>

              <div className="p-2 rounded-lg bg-slate-900/90 border border-purple-400/30 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-extrabold text-sky-300 flex items-center gap-1">
                    <Laptop className="w-3 h-3 text-sky-400" />
                    Laptop Windows, MacBook &amp; Chromebook:
                  </span>
                  <span className="text-[8px] font-mono px-1 rounded bg-sky-950 text-sky-200 border border-sky-500/40">
                    Keyboard Interceptor
                  </span>
                </div>
                <div className="text-slate-300 space-y-0.5 text-[9px] sm:text-[9.5px] leading-tight">
                  <div>• <strong>PrintScreen &amp; Win+Shift+S (Snipping Tool)</strong> diblokir dan layar disensor.</div>
                  <div>• <strong>Cmd+Shift+3 / 4 / 5</strong> pada macOS disensor layar hitam penuh.</div>
                  <div>• <strong>Ctrl+F5 (Switch Window)</strong> pada Chromebook terkunci proteksi tangkapan layar.</div>
                  <div>• <strong>Cetak / Simpan PDF (Ctrl+P / Cmd+P)</strong> dikosongkan total anti-bocor.</div>
                </div>
              </div>
            </div>

            {/* Tanda Air Forensik Digital Dinamis */}
            <div className="p-2 rounded-lg bg-rose-950/40 border border-rose-500/40 text-[9.5px] sm:text-[10px] text-rose-200 flex items-start gap-2">
              <EyeOff className="w-3.5 h-3.5 text-rose-400 shrink-0 mt-0.5" />
              <div className="leading-snug">
                <strong>Tanda Air Forensik Digital Dinamis:</strong> Seluruh area soal ujian tertempel tanda air transparan berjalan berisi <em>Nama Siswa, NISN, Kelas, Tipe Device ({effectiveDeviceModel}), &amp; Jam Detik Real-Time</em>, sehingga jika difoto menggunakan kamera HP lain bukti kebocoran langsung melacak identitas siswa yang bersangkutan.
              </div>
            </div>

            {/* Tombol Simulasi Uji Coba Sensor Anti-Screenshot */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
              <div className="text-[8.5px] font-mono text-purple-300 flex items-center gap-1">
                <Zap className="w-3 h-3 text-amber-300" />
                <span>Status Sensor Perangkat Aktif: <strong>100% Proteksi ({detectedDevice.deviceCategory})</strong></span>
              </div>
              <button
                type="button"
                onClick={handleTestScreenshotShield}
                disabled={testSimulated}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-[9px] sm:text-[10px] shadow-sm cursor-pointer transition-all active:scale-95 disabled:opacity-60"
              >
                <Sparkles className="w-3 h-3 text-amber-300" />
                <span>{testSimulated ? 'Sensor Terpicu (Blackout Buffer Aktif)...' : 'Uji Coba Sensor Anti-Screenshot'}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Fitur 4: Sistem Anti-Curang 3x Kesempatan & Hitung Mundur 15 Detik Ditendang Keluar */}
        <div className="p-2.5 rounded-lg border-2 border-rose-500/60 bg-gradient-to-r from-rose-950/60 via-slate-950/85 to-rose-950/60 flex items-start gap-2.5">
          <div className="w-6 h-6 rounded-md bg-rose-600/30 text-rose-300 flex items-center justify-center shrink-0 mt-0.5">
            <Split className="w-3.5 h-3.5 text-rose-400" />
          </div>
          <div className="leading-relaxed flex-1 space-y-1">
            <div className="flex items-center justify-between gap-1">
              <strong className="text-rose-200 font-extrabold text-[11px]">
                Sistem Anti-Curang: Batas 3 Kali Kesempatan &amp; Peringatan pada Layar
              </strong>
              <span className="px-1.5 py-0.2 rounded bg-rose-600 text-white text-[8.5px] font-mono font-extrabold uppercase animate-pulse">
                Batas 3x Pelanggaran
              </span>
            </div>
            <p className="text-[10.5px] text-rose-100 font-medium leading-snug">
              Setiap siswa diberikan <strong className="text-amber-300">3 kali kesempatan &amp; peringatan</strong>. Notifikasi pelanggaran ditampilkan di layar pada setiap perangkat (HP Android, iPhone, Laptop, Tablet):
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5 text-[9.5px] pt-0.5">
              <div className="p-1.5 rounded-md bg-slate-900/90 border border-emerald-400/40 text-emerald-200">
                <strong className="text-emerald-300 block">Pelanggaran Ke-1:</strong>
                Notifikasi Pelanggaran #1 ditampilkan, kesempatan ke-1 diberikan (Sisa 2x kesempatan).
              </div>
              <div className="p-1.5 rounded-md bg-slate-900/90 border border-amber-400/40 text-amber-200">
                <strong className="text-amber-300 block">Pelanggaran Ke-2:</strong>
                Notifikasi Pelanggaran #2 ditampilkan (Peringatan Terakhir, sisa 1x kesempatan).
              </div>
              <div className="p-1.5 rounded-md bg-rose-950/90 border border-rose-400/60 text-rose-200">
                <strong className="text-rose-300 block">Pelanggaran Ke-3:</strong>
                Dalam waktu 15 detik Anda akan ditendang keluar ujian, soal berhenti otomatis &amp; hasil dikirim ke WA Guru.
              </div>
            </div>
            {/* Pemantauan Orientasi Presisi Tinggi */}
            <div className="p-2 rounded-lg bg-sky-950/70 border border-sky-400/40 text-[9.5px] space-y-1">
              <div className="flex items-center justify-between text-sky-200">
                <span className="font-extrabold flex items-center gap-1">
                  <RotateCw className="w-3 h-3 text-sky-300 animate-spin-slow" />
                  Pemantauan Orientasi Layar Presisi (Anti-Bypass Rotasi):
                </span>
                <span className="px-1.5 py-0.2 rounded bg-sky-500/20 text-sky-300 font-mono font-bold text-[8.5px]">
                  Mode: {currentOrientation.mode.toUpperCase()} ({currentOrientation.angle}°)
                </span>
              </div>
              <p className="text-slate-200 leading-relaxed">
                Sistem memantau perubahan orientasi layar secara presisi real-time. Membelah layar menyamping (landscape split), atas-bawah (portrait split), maupun jendela mengambang (floating/pop-up window) pada HP Android modern &amp; iPhone langsung terdeteksi seketika tanpa bisa dikelabui dengan memutar posisi perangkat.
              </p>
            </div>

            <p className="text-[9.5px] text-rose-200/90 leading-tight pt-0.5">
              Setelah hitung mundur 15 detik berakhir pada pelanggaran ke-3, sistem langsung memberhentikan soal ujian secara otomatis dan mengirim hasil ujian ke WhatsApp Guru Mapel: <strong className="font-mono text-white">+62 821-6588-5568</strong>.
            </p>
          </div>
        </div>

        {/* Fitur 2: Anti-Copy Soal Ujian (Dipindahkan ke Bawah Sesuai Permintaan) */}
        <div className="p-2.5 rounded-lg border border-amber-400/40 bg-gradient-to-r from-slate-950/95 via-amber-950/20 to-slate-950/90 flex items-start gap-2.5 shadow-sm transition-all hover:border-amber-400/60">
          <div className="w-6 h-6 rounded-md bg-amber-500/20 border border-amber-400/40 text-amber-300 flex items-center justify-center shrink-0 mt-0.5 shadow-inner">
            <CopyX className="w-3.5 h-3.5" />
          </div>
          <div className="leading-relaxed flex-1">
            <div className="flex items-center justify-between gap-1">
              <strong className="text-white font-extrabold text-[11px] tracking-wide flex items-center gap-1.5">
                <span>Anti-Copy Soal &amp; Pilihan Jawaban</span>
                <span className="text-[9px] font-normal text-amber-300 font-mono">(Proteksi Teks Aktif)</span>
              </strong>
              <span className="px-1.5 py-0.2 rounded-full bg-amber-500/20 border border-amber-400/50 text-amber-300 text-[8.5px] font-mono font-extrabold shadow-2xs">
                🔒 Terkunci Total
              </span>
            </div>
            <p className="text-[10px] text-slate-300 mt-1 leading-snug">
              Soal Ujian <strong className="text-amber-300">tidak bisa di-copy / salin</strong>. Seleksi teks, klik kanan, tombol pintas <span className="font-mono text-[9px] bg-slate-900 border border-white/10 px-1 py-0.2 rounded text-slate-200">Ctrl+C / Cmd+C / Ctrl+A</span> serta gesture drag &amp; drop diblokir sepenuhnya pada semua perangkat.
            </p>
          </div>
        </div>
      </div>

      {/* Perangkat Aktif Siswa & Status Permanen Lock Full Screen Otomatis */}
      <div className="p-2.5 rounded-lg bg-slate-900/90 border border-white/10 flex flex-wrap items-center justify-between gap-2 text-[10px]">
        <div className="flex items-center gap-1.5 min-w-0">
          {getPlatformIcon()}
          <div className="truncate">
            <span className="font-bold text-white truncate block">
              {detectedDevice.deviceCategory}: {effectiveDeviceModel}
            </span>
            <span className="text-slate-400 font-mono text-[9px] block">
              Resolusi: {detectedDevice.screenResolution} · {detectedDevice.browserName}
            </span>
          </div>
        </div>

        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-950/90 text-emerald-200 border border-emerald-400/50 font-extrabold text-[9.5px] shrink-0 shadow-xs">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.9)] animate-pulse shrink-0" />
          <Lock className="w-3 h-3 text-emerald-300 shrink-0" />
          <span>OTOMATIS LOCK FULL SCREEN AKTIF</span>
        </div>
      </div>
    </div>
  );
};
