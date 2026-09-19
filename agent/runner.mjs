/**
 * Agent Runner Ekosistem Kasol — agent/runner.mjs
 * =============================================================================
 * Jembatan lokal: antrean Supabase (agent_tasks) ←→ otak AI Omniroute (lokal).
 *
 * Siklus (dijalankan Task Scheduler / manual):
 *   1. Pastikan Omniroute hidup (omniHealthy).
 *   2. Claim tugas pending (atomic: UPDATE ... WHERE status='pending' RETURNING).
 *   3. Eksekusi sesuai agent+tipe → tulis draft ke agent_outputs (status 'draft').
 *   4. Tandai done/error (retry sampai max_attempts, lalu error).
 *
 * Akses DB: langsung REST Supabase pakai SERVICE_ROLE (runner berjalan di PC
 * terpercaya — key tidak pernah menyentuh browser/Vercel).
 *
 * PENGGUNAAN:
 *   node agent/runner.mjs           — sekali jalan (proses semua tugas pending)
 *   node agent/runner.mjs --watch   — polling terus (interval 60s)
 *
 * ENV (.env.local di root repo): SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { callAI, omniHealthy } from './callAI.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

// ── muat .env.local (pola sama dengan control/server.js) ──────────────────────
try {
  const env = readFileSync(join(ROOT, '.env.local'), 'utf8');
  for (const line of env.split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m || process.env[m[1]]) continue;
    process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
  }
} catch { /* .env.local opsional */ }

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const RUNNER_ID = `pc-${process.env.COMPUTERNAME || 'lokal'}`;
const POLL_MS = 60_000;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('[runner] FATAL: SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY kosong (.env.local)');
  process.exit(1);
}

// ── Supabase REST helper ──────────────────────────────────────────────────────
async function sbFetch(path, { method = 'GET', body } = {}) {
  const res = await fetch(`${SUPABASE_URL.replace(/\/$/, '')}${path}`, {
    method,
    headers: {
      'apikey': SERVICE_KEY,
      'Authorization': `Bearer ${SERVICE_KEY}`,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(method === 'PATCH' ? { 'Prefer': 'return=representation' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) throw new Error(`supabase_${res.status}: ${text.slice(0, 300)}`);
  return data;
}

// Claim tanpa RPC: SELECT pending → UPDATE dengan guard status='pending' →
// kalau representation kosong berarti tugas sudah diambil runner lain.
async function claimTaskGuarded() {
  const pend = await sbFetch(
    '/rest/v1/agent_tasks?select=id,agent,tipe,payload,attempts,max_attempts&status=eq.pending&order=priority.asc,created_at.asc&limit=1',
  );
  const t = pend?.[0];
  if (!t) return null;
  const got = await sbFetch(
    `/rest/v1/agent_tasks?id=eq.${t.id}&status=eq.pending`,
    { method: 'PATCH', body: { status: 'running', runner_id: RUNNER_ID, claimed_at: new Date().toISOString(), attempts: t.attempts + 1 } },
  );
  return Array.isArray(got) && got.length ? got[0] : null;
}

async function setDone(id, result) {
  await sbFetch(`/rest/v1/agent_tasks?id=eq.${id}`, {
    method: 'PATCH',
    body: { status: 'done', result, finished_at: new Date().toISOString() },
  });
}

async function setError(id, msg) {
  const rows = await sbFetch(`/rest/v1/agent_tasks?select=attempts,max_attempts&id=eq.${id}`);
  const t = rows?.[0];
  const exhausted = t && t.attempts >= t.max_attempts;
  await sbFetch(`/rest/v1/agent_tasks?id=eq.${id}`, {
    method: 'PATCH',
    body: {
      status: exhausted ? 'error' : 'pending',
      last_error: msg.slice(0, 500),
      ...(exhausted ? { finished_at: new Date().toISOString() } : {}),
    },
  });
}

async function putOutput(out) {
  await sbFetch('/rest/v1/agent_outputs', { method: 'POST', body: out });
}

// ── Handler tugas per agent ───────────────────────────────────────────────────
import { jalankanMarketing } from './agents/marketing.js';

const HANDLERS = {
  marketing: jalankanMarketing,
};

// ── Loop utama ────────────────────────────────────────────────────────────────
async function prosesSekali() {
  if (!(await omniHealthy())) {
    console.log('[runner] Omniroute tidak hidup — dilewati dulu.');
    return;
  }
  for (;;) {
    const task = await claimTaskGuarded();
    if (!task) break;
    console.log(`[runner] Claim ${task.agent}/${task.tipe} (${task.id.slice(0, 8)})`);
    try {
      const handler = HANDLERS[task.agent];
      if (!handler) throw new Error(`tidak ada handler utk agent '${task.agent}'`);
      const result = await handler({ task, callAI, putOutput, sbFetch });
      await setDone(task.id, result || { ok: true });
      console.log(`[runner] Selesai ${task.id.slice(0, 8)}`);
    } catch (e) {
      console.error(`[runner] Gagal ${task.id.slice(0, 8)}: ${e.message}`);
      await setError(task.id, e.message);
    }
  }
}

async function main() {
  const watch = process.argv.includes('--watch');
  do {
    const t0 = Date.now();
    try { await prosesSekali(); }
    catch (e) { console.error('[runner] Siklus gagal:', e.message); }
    if (!watch) break;
    const sisa = Math.max(0, POLL_MS - (Date.now() - t0));
    await new Promise((r) => setTimeout(r, sisa));
  } while (watch);
}

main().catch((e) => { console.error('[runner] FATAL:', e); process.exit(1); });
