# Estimasi Biaya Proyek

## Voice-Activated Court Case Archive Inventory System

**Tanggal:** 8 Juli 2026
**Disusun untuk:** Proposal ke Klien
**Status:** Estimasi Awal (Non-Binding)

---

## 1. Ringkasan

Dokumen ini menyajikan estimasi biaya pengembangan dan operasional untuk sistem arsip perkara pengadilan berbasis suara (Speech-to-Text & Text-to-Speech), sesuai spesifikasi pada PRD dan TSD proyek.

**Asumsi dasar estimasi:**
- Tim pengembang: 2–3 orang (Backend NestJS, Frontend Next.js, opsional QA/PM)
- Durasi pengerjaan: 2 bulan
- Model biaya: harga borongan/project (bukan per jam)
- Skala penggunaan: internal satu instansi/kantor pengadilan, belasan–puluhan pengguna bersamaan
- Cakupan fitur: sesuai PRD.md & TSD.md — autentikasi & role (Admin/Petugas), CRUD data perkara & rak, pencarian suara dengan fuzzy matching, text-to-speech hasil pencarian, impor data awal (CSV/Excel), praktik keamanan dasar OWASP Top 10

---

## 2. Biaya Pengembangan (Sekali Bayar)

| Skenario Tim | Estimasi Biaya |
|---|---|
| 2 orang (Backend + Frontend) × 2 bulan | Rp 30.000.000 – Rp 45.000.000 |
| 3 orang (+ QA/PM paruh waktu) × 2 bulan | Rp 40.000.000 – Rp 60.000.000 |

Rentang harga mengacu pada rate pasar freelance/tim kecil tingkat menengah di Indonesia. Termasuk: desain teknis, coding frontend & backend, integrasi STT/TTS, pengujian internal, dan setup awal deployment.

---

## 3. Biaya Operasional Tahun Pertama (Recurring)

| Komponen | Estimasi / Tahun | Keterangan |
|---|---|---|
| Domain (.id / .com) | Rp 150.000 – Rp 300.000 | Perpanjangan tahunan |
| Server (VPS 2 vCPU / 4GB RAM) | Rp 1.200.000 – Rp 3.000.000 | Cukup untuk skala internal |
| SSL/HTTPS | Rp 0 | Gratis (Let's Encrypt) |
| Backup berkala (opsional) | Rp 300.000 – Rp 600.000 | Cadangan basis data |
| **Subtotal Operasional** | **Rp 1.650.000 – Rp 3.900.000** | |

---

## 4. Total Biaya Bersih Tahun Pertama

| Skenario | Pengembangan | Operasional Tahun 1 | **Total** |
|---|---|---|---|
| Tim 2 orang | Rp 30.000.000 – 45.000.000 | Rp 1.650.000 – 3.900.000 | **Rp 31.650.000 – Rp 48.900.000** |
| Tim 3 orang | Rp 40.000.000 – 60.000.000 | Rp 1.650.000 – 3.900.000 | **Rp 41.650.000 – Rp 63.900.000** |

---

## 5. Catatan Penting

- Estimasi ini bersifat **kasar/indikatif**, berdasarkan rate pasar umum — bukan penawaran resmi/mengikat. Angka final tergantung negosiasi rate tim dan pemilihan vendor infrastruktur.
- Mulai tahun kedua, biaya yang berjalan hanya biaya operasional (~Rp 1,65–3,9 juta/tahun), tanpa biaya pengembangan ulang — kecuali ada permintaan fitur baru atau perubahan besar.
- Jika instansi memiliki server internal sendiri (on-premise), komponen biaya VPS dapat dihilangkan.
- Belum termasuk pajak/PPN (jika melalui vendor berbadan hukum) dan biaya pelatihan pengguna/dokumentasi tambahan (jika diminta terpisah dari scope ini).
- Estimasi ini mengacu pada cakupan fitur MVP sesuai PRD.md dan TSD.md per tanggal dokumen ini dibuat; perubahan scope dapat mengubah estimasi biaya dan waktu.

---

## 6. Referensi

- Spesifikasi produk: `PRD.md`
- Spesifikasi teknis: `TSD.md`
- Ringkasan desain: `docs/superpowers/specs/2026-07-08-court-case-archive-design.md`
