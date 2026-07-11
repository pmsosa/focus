// ── Undo / Redo ────────────────────────────────────────────────────────
function takeSnapshot() {
  undoStack.push(JSON.stringify({ sections, todayItems }));
  if (undoStack.length > UNDO_MAX) undoStack.shift();
  redoStack = [];
}

// ── Keyboard shortcuts ─────────────────────────────────────────────────
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    const inp = document.getElementById('searchInput');
    if (inp && inp.style.display !== 'none') {
      inp.value = '';
      inp.style.display = 'none';
      filterTasks('');
      return;
    }
    try { window.webkit.messageHandlers.focusClose?.postMessage(null); } catch (_) {}
    return;
  }
  if (!(e.metaKey || e.ctrlKey)) return;
  if (e.key === 'f') {
    e.preventDefault();
    const inp = document.getElementById('searchInput');
    const isHidden = inp.style.display === 'none';
    inp.style.display = isHidden ? '' : 'none';
    if (isHidden) { inp.focus(); inp.select(); }
    else { inp.value = ''; filterTasks(''); }
    return;
  }
  if (e.key === 'i') {
    e.preventDefault();
    if (!appSettings.inboxEnabled) return;
    const inboxSec = sections.find(s => s.id === INBOX_ID);
    if (inboxSec && inboxSec.collapsed) {
      inboxSec.collapsed = false;
      applyCollapse(INBOX_ID, false);
      save();
    }
    addTask(INBOX_ID);
    return;
  }
  if (e.key === 'z' && !e.shiftKey && undoStack.length > 0) {
    e.preventDefault();
    redoStack.push(JSON.stringify({ sections, todayItems }));
    const snap = JSON.parse(undoStack.pop());
    sections = snap.sections;
    todayItems = snap.todayItems;
    fullRerender();
    save();
  } else if (e.key.toLowerCase() === 'c' && e.shiftKey) {
    e.preventDefault();
    copyBoardAsText();
  } else if ((e.key === 'z' && e.shiftKey || e.key === 'y') && redoStack.length > 0) {
    e.preventDefault();
    undoStack.push(JSON.stringify({ sections, todayItems }));
    const snap = JSON.parse(redoStack.pop());
    sections = snap.sections;
    todayItems = snap.todayItems;
    fullRerender();
    save();
  }
});

// ── Search / filter ────────────────────────────────────────────────────
function filterTasks(query) {
  const q = query.toLowerCase().trim();
  document.querySelectorAll('.task-item').forEach(el => {
    const text = el.querySelector('.task-text-input')?.value.toLowerCase() || '';
    el.style.opacity = (!q || text.includes(q)) ? '' : '0.15';
  });
  document.querySelectorAll('.section').forEach(secEl => {
    const sectionId = secEl.dataset.id;
    const sec = sections.find(s => s.id === sectionId);
    if (!sec) return;
    const hasMatch = [...secEl.querySelectorAll('.task-item')]
      .some(el => el.style.opacity !== '0.15');
    if (q) {
      secEl.style.opacity = hasMatch ? '' : '0.3';
      secEl.classList.toggle('search-match', hasMatch);
      if (hasMatch && sec.collapsed) applyCollapse(sectionId, false);
    } else {
      secEl.style.opacity = '';
      secEl.classList.remove('search-match');
      applyCollapse(sectionId, sec.collapsed ?? false);
    }
  });
}

// ── Task lookup ────────────────────────────────────────────────────────
function findTask(taskId) {
  for (const sec of sections) {
    const t = sec.tasks.find(t => t.id === taskId);
    if (t) return t;
  }
  return null;
}

// ── Today operations ───────────────────────────────────────────────────
function isInToday(taskId) {
  return todayItems.some(ti => ti.taskId === taskId);
}

function addToToday(sectionId, taskId) {
  if (isInToday(taskId)) return;
  takeSnapshot();
  todayItems.push({ taskId, sectionId, addedDate: todayStr() });
  syncTodayIndicator(taskId, true);
  rerenderTodayPanel();
  save();
}

function removeFromToday(taskId) {
  takeSnapshot();
  todayItems = todayItems.filter(ti => ti.taskId !== taskId);
  syncTodayIndicator(taskId, false);
  rerenderTodayPanel();
  save();
}

