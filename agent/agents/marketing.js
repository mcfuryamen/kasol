/**
 * Agent Marketing — agent/agents/marketing.js
 * =============================================================================
 * SPESIALIS draft pesan WhatsApp outreach — Mesin Kasir Solo (kasirsolo.com).
 * Berbekal basis pengetahuan produk (PRODUK), jawaban keberatan (OBJECTION),
 * dan sudut manfaat per jenis usaha (hookKategori), dia menyusun draft
 * kontekstual per kontak — SEMUA berhenti sebagai 'draft' di agent_outputs
 * untuk direview manusia di Control → Agent (human-in-the-loop).
 *
 * Tugas (task.tipe):
 *  - 'draft_wa'     : 1 draft per kontak; payload.variasi 1-3 → varian A/B/C.
 *  - 'followup_wa'  : draft lanjutan setelah pesan pertama — wajib bawa sudut
 *                     BARU, bukan pengulangan pitch (lihat payload di bawah).
 *
 * Payload (task.payload):
 *  { kontak_id, kontak: { nama, kategori?, status, sent_count, alamat?,
 *      catatan?, last_contact_at?, source? }, arahan?, variasi?,
 *      pesan_sebelumnya?, hari_lalu? }
 *
 * Hasil: ≥1 baris agent_outputs (jenis='draft_wa', status='draft',
 * ref_id=kontak_id). Konvensi judul: "Draft WA — X" / "Draft WA B — X"
 * (varian) / "Follow-up — X" — dipakai seeder utk dedupe per tipe, JANGAN
 * diubah sembarangan.
 */

// ── Basis pengetahuan ─────────────────────────────────────────────────────────
const PRODUK = `
Fakta produk (WAJIB akurat — jangan mengarang fitur/harga/promo lain):
- Produk: aplikasi kasir "Kasir Solo" — jalan di HP, dipasang seperti aplikasi (PWA), ringan.
- Offline-first: data jualan tersimpan di HP sendiri, tetap jalan tanpa internet.
- Fitur inti: catat penjualan, buka/tutup kas harian, catat pengeluaran & pemasukan, laporan untung harian/mingguan, cetak struk via printer Bluetooth, backup data.
- Harga: SEKALI BAYAR Rp 500.000 untuk SELAMANYA — tanpa langganan bulanan/tahunan.
- Bisa dicoba gratis dulu (kuota transaksi gratis tiap bulan, tanpa kartu kredit).
- Bayar: QRIS atau transfer bank, bukti di-upload di aplikasi, lisensi aktif umumnya < 1 jam.
- Pasang didampingi lewat video call sampai jalan.
- Link: https://kaki5.kasirsolo.com
`;

const OBJECTION = `
Jawaban keberatan umum (pakai bila relevan, cukup satu per pesan):
- "Mahal" → sekali Rp 500rb selamanya vs aplikasi langganan yang nempel tiap bulan; kalau dihitung setahun < Rp 1.500/hari.
- "Ribet / gaptek" → tampilannya sederhana buat UMKM; pasang didampingi video call sampai jalan.
- "Takut data hilang" → data ada di HP sendiri + bisa dibackup; tanpa internet pun tetap jalan.
- "Sudah pakai aplikasi lain" → tanpa biaya bulanan, ringan, bisa coba gratis dulu tanpa harus pindah data.
`;

const GAYA = `
Gaya pesan outreach Mesin Kasir Solo:
- Bahasa Indonesia santai tapi sopan; sapa kontak "Kak" / nama sapaan yang diberikan.
- Maksimal ~6 baris, emoji secukupnya (1-3).
- Fokus SATU sudut manfaat yang nyambung dengan jenis usaha kontak — bukan daftar fitur.
- Selalu akhiri pertanyaan/CTA ringan ("Mau linknya, Kak?").
- DILARANG placeholder seperti [nama] / {nama} — tulis langsung.
- DILARANG klaim palsu (pernah chat/temui kontak) atau menyebut diskon/tanggal promo yang tidak ada di fakta produk.
- Variasikan kalimat pembuka antar draft — jangan semuanya mirip.
- Kembalikan HANYA isi pesannya, tanpa kata pengantar atau tanda kutip pembungkus.
`;

