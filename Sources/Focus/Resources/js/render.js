// ── Render Section ────────────────────────────────────────────────────
function renderSection(section) {
  const isInbox = section.id === INBOX_ID;
  const board = document.getElementById('board');
  const el = document.createElement('div');
  el.className = 'section' + (isInbox ? ' inbox-section' : '');
  el.dataset.id = section.id;
  el.innerHTML = `
    <div class="section-header">
      ${isInbox ? '' : `<button class="drag-handle section-drag-handle" onpointerdown="startSectionDrag(event,'${section.id}')" title="Drag to reorder">⠿</button>`}
      <button class="collapse-btn" onclick="toggleCollapse('${section.id}')">▾</button>
      <button class="color-dot-btn ${section.color ? 'has-color' : ''}" id="cdot-${section.id}"
              onclick="cycleSectionColor('${section.id}')"
              style="background:${section.color || 'transparent'}"></button>
      <textarea class="section-title-input" placeholder="section name…" rows="1"
             ${isInbox ? 'readonly' : ''}
             oninput="updateSectionTitle('${section.id}', this.value); autoGrow(this)"
             onkeydown="titleKeydown(event)">${escHtml(section.title)}</textarea>
      <div class="section-meta">
        <span class="progress-pill" id="pill-${section.id}">0 / 0</span>
        <button class="sweep-btn" id="sweep-${section.id}" onclick="sweepDone('${section.id}')" title="Archive done tasks (⌘⇧⌫)">↓</button>
        ${isInbox ? '' : `
        <button class="section-menu-btn" onclick="removeSection('${section.id}')" title="Remove section">×</button>
        `}
      </div>
    </div>
    <div class="task-list" id="tasks-${section.id}"></div>
    <div class="add-task-row">
      <button class="add-task-btn" onclick="addTask('${section.id}')">
        <span style="font-size:14px;line-height:1">+</span> add task
      </button>
    </div>
    <div class="archive-section" id="archive-section-${section.id}" style="display:none"></div>
    <div class="section-progress-bar">
      <div class="section-progress-fill" id="prog-${section.id}" style="width:0%"></div>
    </div>
  `;
  board.appendChild(el);
  autoGrow(el.querySelector('.section-title-input'));
  section.tasks.forEach(t => renderTask(section.id, t));
  applyCollapse(section.id, section.collapsed ?? false);
  _boardResizeObserver.observe(el);
  // Retire the entrance animation once it plays. Re-parenting a node restarts
  // its CSS animation, and layoutBoard re-parents cards into columns on every
  // change — without this the whole board flickers through fadeUp on each move.
  el.addEventListener('animationend', () => { el.style.animation = 'none'; }, { once: true });
  scheduleLayout();
  if (!section.title && !isInbox) setTimeout(() => el.querySelector('.section-title-input').focus(), 50);
}