function syncTodayIndicator(taskId, inToday) {
  const el = document.querySelector(`.task-item[data-id="${taskId}"]`);
  if (el) el.classList.toggle('in-today', inToday);
}

function syncAllTodayIndicators() {
  todayItems.forEach(ti => syncTodayIndicator(ti.taskId, true));
}

// ── Section operations ─────────────────────────────────────────────────
function toggleCollapse(sectionId) {
  const sec = sections.find(s => s.id === sectionId);
  if (!sec) return;
  sec.collapsed = !sec.collapsed;
  applyCollapse(sectionId, sec.collapsed);
  save();
}

function applyCollapse(sectionId, collapsed) {
  const el = document.querySelector(`.section[data-id="${sectionId}"]`);
  if (!el) return;
  el.querySelector('.task-list').style.display = collapsed ? 'none' : '';
  el.querySelector('.add-task-row').style.display = collapsed ? 'none' : '';
  el.querySelector('.section-progress-bar').style.display = collapsed ? 'none' : '';
  el.querySelector('.collapse-btn').textContent = collapsed ? '▸' : '▾';
  el.classList.toggle('section-collapsed', collapsed);
  // Fields can't be measured while hidden, so re-grow them once revealed.
  if (!collapsed) el.querySelectorAll('.task-text-input, .task-note-input.visible, .subtask-input').forEach(autoGrow);
  const archiveEl = document.getElementById(`archive-section-${sectionId}`);
  if (archiveEl) {
    if (collapsed) {
      archiveEl.style.display = 'none';
    } else {
      const sec = sections.find(s => s.id === sectionId);
      archiveEl.style.display = (sec?.archivedTasks?.length > 0) ? '' : 'none';
    }
  }
}

function cycleSectionColor(sectionId) {
  const sec = sections.find(s => s.id === sectionId);
  if (!sec) return;
  takeSnapshot();
  const idx = SECTION_COLORS.indexOf(sec.color ?? null);
  sec.color = SECTION_COLORS[(idx + 1) % SECTION_COLORS.length];
  const btn = document.getElementById(`cdot-${sectionId}`);
  btn.style.background = sec.color || 'transparent';
  btn.classList.toggle('has-color', !!sec.color);
  save();
}

// ── Inbox ──────────────────────────────────────────────────────────────
function applyInboxVisibility() {
  document.body.classList.toggle('inbox-disabled', !appSettings.inboxEnabled);
}

function setInboxEnabled(val) {
  appSettings.inboxEnabled = val;
  if (val) ensureInbox();
  applyInboxVisibility();
  updateSettingsUI();
  saveSettings();
}

function ensureInbox() {
  if (sections.find(s => s.id === INBOX_ID)) return;
  const inbox = { id: INBOX_ID, title: 'inbox', tasks: [], collapsed: false, color: null, archivedTasks: [] };
  sections.unshift(inbox);
  renderSection(inbox);
  renderArchiveToggle(INBOX_ID);
  updateEmptyState();
  save();
}

function addSection(title = '') {
  const id = uid();
  const section = { id, title, tasks: [], collapsed: false, color: null, archivedTasks: [] };
  sections.push(section);
  renderSection(section);
  updateEmptyState();
  updateSummary();
  save();
  return id;
}

// ── Task operations ────────────────────────────────────────────────────
function addTask(sectionId, text = '', state = 'none', note = '', subtasks = []) {
  const sec = sections.find(s => s.id === sectionId);
  if (!sec) return;
  const task = {
    id: uid(), text, state, note,
    createdDate: todayStr(),
    completedDate: state === 'done' ? todayStr() : null,
    subtasks: subtasks.map(st => ({ id: uid(), text: st.text || st, done: st.done || false }))
  };
  sec.tasks.push(task);
  renderTask(sectionId, task);
  updateProgress(sectionId);
  updateSummary();
  save();
  return task.id;
}

