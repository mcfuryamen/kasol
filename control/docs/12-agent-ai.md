# Agent AI — Meja Review Draft Otomatis Ekosistem Kasol

> **File ini dibaca oleh AI agent apa pun yang menyentuh modul agent.** Ringkasan
> 1-menit di bawah, detail lengkap setelahnya.

## Ringkasan (TL;DR)

Agent AI = **pekerja draft otomatis yang TIDAK boleh langsung eksekusi** — dia
menyusun bahan (draft pesan WA, laporan, brief SEO), lalu **manusia (owner) yang
memutuskan** di Control Center → halaman **Agent**. Filosofi kunci:
**human-in-the-loop** — AI tidak pernah menyentuh pelanggan/website tanpa
persetujuan.

```
                S I K L U S   D U A   L O P
  LOP 1 (produksi draft):            LOP 2 (keputusan manusia):
  agent_tasks ──runner──▶ Omniroute   agent_outputs (draft) ──review──▶ approved
  (antrean kerja)  │      (otak AI)   Control → halaman Agent   │        │
   ▲               └──▶ draft ───────┘                          └─ rejected
   └── enqueue-reaktivasi.mjs (seeder dari outreach_contacts)
```

---

## 1. Konsep

Ekosistem memakai AI lokal (Omniroute, `http://127.0.0.1:20128`) sebagai **otak**.
Runner lokal (`agent/runner.mjs`) mengambil **tugas** dari tabel `agent_tasks`,
bertanya ke otak, dan menulis **hasil draft** ke `agent_outputs`. Owner me-review
setiap draft di Control → **Agent** (`#agents`), lalu menyetujui/menolak.

**Mengapa draft dulu, bukan langsung aksi?** Pesan WhatsApp ke pelanggan, laporan
audit, atau brief SEO yang salah bisa merusak hubungan klien. Prinsipnya: AI
boleh **menyusun**, manusia yang **menembak**.

### Status draft (lifecycle)

```
draft ──review──▶ approved ──pakai──▶ dipakai
   │  (✓ Setujui)        (📦 Tandai Dipakai)
   └──review──▶ rejected ──bisa──▶ draft (↩ Kembalikan ke Draft)
      (✕ Tolak)
```

- **draft** — hasil AI, menunggu review (chip Draft + statline "menunggu review").
- **approved** — disetujui, siap dipakai (mis. disalin ke modal chat outreach).
- **rejected** — ditolak; boleh dikembalikan ke draft bila mau diperbaiki AI.
- **dipakai** — sudah dieksekusi (terkirim/terpakai), penanda akhir siklus.

## 2. Komponen & File

| Komponen | File | Peran |
|----------|------|-------|
| Otak AI | Omniroute (`127.0.0.1:20128`) | Provider model (combo `auto/*`), dijalankan `node --max-old-space-size=2313` dari install global npm |
| Pintu AI | `agent/callAI.js` | `callAI()` = satu-satunya jalur ke Omniroute; parse SSE manual; `omniHealthy()` cek hidup |
| Runner | `agent/runner.mjs` | Claim tugas atomik → eksekusi handler → `done/error`; `--watch` polling 60s |
| Seeder | `agent/enqueue-reaktivasi.mjs` | Baca `outreach_contacts` → posang `agent_tasks` (idempotent per tipe, dedupe ref_id+judul); flag `--tipe draft_wa\|followup_wa`, `--variasi 1-3`, `--limit`, `--status`, `--arahan`, `--dry-run` |
| Agent handler | `agent/agents/marketing.js` | Spesialis draft WA: basis pengetahuan produk (PRODUK), jawaban keberatan (OBJECTION), sudut manfaat per jenis usaha (hookKategori), sadar relasi klien-lama (source). Tipe: `draft_wa` (± varian A/B/C) & `followup_wa` |
| Meja review | `control/js/agents.js` + `#screen-agents` | UI review: chip filter, statline, baris draft, sheet keputusan |
| Tabel kerja | `agent_tasks`, `agent_outputs` (Supabase) | Antrean tugas & hasil draft |

## 3. Skema Data

### `agent_tasks` — antrean kerja

| Kolom | Isi |
|-------|-----|
| `agent` | `marketing` (nama handler — dipetakan di `HANDLERS` runner) |
| `tipe` | `draft_wa` (draft perkenalan/fase) atau `followup_wa` (lanjutan bawa sudut baru) |
| `payload` | jsonb: `{ kontak_id, kontak:{nama,kategori,status,sent_count,alamat?,catatan?,last_contact_at?,source?}, arahan?, variasi? (1-3, draft_wa), pesan_sebelumnya?, hari_lalu? (followup_wa) }` |
| `status` | `pending → running → done | error` (retry hingga `max_attempts`) |
| `priority` | angka (rendah = didahulukan) |
| `attempts`, `max_attempts` | percobaan (default 3) |
| `runner_id` | identitas PC yang claim (`pc-<COMPUTERNAME>`) |

### `agent_outputs` — hasil draft

