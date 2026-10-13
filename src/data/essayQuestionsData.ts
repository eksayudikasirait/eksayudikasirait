/**
 * BANK SOAL ESAY TEST INFORMATIKA FASE D (TINGKAT SMP)
 * KURIKULUM MERDEKA — DEEP LEARNING & PEMAHAMAN KONSEPTUAL
 * UPTD SMP NEGERI 7 KISARAN
 * Guru Mata Pelajaran: Eksa Yudika Sirait S.T.
 * 
 * Terdiri dari 15 Soal Esay per Jenjang Kelas (VII & VIII) dan Semester (Ganjil & Genap)
 * untuk Latihan Dikelas / Tugas Dirumah.
 */

export type JenjangKelas = 'VII' | 'VIII';
export type SemesterType = 'Ganjil' | 'Genap';
export type EssayPackageKey = 'VII_Ganjil' | 'VII_Genap' | 'VIII_Ganjil' | 'VIII_Genap';

export interface EssayQuestion {
  id: number;
  noSoal: number;
  content: string;
  elemen: string;
  jenjang: JenjangKelas;
  semester: SemesterType;
  bobot: number;
  rubrik: string;
  kunciJawaban: string;
  kataKunci: string[];
}

export interface EssaySubmissionResult {
  submissionId: string;
  timestamp: string;
  namaSiswa: string;
  nisNisn: string;
  kelas: string;
  semester: SemesterType;
  packageKey: EssayPackageKey;
  totalSoal: number;
  totalDijawab: number;
  totalKata: number;
  jawaban: Record<number, string>;
  raguRagu: Record<number, boolean>;
  durasiDetik: number;
  catatanGuru?: string;
  persentaseSelesai: number;
  isDisqualified?: boolean;
  statusKecurangan?: string;
  violationCount?: number;
  violationLogs?: string[];
  lulusTidakLulus?: string;
}

// =========================================================================
// 1. KELAS VII — SEMESTER GANJIL (15 SOAL ESAY)
// Cakupan: Berpikir Komputasional (BK), TIK & Sistem Komputer Dasar (SK)
// =========================================================================
export const ESSAY_QUESTIONS_VII_GANJIL: EssayQuestion[] = [
  {
    id: 1,
    noSoal: 1,
    content: 'Jelaskan 4 (empat) pilar utama Berpikir Komputasional (Computational Thinking) yaitu Dekomposisi, Pengenalan Pola, Abstraksi, dan Perancangan Algoritma. Berikan satu contoh konkret penerapan keempat pilar tersebut saat Anda merencanakan kegiatan belajar kelompok di sekolah!',
    elemen: 'Berpikir Komputasional (BK)',
    jenjang: 'VII',
    semester: 'Ganjil',
    bobot: 7,
    rubrik: 'Menjelaskan definisi 4 pilar secara tepat (4 poin) dan memberikan contoh konkret kegiatan belajar kelompok yang relevan dengan masing-masing pilar (3 poin).',
    kunciJawaban: '1. Dekomposisi: Memecah masalah besar menjadi bagian kecil (contoh: membagi materi belajar menjadi bab-bab, membagi tugas pembagian materi ke tiap anggota kelompok).\n2. Pengenalan Pola: Melihat kesamaan atau tren dari masalah serupa sebelumnya (contoh: mengenali bahwa soal latihan selalu memiliki tipe hitungan dan teori yang berulang).\n3. Abstraksi: Fokus pada informasi penting dan mengabaikan hal yang tidak relevan (contoh: fokus pada inti rumus dan kisi-kisi ujian, mengabaikan obrolan santai yang membuang waktu).\n4. Algoritma: Menyusun langkah-langkah terurut dan sistematis untuk menyelesaikan tugas (contoh: membuat jadwal teratur mulai dari berdoa, review teori 20 menit, latihan soal 30 menit, hingga evaluasi bersama).',
    kataKunci: ['dekomposisi', 'pengenalan pola', 'abstraksi', 'algoritma', 'langkah terurut']
  },
  {
    id: 2,
    noSoal: 2,
    content: 'Dalam struktur data, kita mengenal konsep Tumpukan (Stack - LIFO) dan Antrean (Queue - FIFO). Uraikan perbedaan prinsip kerja kedua struktur data tersebut dan berikan 2 contoh penerapannya dalam kehidupan sehari-hari siswa di sekolah!',
    elemen: 'Berpikir Komputasional (BK)',
    jenjang: 'VII',
    semester: 'Ganjil',
    bobot: 6,
    rubrik: 'Menjelaskan prinsip LIFO dan FIFO dengan tepat (3 poin) dan memberikan minimal 2 contoh riil di sekolah untuk masing-masing konsep (3 poin).',
    kunciJawaban: '• Tumpukan (Stack): Menggunakan prinsip LIFO (Last In First Out) di mana data yang terakhir masuk adalah yang pertama kali keluar. Contoh: Tumpukan buku tugas di meja guru yang dikumpulkan terakhir berada di paling atas dan dikoreksi duluan; atau piring kotor di kantin sekolah.\n• Antrean (Queue): Menggunakan prinsip FIFO (First In First Out) di mana data yang pertama masuk adalah yang pertama keluar. Contoh: Antrean siswa membeli makanan di kantin sekolah atau antrean meminjam buku di perpustakaan.',
    kataKunci: ['stack', 'queue', 'lifo', 'fifo', 'tumpukan', 'antrean']
  },
  {
    id: 3,
    noSoal: 3,
    content: 'Komputer hanya memahami sistem bilangan biner yang terdiri dari angka 0 dan 1 (bit). Mengapa komputer dirancang menggunakan sistem bilangan biner dan bukan sistem desimal (0-9) seperti yang digunakan manusia? Jelaskan hubungannya dengan komponen saklar elektronik (transistor)!',
    elemen: 'Sistem Komputer (SK)',
    jenjang: 'VII',
    semester: 'Ganjil',
    bobot: 7,
    rubrik: 'Menjelaskan alasan fisik sirkuit transistor/elektronik digital yang memiliki 2 kondisi tegangan (on/off, tinggi/rendah) secara ilmiah dan logis.',
    kunciJawaban: 'Komputer adalah perangkat elektronik digital yang tersusun dari miliaran transistor (saklar elektronik kecil). Komponen fisik ini hanya memiliki dua kondisi stabil yang dapat diukur secara andal dan bebas gangguan noise listrik, yaitu kondisi ADA tegangan listrik (ON / logika 1) dan TIDAK ADA tegangan listrik (OFF / logika 0). Menggunakan sistem desimal (10 level tegangan berbeda) akan sangat rentan terhadap kesalahan pembacaan arus dan membuat sirkuit menjadi terlalu rumit serta tidak stabil.',
    kataKunci: ['biner', 'transistor', 'tegangan', 'on off', 'elektronik digital']
  },
  {
    id: 4,
    noSoal: 4,
    content: 'Hitunglah konversi bilangan biner 10110010 ke dalam bilangan desimal dengan menjabarkan langkah-langkah perkalian bobot perpangkatan basis dua (2⁰ hingga 2⁷) secara lengkap!',
    elemen: 'Berpikir Komputasional (BK)',
    jenjang: 'VII',
    semester: 'Ganjil',
    bobot: 7,
    rubrik: 'Menuliskan penjabaran perpangkatan 2 dari digit ke-0 sampai ke-7 dengan benar (4 poin) dan hasil akhir desimal yang tepat yaitu 178 (3 poin).',
    kunciJawaban: 'Langkah perhitungan biner 10110010₍₂₎:\n• (1 × 2⁷) = 1 × 128 = 128\n• (0 × 2⁶) = 0 × 64 = 0\n• (1 × 2⁵) = 1 × 32 = 32\n• (1 × 2⁴) = 1 × 16 = 16\n• (0 × 2³) = 0 × 8 = 0\n• (0 × 2²) = 0 × 4 = 0\n• (1 × 2¹) = 1 × 2 = 2\n• (0 × 2⁰) = 0 × 1 = 0\nJumlahkan seluruh nilai: 128 + 0 + 32 + 16 + 0 + 0 + 2 + 0 = 178₍₁₀₎.\nJadi, 10110010₍₂₎ = 178 dalam desimal.',
    kataKunci: ['178', 'perpangkatan 2', 'bobot biner', 'desimal']
  },
  {
    id: 5,
    noSoal: 5,
    content: 'Jelaskan pengertian Graphical User Interface (GUI) dan sebutkan 3 keunggulannya dibandingkan antarmuka berbasis baris perintah teks (Command Line Interface / CLI) bagi siswa yang baru pertama kali menggunakan komputer!',
    elemen: 'Teknologi Informasi & Komunikasi (TIK)',
    jenjang: 'VII',
    semester: 'Ganjil',
    bobot: 6,
    rubrik: 'Mendefinisikan GUI (antarmuka grafis dengan ikon, jendela, mouse) dan menyebutkan 3 keuntungan seperti kemudahan penggunaan, visual intuitif, dan tidak perlu menghafal baris perintah kode.',
    kunciJawaban: 'GUI adalah antarmuka visual grafis yang memungkinkan pengguna berinteraksi dengan komputer melalui elemen visual seperti ikon, jendela (windows), tombol, dan pointer mouse.\nKeunggulannya dibanding CLI:\n1. Ramah pemula (User-Friendly): Pengguna tidak perlu menghafal sintaks perintah teks yang rumit.\n2. Visual Interaktif: Navigasi cukup dilakukan dengan klik mouse atau sentuhan jari.\n3. Efisiensi & Minim Kesalahan: Pilihan menu dan dialog konfirmasi mencegah salah eksekusi perintah fatal.',
    kataKunci: ['gui', 'ikon', 'user friendly', 'interaktif', 'visual']
  },
  {
    id: 6,
    noSoal: 6,
    content: 'Sebagai siswa SMP Negeri 7 Kisaran, Anda memiliki banyak file tugas pelajaran (Informatika, Matematika, IPA, Bahasa Indonesia). Rancanglah sebuah struktur hierarki folder yang rapi dan terorganisir di dalam komputer, serta berikan aturan penamaan file tugas yang baik agar mudah dicari saat dibutuhkan!',
    elemen: 'Teknologi Informasi & Komunikasi (TIK)',
    jenjang: 'VII',
    semester: 'Ganjil',
    bobot: 7,
    rubrik: 'Menampilkan bagan/struktur folder hierarkis (Folder Induk -> Kelas/Semester -> Mata Pelajaran -> Tugas) dan format standar nama file (misal: TUGAS_INFORMATIKA_01_NAMA_KELAS.docx).',
    kunciJawaban: '1. Struktur Hierarki Folder:\n   📁 Data Belajar Siswa (Folder Induk)\n      └── 📁 Kelas VII\n           ├── 📁 Semester 1 (Ganjil)\n           │    ├── 📁 01_Informatika\n           │    ├── 02_Matematika\n           │    └── 03_IPA\n           └── 📁 Semester 2 (Genap)\n2. Aturan Penamaan File Standar:\nGunakan format terstruktur: [KodeMapel]_[JenisTugas]_[Materi]_[NamaSiswa]_[Kelas].[ekstensi]\nContoh: INFO_Tugas1_SistemKomputer_Ahmad_VII-1.docx\nManfaat: Menghindari file tertukar, memudahkan pencarian berdasarkan tanggal atau abjad, dan jelas identitas kepemilikannya.',
    kataKunci: ['struktur folder', 'hierarki', 'penamaan file', 'ekstensi', 'terorganisir']
  },
  {
    id: 7,
    noSoal: 7,
    content: 'Jelaskan perbedaan fungsi antara ekstensi file .docx, .xlsx, .pdf, dan .jpg! Sebutkan jenis aplikasi apa saja yang tepat digunakan untuk membuka dan mengedit masing-masing jenis file tersebut!',
    elemen: 'Teknologi Informasi & Komunikasi (TIK)',
    jenjang: 'VII',
    semester: 'Ganjil',
    bobot: 6,
    rubrik: 'Menjelaskan karakteristik 4 ekstensi file tersebut beserta software pengolah dokumen kata, angka, pembaca dokumen portabel, dan penampil gambar.',
    kunciJawaban: '• .docx: File dokumen teks pengolah kata (Word Processing). Dibuka/diedit dengan Microsoft Word, Google Docs, atau LibreOffice Writer.\n• .xlsx: File lembar kerja pengolah angka/tabel spreadsheet. Dibuka/diedit dengan Microsoft Excel, Google Sheets, atau Calc.\n• .pdf: Portable Document Format, format dokumen tetap untuk dicetak dan dibaca agar tata letak tidak berubah. Dibuka dengan Adobe Acrobat Reader atau web browser.\n• .jpg / .jpeg: Format file gambar grafis terkompresi. Dibuka dengan Photos viewer, Paint, atau Photoshop.',
    kataKunci: ['docx', 'xlsx', 'pdf', 'jpg', 'ekstensi file']
  },
  {
    id: 8,
    noSoal: 8,
    content: 'Saat mencari materi pembelajaran Informatika di mesin pencari (Google Search), bagaimana cara Anda menggunakan operator pencarian khusus seperti tanda kutip ("..."), minus (-), dan filetype: untuk mendapatkan hasil yang akurat dan relevan? Berikan contoh kata kuncinya!',
    elemen: 'Teknologi Informasi & Komunikasi (TIK)',
    jenjang: 'VII',
    semester: 'Ganjil',
    bobot: 7,
    rubrik: 'Menjelaskan fungsi tanda kutip (frasa persis), minus (mengecualikan kata), dan operator filetype: beserta contoh query pencarian yang valid.',
    kunciJawaban: '• Tanda Kutip ("..."): Mencari frasa persis tanpa dipisah. Contoh: "Sistem Komputer Fase D"\n• Tanda Minus (-): Mengecualikan kata tertentu dari hasil pencarian. Contoh: materi informatika smp -iklan\n• Operator filetype: Menyaring hasil hanya untuk jenis dokumen tertentu. Contoh: modul ajar informatika kelas 7 filetype:pdf\nContoh pencarian gabungan lengkap:\n"perangkat keras komputer" kelas 7 filetype:pdf -jual',
    kataKunci: ['mesin pencari', 'operator pencarian', 'filetype', 'tanda kutip', 'boolean search']
  },
  {
    id: 9,
    noSoal: 9,
    content: 'Tuliskan rancangan sebuah surat elektronik (Surel / Email) yang santun dan beretika untuk mengumpulkan tugas Informatika kepada guru mata pelajaran (Bpk. Eksa Yudika Sirait S.T). Tuliskan alamat penerima, baris subjek, salam pembuka, isi surel, penutup, dan keterangan lampiran file!',
    elemen: 'Teknologi Informasi & Komunikasi (TIK)',
    jenjang: 'VII',
    semester: 'Ganjil',
    bobot: 7,
    rubrik: 'Format email lengkap dengan alamat tujuan yang benar, subjek yang informatif, salam pembuka hormat, bahasa isi yang santun, dan salam penutup disertai identitas nama dan kelas.',
    kunciJawaban: 'Kepada: eksasirait@gmail.com\nSubjek: Pengumpulan Tugas Esay Informatika Kelas VII-1 - [Nama Lengkap Siswa] (NISN: 0098123456)\n\nSelamat pagi / siang, Yth. Bapak Eksa Yudika Sirait S.T,\n\nPerkenalkan saya [Nama Lengkap Siswa], siswa Kelas VII-1 UPTD SMP Negeri 7 Kisaran. Bersama dengan surel ini, saya bermaksud mengumpulkan lembar jawaban Tugas Esay Informatika materi Sistem Komputer & Berpikir Komputasional.\n\nFile tugas telah saya lampirkan dalam format PDF dengan nama file: TUGAS_ESAY_INFO_VII1_[NAMA].pdf.\n\nDemikian surel ini saya sampaikan. Terima kasih banyak atas bimbingan dan arahan Bapak.\n\nHormat saya,\n[Nama Lengkap Siswa]\nKelas VII-1 / No. Absen [..]\nUPTD SMP Negeri 7 Kisaran',
    kataKunci: ['email', 'subjek', 'lampiran', 'etika surat', 'santun']
  },
  {
    id: 10,
    noSoal: 10,
    content: 'Sistem komputer terdiri dari perangkat keras (Hardware) dengan 4 fungsi utama: Input, Processing, Output, dan Storage. Jelaskan perbedaan masing-masing kategori tersebut dan sebutkan minimal 2 contoh perangkat untuk setiap kategori!',
    elemen: 'Sistem Komputer (SK)',
    jenjang: 'VII',
    semester: 'Ganjil',
    bobot: 7,
    rubrik: 'Menjelaskan definisi ke-4 kategori hardware dan memberikan 2 contoh perangkat yang valid untuk masing-masing kategori.',
    kunciJawaban: '1. Input Device (Perangkat Masukan): Alat untuk memasukkan data/instruksi ke komputer. Contoh: Keyboard, Mouse, Scanner, Mikrofon.\n2. Processing Device (Perangkat Pemroses): Komponen yang mengolah dan memproses data secara komputasi. Contoh: Processor (CPU), GPU (Graphics Card).\n3. Output Device (Perangkat Keluaran): Alat untuk menampilkan atau mengeluarkan hasil olahan data ke pengguna. Contoh: Monitor, Printer, Speaker, Proyektor.\n4. Storage Device (Perangkat Penyimpanan): Media untuk menyimpan data secara permanen atau sementara. Contoh: SSD, Harddisk (HDD), Flashdisk, Kartu Memori.',
    kataKunci: ['input', 'processing', 'output', 'storage', 'perangkat keras']
  },
  {
    id: 11,
    noSoal: 11,
    content: 'CPU sering disebut sebagai "otak" dari sebuah komputer. CPU memiliki dua bagian inti yaitu ALU (Arithmetic Logic Unit) dan CU (Control Unit). Uraikan fungsi spesifik dari ALU dan CU dalam memproses instruksi program!',
    elemen: 'Sistem Komputer (SK)',
    jenjang: 'VII',
    semester: 'Ganjil',
    bobot: 7,
    rubrik: 'Menjelaskan fungsi ALU dalam perhitungan matematis dan perbandingan logika, serta fungsi CU dalam mengatur lalu lintas data dan sinkronisasi eksekusi instruksi.',
    kunciJawaban: '• ALU (Arithmetic Logic Unit): Bertugas melakukan semua operasi perhitungan aritmatika (penjumlahan, pengurangan, perkalian, pembagian) dan operasi logika perbandingan (AND, OR, NOT, membandingkan apakah nilai A > B atau sama dengan).\n• CU (Control Unit): Bertugas sebagai pengatur dan pengendali lalu lintas instruksi seluruh komputer. CU mengambil (fetch) instruksi dari memori, menerjemahkannya (decode), dan mengatur pengiriman sinyal kontrol ke perangkat lain agar instruksi dieksekusi secara tepat waktu.',
    kataKunci: ['alu', 'control unit', 'arithmetic logic unit', 'perhitungan', 'sinyal kontrol']
  },
  {
    id: 12,
    noSoal: 12,
    content: 'Jelaskan perbedaan mendasar antara memori utama RAM (Random Access Memory) dan ROM (Read Only Memory)! Mengapa RAM bersifat Volatile sedangkan media penyimpanan seperti SSD atau Harddisk bersifat Non-Volatile?',
    elemen: 'Sistem Komputer (SK)',
    jenjang: 'VII',
    semester: 'Ganjil',
    bobot: 7,
    rubrik: 'Menjelaskan perbedaan sifat baca/tulis RAM vs ROM dan konsep sifat volatile (hilang saat listrik padam) vs non-volatile (tetap tersimpan tanpa daya listrik).',
    kunciJawaban: '• RAM: Memori kerja tempat menyimpan instruksi dan data aplikasi yang sedang aktif berjalan. Bersifat Volatile, artinya seluruh data di dalamnya akan hilang seketika saat komputer dimatikan atau listrik terputus.\n• ROM: Memori yang hanya bisa dibaca dan berisi instruksi dasar pabrikan (firmware/BIOS). Bersifat Non-Volatile, artinya data tetap tersimpan secara permanen meskipun tidak ada aliran listrik.\n• SSD/Harddisk bersifat Non-Volatile karena menggunakan sel memori flash atau piringan magnetik yang mempertahankan orientasi muatan tanpa memerlukan pasokan arus listrik terus menerus.',
    kataKunci: ['ram', 'rom', 'volatile', 'non-volatile', 'hilang listrik']
  },
  {
    id: 13,
    noSoal: 13,
    content: 'Perangkat lunak (Software) dibedakan menjadi Sistem Operasi (Operating System) dan Perangkat Lunak Aplikasi (Application Software). Jelaskan hubungan ketergantungan antara Sistem Operasi dengan Perangkat Lunak Aplikasi saat pengguna menjalankan program di komputer!',
    elemen: 'Sistem Komputer (SK)',
    jenjang: 'VII',
    semester: 'Ganjil',
    bobot: 7,
    rubrik: 'Menjelaskan bahwa Sistem Operasi bertindak sebagai jembatan/fondasi antara hardware dan aplikasi. Aplikasi tidak dapat berjalan langsung di hardware tanpa perantara OS.',
    kunciJawaban: 'Sistem Operasi (OS seperti Windows, Linux, Android) bertindak sebagai fondasi utama dan jembatan penghubung antara perangkat keras (hardware) dan pengguna.\nPerangkat Lunak Aplikasi (seperti Ms Word, Browser Chrome, Game) tidak dapat berinteraksi langsung dengan prosesor atau kartu grafis. Aplikasi bergantung sepenuhnya pada Sistem Operasi untuk meminta sumber daya memori RAM, akses penyimpanan file, dan tampilan ke layar. Jika tidak ada sistem operasi, aplikasi tidak dapat dimuat atau dijalankan.',
    kataKunci: ['sistem operasi', 'perangkat lunak aplikasi', 'jembatan hardware', 'alokasi sumber daya']
  },
  {
    id: 14,
    noSoal: 14,
    content: 'Jelaskan apa yang dimaksud dengan Siklus Pemrosesan Data (Input -> Process -> Output -> Storage) dalam sistem komputer. Berikan satu contoh alur kasus nyata saat seorang siswa mengetik tugas di Microsoft Word hingga menyimpannya ke flashdisk!',
    elemen: 'Sistem Komputer (SK)',
    jenjang: 'VII',
    semester: 'Ganjil',
    bobot: 6,
    rubrik: 'Menjelaskan tahapan siklus pemrosesan data secara berurutan dan mengaitkannya dengan alur nyata saat mengetik, memproses huruf, menampilkan ke layar, dan menyimpan file.',
    kunciJawaban: '1. Input: Siswa menekan tuts keyboard untuk mengetik kalimat tugas.\n2. Process: CPU menerima kode tombol biner, mengolah huruf, dan menerapkan format paragraf di memori kerja (RAM).\n3. Output: Layar monitor menampilkan huruf dan paragraf hasil ketikan secara visual kepada siswa.\n4. Storage: Siswa mengklik tombol "Simpan" (Save), lalu sistem operasi menulis data dokumen tersebut ke media penyimpanan permanen Flashdisk (.docx) agar aman dan dapat dibuka kembali nanti.',
    kataKunci: ['input', 'process', 'output', 'storage', 'alur komputasi']
  },
  {
    id: 15,
    noSoal: 15,
    content: 'Sebutkan 3 tips merawat perangkat keras komputer di laboratorium sekolah agar tetap awet, tidak cepat panas, dan terhindar dari kerusakan fatal akibat debu maupun kelistrikan!',
    elemen: 'Sistem Komputer (SK)',
    jenjang: 'VII',
    semester: 'Ganjil',
    bobot: 6,
    rubrik: 'Menyebutkan 3 tips perawatan hardware yang logis (ventilasi/kebersihan debu, pemakaian stabilizer/UPS, shutdown yang benar, menjaga cairan dari lab).',
    kunciJawaban: '1. Menjaga Kebersihan & Sirkulasi Udara: Bersihkan debu pada kipas pendingin dan ventilasi casing komputer secara berkala agar aliran udara lancar dan komponen tidak mengalami overheat (kepanasan).\n2. Mematikan Komputer Sesuai Prosedur (Shutdown): Jangan mencabut kabel daya secara paksa saat komputer menyala agar sistem operasi dan harddisk/SSD tidak mengalami kerusakan data (bad sector).\n3. Menstabilkan Arus Listrik & Menjauhkan Cairan: Gunakan UPS atau stabilizer untuk mencegah korsleting akibat lonjakan listrik, serta dilarang membawa makanan dan minuman ke dalam lab komputer untuk menghindari tumpahan cairan.',
    kataKunci: ['perawatan hardware', 'ventilasi debu', 'shutdown benar', 'stabilizer', 'lab komputer']
  }
];

