/**
 * TPA DB Initialization Bootstrap
 * Dijalankan di setiap halaman:
 *   1. Buka DB
 *   2. Verifikasi schema indexes
 *   3. Seed demo data kalau kosong
 *   4. Verifikasi session user
 */
import { db } from './dexie.js';
import { seedDemoData } from './seed.js';

const DB_INIT_KEY = 'tpa_db_initialized';

/**
 * Initialize database. Returns true if init succeeded.
 */
export async function initDB() {
  try {
    // Buka koneksi DB (Dexie lazy-open)
    await db.open();
    console.log('[init] Database opened:', db.name, 'v' + db.verno);

    // Seed demo data jika DB kosong
    await seedDemoData();

    // Tandai sudah di-init (per browser, per session)
    sessionStorage.setItem(DB_INIT_KEY, '1');

    return true;
  } catch (err) {
    console.error('[init] DB init failed:', err);
    return false;
  }
}

/**
 * Check if DB was already initialized this session
 */
export function isDBInitialized() {
  return sessionStorage.getItem(DB_INIT_KEY) === '1';
}

/**
 * Get current session user from localStorage
 * Format: { id, name, role, locationId, locationName, teacherId?, guardianId? }
 */
export function getSessionUser() {
  try {
    const raw = localStorage.getItem('tpa_session');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/**
 * Set session user
 */
export function setSessionUser(user) {
  localStorage.setItem('tpa_session', JSON.stringify(user));
}

/**
 * Clear session user (logout)
 */
export function clearSessionUser() {
  localStorage.removeItem('tpa_session');
}

/**
 * Get current location from session
 */
export function getSessionLocation() {
  const user = getSessionUser();
  if (!user) return null;
  return { id: user.locationId, name: user.locationName };
}

/**
 * Check if user has role
 */
export function hasRole(...roles) {
  const user = getSessionUser();
  return user && roles.includes(user.role);
}

/**
 * Require auth - redirect to login if not authenticated
 * @param {string[]} allowedRoles - roles yang boleh akses halaman ini
 */
export function requireAuth(...allowedRoles) {
  const user = getSessionUser();
  if (!user) {
    redirectToLogin();
    return false;
  }
  if (allowedRoles.length > 0 && !allowedRoles.includes(user.role)) {
    redirectByRole(user.role);
    return false;
  }
  return true;
}

export function redirectToLogin() {
  window.location.href = 'index.html';
}

export function redirectByRole(role) {
  const pages = {
    admin: 'admin.html',
    ustadz: 'guru.html',
    wali: 'wali.html'
  };
  window.location.href = pages[role] || 'index.html';
}

/* =========================================================
   Utility functions (shared, not tied to a specific layer)
   ========================================================= */

export function today() {
  return new Date().toISOString().split('T')[0];
}

export function fd(dateStr) {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleDateString('id-ID', {
    day: '2-digit', month: 'short', year: 'numeric'
  });
}

export function fdl(dateStr) {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleDateString('id-ID', {
    weekday: 'long', day: '2-digit', month: 'long', year: 'numeric'
  });
}

export function fc(amount) {
  return 'Rp ' + Number(amount || 0).toLocaleString('id-ID');
}

export function ini(name) {
  return (name || '?').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
}

export function $id(id) {
  return document.getElementById(id);
}

export function el(tag, attrs, children) {
  const e = document.createElement(tag);
  if (attrs) {
    Object.entries(attrs).forEach(([k, v]) => {
      if (k === 'class') e.className = v;
      else if (k.startsWith('on')) e[k] = v;
      else if (k === 'html') e.innerHTML = v;
      else if (k === 'text') e.textContent = v;
      else e.setAttribute(k, v);
    });
  }
  if (children) {
    if (typeof children === 'string') e.innerHTML = children;
    else if (Array.isArray(children)) children.forEach(c => { if (c) e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
    else e.appendChild(children);
  }
  return e;
}

export function snack(type, message) {
  const icons = { ok: '&#10003;', err: '&#10007;', info: '&#8505;' };
  const s = el('div', {
    class: 'snack ' + type,
    html: icons[type] + ' ' + message
  });
  document.body.appendChild(s);
  setTimeout(() => s.remove(), 3500);
}

export function openSheet(title, bodyContent, footerContent) {
  const bsTitle = $id('bs-title');
  const bsBody = $id('bs-body');
  const bsFoot = $id('bs-foot');
  const bs = $id('bs');
  const bsOv = $id('bs-ov');

  if (bsTitle) bsTitle.textContent = title;
  if (bsBody) {
    bsBody.innerHTML = '';
    if (typeof bodyContent === 'string') bsBody.innerHTML = bodyContent;
    else bsBody.appendChild(bodyContent);
  }
  if (bsFoot) {
    bsFoot.innerHTML = '';
    if (footerContent) {
      if (typeof footerContent === 'string') bsFoot.innerHTML = footerContent;
      else bsFoot.appendChild(footerContent);
      bsFoot.classList.remove('hidden');
    } else {
      bsFoot.classList.add('hidden');
    }
  }
  if (bsOv) bsOv.classList.add('show');
  if (bs) bs.classList.add('show');
}

export function closeSheet() {
  const bs = $id('bs');
  const bsOv = $id('bs-ov');
  if (bs) bs.classList.remove('show');
  if (bsOv) bsOv.classList.remove('show');
}

export async function delRec(table, id, label) {
  if (!confirm('Hapus ' + label + '?')) return;
  await db[table].delete(id);
  snack('ok', label + ' dihapus');
  closeSheet();
  // Trigger render callback if defined
  if (typeof window._renderCallback === 'function') window._renderCallback();
}

export function setRenderCallback(fn) {
  window._renderCallback = fn;
}

export function clearRenderCallback() {
  window._renderCallback = null;
}
