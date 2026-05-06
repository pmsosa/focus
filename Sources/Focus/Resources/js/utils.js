// ── ID generation ──────────────────────────────────────────────────────
function uid() {
  return Math.random().toString(36).slice(2, 9);
}

// ── Date utilities ─────────────────────────────────────────────────────
function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
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

// ── Dev log ────────────────────────────────────────────────────────────
const devLogs = [];
const DEV_LOG_MAX = 300;

(function interceptConsole() {
  const methods = ['log', 'info', 'warn', 'error'];
  methods.forEach(method => {
    const orig = console[method].bind(console);
    console[method] = (...args) => {
      orig(...args);
      const msg = args.map(a => {
        try { return typeof a === 'object' ? JSON.stringify(a) : String(a); }
        catch(e) { return String(a); }
      }).join(' ');
      devLogs.push({ level: method, msg, time: new Date().toLocaleTimeString('en', { hour12: false }) });
      if (devLogs.length > DEV_LOG_MAX) devLogs.shift();
      flushDevLog();
    };
  });
  window.addEventListener('error', ev => {
    devLogs.push({ level: 'error', msg: `${ev.message}  (${ev.filename}:${ev.lineno}:${ev.colno})`, time: new Date().toLocaleTimeString('en', { hour12: false }) });
    if (devLogs.length > DEV_LOG_MAX) devLogs.shift();
    flushDevLog();
  });
  window.addEventListener('unhandledrejection', ev => {
    devLogs.push({ level: 'error', msg: `Unhandled rejection: ${ev.reason}`, time: new Date().toLocaleTimeString('en', { hour12: false }) });
    if (devLogs.length > DEV_LOG_MAX) devLogs.shift();
    flushDevLog();
  });
})();

function flushDevLog() {
  const el = document.getElementById('devLog');
  if (!el) return;
  if (devLogs.length === 0) {
    el.innerHTML = '<span class="dev-log-empty">no logs yet…</span>';
    return;
  }
  el.innerHTML = devLogs.map(({ level, msg, time }) =>
    `<span class="dev-log-entry ${level}">[${time}] [${level.toUpperCase().padEnd(5)}] ${escHtml(msg)}</span>`
  ).join('\n');
  el.scrollTop = el.scrollHeight;
}

function clearDevLog() {
  devLogs.length = 0;
  flushDevLog();
}

function copyDevLog() {
  const text = devLogs.map(({ level, msg, time }) =>
    `[${time}] [${level.toUpperCase()}] ${msg}`
  ).join('\n');
  if (navigator.clipboard) {
    navigator.clipboard.writeText(text).catch(() => fallbackCopy(text));
  } else {
    fallbackCopy(text);
  }
}

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
