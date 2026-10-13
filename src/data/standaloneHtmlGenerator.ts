import { Question, EXAM_INFO } from './examData';

export function generateSingleFileHtml(questions: Question[], gasWebAppUrl: string = ''): string {
  const questionsJson = JSON.stringify(questions, null, 2);
  return `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${EXAM_INFO.judul} - ${EXAM_INFO.namaSekolah}</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;600&family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    body { font-family: 'Plus Jakarta Sans', sans-serif; }
    .font-mono { font-family: 'IBM Plex Mono', monospace; font-variant-numeric: tabular-nums; }
    .exam-lock { user-select: none; -webkit-user-select: none; }
    @media print { .no-print { display: none !important; } }
  </style>
</head>
<body class="bg-slate-50 text-slate-900 min-h-screen transition-colors duration-200" id="appBody">
  <div id="app"></div>

  <script>
    // =========================================================================
    // DATA SOAL INFORMATIKA FASE D (25 SOAL: REGULER & HOTS)
    // =========================================================================
    let questions = ${questionsJson};
    let GAS_WEB_APP_URL = "${gasWebAppUrl}";

    const EXAM_CONFIG = {
      judul: "${EXAM_INFO.judul}",
      mapel: "${EXAM_INFO.mataPelajaran}",
      tahunAjaran: "${EXAM_INFO.tahunAjaran}",
      guru: "${EXAM_INFO.guruMapelUpper}",
      sekolah: "${EXAM_INFO.namaSekolah}",
      kurikulum: "${EXAM_INFO.kurikulum}",
      durasiDetik: 30 * 60,
      kkm: 75,
      passwordGuru: "31051990",
      emailGuru: "eksayudikasirait@gmail.com",
      waGuru: "6282165885568"
    };

    let state = {
      darkMode: false,
      view: 'HOME', // HOME | INSTRUCTIONS | EXAM | RESULT | TEACHER
      token: generateToken(),
      tokenTimeLeft: 30 * 60,
      student: { nama: '', kelas: 'VIII-1', nisn: '', inputToken: '' },
      examQuestions: [],
      currentIndex: 0,
      answers: {},
      doubtful: {},
      examTimeLeft: 30 * 60,
      violationCount: 0,
      violationLogs: [],
      warningOverlay: false,
      warningCountdown: 15,
      warningReason: '',
      resultData: null,
      submissions: JSON.parse(localStorage.getItem('anbk_submissions_v1') || '[]')
    };

    let examTimerInterval = null;
    let warningTimerInterval = null;

    function generateToken() {
      const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
      let res = '';
      for (let i = 0; i < 6; i++) res += chars.charAt(Math.floor(Math.random() * chars.length));
      return res;
    }

    function formatTime(sec) {
      const m = Math.floor(sec / 60).toString().padStart(2, '0');
      const s = (sec % 60).toString().padStart(2, '0');
      return m + ':' + s;
    }

    function checkSplitScreen() {
      const sw = window.screen.availWidth || window.screen.width;
      const sh = window.screen.availHeight || window.screen.height;
      const ww = window.innerWidth;
      const wh = window.innerHeight;
      if (sw > 0 && sh > 0) {
        if (ww < sw * 0.68 || wh < sh * 0.62) return true;
      }
      return false;
    }

    function syncToGoogleSheet(payload, isFinal) {
      try {
        localStorage.setItem('anbk_submissions_v1', JSON.stringify(state.submissions));
        if (typeof google !== 'undefined' && google.script && google.script.run) {
          google.script.run.saveStudentSubmission(payload, isFinal);
        } else if (GAS_WEB_APP_URL) {
          fetch(GAS_WEB_APP_URL, {
            method: 'POST',
            mode: 'no-cors',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({ action: isFinal ? 'submitExam' : 'autosave', data: payload })
          });
        }
      } catch (e) { console.error(e); }
    }

    function sendEmailNotification(payload, autoTrigger) {
      const jenjang = String(payload.kelas || '').toUpperCase().indexOf('VII-') === 0 ? 'VII' : 'VIII';
      const subject = '[ANBK INFORMATIKA KELAS ' + jenjang + '] Hasil Ujian: ' + payload.namaSiswa + ' (' + payload.kelas + ') - ' + payload.lulusTidakLulus;
      fetch('https://formsubmit.co/ajax/' + EXAM_CONFIG.emailGuru, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({
          _subject: subject,
          _template: 'table',
          _captcha: 'false',
          Timestamp: payload.timestamp,
          Nama_Siswa: payload.namaSiswa,
          NIS_NISN: payload.nisNisn,
          Kelas: payload.kelas,
          Skor_Benar: payload.skorBenar + ' / ' + payload.totalSoal,
          Nilai_Akhir: payload.nilaiAkhir + '%',
          Status_Kelulusan: payload.lulusTidakLulus,
          Status_Kecurangan: payload.statusKecurangan
        })
      }).catch(() => {});

      if (!autoTrigger) {
        const body =
          'LAPORAN HASIL UJIAN ANBK INFORMATIKA KELAS ' + jenjang + '\\n' +
          'UPTD SMP NEGERI 7 KISARAN\\n' +
          '----------------------------------------\\n' +
          'Timestamp : ' + payload.timestamp + '\\n' +
          'Nama Siswa : ' + payload.namaSiswa + '\\n' +
          'NIS/NISN : ' + payload.nisNisn + '\\n' +
          'Kelas : ' + payload.kelas + '\\n' +
          'Skor Benar : ' + payload.skorBenar + ' / ' + payload.totalSoal + '\\n' +
          'Nilai Akhir : ' + payload.nilaiAkhir + '%\\n' +
          'Status : ' + payload.lulusTidakLulus + '\\n' +
          'Status Kecurangan : ' + payload.statusKecurangan + '\\n' +
          '----------------------------------------\\n' +
          'Identitas Guru Mapel: EKSA YUDIKA SIRAIT S.T\\n' +
          'Nomor WA Resmi: +62 821-6588-5568\\n' +
          'Email Resmi: eksayudikasirait@gmail.com';
        const gmailUrl = 'https://mail.google.com/mail/?view=cm&fs=1&to=' + encodeURIComponent(EXAM_CONFIG.emailGuru) + '&su=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(body);
        window.open(gmailUrl, '_blank');
      }
    }

    function buildPayload(statusCurang, forceFail) {
      let benar = 0;
      state.examQuestions.forEach(q => {
        if (state.answers[q.id] === q.answer) benar++;
      });
      const total = state.examQuestions.length || questions.length;
      const nilai = forceFail ? 0 : Math.round((benar / total) * 100);
      const lulus = (!forceFail && nilai >= EXAM_CONFIG.kkm) ? 'Lulus Ujian' : 'Tidak Lulus Ujian (Ujian Susulan)';
      return {
        timestamp: new Date().toLocaleString('id-ID'),
        namaSiswa: state.student.nama,
        nisNisn: state.student.nisn,
        kelas: state.student.kelas,
        semester: state.student.semester || 'Genap',
        skorBenar: benar,
        totalSoal: total,
        nilaiAkhir: nilai,
        statusKecurangan: statusCurang || (state.violationCount > 0 ? 'Pelanggaran ' + state.violationCount + 'x (' + state.violationLogs.join(', ') + ')' : 'Jujur / Bersih (0 Pelanggaran)'),
        lulusTidakLulus: lulus,
        violationLogs: state.violationLogs
      };
    }

    function autoSaveCurrent() {
      if (state.view !== 'EXAM') return;
      const payload = buildPayload('', false);
      const idx = state.submissions.findIndex(s => s.nisNisn === payload.nisNisn && s.namaSiswa === payload.namaSiswa);
      if (idx >= 0) state.submissions[idx] = payload;
      else state.submissions.unshift(payload);
      syncToGoogleSheet(payload, false);
    }

    function finishExam(reason, isCheatingDisqualified) {
      clearInterval(examTimerInterval);
      clearInterval(warningTimerInterval);
      state.warningOverlay = false;
      const payload = buildPayload(reason, isCheatingDisqualified);
      const idx = state.submissions.findIndex(s => s.nisNisn === payload.nisNisn && s.namaSiswa === payload.namaSiswa);
      if (idx >= 0) state.submissions[idx] = payload;
      else state.submissions.unshift(payload);
      state.resultData = { ...payload, isCheatingDisqualified };
      syncToGoogleSheet(payload, true);
      state.view = 'RESULT';
      render();
      sendEmailNotification(payload, true);
      if (isCheatingDisqualified) {
        setTimeout(() => {
          state.view = 'HOME';
          render();
        }, 7000);
      }
    }

    function sendWhatsAppNotification(payload, autoTrigger) {
      const jenjang = String(payload.kelas || '').toUpperCase().indexOf('VII-') === 0 ? 'VII' : 'VIII';
      const msg =
        '*LAPORAN HASIL UJIAN ANBK INFORMATIKA KELAS ' + jenjang + '*\\n' +
        '*UPTD SMP NEGERI 7 KISARAN*\\n' +
        '----------------------------------------\\n' +
        '• *Timestamp* : ' + payload.timestamp + '\\n' +
        '• *Nama Siswa* : ' + payload.namaSiswa + '\\n' +
        '• *NIS/NISN* : ' + payload.nisNisn + '\\n' +
        '• *Kelas* : ' + payload.kelas + '\\n' +
        '• *Skor Benar* : ' + payload.skorBenar + ' / ' + payload.totalSoal + '\\n' +
        '• *Nilai Akhir* : ' + payload.nilaiAkhir + '%\\n' +
        '• *Status* : *' + payload.lulusTidakLulus + '*\\n' +
        '• *Status Kecurangan* : ' + payload.statusKecurangan + '\\n' +
        '----------------------------------------\\n' +
        'Identitas Guru Mapel: *EKSA YUDIKA SIRAIT S.T*\\n' +
        'Nomor WA Resmi: *+62 821-6588-5568*\\n' +
        'Email Resmi: eksayudikasirait@gmail.com';
      try {
        fetch('/__api/student-dashboard-sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'sendFonnteWhatsAppJpg',
            targetPhone: EXAM_CONFIG.waGuru,
            message: msg,
          }),
        }).catch(function() {});
      } catch (e) {}
    }

    function triggerViolation(reason) {
      if (state.view !== 'EXAM') return;
      state.violationCount++;
      const logEntry = new Date().toLocaleTimeString('id-ID') + ' - ' + reason;
      state.violationLogs.push(logEntry);
      autoSaveCurrent();
      if (state.violationCount >= 3) {
        finishExam('Diskualifikasi: 3x Pelanggaran (' + state.violationLogs.join('; ') + ')', true);
        return;
      }
      state.warningReason = reason;
      state.warningOverlay = true;
      state.warningCountdown = 15;
      clearInterval(warningTimerInterval);
      warningTimerInterval = setInterval(() => {
        state.warningCountdown--;
        if (state.warningCountdown <= 0) {
          clearInterval(warningTimerInterval);
          finishExam('Gagal Ujian: Waktu peringatan pindah tab 15 detik habis (' + reason + ')', true);
        } else {
          render();
        }
      }, 1000);
      render();
    }

    document.addEventListener('visibilitychange', () => {
      if (document.hidden && state.view === 'EXAM') {
        triggerViolation('Pindah Tab / Minimize Browser');
      }
    });

    window.addEventListener('resize', () => {
      if (state.view === 'EXAM' && checkSplitScreen()) {
        finishExam('Diskualifikasi Langsung: Terdeteksi Belah Layar (Split-Screen)', true);
      }
    });

    document.addEventListener('contextmenu', e => {
      if (state.view === 'EXAM') {
        e.preventDefault();
        triggerViolation('Klik Kanan (Right Click)');
      }
    });

    document.addEventListener('keydown', e => {
      if (state.view !== 'EXAM') return;
      if (
        e.key === 'F12' ||
        (e.ctrlKey && e.shiftKey && ['I', 'i', 'J', 'j', 'C', 'c'].includes(e.key)) ||
        (e.ctrlKey && ['U', 'u', 'C', 'c', 'V', 'v', 'P', 'p'].includes(e.key))
      ) {
        e.preventDefault();
        triggerViolation('Shortcut Terlarang (' + e.key + ')');
      }
    });

    setInterval(() => {
      if (state.tokenTimeLeft > 0) state.tokenTimeLeft--;
      else {
        state.token = generateToken();
        state.tokenTimeLeft = 15 * 60;
      }
      const el = document.getElementById('onlineTokenTimer');
      const tokEl = document.getElementById('onlineTokenCode');
      if (el) el.textContent = formatTime(state.tokenTimeLeft);
      if (tokEl) tokEl.textContent = state.token;
    }, 1000);

    function render() {
      const root = document.getElementById('app');
      if (!root) return;
      if (state.view === 'HOME') {
        root.innerHTML = \`
          <div class="max-w-4xl mx-auto p-6">
            <div class="bg-white rounded-xl shadow border border-slate-200 p-6 text-center">
              <h1 class="text-2xl font-bold text-sky-800">\${EXAM_CONFIG.sekolah}</h1>
              <p class="text-sm font-semibold text-slate-600 mt-1">\${EXAM_CONFIG.judul} • \${EXAM_CONFIG.kurikulum}</p>
              <p class="text-xs text-slate-500 mt-1">Pembuat Soal: <strong>\${EXAM_CONFIG.guru}</strong></p>
              <div class="mt-4 inline-block bg-sky-50 border border-sky-200 px-4 py-2 rounded-lg">
                <span class="text-xs text-slate-500 block">TOKEN UJIAN ONLINE (Reset <span id="onlineTokenTimer">\${formatTime(state.tokenTimeLeft)}</span>)</span>
                <span id="onlineTokenCode" class="text-2xl font-mono font-bold tracking-widest text-sky-700">\${state.token}</span>
              </div>
            </div>
          </div>
        \`;
      }
    }
    render();
  </script>
</body>
</html>`;
}
