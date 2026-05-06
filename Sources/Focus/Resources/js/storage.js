// ── Settings ───────────────────────────────────────────────────────────
let appSettings = { theme: 'midnight-ember', font: 'DM Mono', fontSize: 13, windowSize: 'medium', inboxEnabled: true };

function loadSettings() {
  try {
    const raw = localStorage.getItem('focus-settings-v1');
    if (raw) Object.assign(appSettings, JSON.parse(raw));
  } catch(e) {}
  applySettings();
}

function saveSettings() {
  try {
    localStorage.setItem('focus-settings-v1', JSON.stringify(appSettings));
  } catch(e) {}
}

function applySettings() {
  document.body.setAttribute('data-theme', appSettings.theme);
  applyDynamicStyles();
  updateSettingsUI();
  if (typeof applyInboxVisibility === 'function') applyInboxVisibility();
}

function applyDynamicStyles() {
  let style = document.getElementById('focus-dynamic-styles');
  if (!style) {
    style = document.createElement('style');
    style.id = 'focus-dynamic-styles';
    document.head.appendChild(style);
  }
  const font = `'${appSettings.font}', monospace`;
  const sz = appSettings.fontSize;
  const sizeMap = {
    12: { body: 12, task: 11,   note: 10,   sub: 10.5, ui: 10,   tiny: 9   },
    13: { body: 13, task: 12,   note: 11,   sub: 11.5, ui: 11,   tiny: 10  },
    15: { body: 15, task: 14,   note: 13,   sub: 13.5, ui: 12.5, tiny: 11.5 },
  };
  const s = sizeMap[sz] || sizeMap[13];
  style.textContent = `
    body, input, button, textarea { font-family: ${font}; }
    body { font-size: ${s.body}px; }
    .task-text-input  { font-size: ${s.task}px;  font-family: ${font}; }
    .task-note-input  { font-size: ${s.note}px;  font-family: ${font}; }
    .subtask-input    { font-size: ${s.sub}px;   font-family: ${font}; }
    .add-task-btn, .today-done-toggle, .ctx-item,
    .font-option, .data-btn, .dev-action-btn,
    .size-option, .add-section-btn, .settings-note { font-size: ${s.ui}px; font-family: ${font}; }
    .today-item-text  { font-size: ${s.task}px;  font-family: ${font}; }
    .progress-pill, .today-badge, .today-done-count-badge,
    .today-item-source, .staleness, .date-display,
    .settings-section-label, .summary-bar { font-size: ${s.tiny}px; font-family: ${font}; }
  `;
}

function updateSettingsUI() {
  document.querySelectorAll('.theme-option').forEach(el => {
    el.classList.toggle('active', el.dataset.theme === appSettings.theme);
  });
  document.querySelectorAll('.font-option').forEach(el => {
    el.classList.toggle('active', el.dataset.font === appSettings.font);
  });
  document.querySelectorAll('.size-option').forEach(el => {
    el.classList.toggle('active', Number(el.dataset.size) === appSettings.fontSize);
  });
  document.querySelectorAll('.wsize-option').forEach(el => {
    el.classList.toggle('active', el.dataset.wsize === appSettings.windowSize);
  });
  document.getElementById('inboxOn')?.classList.toggle('active', !!appSettings.inboxEnabled);
  document.getElementById('inboxOff')?.classList.toggle('active', !appSettings.inboxEnabled);
}

function setTheme(name) {
  appSettings.theme = name;
  applySettings();
  saveSettings();
}

function setFont(name) {
  appSettings.font = name;
  applySettings();
  saveSettings();
}

function setFontSize(size) {
  appSettings.fontSize = size;
  applySettings();
  saveSettings();
}

function setWindowSize(name) {
  appSettings.windowSize = name;
  saveSettings();
  updateSettingsUI();
  try {
    window.webkit.messageHandlers.focusBridge.postMessage({ type: 'resize', size: name });
  } catch(e) {}
}

function openSettings() {
  document.getElementById('settingsPanel').classList.add('open');
  document.getElementById('settingsOverlay').classList.add('open');
  updateSettingsUI();
  flushDevLog();
}

function closeSettings() {
  document.getElementById('settingsPanel').classList.remove('open');
  document.getElementById('settingsOverlay').classList.remove('open');
}

// ── Data import / export ───────────────────────────────────────────────
function exportData() {
  const data = {
    sections,
    todayItems,
    settings: appSettings,
    exportedAt: new Date().toISOString()
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `focus-backup-${todayStr()}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

function importData(input) {
  const file = input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    try {
      const data = JSON.parse(e.target.result);
      if (!data.sections) throw new Error('Invalid backup');
      if (data.sections) localStorage.setItem('focus-v1', JSON.stringify(data.sections));
      if (data.todayItems) localStorage.setItem('focus-today-v1', JSON.stringify(data.todayItems));
      if (data.settings) localStorage.setItem('focus-settings-v1', JSON.stringify(data.settings));
      window.location.reload();
    } catch(err) {
      alert('Could not import: invalid or corrupted backup file.');
    }
  };
  reader.readAsText(file);
  input.value = '';
}

// ── Persistence ────────────────────────────────────────────────────────
function save() {
  try {
    localStorage.setItem('focus-v1', JSON.stringify(sections));
    localStorage.setItem('focus-today-v1', JSON.stringify(todayItems));
  } catch(e) {}
}

function loadSaved() {
  try {
    const raw = localStorage.getItem('focus-v1');
    if (!raw) return false;
    const data = JSON.parse(raw);
    if (!Array.isArray(data) || data.length === 0) return false;
    if (!data.find(s => s.id === INBOX_ID)) {
      data.unshift({ id: INBOX_ID, title: 'inbox', tasks: [], collapsed: false, color: null, archivedTasks: [] });
    }
    data.forEach(s => {
      if (!s.archivedTasks) s.archivedTasks = [];
      sections.push(s);
      renderSection(s);
      updateProgress(s.id);
      renderArchiveToggle(s.id);
    });

    const rawToday = localStorage.getItem('focus-today-v1');
    if (rawToday) {
      todayItems = JSON.parse(rawToday) || [];
      handleDayRollover();
      todayItems = todayItems.filter(ti => findTask(ti.taskId));
    }

    updateEmptyState();
    updateSummary();
    rerenderTodayPanel();
    syncAllTodayIndicators();
    return true;
  } catch(e) {
    return false;
  }
}

// ── Day rollover ───────────────────────────────────────────────────────
function handleDayRollover() {
  const today = todayStr();
  const lastDate = localStorage.getItem('focus-last-date');
  if (lastDate && lastDate !== today) {
    todayItems = todayItems.filter(ti => {
      const task = findTask(ti.taskId);
      return task && task.state !== 'done';
    });
  }
  localStorage.setItem('focus-last-date', today);
}