function setTaskState(sectionId, taskId, checkbox, next) {
  const sec = sections.find(s => s.id === sectionId);
  const task = sec?.tasks.find(t => t.id === taskId);
  const prev = task?.state;
  if (task) {
    task.state = next;
    // Stamp/clear the completion date so the week view (derived from this
    // field) stays in sync with un-completing, renaming, and re-completing.
    if (next === 'done' && prev !== 'done') task.completedDate = todayStr();
    else if (next !== 'done') task.completedDate = null;
  }

  checkbox.dataset.state = next;

  const boardItem = document.querySelector(`.task-item[data-id="${taskId}"]`);
  if (boardItem) {
    const boardCb = boardItem.querySelector('.task-checkbox');
    if (boardCb && boardCb !== checkbox) boardCb.dataset.state = next;
    const textInput = boardItem.querySelector('.task-text-input');
    if (textInput) textInput.dataset.state = next;
    const noteInput = boardItem.querySelector('.task-note-input');
    if (noteInput && next === 'half' && !noteInput.classList.contains('visible')) {
      noteInput.classList.add('visible');
      autoGrow(noteInput);
    }
  }

  updateProgress(sectionId);
  updateSummary();
  if (isInToday(taskId)) rerenderTodayPanel();
  refreshWeekIfActive();
  save();
}

function cycleState(sectionId, taskId, checkbox) {
  takeSnapshot();
  const next = checkbox.dataset.state === 'done' ? 'none' : 'done';
  setTaskState(sectionId, taskId, checkbox, next);
}

function cycleStatePartial(e, sectionId, taskId, checkbox) {
  e.preventDefault();
  e.stopPropagation();
  takeSnapshot();
  const next = checkbox.dataset.state === 'half' ? 'none' : 'half';
  setTaskState(sectionId, taskId, checkbox, next);
}

// ── Context menu ───────────────────────────────────────────────────────
function showContextMenu(e, sectionId, taskId) {
  e.preventDefault();
  const menu = document.getElementById('contextMenu');
  const item = document.getElementById('ctxTodayItem');

  if (isInToday(taskId)) {
    item.textContent = '— remove from today';
    item.className = 'ctx-item remove';
    item.onclick = () => { removeFromToday(taskId); hideContextMenu(); };
  } else {
    item.textContent = '+ add to today';
    item.className = 'ctx-item add';
    item.onclick = () => { addToToday(sectionId, taskId); hideContextMenu(); };
  }

  menu.style.display = '';
  menu.style.left = e.clientX + 'px';
  menu.style.top = e.clientY + 'px';

  requestAnimationFrame(() => {
    const rect = menu.getBoundingClientRect();
    if (rect.right > window.innerWidth)  menu.style.left = (window.innerWidth - rect.width - 8) + 'px';
    if (rect.bottom > window.innerHeight) menu.style.top = (window.innerHeight - rect.height - 8) + 'px';
  });
}

function hideContextMenu() {
  document.getElementById('contextMenu').style.display = 'none';
}

document.addEventListener('click', e => {
  if (!e.target.closest('.context-menu')) hideContextMenu();
  if (!e.target.closest('.settings-panel') && !e.target.closest('.settings-btn')) {
    closeSettings();
  }
});

// ── Note toggle ────────────────────────────────────────────────────────
function toggleNote(taskId) {
  const note = document.querySelector(`.task-note-input[data-id="${taskId}"]`);
  if (note) {
    note.classList.toggle('visible');
    if (note.classList.contains('visible')) { autoGrow(note); note.focus(); }
  }
}

// Enter shouldn't insert a newline in these single-line-ish fields — commit + blur.
function titleKeydown(e) {
  if (e.key === 'Enter') { e.preventDefault(); e.target.blur(); }
}
function noteKeydown(e) {
  if (e.key === 'Enter') { e.preventDefault(); e.target.blur(); }
}

// ── Today done section toggle ──────────────────────────────────────────
function toggleTodayDone() {
  const doneList = document.getElementById('todayDoneList');
  const chevron = document.getElementById('todayDoneChevron');
  const open = doneList.style.display !== 'none';
  doneList.style.display = open ? 'none' : '';
  chevron.classList.toggle('open', !open);
}

// ── Subtasks ───────────────────────────────────────────────────────────
function toggleSubtask(sectionId, taskId, subtaskId, dot) {
  const done = dot.dataset.done === 'true';
  dot.dataset.done = String(!done);
  dot.nextElementSibling.dataset.done = String(!done);

  const sec = sections.find(s => s.id === sectionId);
  const task = sec?.tasks.find(t => t.id === taskId);
  const st = task?.subtasks.find(s => s.id === subtaskId);
  if (st) st.done = !done;

  updateProgress(sectionId);
  updateSummary();
  save();
}

