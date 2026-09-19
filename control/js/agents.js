/**
 * Control Center Kasir Solo — Agent Module (review draft AI)
 * Antrean kerja agent AI ekosistem kasol: runner lokal (agent/runner.mjs)
 * memakan tugas dari agent_tasks via otak Omniroute (127.0.0.1:20128),
 * lalu menulis draft ke agent_outputs. Modul ini = meja review:
 *   draft → approved/rejected (+catatan), draft WA approved bisa langsung
 *   disalin gaya modal chat outreach.
 *
 * Layout: workbench native-style sama dengan Outreach — chip rail berhitung,
 * baris padat, sheet review dengan aksi putuskan.
 *
 * Akses: semua data lewat supabaseFetch() → /api/rest (proxy server-side).
 * Tabel: agent_tasks, agent_outputs (RLS tanpa policy publik).
 */

import { showToast } from './toast.js';
import { escapeHtml, formatRelativeTime } from './utils.js';
import { supabaseFetch } from './api.js';
import { updateSidebarBadges } from './navigation.js?v=20260915a';

let outputs = [];      // baris agent_outputs
let tasks = [];        // baris agent_tasks (status antrean utk statline)
let chipFilter = '';   // '' = semua
let detailId = null;

/** Chip filter + statistik sekaligus — urutan = alur review */
const AGENT_STATES = [
  { key: '',         short: 'Semua',   tone: 'blue'   },
  { key: 'draft',    short: 'Draft',   tone: 'orange' },
  { key: 'approved', short: 'Disetujui', tone: 'green' },
  { key: 'rejected', short: 'Ditolak', tone: 'red'    },
  { key: 'dipakai',  short: 'Dipakai', tone: 'teal'   },
];

const STATE_META = {
  draft:    { label: 'Draft',      short: 'Draft',   tone: 'orange' },
  approved: { label: 'Disetujui',  short: 'Setuju',  tone: 'green'  },
  rejected: { label: 'Ditolak',    short: 'Tolak',   tone: 'red'    },
  dipakai:  { label: 'Dipakai',    short: 'Dipakai', tone: 'teal'   },
};

const JENIS_META = {
  draft_wa:      { label: 'Draft WA',   ic: '💬' },
  laporan_audit: { label: 'Laporan',    ic: '📋' },
  brief_seo:     { label: 'Brief SEO',  ic: '🔎' },
};

const jenisMeta = (j) => JENIS_META[j] || { label: j || 'Output', ic: '🤖' };
const stateMeta = (s) => STATE_META[s] || STATE_META.draft;

export function initAgents() {
  window.addEventListener('screen:change', (e) => {
    if (e.detail?.screen === 'agents') { loadAgents(); }
  });

  loadAgents();
}

/** Muat outputs + tasks (coalesced — panggilan beruntun digabung satu request) */
async function loadAgents() {
  if (loadAgents._inflight) return loadAgents._inflight;
  const p = (async () => {
    try {
      const [resO, resT] = await Promise.all([
        supabaseFetch('/rest/v1/agent_outputs?order=created_at.desc&limit=200'),
        supabaseFetch('/rest/v1/agent_tasks?select=id,agent,tipe,status,created_at&order=created_at.desc&limit=50'),
      ]);
      outputs = resO.ok ? (resO.data || []) : [];
      tasks = resT.ok ? (resT.data || []) : [];
    } catch (e) {
      outputs = []; tasks = [];
      console.error('load agents', e);
    }
    renderAll();
    const draftN = outputs.filter((o) => o.status === 'draft').length;
    updateSidebarBadges({ agents: draftN });
  })();
  loadAgents._inflight = p;
  try { return await p; } finally { loadAgents._inflight = null; }
}
window.refreshAgents = loadAgents;

function filteredOutputs() {
  if (!chipFilter) return outputs;
  return outputs.filter((o) => o.status === chipFilter);
}

function renderAll() {
  renderChips();
  renderStatline();
  renderList();
}

/** Chip rail: filter status + berhitung */
function renderChips() {
  const host = document.getElementById('agentChips');
  if (!host) return;
  const chips = AGENT_STATES.map((c) => ({
    ...c,
    n: c.key ? outputs.filter((o) => o.status === c.key).length : outputs.length,
  }));
  host.innerHTML = chips.map((c) => `
    <button type="button" class="oc-chip ${chipFilter === c.key ? 'on' : ''}" data-tone="${c.tone}"
      aria-pressed="${chipFilter === c.key}" onclick="setAgentChip('${c.key}')">
      <i aria-hidden="true"></i>${escapeHtml(c.short)}<span class="n">${c.n}</span>
    </button>`).join('');
}