// =========================================================================
// 2. KELAS VII — SEMESTER GENAP (15 SOAL ESAY)
// Cakupan: Jaringan Komputer & Internet (JKI), Analisis Data (AD),
//          Algoritma & Pemrograman Visual Scratch (AP), Dampak Sosial (DSI)
// =========================================================================
export const ESSAY_QUESTIONS_VII_GENAP: EssayQuestion[] = [
  {
    id: 1,
    noSoal: 1,
    content: 'Jelaskan perbedaan antara Jaringan Komputer Lokal (LAN - Local Area Network) dan Jaringan Komputer Global (Internet / WAN). Mengapa komputer-komputer di laboratorium SMP Negeri 7 Kisaran perlu dihubungkan dalam satu jaringan LAN?',
    elemen: 'Jaringan Komputer & Internet (JKI)',
    jenjang: 'VII',
    semester: 'Genap',
    bobot: 7,
    rubrik: 'Menjelaskan cakupan geografis LAN vs Internet serta manfaat LAN di lab sekolah (berbagi printer, berbagi file tugas, ujian bersama tanpa internet luar).',
    kunciJawaban: '• LAN (Local Area Network): Jaringan komputer berkecepatan tinggi yang mencakup area geografis terbatas seperti dalam satu ruangan laboratorium atau gedung sekolah.\n• Internet / WAN: Jaringan komputer global berskala dunia yang menghubungkan jutaan komputer antar pulau dan negara menggunakan protokol global.\n• Manfaat LAN di Lab SMP Negeri 7 Kisaran: Memudahkan berbagi sumber daya (sharing printer bersama), mempermudah pengiriman file materi/tugas antara komputer guru dan siswa, serta memungkinkan pelaksanaan ujian lokal ANBK secara cepat dan stabil.',
    kataKunci: ['lan', 'internet', 'wan', 'sharing resource', 'lab sekolah']
  },
  {
    id: 2,
    noSoal: 2,
    content: 'Jelaskan bagaimana cara kerja fitur Hotspot Pribadi (Tethering) pada smartphone untuk membagikan koneksi internet ke laptop siswa, serta sebutkan risiko baterai dan keamanan jika fitur tersebut tidak dipasangi kata sandi (WPA2/WPA3)!',
    elemen: 'Jaringan Komputer & Internet (JKI)',
    jenjang: 'VII',
    semester: 'Genap',
    bobot: 7,
    rubrik: 'Menjelaskan mekanisme tethering (ponsel sebagai router/access point) dan bahaya jika tanpa password (kuota tersedot pihak luar, baterai cepat panas, data rentan disadap).',
    kunciJawaban: '• Cara Kerja Tethering: Smartphone bertindak sebagai mini-router / wireless access point portabel yang menerima koneksi data seluler dari BTS operator, lalu memancarkannya kembali melalui gelombang radio Wi-Fi lokal ke laptop.\n• Risiko Tanpa Sandi: Pengguna asing di sekitar dapat terhubung secara bebas sehingga kuota internet habis mendadak, kecepatan internet menjadi lambat, baterai ponsel cepat terkuras dan panas karena memproses banyak koneksi, serta data lalu lintas jaringan berisiko diakses oleh pihak yang tidak bertanggung jawab.',
    kataKunci: ['tethering', 'hotspot', 'access point', 'keamanan wifi', 'kuota']
  },
  {
    id: 3,
    noSoal: 3,
    content: 'Kriptografi klasik Caesar Cipher adalah teknik enkripsi sederhana dengan menggeser huruf alfabet sejauh n langkah. Jika digunakan pergeseran +3 (A menjadi D, B menjadi E, dst.), lakukan enkripsi pada kata "INFORMATIKA" dan jelaskan mengapa enkripsi sangat penting dalam komunikasi digital!',
    elemen: 'Jaringan Komputer & Internet (JKI)',
    jenjang: 'VII',
    semester: 'Genap',
    bobot: 7,
    rubrik: 'Menyajikan hasil cipher text yang tepat untuk "INFORMATIKA" dengan pergeseran +3 (LQIRUPDWLND) dan menjelaskan peran enkripsi untuk melindungi privasi data.',
    kunciJawaban: 'Proses Enkripsi kata "INFORMATIKA" geser +3:\n• I -> L\n• N -> Q\n• F -> I\n• O -> R\n• R -> U\n• M -> P\n• A -> D\n• T -> W\n• I -> L\n• K -> N\n• A -> D\nHasil Sandi (Ciphertext): LQIRUPDWLND\nPentingnya Enkripsi: Melindungi kerahasiaan data (Confidentiality) saat dikirim melalui internet publik sehingga pihak ketiga yang menyadap tidak dapat membaca isi pesan asli tanpa kunci dekripsi yang sah.',
    kataKunci: ['caesar cipher', 'lqirupdwlnd', 'enkripsi', 'kriptografi', 'kerahasiaan data']
  },
  {
    id: 4,
    noSoal: 4,
    content: 'Dalam aplikasi lembar kerja (Spreadsheet / Microsoft Excel), jelaskan perbedaan antara Kolom (Column), Baris (Row), Sel (Cell), dan Rentang (Range)! Berikan contoh penulisan notasi sel dan rentang yang benar!',
    elemen: 'Analisis Data (AD)',
    jenjang: 'VII',
    semester: 'Genap',
    bobot: 6,
    rubrik: 'Mendefinisikan kolom (huruf vertikal), baris (angka horizontal), sel (titik temu kolom & baris, contoh B4), dan range (kumpulan sel, contoh A1:D10).',
    kunciJawaban: '• Kolom (Column): Bagian lembar kerja yang membentang secara vertikal, ditandai dengan huruf alfabet (A, B, C, dst.).\n• Baris (Row): Bagian lembar kerja yang membentang secara horizontal, ditandai dengan angka (1, 2, 3, dst.).\n• Sel (Cell): Titik temu atau kotak pertemuan antara kolom dan baris. Contoh notasi: Sel B4 (berada di kolom B, baris 4).\n• Rentang (Range): Sekelompok sel terpilih yang membentuk persegi panjang. Contoh notasi: Range A1:C10 (mencakup sel dari A1 hingga C10).',
    kataKunci: ['kolom', 'baris', 'sel', 'rentang', 'range excel']
  },
  {
    id: 5,
    noSoal: 5,
    content: 'Diberikan tabel nilai siswa pada sel B2 sampai B6 berisi angka: 80, 75, 90, 85, 70. Tuliskan rumus formula Excel yang tepat untuk menghitung:\na) Total keseluruhan nilai\nb) Rata-rata nilai\nc) Nilai tertinggi\nd) Nilai terendah',
    elemen: 'Analisis Data (AD)',
    jenjang: 'VII',
    semester: 'Genap',
    bobot: 7,
    rubrik: 'Menuliskan 4 rumus dengan sintaks yang valid diawali tanda sama dengan (=SUM, =AVERAGE, =MAX, =MIN) untuk rentang B2:B6.',
    kunciJawaban: 'a) Total keseluruhan nilai: =SUM(B2:B6)\nb) Rata-rata nilai: =AVERAGE(B2:B6)\nc) Nilai tertinggi: =MAX(B2:B6)\nd) Nilai terendah: =MIN(B2:B6)\nCatatan: Semua rumus di Excel wajib diawali dengan tanda sama dengan (=) dan argumen rentang ditulis dalam tanda kurung.',
    kataKunci: ['=sum', '=average', '=max', '=min', 'rumus excel']
  },
  {
    id: 6,
    noSoal: 6,
    content: 'Di SMP Negeri 7 Kisaran, batas KKM mata pelajaran Informatika adalah 75. Tuliskan rumus fungsi logika =IF di Microsoft Excel pada sel C2 untuk menentukan status ketuntasan siswa berdasarkan nilai pada sel B2 (Jika nilai >= 75 maka "LULUS", jika di bawah 75 maka "REMIDIAL")!',
    elemen: 'Analisis Data (AD)',
    jenjang: 'VII',
    semester: 'Genap',
    bobot: 7,
    rubrik: 'Menuliskan sintaks rumus =IF(B2>=75, "LULUS", "REMIDIAL") dengan argumen uji logika, nilai jika benar, dan nilai jika salah secara tepat.',
    kunciJawaban: 'Rumus fungsi IF pada sel C2:\n=IF(B2>=75, "LULUS", "REMIDIAL")\natau (jika menggunakan pemisah titik koma sesuai regional bahasa Indonesia):\n=IF(B2>=75; "LULUS"; "REMIDIAL")\nPenjelasan komponen:\n1. B2>=75 : Kondisi uji logika apakah nilai di sel B2 lebih besar atau sama dengan 75.\n2. "LULUS" : Teks output jika kondisi bernilai BENAR (True).\n3. "REMIDIAL" : Teks output jika kondisi bernilai SALAH (False).',
    kataKunci: ['=if', 'lulus', 'remidial', 'uji logika', 'kkm 75']
  },
  {
    id: 7,
    noSoal: 7,
    content: 'Jelaskan fungsi fitur Sort (Pengurutan) dan Filter (Penyaringan) data pada spreadsheet. Berikan satu skenario nyata bagaimana seorang guru mapel menggunakan kedua fitur tersebut untuk mengelola nilai ujian 100 siswa!',
    elemen: 'Analisis Data (AD)',
    jenjang: 'VII',
    semester: 'Genap',
    bobot: 6,
    rubrik: 'Menjelaskan perbedaan Sort (mengatur urutan Ascending/Descending) vs Filter (menampilkan data yang memenuhi kriteria tertentu dan menyembunyikan yang lain) pada skenario nilai siswa.',
    kunciJawaban: '• Sort (Pengurutan): Mengatur susunan data berdasarkan urutan tertentu. Contoh: Guru melakukan Sort Descending (Z-to-A) pada kolom Nilai Akhir untuk melihat ranking siswa dari nilai tertinggi ke terendah.\n• Filter (Penyaringan): Menampilkan baris data tertentu yang memenuhi kriteria dan menyembunyikan sementara data lainnya tanpa menghapusnya. Contoh: Guru mengaktifkan filter pada kolom Kelas untuk hanya menampilkan siswa "Kelas VII-1", atau memfilter kolom Status hanya untuk siswa yang bernilai "REMIDIAL".',
    kataKunci: ['sort', 'filter', 'pengurutan', 'penyaringan', 'ranking']
  },
  {
    id: 8,
    noSoal: 8,
    content: 'Dalam aplikasi pemrograman visual Scratch, jelaskan apa yang dimaksud dengan Sprite, Stage, dan Skrip (Script Blocks)! Bagaimana ketiga komponen tersebut bekerja bersama saat membuat sebuah game sederhana?',
    elemen: 'Algoritma & Pemrograman (AP)',
    jenjang: 'VII',
    semester: 'Genap',
    bobot: 7,
    rubrik: 'Menjelaskan peran Sprite (karakter/objek), Stage (panggung latar), dan Script Blocks (balok kode perintah) dan interaksi ketiganya.',
    kunciJawaban: '• Sprite: Karakter atau objek visual yang dapat digerakkan, dianimasikan, dan diprogram di Scratch (contoh: karakter kucing Scratch Cat).\n• Stage: Area panggung latar belakang (backdrop) tempat semua Sprite tampil dan berinteraksi sesuai koordinat X dan Y.\n• Skrip (Script Blocks): Susunan balok-balok kode visual (puzzle) yang disusun secara logika untuk memerintahkan Sprite apa yang harus dilakukan.\n• Kerja Bersama: Ketika tombol bendera hijau ditekan, Skrip dieksekusi oleh komputer untuk menggerakkan Sprite di atas Stage (misal merespons tombol keyboard panah saat pemain memainkan game).',
    kataKunci: ['scratch', 'sprite', 'stage', 'skrip', 'pemrograman visual']
  },
  {
    id: 9,
    noSoal: 9,
    content: 'Uraikan perbedaan fungsi antara blok perulangan "repeat 10" (ulangi 10 kali) dan "forever" (selamanya) pada Scratch! Kapan waktu yang tepat menggunakan masing-masing blok tersebut?',
    elemen: 'Algoritma & Pemrograman (AP)',
    jenjang: 'VII',
    semester: 'Genap',
    bobot: 6,
    rubrik: 'Menjelaskan bahwa "repeat n" adalah counted loop dengan batas pasti, sedangkan "forever" adalah infinite loop yang berjalan terus sampai game dihentikan.',
    kunciJawaban: '• Blok "repeat 10": Melakukan perulangan perintah sejumlah angka yang sudah ditentukan (10 kali), lalu program berpindah ke baris perintah berikutnya di bawahnya. Tepat digunakan untuk animasi lompatan karakter atau gerakan langkah yang terbatas.\n• Blok "forever": Melakukan perulangan terus-menerus tanpa henti sepanjang permainan berjalan sampai tombol stop ditekan. Tepat digunakan untuk memantau kontrol pemain (misal: selalu mendeteksi apakah tombol panah kanan ditekan) atau animasi musik latar game.',
    kataKunci: ['repeat', 'forever', 'looping', 'perulangan scratch', 'iterasi']
  },
  {
    id: 10,
    noSoal: 10,
    content: 'Dalam sebuah game Scratch, buatlah alur logika algoritma untuk mendeteksi tabrakan antara Sprite Kucing dengan Sprite Apel: Jika Kucing menyentuh Apel, skor bertambah 1 dan suara "Pop" dibunyikan. Tuliskan urutan blok logika yang harus disusun!',
    elemen: 'Algoritma & Pemrograman (AP)',
    jenjang: 'VII',
    semester: 'Genap',
    bobot: 7,
    rubrik: 'Menyusun urutan logika: when green flag clicked -> forever -> if touching (Apel) then -> change score by 1 -> play sound Pop -> hide / respawn.',
    kunciJawaban: 'Urutan blok logika Scratch:\n1. [When Green Flag Clicked] (Saat bendera hijau diklik)\n2. [Set Score to 0] (Inisialisasi variabel skor = 0)\n3. [Forever] (Ulangi selamanya):\n    4. [If <touching (Sprite Apel)?> then]\n        5. [Change (Score) by 1] (Tambah nilai skor sebesar 1)\n        6. [Start sound (Pop)] (Mainkan efek audio pop)\n        7. [Go to random position] (Pindahkan apel ke posisi acak baru agar tidak tersentuh terus-menerus)\n        8. [Wait 0.2 seconds] (Jeda sesaat agar tidak menambah skor berlebihan)',
    kataKunci: ['if touching', 'change score', 'sound pop', 'forever', 'algoritma game']
  },
  {
    id: 11,
    noSoal: 11,
    content: 'Jelaskan apa yang dimaksud dengan Variabel dalam pemrograman! Mengapa variabel sangat penting dalam membuat kuis atau game di Scratch? Berikan 2 contoh penggunaan variabel!',
    elemen: 'Algoritma & Pemrograman (AP)',
    jenjang: 'VII',
    semester: 'Genap',
    bobot: 6,
    rubrik: 'Mendefinisikan variabel sebagai wadah penampung nilai data di memori yang nilainya dapat berubah selama program berjalan dan memberikan 2 contoh (skor, nyawa/waktu).',
    kunciJawaban: 'Variabel adalah wadah penyimpanan bernama di memori komputer yang digunakan untuk menampung suatu nilai data yang nilainya dapat berubah-ubah selama program sedang dieksekusi.\nVariabel sangat penting karena komputer membutuhkan memori untuk mengingat status permainan saat ini.\nContoh penggunaan variabel:\n1. Variabel "Skor / Nilai": Mencatat perolehan poin siswa saat menjawab soal kuis dengan benar.\n2. Variabel "Sisa_Waktu / Timer": Menghitung mundur batas waktu ujian (misal dari 60 detik berkurang tiap detik).',
    kataKunci: ['variabel', 'wadah memori', 'skor', 'timer', 'data berubah']
  },
  {
    id: 12,
    noSoal: 12,
    content: 'Jejak digital (Digital Footprint) terbagi menjadi jejak digital aktif dan jejak digital pasif. Uraikan perbedaan keduanya dan jelaskan dampak jangka panjang dari jejak digital yang buruk bagi masa depan seorang pelajar!',
    elemen: 'Dampak Sosial Informatika (DSI)',
    jenjang: 'VII',
    semester: 'Genap',
    bobot: 7,
    rubrik: 'Menjelaskan jejak aktif (ditinggalkan sengaja seperti postingan/komentar) vs pasif (tercatat otomatis seperti riwayat browsing/IP) serta dampak buruk (reputasi, seleksi beasiswa/kerja).',
    kunciJawaban: '• Jejak Digital Aktif: Data yang ditinggalkan oleh pengguna secara sengaja dan sadar di internet. Contoh: Mengunggah foto di media sosial, menulis status, memberikan komentar, mengirim email.\n• Jejak Digital Pasif: Data yang terekam secara otomatis tanpa disadari penuh oleh pengguna. Contoh: Alamat IP perangkat, riwayat pencarian browser, data lokasi GPS, cookie web.\n• Dampak Jejak Digital Buruk: Sekali data diunggah ke internet, data tersebut sangat sulit dihapus sepenuhnya. Jejak digital negatif (seperti ujaran kebencian atau komentar kasar) dapat mencoreng nama baik keluarga, merusak peluang seleksi masuk sekolah/beasiswa bergengsi, dan mempersulit proses lamaran pekerjaan di masa depan.',
    kataKunci: ['jejak digital aktif', 'jejak digital pasif', 'reputasi', 'masa depan', 'internet sehat']
  },
  {
    id: 13,
    noSoal: 13,
    content: 'Perundungan siber (Cyberbullying) adalah salah satu ancaman serius di dunia digital. Sebutkan 3 bentuk cyberbullying yang sering terjadi di kalangan pelajar serta langkah apa yang harus dilakukan siswa jika menjadi korban atau melihat temannya dirundung!',
    elemen: 'Dampak Sosial Informatika (DSI)',
    jenjang: 'VII',
    semester: 'Genap',
    bobot: 7,
    rubrik: 'Menyebutkan 3 bentuk cyberbullying (pelecehan pesan, penyebaran rumor/foto pribadi, pengucilan di grup) dan langkah penanganan yang tepat (jangan membalas, simpan bukti tangkapan layar, blokir pelaku, laporkan ke guru/orang tua).',
    kunciJawaban: 'Bentuk Cyberbullying:\n1. Harassment: Mengirimkan pesan kasar, makian, atau ancaman secara berulang di kolom komentar atau pesan pribadi.\n2. Doxing / Outing: Menyebarkan foto pribadi, identitas rahasia, atau aib seseorang tanpa izin untuk mempermalukannya.\n3. Exclusion: Mengucilkan atau sengaja mengeluarkan teman dari grup kelas secara kasar untuk menjatuhkan mentalnya.\nLangkah Penanganan Korban:\n1. Jangan membalas dengan emosi yang sama agar situasi tidak semakin memanas.\n2. Simpan barang bukti dengan melakukan tangkapan layar (screenshot) pesan dan profil pelaku.\n3. Blokir akun pelaku dan segera melapor kepada Guru BK, Wali Kelas, Guru Mapel, atau orang tua untuk mendapat perlindungan.',
    kataKunci: ['cyberbullying', 'harassment', 'bukti screenshot', 'blokir pelaku', 'lapor guru']
  },
  {
    id: 14,
    noSoal: 14,
    content: 'Jelaskan etika berinternet (Netiket / Netiquette) yang wajib diterapkan saat berdiskusi di grup WhatsApp kelas bersama guru dan teman-teman sekolah! Berikan minimal 3 contoh aturan kesopanan!',
    elemen: 'Dampak Sosial Informatika (DSI)',
    jenjang: 'VII',
    semester: 'Genap',
    bobot: 6,
    rubrik: 'Menjelaskan prinsip netiket dan menyebutkan 3 aturan etika (bahasa sopan, perhatikan jam komunikasi, tidak menyebar hoaks/spam, gunakan salam pembuka).',
    kunciJawaban: 'Netiket adalah norma kesopanan dan etika berkomunikasi di ruang digital.\nAturan di grup WhatsApp kelas:\n1. Gunakan Bahasa yang Santun & Jelas: Hindari menggunakan huruf kapital semua (karena berkesan berteriak) dan gunakan salam serta panggilan yang hormat kepada bapak/ibu guru.\n2. Perhatikan Waktu Bertanya: Jangan mengirimkan pesan pada larut malam di luar jam wajar kecuali dalam kondisi darurat sekolah.\n3. Dilarang Menyebarkan Hoaks & Konten Tidak Relevan: Pastikan pesan yang dikirim berkaitan dengan pembelajaran, dilarang menyebarkan berita bohong, gosip, atau pesan berantai yang tidak jelas sumbernya.',
    kataKunci: ['netiket', 'etika berinternet', 'bahasa santun', 'jam wajar', 'anti hoaks']
  },
  {
    id: 15,
    noSoal: 15,
    content: 'Mengapa kita tidak boleh sembarangan mengunduh file atau mengklik tautan (link) dari nomor WhatsApp atau surel yang tidak dikenal? Jelaskan ancaman bahaya Phishing dan Malware bagi perangkat Anda!',
    elemen: 'Jaringan Komputer & Internet (JKI)',
    jenjang: 'VII',
    semester: 'Genap',
    bobot: 7,
    rubrik: 'Menjelaskan bahaya Phishing (penipuan pencurian kredensial akun) dan Malware/Virus (perangkat lunak perusak yang dapat meretas data atau merusak HP/Laptop).',
    kunciJawaban: '• Phishing: Upaya penipuan online untuk memancing korban agar menyerahkan informasi rahasia (seperti kata sandi akun Google, PIN, atau data pribadi) melalui tautan web palsu yang dibuat sangat mirip dengan aslinya.\n• Malware (Malicious Software): Perangkat lunak jahat (seperti virus, trojan, atau spyware) yang otomatis terpasang saat file berbahaya diunduh. Malware dapat merusak sistem operasi, memperlambat kinerja perangkat, menyadap pengetikan keyboard (keylogger), hingga mencuri foto dan data pribadi siswa.',
    kataKunci: ['phishing', 'malware', 'tautan berbahaya', 'keamanan siber', 'pencurian data']
  }
];

