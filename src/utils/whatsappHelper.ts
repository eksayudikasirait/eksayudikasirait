import { StudentSubmission, Question, EXAM_INFO, getJenjangFromKelas } from '../data/examData';

export const DEFAULT_FONNTE_API_URL = 'https://api.fonnte.com/send';

/**
 * Format nomor telepon Indonesia menjadi format internasional WhatsApp (628...)
 */
export function formatPhoneForWhatsApp(phone?: string): string {
  if (!phone) return '6282165885568';
  const cleaned = phone.replace(/[^0-9]/g, '');
  if (cleaned.startsWith('62')) return cleaned;
  if (cleaned.startsWith('0')) return '62' + cleaned.slice(1);
  return cleaned ? '62' + cleaned : '6282165885568';
}

/**
 * Membangun format teks laporan resmi hasil ujian ANBK Informatika untuk WhatsApp Guru.
 * Didesain rapi, lengkap sesuai struktur resmi, dan aman dari batasan panjang URL.
 */
export function buildOfficialWhatsAppReport(
  sub: StudentSubmission,
  examQuestions?: Question[],
  options?: {
    mediaFormat?: 'jpg_pdf' | 'jpg' | 'pdf';
    jpgFilename?: string;
    pdfFilename?: string;
  }
): string {
  const jenjang = getJenjangFromKelas(sub?.kelas) || 'VII';
  const semester =
    sub?.semester ||
    (String(sub?.kelas || '').toLowerCase().includes('genap') ? 'Genap' : 'Ganjil');
  const answeredCount = Object.keys(sub?.answers || {}).length;
  const totalSoal =
    sub?.totalSoal && sub.totalSoal > 0
      ? sub.totalSoal
      : examQuestions && examQuestions.length > 0
      ? examQuestions.length
      : 25;
  const skorBenar =
    typeof sub?.skorBenar === 'number'
      ? sub.skorBenar
      : examQuestions && examQuestions.length > 0
      ? examQuestions.filter((q) => sub?.answers?.[q.id] === q.answer).length
      : 0;
  const unansweredCount = Math.max(0, totalSoal - answeredCount);
  const wrongCount = Math.max(0, totalSoal - skorBenar);
  const nilaiAkhir =
    typeof sub?.nilaiAkhir === 'number'
      ? sub.nilaiAkhir
      : Math.round((skorBenar / Math.max(1, totalSoal)) * 100);
  const statusKelulusan =
    sub?.lulusTidakLulus ||
    (nilaiAkhir >= EXAM_INFO.kkm ? 'Lulus Ujian' : 'Tidak Lulus');

  // Analisis HOTS & Reguler jika butir soal tersedia
  let hotsStats = '';
  let regStats = '';
  if (examQuestions && examQuestions.length > 0) {
    const hotsQs = examQuestions.filter((q) => q.difficulty === 'HOTS');
    const regQs = examQuestions.filter((q) => q.difficulty === 'REGULER');
    const hotsCorrect = hotsQs.filter((q) => sub?.answers?.[q.id] === q.answer).length;
    const regCorrect = regQs.filter((q) => sub?.answers?.[q.id] === q.answer).length;
    hotsStats = `• *Capaian Soal HOTS* : ${hotsCorrect}/${hotsQs.length} Soal Benar`;
    regStats = `• *Capaian Soal Reguler* : ${regCorrect}/${regQs.length} Soal Benar`;
  }

  // Ringkasan Pelanggaran / Integritas
  const vCount = sub?.violationCount || 0;
  let logIntegritas = '';
  if (vCount > 0 && sub?.violationLogs && sub.violationLogs.length > 0) {
    const listLogs = sub.violationLogs
      .slice(0, 3)
      .map((log, i) => `   ${i + 1}. ${log}`)
      .join('\n');
    logIntegritas = `• *Total Pelanggaran* : ${vCount}x dari Maksimal 3x Pelanggaran\n• *Detail Pelanggaran* :\n${listLogs}`;
  } else {
    logIntegritas = `• *Status Integritas* : ✓ Tertib & Jujur (0 Pelanggaran)\n• *Total Pelanggaran* : 0x Pelanggaran`;
  }

  // Rekapitulasi Jawaban Siswa per Butir Soal (Format Padat & Cepat)
  let rekapJawaban = '';
  if (examQuestions && examQuestions.length > 0) {
    const rows: string[] = [];
    examQuestions.forEach((q, idx) => {
      const studentAns = sub?.answers?.[q.id];
      const isCorrect = studentAns === q.answer;
      if (!studentAns) {
        rows.push(`${idx + 1}: - (Kosong)`);
      } else if (isCorrect) {
        rows.push(`${idx + 1}: ${studentAns} (✓)`);
      } else {
        rows.push(`${idx + 1}: ${studentAns} (✗ Kunci: ${q.answer})`);
      }
    });

    const chunked: string[] = [];
    for (let i = 0; i < rows.length; i += 5) {
      chunked.push(rows.slice(i, i + 5).join(' | '));
    }
    rekapJawaban = chunked.join('\n');
  }

  // Lampiran Berkas
  const safeName = String(sub?.namaSiswa || 'Siswa').replace(/[^a-zA-Z0-9]/g, '_');
  const safeKelas = String(sub?.kelas || 'VII').replace(/[^a-zA-Z0-9]/g, '_');
  const jpgFilename = options?.jpgFilename || `Hasil_Ujian_ANBK_${safeName}_${safeKelas}.jpg`;
  const pdfFilename = options?.pdfFilename || `Hasil_Ujian_ANBK_${safeName}_${safeKelas}.pdf`;
  const format = options?.mediaFormat || 'jpg_pdf';

  const lampiranLines: string[] = [
    `📎 *LAMPIRAN BERKAS HASIL UJIAN* :`,
    format !== 'pdf' ? `• Gambar Hasil Ujian (.JPG) : *${jpgFilename}*` : null,
    format !== 'jpg' ? `• Dokumen Hasil Ujian (.PDF) : *${pdfFilename}*` : null,
  ].filter(Boolean) as string[];

  const reportLines = [
    `*LAPORAN RESMI SOAL & HASIL UJIAN ANBK INFORMATIKA KELAS ${jenjang}*`,
    `*${EXAM_INFO.namaSekolah}*`,
    `Jl. Labu No. 10 Siumbut Baru Kisaran Timur.`,
    `====================================`,
    `📌 *1. IDENTITAS PESERTA UJIAN*`,
    `• *Nama Siswa* : *${sub?.namaSiswa || 'Peserta Ujian'}*`,
    `• *NIS / NISN* : ${sub?.nisNisn || '-'}`,
    `• *Kelas & Semester* : ${sub?.kelas || 'VII'} · Semester ${semester}`,
    `• *Waktu Selesai* : ${sub?.timestamp || new Date().toLocaleString('id-ID')}`,
    `====================================`,
    `📊 *2. RINCIAN NILAI & CAPAIAN KOMPETENSI*`,
    `• *Skor Jawaban Benar* : *${skorBenar} Benar* / ${wrongCount} Salah (${unansweredCount} Kosong) dari ${totalSoal} Soal`,
    hotsStats || null,
    regStats || null,
    `• *Nilai Akhir Ujian* : *${nilaiAkhir}%* (Standar KKM: ${EXAM_INFO.kkm}%)`,
    `• *Status Kelulusan* : *${statusKelulusan}*`,
    `====================================`,
    `🛡️ *3. DATA KECURANGAN & LOG INTEGRITAS UJIAN*`,
    `• *Status Integritas* : *${sub?.statusKecurangan || 'Ujian Selesai Tertib'}*`,
    logIntegritas,
    rekapJawaban
      ? `====================================\n📝 *4. REKAPITULASI JAWABAN SISWA (1 - ${totalSoal})* :\n${rekapJawaban}`
      : null,
    `====================================`,
    ...lampiranLines,
    `====================================`,
    `Identitas Guru Mapel: *${EXAM_INFO.guruMapelUpper}*`,
    `Nomor WA Resmi: *${EXAM_INFO.teacherPhone}*`,
    `Email Resmi: ${EXAM_INFO.teacherEmail}`,
  ];

  return reportLines.filter(Boolean).join('\n');
}