// ── Kontekstualisasi kontak ───────────────────────────────────────────────────
const HOOK_KATEGORI = [
  [/makan|warung|kedai|cafe|resto|rm\b|ayam|seblak|bakso|mie|kopi|jajan|warteg/i,
    'Sudut manfaat: catat pesanan & kas warung jadi rapi — tiap tutup usaha langsung kelihatan untung harian.'],
  [/kelontong|sembako|toko\b|grosir|pulsa|bangunan|sparepart|alat/i,
    'Sudut manfaat: struk rapi + laporan per barang — gampang lihat mana yang paling laku dan untungnya.'],
  [/salon|barber|laundry|service|servis|jasa|bengkel|foto|rental|travel|iuran/i,
    'Sudut manfaat: catat pelanggan & pembayaran jadi satu di HP — tidak ada transaksi kelewat.'],
  [/butik|fashion|baju|sepatu|tas|olshop|online shop/i,
    'Sudut manfaat: penjualan online & offline tercatat jadi satu, laporan per item tinggal buka.'],
  [/rosok|pengepul|dagang|jualan|keliling/i,
    'Sudut manfaat: catat beli-jual langsung di HP — ringkas, tanpa buku besar.'],
];

function hookKategori(kategori) {
  const k = String(kategori || '');
  for (const [re, hook] of HOOK_KATEGORI) if (re.test(k)) return hook;
  return 'Sudut manfaat: ganti catat buku manual — jualan, kas, dan untung harian tercatat otomatis di HP.';
}

/** Nama sapaan ringkas — mirror waSapa() di control/js/outreach.js (jangan beda hasil) */
function sapaNama(nama) {
  const words = String(nama || '').replace(/^@/, '')
    .replace(/^(toko|warung|kedai|rm|wm|cafe|resto)\s+/i, '')
    .split(/\s+/).filter((w) => !/^(bp|ibu|mbak|mas|pak|bu)\.?$/i.test(w));
  return words.slice(0, 2).join(' ') || 'Kak';
}

function hariSejak(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return Math.max(0, Math.round((Date.now() - d.getTime()) / 86_400_000));
}

function relasiKontak(k) {
  if (k.source === 'klien_lama') {
    return 'Relasi: kontak adalah KLIEN LAMA Mesin Kasir Solo (dulu pernah memakai kasir dari kami) — sapa hangat seperti kenalan lama, bukan orang asing. Bila ada alamat, boleh menyebut area/jalannya sekilas, tapi JANGAN tulis alamat lengkap dengan nomor rumah.';
  }
  return 'Relasi: kontak masih prospek baru — perkenalan dari nol, jangan mengaku pernah bertemu/chat.';
}

/** Status pipeline: belum → terkirim → bales → minat → beli (+ mati/optout di luar outreach) */
function faseKonteks(k) {
  if (k.status === 'beli') {
    return ['AFTER SALES', 'Kontak SUDAH MEMBELI — cukup makasih + satu tips pakai + tawaran bantuan bila ada kendala. JANGAN menjual lagi.'];
  }
  if (k.status === 'minat') {
    return ['CLOSING', 'Kontak sudah bilang MINAT — bantu ia memutuskan: sekali bayar Rp 500rb selamanya, bayar QRIS/transfer, lisensi aktif < 1 jam, pasang didampingi. Tanya kapan mau mulai coba.'];
  }
  const hari = hariSejak(k.last_contact_at);
  if ((Number(k.sent_count) || 0) > 0 || ['terkirim', 'bales'].includes(k.status)) {
    return ['FOLLOW-UP', `Kontak sudah pernah dihubungi${hari != null ? ` ${hari} hari lalu` : ''} — buka ringan tanpa kagep, ingatkan sekilas, lalu bawa SATU sudut manfaat baru, tutup satu pertanyaan.`];
  }
  return ['PERKENALAN', 'Kontak belum pernah dihubungi — perkenalkan diri singkat, satu sudut manfaat utama, CTA minta izin kirim link coba gratis.'];
}

// ── Prompt dasar ──────────────────────────────────────────────────────────────
function systemPrompt() {
  return `Kamu SPESIALIS marketing WhatsApp untuk Mesin Kasir Solo (kasirsolo.com), bisnis aplikasi kasir UMKM Indonesia.\n${PRODUK}${GAYA}`;
}

function dataKontak(k) {
  const bagian = [`nama="${k.nama}" (sapaan: "${sapaNama(k.nama)}")`, `kategori bisnis="${k.kategori || 'usaha kecil'}"`];
  if (k.alamat) bagian.push(`alamat="${k.alamat}"`);
  if (k.catatan) bagian.push(`catatan="${k.catatan}"`);
  return `Data kontak: ${bagian.join(', ')}.`;
}

