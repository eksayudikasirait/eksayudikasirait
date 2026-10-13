import React, { useEffect, useState } from 'react';
import { WifiOff, ShieldCheck } from 'lucide-react';

export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState<boolean>(() =>
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return isOnline;
}

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();
  const [dismissed, setDismissed] = useState<boolean>(false);

  useEffect(() => {
    if (isOnline) {
      setDismissed(false);
    }
  }, [isOnline]);

  if (isOnline || dismissed) return null;

  return (
    <div
      role="status"
      className="fixed bottom-3 left-3 sm:left-5 z-[9999] max-w-sm px-3 py-2 rounded-xl bg-amber-950/95 border border-amber-400/70 text-amber-100 shadow-2xl flex items-center justify-between gap-2.5 text-xs font-semibold backdrop-blur-xs animate-slide-up"
    >
      <div className="flex items-center gap-2 min-w-0">
        <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse shrink-0" />
        <WifiOff className="w-4 h-4 text-amber-300 shrink-0" />
        <div className="min-w-0 text-[10.5px] sm:text-[11px] leading-tight">
          <strong className="text-white block">Mode Offline PWA Aktif</strong>
          <span className="text-amber-200/90 text-[9.5px]">
            Antarmuka &amp; soal ujian dimuat aman dari cache offline.
          </span>
        </div>
      </div>
      <button
        type="button"
        onClick={() => setDismissed(true)}
        className="px-1.5 py-0.5 rounded text-[9.5px] font-bold bg-amber-900/60 hover:bg-amber-800 text-amber-200 cursor-pointer shrink-0"
        title="Tutup Notifikasi"
      >
        Tutup
      </button>
    </div>
  );
};