// =========================================================================
// 3. KELAS VIII — SEMESTER GANJIL (15 SOAL ESAY)
// Cakupan: Berpikir Komputasional (Fungsi, Himpunan, Sistem Bilangan, Stack & Queue),
//          Integrasi TIK (Word, Excel, PowerPoint, Mail Merge, OLE), Sistem Komputer (Arsitektur Von Neumann, Gerbang Logika)
// =========================================================================
export const ESSAY_QUESTIONS_VIII_GANJIL: EssayQuestion[] = [
  {
    id: 1,
    noSoal: 1,
    content: 'Dalam Berpikir Komputasional tingkat lanjut, konsep Fungsi matematika (f(x)) memiliki kesamaan erat dengan fungsi dalam pemrograman (Input -> Proses -> Output). Jika sebuah fungsi didefinisikan f(x) = 3x² + 5x - 7, hitunglah f(4) dan jelaskan bagaimana algoritma komputer mengevaluasi urutan prioritas operator matematika tersebut!',
    elemen: 'Berpikir Komputasional (BK)',
    jenjang: 'VIII',
    semester: 'Ganjil',
    bobot: 7,
    rubrik: 'Menghitung nilai f(4) dengan benar yaitu 61 (4 poin) dan menjelaskan aturan pemrosesan komputer (Presedensi operator: Pangkat -> Perkalian -> Penjumlahan -> Pengurangan) (3 poin).',
    kunciJawaban: 'Perhitungan f(4):\n• f(4) = 3(4)² + 5(4) - 7\n• Langkah 1 (Pangkat): 4² = 16\n• Langkah 2 (Perkalian): 3 × 16 = 48, dan 5 × 4 = 20\n• Langkah 3 (Penjumlahan): 48 + 20 = 68\n• Langkah 4 (Pengurangan): 68 - 7 = 61\nHasil akhir = 61.\nUrutan Evaluasi Komputer: Komputer mengikuti aturan presedensi operator (Operator Precedence / PEMDAS): perpangkatan dikerjakan pertama kali, disusul perkalian, lalu penjumlahan dan pengurangan dari kiri ke kanan.',
    kataKunci: ['61', 'presedensi operator', 'fungsi f(x)', 'pemdas', 'urutan prioritas']
  },
  {
    id: 2,
    noSoal: 2,
    content: 'Di Kelas VIII-1 UPTD SMP Negeri 7 Kisaran, himpunan siswa peserta klub Robotika adalah R = {Ahmad, Budi, Cantika, Dedi} dan himpunan peserta klub Desain Grafis adalah D = {Cantika, Dedi, Eka, Fani}. Tentukan:\na) Irisan (R ∩ D) dan artinya\nb) Gabungan (R ∪ D) dan artinya\nJelaskan penerapannya dalam query database pencarian data siswa sekolah!',
    elemen: 'Berpikir Komputasional (BK)',
    jenjang: 'VIII',
    semester: 'Ganjil',
    bobot: 7,
    rubrik: 'Menyajikan himpunan irisan {Cantika, Dedi} dan gabungan {Ahmad, Budi, Cantika, Dedi, Eka, Fani} dengan tepat dan menjelaskan padanan operator AND dan OR dalam pencarian database.',
    kunciJawaban: 'a) Irisan (R ∩ D) = {Cantika, Dedi}\nArtinya: Daftar siswa yang mengikuti KEDUA klub sekaligus (Klub Robotika DAN Klub Desain Grafis). Dalam query database, ini setara dengan perintah "WHERE klub=\'Robotika\' AND klub=\'Desain\'".\nb) Gabungan (R ∪ D) = {Ahmad, Budi, Cantika, Dedi, Eka, Fani}\nArtinya: Daftar seluruh siswa yang mengikuti Klub Robotika ATAU Klub Desain Grafis tanpa pengulangan nama. Dalam query database, ini setara dengan perintah "WHERE klub=\'Robotika\' OR klub=\'Desain\'".',
    kataKunci: ['irisan', 'gabungan', 'cantika dedi', 'operator and', 'operator or']
  },
  {
    id: 3,
    noSoal: 3,
    content: 'Jelaskan cara kerja sistem bilangan Heksadesimal (basis 16) dan mengapa heksadesimal sering digunakan oleh pembuat program komputer untuk merepresentasikan kode warna (RGB) pada halaman web (contoh: #FF5733)?',
    elemen: 'Berpikir Komputasional (BK)',
    jenjang: 'VIII',
    semester: 'Ganjil',
    bobot: 7,
    rubrik: 'Menjelaskan simbol basis 16 (0-9 dan A-F), hubungan 1 digit heksadesimal = 4 bit biner (nibble), dan alasan efisiensi penulisan warna RGB (2 digit per kanal Red, Green, Blue).',
    kunciJawaban: '• Sistem Heksadesimal menggunakan 16 simbol: 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, A(10), B(11), C(12), D(13), E(14), F(15).\n• Hubungan dengan Biner: 1 digit heksadesimal tepat mewakili 4 digit biner (1 nibble). 2 digit heksadesimal tepat mewakili 8 bit (1 byte, nilai 0 sampai 255).\n• Kode Warna Web: Warna digital terdiri dari 3 kanal RGB (Red, Green, Blue) bernilai 0–255. Daripada menulis 24 deretan angka biner yang panjang, programmer cukup menulis 6 karakter heksadesimal (misal #FF5733: Red=FF/255, Green=57/87, Blue=33/51), sehingga jauh lebih ringkas, mudah dibaca, dan meminimalkan kesalahan pengetikan.',
    kataKunci: ['heksadesimal', 'basis 16', 'kode warna rgb', '255', '4 bit biner']
  },
  {
    id: 4,
    noSoal: 4,
    content: 'Jelaskan mekanisme kerja operasi PUSH dan POP pada struktur data Stack (Tumpukan)! Berikan simulasi langkah demi langkah saat pengguna mengetik huruf "A", lalu "B", lalu menekan tombol Undo (Ctrl+Z) di Microsoft Word!',
    elemen: 'Berpikir Komputasional (BK)',
    jenjang: 'VIII',
    semester: 'Ganjil',
    bobot: 7,
    rubrik: 'Mendefinisikan PUSH (memasukkan data) dan POP (mengambil data teratas) serta mensimulasikan riwayat tumpukan undo saat mengetik A dan B.',
    kunciJawaban: '• PUSH: Operasi menyisipkan atau memasukkan elemen data baru ke posisi paling atas (top) dari Stack.\n• POP: Operasi menghapus atau mengeluarkan elemen data teratas dari Stack.\nSimulasi Undo di Microsoft Word:\n1. Pengguna mengetik "A" -> Operasi PUSH("Ketik A") dimasukkan ke dalam stack undo. Kondisi stack: [Ketik A].\n2. Pengguna mengetik "B" -> Operasi PUSH("Ketik B") dimasukkan ke posisi teratas. Kondisi stack: [Ketik A, Ketik B (Top)].\n3. Pengguna menekan Ctrl+Z (Undo) -> Aplikasi menjalankan operasi POP() pada elemen teratas yaitu "Ketik B". Karakter "B" dihapus dari layar dokumen dan dikeluarkan dari stack, menyisakan huruf "A".',
    kataKunci: ['push', 'pop', 'stack', 'undo', 'lifo']
  },
  {
    id: 5,
    noSoal: 5,
    content: 'Dalam sistem operasi komputer, antrean pencetakan dokumen ke printer menggunakan struktur data Queue (FIFO). Jelaskan mengapa prinsip FIFO sangat adil dan cocok diterapkan pada Print Spooler! Apa yang akan terjadi jika sistem printer menggunakan prinsip LIFO?',
    elemen: 'Berpikir Komputasional (BK)',
    jenjang: 'VIII',
    semester: 'Ganjil',
    bobot: 6,
    rubrik: 'Menjelaskan prinsip keadilan FIFO (dokumen yang dikirim pertama harus dicetak pertama) dan anomali jika memakai LIFO (dokumen awal tertahan tanpa batas/starvation).',
    kunciJawaban: '• Prinsip Keadilan FIFO: Dokumen yang pertama kali dikirim oleh pengguna ke printer spooler akan dicetak paling pertama. Ini menjamin urutan yang adil tanpa ada pengguna yang diserobot.\n• Jika Menggunakan LIFO: Dokumen yang baru saja dikirim belakangan akan dicetak duluan. Akibatnya, dokumen pengguna pertama yang sudah lama menunggu akan terus terdorong ke tumpukan paling bawah dan tidak pernah dicetak (mengalami starvation/kelaparan sumber daya) selama ada pengguna baru yang terus mengirim tugas cetak.',
    kataKunci: ['queue', 'fifo', 'print spooler', 'keadilan antrean', 'starvation']
  },
  {
    id: 6,
    noSoal: 6,
    content: 'Fitur Mail Merge (Surat Massal) pada Microsoft Word adalah contoh integrasi aplikasi perkantoran yang sangat efektif. Uraikan 2 komponen utama dalam Mail Merge (Main Document dan Data Source) dan sebutkan langkah-langkah membuat 50 surat undangan rapat orang tua siswa secara otomatis!',
    elemen: 'Teknologi Informasi & Komunikasi (TIK)',
    jenjang: 'VIII',
    semester: 'Ganjil',
    bobot: 7,
    rubrik: 'Menjelaskan Main Document (naskah surat baku di Word) dan Data Source (tabel Excel berisi nama & alamat) serta langkah menghubungkannya melalui tab Mailings.',
    kunciJawaban: 'Dua Komponen Utama:\n1. Main Document (Dokumen Utama): Format naskah surat resmi di Microsoft Word yang tata letak dan isinya tetap sama untuk semua penerima.\n2. Data Source (Sumber Data): File tabel data (biasanya Microsoft Excel) yang berisi daftar identitas unik seperti Nama Orang Tua, Nama Siswa, NISN, dan Alamat.\nLangkah Pembuatan:\n1. Buat daftar nama orang tua dan siswa di tabel Excel, lalu simpan file.\n2. Buka naskah surat di Microsoft Word.\n3. Buka tab "Mailings" -> pilih "Select Recipients" -> "Use an Existing List" -> pilih file Excel yang tadi dibuat.\n4. Tempatkan kursor di bagian tujuan nama, lalu klik "Insert Merge Field" dan masukkan field <<Nama_Orang_Tua>> dan <<Kelas>>.\n5. Klik "Preview Results" untuk memeriksa tampilan, lalu selesaikan dengan "Finish & Merge" untuk mencetak atau mengekspor 50 surat sekaligus.',
    kataKunci: ['mail merge', 'main document', 'data source', 'excel ke word', 'surat massal']
  },
  {
    id: 7,
    noSoal: 7,
    content: 'Jelaskan perbedaan antara teknik Copy-Paste biasa dengan Object Linking and Embedding (OLE) saat Anda menyematkan tabel grafik Excel ke dalam slide presentasi PowerPoint! Apa kelebihan OLE jika data pada file Excel sewaktu-waktu diperbarui oleh guru?',
    elemen: 'Teknologi Informasi & Komunikasi (TIK)',
    jenjang: 'VIII',
    semester: 'Ganjil',
    bobot: 7,
    rubrik: 'Menjelaskan bahwa copy-paste biasa menghasilkan data statis/gambar mati, sedangkan OLE (Paste Special -> Paste Link) mempertahankan koneksi dinamis sehingga perubahan di Excel otomatis terupdate di PowerPoint.',
    kunciJawaban: '• Copy-Paste Biasa: Menyalin data dalam bentuk teks statis atau gambar mati ke PowerPoint. Jika angka pada file Excel asli berubah, grafik di PowerPoint tidak akan berubah dan harus di-copy ulang secara manual.\n• Object Linking and Embedding (OLE): Membangun tautan langsung (link) antara file master Excel dengan slide presentasi PowerPoint.\n• Kelebihan OLE: Saat guru memperbarui angka pada tabel Excel, grafik dan angka pada slide presentasi PowerPoint akan otomatis ikut terupdate secara real-time tanpa perlu mengedit slide satu per satu, sehingga menghemat waktu dan mencegah inkonsistensi data.',
    kataKunci: ['ole', 'object linking and embedding', 'paste link', 'otomatis update', 'excel ke powerpoint']
  },
  {
    id: 8,
    noSoal: 8,
    content: 'Jelaskan konsep Arsitektur Komputer Von Neumann yang menjadi dasar seluruh komputer modern! Sebutkan 5 unit utama dalam arsitektur tersebut beserta fungsi masing-masing!',
    elemen: 'Sistem Komputer (SK)',
    jenjang: 'VIII',
    semester: 'Ganjil',
    bobot: 7,
    rubrik: 'Menjelaskan konsep stored-program (program dan data disimpan di memori yang sama) dan menyebutkan 5 unit utama: Input, CPU (ALU & CU), Memory, Output.',
    kunciJawaban: 'Arsitektur Von Neumann adalah desain arsitektur komputer teoretis di mana data program dan instruksi dieksekusi disimpan bersama di dalam satu memori utama yang sama.\n5 Unit Utama:\n1. Unit Masukan (Input Unit): Menerima data dari pengguna ke komputer (keyboard, mouse).\n2. Unit Pemroses Pusat - ALU: Melakukan kalkulasi aritmatika dan perbandingan logika.\n3. Unit Pemroses Pusat - CU: Mengendalikan aliran data dan sinkronisasi eksekusi instruksi.\n4. Unit Memori (Memory Unit): Menyimpan instruksi program dan data kerja secara cepat (RAM).\n5. Unit Keluaran (Output Unit): Menampilkan hasil pemrosesan data ke pengguna (monitor, printer).',
    kataKunci: ['von neumann', 'stored-program', 'alu', 'cu', 'memory unit']
  },
  {
    id: 9,
    noSoal: 9,
    content: 'Uraikan siklus kerja CPU "Fetch - Decode - Execute" saat menjalankan sebuah instruksi program komputer! Apa yang dilakukan prosesor pada masing-masing tahapan siklus tersebut?',
    elemen: 'Sistem Komputer (SK)',
    jenjang: 'VIII',
    semester: 'Ganjil',
    bobot: 7,
    rubrik: 'Menjelaskan siklus Fetch (mengambil instruksi dari RAM), Decode (menerjemahkan instruksi oleh CU), dan Execute (menjalankan komputasi oleh ALU/register).',
    kunciJawaban: '1. Fetch (Pengambilan): Control Unit (CU) mengambil instruksi biner berikutnya dari memori utama (RAM) berdasarkan alamat yang ditunjuk oleh register Program Counter (PC), lalu menyimpannya ke Instruction Register.\n2. Decode (Penerjemahan): Control Unit menerjemahkan dan mengurai kode instruksi tersebut untuk menentukan operasi apa yang diminta (apakah penjumlahan, pemindahan data, atau perbandingan) serta menyiapkan jalur sirkuit yang diperlukan.\n3. Execute (Pengeksekusian): ALU atau komponen pemroses terkait mengeksekusi instruksi tersebut (misal melakukan perhitungan matematika) dan menyimpan hasil komputasinya kembali ke register atau RAM.',
    kataKunci: ['fetch', 'decode', 'execute', 'siklus cpu', 'program counter']
  },
  {
    id: 10,
    noSoal: 10,
    content: 'Buatlah tabel kebenaran (Truth Table) untuk Gerbang Logika Dasar: AND, OR, dan NOT dengan dua input A dan B (khusus NOT 1 input)! Jelaskan bagaimana logika ketiga gerbang tersebut diaplikasikan dalam sistem saklar listrik!',
    elemen: 'Sistem Komputer (SK)',
    jenjang: 'VIII',
    semester: 'Ganjil',
    bobot: 7,
    rubrik: 'Menampilkan tabel kebenaran lengkap untuk input 00, 01, 10, 11 dan penjelasan rangkaian seri (AND) vs paralel (OR) vs saklar pembalik (NOT).',
    kunciJawaban: 'Tabel Kebenaran:\n• Input: (0,0) -> AND=0, OR=0\n• Input: (0,1) -> AND=0, OR=1\n• Input: (1,0) -> AND=0, OR=1\n• Input: (1,1) -> AND=1, OR=1\n• Gerbang NOT (1 input): NOT(0)=1, NOT(1)=0\nAplikasi Saklar Listrik:\n1. AND setara dengan dua saklar yang dipasang secara SERI: Lampu baru menyala HANYA jika saklar A DAN saklar B sama-sama tertutup (ON).\n2. OR setara dengan dua saklar yang dipasang secara PARALEL: Lampu menyala jika SALAH SATU atau KEDUA saklar tertutup (ON).\n3. NOT adalah saklar pembalik (Inverter): Saat saklar ditekan (1), lampu justru mati (0).',
    kataKunci: ['gerbang logika', 'and', 'or', 'not', 'tabel kebenaran', 'seri paralel']
  },
  {
    id: 11,
    noSoal: 11,
    content: 'Jelaskan cara kerja Gerbang Kombinasi NAND dan NOR! Mengapa gerbang NAND dan NOR sering disebut sebagai "Universal Gates" dalam teknik perancangan rangkaian sirkuit digital komputer?',
    elemen: 'Sistem Komputer (SK)',
    jenjang: 'VIII',
    semester: 'Ganjil',
    bobot: 6,
    rubrik: 'Menjelaskan bahwa NAND = NOT-AND (hanya bernilai 0 jika semua 1) dan NOR = NOT-OR, serta alasan disebut Universal Gates karena kombinasi NAND atau NOR saja dapat membentuk semua gerbang logika lainnya.',
    kunciJawaban: '• Gerbang NAND (NOT AND): Menghasilkan output 0 hanya jika semua input bernilai 1. Jika ada salah satu input bernilai 0, maka outputnya bernilai 1.\n• Gerbang NOR (NOT OR): Menghasilkan output 1 hanya jika semua input bernilai 0. Jika ada input bernilai 1, maka outputnya 0.\n• Alasan Disebut Universal Gates: Karena hanya dengan menggunakan susunan gerbang NAND saja (atau NOR saja), kita dapat merekayasa dan membentuk semua jenis gerbang logika lainnya (NOT, AND, OR, XOR, XNOR) tanpa memerlukan komponen lain. Hal ini membuat biaya fabrikasi chip silikon menjadi jauh lebih efisien.',
    kataKunci: ['nand', 'nor', 'universal gate', 'rangkaian terpadu', 'chip']
  },
  {
    id: 12,
    noSoal: 12,
    content: 'Apa perbedaan antara BIOS/UEFI dan Sistem Operasi? Jelaskan tahapan proses Booting mulai dari tombol daya (Power) komputer ditekan hingga muncul tampilan desktop siap pakai!',
    elemen: 'Sistem Komputer (SK)',
    jenjang: 'VIII',
    semester: 'Ganjil',
    bobot: 7,
    rubrik: 'Menjelaskan firmware BIOS/UEFI di chip ROM vs OS di storage, dan menguraikan tahapan POST -> baca bootloader -> load kernel OS ke RAM -> login desktop.',
    kunciJawaban: '• BIOS/UEFI: Firmware tingkat rendah yang tertanam permanen pada chip ROM motherboard. Bertugas menginisialisasi hardware pertama kali saat komputer dinyalakan.\n• Sistem Operasi: Perangkat lunak utama di SSD/HDD yang mengatur seluruh program dan antarmuka pengguna setelah komputer menyala.\nTahapan Proses Booting:\n1. Power On: Aliran listrik masuk ke motherboard.\n2. POST (Power-On Self-Test): BIOS menguji hardware (memeriksa RAM, keyboard, kartu grafis, CPU) apakah berfungsi normal.\n3. Bootloader: BIOS mencari perangkat boot (SSD/Flashdisk) dan memuat program kecil Bootloader ke RAM.\n4. Load Kernel OS: Bootloader memuat kernel sistem operasi (Windows/Linux) ke memori utama.\n5. Tampilan Desktop: Driver perangkat diaktifkan, dan antarmuka pengguna (Desktop) siap menerima interaksi.',
    kataKunci: ['booting', 'bios', 'uefi', 'post', 'bootloader']
  },
  {
    id: 13,
    noSoal: 13,
    content: 'Sebuah laboratorium sekolah akan merakit komputer baru untuk kebutuhan pembelajaran Desain Poster Digital dan Pemrograman Dasar. Berikan rekomendasi spesifikasi minimal untuk Processor, RAM, Storage, dan Layar Monitor disertai alasan teknis mengapa komponen tersebut dipilih!',
    elemen: 'Sistem Komputer (SK)',
    jenjang: 'VIII',
    semester: 'Ganjil',
    bobot: 7,
    rubrik: 'Memberikan rincian spek realistis (Processor min 4 core, RAM min 8GB/16GB, Storage SSD NVMe min 256GB/512GB, Monitor IPS FHD) beserta alasan teknis kebutuhan multitasking & rendering.',
    kunciJawaban: 'Rekomendasi Spesifikasi:\n1. Processor: Minimal Intel Core i3 Gen 12/13 atau AMD Ryzen 3/5 (Minimal 4 Core / 8 Thread). Alasan: Menjamin eksekusi multitasking kompilasi kode dan rendering kanvas desain grafis berjalan lancar tanpa lag.\n2. RAM: Minimal 8 GB DDR4/DDR5 (Disarankan 16 GB Dual Channel). Alasan: Aplikasi desain grafis (seperti Photoshop/Corel/Canva) dan IDE pemrograman memakan banyak alokasi memori kerja.\n3. Storage: SSD NVMe minimal 256 GB / 512 GB. Alasan: Kecepatan baca/tulis SSD hingga 2000+ MB/s membuat waktu booting dan pembukaan aplikasi 5x lebih cepat dibanding harddisk lawas.\n4. Monitor: Layar 21.5 - 24 inch Resolusi Full HD (1920x1080) dengan Panel IPS. Alasan: Panel IPS memberikan akurasi warna dan sudut pandang lebar yang sangat penting untuk akurasi desain grafis siswa.',
    kataKunci: ['spesifikasi komputer', 'ram 8gb', 'ssd nvme', 'processor', 'panel ips']
  },
  {
    id: 14,
    noSoal: 14,
    content: 'Jelaskan perbedaan mendasar antara representasi grafik Vektor dan grafik Bitmap (Raster)! Mengapa logo resmi Tut Wuri Handayani dan logo sekolah sebaiknya dirancang dalam format vektor?',
    elemen: 'Teknologi Informasi & Komunikasi (TIK)',
    jenjang: 'VIII',
    semester: 'Ganjil',
    bobot: 6,
    rubrik: 'Menjelaskan grafik Bitmap tersusun atas pixel (pecah saat diperbesar) vs Vektor tersusun atas rumus matematis (tidak pecah pada ukuran berapapun).',
    kunciJawaban: '• Bitmap (Raster): Gambar yang tersusun dari kisi-kisi titik warna kecil bernama piksel (pixel). Formatnya .jpg, .png. Kelemahan: Jika diperbesar melebihi ukuran aslinya, gambar akan pecah dan buram (pixelated).\n• Vektor: Gambar yang tersusun dari persamaan matematis garis, kurva, titik, dan bidang warna. Formatnya .svg, .ai, .eps.\n• Alasan Logo Sekolah Berformat Vektor: Logo sekolah sering dicetak dalam berbagai skala ukuran, mulai dari kop surat berukuran kecil di amplop hingga baliho/spanduk raksasa di depan gerbang sekolah. Format vektor menjamin logo tetap tajam sempurna tanpa pecah sedikitpun di ukuran berapapun.',
    kataKunci: ['vektor', 'bitmap', 'piksel', 'skalabilitas', 'logo tajam']
  },
  {
    id: 15,
    noSoal: 15,
    content: 'Jelaskan apa itu algoritma optimasi Knapsack Problem (masalah pemilihan barang dengan kapasitas ransel terbatas) dalam konteks Berpikir Komputasional! Berikan contoh penerapannya saat seorang siswa harus memilih barang bawaan berkemah dengan batasan berat maksimal tas 5 kg!',
    elemen: 'Berpikir Komputasional (BK)',
    jenjang: 'VIII',
    semester: 'Ganjil',
    bobot: 7,
    rubrik: 'Menjelaskan konsep Knapsack (memaksimalkan nilai manfaat barang dengan batas kapasitas beban) dan simulasi pemilihan barang berdasarkan bobot vs nilai kegunaan.',
    kunciJawaban: '• Knapsack Problem: Masalah optimasi komputasi untuk memilih kombinasi barang yang memberikan total nilai manfaat (value) terbesar tanpa melebihi batas kapasitas berat (weight constraint) yang ditentukan.\n• Contoh Berkemah (Kapasitas 5 kg):\nSiswa memiliki daftar barang:\n1. Tenda (Berat 2.5 kg, Nilai Manfaat = 10)\n2. Sleeping bag (Berat 1.5 kg, Nilai Manfaat = 8)\n3. Kotak P3K (Berat 0.5 kg, Nilai Manfaat = 9)\n4. Baju ganti (Berat 0.5 kg, Nilai Manfaat = 7)\n5. Speaker musik (Berat 2 kg, Nilai Manfaat = 3)\nSolusi Algoritma: Siswa memilih Tenda (2.5 kg) + Sleeping bag (1.5 kg) + Kotak P3K (0.5 kg) + Baju ganti (0.5 kg) = Total berat pas 5.0 kg dengan total nilai manfaat tertinggi yaitu 34 poin, dan mengabaikan speaker musik karena beratnya melebihi kapasitas dan nilai manfaatnya rendah.',
    kataKunci: ['knapsack problem', 'optimasi', 'kapasitas', 'nilai manfaat', 'efisiensi']
  }
];

