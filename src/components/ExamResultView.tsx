import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import confetti from 'canvas-confetti';
import {
  Question,
  StudentSubmission,
  EXAM_INFO,
  getActiveTeacherPhotoUrl,
  getCleanKelas,
  getSemesterFromSub,
  syncSubmissionsToGoogleSheetsAuto,
} from '../data/examData';
import { TutWuriLogo } from './TutWuriLogo';
import {
  Printer,
  Download,
  Send,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RotateCcw,
  RefreshCw,
  BookOpen,
  MailCheck,
  Mail,
  FileImage,
  FileText,
  Share2,
  Eye,
  Award,
  Sparkles,
  PartyPopper,
  Smartphone,
  Laptop,
  X,
  BarChart3,
  Clock,
  Copy,
  ChevronRight,
  Loader2,
  Zap,
} from 'lucide-react';
import { RemedialOptionSection, RemedialStartPayload } from './RemedialOptionSection';
import {
  buildOfficialWhatsAppReport,
  getTeacherWhatsAppUrl,
  openWhatsAppSafely,
  copyToClipboardSafely,
  shareResultFilesOrOpenWhatsApp,
} from '../utils/whatsappHelper';
import {
  useSubmissionSyncQueue,
  checkStudentSubmissionQueueStatus,
} from '../utils/submissionSyncQueue';
import { detectStudentDeviceSync } from '../utils/deviceDetector';
import { getStudentInitials } from './StudentCameraProfileModal';
import {
  generateResultImageBlobs,
  generateResultPdfBlob,
  generateCertificatePdfBlob,
  generateCertificateA4SheetDataUrl,
  triggerFileDownload,
  resolveStudentPhotoForCertificate,
} from '../utils/resultMediaGenerator';

interface ExamResultViewProps {
  submission: StudentSubmission;
  examQuestions: Question[];
  darkMode: boolean;
  printDarkMode?: boolean;
  onChangePrintDarkMode?: (val: boolean) => void;
  isDisqualifiedByCheat: boolean;
  autoReturnCountdown: number | null;
  onReturnHome: () => void;
  onRetakeExam?: () => void;
  onStartRemedialExam?: (payload: RemedialStartPayload) => void;
  onSendWhatsApp: (
    sub: StudentSubmission,
    format?: 'jpg_pdf' | 'jpg' | 'pdf',
    skipOpenWindow?: boolean
  ) => void;
  onSendEmail: (
    sub: StudentSubmission,
    mode?: 'auto_gmail' | 'mailto',
    format?: 'jpg_pdf' | 'jpg' | 'pdf'
  ) => void;
  notificationStatus: {
    emailStatus: string;
    waStatus: string;
  };
  onOpenRaporSiswa?: (sub: StudentSubmission) => void;
  onOpenClassroomDesign?: () => void;
}

