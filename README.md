# Sistem Tes Pelatihan BDI

Aplikasi mandiri untuk Pre-Test, Post-Test, dan maksimal tiga Remedial. Frontend
menggunakan React + TypeScript + Vite, API berjalan pada Cloudflare Workers,
data relasional disimpan di D1, dan gambar soal disimpan di bucket R2 privat.

## Fitur V1

- Login dan pengelolaan beberapa akun admin.
- Role Superadmin dan Admin dengan pembatasan Kelola Admin di server.
- Halaman Akun Saya untuk memperbarui nama, username, dan password.
- Bank soal pilihan ganda A-D, gambar soal, status aktif, dan statistik pemakaian.
- Import `.docx` melalui validasi dan preview sebelum data disimpan.
- Pelatihan dengan banyak angkatan, jadwal manual/terjadwal, durasi, dan passing grade.
- Alokasi soal least-used-first serta paket angkatan yang permanen setelah aktif.
- Layout terpisah untuk Pre, Post, dan Remedial dengan urutan soal/pilihan yang diacak.
- Tes peserta mobile-first dengan timer server, autosave lokal/server, dan pemulihan sesi.
- Penilaian di server, maksimal tiga remedial, dan penghentian remedial setelah lulus.
- Hasil peserta, detail jawaban, perbaikan nama, reset attempt, dan export Excel.
- Penghapusan data pelatihan lama dengan konfirmasi nama pelatihan.

## Requirement

- Node.js LTS yang didukung oleh Vite dan Wrangler.
- npm.
- Akun Cloudflare untuk D1, R2, dan deployment production.
- Wrangler terautentikasi untuk menjalankan perintah remote: `npx wrangler login`.

## Instalasi

```bash
npm install
```

## Environment variable

Aplikasi V1 tidak memerlukan secret aplikasi tambahan. Salin file contoh untuk
menyediakan tempat secret lokal jika nanti diperlukan:

```bash
copy .dev.vars.example .dev.vars
```

Jangan commit `.dev.vars`. Nilai non-secret `APP_ENV` sudah diatur di
`wrangler.jsonc` menjadi `development` untuk lokal dan `production` untuk
environment production.

## Setup lokal

Wrangler membuat D1 dan R2 lokal secara otomatis dari binding di
`wrangler.jsonc`. Terapkan migration, lalu buat admin pertama:

```bash
npm run db:migrate
npm run admin:create
```

Script admin meminta nama, username, dan password minimal 12 karakter melalui
terminal interaktif. Password di-hash menggunakan PBKDF2-SHA-256 dengan salt
acak dan tidak ditampilkan di terminal. Akun pertama otomatis menjadi
`SUPERADMIN`; akun berikutnya menggunakan role `ADMIN` dan dapat dikelola oleh
Superadmin dari aplikasi.

Jalankan aplikasi:

```bash
npm run dev
```

Buka URL yang ditampilkan Vite. Login admin tersedia di `/admin/login`, sedangkan
endpoint pemeriksaan runtime tersedia di `/api/health`.

## Setup Cloudflare production

### 1. Buat D1

```bash
npx wrangler d1 create bdi-test-db-production
```

Salin `database_id` dari hasil perintah ke binding `DB` pada
`env.production.d1_databases` di `wrangler.jsonc`.

### 2. Buat bucket R2

```bash
npx wrangler r2 bucket create bdi-test-images-production
```

Nama bucket harus sama dengan `bucket_name` pada binding `QUESTION_IMAGES` di
environment production. Bucket tetap privat; gambar dikirim melalui endpoint
Worker yang melakukan pemeriksaan akses.

### 3. Terapkan migration remote

```bash
npm run db:migrate:remote
```

Migration diterapkan berurutan. Jangan mengubah file migration yang sudah pernah
digunakan di production; buat migration baru untuk perubahan berikutnya.

### 4. Buat admin production

```bash
npm run admin:create -- --remote
```

### 5. Deploy

```bash
npm run deploy
```

Perintah ini menjalankan build lalu menerbitkan Worker dan static assets ke
environment `production`. URL `workers.dev` yang diberikan Wrangler dapat
langsung dipakai sebagai alamat aplikasi V1.

## Perintah proyek

```bash
npm run dev                 # development lokal
npm run typecheck           # pemeriksaan TypeScript
npm test                    # unit/integration test
npm run build               # build production
npm run check:startup       # pemeriksaan waktu startup Worker
npm run db:migrate          # migration D1 lokal
npm run db:migrate:remote   # migration D1 production
npm run admin:create        # admin lokal pertama/tambahan
npm run deploy              # deploy environment production
```

## Export dan backup

### Export hasil operasional

Masuk sebagai admin, buka menu **Hasil**, pilih pelatihan atau filter yang
dibutuhkan, lalu gunakan **Export Excel**. Workbook berisi:

- Ringkasan peserta dan nilai Pre/Post/Remedial.
- Detail jawaban setiap attempt.
- Informasi pelatihan dan pengaturan tes.

### Backup D1

Gunakan export bawaan Wrangler sebelum penghapusan data lama atau perubahan
besar:

```bash
npx wrangler d1 export bdi-test-db-production --remote --env production --output backup-bdi.sql
```

Simpan hasil backup di lokasi aman di luar repository karena dapat berisi data
peserta. Penghapusan pelatihan dari UI mempertahankan bank soal dan nilai
`times_assigned`, tetapi menghapus data pelatihan, angkatan, peserta, attempt,
dan hasil yang bergantung padanya.

Objek R2 dapat dicadangkan terpisah melalui dashboard Cloudflare atau alat R2
yang dipakai organisasi. D1 hanya menyimpan key gambar, bukan binary gambar.

## Struktur folder

- `src/` — React SPA, halaman, layout, komponen, fitur, dan styling.
- `worker/` — Worker API, route, middleware, validasi, security, repository, dan aturan bisnis.
- `migrations/` — schema dan migration D1 berurutan.
- `scripts/` — pembuatan admin, fixture import, dan utilitas pengujian beban.
- `tests/` — test aturan bisnis kritis dan keamanan route.
- `wrangler.jsonc` — Worker, static assets, binding D1/R2, dan environment.

## Catatan keamanan dan operasional

- Jangan simpan password, cookie sesi, backup database, atau credential Cloudflare di repository.
- Admin mutation dilindungi session cookie, CSRF token, origin validation, dan validasi input.
- Participant API tidak mengirim kunci jawaban; penilaian dilakukan di server.
- Paket soal tidak dapat diubah setelah pelatihan berstatus aktif.
- Bagikan link `/t/:slug` dari halaman detail pelatihan kepada peserta.