// =========================================================================
// 4. KELAS VIII — SEMESTER GENAP (15 SOAL ESAY)
// Cakupan: Jaringan Komputer Lanjutan (Topologi, IP Address, Protokol),
//          Analisis Data Lanjutan (VLOOKUP, PivotTable), Pemrograman Tekstual (Python), Dampak Sosial Informatika (UU ITE & AI)
// =========================================================================
export const ESSAY_QUESTIONS_VIII_GENAP: EssayQuestion[] = [
  {
    id: 1,
    noSoal: 1,
    content: 'Bandingkan Topologi Jaringan Star (Bintang) dan Topologi Bus dari segi bentuk fisik, kelebihan, dan kelemahannya! Mengapa sebagian besar laboratorium komputer sekolah saat ini menggunakan topologi Star?',
    elemen: 'Jaringan Komputer & Internet (JKI)',
    jenjang: 'VIII',
    semester: 'Genap',
    bobot: 7,
    rubrik: 'Membandingkan Topologi Star (terpusat pada switch/hub) vs Bus (kabel utama tunggal) dan menjelaskan keunggulan Star (jika 1 kabel putus komputer lain tidak terganggu).',
    kunciJawaban: '• Topologi Bus: Seluruh komputer dihubungkan ke satu kabel utama panjang (backbone). Kelebihan: Hemat kabel dan instalasi sederhana. Kelemahan: Jika kabel utama putus atau rusak, seluruh jaringan langsung lumpuh total.\n• Topologi Star: Setiap komputer dihubungkan langsung ke satu perangkat pusat konsentrator yaitu Switch atau Hub menggunakan kabel twisted-pair (UTP).\n• Kelebihan Topologi Star: Sangat andal dan mudah dikelola. Jika salah satu kabel komputer siswa rusak, komputer siswa lainnya tetap dapat terhubung normal tanpa terganggu. Deteksi kerusakan kabel juga sangat mudah terlihat dari lampu indikator port switch.',
    kataKunci: ['topologi star', 'topologi bus', 'switch hub', 'kabel putus', 'keandalan lab']
  },
  {
    id: 2,
    noSoal: 2,
    content: 'Dalam jaringan komputer, jelaskan fungsi spesifik dari masing-masing perangkat keras berikut:\na) Router\nb) Switch\nc) Access Point (AP)\nd) Modem (Modulator Demodulator)',
    elemen: 'Jaringan Komputer & Internet (JKI)',
    jenjang: 'VIII',
    semester: 'Genap',
    bobot: 7,
    rubrik: 'Menjelaskan peran router (penghubung beda jaringan/routing IP), switch (penghubung perangkat lokal LAN berdasarkan MAC address), access point (pemancar sinyal nirkabel Wi-Fi), dan modem (pengubah sinyal analog-digital).',
    kunciJawaban: 'a) Router: Perangkat yang bertugas menghubungkan dua atau lebih jaringan yang berbeda (misal jaringan lokal sekolah dengan jaringan internet global ISP) dan mengarahkan rute paket data (routing) berdasarkan IP Address.\nb) Switch: Perangkat penghubung beberapa komputer dalam satu jaringan lokal (LAN) yang meneruskan data secara cerdas ke alamat port tujuan berdasarkan MAC Address.\nc) Access Point: Perangkat pemancar nirkabel yang memancarkan sinyal gelombang radio Wi-Fi agar laptop dan smartphone dapat terhubung ke jaringan kabel LAN.\nd) Modem: Alat yang mengubah sinyal analog dari penyedia layanan (kabel serat optik / telepon) menjadi sinyal digital yang dipahami komputer, dan sebaliknya.',
    kataKunci: ['router', 'switch', 'access point', 'modem', 'perangkat jaringan']
  },
  {
    id: 3,
    noSoal: 3,
    content: 'Jelaskan struktur alamat IP versi 4 (IPv4) yang terdiri dari 32-bit dan dibagi menjadi 4 oktet desimal (contoh: 192.168.1.50). Apa perbedaan antara Alamat IP Privat dan Alamat IP Publik?',
    elemen: 'Jaringan Komputer & Internet (JKI)',
    jenjang: 'VIII',
    semester: 'Genap',
    bobot: 7,
    rubrik: 'Menjelaskan format 4 oktet desimal (0-255 per oktet) serta perbedaan IP Privat (hanya dikenal di dalam jaringan lokal) vs IP Publik (alamat global unik di internet luas).',
    kunciJawaban: '• Struktur IPv4: Terdiri dari 32 bit bilangan biner yang dibagi menjadi 4 kelompok (oktet) berukuran masing-masing 8 bit. Dituliskan dalam format desimal bertitik (Dotted-Decimal Notation) bernilai 0 hingga 255 pada tiap oktet (contoh: 192.168.1.50).\n• IP Privat: Alamat IP khusus yang hanya berlaku dan dikenali di dalam jaringan lokal internal (LAN sekolah atau rumah) seperti rentang 192.168.x.x. Alamat ini gratis dan tidak dapat diakses langsung dari internet luar.\n• IP Publik: Alamat unik resmi berskala global yang diberikan oleh penyedia layanan internet (ISP) yang dapat diakses langsung dari seluruh penjuru internet dunia.',
    kataKunci: ['ipv4', '32-bit', 'oktet', 'ip privat', 'ip publik']
  },
  {
    id: 4,
    noSoal: 4,
    content: 'Saat Anda mengetik alamat situs "https://smpn7kisaran.sch.id" di browser, jelaskan peran dari protokol DNS (Domain Name System) dan perbedaan antara protokol HTTP biasa dengan HTTPS (Hypertext Transfer Protocol Secure)!',
    elemen: 'Jaringan Komputer & Internet (JKI)',
    jenjang: 'VIII',
    semester: 'Genap',
    bobot: 7,
    rubrik: 'Menjelaskan DNS sebagai buku telepon internet (menerjemahkan nama domain ke IP Address) dan HTTPS dilengkapi sertifikat SSL/TLS untuk enkripsi data.',
    kunciJawaban: '• Peran DNS (Domain Name System): Bertindak seperti "buku telepon internet". Manusia lebih mudah mengingat nama domain (smpn7kisaran.sch.id), sedangkan komputer hanya memahami IP Address (misal 103.247.11.2). DNS menerjemahkan nama domain yang diketik pengguna menjadi IP Address server tujuan.\n• Perbedaan HTTP vs HTTPS:\n  - HTTP: Mengirimkan data antara browser dan server dalam bentuk teks biasa (plain text) tanpa proteksi, sehingga rentan disadap atau diubah di tengah jalan.\n  - HTTPS: Mengamankan komunikasi data menggunakan lapisan enkripsi SSL/TLS (Secure Sockets Layer). Semua data kata sandi dan transaksi dienkripsi sehingga tidak dapat dibaca oleh penyadap jaringan.',
    kataKunci: ['dns', 'buku telepon internet', 'http', 'https', 'enkripsi ssl']
  },
  {
    id: 5,
    noSoal: 5,
    content: 'Jelaskan cara kerja rumus =VLOOKUP di Microsoft Excel untuk mencari data siswa dari tabel master referensi! Tuliskan struktur formula lengkapnya beserta penjelasan dari ke-4 argumen di dalamnya (lookup_value, table_array, col_index_num, [range_lookup])!',
    elemen: 'Analisis Data (AD)',
    jenjang: 'VIII',
    semester: 'Genap',
    bobot: 7,
    rubrik: 'Menjelaskan fungsi pencarian vertikal VLOOKUP dan menguraikan fungsi 4 parameter: nilai kunci pencarian, tabel sumber, indeks kolom output, dan FALSE untuk exact match.',
    kunciJawaban: 'Struktur Rumus:\n=VLOOKUP(lookup_value, table_array, col_index_num, [range_lookup])\nPenjelasan 4 Argumen:\n1. lookup_value (Nilai Kunci): Data yang dijadikan patokan pencarian (misal nomor NISN siswa di sel A2).\n2. table_array (Tabel Referensi): Rentang tabel sumber yang berisi data master (misal tabel master siswa di Sheet2!$A$2:$E$100).\n3. col_index_num (Nomor Kolom): Urutan nomor kolom pada tabel referensi yang ingin diambil nilainya (misal kolom ke-2 untuk Nama Siswa).\n4. range_lookup (Ketepatan Pencarian): Diisi FALSE atau 0 untuk pencarian data yang persis sama (Exact Match), sehingga jika NISN tidak ditemukan sistem akan memunculkan nilai #N/A dan tidak salah ambil data.',
    kataKunci: ['=vlookup', 'lookup_value', 'table_array', 'col_index_num', 'false exact match']
  },
  {
    id: 6,
    noSoal: 6,
    content: 'Fitur Pivot Table pada Microsoft Excel sangat bermanfaat untuk menganalisis data dalam jumlah besar. Jelaskan apa itu Pivot Table dan bagaimana seorang guru dapat menggunakannya untuk menghitung rekapitulasi jumlah siswa lulus per kelas dari data 300 siswa dalam hitungan detik!',
    elemen: 'Analisis Data (AD)',
    jenjang: 'VIII',
    semester: 'Genap',
    bobot: 6,
    rubrik: 'Menjelaskan Pivot Table sebagai alat ringkasan interaktif untuk agregasi/pengelompokan data besar tanpa perlu mengetik banyak rumus manual.',
    kunciJawaban: '• Pengertian Pivot Table: Fitur interaktif di Excel yang digunakan untuk meringkas, mengelompokkan, dan menganalisis kumpulan data besar secara cepat dan fleksibel dengan teknik drag-and-drop bidang kolom tanpa perlu menulis rumus satu per satu.\n• Cara Guru Menghitung Rekap Kelulusan:\n1. Blok seluruh tabel data nilai siswa (300 baris).\n2. Klik menu Insert -> PivotTable.\n3. Tarik field "Kelas" ke area Rows (Baris).\n4. Tarik field "Status Kelulusan" (Lulus / Remidial) ke area Columns (Kolom).\n5. Tarik field "NISN" atau "Nama" ke area Values (dengan agregasi Count).\nHasilnya: Dalam sekejap tercipta tabel silang yang menampilkan jumlah siswa yang Lulus dan Remidial untuk tiap-tiap kelas secara otomatis beserta total keseluruhannya.',
    kataKunci: ['pivot table', 'rekap data', 'rows', 'columns', 'values count']
  },
  {
    id: 7,
    noSoal: 7,
    content: 'Bandingkan bahasa pemrograman visual berbasis blok (seperti Scratch / Blockly) dengan bahasa pemrograman tekstual (seperti Python)! Sebutkan kelebihan dan kelemahan masing-masing bagi siswa SMP!',
    elemen: 'Algoritma & Pemrograman (AP)',
    jenjang: 'VIII',
    semester: 'Genap',
    bobot: 6,
    rubrik: 'Membandingkan pemrograman visual (bebas syntax error, drag & drop) vs tekstual (fleksibel, standar industri, butuh ketelitian pengetikan sintaks & indentasi).',
    kunciJawaban: '• Pemrograman Visual (Scratch):\n  - Kelebihan: Menyenangkan, bebas dari kesalahan ketik (Syntax Error) karena balok puzzle hanya bisa dipasang jika cocok logikanya. Sangat baik untuk memahami konsep logika dasar.\n  - Kelemahan: Terbatas pada aplikasi sederhana/game edukasi, tidak digunakan untuk membangun software industri nyata.\n• Pemrograman Tekstual (Python):\n  - Kelebihan: Standar industri nyata di dunia kerja (digunakan untuk web, analisis data, kecerdasan buatan AI), sangat ekspresif dan fleksibel.\n  - Kelemahan: Memerlukan ketelitian tinggi dalam mengetik tanda baca, kurung, dan indentasi spasi. Kesalahan satu huruf kecil bisa menyebabkan program error (gagal jalan).',
    kataKunci: ['python', 'scratch', 'pemrograman visual', 'pemrograman tekstual', 'syntax error']
  },
  {
    id: 8,
    noSoal: 8,
    content: 'Dalam bahasa pemrograman Python, sebutkan 4 tipe data dasar (Integer, Float, String, Boolean) beserta contoh nilai dan fungsi penggunaannya dalam aplikasi pengolah nilai ujian!',
    elemen: 'Algoritma & Pemrograman (AP)',
    jenjang: 'VIII',
    semester: 'Genap',
    bobot: 7,
    rubrik: 'Menyebutkan 4 tipe data dengan contoh valid: int (bilangan bulat, misal jumlah_soal = 25), float (desimal, misal nilai = 85.5), str (teks, misal nama = "Budi"), bool (logika True/False, misal is_lulus = True).',
    kunciJawaban: '1. Integer (int): Tipe data bilangan bulat (positif, negatif, nol). Contoh: skor_benar = 22, total_soal = 25.\n2. Float (float): Tipe data bilangan pecahan / desimal. Contoh: rata_rata_nilai = 88.5, durasi_menit = 45.2.\n3. String (str): Tipe data teks berupa karakter yang diapit tanda petik. Contoh: nama_siswa = "Siti Aisyah", kelas = "VIII-2".\n4. Boolean (bool): Tipe data logika yang hanya memiliki dua kemungkinan nilai yaitu True (Benar) atau False (Salah). Contoh: status_lulus = True, apakah_remedial = False.',
    kataKunci: ['integer', 'float', 'string', 'boolean', 'tipe data python']
  },
  {
    id: 9,
    noSoal: 9,
    content: 'Tuliskan sebaris kode sederhana dalam bahasa pemrograman Python yang menerima input nilai ujian dari pengguna, lalu mencetak "Predikat A (Sangat Baik)" jika nilai >= 85, dan "Predikat B (Baik)" jika nilai di bawah 85 menggunakan struktur if-else!',
    elemen: 'Algoritma & Pemrograman (AP)',
    jenjang: 'VIII',
    semester: 'Genap',
    bobot: 7,
    rubrik: 'Menuliskan kode Python dengan sintaks yang valid, konversi tipe int/float dari input, dan indentasi yang benar pada blok if-else.',
    kunciJawaban: 'Kode Program Python:\n\nnilai = float(input("Masukkan nilai ujian siswa: "))\n\nif nilai >= 85:\n    print("Predikat A (Sangat Baik)")\nelse:\n    print("Predikat B (Baik)")\n\nPenjelasan:\n• input() mengambil masukan teks dari pengguna, lalu dikonversi menjadi bilangan desimal dengan fungsi float().\n• if nilai >= 85 mengecek kondisi logika.\n• Indentasi (tab/spasi menjorok ke dalam) wajib digunakan di Python untuk menandai blok perintah di dalam if dan else.',
    kataKunci: ['python', 'if else', 'input float', 'indentasi', 'predikat nilai']
  },
  {
    id: 10,
    noSoal: 10,
    content: 'Jelaskan perbedaan mendasar antara perulangan For Loop dan While Loop pada algoritma pemrograman! Apa yang dimaksud dengan "Infinite Loop" (Perulangan Tak Terhingga) dan bagaimana cara programmer mencegahnya?',
    elemen: 'Algoritma & Pemrograman (AP)',
    jenjang: 'VIII',
    semester: 'Genap',
    bobot: 7,
    rubrik: 'Menjelaskan For Loop (jumlah putaran sudah diketahui pasti) vs While Loop (berjalan selama kondisi bernilai True) serta bahaya Infinite Loop dan cara menghentikannya dengan update variabel kondisi / break.',
    kunciJawaban: '• For Loop: Digunakan saat jumlah perulangan sudah diketahui secara pasti sebelumnya (misal: for i in range(10) untuk mengulang 10 kali).\n• While Loop: Digunakan saat perulangan bergantung pada suatu kondisi logika dan akan terus berjalan selama kondisi tersebut bernilai Benar (True).\n• Infinite Loop: Kondisi kesalahan di mana perulangan berjalan selamanya tanpa pernah berhenti karena kondisi penghentian tidak pernah tercapai, yang dapat menyebabkan komputer macet (hang) atau aplikasi crash.\n• Pencegahan: Pastikan di dalam blok While terdapat pembaruan nilai variabel pencacah (counter increment, misal i += 1) atau sediakan perintah break saat kondisi tertentu terpenuhi.',
    kataKunci: ['for loop', 'while loop', 'infinite loop', 'counter increment', 'kondisi berhenti']
  },
  {
    id: 11,
    noSoal: 11,
    content: 'Dalam pemrograman, pembuatan Fungsi (Function / Def) sangat dianjurkan dengan prinsip "DRY" (Don\'t Repeat Yourself). Jelaskan apa keuntungan membuat sebuah fungsi tersendiri dan berikan contoh deklarasi fungsi Python untuk menghitung luas persegi panjang!',
    elemen: 'Algoritma & Pemrograman (AP)',
    jenjang: 'VIII',
    semester: 'Genap',
    bobot: 7,
    rubrik: 'Menjelaskan keuntungan fungsi (modularitas, keterbacaan, efisiensi kode, mudah diperbaiki) dan menuliskan fungsi Python dengan parameter dan return value.',
    kunciJawaban: 'Keuntungan Fungsi:\n1. Menghindari Pengulangan Kode: Potongan kode yang sering digunakan cukup ditulis satu kali dan bisa dipanggil berkali-kali.\n2. Modularitas & Kerapian: Program menjadi terstruktur rapi ke dalam modul-modul kecil yang mudah dipahami.\n3. Mudah Diperbaiki: Jika ada kesalahan rumus, perbaikan cukup dilakukan pada definisi fungsi tersebut tanpa merombak seluruh program.\nContoh Deklarasi Fungsi Python:\n\ndef hitung_luas_persegi_panjang(panjang, lebar):\n    luas = panjang * lebar\n    return luas\n\n# Pemanggilan fungsi:\nhasil = hitung_luas_persegi_panjang(10, 5)\nprint("Luasnya adalah:", hasil) # Output: 50',
    kataKunci: ['fungsi python', 'def', 'return', 'modular', 'dry']
  },
  {
    id: 12,
    noSoal: 12,
    content: 'Sebagai warga negara yang bijak bermedia digital, pelajar wajib memahami Undang-Undang Informasi dan Transaksi Elektronik (UU ITE). Sebutkan minimal 3 pasal/perilaku yang dilarang dalam UU ITE (misal terkait pencemaran nama baik, penyebaran hoaks, dan akses ilegal)!',
    elemen: 'Dampak Sosial Informatika (DSI)',
    jenjang: 'VIII',
    semester: 'Genap',
    bobot: 7,
    rubrik: 'Menyebutkan 3 larangan UU ITE: pencemaran nama baik/penghinaan, penyebaran berita bohong (hoaks) yang menimbulkan keresahan/SARA, dan illegal access/hacking akun orang lain.',
    kunciJawaban: 'Perilaku yang dilarang dalam UU ITE:\n1. Pencemaran Nama Baik & Penghinaan (Pasal 27 ayat 3): Mendistribusikan atau mentransmisikan informasi elektronik yang memuat penghinaan atau merusak reputasi martabat orang lain secara sengaja di ruang publik/sosial media.\n2. Penyebaran Berita Bohong / Hoaks & Kebencian SARA (Pasal 28): Menyebarkan berita bohong yang merugikan orang lain atau menyebarkan ujaran kebencian berdasar suku, agama, ras, dan antargolongan.\n3. Akses Ilegal / Peretasan Akun (Pasal 30): Masuk, menerobos, atau meretas akun email, akun medsos, atau sistem komputer orang lain tanpa hak dan izin dari pemilik yang sah.',
    kataKunci: ['uu ite', 'pencemaran nama baik', 'penyebaran hoaks', 'akses ilegal', 'hukum digital']
  },
  {
    id: 13,
    noSoal: 13,
    content: 'Jelaskan perbedaan antara lisensi perangkat lunak Open Source (Sumber Terbuka), Freeware, Shareware, dan Commercial Proprietary Software! Berikan masing-masing 1 contoh software yang sering digunakan di sekolah!',
    elemen: 'Dampak Sosial Informatika (DSI)',
    jenjang: 'VIII',
    semester: 'Genap',
    bobot: 6,
    rubrik: 'Menjelaskan ke-4 model lisensi dan contoh aplikasinya (Open source: Linux/LibreOffice, Freeware: Acrobat Reader, Shareware: WinRAR/evaluasi, Proprietary: Microsoft Windows).',
    kunciJawaban: '1. Open Source: Software yang kode sumbernya (source code) dibuka untuk umum sehingga bebas dipelajari, dimodifikasi, dan disebarluaskan. Contoh: Sistem Operasi Linux (Ubuntu), LibreOffice, GIMP.\n2. Freeware: Software gratis yang dapat digunakan tanpa biaya, namun hak cipta dan kode sumbernya tetap tertutup di tangan pengembang. Contoh: Google Chrome, Adobe Acrobat Reader.\n3. Shareware: Software yang disediakan gratis untuk masa uji coba tertentu (Trial Period, misal 30 hari). Setelah itu pengguna diminta membayar lisensi untuk fitur penuh. Contoh: WinRAR, aplikasi antivirus berbayar versi trial.\n4. Commercial Proprietary: Software berbayar penuh dengan lisensi ketat dan kode sumber rahasia milik perusahaan. Contoh: Microsoft Windows 11, Microsoft Office, Adobe Photoshop.',
    kataKunci: ['open source', 'freeware', 'shareware', 'proprietary', 'lisensi software']
  },
  {
    id: 14,
    noSoal: 14,
    content: 'Kehadiran teknologi Kecerdasan Buatan (Artificial Intelligence / AI) seperti ChatGPT atau Gemini membawa perubahan besar dalam dunia pendidikan. Bagaimana pandangan Anda mengenai etika penggunaan AI dalam mengerjakan tugas sekolah? Kapan AI boleh dimanfaatkan dan kapan AI tidak boleh digunakan?',
    elemen: 'Dampak Sosial Informatika (DSI)',
    jenjang: 'VIII',
    semester: 'Genap',
    bobot: 7,
    rubrik: 'Menganalisis etika AI: Boleh sebagai asisten belajar, mencari sudut pandang baru, membedah konsep sulit; Dilarang untuk plagiarisme copy-paste jawaban tugas mentah-mentah tanpa berpikir mandiri.',
    kunciJawaban: '• Etika Penggunaan AI:\nAI harus diposisikan sebagai "rekan diskusi belajar" (learning assistant), bukan pengganti otak atau jalan pintas kemalasan siswa.\n• Kapan Boleh Dimanfaatkan:\n1. Membantu menjelaskan konsep pelajaran yang sulit dipahami dengan bahasa yang lebih sederhana.\n2. Mencari ide awal atau kerangka (outline) saat merancang proyek karya tulis.\n3. Memeriksa kesalahan tata bahasa (grammar/ejaan) atau mencari error pada kode pemrograman.\n• Kapan DILARANG Digunakan:\n1. Menyalin dan menempel (Copy-Paste) seluruh jawaban ujian atau esay langsung dari AI dan mengakuinya sebagai karya orisinal sendiri (Plagiarisme).\n2. Menggunakan AI saat ujian resmi berlangsung tanpa izin pengawas.\n3. Mempercayai informasi AI secara buta tanpa melakukan verifikasi fakta ke buku sumber yang kredibel.',
    kataKunci: ['kecerdasan buatan', 'etika ai', 'plagiarisme', 'asisten belajar', 'kritis']
  },
  {
    id: 15,
    noSoal: 15,
    content: 'Sebuah proyek Praktik Lintas Bidang (PLB) di sekolah menggabungkan Informatika dengan mata pelajaran IPA untuk memantau suhu dan kelembaban tanaman hidroponik menggunakan mikrokontroler Arduino/IoT. Uraikan alur kerja sistem IoT tersebut mulai dari sensor membaca lingkungan hingga data ditampilkan pada layar dashboard!',
    elemen: 'Praktik Lintas Bidang (PLB)',
    jenjang: 'VIII',
    semester: 'Genap',
    bobot: 7,
    rubrik: 'Menguraikan alur sistem IoT: Sensor mendeteksi besaran fisik -> Mikrokontroler mengonversi ke data digital -> Modul Wi-Fi mengirim ke server cloud -> Dashboard web/HP menampilkan grafik suhu real-time.',
    kunciJawaban: 'Alur Kerja Sistem IoT Hidroponik:\n1. Sensor (Persepsi): Sensor DHT11/DHT22 mendeteksi kondisi fisik lingkungan (suhu udara dan kelembaban) tanaman hidroponik dalam bentuk besaran tegangan analog.\n2. Mikrokontroler (Pemrosesan): Papan mikrokontroler (Arduino / ESP32) membaca sinyal sensor, mengonversinya menjadi angka suhu digital (misal 28.5°C).\n3. Komunikasi Jaringan (Transmisi): Modul Wi-Fi pada mikrokontroler mengirimkan paket data suhu tersebut melalui jaringan internet lokal ke server database Cloud menggunakan protokol IoT (seperti MQTT atau HTTP POST).\n4. Dashboard Pemantauan (Penyajian): Aplikasi dashboard web atau smartphone sekolah menerima data secara real-time dan menampilkannya dalam bentuk angka dan grafik yang mudah dibaca oleh siswa dan guru pembimbing.',
    kataKunci: ['iot', 'arduino', 'sensor dht', 'cloud', 'praktik lintas bidang']
  }
];

