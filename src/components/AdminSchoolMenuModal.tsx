import React from 'react';
import {
  X,
  ShieldCheck,
  Lock,
  Sparkles,
  FileSpreadsheet,
  RotateCcw,
  Code2,
  FileText,
  MonitorCheck,
  Users,
  KeyRound,
  CheckCircle2,
  ChevronRight,
  Database,
  ArrowRight,
} from 'lucide-react';
import { EXAM_INFO } from '../data/examData';

interface AdminSchoolMenuModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDeactivateAdmin: () => void;
  onNavigateTab: (tab: 'questions' | 'submissions' | 'analysis' | 'visual_analytics' | 'integration') => void;
  onOpenCreateSession: () => void;
  onOpenResetSubmissions: () => void;
  onOpenMonitoring?: () => void;
  totalSubmissions: number;
  totalQuestions: number;
}

export const AdminSchoolMenuModal: React.FC<AdminSchoolMenuModalProps> = React.memo(({
  isOpen,
  onClose,
  onDeactivateAdmin,
  onNavigateTab,
  onOpenCreateSession,
  onOpenResetSubmissions,
  onOpenMonitoring,
  totalSubmissions,
  totalQuestions,
}) => {
  if (!isOpen) return null;

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
      aria-labelledby="admin-school-menu-title"
    >
      <div className="max-w-2xl w-full rounded-2xl border border-purple-500/60 p-4 sm:p-5 space-y-4 shadow-2xl bg-gradient-to-br from-slate-950 via-slate-900 to-purple-950 text-white animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] flex flex-col">
        {/* Header Modal */}
        <div className="flex items-center justify-between border-b pb-3 border-white/15 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-purple-500/25 border border-purple-400/50 flex items-center justify-center text-purple-300 shrink-0 shadow-xs">
              <ShieldCheck className="w-5 h-5 text-purple-300" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="px-2 py-0.5 rounded-full bg-purple-900/80 border border-purple-400/50 text-purple-200 text-[8.5px] sm:text-[9px] font-mono font-extrabold uppercase tracking-wide">
                  🛡️ HAK AKSES OPERATOR SEKOLAH AKTIF
                </span>
                <span className="px-1.5 py-0.2 rounded text-[7.5px] sm:text-[8px] font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                  AKSES PENUH
                </span>
              </div>
              <h3 id="admin-school-menu-title" className="text-sm sm:text-base font-extrabold text-white leading-tight mt-0.5 truncate">
                Menu Admin / Operator Sekolah — {EXAM_INFO.namaSekolah}
              </h3>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer shrink-0"
            title="Tutup Menu"
            aria-label="Tutup Menu Admin"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Identity & Scope Info */}
        <div className="p-2.5 rounded-xl bg-purple-950/80 border border-purple-400/40 text-purple-200 text-xs leading-relaxed shrink-0 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="min-w-0">
            <span className="text-[10px] font-mono font-bold uppercase text-amber-300 block">
              Operator &amp; Pembuat Soal: {EXAM_INFO.guruMapelUpper}
            </span>
            <span className="text-[11px] text-slate-300 block truncate">
              {EXAM_INFO.namaSekolah} · Tahun Ajaran {EXAM_INFO.tahunAjaran} · Kurikulum Merdeka
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0 text-[10px] font-mono font-bold text-sky-300">
            <span>{totalQuestions} Soal Aktif</span>
            <span>·</span>
            <span>{totalSubmissions} Rekap Tersimpan</span>
          </div>
        </div>

        {/* Grid Pilihan Menu Admin Sekolah */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 overflow-y-auto flex-1 pr-1">
          {/* Menu 1: Buat Sesi Ujian Baru */}
          <button
            type="button"
            onClick={() => {
              onClose();
              onOpenCreateSession();
            }}
            className="p-3 rounded-xl border border-emerald-500/40 bg-slate-900/90 hover:bg-emerald-950/40 text-left transition-all cursor-pointer group shadow-xs hover:border-emerald-400"
          >
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center text-emerald-300">
                  <Sparkles className="w-3.5 h-3.5" />
                </div>
                <span className="text-xs font-extrabold text-white group-hover:text-emerald-300">
                  Buat Sesi Ujian Baru
                </span>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-emerald-300 transition-transform group-hover:translate-x-0.5" />
            </div>
            <p className="text-[10.5px] text-slate-400 group-hover:text-slate-300 leading-snug">
              Mereset riwayat submission dan menerbitkan kode token baru untuk kelas atau sesi baru.
            </p>
          </button>

          {/* Menu 2: Reset & Filter Submissions */}
          <button
            type="button"
            onClick={() => {
              onClose();
              onOpenResetSubmissions();
            }}
            className="p-3 rounded-xl border border-rose-500/40 bg-slate-900/90 hover:bg-rose-950/40 text-left transition-all cursor-pointer group shadow-xs hover:border-rose-400"
          >
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-rose-500/20 border border-rose-400/40 flex items-center justify-center text-rose-300">
                  <RotateCcw className="w-3.5 h-3.5" />
                </div>
                <span className="text-xs font-extrabold text-white group-hover:text-rose-300">
                  Reset &amp; Filter Nilai
                </span>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-rose-300 transition-transform group-hover:translate-x-0.5" />
            </div>
            <p className="text-[10.5px] text-slate-400 group-hover:text-slate-300 leading-snug">
              Hapus atau reset data submission siswa berdasarkan rentang tanggal atau secara massal.
            </p>
          </button>

          {/* Menu 3: Kelola Bank Soal Fase D */}
          <button
            type="button"
            onClick={() => {
              onClose();
              onNavigateTab('questions');
            }}
            className="p-3 rounded-xl border border-sky-500/40 bg-slate-900/90 hover:bg-sky-950/40 text-left transition-all cursor-pointer group shadow-xs hover:border-sky-400"
          >
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-sky-500/20 border border-sky-400/40 flex items-center justify-center text-sky-300">
                  <FileText className="w-3.5 h-3.5" />
                </div>
                <span className="text-xs font-extrabold text-white group-hover:text-sky-300">
                  Kelola Bank Soal
                </span>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-sky-300 transition-transform group-hover:translate-x-0.5" />
            </div>
            <p className="text-[10.5px] text-slate-400 group-hover:text-slate-300 leading-snug">
              Revisi butir soal, tambah butir soal HOTS &amp; Reguler, dan ambil soal online Fase D.
            </p>
          </button>

          {/* Menu 4: Rekap Hasil Ujian 13 Kolom */}
          <button
            type="button"
            onClick={() => {
              onClose();
              onNavigateTab('submissions');
            }}
            className="p-3 rounded-xl border border-amber-500/40 bg-slate-900/90 hover:bg-amber-950/40 text-left transition-all cursor-pointer group shadow-xs hover:border-amber-400"
          >
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-amber-500/20 border border-amber-400/40 flex items-center justify-center text-amber-300">
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                </div>
                <span className="text-xs font-extrabold text-white group-hover:text-amber-300">
                  Rekap Hasil &amp; Ranking
                </span>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-amber-300 transition-transform group-hover:translate-x-0.5" />
            </div>
            <p className="text-[10.5px] text-slate-400 group-hover:text-slate-300 leading-snug">
              Tabel rekapitulasi 13 kolom, filter per kelas/status, dan pantau siswa habis kuota token 3x.
            </p>
          </button>

          {/* Menu 5: Pengaturan Cloud & Database */}
          <button
            type="button"
            onClick={() => {
              onClose();
              onNavigateTab('integration');
            }}
            className="p-3 rounded-xl border border-indigo-500/40 bg-slate-900/90 hover:bg-indigo-950/40 text-left transition-all cursor-pointer group shadow-xs hover:border-indigo-400"
          >
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-indigo-500/20 border border-indigo-400/40 flex items-center justify-center text-indigo-300">
                  <Code2 className="w-3.5 h-3.5" />
                </div>
                <span className="text-xs font-extrabold text-white group-hover:text-indigo-300">
                  Integrasi Cloud &amp; Server
                </span>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-indigo-300 transition-transform group-hover:translate-x-0.5" />
            </div>
            <p className="text-[10.5px] text-slate-400 group-hover:text-slate-300 leading-snug">
              Konfigurasi Google Sheets, Google Apps Script, Fonnte WhatsApp, dan Cloud Firestore.
            </p>
          </button>

          {/* Menu 6: Pantau Siswa Live Monitoring */}
          {onOpenMonitoring && (
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenMonitoring();
              }}
              className="p-3 rounded-xl border border-teal-500/40 bg-slate-900/90 hover:bg-teal-950/40 text-left transition-all cursor-pointer group shadow-xs hover:border-teal-400"
            >
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-teal-500/20 border border-teal-400/40 flex items-center justify-center text-teal-300">
                    <MonitorCheck className="w-3.5 h-3.5 animate-pulse" />
                  </div>
                  <span className="text-xs font-extrabold text-white group-hover:text-teal-300">
                    Pantau Siswa Live
                  </span>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-teal-300 transition-transform group-hover:translate-x-0.5" />
              </div>
              <p className="text-[10.5px] text-slate-400 group-hover:text-slate-300 leading-snug">
                Buka panel monitoring ujian real-time untuk melihat status pengerjaan seluruh peserta.
              </p>
            </button>
          )}
        </div>

        {/* Footer Actions */}
        <div className="pt-2 border-t border-white/15 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 shrink-0">
          <button
            type="button"
            onClick={() => {
              onDeactivateAdmin();
              onClose();
            }}
            className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border border-rose-500/50 bg-rose-950/70 hover:bg-rose-900 text-rose-200 transition-colors cursor-pointer"
          >
            <Lock className="w-3.5 h-3.5 text-rose-300" />
            <span>Kunci &amp; Kembali ke Guru Standar</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-bold bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
          >
            Tutup Menu
          </button>
        </div>
      </div>
    </div>
  );
});
