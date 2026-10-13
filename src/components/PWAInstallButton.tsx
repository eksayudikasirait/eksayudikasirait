import React, { useState } from 'react';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { Download, Smartphone, Check, X, ShieldCheck } from 'lucide-react';

export const PWAInstallButton: React.FC<{ compact?: boolean }> = ({ compact = false }) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);

  // Jika sudah terpasang dalam mode standalone PWA, sembunyikan tombol
  if (isInstalled) {
    return null;
  }

  const handleInstallClick = async () => {
    setIsInstalling(true);
    try {
      await install();
    } finally {
      setIsInstalling(false);
    }
  };

  // Chromium / Android / Desktop flow
  if (isInstallable) {
    return (
      <button
        type="button"
        onClick={handleInstallClick}
        disabled={isInstalling}
        className={`inline-flex items-center gap-1.5 font-bold rounded-lg border transition-all cursor-pointer shadow-sm ${
          compact
            ? 'h-5 px-1.5 text-[7.5px] sm:text-[8px] bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 border-emerald-300 font-extrabold'
            : 'px-2.5 py-1 text-[10px] sm:text-xs bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-400/50'
        }`}
        title="Instal Aplikasi ANBK SMPN 7 ke Layar Utama HP / Laptop untuk Akses Cepat & Mode Offline"
      >
        <Download className={`${compact ? 'w-2.5 h-2.5' : 'w-3.5 h-3.5'} text-slate-950 shrink-0 animate-bounce`} />
        <span>{compact ? 'Instal App PWA' : 'Instal Aplikasi (PWA Offline)'}</span>
      </button>
    );
  }

  // iOS Safari flow
  if (isIOS) {
    return (
      <>
        <button
          type="button"
          onClick={() => setShowIOSGuide(true)}
          className={`inline-flex items-center gap-1.5 font-bold rounded-lg border transition-all cursor-pointer shadow-sm ${
            compact
              ? 'h-5 px-1.5 text-[7.5px] sm:text-[8px] bg-slate-850 hover:bg-slate-800 text-sky-200 border-sky-400/40'
              : 'px-2.5 py-1 text-[10px] sm:text-xs bg-slate-900 hover:bg-slate-800 text-sky-200 border-sky-400/40'
          }`}
          title="Petunjuk Instal Aplikasi di iPhone / iPad"
        >
          <Smartphone className={`${compact ? 'w-2.5 h-2.5' : 'w-3.5 h-3.5'} text-amber-300 shrink-0`} />
          <span>{compact ? 'Instal iPhone' : 'Instal di iOS (iPhone/iPad)'}</span>
        </button>

        {showIOSGuide && (
          <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-slate-950/85 backdrop-blur-xs p-4">
            <div className="w-full max-w-sm rounded-2xl bg-slate-900 border border-sky-400/40 p-5 shadow-2xl text-slate-100 space-y-3">
              <div className="flex items-center justify-between border-b border-white/10 pb-2">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-sky-500/20 border border-sky-400/50 flex items-center justify-center text-sky-300">
                    <Smartphone className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-xs sm:text-sm font-extrabold text-white">
                      Instal Aplikasi di iPhone / iPad
                    </h3>
                    <p className="text-[10px] text-sky-300">UPTD SMP Negeri 7 Kisaran</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowIOSGuide(false)}
                  className="text-slate-400 hover:text-white p-1 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-2 text-[11px] text-slate-200 leading-relaxed">
                <div className="flex items-start gap-2 p-2 rounded-lg bg-slate-950 border border-white/10">
                  <span className="w-5 h-5 rounded-full bg-sky-500/30 text-sky-300 font-mono font-bold flex items-center justify-center shrink-0">
                    1
                  </span>
                  <div>
                    Ketuk tombol <strong>Bagikan (Share / Ikon Kotak Panah ke Atas)</strong> pada bilah bawah browser Safari.
                  </div>
                </div>

                <div className="flex items-start gap-2 p-2 rounded-lg bg-slate-950 border border-white/10">
                  <span className="w-5 h-5 rounded-full bg-sky-500/30 text-sky-300 font-mono font-bold flex items-center justify-center shrink-0">
                    2
                  </span>
                  <div>
                    Gulir ke bawah menu lalu pilih <strong>&quot;Tambah ke Layar Utama&quot; (Add to Home Screen)</strong>.
                  </div>
                </div>

                <div className="flex items-start gap-2 p-2 rounded-lg bg-slate-950 border border-white/10">
                  <span className="w-5 h-5 rounded-full bg-emerald-500/30 text-emerald-300 font-mono font-bold flex items-center justify-center shrink-0">
                    3
                  </span>
                  <div>
                    Ketuk <strong>&quot;Tambah&quot; (Add)</strong> di pojok kanan atas. Aplikasi akan muncul di layar beranda iPhone Anda dan siap dibuka dalam mode offline mandiri.
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowIOSGuide(false)}
                className="w-full py-2 px-3 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold transition-colors cursor-pointer"
              >
                Tutup Petunjuk
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
};
