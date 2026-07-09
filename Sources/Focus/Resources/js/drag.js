// ── Pointer-based drag to reorder (sections + tasks) ───────────────────
// Native HTML5 drag-and-drop is unreliable inside WKWebView — dragstart
// gets swallowed near text inputs — so reordering is implemented with
// pointer events instead. Tasks can also be dropped on the Today panel.
(function () {
  const DRAG_THRESHOLD = 5; // px of movement before a press becomes a drag
  let drag = null;
  let indicator = null;

  function getIndicator() {
    if (!indicator) {
      indicator = document.createElement('div');
      indicator.className = 'drop-indicator';
      document.body.appendChild(indicator);
    }
    return indicator;
  }
  function hideIndicator() { if (indicator) indicator.style.display = 'none'; }
  function showIndicatorAt(el, before) {
    const r = el.getBoundingClientRect();
    const ind = getIndicator();
    ind.style.display = 'block';
    ind.style.left = r.left + 'px';
    ind.style.width = r.width + 'px';
    ind.style.top = (before ? r.top - 1 : r.bottom - 1) + 'px';
  }
  function todayPanel() { return document.getElementById('todayPanel'); }

  function begin(e, type, id, sectionId) {
    if (e.button !== 0) return;
    const sel = type === 'section' ? '.section' : '.task-item';
    const el = e.target.closest(sel);
    if (!el) return;
    if (type === 'section' && id === INBOX_ID) return; // inbox is pinned at top
    e.preventDefault();
    drag = { type, id, sectionId, el, startX: e.clientX, startY: e.clientY,
             active: false, target: null, before: false, dropToday: false };
    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onUp, { once: true });
  }

  function onMove(e) {
    if (!drag) return;
    if (!drag.active) {
      if (Math.hypot(e.clientX - drag.startX, e.clientY - drag.startY) < DRAG_THRESHOLD) return;
      drag.active = true;
      drag.el.classList.add('dragging');
      document.body.classList.add('is-dragging');
    }
    e.preventDefault();
    drag.el.style.pointerEvents = 'none';
    const under = document.elementFromPoint(e.clientX, e.clientY);
    drag.el.style.pointerEvents = '';
    drag.type === 'section' ? updateSectionTarget(e, under) : updateTaskTarget(e, under);
  }

  function updateSectionTarget(e, under) {
    const targetEl = under && under.closest('.section');
    if (!targetEl || targetEl === drag.el) { hideIndicator(); drag.target = null; return; }
    const r = targetEl.getBoundingClientRect();
    drag.before = e.clientY < r.top + r.height / 2;
    drag.target = targetEl.dataset.id;
    showIndicatorAt(targetEl, drag.before);
  }

  function updateTaskTarget(e, under) {
    // Drop onto the Today panel → add to today
    const panel = under && under.closest('#todayPanel');
    if (panel) { drag.dropToday = true; drag.target = null; panel.classList.add('drop-target'); hideIndicator(); return; }
    drag.dropToday = false;
    todayPanel().classList.remove('drop-target');

    const targetTask = under && under.closest('.task-item');
    const list = under && under.closest('.task-list');
    if (targetTask && targetTask !== drag.el) {
      const r = targetTask.getBoundingClientRect();
      const before = e.clientY < r.top + r.height / 2;
      drag.target = { taskId: targetTask.dataset.id, sectionId: targetTask.dataset.section, before };
      showIndicatorAt(targetTask, before);
    } else if (list) {
      drag.target = { taskId: null, sectionId: list.id.replace('tasks-', ''), before: false };
      showIndicatorAt(list, false);
    } else {
      hideIndicator(); drag.target = null;
    }
  }

  function onUp() {
    document.removeEventListener('pointermove', onMove);
    const d = drag;
    drag = null;
    hideIndicator();
    document.body.classList.remove('is-dragging');
    todayPanel()?.classList.remove('drop-target');
    if (!d) return;
    d.el.classList.remove('dragging');
    d.el.style.pointerEvents = '';
    if (!d.active) return; // never crossed the threshold — treat as a click
    d.type === 'section' ? commitSection(d) : commitTask(d);
  }

  function commitSection(d) {
    if (!d.target) return;
    const fromIdx = sections.findIndex(s => s.id === d.id);
    const targetIdx = sections.findIndex(s => s.id === d.target);
    if (fromIdx < 0 || targetIdx < 0) return;
    let insertAt = targetIdx + (d.before ? 0 : 1);
    if (fromIdx < insertAt) insertAt--; // adjust for the removal below
    // keep inbox pinned at position 0
    if (sections[0]?.id === INBOX_ID && insertAt === 0) insertAt = 1;
    if (insertAt === fromIdx) return;
    takeSnapshot();
    const [sec] = sections.splice(fromIdx, 1);
    sections.splice(insertAt, 0, sec);
    // Re-flow the masonry columns from the new order. This moves the existing
    // DOM nodes (no rebuild), so the card entrance animation doesn't replay.
    scheduleLayout();
    save();
  }

  function commitTask(d) {
    if (d.dropToday) { addToToday(d.sectionId, d.id); return; }
    if (!d.target) return;
    const fromSec = sections.find(s => s.id === d.sectionId);
    const toSec = sections.find(s => s.id === d.target.sectionId);
    if (!fromSec || !toSec) return;
    const fromIdx = fromSec.tasks.findIndex(t => t.id === d.id);
    if (fromIdx < 0) return;

    let insertAt;
    if (d.target.taskId == null) {
      insertAt = toSec.tasks.length;
    } else {
      insertAt = toSec.tasks.findIndex(t => t.id === d.target.taskId);
      if (insertAt < 0) insertAt = toSec.tasks.length;
      else insertAt += d.target.before ? 0 : 1;
    }
    if (fromSec === toSec) {
      if (fromIdx < insertAt) insertAt--;
      if (insertAt === fromIdx) return;
    }
    takeSnapshot();
    const [task] = fromSec.tasks.splice(fromIdx, 1);
    toSec.tasks.splice(insertAt, 0, task);
    // keep any Today entry pointing at the task's new section
    const ti = todayItems.find(t => t.taskId === d.id);
    if (ti) ti.sectionId = toSec.id;
    // Only touch the affected list(s) — avoids the full-board rebuild flicker.
    rerenderTaskList(toSec.id);
    updateProgress(toSec.id);
    if (fromSec !== toSec) {
      rerenderTaskList(fromSec.id);
      updateProgress(fromSec.id);
      rerenderTodayPanel();
    }
    save();
  }

  window.startSectionDrag = (e, id) => begin(e, 'section', id, null);
  window.startTaskDrag = (e, sectionId, id) => begin(e, 'task', id, sectionId);
})();

// ── Boot ──────────────────────────────────────────────────────────────
document.addEventListener('contextmenu', e => e.preventDefault());
loadSettings();

if (!loadSaved()) {
  handleDayRollover();
  ensureInbox();
  const s1 = addSection('Operations');
  addTask(s1, 'Review vendor contracts', 'done');
  addTask(s1, 'Update team handbook', 'half', 'missing onboarding section');
  addTask(s1, 'Schedule Q2 retro');

  const s2 = addSection('People');
  addTask(s2, '1:1s this week');
  addTask(s2, 'Mid-cycle reviews', 'half', '3 of 5 written');
  addTask(s2, 'Async update to leadership', 'done');
}
