# Kasir Solo - Rosok

Aplikasi kasir PWA untuk usaha pengepul rosok / barang bekas. Catat pembelian, penjualan, stok, dan kas dengan mudah.

## 📦 Installation

### Cara Install di HP (PWA):
1. Buka aplikasi di browser Chrome/Safari
2. Klik menu → "Add to Home Screen"
3. Icon akan muncul di home screen dengan logo Kasir Solo

### Cara Install di Desktop:
1. Buka di Chrome/Edge
2. Klik icon install di address bar
3. Atau: Menu → More Tools → Create Shortcut

## 🚀 Running Locally

```bash
# Menggunakan Python (simple HTTP server)
python3 -m http.server 8080

# Atau menggunakan Node.js
npx serve .
```

Lalu buka: `http://localhost:8080`

**Note:** PWA memerlukan HTTPS atau localhost untuk berfungsi penuh (Service Worker & Manifest).

## 📱 Features

### Transaksi
- ✅ Pembelian rosok dari penjual
- ✅ Penjualan rosok ke bandar
- ✅ Sistem timbang (kg, ons, kuintal)
- ✅ Keranjang belanja dengan wizard 2 langkah
- ✅ Pembayaran: Tunai, Transfer, Tempo (utang/piutang)
- ✅ Cetak nota & share via WhatsApp

### Manajemen
- ✅ Tracking stok real-time per kategori
- ✅ 10 kategori default (kardus, besi, aluminium, dll)
- ✅ Tambah/ubah/hapus kategori
- ✅ Emoji picker untuk kategori

### Kas
- ✅ Buka/tutup kas (shift)
- ✅ Modal awal & perhitungan selisih
- ✅ Kas masuk/keluar manual
- ✅ Riwayat kas shift (10 terakhir)

### Laporan
- ✅ Penjualan & pembelian per periode
- ✅ Top 5 kategori terlaris
- ✅ Grafik bar chart 7 hari terakhir
- ✅ Utang/piutang tempo
- ✅ Kas saldo & riwayat

### Lain-lain
- ✅ Sistem lisensi offline (trial 7 hari)
- ✅ Backup/restore data (JSON)
- ✅ Bekerja offline (PWA)
- ✅ Responsive mobile-first design

## 🏗️ Tech Stack

- **Frontend:** Vanilla HTML5, CSS3, JavaScript (ES6+)
- **Database:** Dexie.js (IndexedDB wrapper)
- **PWA:** Service Worker + Web App Manifest
- **Build Tools:** Sharp.js (icon generation)
- **Icons:** 192x192, 512x512, favicon 16/32px

## 📂 Project Structure

```
rosok/
├── index.html          # Main application (267KB)
├── sw.js               # Service Worker (v4)
├── manifest.json       # PWA manifest
├── logo.png            # Source logo (600x600)
├── icon-192.png        # PWA icon 192x192
├── icon-512.png        # PWA icon 512x512
├── favicon-16.png      # Favicon 16x16
├── favicon-32.png      # Favicon 32x32
├── splash-1028.png     # iOS splash screen
├── AUDIT_REPORT.md     # Audit report
├── CHANGELOG.md        # Version history
└── README.md           # This file
```

## 🔐 Security

- XSS prevention dengan `escapeHtml()`
- Sanitasi semua input user
- Client-side license validation (HMAC-SHA256)
- Data tersimpan lokal (IndexedDB)

## 📝 License

Copyright © 2026 PT Mesin Kasir Solo

## 🤝 Support

- WhatsApp: 0881-6566-935
- Email: owner.kasirsolo@gmail.com

---

**Versi:** 1.3.0  
**Last Updated:** 2026-07-31