// ── Tipe: draft_wa ────────────────────────────────────────────────────────────
async function handlerDraft({ task, callAI }) {
  const k = task.payload?.kontak || {};
  if (!k.nama) throw new Error('payload.kontak.nama wajib ada');
  const arahan = task.payload?.arahan || '';
  const nVar = Math.min(3, Math.max(1, parseInt(task.payload?.variasi, 10) || 1));
  const [fase, arah] = faseKonteks(k);

  const user = [
    `Buatkan ${nVar > 1 ? `${nVar} DRAFT ALTERNATIF pesan WA — masing-masing sudut/kalimat pembuka BENAR-BENAR berbeda (bukan sekadar ganti kata). Pisahkan tiap draft dengan satu baris berisi tepat: ===V===` : '1 draft pesan WA'}.`,
    dataKontak(k),
    hookKategori(k.kategori),
    relasiKontak(k),
    `Fase pesan: ${fase}. ${arah}`,
    arahan ? `Arahan tambahan dari boss: ${arahan}` : '',
  ].filter(Boolean).join('\n');

  const { text, model } = await callAI({
    model: 'auto/best-fast',
    messages: [
      { role: 'system', content: systemPrompt() },
      { role: 'user', content: user },
    ],
    temperature: 0.85,
    maxTokens: 700,
  });

  const varian = splitVarian(text.trim()).slice(0, nVar);
  const sapa = sapaNama(k.nama);
  return varian.map((isi, i) => ({
    judul: nVar > 1 ? `Draft WA ${['A', 'B', 'C'][i] || 'A'} — ${sapa}` : `Draft WA — ${sapa}`,
    isi,
    model,
  }));
}

/** Pisahkan varian ===V=== ; gagal parse → 1 varian utuh (fallback aman) */
function splitVarian(t) {
  const bersih = (s) => s.trim().replace(/^["“]+|["”]+$/g, '').replace(/^(draft|varian)\s+[abc][:.]\s*/i, '').trim();
  const parts = t.split(/^\s*={2,}V={2,}\s*$/m).map(bersih).filter(Boolean);
  return parts.length ? parts : [bersih(t)];
}

// ── Tipe: followup_wa ─────────────────────────────────────────────────────────
async function handlerFollowup({ task, callAI }) {
  const p = task.payload || {};
  const k = p.kontak || {};
  if (!k.nama) throw new Error('payload.kontak.nama wajib ada');
  const hari = p.hari_lalu ?? hariSejak(k.last_contact_at);
  const prev = String(p.pesan_sebelumnya || '').trim().slice(0, 400);
  const arahan = p.arahan || '';

  const user = [
    'Buatkan 1 draft pesan FOLLOW-UP WhatsApp (pesan lanjutan setelah pesan pertama diabaikan/dibalas singkat).',
    dataKontak(k),
    hookKategori(k.kategori),
    relasiKontak(k),
    prev
      ? `Pesan sebelumnya yang sudah terkirim${hari != null ? ` ${hari} hari lalu` : ''}:\n---\n${prev}\n---`
      : `Kontak sudah menerima pesan pertama${hari != null ? ` ${hari} hari lalu` : ''} (isi pesannya tidak tersedia).`,
    'Aturan follow-up (WAJIB):',
    '- JANGAN menyalin/mengulang pitch pesan sebelumnya.',
    `- Pilih SATU sudut BARU: salah satu jawaban keberatan umum di bawah, fitur lain, atau hitung-hitungan harga.${arahan ? `\n- Arahan tambahan dari boss: ${arahan}` : ''}`,
    '- Lebih PENDEK dari pesan pertama (maksimal 4 baris), santai, tidak menuntut balasan.',
    '- Tutup dengan SATU pertanyaan ringan yang gampang dijawab.',
    OBJECTION,
  ].filter(Boolean).join('\n');

  const { text, model } = await callAI({
    model: 'auto/best-fast',
    messages: [
      { role: 'system', content: systemPrompt() },
      { role: 'user', content: user },
    ],
    temperature: 0.8,
    maxTokens: 400,
  });

  return [{
    judul: `Follow-up — ${sapaNama(k.nama)}`,
    isi: splitVarian(text.trim())[0],
    model,
  }];
}

// ── Dispatcher ────────────────────────────────────────────────────────────────
const TIPE = {
  draft_wa: handlerDraft,
  followup_wa: handlerFollowup,
};

export async function jalankanMarketing({ task, callAI, putOutput }) {
  const tipe = TIPE[task.tipe] ? task.tipe : 'draft_wa';
  const drafts = await TIPE[tipe]({ task, callAI });
  for (const d of drafts) {
    await putOutput({
      task_id: task.id,
      agent: 'marketing',
      jenis: 'draft_wa',
      ref_table: 'outreach_contacts',
      ref_id: task.payload?.kontak_id || null,
      judul: d.judul,
      isi: d.isi,
      model: d.model,
      status: 'draft',
    });
  }
  return { ok: true, tipe, jumlah: drafts.length };
}