// ── Render Task ───────────────────────────────────────────────────────
function renderTask(sectionId, task) {
  const list = document.getElementById(`tasks-${sectionId}`);
  if (!list) return;
  const el = document.createElement('div');
  el.className = 'task-item' + (isInToday(task.id) ? ' in-today' : '');
  el.dataset.id = task.id;
  el.dataset.section = sectionId;
  const noteVisible = (task.note && task.note.trim()) ? 'visible' : '';
  const ageDays = task.createdDate ? daysSince(task.createdDate) : 0;
  const ageHtml = (ageDays >= STALE_AMBER_DAYS && task.state !== 'done')
    ? `<span class="staleness ${stalenessClass(ageDays)}">+${ageDays}</span>`
    : '';
  el.innerHTML = `
    <div class="task-checkbox" data-state="${task.state}"
         onclick="event.stopPropagation(); cycleState('${sectionId}', '${task.id}', this)"
         oncontextmenu="cycleStatePartial(event,'${sectionId}','${task.id}',this)"></div>
    <div class="task-content">
      <textarea class="task-text-input" data-state="${task.state}" rows="1"
             placeholder="task…"
             oninput="updateTaskText('${sectionId}','${task.id}',this.value); autoGrow(this)"
             onkeydown="taskKeydown(event,'${sectionId}','${task.id}')">${escHtml(task.text)}</textarea>
      <textarea class="task-note-input ${noteVisible}" rows="1"
             placeholder="what's remaining…"
             data-id="${task.id}"
             oninput="updateTaskNote('${sectionId}','${task.id}',this.value); autoGrow(this)"
             onkeydown="noteKeydown(event)">${escHtml(task.note || '')}</textarea>
      <div class="subtask-list" id="subtasks-${task.id}"></div>
    </div>
    ${ageHtml}
    <div class="task-actions">
      <button class="task-action-btn drag-handle task-drag-handle" onpointerdown="startTaskDrag(event,'${sectionId}','${task.id}')" title="Drag to reorder">⠿</button>
      <button class="task-action-btn" onclick="toggleNote('${task.id}')" title="Add note">≡</button>
      <button class="task-action-btn" onclick="addSubtask('${sectionId}','${task.id}')" title="Add sub-task">⊕</button>
      <button class="task-action-btn" onclick="removeTask('${sectionId}','${task.id}')" title="Remove">×</button>
    </div>
  `;
  el.addEventListener('contextmenu', e => showContextMenu(e, sectionId, task.id));
  el.addEventListener('click', e => {
    if (!e.target.closest('.task-checkbox, .task-actions, input, button')) {
      el.querySelector('.task-text-input').focus();
    }
  });
  list.appendChild(el);
  autoGrow(el.querySelector('.task-text-input'));
  autoGrow(el.querySelector('.task-note-input'));
  task.subtasks.forEach(st => renderSubtask(task.id, st, sectionId));
  if (!task.text) setTimeout(() => el.querySelector('.task-text-input').focus(), 30);
}

// ── Render Subtask ────────────────────────────────────────────────────
function renderSubtask(taskId, subtask, sectionId) {
  const list = document.getElementById(`subtasks-${taskId}`);
  if (!list) return;
  const el = document.createElement('div');
  el.className = 'subtask-item';
  el.dataset.id = subtask.id;
  el.innerHTML = `
    <div class="subtask-dot" data-done="${subtask.done}"
         onclick="toggleSubtask('${sectionId}','${taskId}','${subtask.id}',this)"></div>
    <textarea class="subtask-input" data-done="${subtask.done}" rows="1"
           placeholder="sub-task…"
           oninput="updateSubtaskText('${sectionId}','${taskId}','${subtask.id}',this.value); autoGrow(this)"
           onkeydown="subtaskKeydown(event,'${sectionId}','${taskId}','${subtask.id}')">${escHtml(subtask.text)}</textarea>
  `;
  list.appendChild(el);
  autoGrow(el.querySelector('.subtask-input'));
  if (!subtask.text) setTimeout(() => el.querySelector('.subtask-input').focus(), 30);
}

// ── Today panel render ─────────────────────────────────────────────────
function rerenderTodayPanel() {
  const list = document.getElementById('todayList');
  const doneList = document.getElementById('todayDoneList');
  const doneSection = document.getElementById('todayDoneSection');
  const badge = document.getElementById('todayBadge');
  if (!list) return;

  const active = todayItems.filter(ti => {
    const t = findTask(ti.taskId); return t && t.state !== 'done';
  });
  const done = todayItems.filter(ti => {
    const t = findTask(ti.taskId); return t && t.state === 'done';
  });

  list.innerHTML = '';
  if (todayItems.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'today-empty';
    empty.innerHTML = `<p class="today-empty-hint">right-click any task<br>to add it here</p>`;
    list.appendChild(empty);
  } else {
    active.forEach(ti => {
      const el = buildTodayItemEl(ti);
      if (el) list.appendChild(el);
    });
  }

  if (badge) {
    if (currentPanelTab !== 'today' || todayItems.length === 0) {
      badge.style.display = 'none';
    } else if (active.length === 0) {
      badge.textContent = 'all done';
      badge.style.display = '';
    } else {
      badge.textContent = `${active.length} left`;
      badge.style.display = '';
    }
  }

  if (doneList) {
    doneList.innerHTML = '';
    done.forEach(ti => {
      const el = buildTodayItemEl(ti);
      if (el) doneList.appendChild(el);
    });
  }
  if (doneSection) {
    doneSection.style.display = (currentPanelTab === 'today' && done.length > 0) ? '' : 'none';
    const countEl = document.getElementById('todayDoneCount');
    if (countEl) countEl.textContent = done.length;
  }
}