window.setAgentChip = function (key) {
  if (chipFilter === key) return;
  chipFilter = key;
  renderChips();
  renderList();
};

/** Statline dua kutub: kiri = antrean agent, kanan = meja review */
function renderStatline() {
  const host = document.getElementById('agentStatline');
  if (!host) return;
  const running = tasks.filter((t) => t.status === 'running').length;
  const pending = tasks.filter((t) => t.status === 'pending').length;
  const draft = outputs.filter((o) => o.status === 'draft').length;
  const approved = outputs.filter((o) => o.status === 'approved').length;
  const err = tasks.filter((t) => t.status === 'error').length;
  host.innerHTML = `
    <span class="oc-stat-g">
      <span class="oc-stat-ic">⚙</span>Antrean <b>${pending}</b> tunda · <b>${running}</b> jalan
      ${err ? `<span class="oc-stat-err"><b>${err}</b> gagal</span>` : ''}
    </span>
    <span class="oc-stat-g">
      <span class="oc-stat-ic">✎</span>Draft <b>${draft}</b> menunggu · <b>${approved}</b> setuju
    </span>`;
}

/** Potong isi draft utk preview baris — strip markup, max 2 baris via CSS clamp */
function previewText(raw, max = 150) {
  if (!raw) return '';
  const txt = String(raw)
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return txt.length > max ? txt.slice(0, max).trimEnd() + '…' : txt;
}

/** Satu baris padat: ikon jenis + judul + preview isi + model + waktu + badge status */
function renderList() {
  const host = document.getElementById('agentCardList');
  const empty = document.getElementById('agentEmpty');
  if (!host || !empty) return;

  const rows = filteredOutputs();
  if (!rows.length) {
    host.innerHTML = '';
    empty.hidden = false;
    return;
  }
  empty.hidden = true;

  host.innerHTML = rows.map((o) => {
    const sm = stateMeta(o.status);
    const jm = jenisMeta(o.jenis);
    const prev = previewText(o.isi);
    return `
      <div class="oc-row" data-id="${escapeHtml(o.id)}" role="button" tabindex="0" aria-label="${escapeHtml(o.judul)}, ${escapeHtml(sm.label)}">
        <div class="oc-ava oc-ava--blue" title="${escapeHtml(jm.label)}">${jm.ic}</div>
        <div class="oc-main">
          <div class="oc-name">${escapeHtml(o.judul)}</div>
          ${prev ? `<div class="oc-preview">${escapeHtml(prev)}</div>` : ''}
          <div class="oc-sub">${escapeHtml(jm.label)}${o.model ? ' · ' + escapeHtml(o.model) : ''} · ${o.created_at ? escapeHtml(formatRelativeTime(o.created_at)) : ''}</div>
        </div>
        <div class="oc-side">
          <span class="badge ${sm.tone}">${escapeHtml(sm.short)}</span>
        </div>
      </div>`;
  }).join('');

  host.querySelectorAll('.oc-row').forEach((row) => {
    row.addEventListener('click', () => openAgentDetail(row.dataset.id));
    row.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openAgentDetail(row.dataset.id); }
    });
  });
}

/* ================= Sheet review ================= */

window.openAgentDetail = function (id) {
  const o = outputs.find((x) => x.id === id);
  if (!o) return;
  detailId = id;
  renderSheetBody(o);
  document.getElementById('sheetAgentDetail')?.classList.add('open');
};

window.closeAgentDetail = function () {
  detailId = null;
  closeSheet('sheetAgentDetail');
};

