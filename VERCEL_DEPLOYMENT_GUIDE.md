# Panduan Cara Mengonlinekan Aplikasi ke Vercel (vercel.app)

Aplikasi **ANBK Informatika & Soal Ujian UPTD SMP Negeri 7 Kisaran** telah dilengkapi dengan seluruh konfigurasi yang dibutuhkan agar dapat langsung dideploy ke **Vercel** (`.vercel.app`).

---

## 📁 File Konfigurasi yang Dibuat

1. **`vercel.json`**
   - Mengatur framework `vite`.
   - Menghubungkan direktori build `dist`.
   - Mengarahkan rute API (`/__api/*` dan `/api/*`) ke Serverless Function Vercel.
   - Mengaktifkan SPA Fallback ke `index.html` agar tidak terjadi error 404 saat navigasi atau refresh halaman.
   - Mengatur header keamanan, cache Service Worker (`sw.js`), dan Web App Manifest (`manifest.json`) PWA.

2. **`api/index.ts`**
   - Vercel Serverless Function yang menangani endpoint backend seperti sinkronisasi nilai/token, pembuatan rekap, deteksi IP/jaringan, dan webhook.

3. **`.vercelignore` & `.gitignore`**
   - Menjaga repositori tetap bersih dan mempercepat proses deploy.

---

## 🚀 Cara 1: Deploy Otomatis via GitHub (Paling Direkomendasikan)

1. **Upload / Push Kode ke GitHub**:
   - Buat repositori baru di akun GitHub Anda (misalnya: `anbk-smpn7-kisaran`).
   - Push source code proyek ini ke branch `main`.

2. **Buka Vercel Dashboard**:
   - Masuk ke [https://vercel.com](https://vercel.com) dan login dengan akun GitHub Anda.
   - Klik tombol **"Add New..."** lalu pilih **"Project"**.

3. **Import Repositori**:
   - Pilih repositori yang baru Anda buat, lalu klik **"Import"**.

4. **Konfigurasi Project (Sudah Otomatis Terdeteksi)**:
   - **Framework Preset**: Vite
   - **Root Directory**: `./` (biarkan default)
   - **Build Command**: `vite build`
   - **Output Directory**: `dist`

5. **Tambahkan Environment Variables (Opsional)**:
   Di bagian **Environment Variables**, tambahkan:
   - `GEMINI_API_KEY`: *(API Key Gemini AI Anda jika ingin mengaktifkan fitur AI)*
   - `APP_URL`: *(URL domain Vercel Anda, misal `https://nama-proyek.vercel.app`)*

6. **Klik "Deploy"**:
   - Vercel akan otomatis melakukan build.
   - Dalam ~1-2 menit, aplikasi Anda sudah online dan dapat diakses dengan domain `https://nama-proyek.vercel.app`!

---

## 💻 Cara 2: Deploy Cepat via Vercel CLI (Terminal)

Jika Anda memiliki akses terminal atau Node.js di komputer:

1. Jalankan perintah:
   ```bash
   npx vercel
   ```
2. Login dan ikuti instruksi di layar (pilih `Y` untuk konfirmasi).
3. Untuk langsung deploy ke production domain:
   ```bash
   npx vercel --prod
   ```

---

## 🔒 Konfigurasi Domain Kustom (Opsional)
Jika sekolah memiliki domain sendiri (misalnya `ujian.smpn7kisaran.sch.id`):
1. Buka project Anda di dashboard Vercel.
2. Masuk ke **Settings** > **Domains**.
3. Tambahkan domain sekolah Anda dan arahkan DNS CNAME sesuai instruksi Vercel.