// ── Week panel (rolling 7-day history) ─────────────────────────────────
function switchTab(tab) {
  currentPanelTab = tab;
  const isWeek = tab === 'week';
  document.getElementById('tab-today')?.classList.toggle('active', !isWeek);
  document.getElementById('tab-week')?.classList.toggle('active', isWeek);
  const todayList = document.getElementById('todayList');
  const weekPanel = document.getElementById('weekPanel');
  if (todayList) todayList.style.display = isWeek ? 'none' : '';
  if (weekPanel) weekPanel.style.display = isWeek ? '' : 'none';
  if (isWeek) {
    // The done section and "N left" badge belong to the today view only.
    const doneSection = document.getElementById('todayDoneSection');
    if (doneSection) doneSection.style.display = 'none';
    const badge = document.getElementById('todayBadge');
    if (badge) badge.style.display = 'none';
    renderWeekPanel();
  } else {
    rerenderTodayPanel();
  }
}

function refreshWeekIfActive() {
  if (currentPanelTab === 'week') renderWeekPanel();
}

// Group completed-task text by completion date. Derived live from the task
// model (active + archived) rather than a snapshot log, so un-completing,
// renaming, and re-completing all stay consistent automatically.
function completionsByDate() {
  const byDate = {};
  const add = t => {
    if (!t.completedDate) return;
    (byDate[t.completedDate] ||= []).push((t.text || '').trim() || '(untitled)');
  };
  sections.forEach(sec => {
    sec.tasks.forEach(t => { if (t.state === 'done') add(t); });
    (sec.archivedTasks || []).forEach(add); // archived entries are all completed
  });
  return byDate;
}

function renderWeekPanel() {
  const panel = document.getElementById('weekPanel');
  if (!panel) return;
  const byDate = completionsByDate();
  panel.innerHTML = '';
  for (let i = 0; i < WEEK_VIEW_DAYS; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = fmtDate(d);
    const label = i === 0 ? 'today'
      : i === 1 ? 'yesterday'
      : d.toLocaleDateString('en', { weekday: 'short', month: 'short', day: 'numeric' });
    const tasks = byDate[key] || [];
    const dayEl = document.createElement('div');
    dayEl.className = 'week-day' + (tasks.length ? '' : ' week-day-empty');
    dayEl.innerHTML = `
      <div class="week-day-header">
        <span class="week-day-label">${label}</span>
        ${tasks.length ? `<span class="week-day-count">${tasks.length}</span>` : ''}
      </div>
      ${tasks.length
        ? tasks.map(t => `<div class="week-task">✓ ${escHtml(t)}</div>`).join('')
        : '<div class="week-task week-empty">—</div>'}
    `;
    panel.appendChild(dayEl);
  }
}