// =========================================================================
// POOL TAMBAHAN 15 SOAL (SET B/C) UNTUK SETIAP PAKET
// Menjamin soal selalu BERGANTI BARU saat siswa mengulang / ujian susulan,
// serta UNIK berbeda untuk tiap tipe device (Android/iPhone/Chromebook/PC) & IP
// =========================================================================

export const ESSAY_EXTENDED_VII_GANJIL: EssayQuestion[] = [
  {
    id: 16,
    noSoal: 16,
    content: 'Sebuah data teks di komputer disimpan dalam bentuk kode biner berstandar ASCII atau Unicode. Jelaskan perbedaan mendasar antara representasi kode ASCII (7-8 bit) dan Unicode (UTF-8 / 16-bit), serta mengapa Unicode sangat dibutuhkan oleh masyarakat global modern!',
    elemen: 'Sistem Komputer (SK)',
    jenjang: 'VII',
    semester: 'Ganjil',
    bobot: 7,
    rubrik: 'Menjelaskan kapasitas bit ASCII (maksimal 128/256 karakter latin) vs Unicode (jutaan karakter dari seluruh aksara dunia seperti Arab, Mandarin, Kanji, dan emoji) secara logis.',
    kunciJawaban: '• ASCII (American Standard Code for Information Interchange): Hanya memakai 7 hingga 8 bit sehingga hanya mampu menampung 128 hingga 256 karakter (terbatas pada alfabet latin A-Z, angka 0-9, dan simbol umum).\n• Unicode: Dirancang dengan panjang variabel (UTF-8, UTF-16) yang mampu menampung lebih dari 1.100.000 karakter unik, mencakup seluruh aksara bahasa di dunia (Aksara Jawa, Batak, Arab, Mandarin, Jepang, Hiragana, dll.) serta ribuan karakter simbol dan emoji modern.\n• Mengapa Dibutuhkan: Memungkinkan pertukaran data global di internet tanpa teks rusak (mojibake) dan mendukung komunikasi multibahasa dunia.',
    kataKunci: ['ascii', 'unicode', 'utf-8', 'aksara global', 'representasi karakter']
  },
  {
    id: 17,
    noSoal: 17,
    content: 'Dalam teknik pemecahan masalah Algoritma, kita mengenal konsep Percabangan (Branching / Selection) dan Perulangan (Looping / Iteration). Buatlah contoh alur logika sehari-hari di lingkungan sekolah yang memuat kedua konsep tersebut secara bersamaan!',
    elemen: 'Algoritma & Pemrograman (AP)',
    jenjang: 'VII',
    semester: 'Ganjil',
    bobot: 7,
    rubrik: 'Menyajikan contoh kasus nyata sekolah (misal: antrean wudhu, memeriksa buku tugas) yang memuat instruksi pengulangan (loop) dan kondisi percabangan (if-else) yang jelas.',
    kunciJawaban: 'Contoh Kasus: Guru mengoreksi nilai tugas 30 siswa di kelas VII-1:\n1. Perulangan (Looping): Guru memeriksa buku tugas siswa ke-1 hingga siswa ke-30 secara berulang-ulang.\n2. Percabangan (Branching): Pada setiap buku siswa yang diperiksa:\n   • JIKA (IF) nilai tugas siswa >= 75 (KKM), MAKA siswa diberi keterangan "TUNTAS".\n   • JIKA TIDAK (ELSE), MAKA siswa diberi keterangan "REMEDIAL / SUSULAN".\nSetelah selesai satu siswa, guru melanjutkan ke siswa berikutnya hingga 30 buku selesai.',
    kataKunci: ['percabangan', 'perulangan', 'if else', 'looping', 'kkm']
  },
  {
    id: 18,
    noSoal: 18,
    content: 'Bandingkan media penyimpanan Solid State Drive (SSD) dengan Hard Disk Drive (HDD). Dari aspek kecepatan baca/tulis, ketahanan terhadap guncangan fisik, dan konsumsi daya listrik, jelaskan mengapa SSD lebih disarankan untuk laptop siswa zaman sekarang!',
    elemen: 'Sistem Komputer (SK)',
    jenjang: 'VII',
    semester: 'Ganjil',
    bobot: 7,
    rubrik: 'Membandingkan SSD (chip flash tanpa bagian bergerak) vs HDD (piringan magnetik berputar) dari sisi kecepatan, ketahanan benturan, dan efisiensi daya.',
    kunciJawaban: '• Kecepatan: SSD membaca dan menulis data 5 hingga 10 kali lebih cepat dibanding HDD karena memakai chip flash elektronik, membuat booting Windows dan membuka aplikasi hanya dalam hitungan detik.\n• Ketahanan Fisik: SSD tidak memiliki bagian mekanik yang bergerak (no moving parts), sehingga sangat tahan guncangan saat laptop dibawa siswa di dalam tas. Sedangkan HDD memiliki piringan magnetik dan jarum head yang sangat rentan rusak jika terbentur.\n• Konsumsi Daya: SSD membutuhkan daya listrik lebih kecil dan tidak menghasilkan panas berlebih, sehingga membuat baterai laptop siswa bertahan lebih lama.',
    kataKunci: ['ssd', 'hdd', 'kecepatan baca tulis', 'tahan guncangan', 'efisiensi baterai']
  },
  {
    id: 19,
    noSoal: 19,
    content: 'Jelaskan konsep "Cloud Storage" (Penyimpanan Awan) seperti Google Drive atau OneDrive. Uraikan 3 keuntungan dan 1 risiko keamanan yang harus diwaspadai siswa saat menyimpan data tugas sekolah di Cloud Storage!',
    elemen: 'Teknologi Informasi & Komunikasi (TIK)',
    jenjang: 'VII',
    semester: 'Ganjil',
    bobot: 7,
    rubrik: 'Menjelaskan definisi Cloud Storage, menyebutkan 3 keunggulan (akses lintas perangkat, backup otomatis, kemudahan kolaborasi), dan 1 risiko (kebocoran akun jika password lemah).',
    kunciJawaban: 'Cloud Storage adalah layanan penyimpanan file di server internet jarak jauh yang dikelola penyedia layanan.\nKeuntungan:\n1. Akses Fleksibel: Siswa dapat membuka tugas dari HP Android, iPhone, laptop, maupun lab komputer sekolah kapan saja.\n2. Backup Aman: File tidak hilang meskipun laptop rusak atau flashdisk hilang tertinggal.\n3. Kolaborasi Tim: Memungkinkan beberapa siswa mengerjakan satu dokumen tugas secara bersamaan (real-time).\nRisiko:\n• Jika password akun email siswa lemah atau terkena phishing, data pribadi dan tugas dapat diakses atau dihapus oleh pihak tidak bertanggung jawab.',
    kataKunci: ['cloud storage', 'google drive', 'backup', 'fleksibel', 'keamanan akun']
  },
  {
    id: 20,
    noSoal: 20,
    content: 'Saat mencari materi pelajaran di mesin pencari Google, kita sering menggunakan kata kunci (keywords). Jelaskan fungsi operator pencarian tanda petik (" "), tanda minus (-), dan "site:" serta berikan contoh penggunaannya untuk mencari artikel resmi Kurikulum Merdeka!',
    elemen: 'Teknologi Informasi & Komunikasi (TIK)',
    jenjang: 'VII',
    semester: 'Ganjil',
    bobot: 6,
    rubrik: 'Menjelaskan fungsi 3 operator mesin pencari secara benar dan memberikan contoh query pencarian yang tepat.',
    kunciJawaban: '1. Tanda Petik (" "): Mencari frasa persis tanpa dipisah. Contoh: "Kurikulum Merdeka Informatika Fase D".\n2. Tanda Minus (-): Mengabaikan kata tertentu dari hasil pencarian. Contoh: Informatika Fase D -game.\n3. Operator "site:": Membatasi pencarian hanya pada situs web domain tertentu. Contoh: site:kemdikbud.go.id modul ajar informatika kelas 7.',
    kataKunci: ['mesin pencari', 'operator google', 'kata kunci', 'site:', 'frasa persis']
  },
  {
    id: 21,
    noSoal: 21,
    content: 'Lakukan konversi bilangan biner 11010111₍₂₎ ke dalam bilangan desimal dan jelaskan apakah nilai desimal tersebut merupakan bilangan ganjil atau genap! Berikan aturan cepat untuk mengetahui apakah sebuah biner bernilai ganjil atau genap hanya dengan melihat digit terakhirnya (LSB)!',
    elemen: 'Berpikir Komputasional (BK)',
    jenjang: 'VII',
    semester: 'Ganjil',
    bobot: 7,
    rubrik: 'Menghitung konversi biner ke desimal (128+64+0+16+0+4+2+1 = 215), menyimpulkan bilangan ganjil, dan menjelaskan aturan LSB (Least Significant Bit: jika digit terakhir 1 maka ganjil, jika 0 maka genap).',
    kunciJawaban: 'Perhitungan: 11010111₍₂₎ = 128 + 64 + 0 + 16 + 0 + 4 + 2 + 1 = 215₍₁₀₎ (Ganjil).\nAturan Cepat: Periksa digit paling kanan (Least Significant Bit / LSB berbobot 2⁰ = 1). Karena semua pangkat 2 yang lain (2, 4, 8, 16, dll.) selalu menghasilkan angka genap, maka hanya digit terakhir (bobot 1) yang menentukan. Jika bit terakhir bernilai 1 maka bilangan desimal PASTI GANJIL, dan jika bernilai 0 maka PASTI GENAP.',
    kataKunci: ['215', 'biner desimal', 'ganjil genap', 'lsb', 'least significant bit']
  },
  {
    id: 22,
    noSoal: 22,
    content: 'Jelaskan peran Motherboard (Papan Induk) dalam sebuah casing komputer! Sebutkan 4 komponen inti yang terpasang langsung pada Motherboard!',
    elemen: 'Sistem Komputer (SK)',
    jenjang: 'VII',
    semester: 'Ganjil',
    bobot: 6,
    rubrik: 'Menjelaskan fungsi motherboard sebagai papan sirkuit utama penghubung antar-komponen dan menyebutkan 4 komponen terpasang (Processor, RAM, Slot PCIe, Chipset/BIOS).',
    kunciJawaban: 'Motherboard adalah papan sirkuit cetak utama (PCB) yang menjadi tulang punggung penghubung dan jalur komunikasi kelistrikan antara seluruh komponen komputer.\n4 Komponen inti yang terpasang langsung:\n1. Socket Processor (CPU).\n2. Slot Memori RAM.\n3. Slot Ekspansi PCI Express (untuk Kartu Grafis / VGA).\n4. Chipset Motherboard dan Chip BIOS/UEFI.',
    kataKunci: ['motherboard', 'papan induk', 'socket cpu', 'slot ram', 'jalur sirkuit']
  },
  {
    id: 23,
    noSoal: 23,
    content: 'Mengapa sebuah file gambar dengan resolusi 4K memiliki ukuran file (Megabyte) yang jauh lebih besar daripada gambar beresolusi VGA? Jelaskan hubungannya dengan konsep jumlah piksel (Pixel) dan kedalaman warna (Color Depth)!',
    elemen: 'Analisis Data (AD)',
    jenjang: 'VII',
    semester: 'Ganjil',
    bobot: 7,
    rubrik: 'Menjelaskan bahwa ukuran file gambar bergantung pada total piksel (panjang x lebar) dikalikan bit warna per piksel (RGB 24-bit).',
    kunciJawaban: 'Sebuah gambar digital tersusun dari titik-titik warna yang disebut piksel (pixel).\n• Gambar VGA (640×480) hanya memiliki sekitar 307.200 piksel.\n• Gambar 4K (3840×2160) memiliki lebih dari 8.294.400 piksel (sekitar 27 kali lebih banyak).\nSetiap piksel menyimpan data warna (misal 24-bit atau 3 byte untuk kombinasi Merah, Hijau, Biru / RGB). Semakin banyak jumlah piksel dan semakin dalam warnanya, maka semakin banyak data bit yang harus disimpan ke media penyimpanan, sehingga ukuran file 4K menjadi jauh lebih besar.',
    kataKunci: ['piksel', 'resolusi 4k', 'color depth', 'rgb', 'ukuran file']
  },
  {
    id: 24,
    noSoal: 24,
    content: 'Jelaskan apa yang dimaksud dengan Malware (Malicious Software) dan uraikan perbedaan antara Virus Komputer, Worm, dan Trojan Horse!',
    elemen: 'Sistem Komputer (SK)',
    jenjang: 'VII',
    semester: 'Ganjil',
    bobot: 7,
    rubrik: 'Mendefinisikan malware dan membedakan virus (butuh file induk/inang), worm (menyebar sendiri via jaringan), dan trojan (menyamar sebagai aplikasi baik).',
    kunciJawaban: 'Malware adalah perangkat lunak berbahaya yang dirancang untuk merusak, mencuri data, atau mengganggu sistem komputer.\nPerbedaannya:\n1. Virus: Program jahat yang menempel pada file dokumen/aplikasi lain (inang) dan membutuhkan tindakan pengguna untuk menyebar (misal saat membuka file terinfeksi).\n2. Worm: Malware mandiri yang dapat menggandakan diri dan menyebar secara otomatis melalui jaringan internet tanpa memerlukan file inang atau campur tangan pengguna.\n3. Trojan Horse: Malware yang menyamar sebagai aplikasi yang tampaknya sah atau bermanfaat (misal game gratis atau antivirus palsu), namun diam-diam membuka pintu belakang (backdoor) bagi peretas.',
    kataKunci: ['malware', 'virus', 'worm', 'trojan horse', 'keamanan sistem']
  },
  {
    id: 25,
    noSoal: 25,
    content: 'Di era digital saat ini, jejak digital (Digital Footprint) dapat memengaruhi masa depan seseorang. Jelaskan apa yang dimaksud dengan Jejak Digital Pasif dan Jejak Digital Aktif, serta berikan 2 contoh konkret untuk masing-masing jenis!',
    elemen: 'Dampak Sosial Informatika (DSI)',
    jenjang: 'VII',
    semester: 'Ganjil',
    bobot: 6,
    rubrik: 'Membedakan jejak digital pasif (terekam otomatis tanpa disadari) vs aktif (diunggah/dibagikan secara sadar) dengan contoh nyata.',
    kunciJawaban: '• Jejak Digital Pasif: Data yang terekam secara otomatis oleh sistem tanpa disadari pengguna saat berselancar di internet. Contoh: Riwayat alamat IP dan lokasi perangkat saat browsing, cookies situs belanja yang melacak produk yang Anda lihat.\n• Jejak Digital Aktif: Data yang dibuat dan dibagikan secara sengaja dan sadar oleh pengguna ke internet. Contoh: Mengunggah foto atau status di media sosial, menulis komentar di YouTube, atau mengirim email.',
    kataKunci: ['jejak digital', 'digital footprint', 'jejak pasif', 'jejak aktif', 'reputasi digital']
  },
  {
    id: 26,
    noSoal: 26,
    content: 'Saat komputer mengalami "Freeze" atau "Not Responding" pada suatu aplikasi, langkah apa yang sebaiknya dilakukan siswa melalui fitur Task Manager daripada langsung mencabut kabel listrik komputer sekolah?',
    elemen: 'Sistem Komputer (SK)',
    jenjang: 'VII',
    semester: 'Ganjil',
    bobot: 6,
    rubrik: 'Menjelaskan penggunaan Task Manager (Ctrl+Alt+Del atau Ctrl+Shift+Esc), memilih aplikasi yang hang, dan klik End Task tanpa mematikan paksa PC.',
    kunciJawaban: 'Langkah yang benar:\n1. Tekan kombinasi tombol keyboard Ctrl + Shift + Esc (atau Ctrl + Alt + Delete lalu pilih Task Manager).\n2. Cari aplikasi yang berstatus "Not Responding" pada daftar Processes.\n3. Klik kanan pada aplikasi tersebut dan pilih "End Task" (Hentikan Tugas).\nManfaat: Hanya aplikasi bermasalah yang dimatikan, sedangkan aplikasi lain dan sistem operasi tetap berjalan stabil tanpa risiko kerusakan data fisik harddisk/SSD akibat cabut kabel mendadak.',
    kataKunci: ['task manager', 'end task', 'not responding', 'freeze', 'penanganan hang']
  },
  {
    id: 27,
    noSoal: 27,
    content: 'Jelaskan fungsi fitur "Find and Replace" pada aplikasi pengolah kata (Word Processor) dan bagaimana fitur tersebut menerapkan prinsip Berpikir Komputasional (Abstraksi & Otomasi)!',
    elemen: 'Teknologi Informasi & Komunikasi (TIK)',
    jenjang: 'VII',
    semester: 'Ganjil',
    bobot: 6,
    rubrik: 'Menjelaskan fungsi Find & Replace untuk mengganti kata secara massal dan mengaitkannya dengan efisiensi otomasi algoritma.',
    kunciJawaban: 'Fitur Find and Replace berfungsi untuk mencari kata atau frasa tertentu di seluruh dokumen dan menggantinya dengan kata baru secara otomatis dan serentak.\nHubungan dengan Berpikir Komputasional:\n• Otomasi: Menggantikan pekerjaan manual yang lambat dan rawan terlewat menjadi proses sistematis dalam 1 detik.\n• Pengenalan Pola & Abstraksi: Algoritma mencocokkan pola susunan huruf kata target dan mengabaikan bagian dokumen lain yang tidak cocok.',
    kataKunci: ['find and replace', 'otomasi', 'pengolah kata', 'pola teks', 'efisiensi']
  },
  {
    id: 28,
    noSoal: 28,
    content: 'Mengapa perangkat komputer memerlukan komponen pendingin seperti Heatsink dan Kipas (Cooling Fan) pada prosesornya? Apa yang terjadi jika sistem pendingin tersebut tidak bekerja dengan baik?',
    elemen: 'Sistem Komputer (SK)',
    jenjang: 'VII',
    semester: 'Ganjil',
    bobot: 6,
    rubrik: 'Menjelaskan pembuangan panas dari miliaran transistor dan bahaya thermal throttling atau shutdown darurat akibat overheat.',
    kunciJawaban: 'Prosesor (CPU) bekerja memproses data dengan frekuensi miliaran siklus per detik melalui aliran listrik, menghasilkan energi panas tinggi. Heatsink menyerap panas dari permukaan CPU dan kipas membuangnya keluar casing.\nJika sistem pendingin gagal:\n1. Terjadi Overheating (suhu ekstrem di atas 90°C).\n2. CPU akan melakukan "Thermal Throttling" (menurunkan kecepatan kerja secara drastis sehingga komputer melambat parah).\n3. Komputer otomatis mati mendadak (Emergency Thermal Shutdown) untuk melindungi prosesor dari kerusakan fisik terbakar.',
    kataKunci: ['heatsink', 'cooling fan', 'overheating', 'thermal throttling', 'pendingin prosesor']
  },
  {
    id: 29,
    noSoal: 29,
    content: 'Tuliskan dan jelaskan 3 aturan penting dalam membuat kata sandi (Password) yang kuat dan aman untuk akun pembelajaran online siswa!',
    elemen: 'Teknologi Informasi & Komunikasi (TIK)',
    jenjang: 'VII',
    semester: 'Ganjil',
    bobot: 6,
    rubrik: 'Menyebutkan panjang minimal (12 karakter), kombinasi huruf besar/kecil/angka/simbol, dan larangan memakai data pribadi seperti tanggal lahir/nama.',
    kunciJawaban: '1. Panjang Minimal 10-12 Karakter: Semakin panjang kata sandi, semakin sulit dipecahkan dengan metode serangan brute-force.\n2. Kombinasi Beragam Karakter: Gunakan campuran huruf besar (A-Z), huruf kecil (a-z), angka (0-9), dan simbol khusus (!@#$%^&*).\n3. Hindari Informasi Pribadi: Jangan menggunakan nama sendiri, nama sekolah, nomor telepon, atau tanggal lahir yang mudah ditebak oleh teman atau orang lain.',
    kataKunci: ['password kuat', 'keamanan akun', 'kombinasi karakter', 'brute force', 'privasi']
  },
  {
    id: 30,
    noSoal: 30,
    content: 'Siswa sering menemukan istilah "Open Source Software" dan "Freeware". Apakah semua Freeware merupakan Open Source? Jelaskan alasan perbedaan hukum dan kode sumbernya!',
    elemen: 'Dampak Sosial Informatika (DSI)',
    jenjang: 'VII',
    semester: 'Ganjil',
    bobot: 7,
    rubrik: 'Menegaskan bahwa TIDAK SEMUA freeware adalah open source; menjelaskan bahwa freeware gratis dipakai tetapi kode sumber tertutup (proprietary).',
    kunciJawaban: 'TIDAK, tidak semua Freeware adalah Open Source.\n• Freeware: Hanya memberikan izin penggunaan secara gratis tanpa memungut biaya, tetapi kode sumber (source code) aplikasi tersebut tetap dirahasiakan dan ditutup oleh pembuatnya. Pengguna tidak boleh memodifikasi atau menjual ulang aplikasi tersebut (Contoh: Google Chrome, WhatsApp Desktop).\n• Open Source: Tidak hanya gratis, tetapi kode sumbernya DIBUKA sepenuhnya untuk umum. Siapa saja berhak mempelajari cara kerja kode, memodifikasi, dan ikut mengembangkannya (Contoh: Linux Ubuntu, LibreOffice).',
    kataKunci: ['freeware', 'open source', 'kode sumber tertutup', 'hak cipta', 'modifikasi']
  }
];

