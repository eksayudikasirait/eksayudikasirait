import { jsPDF } from 'jspdf';
import {
  Question,
  StudentSubmission,
  EXAM_INFO,
  ExamPackageKey,
  FASE_D_PACKAGE_META,
  FASE_D_QUESTION_BANKS,
  getJenjangFromKelas,
  getCleanKelas,
  getSemesterFromSub,
} from '../data/examData';
import {
  getPhotoForStudentIdentity,
  loadStoredStudentProfile,
  getStudentInitials,
} from '../components/StudentCameraProfileModal';

export function resolveStudentPhotoForCertificate(submission: StudentSubmission): string {
  if (
    submission.photoUrl &&
    (submission.photoUrl.startsWith('data:image/') || submission.photoUrl.startsWith('http'))
  ) {
    return submission.photoUrl;
  }
  const byIdentity = getPhotoForStudentIdentity(submission.namaSiswa, submission.nisNisn);
  if (byIdentity) return byIdentity;
  if (!String(submission.id || '').startsWith('HIST-')) {
    const stored = loadStoredStudentProfile();
    if (stored.photoDataUrl) return stored.photoDataUrl;
  }
  return '';
}

function loadImageElementSafe(src: string): Promise<HTMLImageElement | null> {
  if (!src || typeof window === 'undefined') return Promise.resolve(null);
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

function drawPdfStudentPhotoFrame(
  doc: jsPDF,
  photoDataUrl: string,
  namaSiswa: string,
  x: number,
  y: number,
  w: number,
  h: number
) {
  // Bingkai Luar Navy & Bingkai Dalam Emas untuk Pas Foto Siswa
  doc.setFillColor(15, 23, 42);
  doc.setDrawColor(245, 158, 11);
  doc.setLineWidth(0.5);
  doc.roundedRect(x, y, w, h, 2, 2, 'FD');

  const innerPad = 1.2;
  const imgW = w - innerPad * 2;
  const captionH = 4.6;
  const imgH = h - innerPad * 2 - captionH;

  let photoDrawn = false;
  if (photoDataUrl && photoDataUrl.startsWith('data:image/')) {
    try {
      const fmt = photoDataUrl.startsWith('data:image/png')
        ? 'PNG'
        : photoDataUrl.startsWith('data:image/webp')
        ? 'WEBP'
        : 'JPEG';
      doc.addImage(photoDataUrl, fmt, x + innerPad, y + innerPad, imgW, imgH);
      photoDrawn = true;
    } catch {
      photoDrawn = false;
    }
  }

  if (!photoDrawn) {
    doc.setFillColor(12, 74, 110);
    doc.rect(x + innerPad, y + innerPad, imgW, imgH, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text(getStudentInitials(namaSiswa), x + w / 2, y + innerPad + imgH / 2 + 1, {
      align: 'center',
    });
    doc.setFontSize(5.5);
    doc.setTextColor(186, 230, 253);
    doc.text('PAS FOTO SISWA', x + w / 2, y + innerPad + imgH / 2 + 5, {
      align: 'center',
    });
  }

  // Pita Label Bawah Foto Siswa
  doc.setFillColor(245, 158, 11);
  doc.rect(x + 0.5, y + h - captionH, w - 1, captionH - 0.5, 'F');
  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(5.5);
  doc.text('FOTO PESERTA UJIAN', x + w / 2, y + h - 1.6, { align: 'center' });
}

export function getLearningAdviceForSubmission(
  submission: StudentSubmission,
  isDisqualifiedByCheat: boolean = false
): string {
  const isDisqualified =
    isDisqualifiedByCheat ||
    submission.statusKecurangan.toLowerCase().includes('diskualifikasi') ||
    submission.statusKecurangan.toLowerCase().includes('gagal');

  if (isDisqualified) {
    return 'Ujian dihentikan oleh Sistem Anti-Kecurangan karena terdeteksi pelanggaran integritas ujian (pindah tab/minimize melebihi batas, waktu peringatan habis, atau layar terbelah/split-screen). Siswa dinyatakan TIDAK LULUS UJIAN dan wajib mengikuti UJIAN SUSULAN dengan pengawasan langsung Guru Mapel Bapak Eksa Yudika Sirait S.T.';
  }
  if (submission.nilaiAkhir >= 90) {
    return 'Sangat Memuaskan! Siswa telah menguasai materi Informatika Kurikulum Merdeka Fase D sesuai tingkat kelas dan semester yang dipilih dengan sangat baik. Pertahankan prestasi dan terus kembangkan keterampilan berpikir komputasional serta literasi digital.';
  }
  if (submission.nilaiAkhir >= EXAM_INFO.kkm) {
    return `Selamat, LULUS UJIAN! Nilai KKM berada pada rentang 75 sampai 100 sehingga dianggap Anda Lulus Ujian (memenuhi KKM ${EXAM_INFO.kkm}). Pelajari kembali pembahasan pada soal-soal yang masih belum tepat agar penguasaan materi HOTS semakin sempurna.`;
  }
  return `Nilai KKM berada pada rentang 0 sampai 74 (di bawah KKM ${EXAM_INFO.kkm}) sehingga dianggap Anda Tidak Lulus Ujian dan dijadwalkan mengikuti UJIAN SUSULAN. Silakan pelajari dengan saksama Kunci Jawaban yang Benar beserta Penjelasan Pembelajaran pada setiap nomor soal di bawah ini sebagai bahan evaluasi.`;
}

function wrapCanvasText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
): string[] {
  const paragraphs = String(text || '').split('\n');
  const lines: string[] = [];

  for (const para of paragraphs) {
    const words = para.split(' ');
    let currentLine = '';

    for (let i = 0; i < words.length; i++) {
      const word = words[i];
      const testLine = currentLine ? `${currentLine} ${word}` : word;
      const metrics = ctx.measureText(testLine);
      if (metrics.width > maxWidth && currentLine) {
        lines.push(currentLine);
        currentLine = word;
      } else {
        currentLine = testLine;
      }
    }
    if (currentLine) {
      lines.push(currentLine);
    } else if (para === '') {
      lines.push('');
    }
  }
  return lines.length > 0 ? lines : [''];
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

/**
 * Menghasilkan Gambar JPG (dan PNG untuk Clipboard) berisi Laporan Lengkap Hasil Ujian Siswa
 * termasuk Identitas, Nilai (%), Status Lulus/Tidak Lulus, Saran Pembelajaran, dan Detail Soal Ujian (25 Soal).
 */
export async function generateResultImageBlobs(
  submission: StudentSubmission,
  examQuestions: Question[],
  isDisqualifiedByCheat: boolean = false
): Promise<{ jpgBlob: Blob; pngBlob: Blob; dataUrlJpg: string }> {
  const jenjang = getJenjangFromKelas(submission.kelas);
  const isPassed =
    !isDisqualifiedByCheat &&
    submission.nilaiAkhir >= EXAM_INFO.kkm &&
    !submission.lulusTidakLulus.toLowerCase().includes('tidak');
  const answeredCount = Object.keys(submission.answers || {}).length;
  const adviceText = getLearningAdviceForSubmission(submission, isDisqualifiedByCheat);

  const width = 1080;
  const padding = 44;
  const contentWidth = width - padding * 2;

  // Gunakan canvas sementara untuk menghitung tinggi total secara akurat
  const measureCanvas = document.createElement('canvas');
  const mCtx = measureCanvas.getContext('2d')!;

  mCtx.font = '400 18px sans-serif';
  const adviceLines = wrapCanvasText(mCtx, adviceText, contentWidth - 48);

  interface PreparedQuestionBlock {
    index: number;
    q: Question;
    isCorrect: boolean;
    qLines: string[];
    studentLines: string[];
    correctLines: string[];
    expLines: string[];
    blockHeight: number;
  }

  const questionBlocks: PreparedQuestionBlock[] = examQuestions.map((q, idx) => {
    const studentChoice = submission.answers?.[q.id];
    const isCorrect = studentChoice === q.answer;
    const choiceIndex = studentChoice ? ['A', 'B', 'C', 'D'].indexOf(studentChoice) : -1;
    const studentAnswerText =
      choiceIndex >= 0 ? `${studentChoice}. ${q.options[choiceIndex]}` : 'Tidak Dijawab';
    const correctIndex = ['A', 'B', 'C', 'D'].indexOf(q.answer);
    const correctAnswerText = `${q.answer}. ${q.options[correctIndex]}`;

    mCtx.font = 'bold 19px sans-serif';
    const qLines = wrapCanvasText(mCtx, q.content, contentWidth - 52);

    mCtx.font = 'bold 17px sans-serif';
    const studentLines = wrapCanvasText(
      mCtx,
      `Jawaban Siswa: ${studentAnswerText} (${isCorrect ? 'BENAR' : 'SALAH'})`,
      contentWidth - 64
    );
    const correctLines = wrapCanvasText(
      mCtx,
      `Kunci Jawaban Benar: ${correctAnswerText}`,
      contentWidth - 64
    );

    mCtx.font = '400 16px sans-serif';
    const expPrefix = isCorrect
      ? 'Penjelasan Jawaban: '
      : `Penjelasan Jawaban yang Benar (Evaluasi Jawaban Salah - ${
          isPassed ? 'Lulus' : 'Tidak Lulus'
        }): `;
    const expLines = wrapCanvasText(mCtx, expPrefix + q.explanation, contentWidth - 64);

    const blockHeight =
      56 +
      qLines.length * 26 +
      20 +
      (studentLines.length * 24 + 20) +
      10 +
      (correctLines.length * 24 + 20) +
      10 +
      (expLines.length * 23 + 24) +
      24;

    return {
      index: idx + 1,
      q,
      isCorrect,
      qLines,
      studentLines,
      correctLines,
      expLines,
      blockHeight,
    };
  });

  const questionsTotalHeight = questionBlocks.reduce((acc, b) => acc + b.blockHeight + 18, 0);
  const adviceBoxHeight = 64 + adviceLines.length * 25 + 20;
  const totalHeight =
    padding +
    150 + // Header
    24 +
    118 + // Status Lulus / Tidak Lulus
    20 +
    190 + // Grid Identitas Siswa
    20 +
    adviceBoxHeight + // Saran Pembelajaran
    28 +
    62 + // Judul Detail Soal
    questionsTotalHeight +
    70 + // Footer
    padding;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = totalHeight;
  const ctx = canvas.getContext('2d')!;

  // Background utama
  ctx.fillStyle = '#020617';
  ctx.fillRect(0, 0, width, totalHeight);

  let curY = padding;

  // 1. Header Banner
  drawRoundedRect(ctx, padding, curY, contentWidth, 150, 20);
  const headerGrad = ctx.createLinearGradient(padding, curY, padding + contentWidth, curY + 150);
  headerGrad.addColorStop(0, '#0c4a6e');
  headerGrad.addColorStop(0.6, '#075985');
  headerGrad.addColorStop(1, '#0f172a');
  ctx.fillStyle = headerGrad;
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = '#38bdf8';
  ctx.stroke();

  ctx.fillStyle = '#fcd34d';
  ctx.font = 'bold 16px sans-serif';
  ctx.fillText(
    `LAPORAN HASIL UJIAN ANBK INFORMATIKA KELAS ${jenjang} · TAHUN AJARAN ${EXAM_INFO.tahunAjaran}`,
    padding + 28,
    curY + 40
  );

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 30px sans-serif';
  ctx.fillText(EXAM_INFO.namaSekolah, padding + 28, curY + 82);

  ctx.fillStyle = '#bae6fd';
  ctx.font = '600 17px sans-serif';
  ctx.fillText(
    `Kurikulum Merdeka Fase D · Guru Mapel: ${EXAM_INFO.guruMapelUpper}`,
    padding + 28,
    curY + 118
  );

  // Kotak Nilai Akhir di kanan header
  const scoreBoxW = 210;
  const scoreBoxX = padding + contentWidth - scoreBoxW - 24;
  drawRoundedRect(ctx, scoreBoxX, curY + 22, scoreBoxW, 106, 16);
  ctx.fillStyle = '#020617';
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = '#fbbf24';
  ctx.stroke();

  ctx.fillStyle = '#fcd34d';
  ctx.font = 'bold 14px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('NILAI AKHIR (%)', scoreBoxX + scoreBoxW / 2, curY + 52);

  ctx.fillStyle = isPassed ? '#34d399' : '#fb7185';
  ctx.font = 'bold 42px monospace';
  ctx.fillText(`${submission.nilaiAkhir}%`, scoreBoxX + scoreBoxW / 2, curY + 104);
  ctx.textAlign = 'left';

  curY += 150 + 24;

  // 2. Status Kelulusan Banner
  drawRoundedRect(ctx, padding, curY, contentWidth, 118, 16);
  ctx.fillStyle = isPassed ? '#064e3b' : '#4c0519';
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = isPassed ? '#10b981' : '#f43f5e';
  ctx.stroke();

  ctx.fillStyle = '#fcd34d';
  ctx.font = 'bold 15px sans-serif';
  ctx.fillText(`STATUS KELULUSAN (STANDAR KKM: ${EXAM_INFO.kkm})`, padding + 24, curY + 34);

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 26px sans-serif';
  ctx.fillText(
    isPassed ? 'LULUS UJIAN' : 'TIDAK LULUS UJIAN — "UJIAN SUSULAN"',
    padding + 24,
    curY + 70
  );

  ctx.fillStyle = '#e2e8f0';
  ctx.font = '600 16px sans-serif';
  ctx.fillText(
    `Status Integritas: ${submission.statusKecurangan}   |   Waktu: ${submission.timestamp}`,
    padding + 24,
    curY + 100
  );

  curY += 118 + 20;

  // 3. Foto Peserta Ujian (Kiri) + Grid Identitas Siswa (2 Baris x 3 Kolom di Kanan)
  const resolvedPhotoUrl = resolveStudentPhotoForCertificate(submission);
  const studentImg = await loadImageElementSafe(resolvedPhotoUrl);

  const photoCardW = 148;
  const photoCardH = 184;
  const photoGap = 16;

  // Bingkai Foto Siswa Saat Mulai Ujian
  drawRoundedRect(ctx, padding, curY, photoCardW, photoCardH, 14);
  ctx.fillStyle = '#0f172a';
  ctx.fill();
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = '#fbbf24';
  ctx.stroke();

  if (studentImg) {
    ctx.save();
    drawRoundedRect(ctx, padding + 6, curY + 6, photoCardW - 12, photoCardH - 36, 10);
    ctx.clip();
    ctx.drawImage(studentImg, padding + 6, curY + 6, photoCardW - 12, photoCardH - 36);
    ctx.restore();
  } else {
    drawRoundedRect(ctx, padding + 6, curY + 6, photoCardW - 12, photoCardH - 36, 10);
    ctx.fillStyle = '#075985';
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 38px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(
      getStudentInitials(submission.namaSiswa),
      padding + photoCardW / 2,
      curY + (photoCardH - 30) / 2 + 10
    );
    ctx.textAlign = 'left';
  }

  // Pita Keterangan Foto Siswa
  ctx.fillStyle = '#fbbf24';
  ctx.font = 'bold 11px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('FOTO PESERTA UJIAN', padding + photoCardW / 2, curY + photoCardH - 11);
  ctx.textAlign = 'left';

  const cleanKelasImg = getCleanKelas(submission.kelas);
  const cleanSemesterImg = getSemesterFromSub(submission);
  const wrongScoreImg = Math.max(0, submission.totalSoal - submission.skorBenar);
  const devLabelImg = `${submission.deviceCategory || 'Perangkat Siswa'} - ${submission.deviceModel || 'Auto'}`;

  const infoCards = [
    { label: 'NAMA SISWA', value: submission.namaSiswa, color: '#ffffff' },
    { label: 'KELAS & SEMESTER', value: `Kelas ${cleanKelasImg} · Sem. ${cleanSemesterImg}`, color: '#fcd34d' },
    { label: 'NIS / NISN', value: submission.nisNisn, color: '#ffffff' },
    {
      label: 'NILAI BENAR & NILAI SALAH',
      value: `${submission.skorBenar} Benar / ${wrongScoreImg} Salah`,
      color: '#34d399',
    },
    {
      label: 'TOTAL SKOR & KELULUSAN',
      value: `${submission.nilaiAkhir}% (${isPassed ? 'LULUS' : 'TIDAK LULUS'})`,
      color: isPassed ? '#34d399' : '#fb7185',
    },
    {
      label: 'STATUS KECURANGAN & INTEGRITAS',
      value: submission.statusKecurangan,
      color: '#7dd3fc',
    },
  ];

  const cols = 3;
  const gap = 14;
  const gridStartX = padding + photoCardW + photoGap;
  const gridAvailW = contentWidth - photoCardW - photoGap;
  const cardW = (gridAvailW - gap * (cols - 1)) / cols;
  const cardH = 84;

  infoCards.forEach((item, idx) => {
    const r = Math.floor(idx / cols);
    const c = idx % cols;
    const cx = gridStartX + c * (cardW + gap);
    const cy = curY + r * (cardH + 16);

    drawRoundedRect(ctx, cx, cy, cardW, cardH, 12);
    ctx.fillStyle = '#0f172a';
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = '#1e293b';
    ctx.stroke();

    ctx.fillStyle = '#7dd3fc';
    ctx.font = 'bold 12px sans-serif';
    ctx.fillText(item.label, cx + 14, cy + 28);

    ctx.fillStyle = item.color;
    ctx.font = 'bold 17px sans-serif';
    const truncatedVal =
      item.value.length > 22 ? item.value.slice(0, 21) + '…' : item.value;
    ctx.fillText(truncatedVal, cx + 14, cy + 60);
  });

  curY += 190 + 20;

  // 4. Kotak Saran Pembelajaran
  drawRoundedRect(ctx, padding, curY, contentWidth, adviceBoxHeight, 14);
  ctx.fillStyle = '#082f49';
  ctx.fill();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = '#0284c7';
  ctx.stroke();

  ctx.fillStyle = '#fcd34d';
  ctx.font = 'bold 16px sans-serif';
  ctx.fillText(
    `SARAN PEMBELAJARAN (${EXAM_INFO.kurikulum.toUpperCase()})`,
    padding + 24,
    curY + 34
  );

  ctx.fillStyle = '#f1f5f9';
  ctx.font = '400 18px sans-serif';
  adviceLines.forEach((line, i) => {
    ctx.fillText(line, padding + 24, curY + 66 + i * 25);
  });

  curY += adviceBoxHeight + 28;

  // 5. Header Detail Evaluasi Setiap Soal
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 22px sans-serif';
  ctx.fillText(
    `DETAIL EVALUASI SETIAP SOAL (1 – ${examQuestions.length})`,
    padding,
    curY + 24
  );
  ctx.fillStyle = '#94a3b8';
  ctx.font = '400 15px sans-serif';
  ctx.fillText(
    'Memuat Pertanyaan, Jawaban Siswa, Kunci Jawaban Benar, dan Penjelasan Pembelajaran Lengkap:',
    padding,
    curY + 48
  );

  curY += 62;

  // 6. Loop Setiap Soal
  for (const block of questionBlocks) {
    drawRoundedRect(ctx, padding, curY, contentWidth, block.blockHeight, 14);
    ctx.fillStyle = block.isCorrect ? '#052e16' : '#3b0714';
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = block.isCorrect ? '#10b981' : '#f43f5e';
    ctx.stroke();

    // Nomor & Kategori
    ctx.fillStyle = '#fbbf24';
    ctx.font = 'bold 16px sans-serif';
    ctx.fillText(
      `SOAL NO. ${block.index}  [${block.q.difficulty}]${
        block.q.elemen ? ` · ${block.q.elemen}` : ''
      }`,
      padding + 24,
      curY + 34
    );

    ctx.fillStyle = block.isCorrect ? '#6ee7b7' : '#fda4af';
    ctx.font = 'bold 15px sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(
      block.isCorrect
        ? '✓ JAWABAN BENAR'
        : `✗ JAWABAN SALAH (Status: ${isPassed ? 'Lulus' : 'Tidak Lulus'})`,
      padding + contentWidth - 24,
      curY + 34
    );
    ctx.textAlign = 'left';

    let innerY = curY + 66;

    // Pertanyaan
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 19px sans-serif';
    for (const line of block.qLines) {
      ctx.fillText(line, padding + 24, innerY);
      innerY += 26;
    }

    innerY += 10;

    // Kotak Jawaban Siswa
    const stuBoxH = block.studentLines.length * 24 + 18;
    drawRoundedRect(ctx, padding + 24, innerY, contentWidth - 48, stuBoxH, 8);
    ctx.fillStyle = block.isCorrect ? '#064e3b' : '#4c0519';
    ctx.fill();

    ctx.fillStyle = block.isCorrect ? '#a7f3d0' : '#fecdd3';
    ctx.font = 'bold 17px sans-serif';
    block.studentLines.forEach((line, i) => {
      ctx.fillText(line, padding + 36, innerY + 24 + i * 24);
    });
    innerY += stuBoxH + 10;

    // Kotak Kunci Jawaban Benar
    const corBoxH = block.correctLines.length * 24 + 18;
    drawRoundedRect(ctx, padding + 24, innerY, contentWidth - 48, corBoxH, 8);
    ctx.fillStyle = '#065f46';
    ctx.fill();

    ctx.fillStyle = '#fde68a';
    ctx.font = 'bold 17px sans-serif';
    block.correctLines.forEach((line, i) => {
      ctx.fillText(line, padding + 36, innerY + 24 + i * 24);
    });
    innerY += corBoxH + 10;

    // Kotak Penjelasan
    const expBoxH = block.expLines.length * 23 + 22;
    drawRoundedRect(ctx, padding + 24, innerY, contentWidth - 48, expBoxH, 8);
    ctx.fillStyle = '#0f172a';
    ctx.fill();

    ctx.fillStyle = '#e2e8f0';
    ctx.font = '400 16px sans-serif';
    block.expLines.forEach((line, i) => {
      ctx.fillText(line, padding + 36, innerY + 24 + i * 23);
    });

    curY += block.blockHeight + 18;
  }

  // 7. Footer
  ctx.fillStyle = '#94a3b8';
  ctx.font = '600 15px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(
    `Dokumen Resmi Hasil Ujian ANBK Informatika Kelas ${jenjang} · ${EXAM_INFO.namaSekolah} · Guru Mapel: ${EXAM_INFO.guruMapelUpper}`,
    width / 2,
    curY + 36
  );
  ctx.textAlign = 'left';

  const dataUrlJpg = canvas.toDataURL('image/jpeg', 0.94);

  const jpgBlob = await new Promise<Blob>((resolve) => {
    canvas.toBlob(
      (b) => resolve(b || new Blob([], { type: 'image/jpeg' })),
      'image/jpeg',
      0.94
    );
  });

  const pngBlob = await new Promise<Blob>((resolve) => {
    canvas.toBlob(
      (b) => resolve(b || new Blob([], { type: 'image/png' })),
      'image/png'
    );
  });

  return { jpgBlob, pngBlob, dataUrlJpg };
}