/**
 * Membangun URL WhatsApp langsung ke Guru Mapel (Pak Eksa Yudika Sirait S.T).
 * Dijamin selalu menghasilkan tautan valid, aman dari batasan panjang URL browser/WhatsApp, dan TIDAK PERNAH kosong.
 */
export function getTeacherWhatsAppUrl(message?: string, customPhone?: string): string {
  const phoneIntl = formatPhoneForWhatsApp(customPhone || EXAM_INFO.teacherPhoneIntl || EXAM_INFO.teacherPhone || '6282165885568');
  let safeMsg = message && message.trim().length > 0 ? message.trim() : '';

  if (!safeMsg) {
    safeMsg = [
      `*LAPORAN RESMI HASIL UJIAN ANBK INFORMATIKA*`,
      `*${EXAM_INFO.namaSekolah}*`,
      `Jl. Labu No. 10 Siumbut Baru Kisaran Timur.`,
      `====================================`,
      `Identitas Guru Mapel: *${EXAM_INFO.guruMapelUpper}*`,
      `Nomor WA Resmi: *${EXAM_INFO.teacherPhone}*`,
      `Email Resmi: ${EXAM_INFO.teacherEmail}`,
      `Laporan hasil ujian siswa telah selesai dikerjakan dan siap diverifikasi.`,
    ].join('\n');
  } else {
    // Pastikan jika ada variasi alamat lama, otomatis dinormalisasi ke alamat baru resmi UPTD SMP Negeri 7 Kisaran
    safeMsg = safeMsg
      .replace(/Jl\.\s*Pondok\s*Bungur[^\n]*/gi, 'Jl. Labu No. 10 Siumbut Baru Kisaran Timur.')
      .replace(/Jl\.\s*Labu\s*r\s*No\.\s*10[^\n]*/gi, 'Jl. Labu No. 10 Siumbut Baru Kisaran Timur.')
      .replace(/Jl\.\s*Labu\s*r\b/gi, 'Jl. Labu');
  }

  // Jika pesan terlalu panjang (> 1600 karakter URL encoded), rapikan agar tidak terpotong browser / WhatsApp limit
  let encoded = encodeURIComponent(safeMsg);
  if (encoded.length > 1850) {
    // Buat versi ringkas namun tetap lengkap & resmi sesuai 4 komponen utama
    const lines = safeMsg.split('\n');
    const filteredLines = lines.filter((l) => !l.includes(' | ') && !l.includes('Kunci:'));
    const compactMsg = filteredLines.join('\n');
    encoded = encodeURIComponent(compactMsg);
  }

  return `https://api.whatsapp.com/send?phone=${phoneIntl}&text=${encoded}`;
}

