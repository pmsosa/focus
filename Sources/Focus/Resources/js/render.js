// ── Render Section ────────────────────────────────────────────────────
function renderSection(section) {
  const colIndex = sections.indexOf(section) % 2;
  const board = document.getElementById(`board-col-${colIndex}`) || document.getElementById('board');
  const el = document.createElement('div');
  el.className = 'section';
  el.dataset.id = section.id;
  el.innerHTML = `
    <div class="section-header">
      <button class="collapse-btn" onclick="toggleCollapse('${section.id}')">▾</button>
      <button class="color-dot-btn ${section.color ? 'has-color' : ''}" id="cdot-${section.id}"
              onclick="cycleSectionColor('${section.id}')"
              style="background:${section.color || 'transparent'}"></button>
      <input class="section-title-input" placeholder="section name…"
             value="${escHtml(section.title)}"
             oninput="updateSectionTitle('${section.id}', this.value)">
      <div class="section-meta">
        <span class="progress-pill" id="pill-${section.id}">0 / 0</span>
        <button class="sweep-btn" id="sweep-${section.id}" onclick="sweepDone('${section.id}')" title="Archive done tasks (⌘⇧⌫)">↓</button>
        <button class="section-menu-btn" onclick="removeSection('${section.id}')" title="Remove section">×</button>
        <div class="section-drag-handle" title="Drag to reorder">⠿</div>
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
  section.tasks.forEach(t => renderTask(section.id, t));
  applyCollapse(section.id, section.collapsed ?? false);
  if (!section.title) setTimeout(() => el.querySelector('.section-title-input').focus(), 50);

  // Section drag — handle is the drag source to avoid WKWebView mouseup-before-dragstart quirk.
  const handle = el.querySelector('.section-drag-handle');
  handle.setAttribute('draggable', 'true');
  handle.addEventListener('dragstart', e => {
    e.stopPropagation();
    currentDrag = { type: 'section', sectionId: section.id };
    e.dataTransfer.setData('text/plain', JSON.stringify({ type: 'section', sectionId: section.id }));
    e.dataTransfer.effectAllowed = 'move';
    el.classList.add('section-dragging');
  });
  handle.addEventListener('dragend', () => {
    el.classList.remove('section-dragging');
    if (currentDrag?.type === 'section') currentDrag = null;
    const ind = document.getElementById('section-drop-indicator');
    if (ind) ind.style.display = 'none';
  });

  // Task-list reorder drop zone
  let _taskDropAfter = undefined; // undefined = not over this list; null = append to end
  const taskList = el.querySelector('.task-list');
  taskList.addEventListener('dragover', e => {
    if (!currentDrag || currentDrag.type !== 'task') return;
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';
    const afterEl = getDragAfterTask(taskList, e.clientY);
    _taskDropAfter = afterEl;
    const ind = document.getElementById('task-drop-indicator');
    afterEl ? taskList.insertBefore(ind, afterEl) : taskList.appendChild(ind);
    ind.style.display = 'block';
  });
  taskList.addEventListener('dragleave', e => {
    if (!taskList.contains(e.relatedTarget)) {
      document.getElementById('task-drop-indicator').style.display = 'none';
      _taskDropAfter = undefined;
    }
  });
  taskList.addEventListener('drop', e => {
    e.preventDefault();
    e.stopPropagation();
    document.getElementById('task-drop-indicator').style.display = 'none';
    if (!currentDrag || currentDrag.type !== 'task') return;
    if (_taskDropAfter === undefined) return;

    const afterEl = _taskDropAfter;
    _taskDropAfter = undefined;

    const { taskId, sectionId: fromSid } = currentDrag;
    const toSid = section.id;
    const fromSec = sections.find(s => s.id === fromSid);
    const toSec = sections.find(s => s.id === toSid);
    if (!fromSec || !toSec) return;

    const taskIdx = fromSec.tasks.findIndex(t => t.id === taskId);
    if (taskIdx === -1) return;

    takeSnapshot();
    const [task] = fromSec.tasks.splice(taskIdx, 1);

    if (afterEl === null) {
      toSec.tasks.push(task);
    } else {
      let toIdx = toSec.tasks.findIndex(t => t.id === afterEl.dataset.id);
      if (toIdx < 0) toIdx = toSec.tasks.length;
      toSec.tasks.splice(toIdx, 0, task);
    }

    rerenderTaskList(fromSid);
    if (fromSid !== toSid) rerenderTaskList(toSid);
    updateProgress(fromSid);
    if (fromSid !== toSid) updateProgress(toSid);
    updateSummary();
    save();
  });
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
  el.innerHTML = `
    <div class="task-checkbox" data-state="${task.state}"
         onclick="event.stopPropagation(); cycleState('${sectionId}', '${task.id}', this)"
         oncontextmenu="cycleStatePartial(event,'${sectionId}','${task.id}',this)"></div>
    <div class="task-content">
      <input class="task-text-input" data-state="${task.state}"
             value="${escHtml(task.text)}" placeholder="task…"
             oninput="updateTaskText('${sectionId}','${task.id}',this.value)"
             onkeydown="taskKeydown(event,'${sectionId}','${task.id}')">
      <input class="task-note-input ${noteVisible}"
             value="${escHtml(task.note || '')}"
             placeholder="what's remaining…"
             data-id="${task.id}"
             oninput="updateTaskNote('${sectionId}','${task.id}',this.value)">
      <div class="subtask-list" id="subtasks-${task.id}"></div>
    </div>
    <div class="task-actions">
      <button class="task-action-btn" onclick="toggleNote('${task.id}')" title="Add note">≡</button>
      <button class="task-action-btn" onclick="addSubtask('${sectionId}','${task.id}')" title="Add sub-task">⊕</button>
      <button class="task-action-btn" onclick="removeTask('${sectionId}','${task.id}')" title="Remove">×</button>
    </div>
  `;
  el.setAttribute('draggable', true);
  el.addEventListener('dragstart', e => {
    currentDrag = { type: 'task', taskId: task.id, sectionId };
    e.dataTransfer.setData('text/plain', JSON.stringify({ taskId: task.id, sectionId }));
    e.dataTransfer.effectAllowed = 'copyMove';
    el.classList.add('task-dragging');
  });
  el.addEventListener('dragend', () => {
    el.classList.remove('task-dragging');
    currentDrag = null;
    const ind = document.getElementById('task-drop-indicator');
    if (ind) ind.style.display = 'none';
  });
  el.addEventListener('contextmenu', e => showContextMenu(e, sectionId, task.id));
  el.addEventListener('click', e => {
    if (!e.target.closest('.task-checkbox, .task-actions, input, button')) {
      el.querySelector('.task-text-input').focus();
    }
  });
  list.appendChild(el);
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
    <input class="subtask-input" data-done="${subtask.done}"
           value="${escHtml(subtask.text)}" placeholder="sub-task…"
           oninput="updateSubtaskText('${sectionId}','${taskId}','${subtask.id}',this.value)"
           onkeydown="subtaskKeydown(event,'${sectionId}','${taskId}','${subtask.id}')">
  `;
  list.appendChild(el);
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
    if (todayItems.length === 0) {
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
    doneSection.style.display = done.length > 0 ? '' : 'none';
    const countEl = document.getElementById('todayDoneCount');
    if (countEl) countEl.textContent = done.length;
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

// ── Full re-render ────────────────────────────────────────────────────
function rescueIndicators() {
  ['task-drop-indicator', 'section-drop-indicator'].forEach(id => {
    const el = document.getElementById(id);
    if (el) { el.style.display = 'none'; document.body.appendChild(el); }
  });
}

function fullRerender() {
  rescueIndicators();
  const col0 = document.getElementById('board-col-0');
  const col1 = document.getElementById('board-col-1');
  if (col0) col0.innerHTML = '';
  if (col1) col1.innerHTML = '';
  sections.forEach(s => { renderSection(s); renderArchiveToggle(s.id); });
  updateEmptyState();
  updateSummary();
  rerenderTodayPanel();
  syncAllTodayIndicators();
}

function rerenderTaskList(sectionId) {
  const sec = sections.find(s => s.id === sectionId);
  const list = document.getElementById(`tasks-${sectionId}`);
  if (!sec || !list) return;
  rescueIndicators();
  list.innerHTML = '';
  sec.tasks.forEach(t => renderTask(sectionId, t));
  syncAllTodayIndicators();
}