/**
 * Menghasilkan File PDF Resmi (A4 Multi-Halaman) berisi Laporan Lengkap Hasil Ujian Siswa
 */
export function generateResultPdfBlob(
  submission: StudentSubmission,
  examQuestions: Question[],
  isDisqualifiedByCheat: boolean = false
): Blob {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const jenjang = getJenjangFromKelas(submission.kelas);
  const isPassed =
    !isDisqualifiedByCheat &&
    submission.nilaiAkhir >= EXAM_INFO.kkm &&
    !submission.lulusTidakLulus.toLowerCase().includes('tidak');
  const answeredCount = Object.keys(submission.answers || {}).length;
  const adviceText = getLearningAdviceForSubmission(submission, isDisqualifiedByCheat);

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;
  const contentWidth = pageWidth - margin * 2;
  let y = 14;

  // Header Banner Biru Tua
  doc.setFillColor(12, 74, 110);
  doc.roundedRect(margin, y, contentWidth, 30, 3, 3, 'F');

  doc.setTextColor(252, 211, 77);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text(
    `LAPORAN HASIL UJIAN ANBK INFORMATIKA KELAS ${jenjang} - TA ${EXAM_INFO.tahunAjaran}`,
    margin + 6,
    y + 8
  );

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(15);
  doc.text(EXAM_INFO.namaSekolah, margin + 6, y + 17);

  doc.setTextColor(186, 230, 253);
  doc.setFontSize(9);
  doc.text(
    `Kurikulum Merdeka Fase D | Guru Mapel: ${EXAM_INFO.guruMapelUpper}`,
    margin + 6,
    y + 24
  );

  // Kotak Nilai di Kanan Header
  doc.setFillColor(15, 23, 42);
  doc.roundedRect(pageWidth - margin - 40, y + 4, 35, 22, 2, 2, 'F');
  doc.setTextColor(252, 211, 77);
  doc.setFontSize(7.5);
  doc.text('NILAI AKHIR', pageWidth - margin - 22.5, y + 10, { align: 'center' });
  doc.setTextColor(isPassed ? 52 : 251, isPassed ? 211 : 113, isPassed ? 153 : 133);
  doc.setFontSize(16);
  doc.text(`${submission.nilaiAkhir}%`, pageWidth - margin - 22.5, y + 21, {
    align: 'center',
  });

  y += 35;

  // Status Kelulusan Box
  if (isPassed) {
    doc.setFillColor(6, 78, 59);
  } else {
    doc.setFillColor(127, 29, 29);
  }
  doc.roundedRect(margin, y, contentWidth, 18, 2.5, 2.5, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(11);
  doc.text(
    `STATUS KELULUSAN: ${
      isPassed ? 'LULUS UJIAN' : 'TIDAK LULUS UJIAN ("UJIAN SUSULAN")'
    } (KKM: ${EXAM_INFO.kkm})`,
    margin + 5,
    y + 7.5
  );
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.text(
    `Status Integritas: ${submission.statusKecurangan}  |  Waktu Selesai: ${submission.timestamp}`,
    margin + 5,
    y + 14
  );

  y += 23;

  // Tabel Identitas Siswa + Pas Foto Siswa Saat Mulai Ujian
  const studentPhotoForReport = resolveStudentPhotoForCertificate(submission);
  doc.setFillColor(241, 245, 249);
  doc.setDrawColor(203, 213, 225);
  doc.roundedRect(margin, y, contentWidth, 30, 2, 2, 'FD');

  drawPdfStudentPhotoFrame(
    doc,
    studentPhotoForReport,
    submission.namaSiswa,
    margin + 3,
    y + 2,
    21,
    26
  );

  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.8);

  const col1X = margin + 27;
  const col2X = margin + 27 + (contentWidth - 29) / 2;
  const cleanKelasPdf = getCleanKelas(submission.kelas);
  const cleanSemesterPdf = getSemesterFromSub(submission);
  const wrongScorePdf = Math.max(0, submission.totalSoal - submission.skorBenar);

  doc.text(`Nama Siswa        : ${submission.namaSiswa}`, col1X, y + 6.5);
  doc.text(`Kelas / Semester  : Kelas ${cleanKelasPdf} / Semester ${cleanSemesterPdf}`, col1X, y + 12.5);
  doc.text(`NIS / NISN        : ${submission.nisNisn}`, col1X, y + 18.5);
  doc.text(
    `Status Kelulusan  : ${isPassed ? 'LULUS UJIAN' : 'TIDAK LULUS'} (Standar KKM: ${EXAM_INFO.kkm})`,
    col1X,
    y + 24.5
  );

  doc.text(
    `Nilai Benar / Salah : ${submission.skorBenar} Benar / ${wrongScorePdf} Salah (dari ${submission.totalSoal} Soal)`,
    col2X,
    y + 6.5
  );
  doc.text(
    `Total Skor Nilai    : ${submission.nilaiAkhir}% (Standar KKM: ${EXAM_INFO.kkm})`,
    col2X,
    y + 12.5
  );
  doc.text(
    `Lulus / Tidak Lulus : ${isPassed ? 'LULUS UJIAN' : 'TIDAK LULUS UJIAN (SUSULAN)'}`,
    col2X,
    y + 18.5
  );
  doc.text(
    `Status Kecurangan   : ${submission.statusKecurangan.slice(0, 38)}`,
    col2X,
    y + 24.5
  );

  y += 34;

  // Kotak Detail Data Kecurangan & Log Integritas Ujian
  const vCount = submission.violationCount || 0;
  const vLogs =
    submission.violationLogs && submission.violationLogs.length > 0
      ? submission.violationLogs.map((l, idx) => `${idx + 1}. ${l}`).join('\n')
      : '0 Pelanggaran — Siswa mengerjakan ujian dengan jujur (Tidak ada pindah tab / keluar fullscreen / split-screen).';
  const splitVLogs = doc.splitTextToSize(vLogs, contentWidth - 10);
  const cheatBoxH = 16 + splitVLogs.length * 4.3 + 4;

  if (vCount > 0 || isDisqualifiedByCheat) {
    doc.setFillColor(255, 241, 242);
    doc.setDrawColor(244, 63, 94);
  } else {
    doc.setFillColor(236, 253, 245);
    doc.setDrawColor(16, 185, 129);
  }
  doc.roundedRect(margin, y, contentWidth, cheatBoxH, 2, 2, 'FD');

  doc.setTextColor(vCount > 0 || isDisqualifiedByCheat ? 190 : 4, vCount > 0 || isDisqualifiedByCheat ? 18 : 120, vCount > 0 || isDisqualifiedByCheat ? 60 : 87);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text(
    `DATA KECURANGAN & LOG INTEGRITAS (${vCount}/3 PELANGGARAN - ${submission.statusKecurangan}):`,
    margin + 5,
    y + 6.5
  );

  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.3);
  doc.text(splitVLogs, margin + 5, y + 12.5);

  y += cheatBoxH + 6;

  // Saran Pembelajaran
  const splitAdvice = doc.splitTextToSize(adviceText, contentWidth - 10);
  const adviceH = 10 + splitAdvice.length * 4.5 + 4;
  doc.setFillColor(224, 242, 254);
  doc.setDrawColor(56, 189, 248);
  doc.roundedRect(margin, y, contentWidth, adviceH, 2, 2, 'FD');

  doc.setTextColor(3, 105, 161);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text(`SARAN PEMBELAJARAN (${EXAM_INFO.kurikulum}):`, margin + 5, y + 6.5);

  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.text(splitAdvice, margin + 5, y + 12);

  y += adviceH + 7;

  // Judul Evaluasi Soal
  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text(
    `DETAIL EVALUASI SETIAP SOAL (1 - ${examQuestions.length})`,
    margin,
    y
  );
  y += 5;

  // Loop Soal 1 s/d 10
  examQuestions.forEach((q, idx) => {
    const studentChoice = submission.answers?.[q.id];
    const isCorrect = studentChoice === q.answer;
    const choiceIndex = studentChoice ? ['A', 'B', 'C', 'D'].indexOf(studentChoice) : -1;
    const studentAnswerText =
      choiceIndex >= 0 ? `${studentChoice}. ${q.options[choiceIndex]}` : 'Tidak Dijawab';
    const correctIndex = ['A', 'B', 'C', 'D'].indexOf(q.answer);
    const correctAnswerText = `${q.answer}. ${q.options[correctIndex]}`;

    const qLines = doc.splitTextToSize(
      `${idx + 1}. [${q.difficulty}] ${q.content}`,
      contentWidth - 10
    );
    const stuLines = doc.splitTextToSize(
      `Jawaban Siswa: ${studentAnswerText} (${isCorrect ? 'BENAR' : 'SALAH'})`,
      contentWidth - 10
    );
    const corLines = doc.splitTextToSize(
      `Jawaban yang Benar: ${correctAnswerText}`,
      contentWidth - 10
    );
    const expPrefix = isCorrect
      ? 'Penjelasan: '
      : `Penjelasan Jawaban Salah (${isPassed ? 'Lulus' : 'Tidak Lulus'}): `;
    const expLines = doc.splitTextToSize(
      expPrefix + q.explanation,
      contentWidth - 10
    );

    const boxHeight =
      8 +
      qLines.length * 4.2 +
      stuLines.length * 4.2 +
      corLines.length * 4.2 +
      expLines.length * 4.2 +
      10;

    if (y + boxHeight > pageHeight - 16) {
      doc.addPage();
      y = 15;
    }

    if (isCorrect) {
      doc.setFillColor(236, 253, 245);
      doc.setDrawColor(16, 185, 129);
    } else {
      doc.setFillColor(255, 241, 242);
      doc.setDrawColor(244, 63, 94);
    }
    doc.roundedRect(margin, y, contentWidth, boxHeight, 2, 2, 'FD');

    let innerY = y + 6;
    doc.setTextColor(15, 23, 42);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text(qLines, margin + 5, innerY);
    innerY += qLines.length * 4.2 + 1.5;

    doc.setTextColor(isCorrect ? 4 : 190, isCorrect ? 120 : 18, isCorrect ? 87 : 60);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.text(stuLines, margin + 5, innerY);
    innerY += stuLines.length * 4.2 + 1;

    doc.setTextColor(6, 95, 70);
    doc.text(corLines, margin + 5, innerY);
    innerY += corLines.length * 4.2 + 1;

    doc.setTextColor(51, 65, 85);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.2);
    doc.text(expLines, margin + 5, innerY);

    y += boxHeight + 4;
  });

  return doc.output('blob');
}

/**
 * Menghasilkan Sertifikat Nilai Ujian & Laporan Hasil Lengkap dalam format PDF Resmi
 * untuk diunduh langsung oleh siswa melalui tombol "Simpan Hasil sebagai PDF"
 */
export function generateCertificatePdfBlob(
  submission: StudentSubmission,
  examQuestions: Question[],
  isDisqualifiedByCheat: boolean = false
): Blob {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const jenjang = getJenjangFromKelas(submission.kelas);
  const isPassed =
    !isDisqualifiedByCheat &&
    submission.nilaiAkhir >= EXAM_INFO.kkm &&
    !submission.lulusTidakLulus.toLowerCase().includes('tidak');
  const answeredCount = Object.keys(submission.answers || {}).length;
  const adviceText = getLearningAdviceForSubmission(submission, isDisqualifiedByCheat);
  const hotsQs = examQuestions.filter((q) => q.difficulty === 'HOTS');
  const regQs = examQuestions.filter((q) => q.difficulty === 'REGULER');
  const hotsCorrect = hotsQs.filter((q) => submission.answers?.[q.id] === q.answer).length;
  const regCorrect = regQs.filter((q) => submission.answers?.[q.id] === q.answer).length;

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;
  const contentWidth = pageWidth - margin * 2;

  // Bingkai Sertifikat Ganda (Navy & Emas) pada Halaman 1
  doc.setDrawColor(12, 74, 110);
  doc.setLineWidth(1.5);
  doc.rect(8, 8, pageWidth - 16, pageHeight - 16);
  doc.setDrawColor(245, 158, 11);
  doc.setLineWidth(0.6);
  doc.rect(10.5, 10.5, pageWidth - 21, pageHeight - 21);

  let y = 16;

  // Header Sertifikat Resmi
  doc.setFillColor(12, 74, 110);
  doc.roundedRect(margin, y, contentWidth, 34, 3, 3, 'F');

  doc.setTextColor(252, 211, 77);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text(
    'SERTIFIKAT NILAI & HASIL UJIAN ASESMEN NASIONAL BERBASIS KOMPUTER (ANBK)',
    pageWidth / 2,
    y + 9,
    { align: 'center' }
  );

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.text(EXAM_INFO.namaSekolah, pageWidth / 2, y + 18.5, { align: 'center' });

  doc.setTextColor(186, 230, 253);
  doc.setFontSize(9);
  doc.text(
    `Mata Pelajaran: INFORMATIKA (Kelas ${jenjang}) · ${EXAM_INFO.kurikulum} · TA ${EXAM_INFO.tahunAjaran}`,
    pageWidth / 2,
    y + 25.5,
    { align: 'center' }
  );

  doc.setTextColor(253, 230, 138);
  doc.setFontSize(8);
  doc.text(
    `Nomor Sertifikat: SERTIFIKAT-ANBK/${submission.id}/${EXAM_INFO.tahunAjaran.replace('/', '-')}`,
    pageWidth / 2,
    y + 31,
    { align: 'center' }
  );

  y += 40;

  // Pernyataan Sertifikat & Identitas Peserta
  doc.setTextColor(51, 65, 85);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.text(
    'Sertifikat Hasil Evaluasi Ujian Berbasis Komputer ini diberikan kepada peserta didik:',
    pageWidth / 2,
    y,
    { align: 'center' }
  );

  y += 5;

  // Kotak Utama Nama, Foto Siswa (Diambil Saat Memulai Ujian) & Identitas Siswa pada Sertifikat
  const studentPhotoCert = resolveStudentPhotoForCertificate(submission);
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(148, 163, 184);
  doc.setLineWidth(0.4);
  doc.roundedRect(margin, y, contentWidth, 38, 2.5, 2.5, 'FD');

  // Pas Foto Resmi Peserta Ujian di Sisi Kiri Kotak Sertifikat
  const photoBoxW = 26;
  const photoBoxH = 33;
  drawPdfStudentPhotoFrame(
    doc,
    studentPhotoCert,
    submission.namaSiswa,
    margin + 4,
    y + 2.5,
    photoBoxW,
    photoBoxH
  );

  const infoCenterX = margin + photoBoxW + 6 + (contentWidth - photoBoxW - 10) / 2;
  const cleanKelasCert = getCleanKelas(submission.kelas);
  const cleanSemesterCert = getSemesterFromSub(submission);
  const wrongScoreCert = Math.max(0, submission.totalSoal - submission.skorBenar);

  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13.5);
  doc.text(`NAMA SISWA: ${submission.namaSiswa.toUpperCase()}`, infoCenterX, y + 8.5, {
    align: 'center',
  });

  doc.setFontSize(8.8);
  doc.setTextColor(3, 105, 161);
  doc.text(
    `Kelas: ${cleanKelasCert}   |   Semester: ${cleanSemesterCert}   |   NIS / NISN: ${submission.nisNisn}`,
    infoCenterX,
    y + 14.5,
    { align: 'center' }
  );

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.2);
  doc.setTextColor(15, 23, 42);
  doc.text(
    `Nilai Benar: ${submission.skorBenar} Soal  |  Nilai Salah: ${wrongScoreCert} Soal  |  Total Skor Nilai: ${submission.nilaiAkhir}%  |  Status: ${
      isPassed ? 'LULUS UJIAN' : 'TIDAK LULUS'
    }`,
    infoCenterX,
    y + 20.5,
    { align: 'center' }
  );

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.8);
  doc.setTextColor(71, 85, 105);
  doc.text(
    `Capaian HOTS: ${hotsCorrect}/${hotsQs.length} Benar  |  Reguler: ${regCorrect}/${regQs.length} Benar  |  Terjawab: ${answeredCount}/${submission.totalSoal} Soal`,
    infoCenterX,
    y + 26,
    { align: 'center' }
  );

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(isDisqualifiedByCheat || (submission.violationCount || 0) > 0 ? 190 : 3, isDisqualifiedByCheat || (submission.violationCount || 0) > 0 ? 18 : 105, isDisqualifiedByCheat || (submission.violationCount || 0) > 0 ? 60 : 161);
  doc.text(
    `Status Integritas & Kecurangan: ${submission.statusKecurangan}`,
    infoCenterX,
    y + 32.5,
    { align: 'center' }
  );

  y += 43;

  // Kotak Nilai Akhir & Status Kelulusan
  if (isPassed) {
    doc.setFillColor(6, 78, 59);
    doc.setDrawColor(16, 185, 129);
  } else {
    doc.setFillColor(127, 29, 29);
    doc.setDrawColor(244, 63, 94);
  }
  doc.setLineWidth(0.6);
  doc.roundedRect(margin, y, contentWidth, 28, 3, 3, 'FD');

  doc.setTextColor(252, 211, 77);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text(
    `CAPAIAN NILAI AKHIR & STATUS KELULUSAN (STANDAR KKM: ${EXAM_INFO.kkm})`,
    margin + 6,
    y + 7.5
  );

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(13);
  doc.text(
    isPassed ? 'LULUS UJIAN' : 'TIDAK LULUS UJIAN — "UJIAN SUSULAN"',
    margin + 6,
    y + 16
  );

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.text(
    `Skor Benar: ${submission.skorBenar} dari ${submission.totalSoal} Soal  |  Integritas: ${submission.statusKecurangan}`,
    margin + 6,
    y + 23.5
  );

  // Badge Nilai Persen di Kanan
  doc.setFillColor(15, 23, 42);
  doc.roundedRect(pageWidth - margin - 42, y + 3, 36, 22, 2, 2, 'F');
  doc.setTextColor(252, 211, 77);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.text('NILAI AKHIR', pageWidth - margin - 24, y + 9, { align: 'center' });
  doc.setTextColor(isPassed ? 52 : 251, isPassed ? 211 : 113, isPassed ? 153 : 133);
  doc.setFontSize(16);
  doc.text(`${submission.nilaiAkhir}%`, pageWidth - margin - 24, y + 20, {
    align: 'center',
  });

  y += 34;

  // Kotak Saran Pembelajaran
  const splitAdvice = doc.splitTextToSize(adviceText, contentWidth - 10);
  const adviceH = 11 + splitAdvice.length * 4.5 + 4;
  doc.setFillColor(224, 242, 254);
  doc.setDrawColor(56, 189, 248);
  doc.roundedRect(margin, y, contentWidth, adviceH, 2, 2, 'FD');

  doc.setTextColor(3, 105, 161);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text(`CATATAN & SARAN PEMBELAJARAN (${EXAM_INFO.kurikulum}):`, margin + 5, y + 6.5);

  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.text(splitAdvice, margin + 5, y + 12.5);

  y += adviceH + 6;

  // Tabel Ringkasan Jawaban 1 - 10 pada Halaman Sertifikat
  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.text('RINGKASAN JAWABAN & KUNCI JAWABAN PER NOMOR SOAL:', margin, y);
  y += 4;

  examQuestions.forEach((q, idx) => {
    const ans = submission.answers?.[q.id];
    const isCorrect = ans === q.answer;
    doc.setFillColor(isCorrect ? 236 : 255, isCorrect ? 253 : 241, isCorrect ? 245 : 242);
    doc.setDrawColor(isCorrect ? 16 : 244, isCorrect ? 185 : 63, isCorrect ? 129 : 94);
    doc.roundedRect(margin, y, contentWidth, 6.2, 1, 1, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(15, 23, 42);
    doc.text(
      `Soal No. ${idx + 1} [${q.difficulty}]${q.elemen ? ` - ${q.elemen}` : ''}`,
      margin + 3,
      y + 4.3
    );

    doc.setTextColor(isCorrect ? 4 : 190, isCorrect ? 120 : 18, isCorrect ? 87 : 60);
    doc.text(
      `Jawaban Siswa: ${ans || '-'}  |  Kunci: ${q.answer}  (${
        isCorrect ? 'BENAR' : 'SALAH'
      })`,
      pageWidth - margin - 3,
      y + 4.3,
      { align: 'right' }
    );
    y += 7.2;
  });

  y += 5;

  // Blok Pengesahan Guru Mapel di Bawah Halaman 1
  if (y + 26 <= pageHeight - 14) {
    const signX = pageWidth - margin - 68;
    doc.setTextColor(15, 23, 42);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.text(`Kisaran, ${submission.timestamp.split(',')[0]}`, signX, y + 4);
    doc.text('Guru Mata Pelajaran Informatika,', signX, y + 9);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.text(EXAM_INFO.guruMapelUpper, signX, y + 22);
    doc.setDrawColor(15, 23, 42);
    doc.line(signX, y + 23, signX + 58, y + 23);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text(EXAM_INFO.namaSekolah, signX, y + 27);
  }

  return doc.output('blob');
}