export const ExamResultView: React.FC<ExamResultViewProps> = ({
  submission,
  examQuestions,
  darkMode = true,
  printDarkMode = false,
  onChangePrintDarkMode,
  isDisqualifiedByCheat,
  autoReturnCountdown,
  onReturnHome,
  onOpenRaporSiswa,
  onOpenClassroomDesign,
  onRetakeExam,
  onStartRemedialExam,
  onSendWhatsApp,
  onSendEmail,
  notificationStatus,
}) => {
  const [emailBtnFeedback, setEmailBtnFeedback] = useState<string | null>(null);
  const [emailFileNotice, setEmailFileNotice] = useState<string | null>(null);
  const [waBtnFeedback, setWaBtnFeedback] = useState<string | null>(null);
  const [waFileNotice, setWaFileNotice] = useState<string | null>(null);
  const [previewJpgUrl, setPreviewJpgUrl] = useState<string | null>(null);
  const [isGeneratingMedia, setIsGeneratingMedia] = useState<boolean>(false);
  const [pdfCertFeedback, setPdfCertFeedback] = useState<string | null>(null);
  const [simpanPdfFeedback, setSimpanPdfFeedback] = useState<string | null>(null);
  const [cetakCertFeedback, setCetakCertFeedback] = useState<string | null>(null);
  const [printA4BtnStatus, setPrintA4BtnStatus] = useState<string | null>(null);
  const [certPdfObjectUrl, setCertPdfObjectUrl] = useState<string | null>(null);
  const [certA4SheetDataUrl, setCertA4SheetDataUrl] = useState<string | null>(null);
  const [a4ZoomPercent, setA4ZoomPercent] = useState<75 | 100 | 125>(100);
  const [showEmbeddedPdfViewer, setShowEmbeddedPdfViewer] = useState<boolean>(false);
  const [showCertificatePrintModal, setShowCertificatePrintModal] = useState<boolean>(false);
  const [teacherPhotoUrl, setTeacherPhotoUrl] = useState<string>(() =>
    getActiveTeacherPhotoUrl()
  );
  const [studentPhotoUrl, setStudentPhotoUrl] = useState<string>(() =>
    resolveStudentPhotoForCertificate(submission)
  );
  const [copiedWaTextFeedback, setCopiedWaTextFeedback] = useState<string | null>(null);

  // Modal Pratinjau Pesan, Dokumen PDF & Gambar WhatsApp Guru Sebelum Dikirimkan
  const [showWaPreviewModal, setShowWaPreviewModal] = useState<boolean>(false);
  const [waPreviewJpgUrl, setWaPreviewJpgUrl] = useState<string | null>(null);
  const [waPreviewJpgBlob, setWaPreviewJpgBlob] = useState<Blob | null>(null);
  const [waPreviewPdfBlob, setWaPreviewPdfBlob] = useState<Blob | null>(null);
  const [isPreparingWaPreview, setIsPreparingWaPreview] = useState<boolean>(false);
  const [activeWaPreviewTab, setActiveWaPreviewTab] = useState<'all' | 'message' | 'pdf' | 'jpg'>('all');
  const [isSendingFromModal, setIsSendingFromModal] = useState<boolean>(false);
  const [modalSendFeedback, setModalSendFeedback] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (waPreviewJpgUrl) {
        URL.revokeObjectURL(waPreviewJpgUrl);
      }
    };
  }, [waPreviewJpgUrl]);

  const syncQueue = useSubmissionSyncQueue();
  const studentSyncStatus = checkStudentSubmissionQueueStatus(submission);
  const [isManualSyncingSheets, setIsManualSyncingSheets] = useState<boolean>(false);
  const [isSheetsSyncSuccessAnim, setIsSheetsSyncSuccessAnim] = useState<boolean>(false);

  const handleForceSyncToSheets = async () => {
    setIsManualSyncingSheets(true);
    try {
      syncQueue.forceProcessNow();
      await syncSubmissionsToGoogleSheetsAuto([submission], undefined, undefined, true).catch(() => {});
      await fetch(`/__api/student-dashboard-sync?_t=${Date.now()}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'upsertSubmission',
          submission,
        }),
      }).catch(() => {});
      setIsSheetsSyncSuccessAnim(true);
      setTimeout(() => setIsSheetsSyncSuccessAnim(false), 8000);
    } finally {
      setIsManualSyncingSheets(false);
    }
  };

  useEffect(() => {
    setStudentPhotoUrl(resolveStudentPhotoForCertificate(submission));
  }, [submission]);

  useEffect(() => {
    const handlePhotoUpdate = () => {
      setTeacherPhotoUrl(getActiveTeacherPhotoUrl());
      setStudentPhotoUrl(resolveStudentPhotoForCertificate(submission));
    };
    window.addEventListener('anbk-photo-updated', handlePhotoUpdate);
    window.addEventListener('anbk-student-profile-updated', handlePhotoUpdate);
    window.addEventListener('storage', handlePhotoUpdate);
    return () => {
      window.removeEventListener('anbk-photo-updated', handlePhotoUpdate);
      window.removeEventListener('anbk-student-profile-updated', handlePhotoUpdate);
      window.removeEventListener('storage', handlePhotoUpdate);
    };
  }, [submission]);

  const submissionWithPhoto: StudentSubmission = {
    ...submission,
    ...(studentPhotoUrl ? { photoUrl: studentPhotoUrl } : {}),
  };

  const safeName = submission.namaSiswa.replace(/[^a-zA-Z0-9]/g, '_');
  const safeKelas = submission.kelas.replace(/[^a-zA-Z0-9]/g, '_');
  const jpgFilename = `Hasil_Ujian_ANBK_${safeName}_${safeKelas}.jpg`;
  const pdfFilename = `Hasil_Ujian_ANBK_${safeName}_${safeKelas}.pdf`;
  const certificatePdfFilename = `Sertifikat_Nilai_Ujian_ANBK_${safeName}_${safeKelas}.pdf`;

  const officialWaMessage = useMemo(() => {
    return buildOfficialWhatsAppReport(
      submissionWithPhoto,
      examQuestions,
      {
        mediaFormat: 'jpg_pdf',
        jpgFilename,
        pdfFilename,
      }
    );
  }, [submissionWithPhoto, examQuestions, jpgFilename, pdfFilename]);

  const teacherWaUrl = useMemo(() => {
    return getTeacherWhatsAppUrl(officialWaMessage, EXAM_INFO.teacherPhone);
  }, [officialWaMessage]);

  const handleDirectOpenWhatsApp = useCallback(() => {
    try {
      copyToClipboardSafely(officialWaMessage).catch(() => {});
      openWhatsAppSafely(teacherWaUrl, true);
    } catch {
      window.location.href = teacherWaUrl;
    }
  }, [officialWaMessage, teacherWaUrl]);

  // Otomatis buka WhatsApp Guru jika siswa didiskualifikasi
  useEffect(() => {
    if (isDisqualifiedByCheat) {
      const timer = setTimeout(() => {
        try {
          copyToClipboardSafely(officialWaMessage).catch(() => {});
          openWhatsAppSafely(teacherWaUrl, false);
        } catch {}
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [isDisqualifiedByCheat, officialWaMessage, teacherWaUrl]);

  const handleSaveCertificatePdf = () => {
    setIsGeneratingMedia(true);
    setPdfCertFeedback('Menyiapkan Sertifikat PDF...');
    try {
      const certBlob = generateCertificatePdfBlob(
        submissionWithPhoto,
        examQuestions,
        isDisqualifiedByCheat
      );
      triggerFileDownload(certBlob, certificatePdfFilename);
      setPdfCertFeedback('Sertifikat PDF + Foto Tersimpan!');
      setTimeout(() => setPdfCertFeedback(null), 4000);
    } finally {
      setIsGeneratingMedia(false);
    }
  };

  const buildCertificatePrintHtml = useCallback(() => {
    const fallbackDev = detectStudentDeviceSync();
    const devCat = submission.deviceCategory || fallbackDev.deviceCategory;
    const devModel = submission.deviceModel || fallbackDev.modelType;
    const devBrand = submission.deviceBrand || fallbackDev.brand;
    const devOs =
      submission.deviceOsBrowser ||
      `${fallbackDev.osNameVersion} · ${fallbackDev.browserName}`;
    const devFp = submission.deviceFingerprint || fallbackDev.deviceFingerprint || 'DEV-A83F';
    const devIp = submission.clientIp || fallbackDev.clientIp || '103.148.201.77';
    const cleanKelas = getCleanKelas(submission.kelas);
    const cleanSemester = getSemesterFromSub(submission);
    const wrongScore = Math.max(0, submission.totalSoal - submission.skorBenar);
    const answeredTotal = Object.keys(submission.answers || {}).length;
    const passedStatus =
      !isDisqualifiedByCheat &&
      submission.nilaiAkhir >= EXAM_INFO.kkm &&
      !submission.lulusTidakLulus.toLowerCase().includes('tidak');
    const vCount = submission.violationCount || 0;
    const certNo = `SERTIFIKAT-ANBK/${submission.id}/${EXAM_INFO.tahunAjaran.replace('/', '-')}`;

    const photoHtml = studentPhotoUrl
      ? `<img src="${studentPhotoUrl}" alt="Foto Siswa" style="width:110px;height:142px;object-fit:cover;border-radius:10px;border:3px solid #f59e0b;display:block;" />`
      : `<div style="width:110px;height:142px;border-radius:10px;border:3px solid #f59e0b;background:#0c4a6e;color:#fff;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:28px;font-family:monospace;">${getStudentInitials(
          submission.namaSiswa
        )}</div>`;

    const rowsHtml = examQuestions
      .map((q, idx) => {
        const ans = submission.answers?.[q.id];
        const ok = ans === q.answer;
        return `<tr style="background:${ok ? '#ecfdf5' : '#fff1f2'};border-bottom:1px solid #cbd5e1;">
          <td style="padding:5px 8px;font-weight:700;">No. ${idx + 1} [${q.difficulty}]${
          q.elemen ? ` · ${q.elemen}` : ''
        }</td>
          <td style="padding:5px 8px;text-align:center;font-weight:700;">${ans || '-'}</td>
          <td style="padding:5px 8px;text-align:center;font-weight:700;">${q.answer}</td>
          <td style="padding:5px 8px;text-align:right;font-weight:800;color:${
            ok ? '#047857' : '#be123c'
          };">${ok ? '✓ BENAR' : '✗ SALAH'}</td>
        </tr>`;
      })
      .join('');

    return `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8" />
  <title>Sertifikat Nilai Hasil Ujian - ${submission.namaSiswa}</title>
  <style>
    @page { size: A4 portrait; margin: 10mm; }
    * { box-sizing: border-box; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
    body { font-family: Arial, Helvetica, sans-serif; margin: 0; padding: 0; background: ${
      printDarkMode ? '#020617' : '#ffffff'
    }; color: ${printDarkMode ? '#f8fafc' : '#0f172a'}; }
    .cert-frame { border: 4px double #0c4a6e; outline: 2px solid #f59e0b; padding: 16px; border-radius: 12px; background: ${
      printDarkMode ? '#0f172a' : '#ffffff'
    }; }
    .header { background: linear-gradient(90deg, #0c4a6e, #0f172a); color: #fff; padding: 14px 18px; border-radius: 10px; text-align: center; border-bottom: 3px solid #f59e0b; }
    .grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; flex: 1; }
    .card { padding: 7px 10px; border-radius: 8px; border: 1px solid ${
      printDarkMode ? '#334155' : '#cbd5e1'
    }; background: ${printDarkMode ? '#1e293b' : '#f8fafc'}; font-size: 11px; }
    .label { font-size: 9px; font-weight: 800; text-transform: uppercase; color: ${
      printDarkMode ? '#38bdf8' : '#0369a1'
    }; display: block; }
    .val { font-size: 12px; font-weight: 800; margin-top: 2px; display: block; }
    table { width: 100%; border-collapse: collapse; font-size: 10.5px; margin-top: 8px; color: #0f172a; }
    th { background: #0c4a6e; color: #fff; padding: 6px 8px; text-align: left; }
  </style>
</head>
<body>
  <div class="cert-frame">
    <div class="header">
      <div style="font-size:10px;font-weight:800;color:#fcd34d;letter-spacing:0.06em;">SERTIFIKAT NILAI & HASIL UJIAN ASESMEN NASIONAL BERBASIS KOMPUTER (ANBK)</div>
      <div style="font-size:18px;font-weight:900;margin:4px 0;">${EXAM_INFO.namaSekolah}</div>
      <div style="font-size:11px;color:#bae6fd;">Mata Pelajaran: INFORMATIKA · ${EXAM_INFO.kurikulum} · Tahun Ajaran ${EXAM_INFO.tahunAjaran}</div>
      <div style="font-size:10px;color:#fde68a;margin-top:3px;font-family:monospace;">Nomor Sertifikat: ${certNo}</div>
    </div>

    <div style="display:flex;gap:16px;align-items:stretch;margin-top:14px;">
      <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;padding:8px;border:2px solid #f59e0b;border-radius:12px;background:#0f172a;color:#fff;width:132px;flex-shrink:0;">
        ${photoHtml}
        <div style="margin-top:6px;background:#f59e0b;color:#0f172a;font-size:8.5px;font-weight:900;padding:3px 6px;border-radius:4px;text-align:center;width:100%;">FOTO SISWA PESERTA</div>
        <div style="margin-top:3px;font-size:8px;color:#6ee7b7;font-weight:700;">✓ Diambil Saat Mulai Ujian</div>
      </div>

      <div class="grid">
        <div class="card"><span class="label">1. Nama Siswa</span><span class="val">${submission.namaSiswa}</span></div>
        <div class="card"><span class="label">2. Kelas</span><span class="val">Kelas ${cleanKelas}</span></div>
        <div class="card"><span class="label">3. NIS / NISN</span><span class="val">${submission.nisNisn}</span></div>
        <div class="card"><span class="label">4. Semester</span><span class="val">Semester ${cleanSemester}</span></div>
        <div class="card"><span class="label">5. Nilai Benar</span><span class="val" style="color:#10b981;">${submission.skorBenar} Soal Benar (dari ${submission.totalSoal} Soal)</span></div>
        <div class="card"><span class="label">6. Nilai Salah</span><span class="val" style="color:#f43f5e;">${wrongScore} Soal Salah (Terjawab ${answeredTotal}/${submission.totalSoal})</span></div>
        <div class="card"><span class="label">7. Total Skor Nilai</span><span class="val" style="color:#f59e0b;">${submission.nilaiAkhir}% (Skor ${submission.skorBenar}/${submission.totalSoal} · KKM ${EXAM_INFO.kkm})</span></div>
        <div class="card"><span class="label">8. Lulus / Tidak Lulus</span><span class="val" style="color:${
          passedStatus ? '#10b981' : '#f43f5e'
        };">${passedStatus ? 'LULUS UJIAN' : 'TIDAK LULUS UJIAN (UJIAN SUSULAN)'}</span></div>
        <div class="card" style="grid-column:span 2;"><span class="label">9. Status Integritas & Kecurangan (${vCount}/3 Pelanggaran)</span><span class="val" style="color:${
          vCount > 0 || isDisqualifiedByCheat ? '#f43f5e' : '#10b981'
        };">${submission.statusKecurangan}</span></div>
      </div>
    </div>

    <div style="margin-top:12px;">
      <div style="font-size:11px;font-weight:800;margin-bottom:4px;">RINGKASAN JAWABAN & KUNCI JAWABAN (1 – ${
        examQuestions.length
      }):</div>
      <table>
        <thead>
          <tr>
            <th>Nomor & Kategori Soal</th>
            <th style="text-align:center;">Jawaban Siswa</th>
            <th style="text-align:center;">Kunci Jawaban</th>
            <th style="text-align:right;">Status</th>
          </tr>
        </thead>
        <tbody>${rowsHtml}</tbody>
      </table>
    </div>

    <div style="display:flex;justify-content:space-between;align-items:flex-end;margin-top:16px;padding-top:10px;border-top:1px solid #cbd5e1;font-size:11px;">
      <div>
        <strong>Dokumen Sertifikat Nilai Resmi ANBK Informatika</strong><br/>
        Waktu Selesai Ujian: ${submission.timestamp}
      </div>
      <div style="text-align:right;">
        <div>Kisaran, ${submission.timestamp.split(',')[0]}</div>
        <div style="margin-bottom:36px;">Guru Mata Pelajaran Informatika,</div>
        <div style="font-weight:800;text-decoration:underline;">${EXAM_INFO.guruMapelUpper}</div>
        <div style="font-size:10px;">${EXAM_INFO.namaSekolah}</div>
      </div>
    </div>
  </div>
</body>
</html>`;
  }, [examQuestions, isDisqualifiedByCheat, printDarkMode, studentPhotoUrl, submission]);

  // Pre-load hidden print iframe so synchronous user-gesture print() works immediately on click
  useEffect(() => {
    if (typeof document === 'undefined') return;
    let iframe = document.getElementById('anbk-certificate-print-iframe') as HTMLIFrameElement | null;
    if (!iframe) {
      iframe = document.createElement('iframe');
      iframe.id = 'anbk-certificate-print-iframe';
      iframe.style.position = 'fixed';
      iframe.style.right = '0';
      iframe.style.bottom = '0';
      iframe.style.width = '0';
      iframe.style.height = '0';
      iframe.style.border = '0';
      document.body.appendChild(iframe);
    }
    const doc = iframe.contentWindow?.document;
    if (doc) {
      doc.open();
      doc.write(buildCertificatePrintHtml());
      doc.close();
    }
  }, [buildCertificatePrintHtml, showCertificatePrintModal]);

  // Siapkan URL objek PDF & Lembar A4 Sertifikat resolusi tinggi saat modal dibuka
  useEffect(() => {
    if (!showCertificatePrintModal) return;
    let isCancelled = false;
    const enrichedSub: StudentSubmission = {
      ...submission,
      ...(studentPhotoUrl ? { photoUrl: studentPhotoUrl } : {}),
    };
    try {
      const certBlob = generateCertificatePdfBlob(
        enrichedSub,
        examQuestions,
        isDisqualifiedByCheat
      );
      const url = URL.createObjectURL(certBlob);
      setCertPdfObjectUrl(url);

      generateCertificateA4SheetDataUrl(
        enrichedSub,
        examQuestions,
        isDisqualifiedByCheat
      )
        .then((sheetUrl) => {
          if (!isCancelled) setCertA4SheetDataUrl(sheetUrl);
        })
        .catch(() => {});

      return () => {
        isCancelled = true;
        URL.revokeObjectURL(url);
      };
    } catch {
      return undefined;
    }
  }, [showCertificatePrintModal, submission, studentPhotoUrl, examQuestions, isDisqualifiedByCheat]);

  const handleToggleLembarPdfA4 = useCallback(async () => {
    const nextState = !showEmbeddedPdfViewer;
    setShowEmbeddedPdfViewer(nextState);
    if (nextState && !certA4SheetDataUrl) {
      try {
        const sheetUrl = await generateCertificateA4SheetDataUrl(
          {
            ...submission,
            ...(studentPhotoUrl ? { photoUrl: studentPhotoUrl } : {}),
          },
          examQuestions,
          isDisqualifiedByCheat
        );
        setCertA4SheetDataUrl(sheetUrl);
      } catch {
        // ignore
      }
    }
  }, [
    certA4SheetDataUrl,
    examQuestions,
    isDisqualifiedByCheat,
    showEmbeddedPdfViewer,
    studentPhotoUrl,
    submission,
  ]);

  const handleDownloadA4SheetPng = useCallback(async () => {
    try {
      const dataUrl =
        certA4SheetDataUrl ||
        (await generateCertificateA4SheetDataUrl(
          {
            ...submission,
            ...(studentPhotoUrl ? { photoUrl: studentPhotoUrl } : {}),
          },
          examQuestions,
          isDisqualifiedByCheat
        ));
      if (!certA4SheetDataUrl) setCertA4SheetDataUrl(dataUrl);
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = `Lembar_A4_Sertifikat_ANBK_${safeName}_${safeKelas}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch {
      // ignore
    }
  }, [
    certA4SheetDataUrl,
    examQuestions,
    isDisqualifiedByCheat,
    safeKelas,
    safeName,
    studentPhotoUrl,
    submission,
  ]);

  const triggerPrintCertificateViaIframeOrWindow = useCallback(() => {
    setPrintA4BtnStatus('Mencetak A4 & Menyiapkan PDF...');

    // 1. Panggil print() secara sinkron saat user gesture masih aktif pada iframe yang sudah di-preload
    try {
      const iframe = document.getElementById(
        'anbk-certificate-print-iframe'
      ) as HTMLIFrameElement | null;
      if (iframe && iframe.contentWindow) {
        iframe.contentWindow.focus();
        iframe.contentWindow.print();
      } else {
        window.focus();
        window.print();
      }
    } catch {
      try {
        window.print();
      } catch {
        // Jika diblokir oleh sandbox iframe, lanjutkan ke PDF Viewer & Download otomatis
      }
    }

    // 2. Pastikan file PDF Sertifikat A4 terunduh & tampilkan PDF Viewer A4 siap cetak di dalam modal
    try {
      const certBlob = generateCertificatePdfBlob(
        {
          ...submission,
          ...(studentPhotoUrl ? { photoUrl: studentPhotoUrl } : {}),
        },
        examQuestions,
        isDisqualifiedByCheat
      );
      const newUrl = URL.createObjectURL(certBlob);
      setCertPdfObjectUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return newUrl;
      });
      setShowEmbeddedPdfViewer(true);
      triggerFileDownload(certBlob, certificatePdfFilename);
      setPrintA4BtnStatus('✓ Lembar PDF A4 Aktif & Terunduh!');
      setTimeout(() => setPrintA4BtnStatus(null), 4500);
    } catch {
      setPrintA4BtnStatus('✓ Mode Cetak A4 Aktif!');
      setTimeout(() => setPrintA4BtnStatus(null), 4000);
    }
  }, [
    certificatePdfFilename,
    examQuestions,
    isDisqualifiedByCheat,
    studentPhotoUrl,
    submission,
  ]);

  const handleCetakPdfViaPrint = () => {
    setCetakCertFeedback('Menyiapkan Cetak Sertifikat...');
    setShowCertificatePrintModal(true);
    try {
      const certBlob = generateCertificatePdfBlob(
        submissionWithPhoto,
        examQuestions,
        isDisqualifiedByCheat
      );
      triggerFileDownload(certBlob, certificatePdfFilename);
      setCetakCertFeedback('✓ Sertifikat Siap Cetak & PDF Terunduh!');
      setTimeout(() => setCetakCertFeedback(null), 4500);
    } catch {
      setCetakCertFeedback('✓ Pratinjau Sertifikat Dibuka!');
      setTimeout(() => setCetakCertFeedback(null), 4000);
    }
    triggerPrintCertificateViaIframeOrWindow();
  };

  const handleDownloadJpgOnly = async () => {
    setIsGeneratingMedia(true);
    try {
      const { jpgBlob, dataUrlJpg } = await generateResultImageBlobs(
        submissionWithPhoto,
        examQuestions,
        isDisqualifiedByCheat
      );
      setPreviewJpgUrl(dataUrlJpg);
      triggerFileDownload(jpgBlob, jpgFilename);
    } finally {
      setIsGeneratingMedia(false);
    }
  };

  const handleDownloadPdfOnly = () => {
    setIsGeneratingMedia(true);
    setSimpanPdfFeedback('Menyimpan Soal dalam Bentuk PDF...');
    try {
      const pdfBlob = generateResultPdfBlob(
        submissionWithPhoto,
        examQuestions,
        isDisqualifiedByCheat
      );
      triggerFileDownload(pdfBlob, pdfFilename);
      setSimpanPdfFeedback('✓ Berhasil Simpan Soal dalam Bentuk PDF!');
      setTimeout(() => setSimpanPdfFeedback(null), 4000);
    } catch {
      setSimpanPdfFeedback('Gagal Mengunduh PDF');
      setTimeout(() => setSimpanPdfFeedback(null), 3000);
    } finally {
      setIsGeneratingMedia(false);
    }
  };

  const handleCopyWaMessage = async () => {
    const ok = await copyToClipboardSafely(officialWaMessage);
    if (ok) {
      setCopiedWaTextFeedback('✓ Teks Laporan Ujian Berhasil Disalin ke Clipboard!');
      setTimeout(() => setCopiedWaTextFeedback(null), 4500);
    }
  };

  const handleOpenWaPreviewModal = async () => {
    setShowWaPreviewModal(true);
    setModalSendFeedback(null);

    if (waPreviewJpgBlob && waPreviewPdfBlob && waPreviewJpgUrl) {
      return;
    }

    setIsPreparingWaPreview(true);
    try {
      const [imgRes, pdfRes] = await Promise.all([
        generateResultImageBlobs(
          submissionWithPhoto,
          examQuestions,
          isDisqualifiedByCheat
        ),
        Promise.resolve(
          generateResultPdfBlob(
            submissionWithPhoto,
            examQuestions,
            isDisqualifiedByCheat
          )
        ),
      ]);

      setWaPreviewJpgBlob(imgRes.jpgBlob);
      setWaPreviewPdfBlob(pdfRes);

      if (imgRes.jpgBlob) {
        if (waPreviewJpgUrl) {
          URL.revokeObjectURL(waPreviewJpgUrl);
        }
        const url = URL.createObjectURL(imgRes.jpgBlob);
        setWaPreviewJpgUrl(url);
      }
    } catch (err) {
      console.warn('Gagal menyiapkan media untuk pratinjau WA:', err);
    } finally {
      setIsPreparingWaPreview(false);
    }
  };

  const handleKirimSoalDanJawabanWa = async (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    await handleOpenWaPreviewModal();
  };

  const handleExecuteSendFromModal = async () => {
    setIsSendingFromModal(true);
    setModalSendFeedback('Mengirim berkas PDF, Gambar & Teks ke WhatsApp Guru...');

    try {
      // 1. Salin teks laporan resmi ke clipboard secara otomatis
      await copyToClipboardSafely(officialWaMessage).catch(() => {});

      let jpgBlob = waPreviewJpgBlob;
      let pdfBlob = waPreviewPdfBlob;

      if (!jpgBlob || !pdfBlob) {
        try {
          const [imgRes, pdfRes] = await Promise.all([
            generateResultImageBlobs(
              submissionWithPhoto,
              examQuestions,
              isDisqualifiedByCheat
            ),
            Promise.resolve(
              generateResultPdfBlob(
                submissionWithPhoto,
                examQuestions,
                isDisqualifiedByCheat
              )
            ),
          ]);
          jpgBlob = imgRes.jpgBlob;
          pdfBlob = pdfRes;
          setWaPreviewJpgBlob(jpgBlob);
          setWaPreviewPdfBlob(pdfBlob);
        } catch (e) {
          console.warn('Gagal menyiapkan berkas media:', e);
        }
      }

      // 2. Bagikan berkas PDF & Gambar langsung ke WhatsApp Guru
      await shareResultFilesOrOpenWhatsApp({
        message: officialWaMessage,
        jpgBlob,
        jpgFilename,
        pdfBlob,
        pdfFilename,
        targetPhone: EXAM_INFO.teacherPhone,
      });

      // 3. Sinkronisasi data ke cloud / server di latar belakang jika callback tersedia
      if (onSendWhatsApp) {
        onSendWhatsApp(submissionWithPhoto, 'jpg_pdf', true);
      }

      setModalSendFeedback('✓ Berhasil dikirimkan / dihubungkan ke WhatsApp Guru!');
      setWaBtnFeedback('✓ Berhasil Dibagikan ke WA Guru!');
      setWaFileNotice(
        `✓ Berkas PDF (${pdfFilename}) & Gambar (${jpgFilename}) berhasil disiapkan dan dikirimkan ke WhatsApp Guru Mapel (${EXAM_INFO.guruMapelUpper} - ${EXAM_INFO.teacherPhone}). Teks laporan juga disalin ke clipboard.`
      );

      setTimeout(() => {
        setShowWaPreviewModal(false);
        setIsSendingFromModal(false);
        setModalSendFeedback(null);
      }, 1800);
    } catch {
      openWhatsAppSafely(teacherWaUrl);
      setModalSendFeedback('✓ Menghubungkan ke WhatsApp Guru...');
      setWaBtnFeedback('✓ Membuka WhatsApp Guru...');
      setTimeout(() => {
        setShowWaPreviewModal(false);
        setIsSendingFromModal(false);
        setModalSendFeedback(null);
      }, 1800);
    }
  };

  const handleDownloadPdfFromModal = () => {
    if (waPreviewPdfBlob) {
      triggerFileDownload(waPreviewPdfBlob, pdfFilename);
    } else {
      handleDownloadPdfOnly();
    }
  };

  const handleDownloadJpgFromModal = () => {
    if (waPreviewJpgBlob) {
      triggerFileDownload(waPreviewJpgBlob, jpgFilename);
    } else {
      handleDownloadJpgOnly();
    }
  };

  const handleNativeShareFilesToWa = async () => {
    setWaBtnFeedback('Menyiapkan file JPG & PDF...');
    setIsGeneratingMedia(true);
    try {
      let jpgBlob: Blob | null = null;
      let pdfBlob: Blob | null = null;
      try {
        const imgRes = await generateResultImageBlobs(
          submissionWithPhoto,
          examQuestions,
          isDisqualifiedByCheat
        );
        jpgBlob = imgRes.jpgBlob;
        pdfBlob = generateResultPdfBlob(
          submissionWithPhoto,
          examQuestions,
          isDisqualifiedByCheat
        );
      } catch (err) {
        console.warn('Gagal render file untuk WA share:', err);
      }

      await shareResultFilesOrOpenWhatsApp({
        message: officialWaMessage,
        jpgBlob,
        jpgFilename,
        pdfBlob,
        pdfFilename,
        targetPhone: EXAM_INFO.teacherPhone,
      });

      setWaFileNotice(
        `✓ File Hasil Ujian (.JPG & .PDF) siap dibagikan ke WhatsApp Guru Mapel (${EXAM_INFO.guruMapelUpper} - ${EXAM_INFO.teacherPhone}).`
      );
      setWaBtnFeedback('✓ Berhasil Membagikan!');
      setTimeout(() => setWaBtnFeedback(null), 4000);
    } catch {
      openWhatsAppSafely(teacherWaUrl);
      setWaBtnFeedback('✓ Membuka WhatsApp Guru...');
      setTimeout(() => setWaBtnFeedback(null), 4000);
    } finally {
      setIsGeneratingMedia(false);
    }
  };

  const handlePreviewJpgCard = async () => {
    if (previewJpgUrl) {
      setPreviewJpgUrl(null);
      return;
    }
    setIsGeneratingMedia(true);
    try {
      const { dataUrlJpg } = await generateResultImageBlobs(
        submissionWithPhoto,
        examQuestions,
        isDisqualifiedByCheat
      );
      setPreviewJpgUrl(dataUrlJpg);
    } finally {
      setIsGeneratingMedia(false);
    }
  };

  const handleNativeShareFilesToEmail = async () => {
    setIsGeneratingMedia(true);
    try {
      const { jpgBlob } = await generateResultImageBlobs(
        submissionWithPhoto,
        examQuestions,
        isDisqualifiedByCheat
      );
      const pdfBlob = generateResultPdfBlob(
        submissionWithPhoto,
        examQuestions,
        isDisqualifiedByCheat
      );

      const jpgFile = new File([jpgBlob], jpgFilename, { type: 'image/jpeg' });
      const pdfFile = new File([pdfBlob], pdfFilename, { type: 'application/pdf' });

      if (
        typeof navigator !== 'undefined' &&
        navigator.canShare &&
        navigator.canShare({ files: [jpgFile, pdfFile] })
      ) {
        await navigator.share({
          title: `Hasil Ujian ANBK Informatika - ${submission.namaSiswa} (${EXAM_INFO.teacherEmail})`,
          text: `Kepada Yth. Bapak ${EXAM_INFO.guruMapelUpper} (${EXAM_INFO.teacherEmail}), berikut terlampir Hasil Ujian ANBK Informatika (${submission.namaSiswa} - Kelas ${submission.kelas}) dalam bentuk Format Gambar (.JPG) dan Format PDF (.PDF).`,
          files: [jpgFile, pdfFile],
        });
        return;
      }

      onSendEmail(submissionWithPhoto, 'auto_gmail', 'jpg_pdf');
      setEmailFileNotice(
        `File Hasil Ujian dalam bentuk Format Gambar (${jpgFilename}) & Format PDF (${pdfFilename}) telah dikirim ke email tujuan ${EXAM_INFO.teacherEmail}.`
      );
    } catch {
      onSendEmail(submissionWithPhoto, 'auto_gmail', 'jpg_pdf');
    } finally {
      setIsGeneratingMedia(false);
    }
  };

  const isPassed =
    !isDisqualifiedByCheat &&
    submission.nilaiAkhir >= EXAM_INFO.kkm &&
    !submission.lulusTidakLulus.toLowerCase().includes('tidak');

  const isAboveKkm = !isDisqualifiedByCheat && submission.nilaiAkhir > EXAM_INFO.kkm;

  const [isCelebratingConfetti, setIsCelebratingConfetti] = useState<boolean>(false);
  const confettiTimersRef = useRef<number[]>([]);

  const clearConfettiTimers = useCallback(() => {
    confettiTimersRef.current.forEach((timerId) => window.clearTimeout(timerId));
    confettiTimersRef.current = [];
  }, []);

  const triggerCelebrationConfetti = useCallback(() => {
    if (typeof window === 'undefined') return;
    clearConfettiTimers();
    setIsCelebratingConfetti(true);

    const celebrationColors = [
      '#fbbf24', // Amber Gold
      '#34d399', // Emerald
      '#38bdf8', // Sky Blue
      '#10b981', // Green
      '#f59e0b', // Gold
      '#a78bfa', // Violet
      '#f472b6', // Rose Pink
    ];

    try {
      // Gelombang 1: Ledakan Utama Tengah + Meriam Kiri & Kanan
      confetti({
        particleCount: 85,
        spread: 90,
        origin: { x: 0.5, y: 0.36 },
        colors: celebrationColors,
        disableForReducedMotion: true,
        zIndex: 9999,
      });

      confetti({
        particleCount: 60,
        angle: 60,
        spread: 62,
        origin: { x: 0.06, y: 0.72 },
        colors: celebrationColors,
        disableForReducedMotion: true,
        zIndex: 9999,
      });

      confetti({
        particleCount: 60,
        angle: 120,
        spread: 62,
        origin: { x: 0.94, y: 0.72 },
        colors: celebrationColors,
        disableForReducedMotion: true,
        zIndex: 9999,
      });

      // Gelombang 2: Semburan Bintang & Lingkaran di Kiri-Tengah dan Kanan-Tengah
      const t1 = window.setTimeout(() => {
        confetti({
          particleCount: 55,
          spread: 105,
          startVelocity: 40,
          shapes: ['star', 'circle'],
          scalar: 1.15,
          origin: { x: 0.28, y: 0.28 },
          colors: celebrationColors,
          disableForReducedMotion: true,
          zIndex: 9999,
        });
        confetti({
          particleCount: 55,
          spread: 105,
          startVelocity: 40,
          shapes: ['star', 'circle'],
          scalar: 1.15,
          origin: { x: 0.72, y: 0.28 },
          colors: celebrationColors,
          disableForReducedMotion: true,
          zIndex: 9999,
        });
      }, 420);

      // Gelombang 3: Meriam Samping Kedua
      const t2 = window.setTimeout(() => {
        confetti({
          particleCount: 65,
          angle: 65,
          spread: 70,
          origin: { x: 0.04, y: 0.62 },
          colors: celebrationColors,
          disableForReducedMotion: true,
          zIndex: 9999,
        });
        confetti({
          particleCount: 65,
          angle: 115,
          spread: 70,
          origin: { x: 0.96, y: 0.62 },
          colors: celebrationColors,
          disableForReducedMotion: true,
          zIndex: 9999,
        });
      }, 920);

      // Gelombang 4: Hujan Emas & Zamrud Penutup
      const t3 = window.setTimeout(() => {
        confetti({
          particleCount: submission.nilaiAkhir >= 90 ? 120 : 85,
          spread: 130,
          startVelocity: 44,
          ticks: 250,
          origin: { x: 0.5, y: 0.22 },
          colors: celebrationColors,
          disableForReducedMotion: true,
          zIndex: 9999,
        });
      }, 1500);

      const tDone = window.setTimeout(() => {
        setIsCelebratingConfetti(false);
      }, 2600);

      confettiTimersRef.current.push(t1, t2, t3, tDone);
    } catch {
      setIsCelebratingConfetti(false);
    }
  }, [clearConfettiTimers, submission.nilaiAkhir]);

  useEffect(() => {
    if (isDisqualifiedByCheat) return;
    triggerCelebrationConfetti();
    return () => {
      clearConfettiTimers();
      try {
        confetti.reset();
      } catch {
        // Abaikan jika canvas tidak tersedia
      }
    };
  }, [isDisqualifiedByCheat, submission.id, triggerCelebrationConfetti, clearConfettiTimers]);

  const answeredCount = Object.keys(submission.answers || {}).length;

  // Saran Pembelajaran sesuai capaian KKM & materi Fase D
  const getLearningAdvice = () => {
    if (isDisqualifiedByCheat) {
      return 'Ujian Anda dihentikan oleh Sistem Anti-Kecurangan karena terdeteksi pelanggaran integritas ujian (pindah tab/minimize melebihi batas, waktu peringatan habis, atau layar terbelah/split-screen). Anda dinyatakan TIDAK LULUS UJIAN dan wajib mengikuti UJIAN SUSULAN dengan pengawasan langsung Guru Mapel Bapak Eksa Yudika Sirait S.T.';
    }
    if (submission.nilaiAkhir >= 90) {
      return 'Sangat Memuaskan! Anda telah menguasai materi Informatika Kurikulum Merdeka Fase D sesuai tingkat kelas dan semester yang dipilih dengan sangat baik. Pertahankan prestasi Anda dan terus kembangkan keterampilan berpikir komputasional serta literasi digital.';
    }
    if (submission.nilaiAkhir >= EXAM_INFO.kkm) {
      return `Selamat, Anda LULUS UJIAN! Nilai KKM Anda berada pada rentang 75 sampai 100 sehingga dianggap Anda Lulus Ujian (memenuhi standar KKM ${EXAM_INFO.kkm}). Pelajari kembali pembahasan pada soal-soal yang masih belum tepat di bawah ini agar penguasaan materi HOTS Anda semakin sempurna.`;
    }
    return `Nilai KKM Anda berada pada rentang 0 sampai 74 (di bawah KKM ${EXAM_INFO.kkm}) sehingga dianggap Anda Tidak Lulus Ujian dan dijadwalkan mengikuti UJIAN SUSULAN. Silakan pelajari dengan saksama Kunci Jawaban yang Benar beserta Penjelasan Pembelajaran pada setiap nomor soal di bawah ini sebagai bahan evaluasi.`;
  };

  const handleDownloadResult = () => {
    const reportLines = [
      '====================================================================',
      `LAPORAN HASIL UJIAN ANBK - ${EXAM_INFO.namaSekolah}`,
      `SOAL INFORMATIKA (${EXAM_INFO.kurikulum})`,
      `Guru Mapel / Pembuat Soal : ${EXAM_INFO.guruMapelUpper}`,
      `Tahun Ajaran              : ${EXAM_INFO.tahunAjaran}`,
      '====================================================================',
      `Waktu Selesai             : ${submission.timestamp}`,
      `Nama Siswa                : ${submission.namaSiswa}`,
      `Kelas & Semester          : ${submission.kelas}`,
      `NIS / NISN                : ${submission.nisNisn}`,
      `Total Soal Terjawab       : ${answeredCount} dari ${submission.totalSoal} Soal`,
      `Skor Benar                : ${submission.skorBenar} Soal`,
      `Nilai Akhir (%)           : ${submission.nilaiAkhir}% (KKM: ${EXAM_INFO.kkm})`,
      `Status Kelulusan          : ${submission.lulusTidakLulus}`,
      `Status Integritas         : ${submission.statusKecurangan}`,
      '--------------------------------------------------------------------',
      'SARAN PEMBELAJARAN:',
      getLearningAdvice(),
      '--------------------------------------------------------------------',
      'DETAIL EVALUASI SETIAP SOAL (PERTANYAAN, JAWABAN SISWA, JAWABAN BENAR & PENJELASAN):',
      ...examQuestions.map((q, idx) => {
        const studentAns = submission.answers[q.id];
        const isCorrect = studentAns === q.answer;
        const selectedOptText =
          studentAns && ['A', 'B', 'C', 'D'].includes(studentAns)
            ? q.options[['A', 'B', 'C', 'D'].indexOf(studentAns)]
            : 'Tidak Dijawab';
        const correctOptText = q.options[['A', 'B', 'C', 'D'].indexOf(q.answer)];
        return [
          `\nNo. ${idx + 1} [${q.difficulty}]${q.elemen ? ` - ${q.elemen}` : ''}`,
          `Pertanyaan          : ${q.content}`,
          `Jawaban Siswa       : ${
            studentAns ? `${studentAns}. ${selectedOptText}` : 'Belum Dijawab'
          } (${isCorrect ? 'BENAR' : 'SALAH'})`,
          `Jawaban yang Benar  : ${q.answer}. ${correctOptText}`,
          `Penjelasan          : ${q.explanation}`,
        ].join('\n');
      }),
      '\n====================================================================',
    ];

    const blob = new Blob([reportLines.join('\n')], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Hasil_Ujian_Informatika_${submission.namaSiswa.replace(/\s+/g, '_')}_${submission.kelas.replace(/\s+/g, '_')}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div
      className="max-w-4xl mx-auto px-2.5 sm:px-4 py-2.5 sm:py-3.5 space-y-2.5 sm:space-y-3 exam-summary-print-root animate-exam-result-reveal"
      data-student-name={submission.namaSiswa}
      data-student-class={submission.kelas}
      data-exam-date={submission.timestamp}
    >
      {/* Header Formal Otomatis Saat Cetak (@media print) */}
      <header className="hidden print-formal-header">
        <div className="flex items-center justify-between border-b border-slate-400 pb-2 mb-2 gap-4">
          <div className="flex items-center gap-3">
            {studentPhotoUrl ? (
              <img
                src={studentPhotoUrl}
                alt={`Foto Peserta Ujian - ${submission.namaSiswa}`}
                className="w-12 h-16 object-cover rounded-md border-2 border-amber-500 shrink-0"
              />
            ) : (
              <div className="w-12 h-16 rounded-md border-2 border-slate-400 flex items-center justify-center font-mono text-xs font-extrabold shrink-0">
                {getStudentInitials(submission.namaSiswa)}
              </div>
            )}
            <div>
              <div className="text-xs font-extrabold uppercase tracking-wider">
                {EXAM_INFO.namaSekolah} — SERTIFIKAT &amp; DOKUMEN RESMI HASIL UJIAN ANBK INFORMATIKA
              </div>
              <div className="text-[11px] font-semibold">
                Kurikulum Merdeka Fase D · Tahun Ajaran {EXAM_INFO.tahunAjaran} · Guru Mapel: {EXAM_INFO.guruMapelUpper}
              </div>
              <div className="text-[10px] font-mono">
                No. Sertifikat: SERTIFIKAT-ANBK/{submission.id}/{EXAM_INFO.tahunAjaran.replace('/', '-')}
              </div>
            </div>
          </div>
          <div className="text-right font-mono text-xs font-bold">
            NILAI: {submission.nilaiAkhir}% ({isPassed ? 'LULUS' : 'TIDAK LULUS'})
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3 text-xs">
          <div>
            <span className="font-semibold">Nama Siswa: </span>
            <strong className="font-extrabold">{submission.namaSiswa}</strong> ·{' '}
            <span className="font-semibold">NIS/NISN: </span>
            <strong className="font-extrabold">{submission.nisNisn}</strong>
          </div>
          <div>
            <span className="font-semibold">Kelas: </span>
            <strong className="font-extrabold">{getCleanKelas(submission.kelas)}</strong> ·{' '}
            <span className="font-semibold">Semester: </span>
            <strong className="font-extrabold">{getSemesterFromSub(submission)}</strong>
          </div>
          <div className="text-right">
            <span className="font-semibold">Benar/Salah: </span>
            <strong className="font-extrabold">
              {submission.skorBenar} Benar / {Math.max(0, submission.totalSoal - submission.skorBenar)} Salah
            </strong>{' '}
            · <strong className="font-extrabold">Skor: {submission.nilaiAkhir}%</strong>
          </div>
          <div className="col-span-2 text-right">
            <span className="font-semibold">Status Integritas / Kecurangan: </span>
            <strong className="font-extrabold">{submission.statusKecurangan}</strong>
          </div>
        </div>
      </header>

      {/* Banner Auto-Reload ke HOME jika Diskualifikasi Kecurangan */}
      {isDisqualifiedByCheat && (
        <div className="rounded-2xl bg-gradient-to-r from-rose-950 via-rose-900 to-slate-950 text-white p-4 sm:p-5 border-2 border-rose-500 shadow-2xl space-y-3.5 no-print ring-2 ring-rose-500/50">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3.5">
            <div className="flex items-start gap-3.5">
              <div className="w-11 h-11 rounded-2xl bg-rose-600/40 border-2 border-rose-400 flex items-center justify-center shrink-0 shadow-lg animate-bounce">
                <AlertTriangle className="w-6 h-6 text-amber-300" />
              </div>
              <div className="space-y-1">
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10.5px] font-mono font-extrabold bg-rose-600 text-white uppercase tracking-wider">
                  TIDAK LULUS UJIAN &amp; WAJIB UJIAN SUSULAN
                </div>
                <h2 className="text-sm sm:text-base font-black uppercase tracking-wide text-rose-200 leading-tight">
                  UJIAN DIHENTIKAN OTOMATIS — BATAS 3 KALI PELANGGARAN TERCAPAI (DITENDANG KELUAR)
                </h2>
                <p className="text-[11.5px] text-rose-100 leading-snug">
                  Alasan Diskualifikasi: <strong className="text-amber-300">{submission.statusKecurangan}</strong>. Seluruh soal ujian otomatis dihentikan dan siswa didiskualifikasi dari sesi ini.
                </p>
                <p className="text-[11px] text-rose-200">
                  📱 Laporan hasil ujian &amp; bukti kecurangan otomatis dikirim ke WhatsApp Guru Mapel via Gateway Fonnte API: <strong className="font-mono text-white underline">{EXAM_INFO.teacherPhone}</strong> ({EXAM_INFO.guruMapelUpper}).
                </p>
                {autoReturnCountdown !== null && (
                  <span className="block mt-1 font-mono font-bold text-amber-300 text-[10.5px]">
                    ⏱️ Halaman ujian akan kembali ke Menu HOME dalam {autoReturnCountdown} detik...
                  </span>
                )}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 shrink-0 pt-2 lg:pt-0">
              <button
                type="button"
                onClick={handleDirectOpenWhatsApp}
                className="px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 active:scale-98 text-slate-950 font-black text-xs sm:text-sm flex items-center gap-2 shadow-xl ring-2 ring-emerald-300 transition-all cursor-pointer animate-pulse"
                title="Buka Aplikasi WhatsApp Siswa Sekarang untuk Mengirim Bukti ke Pak Guru"
              >
                <Send className="w-4 h-4 fill-current" />
                <span>BUKA WHATSAPP SEKARANG (+62 821-6588-5568)</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  copyToClipboardSafely(officialWaMessage);
                  alert('Laporan hasil ujian & bukti kecurangan berhasil disalin ke clipboard!');
                }}
                className="px-3 py-2 rounded-xl bg-white/15 hover:bg-white/25 text-white font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                title="Salin isi pesan laporan"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>Salin Teks WA</span>
              </button>
              <button
                type="button"
                onClick={onReturnHome}
                className="px-3 py-2 rounded-xl bg-rose-950/80 hover:bg-rose-900 border border-rose-500/50 text-white font-bold text-xs transition-colors cursor-pointer"
              >
                Kembali ke HOME
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Banner Perayaan Konfeti Saat Siswa Berhasil Menyelesaikan & Mengumpulkan Ujian */}
      {!isDisqualifiedByCheat && (
        <div
          className={`rounded-xl ${
            isPassed
              ? 'bg-gradient-to-r from-emerald-900/90 via-teal-900/90 to-amber-900/80 border-amber-400/60'
              : 'bg-gradient-to-r from-sky-900/90 via-indigo-900/90 to-amber-900/75 border-cyan-400/60'
          } text-white p-2.5 sm:p-3 border shadow-md flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 no-print animate-exam-celebration-pop`}
        >
          <div className="flex items-start gap-2.5">
            <div className="p-1.5 rounded-lg bg-amber-400/20 border border-amber-300/50 text-amber-300 shrink-0">
              <PartyPopper className="w-4 h-4 animate-bounce" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[9.5px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-400 text-slate-950">
                  {submission.nilaiAkhir >= 90
                    ? 'PREDIKAT SANGAT MEMUASKAN (DI ATAS KKM)'
                    : isAboveKkm
                    ? `MELAMPAUI STANDAR KKM (+${submission.nilaiAkhir - EXAM_INFO.kkm}% DI ATAS KKM ${EXAM_INFO.kkm})`
                    : isPassed
                    ? `MEMENUHI STANDAR KKM (${EXAM_INFO.kkm})`
                    : 'APRESIASI KERJA KERAS — UJIAN BERHASIL DIKUMPULKAN'}
                </span>
                <span className="text-[10.5px] font-bold text-emerald-300 flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-amber-300" />
                  {isPassed ? 'Selebrasi Kelulusan Aktif' : 'Selebrasi Penyelesaian Ujian'}
                </span>
              </div>
              <h2 className="text-xs sm:text-[13px] font-extrabold text-white mt-0.5 leading-snug">
                Terima kasih atas kerja kerasnya, {submission.namaSiswa}! Anda telah berhasil menyelesaikan &amp; mengumpulkan ujian dengan Nilai Akhir{' '}
                <span className="text-amber-300 underline decoration-amber-400/60">
                  {submission.nilaiAkhir}%
                </span>{' '}
                (Benar {submission.skorBenar} dari {submission.totalSoal} Soal).
              </h2>
            </div>
          </div>
          <button
            type="button"
            onClick={triggerCelebrationConfetti}
            className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 font-extrabold text-[11px] transition-all cursor-pointer shrink-0 shadow-sm ring-1 ring-white/30"
          >
            <PartyPopper className={`w-3.5 h-3.5 ${isCelebratingConfetti ? 'animate-spin' : ''}`} />
            <span>{isCelebratingConfetti ? 'Merayakan...' : 'Luncurkan Konfeti Lagi'}</span>
          </button>
        </div>
      )}

      {/* Banner Khusus: Lulus Ujian & Otomatis Mengisi Bangku di Denah Kelas (Classroom) */}
      {onOpenClassroomDesign && isPassed && !isDisqualifiedByCheat && (
        <div className="rounded-xl bg-gradient-to-r from-emerald-950 via-teal-950 to-slate-900 border-2 border-emerald-400/60 p-3 sm:p-3.5 shadow-lg flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-white no-print">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-xl bg-emerald-400/20 border border-emerald-400/40 text-emerald-300 shrink-0">
              <Award className="w-5 h-5 text-emerald-300" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded-full bg-emerald-400 text-slate-950 text-[9.5px] font-extrabold uppercase">
                  LULUS UJIAN
                </span>
                <span className="text-xs font-bold text-emerald-300">
                  Nilai: {submission.nilaiAkhir}% (≥ KKM {EXAM_INFO.kkm}%)
                </span>
              </div>
              <h3 className="text-xs sm:text-[13px] font-extrabold text-white mt-1">
                🎉 Selamat! Anda Resmi Lulus &amp; Otomatis Mengisi Bangku di Denah Kelas {getCleanKelas(submission.kelas)}
              </h3>
              <p className="text-[11px] text-slate-300 mt-0.5 leading-snug">
                Identitas Anda telah tersimpan di denah bangku interaktif Classroom. Anda dapat memeriksa denah kelas atau langsung mengirimkan laporan hasil ujian ke WhatsApp Guru di bawah.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={onOpenClassroomDesign}
              className="px-3 py-2 rounded-xl bg-gradient-to-r from-amber-400 to-yellow-400 hover:from-amber-300 hover:to-yellow-300 text-slate-950 font-extrabold text-xs flex items-center gap-1.5 shadow-md cursor-pointer transition-all hover:scale-[1.02]"
            >
              <span>Lihat Bangku di Denah Kelas</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Status Antrean Sinkronisasi Nilai ke Google Sheets Guru (Mekanisme Queue Anti-Gagal Jaringan) */}
      <div
        className={`rounded-xl p-2.5 sm:p-3 border shadow-sm transition-all no-print flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 ${
          studentSyncStatus === 'synced'
            ? 'bg-emerald-950/80 border-emerald-500/50 text-white'
            : studentSyncStatus === 'pending' || studentSyncStatus === 'processing'
            ? 'bg-amber-950/80 border-amber-500/60 text-white'
            : 'bg-slate-900 border-sky-500/40 text-white'
        }`}
      >
        <div className="flex items-start gap-2.5">
          <div
            className={`p-1.5 rounded-lg shrink-0 ${
              studentSyncStatus === 'synced'
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/40'
                : studentSyncStatus === 'pending' || studentSyncStatus === 'processing'
                ? 'bg-amber-500/20 text-amber-300 border border-amber-400/40'
                : 'bg-sky-500/20 text-sky-300 border border-sky-400/40'
            }`}
          >
            {studentSyncStatus === 'synced' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            ) : studentSyncStatus === 'processing' ? (
              <RefreshCw className="w-4 h-4 text-amber-300 animate-spin" />
            ) : studentSyncStatus === 'pending' ? (
              <Clock className="w-4 h-4 text-amber-300" />
            ) : (
              <CheckCircle2 className="w-4 h-4 text-sky-400" />
            )}
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-1.5">
              <span
                className={`text-[9px] font-extrabold uppercase font-mono tracking-wider px-2 py-0.5 rounded-full ${
                  studentSyncStatus === 'synced'
                    ? 'bg-emerald-400 text-slate-950'
                    : studentSyncStatus === 'processing'
                    ? 'bg-amber-300 text-slate-950 animate-pulse'
                    : 'bg-amber-400 text-slate-950'
                }`}
              >
                {studentSyncStatus === 'synced'
                  ? 'TERSINKRON KE GOOGLE SHEETS ✓'
                  : studentSyncStatus === 'processing'
                  ? 'SEDANG MENGIRIM KE GOOGLE SHEETS...'
                  : studentSyncStatus === 'failed'
                  ? 'MENUNGGU KONEKSI INTERNET (RETRY QUEUE)'
                  : 'ANTREAN SINKRONISASI AKTIF'}
              </span>
              <span className="text-[10px] font-mono text-slate-300">
                {syncQueue.stats.isOnline ? '🟢 Jaringan Online' : '🟠 Mode Offline (Aman di Perangkat)'}
              </span>
            </div>
            <h3 className="text-xs font-extrabold text-white mt-0.5">
              {studentSyncStatus === 'synced'
                ? 'Hasil & Bukti Ujian Berhasil Diterima Server Rekapitulasi Guru'
                : 'Data Ujian Tersimpan Aman di Perangkat & Mengantre Pengiriman'}
            </h3>
            <p className="text-[11px] text-slate-200 mt-0.5 leading-snug">
              {studentSyncStatus === 'synced'
                ? `Seluruh nilai, rincian jawaban, integritas, dan foto ujian telah terverifikasi di Google Spreadsheet Guru (Rekapitulasi 13 Kolom).`
                : `Mekanisme Antrean (Queue) menjaga agar nilai Anda tidak pernah hilang meski jaringan sekolah lambat atau terputus. Sistem otomatis mengirim ulang ke Google Sheets guru.`}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 shrink-0 self-end sm:self-center">
          <button
            type="button"
            onClick={handleForceSyncToSheets}
            disabled={isManualSyncingSheets || syncQueue.stats.isProcessing}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-slate-950 text-[11px] font-extrabold transition-all cursor-pointer shadow-sm disabled:opacity-60 active:scale-[0.98] ${
              isManualSyncingSheets || syncQueue.stats.isProcessing
                ? 'bg-amber-400 hover:bg-amber-300'
                : isSheetsSyncSuccessAnim || studentSyncStatus === 'synced'
                ? 'bg-emerald-400 hover:bg-emerald-300'
                : 'bg-amber-400 hover:bg-amber-300'
            }`}
            title="Klik untuk menyinkronkan nilai ujian ke Rekap Hasil Ujian di Google Sheets"
          >
            <RefreshCw
              className={`w-3 h-3 ${
                isManualSyncingSheets || syncQueue.stats.isProcessing ? 'animate-spin' : ''
              }`}
            />
            <span>
              {isManualSyncingSheets || syncQueue.stats.isProcessing
                ? 'Sedang Sinkron...'
                : isSheetsSyncSuccessAnim || studentSyncStatus === 'synced'
                ? 'Sinkron Ulang ke Sheets'
                : 'Kirim Antrean Sekarang'}
            </span>
          </button>

          {/* Indikator Visual (Ikon Status) di sebelah Tombol Sinkron */}
          <div
            className={`inline-flex items-center gap-1 px-2 py-1.5 rounded-lg border text-[11px] font-bold shadow-xs cursor-default ${
              isManualSyncingSheets || syncQueue.stats.isProcessing
                ? 'bg-amber-950/80 border-amber-400/60 text-amber-200 ring-1 ring-amber-400/30'
                : isSheetsSyncSuccessAnim || studentSyncStatus === 'synced'
                ? 'bg-emerald-950/80 border-emerald-400/60 text-emerald-300 ring-1 ring-emerald-400/30'
                : 'bg-slate-900 border-slate-700 text-slate-300'
            }`}
            title={
              isManualSyncingSheets || syncQueue.stats.isProcessing
                ? 'Status: Sedang mengirim data hasil ujian ke Link Google Sheets...'
                : isSheetsSyncSuccessAnim || studentSyncStatus === 'synced'
                ? 'Status: Berhasil terkirim ke Rekap Hasil Ujian pada Google Sheets ✓'
                : 'Status: Menunggu pengiriman ke Rekap Hasil Ujian pada Google Sheets'
            }
          >
            {isManualSyncingSheets || syncQueue.stats.isProcessing ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 text-amber-300 animate-spin shrink-0" />
                <span>Mengirim ke Sheets...</span>
              </>
            ) : isSheetsSyncSuccessAnim || studentSyncStatus === 'synced' ? (
              <>
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span className="font-extrabold text-emerald-300">Terkirim ke Sheets ✓</span>
              </>
            ) : (
              <>
                <Clock className="w-3.5 h-3.5 text-amber-300 shrink-0" />
                <span>Siap Kirim ke Sheets</span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Kartu Utama Ringkasan Hasil Ujian */}
      <div className="rounded-xl border border-sky-500/30 overflow-hidden bg-gradient-to-br from-slate-950 via-slate-900 to-sky-950 text-white shadow-lg print-card">
        {/* Top Banner ANBK */}
        <div className="bg-gradient-to-r from-sky-950 via-sky-900 to-slate-950 text-white px-3.5 py-3 sm:px-4 sm:py-3.5 flex flex-col sm:flex-row items-center gap-3 border-b border-sky-500/30 print-card">
          <div className="p-1.5 rounded-xl bg-white shadow-md ring-1 ring-amber-400/70 shrink-0">
            <TutWuriLogo size="sm" />
          </div>
          <div className="text-center sm:text-left flex-1 min-w-0">
            <div className="text-[10px] font-bold text-amber-300 tracking-wider">
              HASIL ASESMEN NASIONAL BERBASIS KOMPUTER (ANBK) · TAHUN AJARAN {EXAM_INFO.tahunAjaran}
            </div>
            <h1 className="font-display text-base sm:text-lg font-extrabold tracking-tight mt-0.5 text-white">
              {EXAM_INFO.namaSekolah}
            </h1>
            <div className="inline-flex items-center gap-2 mt-1.5 px-2.5 py-1 rounded-lg bg-slate-950/70 border border-amber-400/40">
              {teacherPhotoUrl && (
                <img
                  src={teacherPhotoUrl}
                  alt={`Pembuat Soal Ujian - ${EXAM_INFO.guruMapel}`}
                  referrerPolicy="no-referrer"
                  className="w-6.5 h-8.5 rounded object-cover object-top border border-amber-400 bg-red-600 shrink-0"
                />
              )}
              <div className="text-left">
                <span className="text-[9px] font-bold uppercase tracking-wider text-sky-300 block leading-tight">
                  Pembuat Soal Ujian ({EXAM_INFO.judul})
                </span>
                <strong className="text-[11px] font-extrabold text-amber-300 block leading-tight">
                  {EXAM_INFO.guruMapelUpper}
                </strong>
              </div>
            </div>
          </div>
          <div className="text-center px-3.5 py-2 rounded-xl bg-slate-950/90 border border-amber-400/50 shrink-0">
            <span className="block text-[9.5px] text-amber-300 font-bold">NILAI AKHIR (%)</span>
            <span className="text-xl sm:text-2xl font-mono font-bold tracking-tight text-white tabular-nums">
              {submission.nilaiAkhir}%
            </span>
          </div>
        </div>

        {/* Status Kelulusan & Identitas Lengkap Siswa */}
        <div className="p-3.5 sm:p-4 space-y-3.5">
          {/* Status Banner Lulus / Tidak Lulus (Tata Letak Rapi, Teratur & Tidak Memanjang ke Samping) */}
          <div
            className={`p-3 sm:p-3.5 rounded-xl border flex flex-col gap-2.5 shadow-md ${
              isPassed
                ? 'border-emerald-400/60 bg-gradient-to-br from-emerald-950/65 via-slate-950/80 to-teal-950/60 text-emerald-100 print-badge-pass'
                : 'border-rose-400/60 bg-gradient-to-br from-rose-950/65 via-slate-950/80 to-rose-950/50 text-rose-100 print-badge-fail'
            }`}
          >
            {/* Baris Atas: Informasi Status Kelulusan (Kiri) & Ringkasan Waktu / Skor (Kanan) */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-2.5">
              <div className="flex items-start gap-2.5 min-w-0 flex-1">
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border ${
                    isPassed
                      ? 'bg-emerald-500/20 border-emerald-400/50 text-emerald-300'
                      : 'bg-rose-500/20 border-rose-400/50 text-rose-300'
                  }`}
                >
                  {isPassed ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                  ) : (
                    <XCircle className="w-5 h-5 text-rose-400" />
                  )}
                </div>
                <div className="min-w-0 flex-1 space-y-0.5">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-amber-300 flex flex-wrap items-center gap-1.5">
                    <span>STATUS KELULUSAN (KKM: {EXAM_INFO.kkm})</span>
                    {isPassed && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-400/20 border border-amber-300/50 text-[9px] font-extrabold text-amber-200 no-print">
                        <Sparkles className="w-2.5 h-2.5 text-amber-300" />
                        PRESTASI TERCAPAI
                      </span>
                    )}
                  </div>
                  <h2 className="text-sm sm:text-base font-extrabold text-white leading-tight">
                    {isPassed
                      ? 'SELAMAT! ANDA LULUS UJIAN'
                      : 'TIDAK LULUS UJIAN — "UJIAN SUSULAN"'}
                  </h2>
                  <p className="text-[11px] text-slate-200 leading-snug">
                    Status Integritas / Kecurangan:{' '}
                    <strong className="text-white">{submission.statusKecurangan}</strong>
                  </p>
                </div>
              </div>

              {/* Kotak Ringkasan Waktu Selesai & Skor Benar yang Rapi */}
              <div className="px-3 py-2 rounded-lg bg-slate-950/75 border border-white/15 font-mono text-[11px] text-sky-200 flex flex-col sm:flex-row md:flex-col justify-between gap-1 shrink-0">
                <div className="text-[10px] text-slate-300">
                  Waktu Selesai: <strong className="text-white">{submission.timestamp}</strong>
                </div>
                <div className="font-extrabold text-amber-300 text-[11px] sm:text-right md:text-left">
                  Skor Benar: {submission.skorBenar} dari {submission.totalSoal} Soal ({submission.nilaiAkhir}%)
                </div>
              </div>
            </div>

            {/* Baris Bawah: Deretan Tombol Utama Setelah Selesai Ujian */}
            <div
              className={`pt-2.5 border-t border-white/15 grid grid-cols-1 sm:grid-cols-2 ${
                isPassed && onRetakeExam
                  ? 'lg:grid-cols-4'
                  : isPassed || onRetakeExam
                  ? 'lg:grid-cols-3'
                  : 'lg:grid-cols-2'
              } gap-2 no-print`}
            >
              {/* Tombol Utama 1: SIMPAN SOAL DALAM BENTUK PDF */}
              <button
                type="button"
                disabled={isGeneratingMedia}
                onClick={handleDownloadPdfOnly}
                className="h-9 px-3 rounded-xl text-[11px] font-extrabold bg-gradient-to-r from-amber-400 via-amber-300 to-yellow-400 hover:from-amber-300 hover:to-yellow-300 text-slate-950 flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-md ring-1 ring-amber-300"
              >
                <Download className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">
                  {simpanPdfFeedback || 'SIMPAN SOAL DALAM BENTUK PDF'}
                </span>
              </button>

              {/* Tombol Utama 2: KIRIM SOAL DAN JAWABAN KE WHATSAPP GURU */}
              <button
                type="button"
                disabled={isGeneratingMedia}
                onClick={handleKirimSoalDanJawabanWa}
                className="h-9 px-3 rounded-xl text-[11px] font-extrabold bg-gradient-to-r from-emerald-500 via-emerald-400 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-slate-950 flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-md ring-1 ring-emerald-300"
              >
                <Send className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">
                  {waBtnFeedback || 'KIRIM SOAL DAN JAWABAN KE WHATSAPP GURU'}
                </span>
              </button>

              <button
                type="button"
                onClick={handleCetakPdfViaPrint}
                className="h-9 px-3 rounded-xl text-[11px] font-extrabold bg-cyan-400 hover:bg-cyan-300 text-slate-950 flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-sm"
              >
                <Printer className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">{cetakCertFeedback || 'Cetak Sertifikat Nilai'}</span>
              </button>

              {onRetakeExam && (
                <button
                  type="button"
                  onClick={onRetakeExam}
                  className="h-9 px-3 rounded-xl text-[11px] font-extrabold bg-slate-800 hover:bg-slate-700 text-white border border-white/20 flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-sm"
                >
                  <RefreshCw className="w-3.5 h-3.5 shrink-0 text-amber-300" />
                  <span className="truncate">
                    {isPassed ? 'Ulangi Ujian' : 'Ujian Ulangan'}
                  </span>
                </button>
              )}

              {isPassed && onOpenClassroomDesign && (
                <button
                  type="button"
                  onClick={onOpenClassroomDesign}
                  className="h-8 px-3 rounded-lg text-[11px] font-extrabold bg-gradient-to-r from-emerald-400 to-teal-400 hover:from-emerald-300 hover:to-teal-300 text-slate-950 flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-sm"
                >
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">Lihat Bangku Kelas ({getCleanKelas(submission.kelas)})</span>
                </button>
              )}

              {isPassed && !onOpenClassroomDesign && (
                <button
                  type="button"
                  onClick={triggerCelebrationConfetti}
                  className="h-8 px-3 rounded-lg text-[11px] font-extrabold bg-white/15 hover:bg-white/25 border border-amber-400/50 text-amber-300 flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-sm"
                >
                  <PartyPopper
                    className={`w-3.5 h-3.5 shrink-0 ${isCelebratingConfetti ? 'animate-bounce' : ''}`}
                  />
                  <span className="truncate">
                    {isCelebratingConfetti ? 'Konfeti Aktif!' : 'Rayakan Kelulusan'}
                  </span>
                </button>
              )}
              {(!isPassed || submission.nilaiAkhir < EXAM_INFO.kkm) && onStartRemedialExam && (
                <a
                  href="#opsi-remedial-otomatis"
                  onClick={(e) => {
                    e.preventDefault();
                    document.getElementById('opsi-remedial-otomatis')?.scrollIntoView({ behavior: 'smooth' });
                  }}
                  className="h-9 px-3 rounded-xl text-[11px] font-extrabold bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-300 hover:from-amber-300 hover:to-yellow-200 text-slate-950 flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-md ring-1 ring-amber-300"
                >
                  <Zap className="w-3.5 h-3.5 shrink-0 fill-slate-950" />
                  <span className="truncate">Opsi Remedial Otomatis (KKM 75)</span>
                </a>
              )}
            </div>

            {/* Keterangan Status Otomatis Masuk Denah Kelas Classroom Berdasarkan KKM 75 */}
            <div
              className={`mt-1 px-3 py-2 rounded-lg border text-[11px] flex flex-col sm:flex-row sm:items-center justify-between gap-2 no-print ${
                isPassed
                  ? 'bg-emerald-950/75 border-emerald-400/50 text-emerald-100'
                  : 'bg-rose-950/75 border-rose-400/50 text-rose-100'
              }`}
            >
              <div className="flex items-start gap-2">
                {isPassed ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-amber-300 shrink-0 mt-0.5" />
                )}
                <span>
                  {isPassed ? (
                    <>
                      <strong>OTOMATIS MASUK DENAH KELAS CLASSROOM:</strong> Karena Anda telah menyelesaikan semua soal ujian dan dinyatakan <strong>LULUS UJIAN (Nilai {submission.nilaiAkhir}% ≥ Standar KKM {EXAM_INFO.kkm})</strong>, nama Anda otomatis masuk ke Denah Kelas <strong>{getCleanKelas(submission.kelas)}</strong> dan mengisi bangku yang kosong.
                    </>
                  ) : (
                    <>
                      <strong>TIDAK DAPAT MASUK DENAH BANGKU KELAS CLASSROOM:</strong> Nilai Anda <strong>{submission.nilaiAkhir}%</strong> (Di bawah Standar KKM <strong>{EXAM_INFO.kkm}</strong> / Tidak Lulus Ujian). Siswa hanya akan otomatis masuk ke denah kelas di Classroom dan mengisi bangku kosong apabila sudah menyelesaikan semua soal ujian dan dinyatakan <strong>LULUS UJIAN (Minimal KKM {EXAM_INFO.kkm})</strong>. Silakan manfaatkan <strong>Sistem Opsi Remedial Otomatis</strong> di bawah ini untuk memperbaiki nilai.
                    </>
                  )}
                </span>
              </div>
              {isPassed && onOpenClassroomDesign && (
                <button
                  type="button"
                  onClick={onOpenClassroomDesign}
                  className="px-3 py-1.5 rounded-lg bg-emerald-400 hover:bg-emerald-300 text-slate-950 font-extrabold text-[10.5px] shrink-0 cursor-pointer shadow-xs"
                >
                  Buka Denah Kelas Classroom
                </button>
              )}
            </div>
          </div>

          {/* =================================================================== */}
          {/* SISTEM OPSI REMEDIAL OTOMATIS (MUNCUL JIKA NILAI SISWA DI BAWAH KKM 75) */}
          {/* =================================================================== */}
          {(!isPassed || submission.nilaiAkhir < EXAM_INFO.kkm) && (
            <RemedialOptionSection
              submission={submission}
              examQuestions={examQuestions}
              onStartRemedial={onStartRemedialExam}
              darkMode={darkMode}
            />
          )}

          {/* Kartu Sertifikat Nilai Resmi + Pas Foto Siswa & 11 Keterangan Lengkap Hasil Ujian */}
          <div className="p-3 sm:p-3.5 rounded-xl border border-amber-400/50 bg-gradient-to-r from-slate-950/95 via-sky-950/70 to-slate-950/95 shadow-md print-card">
            {(() => {
              const fallbackDev = detectStudentDeviceSync();
              const devCat = submission.deviceCategory || fallbackDev.deviceCategory;
              const devModel = submission.deviceModel || fallbackDev.modelType;
              const devBrand = submission.deviceBrand || fallbackDev.brand;
              const devOs =
                submission.deviceOsBrowser ||
                `${fallbackDev.osNameVersion} · ${fallbackDev.browserName}`;
              const devFp = submission.deviceFingerprint || fallbackDev.deviceFingerprint || 'DEV-A83F';
              const devIp = submission.clientIp || fallbackDev.clientIp || '103.148.201.77';
              const isMobile = /android|iphone|ipad|tablet/i.test(devCat);
              const cleanKelas = getCleanKelas(submission.kelas);
              const cleanSemester = getSemesterFromSub(submission);
              const wrongScore = Math.max(0, submission.totalSoal - submission.skorBenar);
              const vCount = submission.violationCount || 0;
              const hasViolation =
                vCount > 0 ||
                isDisqualifiedByCheat ||
                submission.statusKecurangan.toLowerCase().includes('pelanggaran') ||
                submission.statusKecurangan.toLowerCase().includes('diskualifikasi');

              return (
                <div className="flex flex-col md:flex-row items-center md:items-stretch gap-3.5">
                  {/* 1. FOTO SISWA (Diambil Waktu Pertama Memulai Ujian) */}
                  <div className="flex flex-col items-center justify-center shrink-0">
                    <div className="relative w-24 h-30 sm:w-26 sm:h-32 rounded-xl overflow-hidden border-2 border-amber-400 bg-gradient-to-br from-sky-800 to-slate-950 shadow-md flex items-center justify-center">
                      {studentPhotoUrl ? (
                        <img
                          src={studentPhotoUrl}
                          alt={`Foto Siswa - ${submission.namaSiswa}`}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="flex flex-col items-center justify-center text-center p-1.5">
                          <span className="font-mono text-lg font-extrabold text-amber-300">
                            {getStudentInitials(submission.namaSiswa)}
                          </span>
                          <span className="text-[9px] font-bold text-sky-200 mt-0.5">
                            FOTO SISWA
                          </span>
                        </div>
                      )}
                      <div className="absolute bottom-0 inset-x-0 bg-amber-400 text-slate-950 text-[8px] font-extrabold uppercase tracking-wider text-center py-0.5">
                        FOTO PESERTA
                      </div>
                    </div>
                    <span className="mt-1 text-[9px] font-mono font-bold text-emerald-300 text-center">
                      ✓ Foto Saat Mulai Ujian
                    </span>
                  </div>

                  {/* Detail Sertifikat Nilai & 10 Keterangan Lengkap Siswa di Dalamnya */}
                  <div className="flex-1 min-w-0 space-y-2.5 w-full">
                    <div className="flex flex-wrap items-center justify-between gap-1.5 border-b border-white/15 pb-2">
                      <div>
                        <span className="text-[9px] font-mono font-extrabold uppercase tracking-wider text-amber-300 block">
                          SERTIFIKAT NILAI &amp; DATA LENGKAP HASIL UJIAN SETELAH MENYELESAIKAN UJIAN
                        </span>
                        <span className="text-[10.5px] font-mono text-sky-200">
                          Nomor Sertifikat:{' '}
                          <strong className="text-white">
                            SERTIFIKAT-ANBK/{submission.id}/{EXAM_INFO.tahunAjaran.replace('/', '-')}
                          </strong>
                        </span>
                      </div>
                      <span
                        className={`px-2 py-0.5 rounded-md border text-[10px] font-mono font-extrabold ${
                          isPassed
                            ? 'bg-emerald-500/20 border-emerald-400/40 text-emerald-300'
                            : 'bg-rose-500/20 border-rose-400/40 text-rose-300'
                        }`}
                      >
                        Total Skor Nilai: {submission.nilaiAkhir}% ({isPassed ? 'LULUS UJIAN' : 'TIDAK LULUS'})
                      </span>
                    </div>

                    {/* Baris 1: NAMA SISWA, KELAS, NIS/NISN, SEMESTER */}
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
                      <div className="p-2 rounded-lg border bg-white/5 border-white/15">
                        <span className="text-[9px] font-mono font-bold uppercase tracking-wider text-sky-300 block">
                          Nama Siswa
                        </span>
                        <span className="text-xs font-extrabold mt-0.5 block text-white truncate">
                          {submission.namaSiswa}
                        </span>
                      </div>

                      <div className="p-2 rounded-lg border bg-white/5 border-white/15">
                        <span className="text-[9px] font-mono font-bold uppercase tracking-wider text-sky-300 block">
                          Kelas
                        </span>
                        <span className="text-xs font-extrabold mt-0.5 block text-amber-300">
                          Kelas {cleanKelas}
                        </span>
                      </div>

                      <div className="p-2 rounded-lg border bg-white/5 border-white/15">
                        <span className="text-[9px] font-mono font-bold uppercase tracking-wider text-sky-300 block">
                          NIS / NISN
                        </span>
                        <span className="text-xs font-mono font-extrabold mt-0.5 block text-white">
                          {submission.nisNisn}
                        </span>
                      </div>

                      <div className="p-2 rounded-lg border bg-white/5 border-white/15">
                        <span className="text-[9px] font-mono font-bold uppercase tracking-wider text-sky-300 block">
                          Semester
                        </span>
                        <span className="text-xs font-extrabold mt-0.5 block text-cyan-300">
                          Semester {cleanSemester}
                        </span>
                      </div>
                    </div>

                    {/* Baris 2: NILAI BENAR, NILAI SALAH, TOTAL SKOR NILAI, LULUS / TIDAK LULUS */}
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
                      <div className="p-2 rounded-lg border bg-emerald-950/40 border-emerald-400/35">
                        <span className="text-[9px] font-mono font-bold uppercase tracking-wider text-emerald-300 block">
                          Nilai Benar
                        </span>
                        <span className="text-xs font-mono font-extrabold mt-0.5 block text-emerald-300">
                          {submission.skorBenar} Benar{' '}
                          <span className="text-[10px] font-normal text-emerald-200/80">
                            (dari {submission.totalSoal} Soal)
                          </span>
                        </span>
                      </div>

                      <div className="p-2 rounded-lg border bg-rose-950/40 border-rose-400/35">
                        <span className="text-[9px] font-mono font-bold uppercase tracking-wider text-rose-300 block">
                          Nilai Salah
                        </span>
                        <span className="text-xs font-mono font-extrabold mt-0.5 block text-rose-300">
                          {wrongScore} Salah{' '}
                          <span className="text-[10px] font-normal text-rose-200/80">
                            (Terjawab: {answeredCount}/{submission.totalSoal})
                          </span>
                        </span>
                      </div>

                      <div className="p-2 rounded-lg border bg-amber-950/40 border-amber-400/40">
                        <span className="text-[9px] font-mono font-bold uppercase tracking-wider text-amber-300 block">
                          Total Skor Nilai
                        </span>
                        <span className="text-xs font-mono font-extrabold mt-0.5 block text-amber-300">
                          {submission.nilaiAkhir}%{' '}
                          <span className="text-[10px] font-normal text-amber-100/90">
                            (Skor {submission.skorBenar}/{submission.totalSoal} · KKM {EXAM_INFO.kkm})
                          </span>
                        </span>
                      </div>

                      <div
                        className={`p-2 rounded-lg border ${
                          isPassed
                            ? 'bg-emerald-950/55 border-emerald-400/50'
                            : 'bg-rose-950/55 border-rose-400/50'
                        }`}
                      >
                        <span className="text-[9px] font-mono font-bold uppercase tracking-wider text-sky-200 block">
                          Lulus / Tidak Lulus
                        </span>
                        <span
                          className={`text-xs font-extrabold mt-0.5 block ${
                            isPassed ? 'text-emerald-300' : 'text-rose-300'
                          }`}
                        >
                          {isPassed ? 'LULUS UJIAN' : 'TIDAK LULUS UJIAN'}
                        </span>
                      </div>
                    </div>

                    {/* Baris 3: STATUS INTEGRITAS & KECURANGAN */}
                    <div>
                      <div
                        className={`p-2.5 rounded-lg border flex items-center justify-between gap-2 ${
                          hasViolation
                            ? 'bg-rose-950/45 border-rose-400/45'
                            : 'bg-emerald-950/45 border-emerald-400/45'
                        }`}
                      >
                        <div className="min-w-0">
                          <span
                            className={`text-[9px] font-mono font-bold uppercase tracking-wider block ${
                              hasViolation ? 'text-rose-300' : 'text-emerald-300'
                            }`}
                          >
                            Status Integritas &amp; Kecurangan ({vCount}/3 Pelanggaran)
                          </span>
                          <span
                            className={`text-[11px] sm:text-xs font-extrabold mt-0.5 block ${
                              hasViolation ? 'text-rose-200' : 'text-emerald-300'
                            }`}
                          >
                            {submission.statusKecurangan}
                          </span>
                        </div>
                        <div className="shrink-0 text-right">
                          <span className="text-[10px] font-mono text-slate-300">
                            Waktu Selesai: {submission.timestamp}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>

          {/* Informasi Aturan Kode Token 3 Kali Pakai & Syarat Mengulangi Ujian */}
          <div className="p-2.5 sm:p-3 rounded-xl border border-amber-400/50 bg-amber-950/35 text-amber-100 text-[11px] flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 no-print">
            <div className="space-y-0.5">
              <div className="font-extrabold text-amber-300 uppercase tracking-wider flex flex-wrap items-center gap-1.5 text-[10px]">
                <span>STATUS KODE TOKEN SAAT MEMULAI UJIAN:</span>
                <span className="px-1.5 py-0.5 rounded bg-amber-500/25 border border-amber-400/50 text-amber-200 font-mono text-[9.5px]">
                  {submission.usedToken ? `${submission.usedToken} (KUOTA 3X PAKAI)` : 'BERLAKU HINGGA 3 KALI PAKAI'}
                </span>
              </div>
              <p className="text-slate-200 leading-snug text-[11px]">
                Setiap siswa yang melakukan <strong className="text-emerald-300">Ujian Susulan berulang kali</strong> akan otomatis menerima <strong className="text-white">25 Soal Ujian yang 100% BARU</strong> dan <strong className="text-amber-300">tidak akan sama dengan soal-soal ujian yang pernah dikerjakan sebelumnya</strong>. Kode Token yang dimasukkan sewaktu memulai ujian <strong className="text-amber-300">dapat digunakan hingga tiga kali (3x)</strong>; jika kuota habis, silakan <strong className="text-emerald-300">minta Kode Token Baru kepada Guru Mapelnya ({EXAM_INFO.guruMapelUpper})</strong>.
              </p>
            </div>
            {onRetakeExam && (
              <button
                type="button"
                onClick={onRetakeExam}
                className="px-3 py-1.5 rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 font-extrabold text-[11px] shrink-0 cursor-pointer shadow-sm"
              >
                Masukkan Kode Token Baru (Ulangi Ujian)
              </button>
            )}
          </div>

          {/* Saran Pembelajaran */}
          <div className="p-3 sm:p-3.5 rounded-xl border bg-sky-950/60 border-sky-500/30 text-slate-100">
            <div className="flex items-center gap-1.5 text-[10.5px] font-bold text-amber-300 uppercase tracking-wider mb-1">
              <BookOpen className="w-3.5 h-3.5" />
              <span>Saran Pembelajaran ({EXAM_INFO.kurikulum})</span>
            </div>
            <p className="text-xs leading-relaxed text-slate-200">{getLearningAdvice()}</p>
          </div>

          {/* Status Pengiriman Notifikasi Email & WhatsApp Guru (Nomor WA Disembunyikan) */}
          <div className="p-2.5 sm:p-3 rounded-xl border text-[11px] flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 bg-white/5 border-white/15 text-slate-200 no-print">
            <div className="flex items-center gap-1.5">
              <MailCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span>
                Status Pengiriman Laporan (<strong className="text-amber-300">{EXAM_INFO.teacherEmail}</strong> &{' '}
                <strong className="text-emerald-300">WhatsApp Guru</strong>):{' '}
                <span className="font-semibold text-emerald-300">
                  {notificationStatus.emailStatus} · {notificationStatus.waStatus}
                </span>
              </span>
            </div>
          </div>

          {/* Tombol Aksi: Otomatisasi Kirim WhatsApp API Fonnte (.JPG Hasil Ujian) & Kirim Manual, Kirim Email, Download JPG/PDF, Print */}
          <div className="space-y-2.5 pt-1 no-print">
            {/* Panel Hero Utama: 2 Tombol Aksi Selesai Ujian (Simpan Soal PDF & Kirim Soal Jawaban ke WhatsApp Guru) */}
            <div className="p-3 sm:p-4 rounded-2xl border-2 border-emerald-400/60 bg-gradient-to-r from-emerald-950/80 via-slate-900/90 to-sky-950/80 shadow-xl space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-2">
                <div className="flex items-center gap-2">
                  <Award className="w-4 h-4 text-amber-300 shrink-0" />
                  <div>
                    <h4 className="text-xs sm:text-sm font-extrabold text-white">
                      Aksi Utama Setelah Selesai Ujian ANBK Informatika
                    </h4>
                    <p className="text-[10px] sm:text-[11px] text-emerald-300 font-medium">
                      Simpan seluruh butir soal &amp; pembahasan dalam bentuk PDF serta serahkan rincian soal &amp; jawaban ke Guru Mapel ({EXAM_INFO.guruMapelUpper})
                    </p>
                  </div>
                </div>
                <span className="px-2 py-0.5 rounded-full bg-emerald-400/20 border border-emerald-400/40 text-[9px] sm:text-[10px] font-mono font-extrabold text-emerald-300">
                  DOKUMEN RESMI
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {/* 1. TOMBOL: SIMPAN SOAL DALAM BENTUK PDF */}
                <button
                  type="button"
                  disabled={isGeneratingMedia}
                  onClick={handleDownloadPdfOnly}
                  className="py-2.5 px-3.5 rounded-xl text-xs sm:text-[13px] font-extrabold bg-gradient-to-r from-amber-400 via-amber-300 to-yellow-400 hover:from-amber-300 hover:to-yellow-300 text-slate-950 flex items-center justify-center gap-2 transition-all cursor-pointer shadow-lg hover:shadow-amber-400/20 hover:scale-[1.01] active:scale-[0.99]"
                >
                  <Download className="w-4 h-4 shrink-0 text-slate-950" />
                  <span className="truncate">
                    {simpanPdfFeedback || 'SIMPAN SOAL DALAM BENTUK PDF'}
                  </span>
                </button>

                {/* 2. TOMBOL: KIRIM SOAL DAN JAWABAN KE WHATSAPP GURU */}
                <button
                  type="button"
                  disabled={isGeneratingMedia}
                  onClick={handleKirimSoalDanJawabanWa}
                  className="py-2.5 px-3.5 rounded-xl text-xs sm:text-[13px] font-extrabold bg-gradient-to-r from-emerald-500 via-emerald-400 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-slate-950 flex items-center justify-center gap-2 transition-all cursor-pointer shadow-lg hover:shadow-emerald-400/20 hover:scale-[1.01] active:scale-[0.99] disabled:opacity-75"
                >
                  {isGeneratingMedia ? (
                    <Loader2 className="w-4 h-4 shrink-0 animate-spin text-slate-950" />
                  ) : (
                    <Send className="w-4 h-4 shrink-0 text-slate-950" />
                  )}
                  <span className="truncate">
                    {isGeneratingMedia
                      ? 'Menyiapkan Berkas PDF & Gambar...'
                      : waBtnFeedback || `KIRIM KE WHATSAPP GURU (${EXAM_INFO.teacherPhone})`}
                  </span>
                </button>
              </div>

              {(simpanPdfFeedback || waFileNotice || copiedWaTextFeedback) && (
                <div className="p-2 rounded-lg bg-slate-950/80 border border-white/15 text-[10px] sm:text-[11px] text-sky-200 leading-snug">
                  {simpanPdfFeedback || waFileNotice || copiedWaTextFeedback}
                </div>
              )}
            </div>

            <div className="p-2.5 sm:p-3 rounded-xl border border-emerald-500/40 bg-emerald-950/35 space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-1.5">
                <div className="text-[11px] font-bold text-emerald-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Send className="w-3.5 h-3.5" />
                  <span>
                    Pengiriman WhatsApp Guru Mapel ({EXAM_INFO.guruMapelUpper})
                  </span>
                  <span className="px-1.5 py-0.5 rounded bg-emerald-500/25 border border-emerald-400/50 text-emerald-300 text-[9px] font-extrabold">
                    WA: {EXAM_INFO.teacherPhone}
                  </span>
                </div>
                <span className="text-[10px] text-emerald-200/90">
                  Laporan resmi lengkap siap dikirimkan langsung ke nomor WhatsApp Guru
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  disabled={isGeneratingMedia}
                  onClick={handleKirimSoalDanJawabanWa}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-extrabold bg-emerald-600 text-white hover:bg-emerald-500 transition-colors cursor-pointer whitespace-nowrap shadow-md ring-1 ring-emerald-400/50 disabled:opacity-75"
                >
                  {isGeneratingMedia ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Send className="w-3.5 h-3.5" />
                  )}
                  <span>
                    {isGeneratingMedia
                      ? 'Menyiapkan PDF & Gambar...'
                      : waBtnFeedback || `KIRIM KE WHATSAPP GURU (${EXAM_INFO.teacherPhone})`}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={handleOpenWaPreviewModal}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold border border-sky-400/50 bg-sky-500/20 text-sky-200 hover:bg-sky-500/30 transition-colors cursor-pointer whitespace-nowrap"
                  title="Buka pratinjau pesan WhatsApp, dokumen PDF, dan gambar hasil ujian sebelum dikirimkan"
                >
                  <Eye className="w-3.5 h-3.5 text-sky-300" />
                  <span>Pratinjau Pesan, PDF &amp; Gambar WA</span>
                </button>

                <button
                  type="button"
                  disabled={isGeneratingMedia}
                  onClick={handleNativeShareFilesToWa}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold border border-emerald-400/50 bg-emerald-500/20 text-emerald-200 hover:bg-emerald-500/30 transition-colors cursor-pointer whitespace-nowrap"
                >
                  <Share2 className="w-3.5 h-3.5" />
                  <span>Bagikan File JPG &amp; PDF ke WhatsApp</span>
                </button>

                <button
                  type="button"
                  onClick={handleCopyWaMessage}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-600 transition-colors cursor-pointer whitespace-nowrap"
                  title="Salin teks laporan ujian ke clipboard agar bisa ditempel (paste) di WhatsApp"
                >
                  <Copy className="w-3.5 h-3.5 text-amber-300" />
                  <span>{copiedWaTextFeedback || 'Salin Teks Laporan Ujian'}</span>
                </button>

                <button
                  type="button"
                  disabled={isGeneratingMedia}
                  onClick={() => {
                    handleDownloadJpgOnly();
                  }}
                  className="inline-flex items-center gap-1.5 px-2.5 py-2 rounded-lg text-xs font-medium bg-teal-800/80 text-teal-100 hover:bg-teal-700 transition-colors cursor-pointer whitespace-nowrap"
                >
                  <FileImage className="w-3.5 h-3.5" />
                  <span>Unduh Gambar (.JPG)</span>
                </button>

                <button
                  type="button"
                  disabled={isGeneratingMedia}
                  onClick={handleDownloadPdfOnly}
                  className="inline-flex items-center gap-1.5 px-2.5 py-2 rounded-lg text-xs font-medium bg-cyan-800/80 text-cyan-100 hover:bg-cyan-700 transition-colors cursor-pointer whitespace-nowrap"
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>Unduh Dokumen (.PDF)</span>
                </button>
              </div>

              {/* Panel Status & Keterangan Pengiriman */}
              <div className="p-2.5 rounded-lg bg-slate-950/80 border border-emerald-500/30 text-[11px] text-emerald-200 space-y-1">
                <div className="flex flex-wrap items-center justify-between gap-1 text-[10.5px] text-slate-400">
                  <span>Tujuan: <strong className="text-emerald-300">{EXAM_INFO.teacherPhone}</strong> ({EXAM_INFO.guruMapelUpper})</span>
                  <span>Otomatisasi &amp; Tautan Langsung Resmi UPTD SMP Negeri 7 Kisaran</span>
                </div>
                {(waFileNotice || copiedWaTextFeedback) && (
                  <div className="text-amber-300 font-semibold pt-0.5">
                    {waFileNotice || copiedWaTextFeedback}
                  </div>
                )}
              </div>
            </div>

            {/* Panel Pengiriman Hasil Ujian ke Email eksayudikasirait@gmail.com (Format Gambar .JPG & Format PDF .PDF) */}
            <div className="p-2.5 sm:p-3 rounded-xl border border-sky-500/40 bg-sky-950/40 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-1.5">
                <div className="text-[11px] font-bold text-sky-300 uppercase tracking-wider flex flex-wrap items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5" />
                  <span>
                    Kirim Hasil Ujian ke Email ({EXAM_INFO.teacherEmail}) — Format Gambar (.JPG) & Format PDF (.PDF)
                  </span>
                  <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 border border-emerald-400/50 text-emerald-300 text-[9px] font-extrabold">
                    FILE GAMBAR (.JPG) & FORMAT PDF (.PDF)
                  </span>
                </div>
                <span className="text-[10px] text-sky-200/90">
                  Mengirim lampiran file fisik Format Gambar (.JPG) + Format PDF (.PDF) ke {EXAM_INFO.teacherEmail}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div className="px-2.5 py-1.5 rounded-lg bg-slate-950/75 border border-indigo-400/35 flex items-center justify-between gap-2 text-[11px]">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <FileImage className="w-3.5 h-3.5 text-amber-300 shrink-0" />
                    <div className="truncate">
                      <div className="text-[9px] font-bold uppercase tracking-wider text-indigo-300">
                        Lampiran 1 · Format Gambar (.JPG)
                      </div>
                      <div className="font-mono text-white truncate">{jpgFilename}</div>
                    </div>
                  </div>
                  <span className="px-1.5 py-0.5 rounded bg-indigo-500/25 border border-indigo-400/40 text-indigo-200 text-[9px] font-mono font-bold shrink-0">
                    .JPG
                  </span>
                </div>

                <div className="px-2.5 py-1.5 rounded-lg bg-slate-950/75 border border-sky-400/35 flex items-center justify-between gap-2 text-[11px]">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <FileText className="w-3.5 h-3.5 text-emerald-300 shrink-0" />
                    <div className="truncate">
                      <div className="text-[9px] font-bold uppercase tracking-wider text-sky-300">
                        Lampiran 2 · Format PDF (.PDF)
                      </div>
                      <div className="font-mono text-white truncate">{pdfFilename}</div>
                    </div>
                  </div>
                  <span className="px-1.5 py-0.5 rounded bg-sky-500/25 border border-sky-400/40 text-sky-200 text-[9px] font-mono font-bold shrink-0">
                    .PDF
                  </span>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  disabled={isGeneratingMedia}
                  onClick={() => {
                    setEmailBtnFeedback(
                      `Mengirim Format Gambar (.JPG) & Format PDF ke ${EXAM_INFO.teacherEmail}...`
                    );
                    onSendEmail(submission, 'auto_gmail', 'jpg_pdf');
                    setEmailFileNotice(
                      `Hasil Ujian dalam bentuk Format Gambar (${jpgFilename}) dan Format PDF (${pdfFilename}) telah dikirim ke ${EXAM_INFO.teacherEmail}.`
                    );
                    setTimeout(() => {
                      setEmailBtnFeedback(
                        `Format Gambar (.JPG) & Format PDF Terkirim ke ${EXAM_INFO.teacherEmail}!`
                      );
                      setTimeout(() => setEmailBtnFeedback(null), 4500);
                    }, 800);
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-extrabold bg-sky-600 text-white hover:bg-sky-500 transition-colors cursor-pointer whitespace-nowrap shadow-md"
                >
                  <Mail className="w-3.5 h-3.5" />
                  {emailBtnFeedback ||
                    `Kirim ke Email ${EXAM_INFO.teacherEmail} (Format Gambar .JPG & Format PDF)`}
                </button>

                <button
                  type="button"
                  disabled={isGeneratingMedia}
                  onClick={() => {
                    onSendEmail(submission, 'auto_gmail', 'jpg');
                    setEmailFileNotice(
                      `Hasil Ujian dalam bentuk Format Gambar (${jpgFilename}) telah dikirim ke email tujuan ${EXAM_INFO.teacherEmail}.`
                    );
                  }}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-bold bg-indigo-600 text-white hover:bg-indigo-500 transition-colors cursor-pointer whitespace-nowrap"
                >
                  <FileImage className="w-3.5 h-3.5" />
                  Kirim Format Gambar (.JPG) ke Email
                </button>

                <button
                  type="button"
                  disabled={isGeneratingMedia}
                  onClick={() => {
                    onSendEmail(submission, 'auto_gmail', 'pdf');
                    setEmailFileNotice(
                      `Hasil Ujian dalam bentuk Format PDF (${pdfFilename}) telah dikirim ke email tujuan ${EXAM_INFO.teacherEmail}.`
                    );
                  }}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-bold bg-blue-700 text-white hover:bg-blue-600 transition-colors cursor-pointer whitespace-nowrap"
                >
                  <FileText className="w-3.5 h-3.5" />
                  Kirim Format PDF (.PDF) ke Email
                </button>

                <button
                  type="button"
                  disabled={isGeneratingMedia}
                  onClick={handleNativeShareFilesToEmail}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-bold border border-sky-400/50 bg-sky-500/20 text-sky-200 hover:bg-sky-500/30 transition-colors cursor-pointer whitespace-nowrap"
                >
                  <Share2 className="w-3.5 h-3.5" />
                  Bagikan File Format Gambar (.JPG) & Format PDF ke Email
                </button>
              </div>

              {emailFileNotice && (
                <div className="p-2.5 rounded-lg bg-sky-950/90 border border-sky-400/50 text-sky-200 text-[11px] leading-relaxed">
                  {emailFileNotice}
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                {/* Tombol: SIMPAN SOAL DALAM BENTUK PDF */}
                <button
                  type="button"
                  disabled={isGeneratingMedia}
                  onClick={handleDownloadPdfOnly}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-extrabold bg-amber-400 text-slate-950 hover:bg-amber-300 transition-colors cursor-pointer whitespace-nowrap shadow-md ring-1 ring-amber-300"
                >
                  <Download className="w-3.5 h-3.5" />
                  {simpanPdfFeedback || 'SIMPAN SOAL DALAM BENTUK PDF'}
                </button>

                <button
                  type="button"
                  disabled={isGeneratingMedia}
                  onClick={handleSaveCertificatePdf}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-extrabold bg-emerald-500 text-slate-950 hover:bg-emerald-400 transition-colors cursor-pointer whitespace-nowrap shadow-md"
                >
                  <Award className="w-3.5 h-3.5" />
                  {pdfCertFeedback || 'Simpan Sertifikat PDF (+ Foto Siswa)'}
                </button>

                <button
                  type="button"
                  disabled={isGeneratingMedia}
                  onClick={handleDownloadJpgOnly}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-bold bg-slate-800 text-white hover:bg-slate-700 transition-colors cursor-pointer whitespace-nowrap border border-white/20"
                >
                  <FileImage className="w-3.5 h-3.5 text-amber-300" />
                  Download Gambar (.JPG)
                </button>

                <button
                  type="button"
                  disabled={isGeneratingMedia}
                  onClick={handleDownloadPdfOnly}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-bold bg-amber-500 text-slate-950 hover:bg-amber-400 transition-colors cursor-pointer whitespace-nowrap"
                >
                  <Download className="w-3.5 h-3.5" />
                  Download Dokumen (.PDF)
                </button>

                <button
                  type="button"
                  disabled={isGeneratingMedia}
                  onClick={handlePreviewJpgCard}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-bold border border-sky-400/40 bg-sky-500/20 text-sky-200 hover:bg-sky-500/30 transition-colors cursor-pointer whitespace-nowrap"
                >
                  <Eye className="w-3.5 h-3.5" />
                  {previewJpgUrl ? 'Tutup Pratinjau Gambar (.JPG)' : 'Lihat Kartu Gambar (.JPG)'}
                </button>

                <button
                  type="button"
                  onClick={handleCetakPdfViaPrint}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-extrabold bg-cyan-400 text-slate-950 hover:bg-cyan-300 transition-colors cursor-pointer whitespace-nowrap shadow-md"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>
                    {cetakCertFeedback ||
                      `Cetak Sertifikat Nilai (${printDarkMode ? 'Tema Dark Mode' : 'Kertas Putih'})`}
                  </span>
                </button>

                {onChangePrintDarkMode && (
                  <button
                    type="button"
                    onClick={() => onChangePrintDarkMode(!printDarkMode)}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-extrabold border border-white bg-white text-slate-950 hover:bg-slate-100 transition-colors cursor-pointer whitespace-nowrap shadow-md"
                  >
                    <span>
                      {printDarkMode
                        ? 'Tema Cetak: Dark Mode (Aktif)'
                        : 'Tema Cetak: Kertas Putih (Default)'}
                    </span>
                  </button>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {onOpenRaporSiswa && (
                  <button
                    type="button"
                    onClick={() => onOpenRaporSiswa(submission)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-extrabold bg-gradient-to-r from-sky-500 to-indigo-600 text-white hover:from-sky-400 hover:to-indigo-500 transition-all cursor-pointer whitespace-nowrap shadow-md"
                  >
                    <BarChart3 className="w-3.5 h-3.5" />
                    <span>Lihat Rapor Siswa</span>
                  </button>
                )}

                {onRetakeExam && (
                  <button
                    type="button"
                    onClick={onRetakeExam}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-extrabold bg-amber-400 text-slate-950 hover:bg-amber-300 transition-colors cursor-pointer whitespace-nowrap shadow-md"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>
                      {isPassed
                        ? 'Ulangi Ujian (Wajib Kode Token Baru)'
                        : 'Mulai Ujian Ulangan (Wajib Kode Token Baru)'}
                    </span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={onReturnHome}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-extrabold border border-rose-400/50 bg-rose-600 text-white hover:bg-rose-500 transition-colors cursor-pointer whitespace-nowrap shadow-md"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Kembali ke Menu Awal (HOME)
                </button>
              </div>
            </div>

            {previewJpgUrl && (
              <div className="p-3 rounded-xl border border-sky-400/40 bg-slate-950/90 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-amber-300">
                    Pratinjau Gambar Hasil Ujian (.JPG) — Siap Dikirim ke WhatsApp Guru:
                  </span>
                  <button
                    type="button"
                    onClick={handleDownloadJpgOnly}
                    className="px-2.5 py-1 rounded-md bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold cursor-pointer"
                  >
                    Unduh Gambar (.JPG)
                  </button>
                </div>
                <img
                  src={previewJpgUrl}
                  alt="Kartu Hasil Ujian ANBK Informatika"
                  className="w-full max-h-[540px] object-contain rounded-lg border border-white/15 mx-auto"
                />
              </div>
            )}
          </div>

          {/* Blok Pengesahan Guru pada Sertifikat (Khusus Saat Dicetak / Print) */}
          <div className="hidden print-only pt-6 mt-4 border-t border-slate-300 text-xs">
            <div className="flex items-start justify-between">
              <div>
                <p className="font-bold">Dokumen Sertifikat Nilai Resmi Hasil Ujian ANBK Informatika</p>
                <p>{EXAM_INFO.namaSekolah} · Tahun Ajaran {EXAM_INFO.tahunAjaran}</p>
                <p>Dicetak pada: {new Date().toLocaleString('id-ID')}</p>
              </div>
              <div className="text-right">
                <p>Kisaran, {new Date().toLocaleDateString('id-ID')}</p>
                <p className="mb-12">Guru Mata Pelajaran Informatika,</p>
                <p className="font-bold underline">{EXAM_INFO.guruMapelUpper}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Detail Setiap Soal (Nomor 1 s/d 10): Hanya tampil di layar sebagai evaluasi, TIDAK dilampirkan saat Cetak Sertifikat Nilai */}
      <div className="rounded-xl border border-sky-500/30 p-3.5 sm:p-4 space-y-3 bg-gradient-to-br from-slate-950 via-slate-900 to-sky-950 text-white shadow-xl no-print">
        <div className="border-b pb-2.5 border-white/15">
          <h2 className="text-sm sm:text-base font-extrabold text-white">
            Detail Evaluasi Setiap Soal (1 – {examQuestions.length})
          </h2>
          <p className="text-[11px] mt-0.5 text-sky-200">
            Menampilkan pertanyaan, jawaban yang dipilih siswa, kunci jawaban yang benar, serta penjelasan lengkap untuk setiap soal (baik jawaban benar maupun jawaban yang salah).
          </p>
        </div>

        <div className="space-y-2.5">
          {examQuestions.map((q, index) => {
            const studentChoice = submission.answers[q.id];
            const isCorrect = studentChoice === q.answer;
            const choiceIndex = studentChoice ? ['A', 'B', 'C', 'D'].indexOf(studentChoice) : -1;
            const studentAnswerText =
              choiceIndex >= 0 ? `${studentChoice}. ${q.options[choiceIndex]}` : 'Tidak Dijawab';

            const correctIndex = ['A', 'B', 'C', 'D'].indexOf(q.answer);
            const correctAnswerText = `${q.answer}. ${q.options[correctIndex]}`;

            return (
              <div
                key={q.id}
                className={`p-3 sm:p-3.5 rounded-xl border transition-colors print-question-item ${
                  isCorrect
                    ? 'border-emerald-500/50 bg-emerald-950/30'
                    : 'border-rose-500/50 bg-rose-950/30'
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-1.5 mb-2">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center justify-center w-6 h-6 rounded-md bg-amber-400 text-slate-950 font-mono text-[11px] font-bold">
                      {index + 1}
                    </span>
                    <span className="text-[11px] font-semibold text-sky-200">
                      Kategori: {q.difficulty}
                    </span>
                    {q.elemen && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/10 text-slate-200">
                        {q.elemen}
                      </span>
                    )}
                  </div>

                  <span
                    className={`text-[11px] font-bold flex items-center gap-1 ${
                      isCorrect ? 'text-emerald-300' : 'text-rose-300'
                    }`}
                  >
                    {isCorrect ? (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Jawaban Siswa Benar
                      </>
                    ) : (
                      <>
                        <XCircle className="w-3.5 h-3.5" />
                        Jawaban Siswa Salah
                      </>
                    )}
                  </span>
                </div>

                {/* Pertanyaan */}
                <p className="text-xs sm:text-[13px] font-medium leading-relaxed whitespace-pre-line mb-2.5 text-white">
                  {q.content}
                </p>

                {q.image && (
                  <div className="mb-2.5">
                    <img
                      src={q.image}
                      alt={`Soal ${index + 1}`}
                      referrerPolicy="no-referrer"
                      className="max-h-40 rounded-lg border border-white/20 p-1 bg-white"
                    />
                  </div>
                )}

                {/* Grid Jawaban Siswa & Jawaban yang Benar (Ditampilkan) */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-2.5">
                  <div
                    className={`p-2.5 rounded-lg border text-[11px] ${
                      isCorrect
                        ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-100'
                        : 'bg-rose-950/60 border-rose-500/40 text-rose-100'
                    }`}
                  >
                    <span className="font-bold block mb-0.5 text-sky-200">
                      Jawaban Siswa ({isCorrect ? 'Benar' : 'Salah'}):
                    </span>
                    <span className="font-semibold text-white">{studentAnswerText}</span>
                  </div>

                  <div className="p-2.5 rounded-lg border text-[11px] bg-emerald-950/70 border-emerald-400/50 text-emerald-100">
                    <span className="font-bold block mb-0.5 text-amber-300">
                      Jawaban yang Benar:
                    </span>
                    <span className="font-bold text-emerald-300">{correctAnswerText}</span>
                  </div>
                </div>

                {/* Penjelasan Pembelajaran (Ditampilkan baik untuk jawaban Benar maupun jawaban Salah) */}
                <div
                  className={`p-2.5 rounded-lg border text-[11px] leading-relaxed ${
                    isCorrect
                      ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-100'
                      : 'bg-amber-950/50 border-amber-400/40 text-amber-100'
                  }`}
                >
                  <strong className="font-bold block mb-0.5 text-amber-300">
                    {isCorrect
                      ? 'Penjelasan Jawaban:'
                      : 'Penjelasan & Pembahasan (Evaluasi Jawaban Salah):'}
                  </strong>
                  <span className="text-slate-100">{q.explanation}</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Blok Pengesahan Guru (Khusus Saat Dicetak / Print) */}
        <div className="hidden print-only pt-8 mt-6 border-t border-slate-300 text-xs">
          <div className="flex items-start justify-between">
            <div>
              <p className="font-bold">Dokumen Ringkasan Evaluasi Hasil Ujian Siswa</p>
              <p>{EXAM_INFO.namaSekolah} · Tahun Ajaran {EXAM_INFO.tahunAjaran}</p>
              <p>Dicetak pada: {new Date().toLocaleString('id-ID')}</p>
            </div>
            <div className="text-right">
              <p>Kisaran, {new Date().toLocaleDateString('id-ID')}</p>
              <p className="mb-12">Guru Mata Pelajaran Informatika,</p>
              <p className="font-bold underline">{EXAM_INFO.guruMapelUpper}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Modal Pratinjau & Cetak Sertifikat Nilai Resmi (Lengkap dengan Foto Siswa & 11 Keterangan Hasil Ujian) */}
      {showCertificatePrintModal && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-start justify-center pt-2 sm:pt-4 px-3 pb-4 overflow-y-auto no-print"
        >
          <div className="max-w-4xl w-full self-start mt-0 sm:mt-1 rounded-2xl border-2 border-amber-400/60 bg-slate-950 text-white shadow-2xl overflow-hidden max-h-[92vh] flex flex-col">
            {/* Top Action Bar Modal Cetak Sertifikat */}
            <div className="px-4 sm:px-6 py-3.5 bg-gradient-to-r from-sky-950 via-slate-900 to-slate-950 border-b border-amber-400/30 flex flex-wrap items-center justify-between gap-3 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-cyan-400/20 border border-cyan-400/50 text-cyan-300">
                  <Printer className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-extrabold text-white">
                    Pratinjau &amp; Cetak Sertifikat Nilai Hasil Ujian
                  </h3>
                  <p className="text-[11px] text-emerald-300 font-medium">
                    ✓ File PDF Sertifikat ({certificatePdfFilename}) siap dicetak &amp; telah diunduh otomatis
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={triggerPrintCertificateViaIframeOrWindow}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-extrabold bg-cyan-400 hover:bg-cyan-300 text-slate-950 transition-colors cursor-pointer shadow-md ring-2 ring-cyan-200/60"
                >
                  <Printer className="w-4 h-4" />
                  <span>{printA4BtnStatus || 'Cetak ke Printer (A4)'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleToggleLembarPdfA4}
                  className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-extrabold transition-colors cursor-pointer shadow-md ${
                    showEmbeddedPdfViewer
                      ? 'bg-amber-400 hover:bg-amber-300 text-slate-950 ring-2 ring-amber-200'
                      : 'bg-sky-500 hover:bg-sky-400 text-slate-950'
                  }`}
                >
                  <FileText className="w-4 h-4" />
                  <span>
                    {showEmbeddedPdfViewer ? 'Lihat Kartu Sertifikat' : 'Buka Lembar PDF A4'}
                  </span>
                </button>

                <button
                  type="button"
                  disabled={isGeneratingMedia}
                  onClick={handleSaveCertificatePdf}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-extrabold bg-emerald-500 hover:bg-emerald-400 text-slate-950 transition-colors cursor-pointer shadow-md"
                >
                  <Award className="w-4 h-4" />
                  <span>{pdfCertFeedback || 'Unduh PDF Sertifikat'}</span>
                </button>

                <button
                  type="button"
                  disabled={isGeneratingMedia}
                  onClick={handleDownloadJpgOnly}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-amber-400 hover:bg-amber-300 text-slate-950 transition-colors cursor-pointer shadow-md"
                >
                  <FileImage className="w-4 h-4" />
                  <span>Unduh Gambar (.JPG)</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowCertificatePrintModal(false)}
                  className="inline-flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                  <span>Tutup</span>
                </button>
              </div>
            </div>

            {/* Isi Sertifikat A4 Resmi di Dalam Modal */}
            <div className="p-4 sm:p-6 overflow-y-auto space-y-4 bg-slate-900/90">
              {showEmbeddedPdfViewer && (
                <div className="rounded-2xl border-2 border-cyan-400/60 bg-slate-950 p-4 space-y-3 shadow-2xl">
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/15 pb-3">
                    <div>
                      <span className="text-xs sm:text-sm font-extrabold text-cyan-300 flex items-center gap-2">
                        <FileText className="w-4 h-4 text-amber-300" />
                        Lembar Dokumen PDF Sertifikat A4 Siap Cetak (Ukuran A4 Portrait 210mm × 297mm)
                      </span>
                      <span className="text-[11px] text-emerald-300 font-medium block mt-0.5">
                        ✓ Menampilkan 1 Halaman Sertifikat Nilai Resmi + Foto Siswa (Tanpa Lampiran Detail Evaluasi Soal)
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <div className="inline-flex items-center rounded-lg bg-slate-900 border border-white/15 p-0.5 text-[11px] font-mono font-bold">
                        {([75, 100, 125] as const).map((z) => (
                          <button
                            key={z}
                            type="button"
                            onClick={() => setA4ZoomPercent(z)}
                            className={`px-2 py-1 rounded-md cursor-pointer transition-colors ${
                              a4ZoomPercent === z
                                ? 'bg-cyan-400 text-slate-950 font-extrabold'
                                : 'text-slate-300 hover:text-white'
                            }`}
                          >
                            {z}%
                          </button>
                        ))}
                      </div>

                      <button
                        type="button"
                        onClick={handleSaveCertificatePdf}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-extrabold bg-emerald-500 hover:bg-emerald-400 text-slate-950 cursor-pointer shadow"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Unduh File .PDF A4</span>
                      </button>

                      <button
                        type="button"
                        onClick={handleDownloadA4SheetPng}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-extrabold bg-amber-400 hover:bg-amber-300 text-slate-950 cursor-pointer shadow"
                      >
                        <FileImage className="w-3.5 h-3.5" />
                        <span>Unduh Lembar A4 (.PNG)</span>
                      </button>
                    </div>
                  </div>

                  {/* Area Pratinjau Kertas A4 Bebas Blokir Chrome */}
                  <div className="w-full overflow-auto bg-slate-900/95 rounded-xl border border-white/15 p-3 sm:p-5 flex justify-center max-h-[68vh]">
                    {certA4SheetDataUrl ? (
                      <img
                        src={certA4SheetDataUrl}
                        alt={`Lembar Sertifikat A4 - ${submission.namaSiswa}`}
                        style={{
                          width:
                            a4ZoomPercent === 75
                              ? '540px'
                              : a4ZoomPercent === 125
                              ? '880px'
                              : '700px',
                          maxWidth: a4ZoomPercent === 125 ? 'none' : '100%',
                        }}
                        className="rounded-lg shadow-2xl border-2 border-amber-400/50 bg-white object-contain transition-all duration-200"
                      />
                    ) : (
                      <div className="py-16 text-center text-xs font-bold text-sky-300">
                        Menyiapkan Lembar Sertifikat A4 Resolusi Tinggi...
                      </div>
                    )}
                  </div>
                </div>
              )}
              {(() => {
                const fallbackDev = detectStudentDeviceSync();
                const devCat = submission.deviceCategory || fallbackDev.deviceCategory;
                const devModel = submission.deviceModel || fallbackDev.modelType;
                const devBrand = submission.deviceBrand || fallbackDev.brand;
                const devOs =
                  submission.deviceOsBrowser ||
                  `${fallbackDev.osNameVersion} · ${fallbackDev.browserName}`;
                const cleanKelas = getCleanKelas(submission.kelas);
                const cleanSemester = getSemesterFromSub(submission);
                const wrongScore = Math.max(0, submission.totalSoal - submission.skorBenar);
                const vCount = submission.violationCount || 0;

                return (
                  <div
                    className={`rounded-2xl border-4 border-double p-5 sm:p-6 space-y-5 shadow-xl ${
                      printDarkMode
                        ? 'bg-slate-950 border-amber-400 text-white'
                        : 'bg-white border-sky-900 text-slate-900'
                    }`}
                  >
                    {/* Kop Sertifikat */}
                    <div className="rounded-xl bg-gradient-to-r from-sky-950 via-sky-900 to-slate-950 text-white p-4 sm:p-5 border-b-4 border-amber-400 flex flex-col sm:flex-row items-center justify-between gap-4">
                      <div className="flex items-center gap-3.5">
                        <div className="p-1.5 rounded-xl bg-white shadow">
                          <TutWuriLogo size="sm" />
                        </div>
                        <div>
                          <div className="text-[10px] sm:text-xs font-extrabold text-amber-300 uppercase tracking-wider">
                            SERTIFIKAT NILAI &amp; HASIL UJIAN ASESMEN NASIONAL BERBASIS KOMPUTER (ANBK)
                          </div>
                          <div className="text-base sm:text-xl font-extrabold text-white">
                            {EXAM_INFO.namaSekolah}
                          </div>
                          <div className="text-[11px] text-sky-200">
                            Mata Pelajaran: INFORMATIKA · {EXAM_INFO.kurikulum} · Guru Mapel: {EXAM_INFO.guruMapelUpper}
                          </div>
                          <div className="text-[10px] font-mono text-amber-200 mt-0.5">
                            No. Sertifikat: SERTIFIKAT-ANBK/{submission.id}/{EXAM_INFO.tahunAjaran.replace('/', '-')}
                          </div>
                        </div>
                      </div>
                      <div className="px-4 py-2.5 rounded-xl bg-slate-950 border-2 border-amber-400 text-center shrink-0">
                        <span className="text-[10px] font-bold text-amber-300 block">TOTAL SKOR NILAI</span>
                        <span className="text-2xl font-mono font-extrabold text-white">
                          {submission.nilaiAkhir}%
                        </span>
                      </div>
                    </div>

                    {/* Foto Siswa + 10 Keterangan Lengkap */}
                    <div className="flex flex-col md:flex-row items-center md:items-stretch gap-5">
                      <div className="flex flex-col items-center justify-center p-2.5 rounded-2xl border-2 border-amber-500 bg-slate-950 text-white shrink-0">
                        <div className="w-28 h-36 sm:w-32 sm:h-40 rounded-xl overflow-hidden border border-amber-400 bg-sky-900 flex items-center justify-center">
                          {studentPhotoUrl ? (
                            <img
                              src={studentPhotoUrl}
                              alt={`Foto Siswa - ${submission.namaSiswa}`}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <span className="font-mono text-2xl font-extrabold text-amber-300">
                              {getStudentInitials(submission.namaSiswa)}
                            </span>
                          )}
                        </div>
                        <span className="mt-2 px-2 py-0.5 rounded bg-amber-400 text-slate-950 text-[9px] font-extrabold uppercase tracking-wider">
                          FOTO SISWA PESERTA
                        </span>
                        <span className="mt-1 text-[9px] font-mono text-emerald-300 font-bold">
                          ✓ Diambil Saat Mulai Ujian
                        </span>
                      </div>

                      <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-2.5 w-full text-xs">
                        <div className={`p-2.5 rounded-lg border ${printDarkMode ? 'bg-slate-900 border-slate-700' : 'bg-slate-50 border-slate-300'}`}>
                          <span className="text-[10px] font-bold uppercase text-sky-500 block">1. Nama Siswa</span>
                          <strong className="text-sm font-extrabold block mt-0.5">{submission.namaSiswa}</strong>
                        </div>
                        <div className={`p-2.5 rounded-lg border ${printDarkMode ? 'bg-slate-900 border-slate-700' : 'bg-slate-50 border-slate-300'}`}>
                          <span className="text-[10px] font-bold uppercase text-sky-500 block">2. Kelas</span>
                          <strong className="text-sm font-extrabold block mt-0.5">Kelas {cleanKelas}</strong>
                        </div>
                        <div className={`p-2.5 rounded-lg border ${printDarkMode ? 'bg-slate-900 border-slate-700' : 'bg-slate-50 border-slate-300'}`}>
                          <span className="text-[10px] font-bold uppercase text-sky-500 block">3. NIS / NISN</span>
                          <strong className="text-sm font-mono font-extrabold block mt-0.5">{submission.nisNisn}</strong>
                        </div>
                        <div className={`p-2.5 rounded-lg border ${printDarkMode ? 'bg-slate-900 border-slate-700' : 'bg-slate-50 border-slate-300'}`}>
                          <span className="text-[10px] font-bold uppercase text-sky-500 block">4. Semester</span>
                          <strong className="text-sm font-extrabold block mt-0.5">Semester {cleanSemester}</strong>
                        </div>
                        <div className={`p-2.5 rounded-lg border ${printDarkMode ? 'bg-slate-900 border-slate-700' : 'bg-emerald-50 border-emerald-300'}`}>
                          <span className="text-[10px] font-bold uppercase text-emerald-600 block">5. Nilai Benar</span>
                          <strong className="text-sm font-mono font-extrabold text-emerald-600 block mt-0.5">
                            {submission.skorBenar} Soal Benar (dari {submission.totalSoal} Soal)
                          </strong>
                        </div>
                        <div className={`p-2.5 rounded-lg border ${printDarkMode ? 'bg-slate-900 border-slate-700' : 'bg-rose-50 border-rose-300'}`}>
                          <span className="text-[10px] font-bold uppercase text-rose-600 block">6. Nilai Salah</span>
                          <strong className="text-sm font-mono font-extrabold text-rose-600 block mt-0.5">
                            {wrongScore} Soal Salah (Terjawab: {answeredCount}/{submission.totalSoal})
                          </strong>
                        </div>
                        <div className={`p-2.5 rounded-lg border ${printDarkMode ? 'bg-slate-900 border-slate-700' : 'bg-amber-50 border-amber-300'}`}>
                          <span className="text-[10px] font-bold uppercase text-amber-600 block">7. Total Skor Nilai</span>
                          <strong className="text-sm font-mono font-extrabold text-amber-600 block mt-0.5">
                            {submission.nilaiAkhir}% (Skor {submission.skorBenar}/{submission.totalSoal} · KKM {EXAM_INFO.kkm})
                          </strong>
                        </div>
                        <div className={`p-2.5 rounded-lg border ${printDarkMode ? 'bg-slate-900 border-slate-700' : isPassed ? 'bg-emerald-50 border-emerald-400' : 'bg-rose-50 border-rose-400'}`}>
                          <span className="text-[10px] font-bold uppercase text-sky-600 block">8. Lulus / Tidak Lulus</span>
                          <strong className={`text-sm font-extrabold block mt-0.5 ${isPassed ? 'text-emerald-600' : 'text-rose-600'}`}>
                            {isPassed ? 'LULUS UJIAN' : 'TIDAK LULUS UJIAN (UJIAN SUSULAN)'}
                          </strong>
                        </div>
                        <div className={`p-2.5 rounded-lg border sm:col-span-2 ${printDarkMode ? 'bg-slate-900 border-slate-700' : 'bg-slate-50 border-slate-300'}`}>
                          <span className="text-[10px] font-bold uppercase text-sky-600 block">
                            9. Status Integritas &amp; Kecurangan ({vCount}/3 Pelanggaran)
                          </span>
                          <strong className={`text-xs font-extrabold block mt-0.5 ${vCount > 0 || isDisqualifiedByCheat ? 'text-rose-600' : 'text-emerald-600'}`}>
                            {submission.statusKecurangan}
                          </strong>
                        </div>
                      </div>
                    </div>

                    {/* Pengesahan Guru Mapel */}
                    <div className="pt-3 border-t border-slate-300/50 flex flex-col sm:flex-row items-start sm:items-end justify-between gap-4 text-xs">
                      <div>
                        <div className="font-bold">Dokumen Sertifikat Nilai Resmi ANBK Informatika</div>
                        <div className=" opacity-80">Waktu Selesai Ujian: {submission.timestamp}</div>
                      </div>
                      <div className="text-left sm:text-right">
                        <div>Kisaran, {submission.timestamp.split(',')[0]}</div>
                        <div className="mb-6">Guru Mata Pelajaran Informatika,</div>
                        <div className="font-extrabold underline">{EXAM_INFO.guruMapelUpper}</div>
                        <div className="text-[11px] opacity-80">{EXAM_INFO.namaSekolah}</div>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {/* Modal Pratinjau Pesan, Dokumen PDF & Gambar Sebelum Dikirim ke WhatsApp Guru */}
      {showWaPreviewModal && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-start justify-center pt-2 sm:pt-4 px-3 pb-6 overflow-y-auto no-print"
        >
          <div className="max-w-4xl w-full self-start rounded-2xl border-2 border-emerald-500/70 bg-slate-950 text-white shadow-2xl overflow-hidden max-h-[92vh] flex flex-col">
            {/* Header Modal */}
            <div className="px-4 sm:px-6 py-3.5 bg-gradient-to-r from-emerald-950 via-slate-900 to-teal-950 border-b border-emerald-500/40 flex flex-wrap items-center justify-between gap-3 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-emerald-500/20 border border-emerald-400/50 text-emerald-400">
                  <Send className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm sm:text-base font-extrabold text-white">
                      Pratinjau Pesan &amp; Berkas Ujian (WhatsApp Guru)
                    </h3>
                    <span className="px-2 py-0.5 rounded-full bg-emerald-400/20 border border-emerald-400/40 text-[9.5px] font-bold text-emerald-300">
                      SIAP PERIKSA
                    </span>
                  </div>
                  <p className="text-[11px] text-emerald-300 font-medium">
                    Periksa konten format pesan, dokumen PDF, dan berkas gambar sebelum dikirimkan ke Guru Mapel ({EXAM_INFO.guruMapelUpper})
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowWaPreviewModal(false)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                  title="Tutup Modal"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Banner Info Guru & Siswa */}
            <div className="px-4 sm:px-6 py-2.5 bg-emerald-950/40 border-b border-white/10 flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-slate-200">
                <span>
                  Tujuan: <strong className="text-emerald-300">{EXAM_INFO.guruMapelUpper}</strong> (WA: <strong className="text-white font-mono">{EXAM_INFO.teacherPhone}</strong>)
                </span>
                <span>•</span>
                <span>
                  Peserta: <strong className="text-amber-300">{submission.namaSiswa}</strong> ({submission.kelas})
                </span>
                <span>•</span>
                <span>
                  Nilai: <strong className="text-emerald-400 font-bold">{submission.nilaiAkhir}%</strong> ({submission.lulusTidakLulus})
                </span>
              </div>
              <span className="text-[10px] text-slate-400 bg-slate-900/80 px-2 py-0.5 rounded border border-slate-700">
                ✓ Bebas data jenis perangkat device
              </span>
            </div>

            {/* Tab Navigasi */}
            <div className="px-4 sm:px-6 py-2 bg-slate-900/80 border-b border-white/10 flex flex-wrap items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => setActiveWaPreviewTab('all')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                  activeWaPreviewTab === 'all'
                    ? 'bg-emerald-500 text-slate-950 shadow'
                    : 'bg-white/5 hover:bg-white/10 text-slate-300'
                }`}
              >
                Semua Konten (Lengkap)
              </button>
              <button
                type="button"
                onClick={() => setActiveWaPreviewTab('message')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 ${
                  activeWaPreviewTab === 'message'
                    ? 'bg-emerald-500 text-slate-950 shadow'
                    : 'bg-white/5 hover:bg-white/10 text-slate-300'
                }`}
              >
                <Send className="w-3.5 h-3.5" />
                <span>Format Pesan Teks</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveWaPreviewTab('pdf')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 ${
                  activeWaPreviewTab === 'pdf'
                    ? 'bg-emerald-500 text-slate-950 shadow'
                    : 'bg-white/5 hover:bg-white/10 text-slate-300'
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Format Dokumen PDF</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveWaPreviewTab('jpg')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 ${
                  activeWaPreviewTab === 'jpg'
                    ? 'bg-emerald-500 text-slate-950 shadow'
                    : 'bg-white/5 hover:bg-white/10 text-slate-300'
                }`}
              >
                <FileImage className="w-3.5 h-3.5" />
                <span>Format Gambar (.JPG)</span>
              </button>
            </div>

            {/* Modal Body Scrollable */}
            <div className="p-4 sm:p-6 overflow-y-auto space-y-4 bg-slate-900/90 flex-1">
              {/* Status Menyiapkan Media */}
              {isPreparingWaPreview && (
                <div className="p-3 rounded-xl bg-emerald-950/50 border border-emerald-400/40 text-emerald-200 text-xs flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin shrink-0 text-emerald-400" />
                  <span>Sedang memproses dan merender format dokumen PDF dan berkas gambar hasil ujian...</span>
                </div>
              )}

              {/* Feedback Pengiriman dari Modal */}
              {modalSendFeedback && (
                <div className="p-3 rounded-xl bg-emerald-500/20 border border-emerald-400/60 text-emerald-200 text-xs font-bold flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>{modalSendFeedback}</span>
                </div>
              )}

              {/* SECTION 1: FORMAT TEKS PESAN WHATSAPP */}
              {(activeWaPreviewTab === 'all' || activeWaPreviewTab === 'message') && (
                <div className="p-4 rounded-xl border border-emerald-500/40 bg-slate-950/90 space-y-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-2">
                    <div className="flex items-center gap-2">
                      <span className="p-1 rounded bg-emerald-500/20 text-emerald-400">
                        <Send className="w-4 h-4" />
                      </span>
                      <h4 className="text-xs sm:text-sm font-bold text-emerald-300">
                        1. Pratinjau Teks Pesan WhatsApp (Format Laporan Resmi)
                      </h4>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleCopyWaMessage}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-600 transition-colors cursor-pointer"
                      >
                        <Copy className="w-3 h-3 text-amber-300" />
                        <span>{copiedWaTextFeedback || 'Salin Teks Pesan'}</span>
                      </button>
                    </div>
                  </div>

                  <p className="text-[11px] text-slate-300">
                    Teks di bawah ini akan otomatis dikirimkan ke pesan WhatsApp Guru Mapel ({EXAM_INFO.guruMapelUpper}):
                  </p>

                  <div className="p-3.5 rounded-lg bg-[#0b141a] border border-[#202c33] text-[11.5px] font-mono text-[#e9edef] whitespace-pre-wrap leading-relaxed max-h-64 overflow-y-auto shadow-inner selection:bg-emerald-700 selection:text-white">
                    {officialWaMessage}
                  </div>
                </div>
              )}

              {/* SECTION 2: FORMAT DOKUMEN PDF */}
              {(activeWaPreviewTab === 'all' || activeWaPreviewTab === 'pdf') && (
                <div className="p-4 rounded-xl border border-sky-500/40 bg-slate-950/90 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-2">
                    <div className="flex items-center gap-2">
                      <span className="p-1 rounded bg-sky-500/20 text-sky-400">
                        <FileText className="w-4 h-4" />
                      </span>
                      <h4 className="text-xs sm:text-sm font-bold text-sky-300">
                        2. Pratinjau Berkas Dokumen PDF (Soal, Jawaban &amp; Pembahasan Lengkap)
                      </h4>
                    </div>
                    <span className="px-2 py-0.5 rounded bg-sky-500/20 border border-sky-400/40 text-[10px] font-bold text-sky-200">
                      FORMAT RESMI .PDF
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    <div className="sm:col-span-2 p-3 rounded-lg bg-sky-950/30 border border-sky-500/20 space-y-1.5 text-xs">
                      <div className="flex items-center gap-2">
                        <FileText className="w-5 h-5 text-rose-400 shrink-0" />
                        <span className="font-mono font-bold text-white text-xs truncate" title={pdfFilename}>
                          {pdfFilename}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-300 leading-snug">
                        Memuat lembar rekapitulasi nilai, 25 butir soal ANBK Informatika, kunci jawaban resmi, pembahasan detail setiap soal, dan pengesahan tanda tangan Guru Mata Pelajaran.
                      </p>
                      <div className="flex flex-wrap items-center gap-1.5 pt-1 text-[10px] text-sky-300 font-mono">
                        <span className="px-1.5 py-0.5 rounded bg-sky-400/10 border border-sky-400/30">25 Butir Soal</span>
                        <span className="px-1.5 py-0.5 rounded bg-sky-400/10 border border-sky-400/30">Kunci &amp; Pembahasan</span>
                        <span className="px-1.5 py-0.5 rounded bg-sky-400/10 border border-sky-400/30">KKM {EXAM_INFO.kkm}</span>
                        <span className="px-1.5 py-0.5 rounded bg-sky-400/10 border border-sky-400/30">Bebas Info Device</span>
                      </div>
                    </div>

                    <div className="p-3 rounded-lg bg-slate-900 border border-white/10 flex flex-col justify-between gap-2">
                      <div>
                        <div className="text-[11px] font-bold text-slate-200">Aksi Berkas PDF:</div>
                        <div className="text-[10px] text-slate-400">Siap dikirimkan ke WA atau diunduh langsung</div>
                      </div>
                      <button
                        type="button"
                        onClick={handleDownloadPdfFromModal}
                        className="w-full py-2 px-3 rounded-lg text-xs font-bold bg-sky-500 hover:bg-sky-400 text-slate-950 flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Unduh File PDF</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* SECTION 3: FORMAT GAMBAR (.JPG) */}
              {(activeWaPreviewTab === 'all' || activeWaPreviewTab === 'jpg') && (
                <div className="p-4 rounded-xl border border-amber-500/40 bg-slate-950/90 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-2">
                    <div className="flex items-center gap-2">
                      <span className="p-1 rounded bg-amber-500/20 text-amber-400">
                        <FileImage className="w-4 h-4" />
                      </span>
                      <h4 className="text-xs sm:text-sm font-bold text-amber-300">
                        3. Pratinjau Berkas Gambar Grafis (.JPG Kartu Sertifikat Nilai)
                      </h4>
                    </div>
                    <span className="px-2 py-0.5 rounded bg-amber-500/20 border border-amber-400/40 text-[10px] font-bold text-amber-200">
                      FORMAT RESMI .JPG
                    </span>
                  </div>

                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-300">
                      <div className="flex items-center gap-2">
                        <FileImage className="w-4 h-4 text-amber-400 shrink-0" />
                        <span className="font-mono font-bold text-white text-xs truncate" title={jpgFilename}>
                          {jpgFilename}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={handleDownloadJpgFromModal}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-amber-400 hover:bg-amber-300 text-slate-950 transition-colors cursor-pointer shadow"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Unduh File JPG</span>
                      </button>
                    </div>

                    {/* Tampilan Visual Gambar Live */}
                    <div className="p-2 rounded-xl bg-slate-900 border border-white/10 flex items-center justify-center min-h-[220px] overflow-hidden">
                      {waPreviewJpgUrl ? (
                        <div className="space-y-1 w-full text-center">
                          <img
                            src={waPreviewJpgUrl}
                            alt="Pratinjau Gambar Hasil Ujian"
                            className="max-h-72 w-auto mx-auto rounded-lg shadow-md border border-white/20 object-contain hover:scale-[1.01] transition-transform"
                          />
                          <p className="text-[10px] text-slate-400 pt-1">
                            Ukuran Grafis: 1200 x 630 px · Berkas grafis kartu hasil ujian resmi untuk lampiran WhatsApp Guru Mapel
                          </p>
                        </div>
                      ) : (
                        <div className="text-center p-6 space-y-2">
                          <Loader2 className="w-6 h-6 animate-spin mx-auto text-amber-400" />
                          <p className="text-xs text-slate-300">Sedang memuat visual gambar...</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Footer Modal Action Bar */}
            <div className="px-4 sm:px-6 py-3 bg-slate-950/95 border-t border-emerald-500/30 flex flex-wrap items-center justify-between gap-3 shrink-0">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleDownloadPdfFromModal}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-sky-900/60 hover:bg-sky-800 text-sky-200 border border-sky-600/50 transition-colors cursor-pointer"
                  title="Unduh berkas PDF ke perangkat"
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>Unduh PDF</span>
                </button>

                <button
                  type="button"
                  onClick={handleDownloadJpgFromModal}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-amber-900/60 hover:bg-amber-800 text-amber-200 border border-amber-600/50 transition-colors cursor-pointer"
                  title="Unduh berkas Gambar (.JPG) ke perangkat"
                >
                  <FileImage className="w-3.5 h-3.5" />
                  <span>Unduh Gambar</span>
                </button>

                <button
                  type="button"
                  onClick={handleCopyWaMessage}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-600 transition-colors cursor-pointer"
                  title="Salin teks pesan laporan ke clipboard"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>Salin Teks</span>
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowWaPreviewModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-600 transition-colors cursor-pointer"
                >
                  Batal / Tutup
                </button>

                <button
                  type="button"
                  disabled={isSendingFromModal}
                  onClick={handleExecuteSendFromModal}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs sm:text-sm font-extrabold bg-gradient-to-r from-emerald-500 via-emerald-400 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-slate-950 transition-all cursor-pointer shadow-lg hover:shadow-emerald-400/25 active:scale-[0.99] disabled:opacity-75"
                >
                  {isSendingFromModal ? (
                    <Loader2 className="w-4 h-4 animate-spin text-slate-950" />
                  ) : (
                    <Send className="w-4 h-4 text-slate-950" />
                  )}
                  <span>
                    {isSendingFromModal
                      ? 'Mengirim ke WhatsApp Guru...'
                      : `KIRIM SEKARANG KE WHATSAPP GURU (${EXAM_INFO.teacherPhone})`}
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Footer Nomor Halaman Otomatis Saat Cetak (@media print) */}
      <footer className="hidden print-formal-footer">
        <span>
          Ringkasan Hasil Ujian ANBK Informatika — {submission.namaSiswa} ({submission.kelas}) · {submission.timestamp}
        </span>
        <span className="print-page-number font-mono font-extrabold" />
      </footer>
    </div>
  );
};