function buildTodayItemEl(ti) {
  const task = findTask(ti.taskId);
  if (!task) return null;
  const sec = sections.find(s => s.id === ti.sectionId);

  const days = daysSince(ti.addedDate);
  let stalenessHtml = '';
  if (days > 0 && task.state !== 'done') {
    stalenessHtml = `<span class="staleness ${stalenessClass(days)}">+${days}</span>`;
  }

  const textCls = task.state === 'done' ? 'done' : task.state === 'half' ? 'half' : '';
  const el = document.createElement('div');
  el.className = 'today-item';
  el.dataset.taskId = ti.taskId;
  el.innerHTML = `
    <div class="task-checkbox" data-state="${task.state}"
         onclick="cycleState('${ti.sectionId}','${ti.taskId}',this)"
         oncontextmenu="cycleStatePartial(event,'${ti.sectionId}','${ti.taskId}',this)"></div>
    <div class="today-item-content">
      <span class="today-item-text ${textCls}">${escHtml(task.text || '(untitled)')}</span>
      <span class="today-item-source">${escHtml(sec?.title || '')}</span>
    </div>
    ${stalenessHtml}
    <button class="today-item-remove" onclick="removeFromToday('${ti.taskId}')" title="Remove from today">×</button>
  `;
  return el;
}

// ── Archive toggle render ─────────────────────────────────────────────
function renderArchiveToggle(sectionId) {
  const sec = sections.find(s => s.id === sectionId);
  if (!sec) return;
  const container = document.getElementById(`archive-section-${sectionId}`);
  if (!container) return;

  if (!sec.archivedTasks || sec.archivedTasks.length === 0) {
    container.style.display = 'none';
    container.innerHTML = '';
    return;
  }

  const isOpen = container.dataset.open === 'true';
  const count = sec.archivedTasks.length;
  container.style.display = '';
  container.innerHTML = `
    <div class="archive-header-row">
      <button class="archive-toggle-btn" onclick="toggleArchive('${sectionId}')">
        <span class="archive-chevron ${isOpen ? 'open' : ''}">▶</span>
        <span>archived</span>
        <span class="archive-count-badge">${count}</span>
      </button>
      <button class="archive-clear-btn" onclick="clearArchive('${sectionId}')" title="Clear archive">clear</button>
    </div>
    <div class="archive-list" id="archive-list-${sectionId}" style="${isOpen ? '' : 'display:none'}">
      ${sec.archivedTasks.map(t => `
        <div class="archive-item">
          <span class="archive-item-text">${escHtml(t.text || '(untitled)')}</span>
          <span class="archive-item-date">${t.archivedDate || ''}</span>
        </div>
      `).join('')}
    </div>
  `;
}

// ── Progress & summary ────────────────────────────────────────────────
function updateProgress(sectionId) {
  const sec = sections.find(s => s.id === sectionId);
  if (!sec) return;
  const total = sec.tasks.length;
  const done = sec.tasks.filter(t => t.state === 'done').length;
  const half = sec.tasks.filter(t => t.state === 'half').length;
  const pill = document.getElementById(`pill-${sectionId}`);
  if (pill) pill.textContent = `${done}${half ? ` + ${half}~` : ''} / ${total}`;
  const fill = document.getElementById(`prog-${sectionId}`);
  if (fill) fill.style.width = (total === 0 ? 0 : ((done + half * 0.5) / total) * 100) + '%';
  const sweepBtn = document.getElementById(`sweep-${sectionId}`);
  if (sweepBtn) sweepBtn.classList.toggle('visible', done > 0);
}

function updateSummary() {
  let done = 0, half = 0, open = 0;
  sections.forEach(sec => sec.tasks.forEach(t => {
    if (t.state === 'done') done++;
    else if (t.state === 'half') half++;
    else open++;
  }));
  const bar = document.getElementById('summaryBar');
  bar.style.display = (done + half + open) > 0 ? 'flex' : 'none';
  document.getElementById('summDone').textContent = `${done} done`;
  document.getElementById('summHalf').textContent = `${half} partial`;
  document.getElementById('summOpen').textContent = `${open} open`;
}

function updateEmptyState() {
  const empty = document.getElementById('emptyState');
  if (empty) empty.style.display = sections.length === 0 ? 'flex' : 'none';
}

