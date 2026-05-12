# EXATA Client Access System

## Ringkasan

**EXATA Client Access** adalah platform _enterprise internal_ yang dirancang untuk mengelola dan mendistribusikan dokumen sensitif kepada client secara aman. Sistem ini menggantikan proses distribusi manual yang berisiko tinggi dengan menyediakan portal akses berbasis token unik, di mana client dapat melihat dan mengunduh dokumen seperti _Dattai Ichijikin_, Resi Transfer, dan Kwitansi tanpa perlu melakukan registrasi akun tradisional, namun tetap terlindungi dengan verifikasi identitas yang ketat.

## Tujuan Proyek

Sistem ini dibangun untuk menyelesaikan beberapa tantangan kritikal:

- **Keamanan PII (Personally Identifiable Information):** Menghindari pengiriman dokumen sensitif melalui _unsecured channels_ (Email/WhatsApp).
- **Sentralisasi Data:** Menyatukan seluruh arsip dokumen client dalam satu repositori yang terorganisir.
- **Audit Compliance:** Menyediakan _audit trail_ lengkap untuk memantau siapa, kapan, dan dari mana sebuah dokumen diakses atau diunduh.
- **Lifecycle Management:** Mengotomatisasi penghapusan dokumen sesuai kebijakan retensi (3 bulan) untuk menjaga kepatuhan privasi data.

## Tech Stack

Proyek ini menggunakan stack teknologi modern dengan prinsip _security-first_:

- **Frontend:** Next.js 16.2 (App Router), React 19, TypeScript.
- **Styling:** Tailwind CSS 4, shadcn/ui.
- **Backend as a Service (BaaS):** Supabase.
  - **Auth:** Supabase Auth (JWT & RBAC).
  - **Database:** PostgreSQL dengan Row Level Security (RLS).
  - **Serverless:** Supabase Edge Functions (Deno runtime).
  - **Storage:** Supabase Storage (S3-compatible, Private Buckets).
  - **Realtime:** Supabase Realtime (WebSocket untuk progres batch upload).
- **Library Penting:**
  - **Validation:** Zod.
  - **State Management:** TanStack Query (Client-side) & RSC (Server-side).
  - **Cryptography:** Jose (JWT handling).
  - **Data Export:** XLSX.

## Arsitektur Sistem

Sistem menggunakan pola **Modular Monolith** dengan delegasi logika berat ke _layer_ database dan _edge computing_:

- **Communication Flow:** Client berkomunikasi dengan Next.js App Router, yang kemudian melakukan _server-side calls_ ke Supabase API.
- **Service Responsibility:** Next.js menangani UI dan orkestrasi, sementara Supabase menangani persistensi, keamanan data (RLS), dan _background processing_.
- **Database Queue Pattern:** Batch upload diproses secara asinkron menggunakan tabel `batch_jobs` dan dipicu oleh _database webhooks_ menuju Edge Functions.

## Alur Sistem

1. **Authentication Flow:** Admin dan Agent masuk melalui Supabase Auth. Akses dibatasi berdasarkan _role_ yang tersimpan di tabel `users`.
2. **Document Distribution Flow:**
   - Agent mendaftarkan client dan mengunggah dokumen.
   - Sistem men-generate _secure link_ unik.
   - Client menerima link dan mengakses halaman `/access/[token]`.
3. **Verification Flow (Challenge-Response):**
   - Client wajib memasukkan Tanggal Lahir (DOB) sebagai verifikasi.
   - Jika valid, sistem memberikan _session token_ (JWT) yang disimpan di `httpOnly` cookie.
4. **Realtime Flow:** Progres unggahan _batch_ ditampilkan secara _realtime_ kepada Agent menggunakan WebSocket.
5. **Retention Flow:** `pg_cron` menjalankan _job_ harian untuk menghapus file di storage yang telah melewati masa berlaku 3 bulan.

## Fitur Utama

- **Secure Tokenized Link:** URL akses menggunakan 256-bit entropy token yang di-hash dengan SHA-256 di database (Raw token tidak pernah disimpan).
- **Challenge Verification:** Proteksi tambahan bagi client tanpa perlu _password_.
- **Batch Upload Worker:** Mendukung unggahan hingga 50 file sekaligus dengan mekanisme _retry_ otomatis.
- **Granular Audit Logging:** Pencatatan setiap aksi (Login, View, Download, Create) secara _append-only_.
- **Signed URL Access:** Dokumen di storage tidak memiliki akses publik; setiap unduhan menggunakan URL bertanda tangan dengan masa berlaku 5 menit.

## Struktur Folder

