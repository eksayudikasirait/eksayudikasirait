import React, { useState, useRef } from 'react';
import {
  X,
  Image as ImageIcon,
  Upload,
  Check,
  RotateCcw,
  Sparkles,
  Sliders,
  Link as LinkIcon,
  CheckCircle2,
  Monitor,
  Camera,
} from 'lucide-react';
import {
  HERO_BANNER_PRESETS,
  getDefaultHeroBannerUrl,
  setCustomHeroBannerUrl,
  setActiveHeroBannerOpacity,
  EXAM_INFO,
} from '../data/examData';
import { TutWuriLogo } from './TutWuriLogo';

interface HeroBannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentBannerUrl: string;
  onSelectBanner: (url: string) => void;
  currentOpacity: number;
  onChangeOpacity: (opacity: number) => void;
}

export const HeroBannerModal: React.FC<HeroBannerModalProps> = ({
  isOpen,
  onClose,
  currentBannerUrl,
  onSelectBanner,
  currentOpacity,
  onChangeOpacity,
}) => {
  const [selectedUrl, setSelectedUrl] = useState<string>(currentBannerUrl);
  const [opacityVal, setOpacityVal] = useState<number>(currentOpacity);
  const [customUrlInput, setCustomUrlInput] = useState<string>('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isProcessingUpload, setIsProcessingUpload] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2500);
  };

  const handleApplyPreset = (url: string, label: string) => {
    setSelectedUrl(url);
    setCustomHeroBannerUrl(url);
    onSelectBanner(url);
    showToast(`Tema ${label} berhasil diterapkan!`);
  };

  const handleOpacityChange = (val: number) => {
    setOpacityVal(val);
    setActiveHeroBannerOpacity(val);
    onChangeOpacity(val);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Silakan pilih file gambar valid (JPG, PNG, WebP).');
      return;
    }

    setIsProcessingUpload(true);
    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      if (dataUrl) {
        // Optimasi ukuran gambar menggunakan canvas agar tajam namun hemat kuota localStorage & Cloud
        const img = new Image();
        img.onload = () => {
          const maxDim = 1280;
          let width = img.width;
          let height = img.height;

          if (width > maxDim || height > maxDim) {
            if (width > height) {
              height = Math.round((height * maxDim) / width);
              width = maxDim;
            } else {
              width = Math.round((width * maxDim) / height);
              height = maxDim;
            }
          }

          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0, width, height);
            let optimizedDataUrl = canvas.toDataURL('image/jpeg', 0.78);
            if (optimizedDataUrl.length > 320000) {
              optimizedDataUrl = canvas.toDataURL('image/jpeg', 0.62);
            }
            setSelectedUrl(optimizedDataUrl);
            setCustomHeroBannerUrl(optimizedDataUrl);
            onSelectBanner(optimizedDataUrl);
            setIsProcessingUpload(false);
            showToast('Foto lab komputer berhasil diunggah & diterapkan!');
          } else {
            setSelectedUrl(dataUrl);
            setCustomHeroBannerUrl(dataUrl);
            onSelectBanner(dataUrl);
            setIsProcessingUpload(false);
            showToast('Foto lab komputer berhasil diterapkan!');
          }
        };
        img.src = dataUrl;
      }
    };
    reader.readAsDataURL(file);
  };

  const handleApplyCustomUrl = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = customUrlInput.trim();
    if (!trimmed) return;
    setSelectedUrl(trimmed);
    setCustomHeroBannerUrl(trimmed);
    onSelectBanner(trimmed);
    setCustomUrlInput('');
    showToast('URL gambar latar lab komputer berhasil diterapkan!');
  };

  const handleResetToDefault = () => {
    const defaultUrl = getDefaultHeroBannerUrl() || HERO_BANNER_PRESETS[0].url;
    setSelectedUrl(defaultUrl);
    setCustomHeroBannerUrl(null);
    onSelectBanner(defaultUrl);
    handleOpacityChange(0.85);
    showToast('Gambar latar dikembalikan ke Lab Komputer Default.');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-3 bg-black/80 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="relative w-full max-w-xl max-h-[90vh] flex flex-col rounded-xl border border-sky-500/40 bg-gradient-to-br from-slate-950 via-slate-900 to-sky-950 text-white shadow-2xl overflow-hidden">
        {/* Header Modal */}
        <div className="px-3.5 py-2.5 border-b border-white/10 flex items-center justify-between bg-slate-950/80">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-sky-500/20 border border-sky-400/40 flex items-center justify-center text-sky-300">
              <Monitor className="w-3.5 h-3.5" />
            </div>
            <div>
              <h2 className="text-xs sm:text-sm font-extrabold uppercase tracking-wide text-white leading-tight">
                Ganti Gambar Laboratorium Komputer
              </h2>
              <p className="text-[10px] text-sky-300/90 font-medium leading-tight">
                Gambar latar di belakang Logo Tut Wuri Handayani &amp; Identitas Sekolah
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body - Scrollable */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-3.5 space-y-3 text-xs">
          {/* Toast Notification */}
          {toastMessage && (
            <div className="p-2 rounded-lg bg-emerald-950/90 border border-emerald-400/50 text-emerald-200 text-[11px] font-bold flex items-center gap-1.5 shadow-lg animate-in slide-in-from-top duration-200">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span>{toastMessage}</span>
            </div>
          )}

          {/* 1. Live Interactive Preview */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-[10.5px] font-bold text-slate-300">
              <span className="flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-amber-400" />
                Pratinjau Langsung (Logo Tut Wuri Handayani &amp; Latar Lab):
              </span>
              <span className="text-[9.5px] text-amber-300 font-mono">
                Transparansi: {Math.round(opacityVal * 100)}%
              </span>
            </div>

            <div className="relative rounded-xl overflow-hidden border border-slate-700 shadow-md bg-slate-950 h-28 sm:h-32 flex items-center">
              {/* Background Lab Image with selected opacity */}
              <img
                src={selectedUrl}
                alt="Pratinjau Lab Komputer"
                className="absolute inset-0 w-full h-full object-cover object-center transition-opacity duration-300"
                style={{ opacity: opacityVal }}
                onError={(e) => {
                  (e.target as HTMLImageElement).src = HERO_BANNER_PRESETS[0].url;
                }}
              />
              {/* Soft Gradient Scrim keeping image visible */}
              <div className="absolute inset-0 bg-gradient-to-r from-slate-950/70 via-slate-950/40 to-slate-950/65" />

              {/* Logo and Text in Foreground */}
              <div className="relative z-10 p-2.5 sm:p-3 flex items-center gap-2.5 w-full">
                <div className="p-1 rounded-lg bg-white/95 shadow-md ring-2 ring-sky-400/40 shrink-0">
                  <TutWuriLogo size="sm" className="!w-10 !h-10 border-0 shadow-none" />
                </div>
                <div className="min-w-0 bg-slate-950/65 backdrop-blur-xs p-1.5 rounded-lg border border-white/10">
                  <span className="text-[9.5px] font-extrabold uppercase tracking-wider text-amber-300 block leading-tight">
                    UPTD SMP NEGERI 7 KISARAN
                  </span>
                  <span className="text-[11px] sm:text-xs font-black text-white block leading-tight">
                    SOAL INFORMATIKA · KURIKULUM MERDEKA
                  </span>
                  <span className="text-[9px] text-slate-300 block leading-tight">
                    Laboratorium Komputer ANBK &amp; CBT Terintegrasi
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* 2. Slider Kecerahan / Transparansi Gambar Latar */}
          <div className="p-2.5 rounded-xl bg-slate-950/80 border border-sky-500/30 space-y-2 shadow-sm">
            <div className="flex items-center justify-between text-[11px] font-bold">
              <span className="text-sky-200 flex items-center gap-1.5">
                <Sliders className="w-3.5 h-3.5 text-sky-400" />
                <span>Pengatur Kecerahan Gambar Latar Lab Komputer:</span>
              </span>
              <span className="px-1.5 py-0.2 rounded font-mono font-extrabold text-[11px] bg-amber-400/20 text-amber-300 border border-amber-400/35">
                {Math.round(opacityVal * 100)}%
              </span>
            </div>

            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min="0.3"
                  max="1.0"
                  step="0.05"
                  value={opacityVal}
                  onChange={(e) => handleOpacityChange(parseFloat(e.target.value))}
                  className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-400"
                />
              </div>
              <div className="flex items-center justify-between text-[8.5px] font-mono text-slate-400 px-0.5">
                <span>30% (Redup)</span>
                <span>55%</span>
                <span>75%</span>
                <span>85%</span>
                <span>95%</span>
                <span>100% (Maksimal)</span>
              </div>
            </div>

            {/* Tombol Pintas: 55%, 75%, 85%, 95%, 100% */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-1 pt-0.5">
              <button
                type="button"
                onClick={() => handleOpacityChange(0.55)}
                className={`py-1 px-1.5 rounded-lg font-bold text-[10px] flex flex-col items-center justify-center transition-all cursor-pointer ${
                  Math.round(opacityVal * 100) === 55
                    ? 'bg-amber-400 text-slate-950 font-extrabold shadow-xs ring-1 ring-amber-300/70'
                    : 'bg-slate-800/90 hover:bg-slate-700/90 text-slate-200 border border-white/10'
                }`}
              >
                <span className="font-mono text-[11px]">55%</span>
                <span className="text-[8.5px] opacity-80 font-normal">Lembut</span>
              </button>
              <button
                type="button"
                onClick={() => handleOpacityChange(0.75)}
                className={`py-1 px-1.5 rounded-lg font-bold text-[10px] flex flex-col items-center justify-center transition-all cursor-pointer ${
                  Math.round(opacityVal * 100) === 75
                    ? 'bg-amber-400 text-slate-950 font-extrabold shadow-xs ring-1 ring-amber-300/70'
                    : 'bg-slate-800/90 hover:bg-slate-700/90 text-slate-200 border border-white/10'
                }`}
              >
                <span className="font-mono text-[11px]">75%</span>
                <span className="text-[8.5px] opacity-80 font-normal">Seimbang</span>
              </button>
              <button
                type="button"
                onClick={() => handleOpacityChange(0.85)}
                className={`py-1 px-1.5 rounded-lg font-bold text-[10px] flex flex-col items-center justify-center transition-all cursor-pointer ${
                  Math.round(opacityVal * 100) === 85
                    ? 'bg-amber-400 text-slate-950 font-extrabold shadow-xs ring-1 ring-amber-300/70'
                    : 'bg-slate-800/90 hover:bg-slate-700/90 text-slate-200 border border-white/10'
                }`}
              >
                <span className="font-mono text-[11px]">85%</span>
                <span className="text-[8.5px] opacity-80 font-normal">Rekomendasi</span>
              </button>
              <button
                type="button"
                onClick={() => handleOpacityChange(0.95)}
                className={`py-1 px-1.5 rounded-lg font-bold text-[10px] flex flex-col items-center justify-center transition-all cursor-pointer ${
                  Math.round(opacityVal * 100) === 95
                    ? 'bg-amber-400 text-slate-950 font-extrabold shadow-xs ring-1 ring-amber-300/70'
                    : 'bg-slate-800/90 hover:bg-slate-700/90 text-slate-200 border border-white/10'
                }`}
              >
                <span className="font-mono text-[11px]">95%</span>
                <span className="text-[8.5px] opacity-80 font-normal">Sangat Jelas</span>
              </button>
              <button
                type="button"
                onClick={() => handleOpacityChange(1.0)}
                className={`col-span-2 sm:col-span-1 py-1 px-1.5 rounded-lg font-bold text-[10px] flex flex-col items-center justify-center transition-all cursor-pointer ${
                  Math.round(opacityVal * 100) === 100
                    ? 'bg-amber-400 text-slate-950 font-extrabold shadow-xs ring-1 ring-amber-300/70'
                    : 'bg-slate-800/90 hover:bg-slate-700/90 text-slate-200 border border-white/10'
                }`}
              >
                <span className="font-mono text-[11px]">100%</span>
                <span className="text-[8.5px] opacity-80 font-normal">Maksimal</span>
              </button>
            </div>
          </div>

          {/* 3. Pilihan Galeri Gambar Lab Komputer Siap Pakai */}
          <div className="space-y-1.5">
            <h3 className="text-[11px] font-bold text-sky-200 flex items-center gap-1.5 uppercase tracking-wider">
              <ImageIcon className="w-3.5 h-3.5 text-emerald-400" />
              Pilih Tema Laboratorium Komputer:
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {HERO_BANNER_PRESETS.map((preset) => {
                const isSelected = selectedUrl === preset.url;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => handleApplyPreset(preset.url, preset.label)}
                    className={`relative p-1.5 rounded-lg border text-left flex items-start gap-2 transition-all cursor-pointer group ${
                      isSelected
                        ? 'border-amber-400 bg-amber-400/10 ring-1 ring-amber-400/50 shadow-sm'
                        : 'border-white/10 bg-slate-950/60 hover:border-sky-400/50 hover:bg-slate-900/80'
                    }`}
                  >
                    {/* Thumbnail */}
                    <div className="w-14 h-10 rounded-md overflow-hidden shrink-0 border border-white/20 bg-slate-800 relative">
                      <img
                        src={preset.url}
                        alt={preset.label}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                      {isSelected && (
                        <div className="absolute inset-0 bg-amber-400/30 flex items-center justify-center">
                          <Check className="w-3.5 h-3.5 text-slate-950 font-black" />
                        </div>
                      )}
                    </div>

                    {/* Metadata */}
                    <div className="min-w-0 flex-1 space-y-0.5">
                      <div className="flex items-center justify-between gap-1">
                        <span className="font-bold text-[10.5px] text-white group-hover:text-sky-300 transition-colors truncate">
                          {preset.label}
                        </span>
                        {isSelected && (
                          <span className="px-1 py-0.2 rounded text-[8px] font-black uppercase tracking-wider bg-amber-400 text-slate-950">
                            Aktif
                          </span>
                        )}
                      </div>
                      <p className="text-[9.5px] text-slate-400 leading-tight line-clamp-2">
                        {preset.description}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 4. Unggah Foto Lab Sendiri & Input URL */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-0.5">
            {/* Opsi Unggah File */}
            <div className="p-2.5 rounded-xl bg-slate-950/70 border border-sky-500/25 space-y-1.5">
              <span className="text-[10.5px] font-bold text-sky-200 flex items-center gap-1">
                <Upload className="w-3 h-3 text-sky-400" />
                Unggah Foto Lab Komputer Sendiri
              </span>
              <p className="text-[9.5px] text-slate-400 leading-snug">
                Pilih foto laboratorium sekolah Anda dari perangkat.
              </p>
              <input
                type="file"
                ref={fileInputRef}
                accept="image/*"
                onChange={handleFileUpload}
                className="hidden"
              />
              <button
                type="button"
                disabled={isProcessingUpload}
                onClick={() => fileInputRef.current?.click()}
                className="w-full py-1.5 px-2.5 rounded-lg bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-[11px] flex items-center justify-center gap-1 cursor-pointer shadow-xs transition-all"
              >
                <Camera className="w-3 h-3" />
                <span>{isProcessingUpload ? 'Memproses Foto...' : 'Pilih File / Kamera'}</span>
              </button>
            </div>

            {/* Opsi Tautan Gambar */}
            <div className="p-2.5 rounded-xl bg-slate-950/70 border border-sky-500/25 space-y-1.5">
              <span className="text-[10.5px] font-bold text-sky-200 flex items-center gap-1">
                <LinkIcon className="w-3 h-3 text-emerald-400" />
                Gunakan URL Gambar Web
              </span>
              <p className="text-[9.5px] text-slate-400 leading-snug">
                Tempel tautan langsung gambar online (JPG / PNG / WebP).
              </p>
              <form onSubmit={handleApplyCustomUrl} className="flex gap-1">
                <input
                  type="url"
                  value={customUrlInput}
                  onChange={(e) => setCustomUrlInput(e.target.value)}
                  placeholder="https://...gambar-lab.jpg"
                  className="flex-1 px-2 py-1 rounded-lg border border-white/20 bg-slate-900 text-white text-[10.5px] focus:outline-none focus:ring-1 focus:ring-sky-400"
                />
                <button
                  type="submit"
                  disabled={!customUrlInput.trim()}
                  className="px-2 py-1 rounded-lg bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 font-bold text-[10.5px] cursor-pointer"
                >
                  Terapkan
                </button>
              </form>
            </div>
          </div>
        </div>

        {/* Footer Modal */}
        <div className="px-3.5 py-2.5 border-t border-white/10 bg-slate-950/90 flex flex-wrap items-center justify-between gap-2">
          <button
            type="button"
            onClick={handleResetToDefault}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-white/20 hover:bg-white/10 text-slate-300 text-[11px] font-bold transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Kembalikan ke Lab Default</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-1 rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-[11px] cursor-pointer shadow-sm transition-all"
          >
            Selesai &amp; Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