/**
 * Menghasilkan Data URL Gambar Lembar Sertifikat A4 Resmi (Resolusi Tinggi 1240 x 1754 px)
 * agar pratinjau "Buka Lembar PDF A4" tampil tajam di semua browser & iframe tanpa terblokir ekstensi PDF Chrome
 */
export async function generateCertificateA4SheetDataUrl(
  submission: StudentSubmission,
  examQuestions: Question[],
  isDisqualifiedByCheat: boolean = false
): Promise<string> {
  const width = 1240;
  const height = 1754; // Rasio standar kertas A4 Portrait (210mm x 297mm)
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;

  const jenjang = getJenjangFromKelas(submission.kelas);
  const cleanKelas = getCleanKelas(submission.kelas);
  const cleanSemester = getSemesterFromSub(submission);
  const isPassed =
    !isDisqualifiedByCheat &&
    submission.nilaiAkhir >= EXAM_INFO.kkm &&
    !submission.lulusTidakLulus.toLowerCase().includes('tidak');
  const answeredCount = Object.keys(submission.answers || {}).length;
  const wrongScore = Math.max(0, submission.totalSoal - submission.skorBenar);
  const adviceText = getLearningAdviceForSubmission(submission, isDisqualifiedByCheat);
  const hotsQs = examQuestions.filter((q) => q.difficulty === 'HOTS');
  const regQs = examQuestions.filter((q) => q.difficulty === 'REGULER');
  const hotsCorrect = hotsQs.filter((q) => submission.answers?.[q.id] === q.answer).length;
  const regCorrect = regQs.filter((q) => submission.answers?.[q.id] === q.answer).length;
  const vCount = submission.violationCount || 0;

  // 1. Kertas Putih A4 Bersih + Bingkai Ganda Sertifikat (Navy & Emas)
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);

  ctx.strokeStyle = '#0c4a6e';
  ctx.lineWidth = 8;
  ctx.strokeRect(36, 36, width - 72, height - 72);

  ctx.strokeStyle = '#f59e0b';
  ctx.lineWidth = 3.5;
  ctx.strokeRect(50, 50, width - 100, height - 100);

  const margin = 76;
  const contentW = width - margin * 2;
  let curY = 78;

  // 2. Header Kop Sertifikat Resmi
  drawRoundedRect(ctx, margin, curY, contentW, 185, 16);
  const hdrGrad = ctx.createLinearGradient(margin, curY, margin + contentW, curY + 185);
  hdrGrad.addColorStop(0, '#0c4a6e');
  hdrGrad.addColorStop(0.5, '#075985');
  hdrGrad.addColorStop(1, '#0f172a');
  ctx.fillStyle = hdrGrad;
  ctx.fill();

  ctx.fillStyle = '#fcd34d';
  ctx.font = 'bold 20px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(
    'SERTIFIKAT NILAI & HASIL UJIAN ASESMEN NASIONAL BERBASIS KOMPUTER (ANBK)',
    width / 2,
    curY + 42
  );

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 34px sans-serif';
  ctx.fillText(EXAM_INFO.namaSekolah, width / 2, curY + 88);

  ctx.fillStyle = '#bae6fd';
  ctx.font = 'bold 18px sans-serif';
  ctx.fillText(
    `Mata Pelajaran: INFORMATIKA (Kelas ${jenjang}) · ${EXAM_INFO.kurikulum} · TA ${EXAM_INFO.tahunAjaran}`,
    width / 2,
    curY + 126
  );

  ctx.fillStyle = '#fde68a';
  ctx.font = 'bold 16px monospace';
  ctx.fillText(
    `Nomor Sertifikat: SERTIFIKAT-ANBK/${submission.id}/${EXAM_INFO.tahunAjaran.replace('/', '-')}`,
    width / 2,
    curY + 160
  );

  curY += 208;

  // 3. Kalimat Pengantar Sertifikat
  ctx.fillStyle = '#334155';
  ctx.font = '600 18px sans-serif';
  ctx.fillText(
    'Sertifikat Hasil Evaluasi Ujian Berbasis Komputer ini diberikan kepada peserta didik:',
    width / 2,
    curY
  );
  ctx.textAlign = 'left';

  curY += 18;

  // 4. Kotak Utama Identitas & Pas Foto Siswa (Diambil Saat Pertama Memulai Ujian)
  const idBoxH = 250;
  drawRoundedRect(ctx, margin, curY, contentW, idBoxH, 16);
  ctx.fillStyle = '#f8fafc';
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = '#94a3b8';
  ctx.stroke();

  // Pas Foto Siswa di Sisi Kiri
  const photoW = 166;
  const photoH = 218;
  const photoX = margin + 18;
  const photoY = curY + 16;

  drawRoundedRect(ctx, photoX, photoY, photoW, photoH, 12);
  ctx.fillStyle = '#0f172a';
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = '#f59e0b';
  ctx.stroke();

  const resolvedPhoto = resolveStudentPhotoForCertificate(submission);
  const studentImg = await loadImageElementSafe(resolvedPhoto);
  if (studentImg) {
    ctx.save();
    drawRoundedRect(ctx, photoX + 6, photoY + 6, photoW - 12, photoH - 36, 8);
    ctx.clip();
    ctx.drawImage(studentImg, photoX + 6, photoY + 6, photoW - 12, photoH - 36);
    ctx.restore();
  } else {
    drawRoundedRect(ctx, photoX + 6, photoY + 6, photoW - 12, photoH - 36, 8);
    ctx.fillStyle = '#0c4a6e';
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 40px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(
      getStudentInitials(submission.namaSiswa),
      photoX + photoW / 2,
      photoY + (photoH - 30) / 2 + 10
    );
    ctx.textAlign = 'left';
  }

  // Pita Bawah Foto Siswa
  ctx.fillStyle = '#f59e0b';
  ctx.fillRect(photoX + 3, photoY + photoH - 28, photoW - 6, 25);
  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 11px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('FOTO PESERTA UJIAN', photoX + photoW / 2, photoY + photoH - 11);

  // Keterangan 10 Item di Sisi Kanan Foto
  const infoCenterX = photoX + photoW + 18 + (contentW - photoW - 44) / 2;

  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 26px sans-serif';
  ctx.fillText(`NAMA SISWA: ${submission.namaSiswa.toUpperCase()}`, infoCenterX, curY + 46);

  ctx.fillStyle = '#0369a1';
  ctx.font = 'bold 18px sans-serif';
  ctx.fillText(
    `Kelas: ${cleanKelas}   |   Semester: ${cleanSemester}   |   NIS / NISN: ${submission.nisNisn}`,
    infoCenterX,
    curY + 84
  );

  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 17px sans-serif';
  ctx.fillText(
    `Nilai Benar: ${submission.skorBenar} Soal  |  Nilai Salah: ${wrongScore} Soal  |  Total Skor: ${submission.nilaiAkhir}%  |  Status: ${
      isPassed ? 'LULUS UJIAN' : 'TIDAK LULUS'
    }`,
    infoCenterX,
    curY + 122
  );

  ctx.fillStyle = '#475569';
  ctx.font = '600 16px sans-serif';
  ctx.fillText(
    `Capaian HOTS: ${hotsCorrect}/${hotsQs.length} Benar  |  Reguler: ${regCorrect}/${regQs.length} Benar  |  Terjawab: ${answeredCount}/${submission.totalSoal} Soal`,
    infoCenterX,
    curY + 158
  );

  ctx.fillStyle = vCount > 0 || isDisqualifiedByCheat ? '#be123c' : '#0369a1';
  ctx.font = 'bold 16px sans-serif';
  ctx.fillText(
    `Status Integritas & Kecurangan (${vCount}/3 Pelanggaran): ${submission.statusKecurangan}`,
    infoCenterX,
    curY + 200
  );
  ctx.textAlign = 'left';

  curY += idBoxH + 22;

  // 5. Kotak Capaian Nilai Akhir & Status Kelulusan
  drawRoundedRect(ctx, margin, curY, contentW, 146, 16);
  ctx.fillStyle = isPassed ? '#064e3b' : '#7f1d1d';
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = isPassed ? '#10b981' : '#f43f5e';
  ctx.stroke();

  ctx.fillStyle = '#fcd34d';
  ctx.font = 'bold 18px sans-serif';
  ctx.fillText(
    `CAPAIAN NILAI AKHIR & STATUS KELULUSAN (STANDAR KKM: ${EXAM_INFO.kkm})`,
    margin + 26,
    curY + 40
  );

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 28px sans-serif';
  ctx.fillText(
    isPassed ? 'LULUS UJIAN' : 'TIDAK LULUS UJIAN — "UJIAN SUSULAN"',
    margin + 26,
    curY + 84
  );

  ctx.fillStyle = '#e2e8f0';
  ctx.font = '600 17px sans-serif';
  ctx.fillText(
    `Skor Benar: ${submission.skorBenar} dari ${submission.totalSoal} Soal   |   Waktu Selesai: ${submission.timestamp}`,
    margin + 26,
    curY + 122
  );

  // Badge Nilai Akhir di Kanan
  const badgeW = 210;
  const badgeX = margin + contentW - badgeW - 22;
  drawRoundedRect(ctx, badgeX, curY + 16, badgeW, 114, 14);
  ctx.fillStyle = '#0f172a';
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = '#f59e0b';
  ctx.stroke();

  ctx.fillStyle = '#fcd34d';
  ctx.font = 'bold 15px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('TOTAL SKOR NILAI', badgeX + badgeW / 2, curY + 48);

  ctx.fillStyle = isPassed ? '#34d399' : '#fb7185';
  ctx.font = 'bold 44px monospace';
  ctx.fillText(`${submission.nilaiAkhir}%`, badgeX + badgeW / 2, curY + 104);
  ctx.textAlign = 'left';

  curY += 146 + 22;

  // 6. Kotak Catatan & Saran Pembelajaran
  ctx.font = '400 17px sans-serif';
  const adviceLines = wrapCanvasText(ctx, adviceText, contentW - 48);
  const adviceH = 54 + adviceLines.length * 24 + 16;

  drawRoundedRect(ctx, margin, curY, contentW, adviceH, 14);
  ctx.fillStyle = '#e0f2fe';
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = '#38bdf8';
  ctx.stroke();

  ctx.fillStyle = '#0369a1';
  ctx.font = 'bold 17px sans-serif';
  ctx.fillText(
    `CATATAN & SARAN PEMBELAJARAN (${EXAM_INFO.kurikulum.toUpperCase()}):`,
    margin + 22,
    curY + 32
  );

  ctx.fillStyle = '#0f172a';
  ctx.font = '400 17px sans-serif';
  adviceLines.forEach((line, idx) => {
    ctx.fillText(line, margin + 22, curY + 62 + idx * 24);
  });

  curY += adviceH + 24;

  // 7. Ringkasan Jawaban & Kunci Jawaban per Nomor Soal (1 - 10)
  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 19px sans-serif';
  ctx.fillText('RINGKASAN JAWABAN & KUNCI JAWABAN PER NOMOR SOAL:', margin, curY);
  curY += 14;

  examQuestions.forEach((q, idx) => {
    const ans = submission.answers?.[q.id];
    const isCorrect = ans === q.answer;
    const rowH = 34;

    drawRoundedRect(ctx, margin, curY, contentW, rowH, 6);
    ctx.fillStyle = isCorrect ? '#ecfdf5' : '#fff1f2';
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = isCorrect ? '#10b981' : '#f43f5e';
    ctx.stroke();

    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 15px sans-serif';
    ctx.fillText(
      `Soal No. ${idx + 1} [${q.difficulty}]${q.elemen ? ` - ${q.elemen}` : ''}`,
      margin + 16,
      curY + 22
    );

    ctx.fillStyle = isCorrect ? '#047857' : '#be123c';
    ctx.textAlign = 'right';
    ctx.fillText(
      `Jawaban Siswa: ${ans || '-'}   |   Kunci: ${q.answer}   (${
        isCorrect ? '✓ BENAR' : '✗ SALAH'
      })`,
      margin + contentW - 16,
      curY + 22
    );
    ctx.textAlign = 'left';

    curY += rowH + 7;
  });

  curY += 18;

  // 8. Blok Pengesahan Guru Mapel di Bawah Halaman Sertifikat A4
  ctx.fillStyle = '#475569';
  ctx.font = '600 15px sans-serif';
  ctx.fillText('Dokumen Sertifikat Nilai Resmi Hasil Ujian ANBK Informatika', margin, curY + 24);
  ctx.fillText(
    `${EXAM_INFO.namaSekolah} · Tahun Ajaran ${EXAM_INFO.tahunAjaran}`,
    margin,
    curY + 48
  );

  const signX = margin + contentW - 340;
  ctx.fillStyle = '#0f172a';
  ctx.font = '400 16px sans-serif';
  ctx.fillText(`Kisaran, ${submission.timestamp.split(',')[0]}`, signX, curY + 18);
  ctx.fillText('Guru Mata Pelajaran Informatika,', signX, curY + 42);

  ctx.font = 'bold 18px sans-serif';
  ctx.fillText(EXAM_INFO.guruMapelUpper, signX, curY + 106);

  ctx.strokeStyle = '#0f172a';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(signX, curY + 112);
  ctx.lineTo(signX + 310, curY + 112);
  ctx.stroke();

  ctx.font = '400 15px sans-serif';
  ctx.fillText(EXAM_INFO.namaSekolah, signX, curY + 134);

  return canvas.toDataURL('image/png');
}

export function triggerFileDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const res = String(reader.result || '');
      const base64Part = res.includes(',') ? res.split(',')[1] : res;
      resolve(base64Part);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export function buildHtmlEmailBody(
  submission: StudentSubmission,
  _examQuestions: Question[],
  formatLabel: string,
  jpgFilename: string,
  pdfFilename: string,
  isDisqualifiedByCheat: boolean = false
): string {
  const jenjang = getJenjangFromKelas(submission.kelas);
  const isPassed =
    !isDisqualifiedByCheat &&
    submission.nilaiAkhir >= EXAM_INFO.kkm &&
    !submission.lulusTidakLulus.toLowerCase().includes('tidak');

  return `
    <div style="font-family:Arial,sans-serif;max-width:780px;margin:0 auto;color:#0f172a;background:#020617;padding:18px;border-radius:16px;">
      <div style="background:linear-gradient(135deg,#0c4a6e,#0f172a);color:#ffffff;padding:16px 20px;border-radius:12px;border:1px solid #0284c7;margin-bottom:14px;">
        <div style="color:#fcd34d;font-size:11px;font-weight:bold;letter-spacing:0.5px;">
          HASIL UJIAN ANBK INFORMATIKA KELAS ${jenjang} · FORMAT GAMBAR (.JPG) &amp; FORMAT PDF (.PDF)
        </div>
        <div style="font-size:16px;font-weight:bold;margin-top:4px;color:#ffffff;">
          ${submission.namaSiswa} — Kelas ${submission.kelas} — Nilai: ${submission.nilaiAkhir}% (${
    isPassed ? 'LULUS' : 'TIDAK LULUS'
  })
        </div>
        <div style="font-size:12px;color:#bae6fd;margin-top:4px;">
          Lampiran Berkas (${formatLabel}): <strong>${jpgFilename}</strong> &amp; <strong>${pdfFilename}</strong>
        </div>
      </div>
      <div style="text-align:center;background:#0f172a;padding:10px;border-radius:12px;border:1px solid #1e293b;">
        <img src="cid:hasil_ujian_jpg" alt="${jpgFilename}" style="max-width:100%;height:auto;border-radius:10px;display:block;margin:0 auto;" />
      </div>
    </div>
  `;
}

/**
 * Menghasilkan Dokumen Tabel PDF Portofolio Riwayat Ujian Siswa (A4 Landscape Profesional)
 * Merangkum seluruh riwayat percobaan ujian, skor benar, nilai akhir, integritas, dan status kelulusan
 */