/**
 * Event nama saat WhatsApp berhasil dipicu
 */
export const WHATSAPP_SENT_EVENT = 'anbk_whatsapp_sent_event';

/**
 * Membuka WhatsApp secara aman dan andal pada semua perangkat (Android, iPhone/iPad, Laptop).
 * Mendukung pembukaan aplikasi langsung via scheme whatsapp:// atau tautan resmi web/app.
 */
export function openWhatsAppSafely(url: string, forceTopNavigation: boolean = false): boolean {
  if (typeof window === 'undefined') return false;

  // Coba salin teks dari URL parameter 'text' ke clipboard jika tersedia agar pengguna aman
  let textParam = '';
  try {
    const parsedUrl = new URL(url);
    textParam = parsedUrl.searchParams.get('text') || '';
    if (textParam && navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(textParam).catch(() => {});
    }
  } catch {}

  let opened = false;

  // 1. Coba window.open langsung saat klik (gesture) pengguna
  try {
    const win = window.open(url, '_blank', 'noopener,noreferrer');
    if (win && !win.closed) {
      opened = true;
    }
  } catch {}

  // 2. Fallback via elemen link <a> sintetis
  if (!opened) {
    try {
      const link = document.createElement('a');
      link.href = url;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();
      setTimeout(() => {
        try {
          document.body.removeChild(link);
        } catch {}
      }, 500);
      opened = true;
    } catch (err) {
      try {
        window.open(url, '_blank');
        opened = true;
      } catch {}
    }
  }

  // Dispatch event agar UI komponen dapat menampilkan banner / toast / direct link jika popup browser dibatasi
  try {
    window.dispatchEvent(
      new CustomEvent(WHATSAPP_SENT_EVENT, {
        detail: { url, text: textParam, opened, timestamp: Date.now() },
      })
    );
  } catch {}

  return opened;
}

