// ── ID generation ──────────────────────────────────────────────────────
function uid() {
  return Math.random().toString(36).slice(2, 9);
}

// ── Date utilities ─────────────────────────────────────────────────────
function fmtDate(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function todayStr() {
  return fmtDate(new Date());
}

function daysSince(dateStr) {
  if (!dateStr) return 0;
  const then = new Date(dateStr + 'T00:00:00');
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return Math.max(0, Math.floor((now - then) / 86400000));
}

function stalenessClass(days) {
  if (days >= 7) return 's7';
  if (days >= 3) return 's3';
  return 's1';
}

function updateDate() {
  const d = new Date();
  const days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  document.getElementById('dateDisplay').textContent =
    `${days[d.getDay()]} ${months[d.getMonth()]} ${d.getDate()}`;
}
updateDate();

// ── Clipboard fallback ─────────────────────────────────────────────────
function fallbackCopy(text) {
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.position = 'fixed';
  ta.style.opacity = '0';
  document.body.appendChild(ta);
  ta.select();
  document.execCommand('copy');
  document.body.removeChild(ta);
}

// ── HTML escaping ──────────────────────────────────────────────────────
function escHtml(str) {
  return (str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// Grow an auto-sizing textarea to fit its content. Skips hidden fields
// (collapsed section / unopened note) — measuring those yields 0 and would
// wrongly clamp them; they're re-grown when shown.
function autoGrow(el) {
  if (!el || el.offsetParent === null) return;
  el.style.height = 'auto';
  el.style.height = el.scrollHeight + 'px';
}

// ── Web inspector ──────────────────────────────────────────────────────
function openWebInspector() {
  try {
    window.webkit.messageHandlers.focusBridge.postMessage({ type: 'openInspector' });
  } catch (_) {}
}

// ── Toast ──────────────────────────────────────────────────────────────
function showToast(msg) {
  const existing = document.querySelector('.toast');
  if (existing) existing.remove();
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.classList.add('fade-out'), 1200);
  setTimeout(() => el.remove(), 1400);
}