function addSubtask(sectionId, taskId) {
  const sec = sections.find(s => s.id === sectionId);
  const task = sec?.tasks.find(t => t.id === taskId);
  if (!task) return;
  const st = { id: uid(), text: '', done: false };
  task.subtasks.push(st);
  renderSubtask(taskId, st, sectionId);
  save();
}

// ── Keyboard navigation ────────────────────────────────────────────────
function focusAdjacentTask(sectionId, taskId, dir) {
  const inputs = [...document.querySelectorAll('.task-text-input')];
  const idx = inputs.findIndex(inp => inp.closest('.task-item')?.dataset.id === taskId);
  if (idx === -1) return;
  const next = inputs[idx + dir];
  if (next) next.focus();
}

function taskKeydown(e, sectionId, taskId) {
  if (e.key === 'Enter' && !e.metaKey) { e.preventDefault(); addTask(sectionId); return; }
  if (e.key === 'Backspace' && e.target.value === '') { e.preventDefault(); removeTask(sectionId, taskId); return; }
  if (e.key === 'Enter' && e.metaKey && !e.shiftKey) {
    e.preventDefault();
    const cb = document.querySelector(`.task-item[data-id="${taskId}"] .task-checkbox`);
    if (cb) cycleState(sectionId, taskId, cb);
    return;
  }
  if (e.key === 'Enter' && e.metaKey && e.shiftKey) {
    e.preventDefault();
    const cb = document.querySelector(`.task-item[data-id="${taskId}"] .task-checkbox`);
    if (cb) cycleStatePartial({ preventDefault() {}, stopPropagation() {} }, sectionId, taskId, cb);
    return;
  }
  if (e.key === 'd' && e.metaKey) {
    e.preventDefault();
    isInToday(taskId) ? removeFromToday(taskId) : addToToday(sectionId, taskId);
    return;
  }
  if (e.key === 'Tab') {
    e.preventDefault();
    focusAdjacentTask(sectionId, taskId, e.shiftKey ? -1 : 1);
    return;
  }
  if (e.key === 'Backspace' && e.metaKey && e.shiftKey) {
    e.preventDefault();
    sweepDone(sectionId);
  }
}

function subtaskKeydown(e, sectionId, taskId, subtaskId) {
  if (e.key === 'Enter') { e.preventDefault(); addSubtask(sectionId, taskId); }
  if (e.key === 'Backspace' && e.target.value === '') { e.preventDefault(); removeSubtask(sectionId, taskId, subtaskId); }
}

// ── Remove operations ──────────────────────────────────────────────────
function removeTask(sectionId, taskId) {
  takeSnapshot();
  const sec = sections.find(s => s.id === sectionId);
  if (!sec) return;
  sec.tasks = sec.tasks.filter(t => t.id !== taskId);
  document.querySelector(`.task-item[data-id="${taskId}"]`)?.remove();
  if (isInToday(taskId)) removeFromToday(taskId);
  updateProgress(sectionId);
  updateSummary();
  refreshWeekIfActive();
  save();
}

function removeSubtask(sectionId, taskId, subtaskId) {
  takeSnapshot();
  const sec = sections.find(s => s.id === sectionId);
  const task = sec?.tasks.find(t => t.id === taskId);
  if (!task) return;
  task.subtasks = task.subtasks.filter(s => s.id !== subtaskId);
  document.querySelector(`.subtask-item[data-id="${subtaskId}"]`)?.remove();
  save();
}

function removeSection(sectionId) {
  if (sectionId === INBOX_ID) return;
  takeSnapshot();
  const sec = sections.find(s => s.id === sectionId);
  if (sec) sec.tasks.forEach(t => { if (isInToday(t.id)) removeFromToday(t.id); });
  sections = sections.filter(s => s.id !== sectionId);
  fullRerender();
  save();
}

// ── Text update helpers ────────────────────────────────────────────────
function updateSectionTitle(sectionId, val) {
  const sec = sections.find(s => s.id === sectionId);
  if (sec) { sec.title = val; save(); }
}

function updateTaskText(sectionId, taskId, val) {
  const sec = sections.find(s => s.id === sectionId);
  const task = sec?.tasks.find(t => t.id === taskId);
  if (task) {
    task.text = val;
    if (isInToday(taskId)) rerenderTodayPanel();
    refreshWeekIfActive(); // week view reads task text live, so reflect renames
    save();
  }
}