/**
 * Menyalin teks ke clipboard dengan fallback
 */
export async function copyToClipboardSafely(text: string): Promise<boolean> {
  if (typeof window === 'undefined') return false;

  if (navigator?.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {}
  }

  try {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-9999px';
    textArea.style.top = '0';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    const successful = document.execCommand('copy');
    document.body.removeChild(textArea);
    return successful;
  } catch {
    return false;
  }
}

/**
 * Mengirim atau membagikan berkas hasil ujian (JPG / PDF) ke WhatsApp atau aplikasi lain via Web Share API
 */
export async function shareResultFilesOrOpenWhatsApp(params: {
  message: string;
  jpgBlob?: Blob | null;
  jpgFilename?: string;
  pdfBlob?: Blob | null;
  pdfFilename?: string;
  targetPhone?: string;
}): Promise<{ sharedVia: 'web_share' | 'wa_link'; success: boolean }> {
  const targetPhone = params.targetPhone || EXAM_INFO.teacherPhone;
  const waUrl = getTeacherWhatsAppUrl(params.message, targetPhone);

  const filesToShare: File[] = [];

  if (params.jpgBlob) {
    try {
      filesToShare.push(
        new File([params.jpgBlob], params.jpgFilename || 'Hasil_Ujian_ANBK.jpg', {
          type: 'image/jpeg',
        })
      );
    } catch {}
  }

  if (params.pdfBlob) {
    try {
      filesToShare.push(
        new File([params.pdfBlob], params.pdfFilename || 'Hasil_Ujian_ANBK.pdf', {
          type: 'application/pdf',
        })
      );
    } catch {}
  }

  // Cek apakah perangkat mendukung Web Share API dengan lampiran file (misal HP Android / iPhone)
  if (
    typeof navigator !== 'undefined' &&
    navigator.share &&
    filesToShare.length > 0 &&
    typeof navigator.canShare === 'function'
  ) {
    try {
      if (navigator.canShare({ files: filesToShare })) {
        await navigator.share({
          title: `Hasil Ujian ANBK Informatika - Guru Mapel (${EXAM_INFO.guruMapelUpper})`,
          text: params.message,
          files: filesToShare,
        });
        return { sharedVia: 'web_share', success: true };
      }
    } catch (shareErr) {
      // Jika pengguna membatalkan share sheet atau ada penolakan, lanjut ke tautan WhatsApp langsung
      if ((shareErr as Error)?.name === 'AbortError') {
        return { sharedVia: 'web_share', success: false };
      }
    }
  }

  // Fallback jika Web Share tidak tersedia / tidak didukung:
  // Unduh otomatis file JPG dan PDF ke perangkat agar siswa langsung memiliki berkas fisiknya
  if (typeof window !== 'undefined') {
    const jpgBlob = params.jpgBlob;
    if (jpgBlob) {
      try {
        const u = URL.createObjectURL(jpgBlob);
        const a = document.createElement('a');
        a.href = u;
        a.download = params.jpgFilename || 'Hasil_Ujian_ANBK.jpg';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(u), 4000);
      } catch {}
    }

    const pdfBlob = params.pdfBlob;
    if (pdfBlob) {
      setTimeout(() => {
        try {
          const u = URL.createObjectURL(pdfBlob);
          const a = document.createElement('a');
          a.href = u;
          a.download = params.pdfFilename || 'Hasil_Ujian_ANBK.pdf';
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          setTimeout(() => URL.revokeObjectURL(u), 4000);
        } catch {}
      }, 300);
    }
  }

  // Buka tautan WhatsApp langsung
  const opened = openWhatsAppSafely(waUrl);
  return { sharedVia: 'wa_link', success: opened };
}