export const ESSAY_EXTENDED_VII_GENAP: EssayQuestion[] = [
  {
    id: 16,
    noSoal: 16,
    content: 'Dalam arsitektur jaringan komputer, jelaskan fungsi perangkat Switch dan Router! Mengapa sebuah laboratorium komputer sekolah membutuhkan Router untuk menghubungkan jaringan lokal (LAN) ke jaringan internet luar?',
    elemen: 'Jaringan Komputer & Internet (JKI)',
    jenjang: 'VII',
    semester: 'Genap',
    bobot: 7,
    rubrik: 'Membedakan fungsi Switch (menghubungkan komputer dalam LAN yang sama) vs Router (menghubungkan dua jaringan berbeda seperti LAN dan WAN/Internet dengan penentuan rute IP).',
    kunciJawaban: '• Switch: Bekerja pada jaringan lokal (LAN) untuk mendistribusikan data antarkomputer di dalam laboratorium menggunakan alamat MAC.\n• Router: Perangkat cerdas yang berfungsi menjembatani dan mengarahkan lalu lintas data antara dua jaringan yang berbeda protokol dan segmen IP (misalnya jaringan lokal lab SMPN 7 Kisaran dengan jaringan publik Internet global).\nLab butuh Router untuk menerjemahkan alamat IP lokal privat menjadi IP publik (NAT) dan memilih rute tercepat untuk paket data internet.',
    kataKunci: ['switch', 'router', 'lan', 'wan', 'rute data', 'gateway']
  },
  {
    id: 17,
    noSoal: 17,
    content: 'Pada aplikasi lembar kerja (Spreadsheet), jelaskan fungsi rumus =COUNTIF() dan =SUMIF(). Berikan contoh sintaks penggunaannya untuk menghitung jumlah siswa yang tuntas dan total nilai siswa perempuan!',
    elemen: 'Analisis Data (AD)',
    jenjang: 'VII',
    semester: 'Genap',
    bobot: 7,
    rubrik: 'Menjelaskan perbedaan menghitung frekuensi sel berdasarkan kriteria (COUNTIF) vs menjumlahkan angka berdasarkan kriteria (SUMIF) lengkap dengan contoh formulanya.',
    kunciJawaban: '• =COUNTIF(range; criteria): Menghitung banyak sel yang memenuhi kriteria tertentu. Contoh: =COUNTIF(F2:F31; ">=75") untuk menghitung berapa banyak siswa yang nilainya tuntas KKM.\n• =SUMIF(range; criteria; sum_range): Menjumlahkan nilai angka pada sel yang memenuhi kriteria. Contoh: =SUMIF(C2:C31; "P"; E2:E31) untuk menjumlahkan seluruh nilai ujian siswa berjenis kelamin Perempuan ("P").',
    kataKunci: ['countif', 'sumif', 'spreadsheet', 'kriteria data', 'formula excel']
  },
  {
    id: 18,
    noSoal: 18,
    content: 'Dalam pemrograman visual Scratch, jelaskan konsep "Variable" (Variabel) dan "Broadcast Message". Bagaimana kedua fitur ini digunakan untuk membuat sistem skor dan pergantian level pada game sederhana?',
    elemen: 'Algoritma & Pemrograman (AP)',
    jenjang: 'VII',
    semester: 'Genap',
    bobot: 7,
    rubrik: 'Menjelaskan Variabel sebagai penyimpan nilai yang dapat berubah (skor/nyawa) dan Broadcast sebagai pengirim sinyal event antar-sprite/backdrop untuk pergantian level.',
    kunciJawaban: '• Variabel: Wadah di memori program untuk menyimpan nilai yang dapat berubah-ubah selama game berjalan. Contoh: Variabel "Skor" yang bertambah 10 setiap kali koin diambil, atau variabel "Nyawa" yang berkurang jika terkena rintangan.\n• Broadcast Message: Fitur pengiriman sinyal nirkabel di dalam kode Scratch dari satu Sprite ke Sprite lain atau latar belakang. Ketika variabel skor mencapai 100, Sprite mengirim sinyal "broadcast Level2", dan semua Sprite lain merespons dengan mengubah tampilan ke tantangan level berikutnya.',
    kataKunci: ['variabel', 'broadcast message', 'scratch', 'skor game', 'event handling']
  },
  {
    id: 19,
    noSoal: 19,
    content: 'Mengapa kabel serat optik (Fiber Optic) mampu mentransmisikan data internet dengan kecepatan yang jauh lebih tinggi dan jarak yang lebih jauh dibandingkan kabel tembaga (UTP/Coaxial)? Jelaskan media perambatan gelombangnya!',
    elemen: 'Jaringan Komputer & Internet (JKI)',
    jenjang: 'VII',
    semester: 'Genap',
    bobot: 7,
    rubrik: 'Menjelaskan bahwa fiber optik menggunakan modulasi cahaya (foton) melalui serat kaca dengan prinsip pemantulan internal total, bukan sinyal listrik tembaga yang rentan hambatan dan interferensi elektromagnetik.',
    kunciJawaban: 'Kabel Fiber Optic menghantarkan data menggunakan sinyal pulsa cahaya (foton) melalui untaian kaca/silika murni yang sangat halus dengan prinsip pembiasan dan pemantulan internal total (Total Internal Reflection).\nKeunggulannya:\n1. Kecepatan Mendekati Kecepatan Cahaya: Sinyal cahaya bergerak jauh lebih cepat daripada arus elektron pada kabel tembaga.\n2. Kebal Gangguan Elektromagnetik (EMI): Cahaya tidak terpengaruh oleh gelombang radio, petir, atau kabel listrik tegangan tinggi.\n3. Redaman Sangat Rendah: Sinyal dapat menempuh puluhan kilometer tanpa penurunan kualitas yang berarti.',
    kataKunci: ['fiber optic', 'sinyal cahaya', 'pemantulan internal', 'kabel utp', 'kecepatan internet']
  },
  {
    id: 20,
    noSoal: 20,
    content: 'Jelaskan perbedaan antara data Kualitatif dan data Kuantitatif dalam pengolahan data Informatika! Berikan contoh kedua jenis data tersebut dalam konteks data siswa di sekolah!',
    elemen: 'Analisis Data (AD)',
    jenjang: 'VII',
    semester: 'Genap',
    bobot: 6,
    rubrik: 'Mendefinisikan data kualitatif (deskriptif, kategori, teks) dan data kuantitatif (angka terukur, dapat dihitung) beserta contoh sekolah.',
    kunciJawaban: '• Data Kuantitatif: Data berupa angka numerik yang dapat diukur, dihitung, dan diolah dengan operasi matematika. Contoh: Nilai ujian matematika (85), tinggi badan siswa (160 cm), jumlah kehadiran (28 hari).\n• Data Kualitatif: Data berupa deskripsi, kata-kata, atau kategori sifat yang tidak dapat dihitung dengan rumus matematika secara langsung. Contoh: Catatan sikap perilaku siswa ("Sangat Disiplin dan Santun"), predikat ekstrakurikuler ("Aktif"), hobi siswa ("Membaca").',
    kataKunci: ['kualitatif', 'kuantitatif', 'numerik', 'deskriptif', 'analisis data']
  },
  {
    id: 21,
    noSoal: 21,
    content: 'Sebutkan 3 jenis grafik (Chart) utama di spreadsheet (Grafik Batang, Garis, dan Lingkaran) dan jelaskan situasi terbaik untuk menggunakan masing-masing grafik tersebut!',
    elemen: 'Analisis Data (AD)',
    jenjang: 'VII',
    semester: 'Genap',
    bobot: 7,
    rubrik: 'Menjelaskan fungsi Bar Chart (perbandingan kategori), Line Chart (tren waktu berkelanjutan), dan Pie Chart (proporsi persentase bagian dari keseluruhan).',
    kunciJawaban: '1. Grafik Batang (Bar/Column Chart): Terbaik untuk membandingkan nilai antar-kategori yang berbeda. Contoh: Membandingkan jumlah siswa per kelas dari VII-1 sampai VII-5.\n2. Grafik Garis (Line Chart): Terbaik untuk melihat tren atau perkembangan data dari waktu ke waktu secara berurutan. Contoh: Perkembangan rata-rata nilai ujian siswa dari bulan Januari hingga Mei.\n3. Grafik Lingkaran (Pie Chart): Terbaik untuk memperlihatkan proporsi atau persentase suatu bagian terhadap total keseluruhan 100%. Contoh: Persentase pilihan ekstrakurikuler yang diikuti oleh seluruh siswa.',
    kataKunci: ['grafik batang', 'grafik garis', 'grafik lingkaran', 'pie chart', 'visualisasi data']
  },
  {
    id: 22,
    noSoal: 22,
    content: 'Jelaskan bahaya "Cyberbullying" (Perundungan Siber) di media sosial dan apa yang harus dilakukan seorang siswa jika menjadi korban atau melihat temannya mengalami perundungan online!',
    elemen: 'Dampak Sosial Informatika (DSI)',
    jenjang: 'VII',
    semester: 'Genap',
    bobot: 7,
    rubrik: 'Menganalisis dampak psikologis cyberbullying dan tindakan tepat: simpan bukti screenshot, blokir pelaku, tidak membalas dengan kekerasan, dan laporkan ke guru BK/orang tua.',
    kunciJawaban: 'Cyberbullying adalah tindakan intimidasi, penghinaan, atau pengucilan seseorang menggunakan platform digital.\nDampak Bahaya: Menyebabkan stres berat, hilangnya rasa percaya diri, depresi, trauma sosial, hingga penurunan prestasi belajar.\nLangkah yang Harus Dilakukan:\n1. Jangan Membalas dengan Kata Kasar: Jangan terpancing emosi agar situasi tidak semakin memburuk.\n2. Simpan Bukti Nyata: Ambil tangkapan layar (screenshot) pesan, komentar, atau postingan sebagai barang bukti digital.\n3. Blokir dan Laporkan Akun Pelaku: Gunakan fitur Block and Report pada aplikasi media sosial.\n4. Bercerita kepada Orang Dewasa: Segera laporkan kepada Guru BK, Wali Kelas, atau Orang Tua untuk mendapatkan perlindungan.',
    kataKunci: ['cyberbullying', 'perundungan siber', 'screenshot bukti', 'blokir akun', 'guru bk']
  },
  {
    id: 23,
    noSoal: 23,
    content: 'Dalam algoritma pencarian (Searching), bandingkan cara kerja Pencarian Linier (Linear Search) dan Pencarian Biner (Binary Search). Mengapa Binary Search hanya dapat dijalankan pada data yang sudah terurut (Sorted)?',
    elemen: 'Algoritma & Pemrograman (AP)',
    jenjang: 'VII',
    semester: 'Genap',
    bobot: 7,
    rubrik: 'Menjelaskan linear search memeriksa satu per satu vs binary search membagi dua ruang pencarian, serta alasan data harus urut agar eliminasi setengah bagian dapat valid.',
    kunciJawaban: '• Linear Search: Memeriksa data satu per satu dari elemen pertama hingga terakhir secara berurutan. Bekerja pada data acak maupun terurut, namun lambat untuk data besar.\n• Binary Search: Bekerja dengan membandingkan nilai target dengan elemen tengah (median). Jika target lebih kecil, pencarian fokus pada separuh kiri; jika lebih besar, fokus pada separuh kanan, memangkas 50% data setiap langkah.\n• Mengapa Data Harus Terurut: Binary Search mengasumsikan bahwa semua data di sebelah kiri elemen tengah bernilai lebih kecil dan di kanan lebih besar. Jika data acak, sistem tidak bisa memastikan di sisi mana target berada dan akan terjadi kegagalan pencarian.',
    kataKunci: ['linear search', 'binary search', 'terurut', 'median', 'efisiensi algoritma']
  },
  {
    id: 24,
    noSoal: 24,
    content: 'Jelaskan konsep "Algoritma Pengurutan Gelembung" (Bubble Sort) secara sederhana! Jelaskan bagaimana proses pertukaran (swap) dua angka yang berdampingan terjadi hingga seluruh deret angka menjadi urut dari kecil ke besar!',
    elemen: 'Algoritma & Pemrograman (AP)',
    jenjang: 'VII',
    semester: 'Genap',
    bobot: 7,
    rubrik: 'Menjelaskan prinsip membandingkan dua elemen berdampingan dan menukarnya jika elemen kiri lebih besar, diulang hingga elemen terbesar mengapung ke akhir.',
    kunciJawaban: 'Bubble Sort adalah algoritma pengurutan yang bekerja dengan membandingkan pasangan elemen yang bersebelahan dari awal hingga akhir deret.\nAlur Kerja:\n1. Bandingkan angka pertama dengan angka kedua. JIKA angka pertama lebih besar, tukar (swap) posisi keduanya.\n2. Lanjutkan membandingkan angka kedua dengan angka ketiga, dan lakukan swap jika perlu.\n3. Teruskan sampai ujung kanan; pada akhir putaran pertama, angka terbesar dipastikan telah "mengapung" ke posisi paling akhir.\n4. Ulangi proses ini untuk sisa angka hingga tidak ada lagi pertukaran yang terjadi, menandakan seluruh deret telah terurut rapi.',
    kataKunci: ['bubble sort', 'pertukaran swap', 'pengurutan', 'elemen bersebelahan', 'algoritma']
  },
  {
    id: 25,
    noSoal: 25,
    content: 'Bagaimana penerapan protokol enkripsi HTTPS (Hypertext Transfer Protocol Secure) melindungi privasi kata sandi dan transaksi pengguna internet dari penyadapan (Eavesdropping / Man-in-the-Middle Attack)?',
    elemen: 'Jaringan Komputer & Internet (JKI)',
    jenjang: 'VII',
    semester: 'Genap',
    bobot: 7,
    rubrik: 'Menjelaskan bahwa HTTPS mengenkripsi data teks biasa menjadi ciphertext menggunakan SSL/TLS sehingga penyadap hanya melihat teks acak tak terbaca.',
    kunciJawaban: 'Pada protokol biasa (HTTP), data kata sandi dikirimkan dalam bentuk teks terbuka (plain text) sehingga mudah disadap oleh pihak ketiga di jaringan Wi-Fi yang sama.\nPada HTTPS:\n1. Semua paket data antara browser dan server dienkripsi menggunakan protokol keamanan SSL/TLS menjadi kode acak (ciphertext).\n2. Hanya server yang memiliki kunci privat (private key) yang sah yang dapat mendekripsi data tersebut kembali ke bentuk asli.\n3. Bahkan jika ada peretas yang menyadap jaringan di tengah jalan, mereka hanya melihat deretan karakter acak yang tidak dapat dibaca atau disalahgunakan.',
    kataKunci: ['https', 'enkripsi', 'ssl tls', 'ciphertext', 'penyadapan data']
  }
];

