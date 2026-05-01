# GhostSub (YouTube Channel Queue Manager)

Aplikasi desktop berbasis Electron untuk mengotomatiskan antrean *subscribe* ke banyak channel YouTube sekaligus. Dilengkapi dengan teknologi *stealth* tingkat lanjut dan simulasi gerakan *mouse* (*humanoid clicker*) untuk menghindari deteksi anti-bot dari YouTube.

![Electron](https://img.shields.io/badge/Electron-191970?style=flat-square&logo=Electron&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js-43853D?style=flat-square&logo=node.js&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=flat-square&logo=tailwind-css&logoColor=white)

---

## Fitur Utama

- **Humanoid Auto-Clicker**: Tidak menggunakan metode `.click()` primitif. Bot ini mensimulasikan pergerakan mouse fisik dengan kurva *Cubic Bezier*, tremor mikroskopis (*Gaussian noise*), dan klik tingkat perangkat keras (`sendInputEvent`).
- **Stealth Mode**: Penyamaran identitas *browser* secara otomatis. Menghapus jejak Chromium WebDriver dan memalsukan *User-Agent* agar terdeteksi sebagai pengguna Chrome murni.
- **Behavioral Randomization**: Mengacak waktu tunggu dan melakukan *scroll* halaman secara acak sebelum melakukan klik untuk meniru perilaku pengguna yang sedang membaca halaman.
- **Smart Queue Management**: Masukkan puluhan *link* channel sekaligus. Aplikasi akan memprosesnya satu per satu, mengecek apakah sudah *subscribe*, dan melewatkannya jika sudah.
- **Persistensi Data**: Antrean disimpan secara otomatis ke dalam `data.json` lokal sehingga tidak hilang saat aplikasi ditutup.

## Prasyarat

Pastikan Anda telah menginstal:
- [Node.js](https://nodejs.org/) (Versi 18 atau lebih baru direkomendasikan)
- Akun Google/YouTube yang sudah *login* di komputer (Sistem akan membuka *window* YouTube, pastikan Anda menekan tombol *login* secara manual saat pertama kali jika diperlukan).

## Instalasi & Penggunaan

1. *Clone* atau unduh *repository* ini.
2. Buka terminal di folder proyek ini (`yt-queue`).
3. Instal dependensi:
   ```bash
   npm install
   ```
4. Jalankan aplikasi:
   ```bash
   npm start
   ```

## Cara Menggunakan

1. Jalankan aplikasi.
2. Di kolom teks **Channel Links**, *paste* URL channel YouTube yang ingin di-subscribe (satu *link* per baris). Contoh: `https://www.youtube.com/@NamaChannel`.
3. Klik **Add to Queue**.
4. Pastikan **Smart Mode: ON** menyala (hijau) agar bot otomatis berjalan sepenuhnya.
5. Klik **START** pada Control Panel.
6. Tunggu dan biarkan bot bekerja! Anda bisa melihat log dan statusnya secara *real-time* di layar utama.

## Peringatan Penting (Disclaimer)

- **Risiko Banned/Shadowban**: Skrip otomasi seperti ini secara teknis melanggar *Terms of Service* (ToS) YouTube. Meskipun bot ini dilengkapi fitur *anti-detection* yang sangat kuat, menjalankan proses *subscribe* dalam jumlah yang tidak wajar (misal: ratusan dalam sehari) sangat berisiko membuat akun Anda terkena *shadowban* atau diblokir.
- **Saran Penggunaan**: Jangan melebihi 15-20 *subscribe* berturut-turut per hari menggunakan alat ini. Perpanjang waktu jeda (`randomDelay`) di `renderer.js` untuk meningkatkan tingkat keamanan.
- Segala risiko atas penggunaan *tools* ini sepenuhnya merupakan tanggung jawab pengguna.

## Penyesuaian Tingkat Lanjut

Jika Anda ingin mengubah kecepatan transisi antar channel, buka `renderer.js` dan modifikasi fungsi `randomDelay` di bagian terbawah. Semakin lama jeda, semakin aman bot Anda:

```javascript
function randomDelay() {
  // Rentang saat ini: 4 hingga 7 detik (Sangat cepat, cocok untuk antrean pendek)
  // Ubah nilainya jika ingin lebih aman, contoh: (60000 - 30000) + 30000 untuk 30-60 detik.
  return Math.floor(Math.random() * (7000 - 4000)) + 4000
}
```