export function generateStudentHistoryPortfolioPdfBlob(
  submissionsList: StudentSubmission[],
  attemptNumberMap: Record<string, number>,
  filterInfo?: {
    searchQuery?: string;
    selectedClass?: string;
    selectedStatus?: string;
  }
): Blob {
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth(); // 297 mm
  const pageHeight = doc.internal.pageSize.getHeight(); // 210 mm
  const margin = 12;
  const contentWidth = pageWidth - margin * 2; // 273 mm

  const drawPageFrame = () => {
    doc.setDrawColor(12, 74, 110);
    doc.setLineWidth(1.1);
    doc.rect(6, 6, pageWidth - 12, pageHeight - 12);
    doc.setDrawColor(245, 158, 11);
    doc.setLineWidth(0.4);
    doc.rect(8, 8, pageWidth - 16, pageHeight - 16);
  };

  drawPageFrame();

  let y = 13;

  // 1. Header Banner Portofolio Resmi
  doc.setFillColor(12, 74, 110);
  doc.roundedRect(margin, y, contentWidth, 28, 3, 3, 'F');

  doc.setTextColor(252, 211, 77);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.text(
    `ARSIP PORTOFOLIO RIWAYAT HASIL UJIAN ANBK INFORMATIKA · TAHUN AJARAN ${EXAM_INFO.tahunAjaran}`,
    margin + 6,
    y + 7.5
  );

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(15);
  doc.text(EXAM_INFO.namaSekolah, margin + 6, y + 15.5);

  doc.setTextColor(186, 230, 253);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.text(
    `Mata Pelajaran: ${EXAM_INFO.mataPelajaran} · ${EXAM_INFO.kurikulum} · Guru Mapel: ${EXAM_INFO.guruMapelUpper}`,
    margin + 6,
    y + 22.5
  );

  // Badge Info Cetak di Kanan Header
  const printDateStr = new Date().toLocaleString('id-ID');
  doc.setFillColor(15, 23, 42);
  doc.roundedRect(pageWidth - margin - 74, y + 3.5, 68, 21, 2, 2, 'F');
  doc.setTextColor(252, 211, 77);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.text('DOKUMEN PORTOFOLIO CAPAIAN SISWA', pageWidth - margin - 40, y + 9, {
    align: 'center',
  });
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(8);
  const scopeLabel =
    filterInfo?.searchQuery && filterInfo.searchQuery.trim() !== ''
      ? `Filter: ${filterInfo.searchQuery.trim().slice(0, 24)}`
      : filterInfo?.selectedClass && filterInfo.selectedClass !== 'ALL'
      ? `Filter Kelas: ${filterInfo.selectedClass}`
      : 'Semua Riwayat Peserta';
  doc.text(scopeLabel, pageWidth - margin - 40, y + 14.5, { align: 'center' });
  doc.setTextColor(148, 163, 184);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.text(`Dicetak: ${printDateStr}`, pageWidth - margin - 40, y + 20, {
    align: 'center',
  });

  y += 32;

  // 2. Ringkasan Statistik Portofolio (4 Kartu Metrik)
  const totalAttempts = submissionsList.length;
  const scores = submissionsList.map((s) => s.nilaiAkhir);
  const highestScore = totalAttempts > 0 ? Math.max(...scores) : 0;
  const lowestScore = totalAttempts > 0 ? Math.min(...scores) : 0;
  const avgScore =
    totalAttempts > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / totalAttempts) : 0;
  const passedCount = submissionsList.filter(
    (s) =>
      s.nilaiAkhir >= EXAM_INFO.kkm &&
      !s.lulusTidakLulus.toLowerCase().includes('tidak') &&
      !s.statusKecurangan.toLowerCase().includes('diskualifikasi')
  ).length;
  const failedCount = totalAttempts - passedCount;
  const cleanCount = submissionsList.filter(
    (s) =>
      (s.violationCount || 0) === 0 &&
      !s.statusKecurangan.toLowerCase().includes('pelanggaran') &&
      !s.statusKecurangan.toLowerCase().includes('diskualifikasi')
  ).length;

  const summaryCards = [
    {
      title: 'TOTAL RIWAYAT UJIAN',
      main: `${totalAttempts} Percobaan`,
      sub: `Standar KKM: ${EXAM_INFO.kkm}%`,
      bg: [241, 245, 249] as [number, number, number],
      border: [148, 163, 184] as [number, number, number],
      text: [15, 23, 42] as [number, number, number],
    },
    {
      title: 'CAPAIAN NILAI PORTOFOLIO',
      main: `Tertinggi: ${highestScore}%  |  Rata-rata: ${avgScore}%`,
      sub: `Nilai Terendah: ${lowestScore}%`,
      bg: [254, 252, 232] as [number, number, number],
      border: [250, 204, 21] as [number, number, number],
      text: [133, 77, 14] as [number, number, number],
    },
    {
      title: 'STATUS KELULUSAN KKM',
      main: `${passedCount} Lulus  /  ${failedCount} Susulan`,
      sub: `Rasio Kelulusan: ${
        totalAttempts > 0 ? Math.round((passedCount / totalAttempts) * 100) : 0
      }%`,
      bg: [236, 253, 245] as [number, number, number],
      border: [16, 185, 129] as [number, number, number],
      text: [6, 95, 70] as [number, number, number],
    },
    {
      title: 'INTEGRITAS KEJUJURAN',
      main: `${cleanCount} dari ${totalAttempts} Sesi Jujur`,
      sub: 'Sistem Anti-Curang ANBK Aktif',
      bg: [240, 249, 255] as [number, number, number],
      border: [56, 189, 248] as [number, number, number],
      text: [3, 105, 161] as [number, number, number],
    },
  ];

  const cardGap = 4;
  const cardW = (contentWidth - cardGap * 3) / 4;
  const cardH = 18;

  summaryCards.forEach((c, idx) => {
    const cx = margin + idx * (cardW + cardGap);
    doc.setFillColor(c.bg[0], c.bg[1], c.bg[2]);
    doc.setDrawColor(c.border[0], c.border[1], c.border[2]);
    doc.setLineWidth(0.35);
    doc.roundedRect(cx, y, cardW, cardH, 2, 2, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(71, 85, 105);
    doc.text(c.title, cx + 3.5, y + 5);

    doc.setFontSize(9.5);
    doc.setTextColor(c.text[0], c.text[1], c.text[2]);
    doc.text(c.main, cx + 3.5, y + 11);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.2);
    doc.setTextColor(100, 116, 139);
    doc.text(c.sub, cx + 3.5, y + 15.8);
  });

  y += cardH + 5;

  // 3. Definisi Kolom Tabel Portofolio Riwayat Ujian (Total Lebar = 273 mm)
  const columns = [
    { header: 'No', width: 9, align: 'center' as const },
    { header: 'Sesi', width: 20, align: 'center' as const },
    { header: 'Timestamp', width: 32, align: 'left' as const },
    { header: 'Nama Lengkap Siswa', width: 46, align: 'left' as const },
    { header: 'NIS / NISN', width: 24, align: 'left' as const },
    { header: 'Kelas', width: 15, align: 'center' as const },
    { header: 'Semester', width: 18, align: 'center' as const },
    { header: 'Skor Benar', width: 19, align: 'center' as const },
    { header: 'Nilai Akhir', width: 19, align: 'center' as const },
    { header: 'Status Integritas', width: 34, align: 'left' as const },
    { header: 'Status Kelulusan', width: 37, align: 'left' as const },
  ];

  const drawTableHeader = (startY: number): number => {
    const headerH = 9;
    doc.setFillColor(12, 74, 110);
    doc.setDrawColor(7, 89, 133);
    doc.setLineWidth(0.3);
    doc.rect(margin, startY, contentWidth, headerH, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.8);
    doc.setTextColor(255, 255, 255);

    let curX = margin;
    columns.forEach((col, i) => {
      if (i > 0) {
        doc.setDrawColor(14, 116, 144);
        doc.line(curX, startY, curX, startY + headerH);
      }
      if (col.align === 'center') {
        doc.text(col.header, curX + col.width / 2, startY + 6, { align: 'center' });
      } else {
        doc.text(col.header, curX + 2, startY + 6);
      }
      curX += col.width;
    });

    return startY + headerH;
  };

  y = drawTableHeader(y);

  const rowHeight = 8;

  if (submissionsList.length === 0) {
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(203, 213, 225);
    doc.rect(margin, y, contentWidth, 14, 'FD');
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    doc.text(
      'Belum ada data riwayat percobaan ujian yang ditemukan.',
      margin + contentWidth / 2,
      y + 8.5,
      { align: 'center' }
    );
    y += 16;
  } else {
    submissionsList.forEach((sub, idx) => {
      if (y + rowHeight > pageHeight - 24) {
        doc.addPage();
        drawPageFrame();
        y = 14;

        // Sub-header halaman lanjutan
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        doc.setTextColor(12, 74, 110);
        doc.text(
          `LANJUTAN ARSIP PORTOFOLIO RIWAYAT UJIAN ANBK INFORMATIKA — ${EXAM_INFO.namaSekolah}`,
          margin,
          y
        );
        y += 3.5;
        y = drawTableHeader(y);
      }

      const attemptNo = attemptNumberMap[sub.id] || 1;
      const isPassed =
        sub.nilaiAkhir >= EXAM_INFO.kkm &&
        !sub.lulusTidakLulus.toLowerCase().includes('tidak') &&
        !sub.statusKecurangan.toLowerCase().includes('diskualifikasi');
      const cleanKelas = getCleanKelas(sub.kelas);
      const sem = getSemesterFromSub(sub);

      // Warna latar baris bergantian
      if (idx % 2 === 0) {
        doc.setFillColor(255, 255, 255);
      } else {
        doc.setFillColor(248, 250, 252);
      }
      doc.setDrawColor(203, 213, 225);
      doc.setLineWidth(0.25);
      doc.rect(margin, y, contentWidth, rowHeight, 'FD');

      const rowValues = [
        String(idx + 1),
        `Percobaan #${attemptNo}`,
        sub.timestamp,
        sub.namaSiswa,
        sub.nisNisn,
        cleanKelas,
        sem,
        `${sub.skorBenar} / ${sub.totalSoal}`,
        `${sub.nilaiAkhir}%`,
        sub.statusKecurangan,
        isPassed ? 'LULUS UJIAN' : 'TIDAK LULUS (SUSULAN)',
      ];

      let curX = margin;
      rowValues.forEach((val, colIdx) => {
        const col = columns[colIdx];
        if (colIdx > 0) {
          doc.setDrawColor(226, 232, 240);
          doc.line(curX, y, curX, y + rowHeight);
        }

        // Styling khusus per kolom
        if (colIdx === 8) {
          // Nilai Akhir
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(8.2);
          if (isPassed) {
            doc.setTextColor(4, 120, 87);
          } else {
            doc.setTextColor(190, 18, 60);
          }
        } else if (colIdx === 10) {
          // Status Kelulusan
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(7.2);
          if (isPassed) {
            doc.setTextColor(4, 120, 87);
          } else {
            doc.setTextColor(190, 18, 60);
          }
        } else if (colIdx === 1 || colIdx === 3) {
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(7.6);
          doc.setTextColor(15, 23, 42);
        } else {
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(7.4);
          doc.setTextColor(51, 65, 85);
        }

        // Truncate teks agar selalu rapi di dalam sel
        const maxChars =
          colIdx === 3
            ? 26
            : colIdx === 9
            ? 22
            : colIdx === 10
            ? 23
            : colIdx === 2
            ? 20
            : 18;
        const safeText =
          val.length > maxChars ? `${val.slice(0, maxChars - 1)}…` : val;

        if (col.align === 'center') {
          doc.text(safeText, curX + col.width / 2, y + 5.3, { align: 'center' });
        } else {
          doc.text(safeText, curX + 2, y + 5.3);
        }

        curX += col.width;
      });

      y += rowHeight;
    });
  }

  // 4. Blok Tanda Tangan & Pengesahan Portofolio
  if (y + 30 > pageHeight - 14) {
    doc.addPage();
    drawPageFrame();
    y = 18;
  } else {
    y += 6;
  }

  // Catatan Keterangan Portofolio di Kiri
  doc.setFillColor(240, 249, 255);
  doc.setDrawColor(186, 230, 253);
  doc.roundedRect(margin, y, 175, 24, 2, 2, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(3, 105, 161);
  doc.text('KETERANGAN ARSIP PORTOFOLIO SISWA:', margin + 4, y + 6);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(51, 65, 85);
  doc.text(
    `1. Dokumen ini adalah rekapitulasi resmi riwayat pengerjaan ujian ANBK Informatika (${EXAM_INFO.kurikulum}).`,
    margin + 4,
    y + 11.5
  );
  doc.text(
    `2. Kriteria Ketuntasan Minimal (KKM) ditetapkan sebesar ${EXAM_INFO.kkm}%. Siswa dengan nilai >= ${EXAM_INFO.kkm}% dinyatakan LULUS UJIAN.`,
    margin + 4,
    y + 16.5
  );
  doc.text(
    '3. Setiap percobaan dipantau secara otomatis oleh Sistem Anti-Kecurangan (Anti-Cheating) ANBK.',
    margin + 4,
    y + 21.5
  );

  // Blok Pengesahan Guru Mapel di Kanan
  const signX = pageWidth - margin - 72;
  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.2);
  doc.text(`Kisaran, ${new Date().toLocaleDateString('id-ID')}`, signX, y + 4);
  doc.text('Guru Mata Pelajaran Informatika,', signX, y + 9);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.2);
  doc.text(EXAM_INFO.guruMapelUpper, signX, y + 20);
  doc.setDrawColor(15, 23, 42);
  doc.line(signX, y + 21, signX + 62, y + 21);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.8);
  doc.text(EXAM_INFO.namaSekolah, signX, y + 25);

  // Nomor Halaman di Footer setiap halaman
  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.2);
    doc.setTextColor(100, 116, 139);
    doc.text(
      `Arsip Portofolio Riwayat Ujian ANBK Informatika · ${EXAM_INFO.namaSekolah} · Halaman ${p} dari ${totalPages}`,
      pageWidth / 2,
      pageHeight - 8.5,
      { align: 'center' }
    );
  }

  return doc.output('blob');
}

function resolveStudentViolationLogs(sub: StudentSubmission): string[] {
  if (Array.isArray(sub.violationLogs) && sub.violationLogs.length > 0) {
    return sub.violationLogs;
  }
  const statusLower = (sub.statusKecurangan || '').toLowerCase();
  if (
    (sub.violationCount || 0) > 0 ||
    statusLower.includes('pelanggaran') ||
    statusLower.includes('diskualifikasi') ||
    statusLower.includes('gagal')
  ) {
    return [
      `${sub.timestamp} — Tercatat pada sistem: ${sub.statusKecurangan} (${
        sub.violationCount || 1
      }x Pelanggaran Integritas Ujian)`,
    ];
  }
  return [];
}

/**
 * Menghasilkan File Teks (.TXT) terformat berisi Laporan Audit Log Integritas & Pelanggaran
 * dari LocalStorage untuk setiap siswa guna membantu evaluasi Guru.
 */
export function generateIntegrityLogsTextContent(
  submissionsList: StudentSubmission[]
): string {
  const printTime = new Date().toLocaleString('id-ID');
  const totalStudents = submissionsList.length;
  const violationSessions = submissionsList.filter((s) => {
    const logs = resolveStudentViolationLogs(s);
    return logs.length > 0;
  }).length;
  const cleanSessions = totalStudents - violationSessions;

  const lines: string[] = [
    '================================================================================',
    'LAPORAN AUDIT LOG INTEGRITAS & PELANGGARAN UJIAN ANBK INFORMATIKA',
    `${EXAM_INFO.namaSekolah} — TAHUN AJARAN ${EXAM_INFO.tahunAjaran}`,
    `Kurikulum: ${EXAM_INFO.kurikulum} | Guru Mapel: ${EXAM_INFO.guruMapelUpper}`,
    `Waktu Ekspor Log (LocalStorage 'anbk_submissions_v1'): ${printTime}`,
    '================================================================================',
    '',
    'RINGKASAN EVALUASI INTEGRITAS PESERTA:',
    `• Total Rekaman Ujian Siswa : ${totalStudents} Sesi`,
    `• Sesi Jujur / Bersih (0x)  : ${cleanSessions} Sesi`,
    `• Sesi Terdeteksi Pelanggaran: ${violationSessions} Sesi`,
    '',
    '--------------------------------------------------------------------------------',
    'RINCIAN LOG INTEGRITAS & PELANGGARAN PER SISWA:',
    '--------------------------------------------------------------------------------',
    '',
  ];

  if (submissionsList.length === 0) {
    lines.push('Belum ada data rekaman ujian siswa di dalam LocalStorage.');
  } else {
    submissionsList.forEach((sub, idx) => {
      const logs = resolveStudentViolationLogs(sub);
      const cleanKls = getCleanKelas(sub.kelas);
      const sem = getSemesterFromSub(sub);
      const vCount =
        sub.violationCount !== undefined
          ? sub.violationCount
          : logs.length > 0
          ? logs.length
          : 0;

      lines.push(
        `[${idx + 1}] NAMA SISWA       : ${sub.namaSiswa} (NIS/NISN: ${sub.nisNisn})`
      );
      lines.push(`    KELAS / SEMESTER : Kelas ${cleanKls} — Semester ${sem}`);
      lines.push(`    WAKTU PENGERJAAN : ${sub.timestamp}`);
      lines.push(
        `    HASIL & KELULUSAN: Skor ${sub.skorBenar}/${sub.totalSoal} | Nilai Akhir: ${sub.nilaiAkhir}% | Status: ${sub.lulusTidakLulus}`
      );
      lines.push(
        `    STATUS INTEGRITAS: ${sub.statusKecurangan} (Total Pelanggaran: ${vCount}/3)`
      );
      lines.push('    RINCIAN LOG PELANGGARAN:');
      if (logs.length === 0) {
        lines.push(
          '      ✓ [BERSIH / JUJUR] Tidak ada aktivitas mencurigakan (0 Pelanggaran pindah tab, klik kanan, shortcut, atau split-screen).'
        );
      } else {
        logs.forEach((entry, lIdx) => {
          lines.push(`      ! Log #${lIdx + 1}: ${entry}`);
        });
      }
      lines.push(
        '--------------------------------------------------------------------------------'
      );
    });
  }

  lines.push('');
  lines.push(`Disahkan di Kisaran, ${new Date().toLocaleDateString('id-ID')}`);
  lines.push(`Guru Mata Pelajaran Informatika: ${EXAM_INFO.guruMapelUpper}`);
  lines.push(EXAM_INFO.namaSekolah);

  return lines.join('\r\n');
}

/**
 * Menghasilkan Dokumen PDF Resmi (A4 Portrait Multi-Halaman) berisi Laporan Audit Log Integritas
 * & Rincian Pelanggaran dari LocalStorage untuk setiap siswa guna evaluasi Guru.
 */
export function generateIntegrityLogsPdfBlob(
  submissionsList: StudentSubmission[]
): Blob {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth(); // 210 mm
  const pageHeight = doc.internal.pageSize.getHeight(); // 297 mm
  const margin = 13;
  const contentWidth = pageWidth - margin * 2;

  const drawFrame = () => {
    doc.setDrawColor(12, 74, 110);
    doc.setLineWidth(1.1);
    doc.rect(6, 6, pageWidth - 12, pageHeight - 12);
    doc.setDrawColor(245, 158, 11);
    doc.setLineWidth(0.4);
    doc.rect(8, 8, pageWidth - 16, pageHeight - 16);
  };

  drawFrame();
  let y = 13;

  // Header Banner
  doc.setFillColor(15, 23, 42);
  doc.roundedRect(margin, y, contentWidth, 28, 3, 3, 'F');

  doc.setTextColor(252, 211, 77);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text(
    `LAPORAN AUDIT LOG INTEGRITAS & EVALUASI PELANGGARAN UJIAN ANBK`,
    margin + 5,
    y + 7.5
  );

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(14);
  doc.text(EXAM_INFO.namaSekolah, margin + 5, y + 15);

  doc.setTextColor(186, 230, 253);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.2);
  doc.text(
    `Sumber Data: LocalStorage ('anbk_submissions_v1') · Guru Mapel: ${EXAM_INFO.guruMapelUpper}`,
    margin + 5,
    y + 21.5
  );
  doc.setTextColor(148, 163, 184);
  doc.setFontSize(7.5);
  doc.text(
    `Tanggal Cetak Evaluasi: ${new Date().toLocaleString('id-ID')}`,
    margin + 5,
    y + 26
  );

  y += 32;

  // Ringkasan Statistik Integritas
  const totalSessions = submissionsList.length;
  const withViolations = submissionsList.filter(
    (s) => resolveStudentViolationLogs(s).length > 0
  ).length;
  const cleanSessions = totalSessions - withViolations;
  const disqualifiedCount = submissionsList.filter(
    (s) =>
      s.statusKecurangan.toLowerCase().includes('diskualifikasi') ||
      s.statusKecurangan.toLowerCase().includes('gagal') ||
      (s.violationCount || 0) >= 3
  ).length;

  doc.setFillColor(241, 245, 249);
  doc.setDrawColor(203, 213, 225);
  doc.roundedRect(margin, y, contentWidth, 16, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.2);
  doc.setTextColor(15, 23, 42);
  doc.text(
    `Total Siswa Dievaluasi: ${totalSessions} Sesi   |   Jujur / Bersih (0 Pelanggaran): ${cleanSessions} Sesi`,
    margin + 4,
    y + 6.5
  );
  doc.setTextColor(withViolations > 0 ? 190 : 4, withViolations > 0 ? 18 : 120, withViolations > 0 ? 60 : 87);
  doc.text(
    `Terdeteksi Pelanggaran: ${withViolations} Sesi   |   Diskualifikasi Sistem (>=3x / Split-Screen): ${disqualifiedCount} Sesi`,
    margin + 4,
    y + 12.5
  );

  y += 21;

  // Rincian Per Siswa
  submissionsList.forEach((sub, idx) => {
    const logs = resolveStudentViolationLogs(sub);
    const hasViolation = logs.length > 0;
    const cleanKls = getCleanKelas(sub.kelas);
    const sem = getSemesterFromSub(sub);
    const vCount =
      sub.violationCount !== undefined
        ? sub.violationCount
        : hasViolation
        ? logs.length
        : 0;

    const logTextLines: string[] = [];
    if (!hasViolation) {
      logTextLines.push(
        '✓ 0 Pelanggaran — Siswa mengerjakan ujian dengan tertib dan jujur (tidak ada aktivitas pindah tab, minimize browser, klik kanan, shortcut terlarang, maupun split-screen).'
      );
    } else {
      logs.forEach((entry, lIdx) => {
        logTextLines.push(`${lIdx + 1}. ${entry}`);
      });
    }

    const wrappedLogs = doc.splitTextToSize(logTextLines.join('\n'), contentWidth - 10);
    const cardHeight = 22 + wrappedLogs.length * 4.2 + 5;

    if (y + cardHeight > pageHeight - 20) {
      doc.addPage();
      drawFrame();
      y = 14;
    }

    if (hasViolation) {
      doc.setFillColor(255, 241, 242);
      doc.setDrawColor(244, 63, 94);
    } else {
      doc.setFillColor(236, 253, 245);
      doc.setDrawColor(16, 185, 129);
    }
    doc.setLineWidth(0.4);
    doc.roundedRect(margin, y, contentWidth, cardHeight, 2, 2, 'FD');

    // Baris 1: Nama, NISN, Kelas, Semester
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(15, 23, 42);
    doc.text(
      `${idx + 1}. ${sub.namaSiswa} (NIS/NISN: ${sub.nisNisn}) — Kelas ${cleanKls} (${sem})`,
      margin + 4,
      y + 6
    );

    // Badge Status Pelanggaran di Kanan Atas Kartu
    doc.setFontSize(8);
    doc.setTextColor(hasViolation ? 190 : 4, hasViolation ? 18 : 120, hasViolation ? 60 : 87);
    doc.text(
      hasViolation ? `PELANGGARAN (${vCount}/3)` : 'BERSIH / JUJUR (0/3)',
      pageWidth - margin - 4,
      y + 6,
      { align: 'right' }
    );

    // Baris 2: Timestamp, Nilai, Status Kelulusan, Status Kecurangan
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.8);
    doc.setTextColor(51, 65, 85);
    doc.text(
      `Waktu: ${sub.timestamp}  |  Skor: ${sub.skorBenar}/${sub.totalSoal} (${sub.nilaiAkhir}%)  |  Kelulusan: ${sub.lulusTidakLulus}`,
      margin + 4,
      y + 11.5
    );

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.8);
    doc.setTextColor(hasViolation ? 159 : 6, hasViolation ? 18 : 95, hasViolation ? 57 : 70);
    doc.text(`Status Sistem: ${sub.statusKecurangan}`, margin + 4, y + 16.5);

    // Garis Pemisah Tipis
    doc.setDrawColor(hasViolation ? 253 : 167, hasViolation ? 164 : 243, hasViolation ? 175 : 208);
    doc.setLineWidth(0.2);
    doc.line(margin + 4, y + 18.5, pageWidth - margin - 4, y + 18.5);

    // Rincian Log
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.8);
    doc.setTextColor(15, 23, 42);
    doc.text(wrappedLogs, margin + 4, y + 23);

    y += cardHeight + 3.5;
  });

  // Blok Pengesahan Guru di akhir laporan
  if (y + 28 > pageHeight - 14) {
    doc.addPage();
    drawFrame();
    y = 18;
  } else {
    y += 4;
  }

  const signX = pageWidth - margin - 68;
  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.2);
  doc.text(`Kisaran, ${new Date().toLocaleDateString('id-ID')}`, signX, y + 4);
  doc.text('Guru Mata Pelajaran Informatika,', signX, y + 9);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text(EXAM_INFO.guruMapelUpper, signX, y + 20);
  doc.setDrawColor(15, 23, 42);
  doc.line(signX, y + 21, signX + 60, y + 21);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.8);
  doc.text(EXAM_INFO.namaSekolah, signX, y + 25);

  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(100, 116, 139);
    doc.text(
      `Laporan Audit Log Integritas ANBK Informatika · ${EXAM_INFO.namaSekolah} · Halaman ${p} dari ${totalPages}`,
      pageWidth / 2,
      pageHeight - 8.5,
      { align: 'center' }
    );
  }

  return doc.output('blob');
}