export const ESSAY_EXTENDED_VIII_GANJIL: EssayQuestion[] = [
  {
    id: 16,
    noSoal: 16,
    content: 'Dalam sistem pengalamatan jaringan IPv4, jelaskan fungsi Subnet Mask (misal: 255.255.255.0 atau notasi CIDR /24)! Bagaimana subnet mask memisahkan antara Network ID dan Host ID pada sebuah alamat IP?',
    elemen: 'Jaringan Komputer & Internet (JKI)',
    jenjang: 'VIII',
    semester: 'Ganjil',
    bobot: 7,
    rubrik: 'Menjelaskan bahwa bit 1 pada subnet mask menandai bagian Network ID dan bit 0 menandai Host ID, menentukan komputer mana yang berada dalam satu segmen lokal.',
    kunciJawaban: 'Subnet mask adalah deretan 32-bit angka biner yang digunakan untuk membedakan porsi Network ID (identitas kelompok jaringan) dan Host ID (identitas perangkat komputer unik dalam jaringan tersebut).\n• Pada subnet mask 255.255.255.0 (biner: 24 bit angka 1 dan 8 bit angka 0 / notasi CIDR /24):\n1. Tiga oktet pertama (24 bit) menentukan Network ID (misal: 192.168.1.x).\n2. Satu oktet terakhir (8 bit) adalah Host ID, memungkinkan hingga 254 komputer saling berkomunikasi langsung tanpa perlu melewati router.',
    kataKunci: ['ipv4', 'subnet mask', 'network id', 'host id', 'cidr /24']
  },
  {
    id: 17,
    noSoal: 17,
    content: 'Jelaskan perbedaan fungsi VLOOKUP dan HLOOKUP pada aplikasi pengolahan data spreadsheet! Mengapa argumen keempat [range_lookup] hampir selalu diisi dengan angka 0 atau FALSE pada data akademik sekolah?',
    elemen: 'Analisis Data (AD)',
    jenjang: 'VIII',
    semester: 'Ganjil',
    bobot: 7,
    rubrik: 'Menjelaskan arah pencarian vertikal (kolom) vs horizontal (baris) dan alasan nilai FALSE/0 untuk pencarian kecocokan persis (exact match).',
    kunciJawaban: '• VLOOKUP: Mencari nilai kunci pada kolom paling kiri dari suatu tabel referensi secara vertikal (tegak) dan mengambil nilai pada kolom tertentu di baris yang cocok.\n• HLOOKUP: Mencari nilai kunci pada baris paling atas dari suatu tabel referensi secara horizontal (mendatar) dan mengambil nilai pada baris tertentu di kolom yang cocok.\n• Mengapa [range_lookup] diisi FALSE / 0:\nFALSE/0 memerintahkan spreadsheet untuk melakukan pencarian kecocokan tepat / persis (Exact Match). Pada data akademik sekolah (seperti NISN atau Kode Mapel), data harus cocok 100%. Jika diisi TRUE/1, sistem dapat salah menampilkan data siswa lain yang nilainya mendekati.',
    kataKunci: ['vlookup', 'hlookup', 'exact match', 'false 0', 'spreadsheet']
  },
  {
    id: 18,
    noSoal: 18,
    content: 'Jelaskan konsep model 7 Lapisan OSI (OSI 7 Layers) secara konseptual. Sebutkan ke-7 lapisan tersebut secara berurutan dari Lapisan 1 (terbawah) hingga Lapisan 7 (teratas)!',
    elemen: 'Jaringan Komputer & Internet (JKI)',
    jenjang: 'VIII',
    semester: 'Ganjil',
    bobot: 7,
    rubrik: 'Menyebutkan ke-7 layer OSI dari fisik hingga aplikasi (Physical, Data Link, Network, Transport, Session, Presentation, Application) dan fungsi standardisasi komunikasinya.',
    kunciJawaban: 'Model OSI (Open Systems Interconnection) adalah kerangka konseptual berstandar internasional yang membagi proses komunikasi data jaringan menjadi 7 lapisan terpisah agar perangkat dari pabrikan berbeda dapat saling terhubung.\nUrutan 7 Lapisan OSI dari bawah ke atas:\n1. Physical Layer (Transmisi bit fisik kabel/radio)\n2. Data Link Layer (Pengalamatan fisik MAC Address & framing)\n3. Network Layer (Pengalamatan logika IP & routing)\n4. Transport Layer (Segmentasi data & keandalan TCP/UDP)\n5. Session Layer (Membuka & menjaga sesi koneksi)\n6. Presentation Layer (Format data, kompresi, & enkripsi)\n7. Application Layer (Antarmuka langsung dengan aplikasi pengguna: HTTP, DNS, SMTP)',
    kataKunci: ['osi layer', 'physical', 'network', 'transport', 'application']
  },
  {
    id: 19,
    noSoal: 19,
    content: 'Jelaskan perbedaan karakteristik antara protokol transport TCP (Transmission Control Protocol) dan UDP (User Datagram Protocol)! Mengapa panggilan video call (Google Meet/Zoom) lebih memilih UDP sedangkan pengunduhan file tugas memilih TCP?',
    elemen: 'Jaringan Komputer & Internet (JKI)',
    jenjang: 'VIII',
    semester: 'Ganjil',
    bobot: 7,
    rubrik: 'Menjelaskan sifat TCP (connection-oriented, jaminan data utuh, retransmisi) vs UDP (connectionless, cepat, tanpa overhead retransmisi).',
    kunciJawaban: '• TCP: Bersifat andal (reliable) dan connection-oriented. Setiap paket data yang dikirim wajib dikonfirmasi (ACK). Jika ada paket hilang, TCP akan mengirim ulang (retransmit). Cocok untuk download file karena jika 1 bit rusak, file tidak bisa dibuka.\n• UDP: Bersifat cepat (fast) dan connectionless. Mengirim data terus menerus tanpa memeriksa apakah paket sampai atau hilang (tanpa retransmisi).\n• Mengapa Video Call Memilih UDP: Pada panggilan video real-time, kecepatan dan kelancaran suara/gambar adalah prioritas utama. Kehilangan sedikit frame gambar jauh lebih baik daripada video terhenti (freeze) menunggu kirim ulang paket yang terlambat.',
    kataKunci: ['tcp', 'udp', 'connection oriented', 'video call', 'keandalan data']
  },
  {
    id: 20,
    noSoal: 20,
    content: 'Dalam pengolahan data dengan Pivot Table di Excel, jelaskan 4 area penempatan bidang (Field Areas): Filters, Columns, Rows, dan Values! Bagaimana Pivot Table membantu guru merekap nilai ujian 300 siswa dalam hitungan detik?',
    elemen: 'Analisis Data (AD)',
    jenjang: 'VIII',
    semester: 'Ganjil',
    bobot: 7,
    rubrik: 'Menjelaskan ke-4 area Pivot Table dan keunggulannya dalam mengelompokkan, menjumlahkan, dan merata-ratakan data ribuan baris secara interaktif tanpa mengetik rumus manual.',
    kunciJawaban: '1. Filters: Menyaring tampilan seluruh laporan berdasarkan kategori tertentu (misal: hanya menampilkan data Kelas VIII).\n2. Rows (Baris): Menampilkan kategori unik data ke bawah baris (misal: daftar nama kelas atau nama guru).\n3. Columns (Kolom): Menampilkan kategori unik data melebar ke samping kolom (misal: kategori semester Ganjil/Genap).\n4. Values (Nilai): Menghitung kalkulasi data numerik (seperti SUM, AVERAGE, COUNT, MAX, MIN nilai siswa).\nPivot Table mengotomatiskan agregasi ratusan baris data menjadi tabel ringkasan rapi dalam hitungan detik hanya dengan drag-and-drop kolom.',
    kataKunci: ['pivot table', 'rows', 'columns', 'values', 'rekap data']
  }
];