// ── Masonry column layout ─────────────────────────────────────────────
// The board isn't a fixed grid: we compute how many columns fit the current
// width and greedily drop each section (in array order) into the shortest
// column. Collapsing or shrinking a card frees vertical space that later
// cards roll up into. Order stays a single flat `sections` array, so drag
// reorder is unaffected — it just re-runs the layout on commit.
const BOARD_MIN_COL = 300; // min column width in px before dropping a column
const BOARD_GAP = 14;      // keep in sync with the gap in layout.css .board
let _layoutRAF = null;
let _lastColWidth = 0;     // detects when column width changes → re-grow textareas

function growAllTextareas() {
  document.querySelectorAll('#board .section textarea').forEach(autoGrow);
}

function scheduleLayout() {
  if (_layoutRAF != null) return;
  _layoutRAF = requestAnimationFrame(() => { _layoutRAF = null; layoutBoard(); });
}

function layoutBoard() {
  const board = document.getElementById('board');
  if (!board) return;

  // Index every section card by id, wherever it currently lives.
  const cards = new Map();
  board.querySelectorAll('.section').forEach(el => cards.set(el.dataset.id, el));

  // Nothing to lay out — tear the columns down so the empty state can span.
  if (![...cards.keys()].length) {
    board.querySelectorAll(':scope > .board-col').forEach(c => c.remove());
    return;
  }

  // How many columns fit right now?
  const width = board.clientWidth || 0;
  const cols = Math.max(1, Math.floor((width + BOARD_GAP) / (BOARD_MIN_COL + BOARD_GAP)));

  // Reconcile the column containers to that count.
  const colEls = [...board.querySelectorAll(':scope > .board-col')];
  while (colEls.length < cols) {
    const c = document.createElement('div');
    c.className = 'board-col';
    board.appendChild(c);
    colEls.push(c);
  }
  while (colEls.length > cols) colEls.pop().remove();

  // Place each section (in array order) into whichever column is shortest.
  // Only move a card that's actually out of position, so a settled board
  // re-flows nothing and a single change moves only the affected cards.
  const heights = new Array(cols).fill(0);
  const lastInCol = new Array(cols).fill(null);
  sections.forEach(sec => {
    const el = cards.get(sec.id);
    if (!el) return;
    let min = 0;
    for (let i = 1; i < cols; i++) if (heights[i] < heights[min]) min = i;
    const anchor = lastInCol[min]; // the card el should follow (null = first)
    if (el.parentNode !== colEls[min] || el.previousElementSibling !== anchor) {
      anchor ? anchor.after(el) : colEls[min].prepend(el);
    }
    lastInCol[min] = el;
    heights[min] += el.offsetHeight + BOARD_GAP;
  });

  // Cards are now in their final columns at their final width. If that width
  // changed (resize / column-count change), fields wrap differently, so their
  // auto-grown heights are stale — re-grow them. The resulting height changes
  // trip the ResizeObserver, which re-runs this layout once more with correct
  // heights, then settles (width unchanged → this block is skipped).
  const colWidth = colEls[0].clientWidth;
  if (Math.abs(colWidth - _lastColWidth) > 0.5) {
    _lastColWidth = colWidth;
    growAllTextareas();
  }
}

// Any card whose height changes (collapse, add/remove task, notes, subtasks,
// archive, staleness) triggers a re-layout so siblings roll up automatically.
const _boardResizeObserver = new ResizeObserver(() => scheduleLayout());
window.addEventListener('resize', scheduleLayout);

// ── Full re-render ────────────────────────────────────────────────────
function fullRerender() {
  document.querySelectorAll('#board .section').forEach(el => el.remove());
  sections.forEach(s => { renderSection(s); renderArchiveToggle(s.id); });
  updateEmptyState();
  updateSummary();
  rerenderTodayPanel();
  syncAllTodayIndicators();
  refreshWeekIfActive();
}

function rerenderTaskList(sectionId) {
  const sec = sections.find(s => s.id === sectionId);
  const list = document.getElementById(`tasks-${sectionId}`);
  if (!sec || !list) return;
  list.innerHTML = '';
  sec.tasks.forEach(t => renderTask(sectionId, t));
  syncAllTodayIndicators();
}