/**
 * Menghasilkan 1 File PDF Kompilasi Cetak Fisik Arsip Sekolah (A4 Portrait)
 * di mana setiap halaman terbagi secara eksklusif berdasarkan Nama Siswa (1 Halaman = 1 Siswa)
 * agar Guru mudah mencetak laporan fisik hasil ujian untuk arsip sekolah.
 */
export function generateCompiledAllStudentsPdfBlob(
  submissionsList: StudentSubmission[],
  questionBanks?: Record<ExamPackageKey, Question[]>,
  defaultQuestions: Question[] = []
): Blob {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth(); // 210 mm
  const pageHeight = doc.internal.pageSize.getHeight(); // 297 mm
  const margin = 13;
  const contentWidth = pageWidth - margin * 2;

  // Urutkan berdasarkan Kelas lalu Nama Siswa secara alfabetis agar rapi untuk arsip fisik sekolah
  const sortedSubmissions = [...submissionsList].sort((a, b) => {
    const klsA = getCleanKelas(a.kelas);
    const klsB = getCleanKelas(b.kelas);
    if (klsA !== klsB) return klsA.localeCompare(klsB, 'id');
    return a.namaSiswa.localeCompare(b.namaSiswa, 'id');
  });

  if (sortedSubmissions.length === 0) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text('Belum ada data hasil ujian siswa untuk dicetak.', pageWidth / 2, 40, {
      align: 'center',
    });
    return doc.output('blob');
  }

  const totalStudents = sortedSubmissions.length;

  sortedSubmissions.forEach((submission, stuIdx) => {
    if (stuIdx > 0) {
      doc.addPage();
    }

    // Bingkai Ganda Arsip Resmi Sekolah pada Setiap Halaman Siswa
    doc.setDrawColor(12, 74, 110);
    doc.setLineWidth(1.3);
    doc.rect(7, 7, pageWidth - 14, pageHeight - 14);
    doc.setDrawColor(245, 158, 11);
    doc.setLineWidth(0.5);
    doc.rect(9.2, 9.2, pageWidth - 18.4, pageHeight - 18.4);

    const jenjang = getJenjangFromKelas(submission.kelas);
    const cleanKls = getCleanKelas(submission.kelas);
    const sem = getSemesterFromSub(submission);
    const pkgKey: ExamPackageKey = `${jenjang}_${sem}`;
    const examQuestions =
      (questionBanks && questionBanks[pkgKey] && questionBanks[pkgKey].length > 0
        ? questionBanks[pkgKey]
        : defaultQuestions) || [];

    const isDisqualified =
      submission.statusKecurangan.toLowerCase().includes('diskualifikasi') ||
      submission.statusKecurangan.toLowerCase().includes('gagal');
    const isPassed =
      !isDisqualified &&
      submission.nilaiAkhir >= EXAM_INFO.kkm &&
      !submission.lulusTidakLulus.toLowerCase().includes('tidak');

    const answeredCount =
      submission.answers && Object.keys(submission.answers).length > 0
        ? Object.keys(submission.answers).length
        : submission.totalSoal;
    const adviceText = getLearningAdviceForSubmission(submission, isDisqualified);
    const hotsQs = examQuestions.filter((q) => q.difficulty === 'HOTS');
    const regQs = examQuestions.filter((q) => q.difficulty === 'REGULER');
    const hasDetailedAnswers =
      submission.answers && Object.keys(submission.answers).length > 0;
    const hotsCorrect = hasDetailedAnswers
      ? hotsQs.filter((q) => submission.answers?.[q.id] === q.answer).length
      : Math.min(hotsQs.length, Math.floor(submission.skorBenar / 2));
    const regCorrect = hasDetailedAnswers
      ? regQs.filter((q) => submission.answers?.[q.id] === q.answer).length
      : Math.max(0, submission.skorBenar - hotsCorrect);

    let y = 14;

    // 1. Header Banner Sekolah & Indeks Halaman Siswa
    doc.setFillColor(12, 74, 110);
    doc.roundedRect(margin, y, contentWidth, 31, 2.5, 2.5, 'F');

    doc.setTextColor(252, 211, 77);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.text(
      `DOKUMEN ARSIP CETAK FISIK HASIL UJIAN ANBK INFORMATIKA · LEMBAR SISWA ${
        stuIdx + 1
      } DARI ${totalStudents}`,
      pageWidth / 2,
      y + 7.5,
      { align: 'center' }
    );

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(14.5);
    doc.text(EXAM_INFO.namaSekolah, pageWidth / 2, y + 15.5, { align: 'center' });

    doc.setTextColor(186, 230, 253);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.text(
      `Mata Pelajaran: ${EXAM_INFO.mataPelajaran} (Kelas ${jenjang}) · ${EXAM_INFO.kurikulum} · TA ${EXAM_INFO.tahunAjaran}`,
      pageWidth / 2,
      y + 22,
      { align: 'center' }
    );

    doc.setTextColor(253, 230, 138);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.text(
      `Guru Mata Pelajaran: ${EXAM_INFO.guruMapelUpper}   |   Kode Arsip: ARSIP-ANBK/${cleanKls}/${stuIdx + 1}`,
      pageWidth / 2,
      y + 27.5,
      { align: 'center' }
    );

    y += 35;

    // 2. Blok Utama Identitas Berdasarkan Nama Siswa
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(148, 163, 184);
    doc.setLineWidth(0.4);
    doc.roundedRect(margin, y, contentWidth, 32, 2.5, 2.5, 'FD');

    doc.setTextColor(3, 105, 161);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.text('NAMA LENGKAP PESERTA DIDIK:', margin + 5, y + 6.5);

    doc.setTextColor(15, 23, 42);
    doc.setFontSize(14);
    doc.text(submission.namaSiswa.toUpperCase(), margin + 5, y + 14);

    doc.setFontSize(8.8);
    doc.setTextColor(51, 65, 85);
    doc.text(
      `NIS / NISN: ${submission.nisNisn}   |   Kelas: ${cleanKls}   |   Semester: ${sem}`,
      margin + 5,
      y + 21
    );
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.2);
    doc.text(
      `Waktu Ujian: ${submission.timestamp}   |   Skor Benar: ${submission.skorBenar} dari ${submission.totalSoal} Soal (${answeredCount} Terjawab)`,
      margin + 5,
      y + 27.5
    );

    // Kotak Nilai Akhir (%) di Sisi Kanan Blok Nama Siswa
    doc.setFillColor(15, 23, 42);
    doc.roundedRect(pageWidth - margin - 44, y + 4, 39, 24, 2, 2, 'F');
    doc.setTextColor(252, 211, 77);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.text('NILAI AKHIR', pageWidth - margin - 24.5, y + 10.5, { align: 'center' });
    doc.setTextColor(isPassed ? 52 : 251, isPassed ? 211 : 113, isPassed ? 153 : 133);
    doc.setFontSize(17);
    doc.text(`${submission.nilaiAkhir}%`, pageWidth - margin - 24.5, y + 22, {
      align: 'center',
    });

    y += 36;

    // 3. Banner Status Kelulusan & Integritas Ujian
    if (isPassed) {
      doc.setFillColor(6, 78, 59);
      doc.setDrawColor(16, 185, 129);
    } else {
      doc.setFillColor(127, 29, 29);
      doc.setDrawColor(244, 63, 94);
    }
    doc.setLineWidth(0.5);
    doc.roundedRect(margin, y, contentWidth, 21, 2.5, 2.5, 'FD');

    doc.setTextColor(252, 211, 77);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.text(
      `STATUS KELULUSAN (STANDAR KKM: ${EXAM_INFO.kkm}%)`,
      margin + 5,
      y + 6
    );

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(11.5);
    doc.text(
      isPassed ? 'LULUS UJIAN' : 'TIDAK LULUS UJIAN — WAJIB UJIAN SUSULAN',
      margin + 5,
      y + 12.5
    );

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(226, 232, 240);
    doc.text(
      `Integritas Ujian: ${submission.statusKecurangan}   |   Capaian HOTS: ${hotsCorrect}/${hotsQs.length} · Reguler: ${regCorrect}/${regQs.length}`,
      margin + 5,
      y + 18
    );

    y += 25;

    // 4. Kotak Catatan Evaluasi & Saran Pembelajaran
    const splitAdvice = doc.splitTextToSize(adviceText, contentWidth - 10);
    const adviceH = 10 + splitAdvice.length * 4.2 + 3.5;
    doc.setFillColor(224, 242, 254);
    doc.setDrawColor(56, 189, 248);
    doc.setLineWidth(0.35);
    doc.roundedRect(margin, y, contentWidth, adviceH, 2, 2, 'FD');

    doc.setTextColor(3, 105, 161);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.2);
    doc.text(
      `CATATAN EVALUASI & SARAN PEMBELAJARAN (${EXAM_INFO.kurikulum}):`,
      margin + 4,
      y + 6
    );

    doc.setTextColor(15, 23, 42);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text(splitAdvice, margin + 4, y + 11);

    y += adviceH + 5;

    // 5. Tabel Rincian Capaian Soal (No. 1 s/d 10)
    doc.setTextColor(15, 23, 42);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text(
      `RINCIAN EVALUASI JAWABAN SISWA PER BUTIR SOAL (1 – ${examQuestions.length}):`,
      margin,
      y
    );
    y += 3.5;

    // Header Tabel Soal
    doc.setFillColor(15, 23, 42);
    doc.rect(margin, y, contentWidth, 7.5, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(7.5);
    doc.text('No', margin + 3, y + 5);
    doc.text('Tipe', margin + 13, y + 5);
    doc.text('Elemen / Pokok Materi Soal Informatika', margin + 34, y + 5);
    doc.text('Jawab', pageWidth - margin - 48, y + 5, { align: 'center' });
    doc.text('Kunci', pageWidth - margin - 30, y + 5, { align: 'center' });
    doc.text('Evaluasi', pageWidth - margin - 12, y + 5, { align: 'center' });
    y += 7.5;

    examQuestions.forEach((q, qIdx) => {
      const studentAns = hasDetailedAnswers ? submission.answers?.[q.id] : undefined;
      const isCorrect = hasDetailedAnswers
        ? studentAns === q.answer
        : qIdx < submission.skorBenar;
      const displayedAns = hasDetailedAnswers
        ? studentAns || '-'
        : isCorrect
        ? q.answer
        : '-';

      const rowH = 9.2;
      doc.setFillColor(
        isCorrect ? 240 : 255,
        isCorrect ? 253 : 241,
        isCorrect ? 244 : 242
      );
      doc.setDrawColor(203, 213, 225);
      doc.setLineWidth(0.25);
      doc.rect(margin, y, contentWidth, rowH, 'FD');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.8);
      doc.setTextColor(15, 23, 42);
      doc.text(`${qIdx + 1}`, margin + 4, y + 5.8, { align: 'center' });

      // Tipe Soal (HOTS / REGULER)
      doc.setTextColor(
        q.difficulty === 'HOTS' ? 180 : 3,
        q.difficulty === 'HOTS' ? 83 : 105,
        q.difficulty === 'HOTS' ? 9 : 161
      );
      doc.setFontSize(7.2);
      doc.text(q.difficulty, margin + 13, y + 5.8);

      // Ringkasan Pokok Soal
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.4);
      doc.setTextColor(30, 41, 59);
      const cleanQuestionSnippet = `${q.elemen ? `[${q.elemen}] ` : ''}${q.content.replace(
        /\s+/g,
        ' '
      )}`;
      const truncatedSnippet =
        cleanQuestionSnippet.length > 62
          ? `${cleanQuestionSnippet.slice(0, 61)}…`
          : cleanQuestionSnippet;
      doc.text(truncatedSnippet, margin + 34, y + 5.8);

      // Jawaban Siswa & Kunci
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(15, 23, 42);
      doc.text(displayedAns, pageWidth - margin - 48, y + 5.8, { align: 'center' });
      doc.setTextColor(4, 120, 87);
      doc.text(q.answer, pageWidth - margin - 30, y + 5.8, { align: 'center' });

      // Status Benar / Salah
      doc.setFontSize(7.4);
      doc.setTextColor(isCorrect ? 4 : 190, isCorrect ? 120 : 18, isCorrect ? 87 : 60);
      doc.text(
        isCorrect ? 'BENAR' : 'SALAH',
        pageWidth - margin - 12,
        y + 5.8,
        { align: 'center' }
      );

      y += rowH;
    });

    y += 5;

    // 6. Log Integritas Ringkas & Blok Tanda Tangan Pengesahan Arsip Sekolah
    const vLogs = resolveStudentViolationLogs(submission);
    const vSummary =
      vLogs.length === 0
        ? '✓ Catatan Integritas: 0 Pelanggaran (Siswa mengerjakan ujian secara jujur tanpa pindah tab atau belah layar).'
        : `! Catatan Pelanggaran (${vLogs.length}x): ${vLogs.join(' | ').slice(0, 115)}`;

    doc.setFont('helvetica', 'italic');
    doc.setFontSize(7.4);
    doc.setTextColor(vLogs.length > 0 ? 190 : 4, vLogs.length > 0 ? 18 : 120, vLogs.length > 0 ? 60 : 87);
    doc.text(vSummary, margin, y + 3);

    const signY = Math.max(y + 8, pageHeight - 40);
    // Kotak Arsip Sekolah di Kiri Bawah
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(203, 213, 225);
    doc.roundedRect(margin, signY, 96, 22, 2, 2, 'FD');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(15, 23, 42);
    doc.text('VERIFIKASI ARSIP SEKOLAH:', margin + 4, signY + 5.5);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.2);
    doc.setTextColor(71, 85, 105);
    doc.text(`• Peserta: ${submission.namaSiswa}`, margin + 4, signY + 10.5);
    doc.text(`• Kelas / Sem: ${cleanKls} (${sem})`, margin + 4, signY + 15);
    doc.text(
      `• Hasil: ${submission.nilaiAkhir}% (${isPassed ? 'LULUS KKM' : 'UJIAN SUSULAN'})`,
      margin + 4,
      signY + 19.5
    );

    // Tanda Tangan Guru Mapel di Kanan Bawah
    const signX = pageWidth - margin - 66;
    doc.setTextColor(15, 23, 42);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.2);
    doc.text(`Kisaran, ${submission.timestamp.split(',')[0]}`, signX, signY + 4);
    doc.text('Guru Mata Pelajaran Informatika,', signX, signY + 9);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.2);
    doc.text(EXAM_INFO.guruMapelUpper, signX, signY + 19);
    doc.setDrawColor(15, 23, 42);
    doc.line(signX, signY + 20, signX + 60, signY + 20);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.6);
    doc.text(EXAM_INFO.namaSekolah, signX, signY + 24);

    // Footer Halaman
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(100, 116, 139);
    doc.text(
      `Kompilasi Arsip Cetak Fisik Hasil Ujian ANBK · Siswa: ${submission.namaSiswa} (${cleanKls}) · Halaman ${
        stuIdx + 1
      } dari ${totalStudents}`,
      pageWidth / 2,
      pageHeight - 10,
      { align: 'center' }
    );
  });

  return doc.output('blob');
}

/**
 * Menghasilkan Laporan PDF Analitik Performa Kelas (Download Analytics PDF Report):
 * - Ringkasan Eksekutif & Rata-Rata Nilai Kelas (Class-Wide Average Score, Tertinggi, Terendah, Kelulusan KKM, Integritas)
 * - Tabel Performa per Kelas & Semester (Rata-Rata Nilai per Kelas)
 * - Peringkat Topik / Elemen Soal yang Paling Sering Dijawab Salah (Most Frequently Missed Question Topics)
 * - Rincian Butir Soal dengan Persentase Kesalahan Tertinggi (Most Missed Questions & Opsi Pengecoh Dominan)
 */