```text
exata-app/
├── src/
│   ├── app/                # Next.js App Router (Pages & API Routes)
│   ├── components/         # Reusable UI Components (shadcn/ui)
│   ├── features/           # Logika bisnis terfragmentasi (Auth, Clients, Docs)
│   ├── hooks/              # Custom React Hooks
│   ├── lib/                # Konfigurasi Supabase, Utils, & Validations
│   ├── types/              # Global TypeScript Interfaces
│   └── middleware.ts       # Route protection & Session handling
├── supabase/
│   ├── functions/          # Edge Functions (Batch Worker, Token Gen)
│   └── migrations/         # SQL Schema & RLS Policies
└── public/                 # Static Assets
```

## Environment Variables

Konfigurasikan file `.env.local` dengan variabel berikut:

| Variable                        | Fungsi                                            | Required |
| ------------------------------- | ------------------------------------------------- | -------- |
| `NEXT_PUBLIC_SUPABASE_URL`      | URL endpoint proyek Supabase                      | Ya       |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public key untuk akses anonim/public              | Ya       |
| `SUPABASE_SERVICE_ROLE_KEY`     | Secret key untuk operasi admin (Server-side only) | Ya       |

## API Documentation

Sistem menggunakan RESTful API yang dihasilkan secara otomatis oleh PostgREST (Supabase) dengan tambahan _custom endpoints_ di Next.js:

| Endpoint                    | Method   | Deskripsi                    | Auth           |
| --------------------------- | -------- | ---------------------------- | -------------- |
| `/auth/login`               | POST     | Autentikasi Agent/Admin      | Public         |
| `/clients`                  | GET/POST | Manajemen data client        | Internal JWT   |
| `/clients/{id}/tokens`      | POST     | Generate link akses baru     | Internal JWT   |
| `/access/{token}`           | GET      | Validasi token client        | Public         |
| `/access/{token}/verify`    | POST     | Verifikasi DOB & Get Session | Public         |
| `/access/{token}/documents` | GET      | List dokumen client          | Session Cookie |

## Database Structure

- **Engine:** PostgreSQL.
- **Relasi Utama:**
  - `users` (1:N) `clients`: Agent mengelola banyak client.
  - `clients` (1:N) `client_tokens`: Satu client memiliki sejarah token akses.
  - `clients` (1:N) `documents`: Client memiliki beberapa kategori dokumen.
  - `documents` (1:N) `document_files`: Satu kategori dokumen bisa berisi banyak file gambar.
- **Migration System:** Menggunakan Supabase Migration via CLI.

## Installation

1. Pastikan Node.js v20+ dan npm terinstall.
2. Clone repositori ini.
3. Masuk ke direktori aplikasi:
   ```bash
   cd exata-app
   ```
4. Install dependensi:
   ```bash
   npm install
   ```

## Development Setup

1. Copy `.env.example` menjadi `.env.local` dan isi nilainya.
2. Jalankan server development:
   ```bash
   npm run dev
   ```
3. Akses aplikasi di `http://localhost:3000`.

## Build & Production

- **Build Process:** `npm run build` menghasilkan _bundle_ yang dioptimalkan untuk produksi.
- **Deployment:** Direkomendasikan menggunakan Vercel atau platform serupa yang mendukung Next.js.
- **Database Setup:** Pastikan ekstensi `pg_cron` aktif di instance Supabase untuk menjalankan skrip pembersihan otomatis.

## Security Notes

- **Token Security:** Menggunakan model hashing SHA-256 sesuai `TOKEN_SECURITY_MODEL.md`.
- **Data Protection:** Seluruh data PII terenkripsi _at rest_ dan akses dikontrol ketat oleh RLS.
- **Rate Limiting:** Implementasi pembatasan _request_ di level database untuk mencegah _brute-force_ pada _challenge verification_.

## Dependency Analysis

- **@supabase/ssr:** Esensial untuk mengelola sesi Supabase di Next.js App Router (Server & Client Components).
- **zod:** Digunakan secara ketat untuk validasi kontrak data antara frontend dan backend.
- **xlsx:** Digunakan untuk modul laporan administratif.
- **jose:** Digunakan untuk verifikasi JWT pada _edge middleware_ untuk performa maksimal.

## Known Issues / Technical Debt

- **Edge Cold Start:** Ada sedikit _latency_ (1-2 detik) pada request pertama ke Edge Functions setelah lama tidak digunakan.
- **Image Processing:** Saat ini sistem tidak melakukan kompresi gambar di sisi server (mengandalkan limit 10MB).

## Improvement Recommendations

- **Image Optimization:** Implementasi transformasi gambar otomatis (WebP/AVIF) untuk menghemat bandwidth.
- **Redis Integration:** Menggunakan Upstash/Redis untuk _rate limiting_ yang lebih _scalable_ dibanding solusi tabel PostgreSQL.
- **Advanced Analytics:** Integrasi dashboard dengan materialized views untuk performa laporan yang lebih cepat pada data skala besar.
