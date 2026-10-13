import React, { useState, useEffect, useRef } from 'react';
import { Lock, X, AlertTriangle, Eye, EyeOff, ShieldCheck, ArrowRight, KeyRound } from 'lucide-react';
import { EXAM_INFO } from '../data/examData';

interface AdminOperatorAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  expectedPassword?: string;
  title?: string;
  subtitle?: string;
  description?: string;
  submitButtonText?: string;
}

export const AdminOperatorAuthModal: React.FC<AdminOperatorAuthModalProps> = React.memo(({
  isOpen,
  onClose,
  onSuccess,
  expectedPassword = EXAM_INFO.teacherPassword,
  title = 'Verifikasi Sandi Mode Guru',
  subtitle = 'Buka Menu Admin / Operator Sekolah',
  description,
  submitButtonText = 'Buka Menu Admin',
}) => {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setPassword('');
      setShowPassword(false);
      setError(null);
      const timer = setTimeout(() => {
        inputRef.current?.focus();
      }, 60);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanInput = password.trim();
    if (!cleanInput) {
      setError('Silakan masukkan Password Mode Guru terlebih dahulu.');
      inputRef.current?.focus();
      return;
    }

    if (cleanInput === expectedPassword.trim()) {
      try {
        sessionStorage.setItem('anbk_admin_operator_verified_session_v1', 'true');
      } catch {
        // abaikan batasan storage
      }
      setError(null);
      setPassword('');
      onSuccess();
    } else {
      setError('Password Mode Guru tidak valid! Akses ditolak. Murid/Siswa dilarang keras mengakses Menu Admin Sekolah.');
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 no-print"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="admin-auth-modal-title"
    >
      <div className="max-w-md w-full rounded-2xl border border-purple-500/50 p-4 sm:p-5 space-y-3.5 shadow-2xl bg-gradient-to-br from-slate-950 via-slate-900 to-purple-950 text-white animate-in fade-in zoom-in-95 duration-150">
        {/* Header Modal */}
        <div className="flex items-center justify-between border-b pb-3 border-white/15">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-purple-500/20 border border-purple-400/50 flex items-center justify-center text-purple-300 shrink-0 shadow-xs">
              <ShieldCheck className="w-4.5 h-4.5 text-purple-300" />
            </div>
            <div>
              <h3 id="admin-auth-modal-title" className="text-sm sm:text-base font-extrabold text-white leading-tight">
                {title}
              </h3>
              <span className="text-[10px] text-purple-300 font-semibold block leading-tight">
                {subtitle}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            title="Tutup"
            aria-label="Tutup Modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Info Box dengan Peringatan Larangan Akses untuk Murid */}
        <div className="p-2.5 rounded-xl bg-rose-950/40 border border-rose-500/40 text-rose-200 text-xs leading-relaxed space-y-1.5 shadow-inner">
          <div className="font-extrabold text-amber-300 flex items-center gap-1.5">
            <Lock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span>🔒 AREA TERBATAS: KHUSUS GURU &amp; OPERATOR SEKOLAH</span>
          </div>
          <p className="text-[11px] text-slate-200 leading-snug">
            {description ? (
              description
            ) : (
              <>
                <strong className="text-rose-300">Murid / Siswa dilarang keras mengakses menu ini.</strong> Hanya Guru Mapel (<strong className="text-amber-300">{EXAM_INFO.guruMapelUpper}</strong>) yang berhak membuka Menu Admin Sekolah untuk mengelola bank soal, reset data, dan membuat sesi ujian baru.
              </>
            )}
          </p>
        </div>

        {/* Form Input Password */}
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="space-y-1">
            <label
              htmlFor="admin-operator-password-input"
              className="text-[11px] font-bold text-slate-200 block"
            >
              Password Mode Guru ({EXAM_INFO.guruMapelUpper}):
            </label>
            <div className="relative flex items-center">
              <div className="absolute left-3 text-slate-400 pointer-events-none">
                <Lock className="w-4 h-4" />
              </div>
              <input
                ref={inputRef}
                id="admin-operator-password-input"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (error) setError(null);
                }}
                placeholder="Masukkan Password Guru..."
                autoComplete="current-password"
                className="w-full pl-9 pr-10 py-2 rounded-xl border border-purple-400/50 bg-slate-950 text-white font-mono text-sm placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-400 focus:border-transparent transition-all"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-2.5 p-1 rounded-md text-slate-400 hover:text-white transition-colors cursor-pointer"
                title={showPassword ? 'Sembunyikan Password' : 'Lihat Password'}
                aria-label={showPassword ? 'Sembunyikan Password' : 'Lihat Password'}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {error && (
            <div className="p-2 rounded-lg bg-rose-950/80 border border-rose-500/60 text-rose-200 text-xs font-semibold flex items-center gap-1.5 animate-in fade-in duration-100">
              <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 rounded-xl text-xs font-bold text-slate-300 hover:text-white bg-white/5 hover:bg-white/10 transition-colors cursor-pointer"
            >
              Batal
            </button>
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-black bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-400 hover:to-indigo-400 text-white shadow-md shadow-purple-600/30 transition-all cursor-pointer active:scale-95"
            >
              <span>{submitButtonText}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
});