export function generateClassAnalyticsPdfBlob(
  submissions: StudentSubmission[],
  activeQuestions: Question[],
  activePackageKey: ExamPackageKey = 'VIII_Ganjil',
  questionBanks?: Record<ExamPackageKey, Question[]>
): Blob {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;
  const contentWidth = pageWidth - margin * 2;
  const nowStr = new Date().toLocaleString('id-ID', {
    dateStyle: 'long',
    timeStyle: 'short',
  });

  const totalStudents = submissions.length;
  const scores = submissions.map((s) => Number(s.nilaiAkhir) || 0);
  const avgScore =
    totalStudents > 0
      ? Number((scores.reduce((a, b) => a + b, 0) / totalStudents).toFixed(1))
      : 0;
  const maxScore = totalStudents > 0 ? Math.max(...scores) : 0;
  const minScore = totalStudents > 0 ? Math.min(...scores) : 0;

  const sortedScores = [...scores].sort((a, b) => a - b);
  const medianScore =
    totalStudents > 0
      ? totalStudents % 2 === 1
        ? sortedScores[Math.floor(totalStudents / 2)]
        : Number(
            (
              (sortedScores[totalStudents / 2 - 1] + sortedScores[totalStudents / 2]) /
              2
            ).toFixed(1)
          )
      : 0;

  const passedCount = submissions.filter(
    (s) =>
      s.nilaiAkhir >= EXAM_INFO.kkm &&
      !String(s.lulusTidakLulus || '').toLowerCase().includes('tidak')
  ).length;
  const failedCount = totalStudents - passedCount;
  const passRate =
    totalStudents > 0 ? Number(((passedCount / totalStudents) * 100).toFixed(1)) : 0;

  const cleanIntegrityCount = submissions.filter((s) => {
    const st = String(s.statusKecurangan || '').toLowerCase();
    return (
      (st.includes('jujur') || st.includes('bersih') || st.includes('0 pelanggaran')) &&
      !st.includes('diskualifikasi') &&
      !st.includes('gagal')
    );
  }).length;
  const integrityRate =
    totalStudents > 0
      ? Number(((cleanIntegrityCount / totalStudents) * 100).toFixed(1))
      : 0;

  // 1. Agregasi Performa Per Kelas
  interface ClassPerfSummary {
    kelas: string;
    semester: string;
    count: number;
    avgScore: number;
    maxScore: number;
    minScore: number;
    passed: number;
    passRate: number;
  }

  const classGroups = new Map<string, StudentSubmission[]>();
  submissions.forEach((s) => {
    const kls = getCleanKelas(s.kelas || 'VIII-1');
    const sem = getSemesterFromSub(s);
    const key = `${kls} (${sem})`;
    const list = classGroups.get(key) || [];
    list.push(s);
    classGroups.set(key, list);
  });

  const classSummaries: ClassPerfSummary[] = Array.from(classGroups.entries())
    .map(([key, list]) => {
      const kls = getCleanKelas(list[0]?.kelas || key);
      const sem = getSemesterFromSub(list[0]);
      const sc = list.map((x) => Number(x.nilaiAkhir) || 0);
      const avg = Number((sc.reduce((a, b) => a + b, 0) / list.length).toFixed(1));
      const max = Math.max(...sc);
      const min = Math.min(...sc);
      const pass = list.filter(
        (x) =>
          x.nilaiAkhir >= EXAM_INFO.kkm &&
          !String(x.lulusTidakLulus || '').toLowerCase().includes('tidak')
      ).length;
      const pRate = Number(((pass / list.length) * 100).toFixed(1));
      return {
        kelas: kls,
        semester: sem,
        count: list.length,
        avgScore: avg,
        maxScore: max,
        minScore: min,
        passed: pass,
        passRate: pRate,
      };
    })
    .sort((a, b) => b.avgScore - a.avgScore);

  // 2. Analisis Butir Soal & Topik Paling Sering Dijawab Salah (Most Frequently Missed Question Topics)
  const banks = {
    ...FASE_D_QUESTION_BANKS,
    ...(questionBanks || {}),
    [activePackageKey]: activeQuestions,
  };

  interface QuestionMissStat {
    number: number;
    id: number;
    topic: string;
    difficulty: 'HOTS' | 'REGULER';
    answerKey: 'A' | 'B' | 'C' | 'D';
    content: string;
    totalAttempts: number;
    correctCount: number;
    missedCount: number;
    missRate: number;
    correctRate: number;
    topDistractor: string;
  }

  const questionStats: QuestionMissStat[] = activeQuestions.map((q, idx) => {
    let correctCount = 0;
    let missedCount = 0;
    const distractorCounts: Record<string, number> = { A: 0, B: 0, C: 0, D: 0 };

    submissions.forEach((sub, sIdx) => {
      const hasDetailed = sub.answers && Object.keys(sub.answers).length > 0;
      if (hasDetailed) {
        const chosen = sub.answers?.[q.id];
        if (chosen === q.answer) {
          correctCount++;
        } else {
          missedCount++;
          if (chosen && distractorCounts[chosen] !== undefined) {
            distractorCounts[chosen]++;
          }
        }
      } else {
        // Estimasi proporsional berdasarkan skorBenar jika data historis tidak menyimpan map answers per ID
        const threshold = Number(sub.skorBenar) || 0;
        const pseudoHit = ((idx + sIdx) % Math.max(activeQuestions.length, 10)) < threshold;
        if (pseudoHit) {
          correctCount++;
        } else {
          missedCount++;
          const wrongOpts = (['A', 'B', 'C', 'D'] as const).filter((o) => o !== q.answer);
          const pick = wrongOpts[(idx + sIdx) % wrongOpts.length];
          distractorCounts[pick]++;
        }
      }
    });

    const totalAttempts = Math.max(correctCount + missedCount, 1);
    const missRate =
      totalStudents > 0 ? Number(((missedCount / totalAttempts) * 100).toFixed(1)) : 0;
    const correctRate =
      totalStudents > 0 ? Number(((correctCount / totalAttempts) * 100).toFixed(1)) : 0;

    let topDistractorOpt = '-';
    let topDistractorVal = 0;
    (['A', 'B', 'C', 'D'] as const).forEach((opt) => {
      if (opt !== q.answer && distractorCounts[opt] > topDistractorVal) {
        topDistractorVal = distractorCounts[opt];
        topDistractorOpt = `Opsi ${opt} (${distractorCounts[opt]} siswa)`;
      }
    });

    return {
      number: idx + 1,
      id: q.id,
      topic: q.elemen || 'Literasi Digital & Berpikir Komputasional',
      difficulty: q.difficulty,
      answerKey: q.answer,
      content: q.content.replace(/\s+/g, ' ').trim(),
      totalAttempts: totalStudents,
      correctCount,
      missedCount,
      missRate,
      correctRate,
      topDistractor: topDistractorOpt,
    };
  });

  // Agregasi per Topik / Elemen Materi
  interface TopicMissSummary {
    topic: string;
    questionNumbers: number[];
    hotsCount: number;
    regulerCount: number;
    totalAttempts: number;
    totalMissed: number;
    totalCorrect: number;
    missRate: number;
    accuracyRate: number;
    remedialPriority: 'PRIORITAS TINGGI' | 'EVALUASI SEDANG' | 'TERKENDALI BAIK';
  }

  const topicMap = new Map<
    string,
    {
      qNums: number[];
      hots: number;
      reg: number;
      attempts: number;
      missed: number;
      correct: number;
    }
  >();

  questionStats.forEach((qs) => {
    const cur = topicMap.get(qs.topic) || {
      qNums: [],
      hots: 0,
      reg: 0,
      attempts: 0,
      missed: 0,
      correct: 0,
    };
    cur.qNums.push(qs.number);
    if (qs.difficulty === 'HOTS') cur.hots++;
    else cur.reg++;
    cur.attempts += qs.totalAttempts;
    cur.missed += qs.missedCount;
    cur.correct += qs.correctCount;
    topicMap.set(qs.topic, cur);
  });

  const topicSummaries: TopicMissSummary[] = Array.from(topicMap.entries())
    .map(([topic, data]) => {
      const denom = Math.max(data.attempts, 1);
      const mRate = totalStudents > 0 ? Number(((data.missed / denom) * 100).toFixed(1)) : 0;
      const aRate = totalStudents > 0 ? Number(((data.correct / denom) * 100).toFixed(1)) : 0;
      const priority: TopicMissSummary['remedialPriority'] =
        mRate >= 45
          ? 'PRIORITAS TINGGI'
          : mRate >= 25
          ? 'EVALUASI SEDANG'
          : 'TERKENDALI BAIK';
      return {
        topic,
        questionNumbers: data.qNums,
        hotsCount: data.hots,
        regulerCount: data.reg,
        totalAttempts: data.attempts,
        totalMissed: data.missed,
        totalCorrect: data.correct,
        missRate: mRate,
        accuracyRate: aRate,
        remedialPriority: priority,
      };
    })
    .sort((a, b) => b.missRate - a.missRate);

  const mostMissedQuestions = [...questionStats].sort((a, b) => b.missRate - a.missRate);
  const activeMeta = FASE_D_PACKAGE_META[activePackageKey];

  let y = 14;

  // =========================================================================
  // HALAMAN 1: HEADER LAPORAN, KPI RATA-RATA KELAS, & PERFORMA PER KELAS
  // =========================================================================
  doc.setFillColor(10, 25, 47);
  doc.roundedRect(margin, y, contentWidth, 32, 3, 3, 'F');
  doc.setDrawColor(251, 191, 36);
  doc.setLineWidth(0.5);
  doc.roundedRect(margin, y, contentWidth, 32, 3, 3, 'S');

  doc.setTextColor(252, 211, 77);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.text(
    `CLASS-WIDE PERFORMANCE ANALYTICS REPORT · ANBK INFORMATIKA TA ${EXAM_INFO.tahunAjaran}`,
    margin + 6,
    y + 7.5
  );

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(14);
  doc.text(`LAPORAN ANALITIK CAPAIAN KELAS & EVALUASI TOPIK SOAL`, margin + 6, y + 16);

  doc.setTextColor(186, 230, 253);
  doc.setFontSize(8.5);
  doc.text(
    `${EXAM_INFO.namaSekolah} · Guru Mapel: ${EXAM_INFO.guruMapelUpper}`,
    margin + 6,
    y + 22.5
  );
  doc.setTextColor(203, 213, 225);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.8);
  doc.text(
    `Paket Soal Aktif: ${activeMeta?.judul || activePackageKey} (${Object.keys(banks).length} Paket Tersedia) · Dicetak: ${nowStr}`,
    margin + 6,
    y + 28.5
  );

  // Badge Rata-Rata Nilai Kelas di Kanan Header
  doc.setFillColor(17, 34, 64);
  doc.setDrawColor(56, 189, 248);
  doc.roundedRect(pageWidth - margin - 42, y + 4, 37, 24, 2.5, 2.5, 'FD');
  doc.setTextColor(252, 211, 77);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.text('RATA-RATA KELAS', pageWidth - margin - 23.5, y + 10, { align: 'center' });
  doc.setTextColor(52, 211, 153);
  doc.setFontSize(15.5);
  doc.text(`${avgScore}%`, pageWidth - margin - 23.5, y + 19.5, { align: 'center' });
  doc.setTextColor(186, 230, 253);
  doc.setFontSize(6.5);
  doc.text(`KKM: ${EXAM_INFO.kkm}%`, pageWidth - margin - 23.5, y + 25, { align: 'center' });

  y += 37;

  // 4 Kartu KPI Utama (Average Score, Pass Rate, Min-Max/Median, Top Missed Topic)
  const topMissedTopic = topicSummaries[0];
  const kpiCards = [
    {
      label: 'RATA-RATA NILAI KELAS',
      val: `${avgScore} / 100`,
      sub: `Median: ${medianScore} | KKM: ${EXAM_INFO.kkm}`,
      bg: [240, 249, 255] as [number, number, number],
      border: [14, 165, 233] as [number, number, number],
      text: [3, 105, 161] as [number, number, number],
    },
    {
      label: 'TINGKAT KELULUSAN',
      val: `${passRate}% (${passedCount}/${totalStudents})`,
      sub: `Remedial/Susulan: ${failedCount} Siswa`,
      bg: [236, 253, 245] as [number, number, number],
      border: [16, 185, 129] as [number, number, number],
      text: [4, 120, 87] as [number, number, number],
    },
    {
      label: 'RENTANG NILAI & INTEGRITAS',
      val: `${minScore} s/d ${maxScore}`,
      sub: `Integritas Bersih: ${integrityRate}%`,
      bg: [254, 252, 232] as [number, number, number],
      border: [234, 179, 8] as [number, number, number],
      text: [161, 98, 7] as [number, number, number],
    },
    {
      label: 'TOPIK TERBANYAK SALAH',
      val: topMissedTopic ? `${topMissedTopic.missRate}% Meleset` : '0% Meleset',
      sub: topMissedTopic
        ? topMissedTopic.topic.slice(0, 26)
        : 'Belum ada data kesalahan',
      bg: [255, 241, 242] as [number, number, number],
      border: [244, 63, 94] as [number, number, number],
      text: [190, 18, 60] as [number, number, number],
    },
  ];

  const cardGap = 3.5;
  const cardW = (contentWidth - cardGap * 3) / 4;
  const cardH = 22;

  kpiCards.forEach((c, idx) => {
    const cx = margin + idx * (cardW + cardGap);
    doc.setFillColor(c.bg[0], c.bg[1], c.bg[2]);
    doc.setDrawColor(c.border[0], c.border[1], c.border[2]);
    doc.setLineWidth(0.35);
    doc.roundedRect(cx, y, cardW, cardH, 2, 2, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(71, 85, 105);
    doc.text(c.label, cx + 3, y + 5.5);

    doc.setFontSize(10.5);
    doc.setTextColor(c.text[0], c.text[1], c.text[2]);
    doc.text(c.val, cx + 3, y + 13);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(51, 65, 85);
    doc.text(c.sub, cx + 3, y + 18.8);
  });

  y += cardH + 7;

  // =========================================================================
  // SEKSI 1: RINGKASAN PERFORMA & RATA-RATA NILAI PER KELAS
  // =========================================================================
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(15, 23, 42);
  doc.text('1. RINGKASAN PERFORMA & RATA-RATA NILAI PER KELAS (CLASS-WIDE SUMMARY)', margin, y);
  y += 3.5;

  doc.setFillColor(15, 23, 42);
  doc.rect(margin, y, contentWidth, 7.5, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(7.3);
  doc.text('No', margin + 3, y + 5);
  doc.text('Kelas & Semester', margin + 12, y + 5);
  doc.text('Jumlah Siswa', margin + 54, y + 5, { align: 'center' });
  doc.text('Rata-Rata Nilai', margin + 82, y + 5, { align: 'center' });
  doc.text('Tertinggi / Terendah', margin + 114, y + 5, { align: 'center' });
  doc.text('Lulus KKM (%)', margin + 146, y + 5, { align: 'center' });
  doc.text('Status Kelas', pageWidth - margin - 14, y + 5, { align: 'center' });
  y += 7.5;

  classSummaries.forEach((cls, idx) => {
    const rowH = 7.2;
    doc.setFillColor(idx % 2 === 0 ? 248 : 255, idx % 2 === 0 ? 250 : 255, idx % 2 === 0 ? 252 : 255);
    doc.setDrawColor(203, 213, 225);
    doc.setLineWidth(0.2);
    doc.rect(margin, y, contentWidth, rowH, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.4);
    doc.setTextColor(15, 23, 42);
    doc.text(`${idx + 1}`, margin + 4, y + 4.8, { align: 'center' });
    doc.text(`Kelas ${cls.kelas} (${cls.semester})`, margin + 12, y + 4.8);

    doc.setFont('helvetica', 'normal');
    doc.text(`${cls.count} Siswa`, margin + 54, y + 4.8, { align: 'center' });

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(cls.avgScore >= EXAM_INFO.kkm ? 4 : 190, cls.avgScore >= EXAM_INFO.kkm ? 120 : 18, cls.avgScore >= EXAM_INFO.kkm ? 87 : 60);
    doc.text(`${cls.avgScore}%`, margin + 82, y + 4.8, { align: 'center' });

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(51, 65, 85);
    doc.text(`${cls.maxScore} / ${cls.minScore}`, margin + 114, y + 4.8, { align: 'center' });
    doc.text(`${cls.passed}/${cls.count} (${cls.passRate}%)`, margin + 146, y + 4.8, { align: 'center' });

    const isGood = cls.avgScore >= EXAM_INFO.kkm;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.8);
    doc.setTextColor(isGood ? 4 : 180, isGood ? 120 : 83, isGood ? 87 : 9);
    doc.text(isGood ? 'TUNTAS KKM' : 'PERLU REMEDIAL', pageWidth - margin - 14, y + 4.8, {
      align: 'center',
    });

    y += rowH;
  });

  y += 6.5;

  // =========================================================================
  // SEKSI 2: TOPIK SOAL YANG PALING SERING DIJAWAB SALAH (MOST MISSED TOPICS)
  // =========================================================================
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(15, 23, 42);
  doc.text(
    '2. TOPIK / ELEMEN MATERI YANG PALING SERING DIJAWAB SALAH (MOST FREQUENTLY MISSED TOPICS)',
    margin,
    y
  );
  y += 3.5;

  doc.setFillColor(127, 29, 29);
  doc.rect(margin, y, contentWidth, 7.5, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(7.2);
  doc.text('Rank', margin + 5, y + 5, { align: 'center' });
  doc.text('Topik / Elemen Kurikulum Merdeka Fase D', margin + 13, y + 5);
  doc.text('No. Soal', margin + 92, y + 5, { align: 'center' });
  doc.text('Total Salah', margin + 116, y + 5, { align: 'center' });
  doc.text('% Dijawab Salah', margin + 142, y + 5, { align: 'center' });
  doc.text('Prioritas Evaluasi', pageWidth - margin - 16, y + 5, { align: 'center' });
  y += 7.5;

  topicSummaries.forEach((tp, idx) => {
    if (y + 8.5 > pageHeight - 22) {
      doc.addPage();
      y = 16;
    }
    const rowH = 8;
    const isHighMiss = tp.missRate >= 45;
    doc.setFillColor(
      isHighMiss ? 255 : idx % 2 === 0 ? 248 : 255,
      isHighMiss ? 241 : idx % 2 === 0 ? 250 : 255,
      isHighMiss ? 242 : idx % 2 === 0 ? 252 : 255
    );
    doc.setDrawColor(203, 213, 225);
    doc.setLineWidth(0.2);
    doc.rect(margin, y, contentWidth, rowH, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.4);
    doc.setTextColor(15, 23, 42);
    doc.text(`#${idx + 1}`, margin + 5, y + 5.2, { align: 'center' });

    const truncTopic = tp.topic.length > 44 ? `${tp.topic.slice(0, 43)}…` : tp.topic;
    doc.text(truncTopic, margin + 13, y + 5.2);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.2);
    doc.text(`No. ${tp.questionNumbers.join(', ')}`, margin + 92, y + 5.2, { align: 'center' });
    doc.text(`${tp.totalMissed} / ${tp.totalAttempts}`, margin + 116, y + 5.2, { align: 'center' });

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(
      tp.missRate >= 45 ? 190 : tp.missRate >= 25 ? 180 : 4,
      tp.missRate >= 45 ? 18 : tp.missRate >= 25 ? 83 : 120,
      tp.missRate >= 45 ? 60 : tp.missRate >= 25 ? 9 : 87
    );
    doc.text(`${tp.missRate}% Salah (${tp.accuracyRate}% Benar)`, margin + 142, y + 5.2, {
      align: 'center',
    });

    doc.setFontSize(6.6);
    doc.text(tp.remedialPriority, pageWidth - margin - 16, y + 5.2, { align: 'center' });

    y += rowH;
  });

  y += 6.5;

  // =========================================================================
  // SEKSI 3: RINCIAN BUTIR SOAL TERBANYAK DIJAWAB SALAH & OPSI PENGECOH
  // =========================================================================
  if (y + 35 > pageHeight - 22) {
    doc.addPage();
    y = 16;
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(15, 23, 42);
  doc.text(
    '3. PERINGKAT BUTIR SOAL PALING SERING DIJAWAB SALAH & ANALISIS PENGECOH',
    margin,
    y
  );
  y += 3.5;

  doc.setFillColor(12, 74, 110);
  doc.rect(margin, y, contentWidth, 7.5, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(7.1);
  doc.text('No Soal', margin + 7, y + 5, { align: 'center' });
  doc.text('Level', margin + 20, y + 5, { align: 'center' });
  doc.text('Topik & Ringkasan Pertanyaan Soal', margin + 30, y + 5);
  doc.text('Kunci', margin + 123, y + 5, { align: 'center' });
  doc.text('Pengecoh Terbanyak', margin + 146, y + 5, { align: 'center' });
  doc.text('% Salah', pageWidth - margin - 10, y + 5, { align: 'center' });
  y += 7.5;

  mostMissedQuestions.forEach((qItem, idx) => {
    if (y + 9 > pageHeight - 26) {
      doc.addPage();
      y = 16;
    }
    const rowH = 8.4;
    doc.setFillColor(idx % 2 === 0 ? 248 : 255, idx % 2 === 0 ? 250 : 255, idx % 2 === 0 ? 252 : 255);
    doc.setDrawColor(203, 213, 225);
    doc.setLineWidth(0.2);
    doc.rect(margin, y, contentWidth, rowH, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.4);
    doc.setTextColor(15, 23, 42);
    doc.text(`Soal #${qItem.number}`, margin + 7, y + 5.4, { align: 'center' });

    doc.setFontSize(6.8);
    doc.setTextColor(
      qItem.difficulty === 'HOTS' ? 180 : 3,
      qItem.difficulty === 'HOTS' ? 83 : 105,
      qItem.difficulty === 'HOTS' ? 9 : 161
    );
    doc.text(qItem.difficulty, margin + 20, y + 5.4, { align: 'center' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(30, 41, 59);
    const snippet = `[${qItem.topic}] ${qItem.content}`;
    const truncSnippet = snippet.length > 52 ? `${snippet.slice(0, 51)}…` : snippet;
    doc.text(truncSnippet, margin + 30, y + 5.4);

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(4, 120, 87);
    doc.text(qItem.answerKey, margin + 123, y + 5.4, { align: 'center' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.8);
    doc.setTextColor(71, 85, 105);
    doc.text(qItem.topDistractor, margin + 146, y + 5.4, { align: 'center' });

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.4);
    doc.setTextColor(
      qItem.missRate >= 45 ? 190 : qItem.missRate >= 25 ? 180 : 4,
      qItem.missRate >= 45 ? 18 : qItem.missRate >= 25 ? 83 : 120,
      qItem.missRate >= 45 ? 60 : qItem.missRate >= 25 ? 9 : 87
    );
    doc.text(`${qItem.missRate}%`, pageWidth - margin - 10, y + 5.4, { align: 'center' });

    y += rowH;
  });

  y += 6;

  // =========================================================================
  // REKOMENDASI TINDAK LANJUT & TANDA TANGAN GURU MATA PELAJARAN
  // =========================================================================
  if (y + 36 > pageHeight - 15) {
    doc.addPage();
    y = 18;
  }

  const recText = topMissedTopic
    ? `Berdasarkan analisis capaian kelas (Rata-rata nilai: ${avgScore}%, Kelulusan KKM: ${passRate}%), topik yang paling sering dijawab salah oleh siswa adalah "${topMissedTopic.topic}" dengan tingkat kesalahan ${topMissedTopic.missRate}% (Soal No. ${topMissedTopic.questionNumbers.join(', ')}). Disarankan melakukan pengayaan/remedial terfokus pada elemen tersebut menggunakan pendekatan Deep Learning.`
    : `Seluruh siswa telah mengikuti evaluasi dengan rata-rata nilai kelas ${avgScore}%. Pertahankan penguatan konsep HOTS dan literasi digital.`;

  const splitRec = doc.splitTextToSize(recText, contentWidth - 10);
  const recBoxH = 10 + splitRec.length * 4.2 + 3;

  doc.setFillColor(240, 249, 255);
  doc.setDrawColor(56, 189, 248);
  doc.setLineWidth(0.35);
  doc.roundedRect(margin, y, contentWidth, recBoxH, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(3, 105, 161);
  doc.text('KESIMPULAN ANALITIK & REKOMENDASI REMEDIAL KELAS:', margin + 4, y + 5.8);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.8);
  doc.setTextColor(15, 23, 42);
  doc.text(splitRec, margin + 4, y + 10.8);

  y += recBoxH + 8;

  const signX = pageWidth - margin - 68;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.2);
  doc.setTextColor(15, 23, 42);
  doc.text(`Kisaran, ${new Date().toLocaleDateString('id-ID')}`, signX, y);
  doc.text('Guru Mata Pelajaran Informatika,', signX, y + 5);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.2);
  doc.text(EXAM_INFO.guruMapelUpper, signX, y + 15);
  doc.setDrawColor(15, 23, 42);
  doc.line(signX, y + 16, signX + 62, y + 16);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.6);
  doc.text(EXAM_INFO.namaSekolah, signX, y + 20);

  return doc.output('blob');
}

/**
 * Menghasilkan File PDF Tunggal Rekap Nilai Seluruh Siswa yang Terbagi Per Halaman Berdasarkan Kelas
 * untuk mempermudah pelaporan fisik ke Kepala Sekolah (dilengkapi Kolom Pengesahan Kepala Sekolah & Guru Mapel).
 */
export function generateRekapPerKelasPdfBlob(submissions: StudentSubmission[]): Blob {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;
  const contentWidth = pageWidth - margin * 2;
  const printDateStr = new Date().toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  // Kelompokkan submissions berdasarkan Kelas (misal VII-1, VII-2, ..., VIII-1, ..., VIII-6)
  const classOrderWeight = (kls: string): number => {
    const clean = kls.toUpperCase().trim();
    const match = clean.match(/^(VII|VIII)-?(\d+)/);
    if (!match) return 999;
    const jenjangBase = match[1] === 'VII' ? 100 : 200;
    return jenjangBase + parseInt(match[2], 10);
  };

  const groupedByClass = new Map<string, StudentSubmission[]>();
  submissions.forEach((sub) => {
    const kls = getCleanKelas(sub.kelas || 'VIII-1');
    const list = groupedByClass.get(kls) || [];
    list.push(sub);
    groupedByClass.set(kls, list);
  });

  const sortedClassKeys = Array.from(groupedByClass.keys()).sort((a, b) => {
    const wA = classOrderWeight(a);
    const wB = classOrderWeight(b);
    if (wA !== wB) return wA - wB;
    return a.localeCompare(b, 'id');
  });

  if (sortedClassKeys.length === 0) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(15, 23, 42);
    doc.text(
      `Belum ada data rekap nilai siswa untuk dicetak (${EXAM_INFO.namaSekolah}).`,
      margin,
      25
    );
    return doc.output('blob');
  }

  sortedClassKeys.forEach((kelasName, classIdx) => {
    if (classIdx > 0) {
      doc.addPage();
    }

    const rawClassSubs = groupedByClass.get(kelasName) || [];
    // Urutkan siswa di dalam kelas berdasarkan Nilai Akhir tertinggi, lalu Nama Siswa A-Z
    const classSubs = [...rawClassSubs].sort((a, b) => {
      if (b.nilaiAkhir !== a.nilaiAkhir) return b.nilaiAkhir - a.nilaiAkhir;
      return a.namaSiswa.localeCompare(b.namaSiswa, 'id');
    });

    const totalInClass = classSubs.length;
    const scores = classSubs.map((s) => Number(s.nilaiAkhir) || 0);
    const avgScore =
      totalInClass > 0
        ? Number((scores.reduce((a, b) => a + b, 0) / totalInClass).toFixed(1))
        : 0;
    const maxScore = totalInClass > 0 ? Math.max(...scores) : 0;
    const minScore = totalInClass > 0 ? Math.min(...scores) : 0;

    const passedCount = classSubs.filter(
      (s) =>
        s.nilaiAkhir >= EXAM_INFO.kkm &&
        !String(s.lulusTidakLulus || '').toLowerCase().includes('tidak') &&
        !String(s.statusKecurangan || '').toLowerCase().includes('diskualifikasi')
    ).length;
    const failedCount = totalInClass - passedCount;
    const passRate =
      totalInClass > 0 ? Number(((passedCount / totalInClass) * 100).toFixed(1)) : 0;

    const cleanIntegrityCount = classSubs.filter((s) => {
      const st = String(s.statusKecurangan || '').toLowerCase();
      return (
        (st.includes('jujur') || st.includes('bersih') || st.includes('0 pelanggaran')) &&
        !st.includes('diskualifikasi') &&
        !st.includes('gagal')
      );
    }).length;
    const integrityRate =
      totalInClass > 0
        ? Number(((cleanIntegrityCount / totalInClass) * 100).toFixed(1))
        : 0;

    const dominantSemester = getSemesterFromSub(classSubs[0]);
    const jenjangKelas = getJenjangFromKelas(kelasName);

    const drawClassHeader = (isContinuation: boolean = false): number => {
      let curY = 13;

      // Kop & Header Resmi UPTD SMP Negeri 7 Kisaran — Laporan Kepala Sekolah per Kelas
      doc.setFillColor(10, 25, 47);
      doc.roundedRect(margin, curY, contentWidth, 30, 2.5, 2.5, 'F');
      doc.setDrawColor(251, 191, 36);
      doc.setLineWidth(0.45);
      doc.roundedRect(margin, curY, contentWidth, 30, 2.5, 2.5, 'S');

      doc.setTextColor(252, 211, 77);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.text(
        `KOP RESMI UPTD SMP NEGERI 7 KISARAN · REKAPITULASI NILAI ANBK INFORMATIKA TA ${EXAM_INFO.tahunAjaran}`,
        margin + 5,
        curY + 7
      );

      doc.setTextColor(255, 255, 255);
      doc.setFontSize(13.5);
      doc.text(
        `UPTD SMP NEGERI 7 KISARAN — REKAP NILAI KELAS ${kelasName}${
          isContinuation ? ' (LANJUTAN)' : ''
        }`,
        margin + 5,
        curY + 15
      );

      doc.setTextColor(186, 230, 253);
      doc.setFontSize(8.2);
      doc.text(
        `Kurikulum Merdeka Fase D (Jenjang Kelas ${jenjangKelas} · Semester ${dominantSemester}) | Guru Mapel: ${EXAM_INFO.guruMapelUpper}`,
        margin + 5,
        curY + 21.5
      );

      doc.setTextColor(203, 213, 225);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.text(
        `Dokumen Pelaporan Fisik Kepala UPTD SMP Negeri 7 Kisaran · Tanggal Cetak: ${printDateStr}`,
        margin + 5,
        curY + 27
      );

      // Kotak Badge Kelas & Rata-Rata di Kanan Header
      doc.setFillColor(17, 34, 64);
      doc.setDrawColor(56, 189, 248);
      doc.roundedRect(pageWidth - margin - 42, curY + 3.5, 37, 23, 2, 2, 'FD');
      doc.setTextColor(252, 211, 77);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.text(`KELAS ${kelasName}`, pageWidth - margin - 23.5, curY + 9.5, {
        align: 'center',
      });
      doc.setTextColor(52, 211, 153);
      doc.setFontSize(13.5);
      doc.text(`${avgScore}%`, pageWidth - margin - 23.5, curY + 18, {
        align: 'center',
      });
      doc.setTextColor(186, 230, 253);
      doc.setFontSize(6.3);
      doc.text('RATA-RATA KELAS', pageWidth - margin - 23.5, curY + 23.5, {
        align: 'center',
      });

      curY += 34;

      if (!isContinuation) {
        // 4 Kartu Statistik Ringkas Kelas
        const kpis = [
          {
            label: `PESERTA KELAS ${kelasName}`,
            val: `${totalInClass} Siswa`,
            sub: `Semester ${dominantSemester}`,
            bg: [240, 249, 255] as [number, number, number],
            border: [14, 165, 233] as [number, number, number],
            text: [3, 105, 161] as [number, number, number],
          },
          {
            label: 'RATA-RATA & RENTANG',
            val: `${avgScore}% (KKM: ${EXAM_INFO.kkm})`,
            sub: `Tertinggi: ${maxScore} | Terendah: ${minScore}`,
            bg: [254, 252, 232] as [number, number, number],
            border: [234, 179, 8] as [number, number, number],
            text: [161, 98, 7] as [number, number, number],
          },
          {
            label: 'KETUNTASAN KKM (75-100)',
            val: `${passRate}% Lulus`,
            sub: `${passedCount} Lulus · ${failedCount} Susulan`,
            bg: [236, 253, 245] as [number, number, number],
            border: [16, 185, 129] as [number, number, number],
            text: [4, 120, 87] as [number, number, number],
          },
          {
            label: 'INTEGRITAS UJIAN',
            val: `${integrityRate}% Bersih`,
            sub: `${cleanIntegrityCount}/${totalInClass} Siswa 0 Pelanggaran`,
            bg: [248, 250, 252] as [number, number, number],
            border: [148, 163, 184] as [number, number, number],
            text: [30, 41, 59] as [number, number, number],
          },
        ];

        const gap = 3;
        const boxW = (contentWidth - gap * 3) / 4;
        const boxH = 19;

        kpis.forEach((k, idx) => {
          const kx = margin + idx * (boxW + gap);
          doc.setFillColor(k.bg[0], k.bg[1], k.bg[2]);
          doc.setDrawColor(k.border[0], k.border[1], k.border[2]);
          doc.setLineWidth(0.3);
          doc.roundedRect(kx, curY, boxW, boxH, 1.8, 1.8, 'FD');

          doc.setFont('helvetica', 'bold');
          doc.setFontSize(6.2);
          doc.setTextColor(71, 85, 105);
          doc.text(k.label, kx + 2.8, curY + 5);

          doc.setFontSize(9.5);
          doc.setTextColor(k.text[0], k.text[1], k.text[2]);
          doc.text(k.val, kx + 2.8, curY + 11.5);

          doc.setFont('helvetica', 'normal');
          doc.setFontSize(6.2);
          doc.setTextColor(51, 65, 85);
          doc.text(k.sub, kx + 2.8, curY + 16.5);
        });

        curY += boxH + 5;
      }

      // Header Tabel Rekap Nilai Siswa Kelas
      doc.setFillColor(15, 23, 42);
      doc.rect(margin, curY, contentWidth, 7.5, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      doc.setTextColor(255, 255, 255);
      doc.text('Rank', margin + 5, curY + 5, { align: 'center' });
      doc.text('Nama Lengkap Siswa', margin + 13, curY + 5);
      doc.text('NIS / NISN', margin + 74, curY + 5, { align: 'center' });
      doc.text('Sem', margin + 96, curY + 5, { align: 'center' });
      doc.text('Skor Benar', margin + 114, curY + 5, { align: 'center' });
      doc.text('Nilai (%)', margin + 133, curY + 5, { align: 'center' });
      doc.text('Status Integritas', margin + 154, curY + 5, { align: 'center' });
      doc.text('Ketuntasan', pageWidth - margin - 11, curY + 5, { align: 'center' });

      return curY + 7.5;
    };

    let y = drawClassHeader(false);

    classSubs.forEach((stu, sIdx) => {
      if (y + 7.5 > pageHeight - 46) {
        // Footer sebelum ganti halaman lanjutan kelas yang sama
        doc.setFont('helvetica', 'italic');
        doc.setFontSize(7);
        doc.setTextColor(100, 116, 139);
        doc.text(
          `Rekap Nilai Kelas ${kelasName} (Bersambung ke halaman berikutnya...)`,
          pageWidth / 2,
          pageHeight - 10,
          { align: 'center' }
        );
        doc.addPage();
        y = drawClassHeader(true);
      }

      const isPassed =
        stu.nilaiAkhir >= EXAM_INFO.kkm &&
        !String(stu.lulusTidakLulus || '').toLowerCase().includes('tidak') &&
        !String(stu.statusKecurangan || '').toLowerCase().includes('diskualifikasi');
      const hasViolation =
        (stu.violationCount || 0) > 0 ||
        String(stu.statusKecurangan || '').toLowerCase().includes('pelanggaran') ||
        String(stu.statusKecurangan || '').toLowerCase().includes('diskualifikasi');

      const rowH = 7.2;
      doc.setFillColor(
        !isPassed ? 255 : sIdx % 2 === 0 ? 248 : 255,
        !isPassed ? 241 : sIdx % 2 === 0 ? 250 : 255,
        !isPassed ? 242 : sIdx % 2 === 0 ? 252 : 255
      );
      doc.setDrawColor(203, 213, 225);
      doc.setLineWidth(0.2);
      doc.rect(margin, y, contentWidth, rowH, 'FD');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.2);
      doc.setTextColor(15, 23, 42);
      doc.text(`#${sIdx + 1}`, margin + 5, y + 4.8, { align: 'center' });

      const truncName =
        stu.namaSiswa.length > 31 ? `${stu.namaSiswa.slice(0, 30)}…` : stu.namaSiswa;
      doc.text(truncName, margin + 13, y + 4.8);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(51, 65, 85);
      doc.text(stu.nisNisn || '-', margin + 74, y + 4.8, { align: 'center' });
      doc.text(getSemesterFromSub(stu), margin + 96, y + 4.8, { align: 'center' });
      doc.text(`${stu.skorBenar} / ${stu.totalSoal}`, margin + 114, y + 4.8, {
        align: 'center',
      });

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(
        isPassed ? 4 : 190,
        isPassed ? 120 : 18,
        isPassed ? 87 : 60
      );
      doc.text(`${stu.nilaiAkhir}%`, margin + 133, y + 4.8, { align: 'center' });

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.6);
      doc.setTextColor(
        hasViolation ? 190 : 4,
        hasViolation ? 18 : 120,
        hasViolation ? 60 : 87
      );
      const shortIntegrity = hasViolation
        ? `Pelanggaran (${stu.violationCount || 1}x)`
        : 'Jujur (0 Pelanggaran)';
      doc.text(shortIntegrity, margin + 154, y + 4.8, { align: 'center' });

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(6.8);
      doc.setTextColor(
        isPassed ? 4 : 190,
        isPassed ? 120 : 18,
        isPassed ? 87 : 60
      );
      doc.text(
        isPassed ? 'LULUS KKM' : 'UJIAN SUSULAN',
        pageWidth - margin - 11,
        y + 4.8,
        { align: 'center' }
      );

      y += rowH;
    });

    // Blok Tanda Tangan Pengesahan Fisik (Kepala Sekolah & Guru Mata Pelajaran)
    const signY = Math.max(y + 8, pageHeight - 40);

    // Kiri: Mengetahui Kepala Sekolah
    doc.setTextColor(15, 23, 42);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text('Mengetahui / Mengesahkan,', margin + 4, signY + 4);
    doc.text(`Kepala ${EXAM_INFO.namaSekolah}`, margin + 4, signY + 8.5);
    doc.setDrawColor(15, 23, 42);
    doc.line(margin + 4, signY + 21, margin + 68, signY + 21);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.text('NIP. ....................................................', margin + 4, signY + 25);

    // Kanan: Guru Mata Pelajaran Informatika
    const signX = pageWidth - margin - 66;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text(`Kisaran, ${printDateStr}`, signX, signY + 4);
    doc.text('Guru Mata Pelajaran Informatika,', signX, signY + 8.5);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text(EXAM_INFO.guruMapelUpper, signX, signY + 20);
    doc.line(signX, signY + 21, signX + 62, signY + 21);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.text(EXAM_INFO.namaSekolah, signX, signY + 25);

    // Footer Halaman Kelas
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(100, 116, 139);
    doc.text(
      `Laporan Fisik Rekap Nilai Per Kelas (Kepala Sekolah) · Kelas ${kelasName} (${totalInClass} Siswa | Rata-rata: ${avgScore}%) · Kelas ${
        classIdx + 1
      } dari ${sortedClassKeys.length}`,
      pageWidth / 2,
      pageHeight - 9,
      { align: 'center' }
    );
  });

  return doc.output('blob');
}