function updateTaskNote(sectionId, taskId, val) {
  const sec = sections.find(s => s.id === sectionId);
  const task = sec?.tasks.find(t => t.id === taskId);
  if (task) { task.note = val; save(); }
}

function updateSubtaskText(sectionId, taskId, subtaskId, val) {
  const sec = sections.find(s => s.id === sectionId);
  const task = sec?.tasks.find(t => t.id === taskId);
  const st = task?.subtasks.find(s => s.id === subtaskId);
  if (st) { st.text = val; save(); }
}

// ── Archive operations ────────────────────────────────────────────────
function sweepDone(sectionId) {
  const sec = sections.find(s => s.id === sectionId);
  if (!sec) return;
  const toArchive = sec.tasks.filter(t => t.state === 'done');
  if (toArchive.length === 0) return;
  takeSnapshot();
  const date = todayStr();
  let needTodayRerender = false;
  toArchive.forEach(t => {
    sec.archivedTasks.push({ ...t, archivedDate: date });
    document.querySelector(`.task-item[data-id="${t.id}"]`)?.remove();
    if (isInToday(t.id)) {
      todayItems = todayItems.filter(ti => ti.taskId !== t.id);
      needTodayRerender = true;
    }
  });
  sec.tasks = sec.tasks.filter(t => t.state !== 'done');
  updateProgress(sectionId);
  updateSummary();
  if (needTodayRerender) rerenderTodayPanel();
  renderArchiveToggle(sectionId);
  save();
  showToast(`${toArchive.length} task${toArchive.length > 1 ? 's' : ''} archived`);
}

function toggleArchive(sectionId) {
  const container = document.getElementById(`archive-section-${sectionId}`);
  if (!container) return;
  const isOpen = container.dataset.open === 'true';
  container.dataset.open = String(!isOpen);
  const list = document.getElementById(`archive-list-${sectionId}`);
  const chevron = container.querySelector('.archive-chevron');
  if (list) list.style.display = isOpen ? 'none' : '';
  if (chevron) chevron.classList.toggle('open', !isOpen);
}

function clearArchive(sectionId) {
  takeSnapshot();
  const sec = sections.find(s => s.id === sectionId);
  if (!sec) return;
  sec.archivedTasks = [];
  renderArchiveToggle(sectionId);
  refreshWeekIfActive(); // cleared archive drops those completions from history
  save();
  showToast('Archive cleared');
}

// ── Task aging ────────────────────────────────────────────────────────
function refreshStaleness() {
  sections.forEach(sec => {
    sec.tasks.forEach(task => {
      const el = document.querySelector(`.task-item[data-id="${task.id}"]`);
      if (!el) return;
      const existing = el.querySelector('.staleness');
      if (existing) existing.remove();
      const ageDays = task.createdDate ? daysSince(task.createdDate) : 0;
      if (ageDays >= STALE_AMBER_DAYS && task.state !== 'done') {
        const span = document.createElement('span');
        span.className = `staleness ${stalenessClass(ageDays)}`;
        span.textContent = `+${ageDays}`;
        el.querySelector('.task-actions').before(span);
      }
    });
  });
}

document.addEventListener('visibilitychange', () => {
  if (!document.hidden) refreshStaleness();
});

// ── Copy board as text ────────────────────────────────────────────────
function copyBoardAsText() {
  const stateChar = { none: ' ', half: '~', done: 'x' };
  const lines = [];
  sections.forEach(sec => {
    lines.push(`## ${sec.title || '(untitled)'}`);
    sec.tasks.forEach(t => {
      const mark = stateChar[t.state] || ' ';
      const note = (t.state === 'half' && t.note) ? `  (${t.note})` : '';
      lines.push(`- [${mark}] ${t.text}${note}`);
      t.subtasks.forEach(st => {
        lines.push(`  - [${st.done ? 'x' : ' '}] ${st.text}`);
      });
    });
    lines.push('');
  });
  const text = lines.join('\n');
  if (navigator.clipboard) {
    navigator.clipboard.writeText(text)
      .then(() => showToast('copied to clipboard'))
      .catch(() => { fallbackCopy(text); showToast('copied to clipboard'); });
  } else {
    fallbackCopy(text);
    showToast('copied to clipboard');
  }
}
