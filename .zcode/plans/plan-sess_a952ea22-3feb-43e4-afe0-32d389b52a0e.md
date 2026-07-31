1. **Mulai server web lokal:** Gunakan modul `http.server` Python untuk menyajikan direktori `rosok`.
2. **Buka browser:** Gunakan `control-browser:open` untuk menavigasi ke URL aplikasi (misalnya, `http://localhost:8000`).
3. **Verifikasi pemuatan awal:** Periksa keberadaan judul aplikasi utama atau elemen UI penting.
4. **Uji Shift Kas:**
    *   Navigasi ke bagian manajemen kas.
    *   Klik "Buka Kas".
    *   Masukkan modal awal (misalnya, 100000) dan konfirmasi.
    *   Verifikasi shift kas sudah terbuka.
5. **Uji Transaksi "Beli" (Pembelian):**
    *   Navigasi ke "Transaksi Baru" dan pilih "Beli".
    *   Tambahkan item (misalnya, "Kardus" 10kg, "Besi" 5kg) ke keranjang.
    *   Lanjutkan ke pembayaran, pilih "Tunai", dan simpan transaksi.
    *   Verifikasi pesan sukses dan keranjang kosong.
6. **Uji Transaksi "Jual" (Penjualan):**
    *   Navigasi ke "Transaksi Baru" dan pilih "Jual".
    *   Tambahkan item (misalnya, "Aluminium" 3kg) ke keranjang.
    *   Lanjutkan ke pembayaran, pilih "Tunai", dan simpan transaksi.
    *   Verifikasi pesan sukses dan keranjang kosong.
7. **Uji Tutup Shift Kas:**
    *   Navigasi kembali ke manajemen kas.
    *   Klik "Tutup Kas" dan konfirmasi.
    *   Verifikasi shift kas sudah tertutup.
8. **Uji Offline Singkat:**
    *   Gunakan `control-browser` untuk mengatur jaringan ke offline.
    *   Coba navigasi atau berinteraksi untuk melihat apakah aplikasi yang di-cache berfungsi.
    *   Atur jaringan kembali ke online.
9. **Laporkan Temuan:** Ringkas perilaku yang diamati dan masalah apa pun.