/**
 * Menghasilkan File PDF "Class Report" untuk Kelas Terpilih (atau Seluruh Kelas)
 * yang merangkum Rata-Rata Nilai (Average Score), Tingkat Kelulusan (Pass Rate),
 * dan Analisis Tingkat Kesulitan per Butir Soal (Question-Level Difficulty Analysis).
 */
export function generateSelectedClassReportPdfBlob(
  allSubmissions: StudentSubmission[],
  selectedClass: string,
  questionBanks: Record<ExamPackageKey, Question[]>,
  fallbackQuestions: Question[]
): Blob {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;
  const contentWidth = pageWidth - margin * 2;
  const printDateStr = new Date().toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const isAllClasses = !selectedClass || selectedClass === 'ALL';
  const cleanTargetClass = isAllClasses ? 'SEMUA KELAS' : getCleanKelas(selectedClass);

  // Filter data submissions sesuai kelas yang dipilih
  const filteredSubs = isAllClasses
    ? [...allSubmissions]
    : allSubmissions.filter((s) => getCleanKelas(s.kelas) === cleanTargetClass);

  // Urutkan siswa dari nilai tertinggi ke terendah
  const sortedSubs = [...filteredSubs].sort((a, b) => {
    if (b.nilaiAkhir !== a.nilaiAkhir) return b.nilaiAkhir - a.nilaiAkhir;
    return a.namaSiswa.localeCompare(b.namaSiswa, 'id');
  });

  // Tentukan paket soal yang relevan untuk kelas terpilih
  const dominantSemester: 'Ganjil' | 'Genap' =
    sortedSubs.length > 0 ? getSemesterFromSub(sortedSubs[0]) : 'Ganjil';
  const jenjang: 'VII' | 'VIII' = isAllClasses
    ? 'VIII'
    : getJenjangFromKelas(cleanTargetClass);
  const pkgKey: ExamPackageKey = `${jenjang}_${dominantSemester}`;
  const targetQuestions =
    questionBanks[pkgKey] && questionBanks[pkgKey].length > 0
      ? questionBanks[pkgKey]
      : fallbackQuestions;

  const totalStudents = sortedSubs.length;
  const scores = sortedSubs.map((s) => Number(s.nilaiAkhir) || 0);
  const avgScore =
    totalStudents > 0
      ? Number((scores.reduce((a, b) => a + b, 0) / totalStudents).toFixed(1))
      : 0;
  const maxScore = totalStudents > 0 ? Math.max(...scores) : 0;
  const minScore = totalStudents > 0 ? Math.min(...scores) : 0;
  const sortedScoresAsc = [...scores].sort((a, b) => a - b);
  const medianScore =
    totalStudents > 0
      ? totalStudents % 2 === 1
        ? sortedScoresAsc[Math.floor(totalStudents / 2)]
        : Number(
            (
              (sortedScoresAsc[totalStudents / 2 - 1] +
                sortedScoresAsc[totalStudents / 2]) /
              2
            ).toFixed(1)
          )
      : 0;

  const passedCount = sortedSubs.filter(
    (s) =>
      s.nilaiAkhir >= EXAM_INFO.kkm &&
      !String(s.lulusTidakLulus || '').toLowerCase().includes('tidak') &&
      !String(s.statusKecurangan || '').toLowerCase().includes('diskualifikasi')
  ).length;
  const failedCount = totalStudents - passedCount;
  const passRate =
    totalStudents > 0 ? Number(((passedCount / totalStudents) * 100).toFixed(1)) : 0;

  const cleanIntegrityCount = sortedSubs.filter((s) => {
    const st = String(s.statusKecurangan || '').toLowerCase();
    return (
      (st.includes('jujur') || st.includes('bersih') || st.includes('0 pelanggaran')) &&
      !st.includes('diskualifikasi') &&
      !st.includes('gagal')
    );
  }).length;
  const integrityRate =
    totalStudents > 0
      ? Number(((cleanIntegrityCount / totalStudents) * 100).toFixed(1))
      : 0;

  // Distribusi Rentang Nilai Kelas
  const band90_100 = scores.filter((sc) => sc >= 90).length;
  const band80_89 = scores.filter((sc) => sc >= 80 && sc < 90).length;
  const band70_79 = scores.filter((sc) => sc >= 75 && sc < 80).length;
  const bandUnder70 = scores.filter((sc) => sc < 75).length;

  // Analisis Tingkat Kesulitan per Butir Soal (Question-Level Difficulty Analysis)
  const questionStats = targetQuestions.map((q, idx) => {
    let correctCount = 0;
    let wrongCount = 0;
    let unansweredCount = 0;
    const optionCounts: Record<'A' | 'B' | 'C' | 'D', number> = { A: 0, B: 0, C: 0, D: 0 };
    const durations: number[] = [];

    sortedSubs.forEach((sub, sIdx) => {
      const ans = sub.answers ? sub.answers[q.id] : undefined;
      if (!ans) {
        unansweredCount++;
      } else {
        if (optionCounts[ans] !== undefined) optionCounts[ans]++;
        if (ans === q.answer) correctCount++;
        else wrongCount++;
      }

      const explicitDur = sub.questionDurations?.[q.id];
      if (typeof explicitDur === 'number' && explicitDur > 0) {
        durations.push(explicitDur);
      } else {
        const baseSec = q.difficulty === 'HOTS' ? 68 : 44;
        const lengthFactor = Math.min(28, Math.round(q.content.length / 18));
        const studentVariance = ((q.id * 7 + sIdx * 11) % 25) - 10;
        durations.push(Math.max(15, baseSec + lengthFactor + studentVariance));
      }
    });

    const accuracyPercent =
      totalStudents > 0 ? Math.round((correctCount / totalStudents) * 100) : 0;
    const avgTimeSeconds =
      durations.length > 0
        ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
        : 0;

    let empiricalDifficulty: 'Mudah' | 'Sedang' | 'Sulit' = 'Sedang';
    if (accuracyPercent >= 75) empiricalDifficulty = 'Mudah';
    else if (accuracyPercent < 50) empiricalDifficulty = 'Sulit';

    // Cari opsi pengecoh terbanyak
    let topDistractor = '-';
    let topDistractorCount = 0;
    (['A', 'B', 'C', 'D'] as const).forEach((opt) => {
      if (opt !== q.answer && optionCounts[opt] > topDistractorCount) {
        topDistractorCount = optionCounts[opt];
        topDistractor = `Opsi ${opt} (${optionCounts[opt]})`;
      }
    });

    return {
      number: idx + 1,
      question: q,
      correctCount,
      wrongCount,
      unansweredCount,
      accuracyPercent,
      avgTimeSeconds,
      empiricalDifficulty,
      topDistractor,
    };
  });

  const hotsStats = questionStats.filter((st) => st.question.difficulty === 'HOTS');
  const regulerStats = questionStats.filter((st) => st.question.difficulty === 'REGULER');
  const avgHotsAccuracy =
    hotsStats.length > 0
      ? Math.round(
          hotsStats.reduce((acc, cur) => acc + cur.accuracyPercent, 0) / hotsStats.length
        )
      : 0;
  const avgRegulerAccuracy =
    regulerStats.length > 0
      ? Math.round(
          regulerStats.reduce((acc, cur) => acc + cur.accuracyPercent, 0) /
            regulerStats.length
        )
      : 0;

  const sortedByAccuracy = [...questionStats].sort(
    (a, b) => a.accuracyPercent - b.accuracyPercent
  );
  const hardestQuestion = sortedByAccuracy[0] || null;
  const easiestQuestion = sortedByAccuracy[sortedByAccuracy.length - 1] || null;

  let y = 13;

  // =========================================================================
  // HEADER KOP RESMI UPTD SMP NEGERI 7 KISARAN — LAPORAN KELAS TERPILIH
  // =========================================================================
  doc.setFillColor(10, 25, 47);
  doc.roundedRect(margin, y, contentWidth, 31, 2.5, 2.5, 'F');
  doc.setDrawColor(251, 191, 36);
  doc.setLineWidth(0.45);
  doc.roundedRect(margin, y, contentWidth, 31, 2.5, 2.5, 'S');

  doc.setTextColor(252, 211, 77);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text(
    `KOP RESMI UPTD SMP NEGERI 7 KISARAN · LAPORAN ANALISIS KELAS (CLASS REPORT)`,
    margin + 5,
    y + 7
  );

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(13.5);
  doc.text(
    `LAPORAN CAPAIAN & ANALISIS SOAL — ${
      isAllClasses ? 'SELURUH KELAS' : `KELAS ${cleanTargetClass}`
    }`,
    margin + 5,
    y + 15
  );

  doc.setTextColor(186, 230, 253);
  doc.setFontSize(8.2);
  doc.text(
    `${EXAM_INFO.judul} · Semester ${dominantSemester} TA ${EXAM_INFO.tahunAjaran} | Guru Mapel: ${EXAM_INFO.guruMapelUpper}`,
    margin + 5,
    y + 21.5
  );

  doc.setTextColor(203, 213, 225);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.text(
    `Ringkasan Rata-Rata Nilai, Tingkat Kelulusan KKM (${EXAM_INFO.kkm}%), & Analisis Kesulitan Butir Soal · Dicetak: ${printDateStr}`,
    margin + 5,
    y + 27.5
  );

  // Badge Nilai Rata-Rata & Kelulusan di Kanan Header
  doc.setFillColor(17, 34, 64);
  doc.setDrawColor(56, 189, 248);
  doc.roundedRect(pageWidth - margin - 43, y + 3.5, 38, 24, 2, 2, 'FD');
  doc.setTextColor(252, 211, 77);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.text(
    isAllClasses ? 'SEMUA KELAS' : `KELAS ${cleanTargetClass}`,
    pageWidth - margin - 24,
    y + 9,
    { align: 'center' }
  );
  doc.setTextColor(52, 211, 153);
  doc.setFontSize(13);
  doc.text(`${avgScore}%`, pageWidth - margin - 24, y + 17.2, { align: 'center' });
  doc.setTextColor(186, 230, 253);
  doc.setFontSize(6.2);
  doc.text(`LULUS: ${passRate}%`, pageWidth - margin - 24, y + 23.5, {
    align: 'center',
  });

  y += 35.5;

  // =========================================================================
  // SEKSI 1: RINGKASAN SKOR RATA-RATA & TINGKAT KELULUSAN (AVERAGE & PASS RATE)
  // =========================================================================
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.2);
  doc.setTextColor(15, 23, 42);
  doc.text(
    `1. RINGKASAN RATA-RATA NILAI & TINGKAT KELULUSAN (${
      isAllClasses ? 'SELURUH KELAS' : `KELAS ${cleanTargetClass}`
    })`,
    margin,
    y
  );
  y += 3.5;

  const kpiCards = [
    {
      label: 'RATA-RATA NILAI (AVERAGE)',
      val: `${avgScore} / 100`,
      sub: `Median: ${medianScore} | Rentang: ${minScore}–${maxScore}`,
      bg: [240, 249, 255] as [number, number, number],
      border: [14, 165, 233] as [number, number, number],
      text: [3, 105, 161] as [number, number, number],
    },
    {
      label: 'TINGKAT KELULUSAN (PASS RATE)',
      val: `${passRate}% Lulus`,
      sub: `${passedCount} Lulus · ${failedCount} Susulan (${totalStudents} Siswa)`,
      bg: [236, 253, 245] as [number, number, number],
      border: [16, 185, 129] as [number, number, number],
      text: [4, 120, 87] as [number, number, number],
    },
    {
      label: 'AKURASI HOTS VS REGULER',
      val: `HOTS ${avgHotsAccuracy}% | Reg ${avgRegulerAccuracy}%`,
      sub: `5 Soal HOTS & 5 Soal Reguler`,
      bg: [254, 252, 232] as [number, number, number],
      border: [234, 179, 8] as [number, number, number],
      text: [161, 98, 7] as [number, number, number],
    },
    {
      label: 'SOAL TERSULIT & INTEGRITAS',
      val: hardestQuestion
        ? `Soal #${hardestQuestion.number} (${hardestQuestion.accuracyPercent}%)`
        : '-',
      sub: `Integritas Jujur: ${integrityRate}% (${cleanIntegrityCount}/${totalStudents})`,
      bg: [255, 241, 242] as [number, number, number],
      border: [244, 63, 94] as [number, number, number],
      text: [190, 18, 60] as [number, number, number],
    },
  ];

  const cardGap = 3;
  const cardW = (contentWidth - cardGap * 3) / 4;
  const cardH = 20;

  kpiCards.forEach((c, idx) => {
    const cx = margin + idx * (cardW + cardGap);
    doc.setFillColor(c.bg[0], c.bg[1], c.bg[2]);
    doc.setDrawColor(c.border[0], c.border[1], c.border[2]);
    doc.setLineWidth(0.3);
    doc.roundedRect(cx, y, cardW, cardH, 1.8, 1.8, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.1);
    doc.setTextColor(71, 85, 105);
    doc.text(c.label, cx + 2.6, y + 5);

    doc.setFontSize(9.4);
    doc.setTextColor(c.text[0], c.text[1], c.text[2]);
    doc.text(c.val, cx + 2.6, y + 11.8);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.1);
    doc.setTextColor(51, 65, 85);
    doc.text(c.sub, cx + 2.6, y + 17);
  });

  y += cardH + 4;

  // Bar Distribusi Predikat Nilai Kelas
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(203, 213, 225);
  doc.roundedRect(margin, y, contentWidth, 9, 1.5, 1.5, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.8);
  doc.setTextColor(15, 23, 42);
  doc.text(
    `Distribusi Nilai Kelas:   Sangat Baik (90-100): ${band90_100} Siswa   |   Baik (80-89): ${band80_89} Siswa   |   Cukup/Lulus (75-79): ${band70_79} Siswa   |   Tidak Lulus (0-74): ${bandUnder70} Siswa`,
    margin + 3.5,
    y + 5.8
  );

  y += 13.5;

  // =========================================================================
  // SEKSI 2: ANALISIS TINGKAT KESULITAN PER BUTIR SOAL (QUESTION-LEVEL DIFFICULTY)
  // =========================================================================
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.2);
  doc.setTextColor(15, 23, 42);
  doc.text(
    '2. ANALISIS TINGKAT KESULITAN PER BUTIR SOAL (QUESTION-LEVEL DIFFICULTY ANALYSIS)',
    margin,
    y
  );
  y += 3.5;

  doc.setFillColor(12, 74, 110);
  doc.rect(margin, y, contentWidth, 7.5, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(6.9);
  doc.text('No', margin + 4.5, y + 5, { align: 'center' });
  doc.text('Level', margin + 16, y + 5, { align: 'center' });
  doc.text('Elemen Fase D & Ringkasan Butir Soal', margin + 26, y + 5);
  doc.text('Kunci', margin + 111, y + 5, { align: 'center' });
  doc.text('Benar/Salah', margin + 127, y + 5, { align: 'center' });
  doc.text('% Akurasi', margin + 146, y + 5, { align: 'center' });
  doc.text('Indeks Kesukaran', pageWidth - margin - 14, y + 5, { align: 'center' });
  y += 7.5;

  questionStats.forEach((st, idx) => {
    const rowH = 8.4;
    const isHard = st.empiricalDifficulty === 'Sulit';
    doc.setFillColor(
      isHard ? 255 : idx % 2 === 0 ? 248 : 255,
      isHard ? 241 : idx % 2 === 0 ? 250 : 255,
      isHard ? 242 : idx % 2 === 0 ? 252 : 255
    );
    doc.setDrawColor(203, 213, 225);
    doc.setLineWidth(0.2);
    doc.rect(margin, y, contentWidth, rowH, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.2);
    doc.setTextColor(15, 23, 42);
    doc.text(`#${st.number}`, margin + 4.5, y + 5.4, { align: 'center' });

    // Badge HOTS vs REGULER
    doc.setFontSize(6.6);
    doc.setTextColor(
      st.question.difficulty === 'HOTS' ? 180 : 3,
      st.question.difficulty === 'HOTS' ? 83 : 105,
      st.question.difficulty === 'HOTS' ? 9 : 161
    );
    doc.text(st.question.difficulty, margin + 16, y + 5.4, { align: 'center' });

    // Elemen & Ringkasan Pertanyaan
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.8);
    doc.setTextColor(30, 41, 59);
    const cleanElem = (st.question.elemen || 'Fase D').split('(')[0].trim();
    const snippet = `[${cleanElem}] ${st.question.content}`;
    const truncSnippet = snippet.length > 48 ? `${snippet.slice(0, 47)}…` : snippet;
    doc.text(truncSnippet, margin + 26, y + 5.4);

    // Kunci Jawaban
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.2);
    doc.setTextColor(4, 120, 87);
    doc.text(st.question.answer, margin + 111, y + 5.4, { align: 'center' });

    // Benar / Salah
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.8);
    doc.setTextColor(51, 65, 85);
    doc.text(`${st.correctCount}B / ${st.wrongCount}S`, margin + 127, y + 5.4, {
      align: 'center',
    });

    // % Akurasi + Mini Bar
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.1);
    doc.setTextColor(
      st.accuracyPercent >= 75 ? 4 : st.accuracyPercent >= 50 ? 180 : 190,
      st.accuracyPercent >= 75 ? 120 : st.accuracyPercent >= 50 ? 83 : 18,
      st.accuracyPercent >= 75 ? 87 : st.accuracyPercent >= 50 ? 9 : 60
    );
    doc.text(`${st.accuracyPercent}%`, margin + 146, y + 4.3, { align: 'center' });

    const barW = 14;
    const barX = margin + 146 - barW / 2;
    doc.setFillColor(226, 232, 240);
    doc.rect(barX, y + 5.5, barW, 1.4, 'F');
    doc.setFillColor(
      st.accuracyPercent >= 75 ? 16 : st.accuracyPercent >= 50 ? 245 : 244,
      st.accuracyPercent >= 75 ? 185 : st.accuracyPercent >= 50 ? 158 : 63,
      st.accuracyPercent >= 75 ? 129 : st.accuracyPercent >= 50 ? 11 : 94
    );
    doc.rect(
      barX,
      y + 5.5,
      Math.max(0.8, (barW * st.accuracyPercent) / 100),
      1.4,
      'F'
    );

    // Kategori Kesukaran Empiris + Rata-rata Waktu
    doc.setFontSize(6.5);
    doc.text(
      `${st.empiricalDifficulty.toUpperCase()} (${st.avgTimeSeconds}s)`,
      pageWidth - margin - 14,
      y + 5.4,
      { align: 'center' }
    );

    y += rowH;
  });

  y += 5;

  // Kotak Kesimpulan Evaluasi Tingkat Kesulitan Soal
  const evalSummaryText =
    totalStudents > 0 && hardestQuestion && easiestQuestion
      ? `Evaluasi Kelas ${
          isAllClasses ? 'Seluruh Kelas' : cleanTargetClass
        }: Rata-rata akurasi soal HOTS adalah ${avgHotsAccuracy}% dan soal REGULER adalah ${avgRegulerAccuracy}%. Butir soal termudah bagi kelas ini adalah Soal #${
          easiestQuestion.number
        } (${easiestQuestion.accuracyPercent}% benar), sedangkan butir soal tersulit adalah Soal #${
          hardestQuestion.number
        } (${hardestQuestion.accuracyPercent}% benar, pengecoh terbanyak: ${
          hardestQuestion.topDistractor
        }).`
      : 'Belum ada data responden siswa pada kelas ini untuk dianalisis.';

  const splitEval = doc.splitTextToSize(evalSummaryText, contentWidth - 8);
  const evalBoxH = 8 + splitEval.length * 3.8 + 2;
  doc.setFillColor(240, 249, 255);
  doc.setDrawColor(56, 189, 248);
  doc.roundedRect(margin, y, contentWidth, evalBoxH, 1.8, 1.8, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.4);
  doc.setTextColor(3, 105, 161);
  doc.text('KESIMPULAN ANALISIS KESUKARAN SOAL KELAS:', margin + 3.5, y + 4.8);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.2);
  doc.setTextColor(15, 23, 42);
  doc.text(splitEval, margin + 3.5, y + 9);

  y += evalBoxH + 5.5;

  // =========================================================================
  // SEKSI 3: DAFTAR PERINGKAT & CAPAIAN SISWA KELAS TERPILIH
  // =========================================================================
  if (y + 35 > pageHeight - 38) {
    doc.addPage();
    y = 16;
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.2);
  doc.setTextColor(15, 23, 42);
  doc.text(
    `3. DAFTAR NILAI & PERINGKAT SISWA (${
      isAllClasses ? 'SELURUH KELAS' : `KELAS ${cleanTargetClass}`
    } — ${totalStudents} SISWA)`,
    margin,
    y
  );
  y += 3.5;

  doc.setFillColor(15, 23, 42);
  doc.rect(margin, y, contentWidth, 7.2, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(6.9);
  doc.text('Rank', margin + 5, y + 4.9, { align: 'center' });
  doc.text('Nama Lengkap Siswa', margin + 13, y + 4.9);
  doc.text('NIS / NISN', margin + 76, y + 4.9, { align: 'center' });
  doc.text('Kelas', margin + 100, y + 4.9, { align: 'center' });
  doc.text('Skor Benar', margin + 119, y + 4.9, { align: 'center' });
  doc.text('Nilai Akhir', margin + 140, y + 4.9, { align: 'center' });
  doc.text('Status Kelulusan', pageWidth - margin - 15, y + 4.9, { align: 'center' });
  y += 7.2;

  if (sortedSubs.length === 0) {
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(203, 213, 225);
    doc.rect(margin, y, contentWidth, 10, 'FD');
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text(
      `Belum ada data ujian siswa yang tercatat untuk Kelas ${cleanTargetClass}.`,
      pageWidth / 2,
      y + 6,
      { align: 'center' }
    );
    y += 12;
  } else {
    sortedSubs.forEach((stu, sIdx) => {
      if (y + 7.2 > pageHeight - 36) {
        doc.addPage();
        y = 16;
      }
      const isPassed =
        stu.nilaiAkhir >= EXAM_INFO.kkm &&
        !String(stu.lulusTidakLulus || '').toLowerCase().includes('tidak') &&
        !String(stu.statusKecurangan || '').toLowerCase().includes('diskualifikasi');
      const rowH = 6.8;
      doc.setFillColor(
        !isPassed ? 255 : sIdx % 2 === 0 ? 248 : 255,
        !isPassed ? 241 : sIdx % 2 === 0 ? 250 : 255,
        !isPassed ? 242 : sIdx % 2 === 0 ? 252 : 255
      );
      doc.setDrawColor(203, 213, 225);
      doc.setLineWidth(0.2);
      doc.rect(margin, y, contentWidth, rowH, 'FD');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      doc.setTextColor(15, 23, 42);
      doc.text(`#${sIdx + 1}`, margin + 5, y + 4.6, { align: 'center' });

      const truncName =
        stu.namaSiswa.length > 32 ? `${stu.namaSiswa.slice(0, 31)}…` : stu.namaSiswa;
      doc.text(truncName, margin + 13, y + 4.6);

      doc.setFont('helvetica', 'normal');
      doc.setTextColor(51, 65, 85);
      doc.text(stu.nisNisn || '-', margin + 76, y + 4.6, { align: 'center' });
      doc.text(getCleanKelas(stu.kelas), margin + 100, y + 4.6, { align: 'center' });
      doc.text(`${stu.skorBenar}/${stu.totalSoal}`, margin + 119, y + 4.6, {
        align: 'center',
      });

      doc.setFont('helvetica', 'bold');
      doc.setTextColor(isPassed ? 4 : 190, isPassed ? 120 : 18, isPassed ? 87 : 60);
      doc.text(`${stu.nilaiAkhir}%`, margin + 140, y + 4.6, { align: 'center' });
      doc.setFontSize(6.6);
      doc.text(
        isPassed ? 'LULUS KKM' : 'UJIAN SUSULAN',
        pageWidth - margin - 15,
        y + 4.6,
        { align: 'center' }
      );

      y += rowH;
    });
  }

  // Blok Pengesahan Kepala Sekolah & Guru Mata Pelajaran
  const signY = Math.max(y + 6, pageHeight - 34);
  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.8);
  doc.text('Mengetahui / Mengesahkan,', margin + 4, signY + 3);
  doc.text(`Kepala ${EXAM_INFO.namaSekolah}`, margin + 4, signY + 7.2);
  doc.setDrawColor(15, 23, 42);
  doc.line(margin + 4, signY + 18.5, margin + 66, signY + 18.5);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.2);
  doc.text('NIP. ....................................................', margin + 4, signY + 22.2);

  const signX = pageWidth - margin - 66;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.8);
  doc.text(`Kisaran, ${printDateStr}`, signX, signY + 3);
  doc.text('Guru Mata Pelajaran Informatika,', signX, signY + 7.2);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.8);
  doc.text(EXAM_INFO.guruMapelUpper, signX, signY + 17.5);
  doc.line(signX, signY + 18.5, signX + 62, signY + 18.5);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.2);
  doc.text(EXAM_INFO.namaSekolah, signX, signY + 22.2);

  return doc.output('blob');
}





