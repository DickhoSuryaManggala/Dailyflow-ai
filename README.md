# Dailyflow-ai

> Productivity assistant and personal analytics dashboard built with React + Vite and Firebase.

## Ringkasan

`Dailyflow-ai` adalah aplikasi web untuk memantau aktivitas produktivitas, personalisasi AI, dan tinjauan performa mingguan. Proyek ini menggunakan TypeScript, React (Vite), dan Firebase untuk otentikasi dan penyimpanan.

## Fitur Utama

- Dasbor mingguan dengan metrik produktivitas
- Monitor produktivitas real-time
- Personalisasi AI untuk rekomendasi tugas
- Notifikasi dan penyimpanan lokal

## Prasyarat

- Node.js 18+ dan npm atau pnpm
- Akun Firebase (jika ingin menggunakan backend Firestore / rules)

## Menjalankan secara lokal

1. Pasang dependensi:

```bash
npm install
```

2. Salin `env` contoh dan isi variabel yang diperlukan:

```bash
copy .env.example .env
# lalu edit .env sesuai kebutuhan
```

3. Jalankan server development:

```bash
npm run dev
```

4. Buka `http://localhost:5173` (atau port yang ditampilkan)

## Build untuk produksi

```bash
npm run build
npm run preview
```

## Firebase

Proyek menyertakan file `firestore.rules` dan beberapa file konfigurasi Firebase.

- Periksa `firestore.rules` untuk aturan keamanan Firestore.
- Jika ingin deploy ke Firebase Hosting atau Firestore, jalankan `firebase deploy` setelah konfigurasi project Firebase.

## Struktur Proyek (ringkas)

- `src/` — kode aplikasi React
- `src/components/` — komponen UI inti
- `src/utils/` — utilitas seperti `storage.ts`, `notifications.ts`
- `server.ts` — (opsional) backend ringan
- `firestore.rules` — aturan Firestore
- `.env.example` — contoh variabel lingkungan

## Mengelola Environment

Isi `.env` dari `.env.example`. Jangan commit file `.env` ke repo.