export const ESSAY_EXTENDED_VIII_GENAP: EssayQuestion[] = [
  {
    id: 16,
    noSoal: 16,
    content: 'Dalam bahasa pemrograman Python dasar, jelaskan perbedaan antara Tipe Data List, Tuple, dan Dictionary! Tuliskan contoh deklarasi sintaks untuk masing-masing tipe data tersebut!',
    elemen: 'Algoritma & Pemrograman (AP)',
    jenjang: 'VIII',
    semester: 'Genap',
    bobot: 7,
    rubrik: 'Menjelaskan sifat mutable vs immutable dan pasangan key-value pada dictionary disertai contoh sintaks Python yang valid.',
    kunciJawaban: '1. List: Koleksi data berurutan yang dapat diubah nilainya (Mutable). Dideklarasikan dengan tanda kurung siku [ ].\n   Contoh: nilai_siswa = [78, 85, 90, 92]\n2. Tuple: Koleksi data berurutan yang TIDAK DAPAT diubah nilainya setelah dibuat (Immutable). Dideklarasikan dengan tanda kurung ( ).\n   Contoh: koordinat_sekolah = (-2.98, 99.62)\n3. Dictionary: Koleksi data yang tidak berurutan dan menyimpan pasangan Kunci dan Nilai (Key-Value Pair). Dideklarasikan dengan tanda kurung kurawal { }.\n   Contoh: biodata = {"nama": "Ahmad", "kelas": "VIII-1", "kkm": 75}',
    kataKunci: ['python', 'list', 'tuple', 'dictionary', 'mutable immutable']
  },
  {
    id: 17,
    noSoal: 17,
    content: 'Jelaskan konsep Fungsi (Function) dalam pemrograman Python yang didefinisikan dengan kata kunci "def". Mengapa pembuatan fungsi (Modularitas) sangat penting dalam penulisan program aplikasi skala besar?',
    elemen: 'Algoritma & Pemrograman (AP)',
    jenjang: 'VIII',
    semester: 'Genap',
    bobot: 7,
    rubrik: 'Menjelaskan konsep blok kode yang dapat dipanggil kembali (reusable) dan prinsip modularitas untuk kemudahan debugging dan pemeliharaan kode.',
    kunciJawaban: 'Fungsi adalah blok kode terorganisir yang dirancang untuk melakukan tugas spesifik tertentu dan hanya akan dieksekusi ketika dipanggil.\nContoh:\ndef hitung_kkm(nilai):\n    return "Lulus" if nilai >= 75 else "Remedial"\nManfaat Modularitas:\n1. Menghindari Pengulangan Kode (Don\'t Repeat Yourself - DRY): Kode cukup ditulis satu kali dan dapat dipanggil puluhan kali di bagian mana saja.\n2. Kemudahan Pelacakan Error (Debugging): Jika terjadi kesalahan perhitungan, perbaikan cukup dilakukan pada satu blok fungsi tersebut.\n3. Kolaborasi Tim: Memungkinkan beberapa pemrogram membagi tugas pembuatan fitur-fitur berbeda secara terpisah.',
    kataKunci: ['fungsi python', 'def', 'modularitas', 'reusable code', 'debugging']
  },
  {
    id: 18,
    noSoal: 18,
    content: 'Sebutkan dan jelaskan 3 ancaman kejahatan siber (Cybercrime) yang sering mengincar siswa dan masyarakat umum di media sosial (misal: Phishing, Ransomware, dan Social Engineering)! Bagaimana langkah perlindungannya?',
    elemen: 'Dampak Sosial Informatika (DSI)',
    jenjang: 'VIII',
    semester: 'Genap',
    bobot: 7,
    rubrik: 'Mendefinisikan 3 kejahatan siber dan menyertakan langkah proteksi preventif yang efektif.',
    kunciJawaban: '1. Phishing: Penipuan dengan membuat situs web atau pesan palsu yang menyerupai lembaga resmi untuk memancing korban memasukkan kata sandi atau data perbankan.\n2. Ransomware: Malware pemeras yang mengenkripsi seluruh file di komputer korban hingga terkunci dan meminta tebusan uang untuk membuka kuncinya.\n3. Social Engineering: Manipulasi psikologis yang memanfaatkan rasa takut, penasaran, atau kepolosan korban agar memberikan kode OTP atau password.\nLangkah Perlindungan:\n• Jangan pernah mengklik tautan mencurigakan.\n• Aktifkan Otentikasi Dua Faktor (2FA).\n• Lakukan pencadangan (backup) data secara teratur.',
    kataKunci: ['phishing', 'ransomware', 'social engineering', '2fa', 'kejahatan siber']
  },
  {
    id: 19,
    noSoal: 19,
    content: 'Jelaskan prinsip kerja Otentikasi Dua Faktor (Two-Factor Authentication / 2FA). Mengapa penggunaan kata sandi (Password) saja sudah tidak lagi cukup untuk mengamankan akun Google atau akun media sosial siswa?',
    elemen: 'Dampak Sosial Informatika (DSI)',
    jenjang: 'VIII',
    semester: 'Genap',
    bobot: 7,
    rubrik: 'Menjelaskan penggabungan 2 faktor keamanan: Something you know (password) + Something you have (kode OTP di smartphone / kunci fisik).',
    kunciJawaban: 'Prinsip 2FA menerapkan lapisan keamanan ganda dengan memverifikasi dua elemen berbeda:\n1. Lapisan Pertama (Something You Know): Sesuatu yang diketahui pengguna, yaitu kata sandi (password).\n2. Lapisan Kedua (Something You Have): Sesuatu yang dimiliki secara fisik oleh pengguna, yaitu kode OTP SMS atau notifikasi autentikator pada smartphone pribadi.\nMengapa Password Saja Tidak Cukup: Kata sandi dapat bocor akibat kebocoran data server (data breach), tebakan peretas, atau terekam kamera pengintai saat mengetik. Jika 2FA aktif, peretas yang mengetahui password tetap tidak dapat login karena tidak memegang HP fisik korban.',
    kataKunci: ['2fa', 'two-factor authentication', 'otp', 'keamanan ganda', 'autentikasi']
  },
  {
    id: 20,
    noSoal: 20,
    content: 'Dalam proyek Praktik Lintas Bidang (PLB), bagaimana computational thinking dan keterampilan Informatika dapat dimanfaatkan untuk memecahkan masalah pengelolaan sampah atau daur ulang di lingkungan sekolah SMP Negeri 7 Kisaran?',
    elemen: 'Praktik Lintas Bidang (PLB)',
    jenjang: 'VIII',
    semester: 'Genap',
    bobot: 7,
    rubrik: 'Merancang solusi berbasis informatika (aplikasi pencatat bank sampah, sistem sensor tempat sampah pintar, analisis tren timbulan sampah harian).',
    kunciJawaban: 'Penerapan Informatika dalam Solusi Sampah Sekolah:\n1. Dekomposisi Masalah: Memetakan sumber sampah sekolah menjadi sampah organik kantin, sampah plastik kemasan, dan kertas kelas.\n2. Aplikasi / Database Bank Sampah: Siswa merancang spreadsheet atau aplikasi web sederhana untuk mencatat setoran sampah daur ulang tiap kelas dan menghitung poin reward otomatis.\n3. Prototipe IoT Smart Dustbin: Menggunakan sensor ultrasonik pada tempat sampah yang memberi peringatan lampu atau pesan Wi-Fi ke petugas kebersihan saat volume sampah sudah 90% penuh.\n4. Analisis Data: Mengolah grafik volume sampah mingguan untuk mengevaluasi efektivitas program bebas plastik sekolah.',
    kataKunci: ['praktik lintas bidang', 'bank sampah', 'iot smart bin', 'dekomposisi', 'solusi lingkungan']
  }
];

// Master Question Pools (Masing-masing paket memiliki 30 butir soal komprehensif)
export const MASTER_ESSAY_POOLS: Record<EssayPackageKey, EssayQuestion[]> = {
  VII_Ganjil: [...ESSAY_QUESTIONS_VII_GANJIL, ...ESSAY_EXTENDED_VII_GANJIL],
  VII_Genap: [...ESSAY_QUESTIONS_VII_GENAP, ...ESSAY_EXTENDED_VII_GENAP],
  VIII_Ganjil: [...ESSAY_QUESTIONS_VIII_GANJIL, ...ESSAY_EXTENDED_VIII_GANJIL],
  VIII_Genap: [...ESSAY_QUESTIONS_VIII_GENAP, ...ESSAY_EXTENDED_VIII_GENAP],
};

export const ESSAY_QUESTION_BANKS: Record<EssayPackageKey, EssayQuestion[]> = {
  VII_Ganjil: ESSAY_QUESTIONS_VII_GANJIL,
  VII_Genap: ESSAY_QUESTIONS_VII_GENAP,
  VIII_Ganjil: ESSAY_QUESTIONS_VIII_GANJIL,
  VIII_Genap: ESSAY_QUESTIONS_VIII_GENAP,
};

export function getEssayPackageKey(kelas: string, semester: SemesterType = 'Ganjil'): EssayPackageKey {
  const jenjang: JenjangKelas = kelas.toUpperCase().includes('VII') && !kelas.toUpperCase().includes('VIII')
    ? 'VII'
    : 'VIII';
  return `${jenjang}_${semester}`;
}

export function getEssayQuestionsForStudent(
  kelas: string,
  semester: SemesterType = 'Ganjil'
): { packageKey: EssayPackageKey; questions: EssayQuestion[]; jenjang: JenjangKelas } {
  const packageKey = getEssayPackageKey(kelas, semester);
  const jenjang: JenjangKelas = packageKey.startsWith('VII_') ? 'VII' : 'VIII';
  const questions = ESSAY_QUESTION_BANKS[packageKey] || ESSAY_QUESTIONS_VIII_GANJIL;
  return { packageKey, questions, jenjang };
}

// =========================================================================
// PSEUDO-RANDOM NUMBER GENERATOR DETERMINISTIK (PRNG) BERBASIS SEED
// Menjamin soal unik berbeda untuk tiap tipe perangkat (Android/iPhone/PC/Chromebook)
// dan berbeda antar-IP untuk mencegah siswa saling mencontek
// =========================================================================
function createSeededPrng(seed: string): () => number {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return function () {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
}

export interface EssayRandomizationContext {
  kelas: string;
  semester: SemesterType;
  namaSiswa: string;
  nisNisn: string;
  clientIp?: string;
  deviceFingerprint?: string;
  deviceModel?: string;
  deviceCategory?: string;
  attemptNumber?: number;
  previousSeenIds?: number[];
}

export interface NonRepeatingEssayResult {
  questions: EssayQuestion[];
  attemptNumber: number;
  packageKey: EssayPackageKey;
  sourceLabel: string;
  uniqueSeedCode: string;
  isFreshAttempt: boolean;
  totalPoolAvailable: number;
}

/**
 * Menghasilkan 15 Butir Soal Esay Online yang:
 * 1. UNIK BERBEDA untuk setiap tipe perangkat (Android, iPhone, Chromebook, PC/Laptop) dan IP.
 * 2. SELALU BERGANTI DENGAN SOAL BARU setiap kali siswa mengulang atau mengikuti ujian susulan (non-repeating).
 */
export function generateNonRepeatingEssayQuestionsForStudent(
  ctx: EssayRandomizationContext
): NonRepeatingEssayResult {
  const packageKey = getEssayPackageKey(ctx.kelas, ctx.semester);
  const masterPool = MASTER_ESSAY_POOLS[packageKey] || ESSAY_QUESTIONS_VIII_GANJIL;
  const cleanName = (ctx.namaSiswa || '').trim().toLowerCase();
  const cleanNis = (ctx.nisNisn || '').trim().toLowerCase();
  const deviceModel = (ctx.deviceModel || 'Perangkat-Siswa').trim();
  const deviceCat = (ctx.deviceCategory || 'Mobile').trim();
  const clientIp = (ctx.clientIp || '103.148.201.77').trim();
  const deviceFp = (ctx.deviceFingerprint || 'DEV-AUTO').trim();

  // Riwayat pengerjaan siswa di localStorage
  const storageAttemptKey = `anbk_essay_attempt_${cleanNis || cleanName || 'anon'}_${packageKey}`;
  const storageSeenIdsKey = `anbk_essay_seen_ids_${cleanNis || cleanName || 'anon'}_${packageKey}`;

  let currentAttempt = ctx.attemptNumber || 1;
  if (!ctx.attemptNumber && typeof window !== 'undefined') {
    try {
      const savedAttempt = parseInt(localStorage.getItem(storageAttemptKey) || '1', 10);
      if (!isNaN(savedAttempt) && savedAttempt >= 1) {
        currentAttempt = savedAttempt;
      }
    } catch {}
  }

  let seenIds: number[] = ctx.previousSeenIds || [];
  if ((!ctx.previousSeenIds || ctx.previousSeenIds.length === 0) && typeof window !== 'undefined') {
    try {
      const savedSeen = localStorage.getItem(storageSeenIdsKey);
      if (savedSeen) {
        seenIds = JSON.parse(savedSeen);
      }
    } catch {}
  }
  const seenIdSet = new Set<number>(seenIds);

  // Buat Seed PRNG yang menggabungkan: Perangkat, Brand/Model, IP, Siswa, dan Nomor Percobaan (Attempt)
  const seedString = `${packageKey}|${deviceCat}|${deviceModel}|${clientIp}|${deviceFp}|${cleanName}|${cleanNis}|att:${currentAttempt}`;
  const prng = createSeededPrng(seedString);

  // Pisahkan soal yang belum pernah dilihat (unseen) dan yang sudah pernah dilihat (seen)
  const unseenPool = masterPool.filter((q) => !seenIdSet.has(q.id));
  const seenPool = masterPool.filter((q) => seenIdSet.has(q.id));

  // Fungsi pengacak deterministik
  const shuffle = <T,>(arr: T[]): T[] => {
    const copy = [...arr];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(prng() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  };

  const shuffledUnseen = shuffle(unseenPool);
  const shuffledSeen = shuffle(seenPool);

  let selectedPool: EssayQuestion[] = [];
  if (shuffledUnseen.length >= 15) {
    selectedPool = shuffledUnseen.slice(0, 15);
  } else {
    // Jika soal baru kurang dari 15 (misal siswa sudah mengulang lebih dari 2 kali),
    // prioritaskan seluruh soal baru yang tersisa, lalu tambahkan sisa soal dari pool seen yang diacak ulang
    selectedPool = [...shuffledUnseen, ...shuffledSeen.slice(0, 15 - shuffledUnseen.length)];
  }

  // Susun dan nomori ulang 1 sampai 15
  const finalQuestions: EssayQuestion[] = selectedPool.map((q, idx) => ({
    ...q,
    noSoal: idx + 1,
  }));

  // Simpan riwayat ID soal yang tampil agar percobaan berikutnya SELALU BERGANTI SOAL BARU
  if (typeof window !== 'undefined') {
    try {
      const newSeenIds = Array.from(new Set([...seenIds, ...finalQuestions.map((q) => q.id)]));
      localStorage.setItem(storageSeenIdsKey, JSON.stringify(newSeenIds));
    } catch {}
  }

  const shortModel = deviceModel.split(' ')[0] || deviceCat;
  const uniqueSeedCode = `ESAY-${packageKey}-DVC(${shortModel})-IP(${clientIp.slice(-4)})-A${currentAttempt}`;
  const isFreshAttempt = currentAttempt > 1 || seenIdSet.size > 0;

  const sourceLabel = `Bank Soal Esay Online Daring Kemendikbudristek & SMPN 7 Kisaran (Unik Device: ${deviceModel} · IP: ${clientIp} · Percobaan ke-${currentAttempt})`;

  return {
    questions: finalQuestions,
    attemptNumber: currentAttempt,
    packageKey,
    sourceLabel,
    uniqueSeedCode,
    isFreshAttempt,
    totalPoolAvailable: masterPool.length,
  };
}

/**
 * Mengambil 15 Soal Esay secara online dari API Backend / Apps Script jika tersedia,
 * dengan jaminan fallback 100% andal ke Bank Soal Kurikulum Merdeka lokal,
 * serta memastikan soal UNIK per Device/IP dan BERGANTI BARU saat mengulang.
 */
export async function fetchOnlineFaseDEssayQuestions(
  jenjang: JenjangKelas,
  semester: SemesterType,
  appsScriptWebAppUrl?: string,
  context?: Partial<EssayRandomizationContext>
): Promise<{
  questions: EssayQuestion[];
  sourceLabel: string;
  packageKey: EssayPackageKey;
  attemptNumber: number;
  uniqueSeedCode: string;
}> {
  const packageKey: EssayPackageKey = `${jenjang}_${semester}`;
  const effectiveCtx: EssayRandomizationContext = {
    kelas: context?.kelas || jenjang,
    semester,
    namaSiswa: context?.namaSiswa || '',
    nisNisn: context?.nisNisn || '',
    clientIp: context?.clientIp || '103.148.201.77',
    deviceFingerprint: context?.deviceFingerprint || 'DEV-AUTO',
    deviceModel: context?.deviceModel || 'Perangkat-Siswa',
    deviceCategory: context?.deviceCategory || 'Mobile',
    attemptNumber: context?.attemptNumber,
    previousSeenIds: context?.previousSeenIds,
  };

  // 1. Coba ambil dari endpoint online internal server dengan menyertakan context perangkat & IP
  if (typeof window !== 'undefined') {
    try {
      const queryParams = new URLSearchParams({
        jenjang,
        semester,
        deviceModel: effectiveCtx.deviceModel || '',
        deviceCategory: effectiveCtx.deviceCategory || '',
        deviceFingerprint: effectiveCtx.deviceFingerprint || '',
        clientIp: effectiveCtx.clientIp || '',
        namaSiswa: effectiveCtx.namaSiswa || '',
        nisNisn: effectiveCtx.nisNisn || '',
        attempt: String(effectiveCtx.attemptNumber || 1),
        _t: String(Date.now()),
      });

      const res = await fetch(`/api/essay-questions?${queryParams.toString()}`, {
        cache: 'no-store',
      });
      if (res.ok) {
        const data = await res.json();
        if (data && Array.isArray(data.questions) && data.questions.length >= 15) {
          return {
            questions: data.questions,
            sourceLabel: data.sourceLabel || `Online Cloud Server UPTD SMP Negeri 7 Kisaran (Unik Device: ${effectiveCtx.deviceModel} · IP: ${effectiveCtx.clientIp})`,
            packageKey,
            attemptNumber: data.attemptNumber || effectiveCtx.attemptNumber || 1,
            uniqueSeedCode: data.uniqueSeedCode || `ESAY-ONLINE-${packageKey}`,
          };
        }
      }
    } catch {
      // lanjut fallback
    }
  }

  // 2. Coba ambil dari Google Apps Script Web App jika URL disediakan
  if (appsScriptWebAppUrl && appsScriptWebAppUrl.startsWith('https://script.google.com')) {
    try {
      const scriptRes = await fetch(
        `${appsScriptWebAppUrl}?action=getEssayQuestions&jenjang=${encodeURIComponent(jenjang)}&semester=${encodeURIComponent(semester)}&_t=${Date.now()}`
      );
      if (scriptRes.ok) {
        const scriptData = await scriptRes.json();
        if (scriptData && Array.isArray(scriptData.questions) && scriptData.questions.length >= 15) {
          return {
            questions: scriptData.questions,
            sourceLabel: 'Google Apps Script Online Cloud (15 Soal Esay)',
            packageKey,
            attemptNumber: effectiveCtx.attemptNumber || 1,
            uniqueSeedCode: `ESAY-GAS-${packageKey}`,
          };
        }
      }
    } catch {
      // fallback
    }
  }

  // 3. Fallback deterministik berbasis Engine Non-Repeating per Device & IP
  const localGenerated = generateNonRepeatingEssayQuestionsForStudent(effectiveCtx);
  return {
    questions: localGenerated.questions,
    sourceLabel: localGenerated.sourceLabel,
    packageKey,
    attemptNumber: localGenerated.attemptNumber,
    uniqueSeedCode: localGenerated.uniqueSeedCode,
  };
}