function renderSheetBody(o) {
  if (!o) { closeAgentDetail(); return; }
  const esc = escapeHtml;
  const sm = stateMeta(o.status);
  const jm = jenisMeta(o.jenis);
  document.getElementById('agentSheetTitle').textContent = jm.label;

  const isWa = o.jenis === 'draft_wa';
  document.getElementById('agentDetailBody').innerHTML = `
    <div class="oc-sh">
      <div class="oc-ava oc-ava--lg oc-ava--blue" aria-hidden="true">${jm.ic}</div>
      <div class="oc-sh-id">
        <div class="oc-sh-name">${esc(o.judul)}</div>
        <div class="oc-sub">${esc(jm.label)} · agent ${esc(o.agent || '?')}</div>
      </div>
      <span class="badge ${sm.tone}">${esc(sm.label)}</span>
    </div>
    <div class="oc-sh-stats">
      <div class="oc-sh-stat"><span class="oc-sh-sl">Model</span><span class="oc-sh-sv">${esc(o.model || '—')}</span></div>
      <div class="oc-sh-stat"><span class="oc-sh-sl">Dibuat</span><span class="oc-sh-sv">${o.created_at ? esc(formatRelativeTime(o.created_at)) : '—'}</span></div>
      <div class="oc-sh-stat"><span class="oc-sh-sl">Status</span><span class="oc-sh-sv">${esc(sm.label)}</span></div>
    </div>
    ${o.review_note ? `<div class="oc-sh-meta">📝 ${esc(o.review_note)}</div>` : ''}
    <div class="field">
      <label class="field-label" for="agentIsiText">Isi draft — bisa disalin/diedit</label>
      <textarea id="agentIsiText" rows="9">${esc(o.isi)}</textarea>
    </div>
    <div class="field">
      <input type="text" id="agentReviewNote" placeholder="Catatan review (opsional)" value="${esc(o.review_note || '')}">
    </div>
    <div class="btn-block-row" style="margin-top:var(--s3)">
      ${o.status === 'draft' ? `
        <button type="button" class="btn btn-outline" onclick="copyAgentIsi()">⧉ Salin</button>
        <button type="button" class="btn btn-danger" onclick="reviewAgentOutput('${esc(o.id)}','rejected')">✕ Tolak</button>
        <button type="button" class="btn btn-primary" onclick="reviewAgentOutput('${esc(o.id)}','approved')">✓ Setujui</button>` : ''}
      ${o.status === 'rejected' ? `
        <button type="button" class="btn btn-outline" onclick="copyAgentIsi()">⧉ Salin</button>
        <button type="button" class="btn btn-primary" onclick="reviewAgentOutput('${esc(o.id)}','draft')">↩ Kembalikan ke Draft</button>` : ''}
      ${o.status === 'approved' || o.status === 'dipakai' ? `
        <button type="button" class="btn btn-outline" onclick="copyAgentIsi()">⧉ Salin Isi</button>` : ''}
      ${o.status === 'approved' ? `
        <button type="button" class="btn btn-primary" onclick="reviewAgentOutput('${esc(o.id)}','dipakai')">📦 Tandai Dipakai</button>` : ''}
    </div>`;
}

/** Putuskan draft: approved/rejected/dipakai/draft — optimistic + rollback */
window.reviewAgentOutput = async function (id, status) {
  const prev = outputs.find((o) => o.id === id);
  if (!prev) return;
  const note = (document.getElementById('agentReviewNote')?.value || '').trim();
  const patch = { status, review_note: note || null, reviewed_at: new Date().toISOString() };

  outputs = outputs.map((o) => o.id === id ? { ...o, ...patch } : o);
  renderAll();
  renderSheetBody(outputs.find((o) => o.id === id));
  try {
    const res = await supabaseFetch(`/rest/v1/agent_outputs?id=eq.${encodeURIComponent(id)}`, {
      method: 'PATCH',
      data: patch,
      headers: { Prefer: 'return=representation' }
    });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    showToast(status === 'approved' ? 'Draft disetujui ✓' : status === 'rejected' ? 'Draft ditolak' : status === 'dipakai' ? 'Ditandai dipakai' : 'Dikembalikan ke draft', 1600, 'success');
    loadAgents();
  } catch (e) {
    outputs = outputs.map((o) => o.id === id ? prev : o);
    renderAll();
    renderSheetBody(prev);
    showToast('Gagal menyimpan review', 2200, 'error');
    console.error('review output', e);
  }
};

/** Salin isi draft ke clipboard */
window.copyAgentIsi = async function () {
  const val = document.getElementById('agentIsiText')?.value || '';
  if (!val) return;
  try {
    await navigator.clipboard.writeText(val);
    showToast('Isi draft disalin ✓', 1500, 'success');
  } catch {
    // fallback textarea select
    document.getElementById('agentIsiText')?.select();
    document.execCommand('copy');
    showToast('Isi draft disalin ✓', 1500, 'success');
  }
};