| Kolom | Isi |
|-------|-----|
| `task_id` | FK ke `agent_tasks` |
| `agent`, `jenis` | `marketing` / `draft_wa` (jenis lain: `laporan_audit`, `brief_seo`) |
| `ref_table`, `ref_id` | pelacak asal (mis. `outreach_contacts:<id>` — dipakai seeder utk dedupe) |
| `judul`, `isi` | judul + isi draft. Konvensi judul (dipakai seeder utk dedupe per tipe, JANGAN diubah): `Draft WA — X` / `Draft WA B — X` (varian) / `Follow-up — X` |
| `model` | model nyata dari chunk pertama SSE (mis. `auto/best-fast`) |
| `status` | `draft → approved/rejected/dipakai` |
| `review_note`, `reviewed_at` | catatan & waktu keputusan owner |

## 4. Alur Operasional

### 4.1 Menyiapkan kerja (enqueue)

```bash
# Semua kontak 'belum' → draft perkenalan (dedupe otomatis vs output/task lama)
node agent/enqueue-reaktivasi.mjs

# Batch / simulasi / arahan kampanye / varian A/B utk review dibandingkan
node agent/enqueue-reaktivasi.mjs --limit 20
node agent/enqueue-reaktivasi.mjs --dry-run
node agent/enqueue-reaktivasi.mjs --arahan "fokus diskon tahunan"
node agent/enqueue-reaktivasi.mjs --variasi 2

# Gelombang follow-up: kontak terkirim/bales yang belum punya draft Follow-up;
# payload otomatis bawa pesan_sebelumnya (draft approved/dipakai terakhir) + hari_lalu
node agent/enqueue-reaktivasi.mjs --tipe followup_wa
```

Idempotent PER TIPE: `draft_wa` skip kontak yang sudah punya output non-Follow-up;
`followup_wa` skip yang sudah punya output berjudul "Follow-up …"; task
`pending/running` sejenis juga di-skip → aman dijalankan berulang. Kontak yang
sudah di-flag `mati`/`optout` tidak pernah masuk kandidat (status default seeder).

### 4.2 Memproses (runner)

```bash
node agent/runner.mjs          # sekali jalan
node agent/runner.mjs --watch  # polling 60 detik (produksi: Task Scheduler)
```

- Wajib Omniroute hidup — `omniHealthy()` timeout **45s** (warm-up dingin ~25-30s).
- Claim atomik: UPDATE `status='running'` dengan guard `status='pending'`.

### 4.3 Review (Control → Agent)

1. Chip filter: Semua / Draft / Disetujui / Ditolak / Dipakai (berhitung).
2. Statline: antrean (tunda/jalan/gagal) + meja review (menunggu/setuju).
3. Baris list menampilkan **preview isi draft** (2 baris) — scan cepat tanpa buka.
4. Klik baris → sheet: baca isi, tulis catatan, **✓ Setujui / ✕ Tolak / 📦 Dipakai**.
5. Draft WA yang disetujui → tombol **⧉ Salin** → tempel ke modal chat outreach.

## 5. Keamanan

- **RLS tanpa policy publik** — `agent_tasks` & `agent_outputs` tidak bisa dibaca
  anon. Runner/seeder pakai **SERVICE_ROLE** langsung dari PC tepercaya
  (key hanya di `.env.local`, tidak pernah ke browser/Vercel).
- Control membaca via proxy server-side (`/api/rest` → Supabase service role),
  bukan key publik.
- **XSS aman** — semua render `judul/isi/note` lewat `escapeHtml()` (full-map).

## 6. Menambah Agent/Jenis Baru

1. Tulis handler `agent/agents/<nama>.js` — ekspor fungsi
   `({ task, callAI, putOutput, sbFetch }) => result`.
2. Daftarkan di `HANDLERS` runner (`agent/runner.mjs`).
3. (Opsional) `JENIS_META` di `control/js/agents.js` + `AGENT_STATES` bila
   status bertambah.
4. Buat tugas uji `agent_tasks` (payload sesuai handler) → jalankan runner.

## 7. Status & Catatan (2026-09-19)

- ✅ Struktur lengkap: tabel, runner, callAI, agent marketing spesialis, meja review.
- ✅ Alur reaktivasi teruji end-to-end: enqueue → runner → draft `outreach_contacts:<id>`.
- ✅ Fix `omniHealthy` timeout 20s→45s (false negative saat warm-up).
- ✅ Marketing jadi spesialis (2026-09-19): basis pengetahuan produk + keberatan,
  hook per kategori usaha, sadar relasi klien-lama (`source=klien_lama` — 316 kontak
  seed adalah mantan pemakai kasir), tipe `followup_wa`, varian A/B/C, QA UI 2 viewport.
- ⚠️ Runner tidak berjalan terus-menerus — wajib `--watch` / Task Scheduler.
- ⚠️ Kualitas draft tetap bergantung model `auto/best-fast` — review manusia WAJIB
  sebelum pesan dipakai (human-in-the-loop); ada draft lama berisi kalimat Inggris
  (varian model) sebagai contoh kenapa review diperlukan.
- 📌 Stok kerja: kontak `belum` ±315 menunggu enqueue; `@diahkristin` sudah punya
  draft follow-up menunggu review.
- Relasi: [[kasol-marketing-strategy]] · `CONTEXT.md` (port registry).