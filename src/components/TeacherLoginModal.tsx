import React, { useState, useEffect, useRef } from 'react';
import { Lock, X, AlertTriangle, Eye, EyeOff, ShieldCheck, ArrowRight } from 'lucide-react';
import { EXAM_INFO } from '../data/examData';

interface TeacherLoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  expectedPassword?: string;
  guruMapelUpper?: string;
}

export const TeacherLoginModal: React.FC<TeacherLoginModalProps> = React.memo(({
  isOpen,
  onClose,
  onSuccess,
  expectedPassword = EXAM_INFO.teacherPassword,
  guruMapelUpper = EXAM_INFO.guruMapelUpper,
}) => {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Reset form dan fokus ke input saat modal dibuka
  useEffect(() => {
    if (isOpen) {
      setPassword('');
      setShowPassword(false);
      setError(null);
      // Berikan sedikit jeda untuk memastikan modal terpasang di DOM
      const timer = setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanInput = password.trim();
    if (!cleanInput) {
      setError('Silakan masukkan Kode Mode Guru terlebih dahulu.');
      inputRef.current?.focus();
      return;
    }

    if (cleanInput === expectedPassword.trim()) {
      try {
        sessionStorage.setItem('anbk_teacher_verified_session_v1', 'true');
      } catch {
        // abaikan batasan storage
      }
      setError(null);
      setPassword('');
      onSuccess();
    } else {
      setError('Password Mode Guru tidak valid! Akses ditolak. Murid/Siswa dilarang mengakses menu Guru & Admin Sekolah.');
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        className="max-w-sm w-full rounded-xl border border-sky-500/30 p-3 sm:p-3.5 space-y-2.5 shadow-2xl bg-gradient-to-br from-slate-950 via-slate-900 to-sky-950 text-white animate-in fade-in zoom-in-95 duration-150"
        role="dialog"
        aria-modal="true"
        aria-labelledby="teacher-modal-title"
      >
        {/* Header Modal */}
        <div className="flex items-center justify-between border-b pb-2 border-white/15">
          <div className="flex items-center gap-2">
            <div className="w-6.5 h-6.5 rounded-lg bg-amber-400/15 border border-amber-400/30 flex items-center justify-center text-amber-300 shrink-0 shadow-2xs">
              <Lock className="w-3.5 h-3.5" />
            </div>
            <div>
              <h3 id="teacher-modal-title" className="text-xs sm:text-sm font-extrabold text-white leading-tight">
                Otentikasi Mode Guru &amp; Admin Sekolah
              </h3>
              <span className="text-[9.5px] text-amber-300 font-semibold block leading-tight">
                🔒 Khusus Guru &amp; Operator · Murid Dilarang Mengakses
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            title="Tutup"
            aria-label="Tutup Modal"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Peringatan Larangan Akses Siswa */}
        <div className="p-2 rounded-lg bg-rose-950/40 border border-rose-500/40 text-rose-200 text-[10px] leading-snug">
          <strong className="text-rose-300 block mb-0.5">⚠️ Akses Terbatas:</strong>
          Murid / Siswa dilarang membuka menu ini. Hanya Guru Mapel (<strong className="text-amber-300">{guruMapelUpper}</strong>) yang memiliki password untuk mengakses.
        </div>

        {/* Konten Form Login */}
        <form onSubmit={handleSubmit} className="space-y-2.5">
          <p className="text-[10.5px] text-slate-300 leading-normal">
            Masukkan Password Mode Guru (<strong className="text-amber-300">{guruMapelUpper}</strong>) untuk membuka Panel Guru &amp; Menu Admin Sekolah.
          </p>

          {error && (
            <div className="p-2 rounded-lg bg-rose-950/90 border border-rose-500/60 text-rose-200 text-[10.5px] font-semibold flex items-center gap-2 animate-shake">
              <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <div className="flex items-center justify-between mb-1">
              <label htmlFor="teacher_mode_password_input" className="block text-[10.5px] font-semibold text-sky-200">
                Kode Mode Guru
              </label>
              <span className="text-[9px] text-amber-300 font-mono">
                {password.length > 0 ? `${password.length} Karakter` : 'Wajib Diisi'}
              </span>
            </div>

            <div className="relative">
              <input
                id="teacher_mode_password_input"
                ref={inputRef}
                type={showPassword ? 'text' : 'password'}
                name="teacher_mode_password"
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck={false}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (error) setError(null);
                }}
                placeholder="Ketik password Mode Guru..."
                className="w-full pl-2.5 pr-16 py-1.5 rounded-lg border border-white/20 bg-slate-950/90 text-white placeholder:text-slate-500 text-xs font-mono tracking-widest focus:outline-none focus:ring-1 focus:ring-amber-400 focus:border-amber-400/80 transition-all"
              />

              <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center gap-0.5">
                {password.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      setPassword('');
                      if (error) setError(null);
                      inputRef.current?.focus();
                    }}
                    className="p-1 rounded text-slate-400 hover:text-white transition-colors cursor-pointer"
                    title="Hapus teks"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="p-1 rounded text-slate-400 hover:text-amber-300 transition-colors cursor-pointer"
                  title={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}
                  aria-label={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}
                >
                  {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>
            <p className="mt-1 text-[8.5px] text-slate-400">
              * Ketik kode dengan cepat dan lancar tanpa hambatan atau karakter terhapus.
            </p>
          </div>

          <div className="flex items-center justify-end gap-1.5 pt-0.5 border-t border-white/10">
            <button
              type="button"
              onClick={onClose}
              className="px-2.5 py-1 rounded-lg text-xs font-semibold border border-white/20 bg-white/5 hover:bg-white/15 text-white transition-all cursor-pointer"
            >
              Batal
            </button>
            <button
              type="submit"
              className="px-3.5 py-1 rounded-lg text-xs font-bold bg-amber-400 hover:bg-amber-300 text-slate-950 transition-all cursor-pointer shadow-xs active:scale-[0.99] flex items-center gap-1"
            >
              <ShieldCheck className="w-3 h-3 text-slate-950 shrink-0" />
              <span>Masuk Panel Guru</span>
              <ArrowRight className="w-3 h-3 text-slate-950 shrink-0" />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
});
