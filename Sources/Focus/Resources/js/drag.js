// ── Drag position helpers ─────────────────────────────────────────────
function getDragAfterTask(container, y) {
  const els = [...container.querySelectorAll('.task-item')]
    .filter(el => el.dataset.id !== currentDrag?.taskId);
  return els.reduce((closest, child) => {
    const box = child.getBoundingClientRect();
    const offset = y - box.top - box.height / 2;
    if (offset < 0 && offset > closest.offset) return { offset, element: child };
    return closest;
  }, { offset: Number.NEGATIVE_INFINITY }).element ?? null;
}

function getDragAfterSection(col, y) {
  const els = [...col.querySelectorAll('.section')]
    .filter(el => el.dataset.id !== currentDrag?.sectionId);
  return els.reduce((closest, child) => {
    const box = child.getBoundingClientRect();
    const offset = y - box.top - box.height / 2;
    if (offset < 0 && offset > closest.offset) return { offset, element: child };
    return closest;
  }, { offset: Number.NEGATIVE_INFINITY }).element ?? null;
}

// ── Board column reorder ───────────────────────────────────────────────
function wireBoardReorder() {
  ['board-col-0', 'board-col-1'].forEach(colId => {
    const col = document.getElementById(colId);
    let _sectionDropAfter = undefined; // undefined = not over this col; null = append
    col.addEventListener('dragover', e => {
      if (!currentDrag || currentDrag.type !== 'section') return;
      e.preventDefault();
      const afterEl = getDragAfterSection(col, e.clientY);
      _sectionDropAfter = afterEl;
      const ind = document.getElementById('section-drop-indicator');
      afterEl ? col.insertBefore(ind, afterEl) : col.appendChild(ind);
      ind.style.display = 'block';
    });
    col.addEventListener('dragleave', e => {
      if (!col.contains(e.relatedTarget)) {
        const ind = document.getElementById('section-drop-indicator');
        if (ind.parentElement === col) ind.style.display = 'none';
        _sectionDropAfter = undefined;
      }
    });
    col.addEventListener('drop', e => {
      e.preventDefault();
      document.getElementById('section-drop-indicator').style.display = 'none';
      if (!currentDrag || currentDrag.type !== 'section') return;
      if (_sectionDropAfter === undefined) return;

      const afterEl = _sectionDropAfter;
      _sectionDropAfter = undefined;

      const { sectionId: dragSid } = currentDrag;
      const fromIdx = sections.findIndex(s => s.id === dragSid);
      if (fromIdx === -1) return;

      takeSnapshot();
      const [sec] = sections.splice(fromIdx, 1);

      if (afterEl === null) {
        sections.push(sec);
      } else {
        let toIdx = sections.findIndex(s => s.id === afterEl.dataset.id);
        if (toIdx < 0) toIdx = sections.length;
        sections.splice(toIdx, 0, sec);
      }

      currentDrag = null;
      fullRerender();
      save();
    });
  });
}

// ── Today panel drop target ────────────────────────────────────────────
(function wireTodayDrop() {
  const panel = document.getElementById('todayPanel');
  panel.addEventListener('dragover', e => {
    if (!currentDrag || currentDrag.type !== 'task') return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    panel.classList.add('drop-target');
  });
  panel.addEventListener('dragleave', e => {
    if (!panel.contains(e.relatedTarget)) panel.classList.remove('drop-target');
  });
  panel.addEventListener('drop', e => {
    e.preventDefault();
    panel.classList.remove('drop-target');
    if (!currentDrag || currentDrag.type !== 'task') return;
    try {
      const { taskId, sectionId } = JSON.parse(e.dataTransfer.getData('text/plain'));
      addToToday(sectionId, taskId);
    } catch (_) {}
  });
})();

// ── Boot ──────────────────────────────────────────────────────────────
document.addEventListener('contextmenu', e => e.preventDefault());
loadSettings();
wireBoardReorder();

if (!loadSaved()) {
  handleDayRollover();
  const s1 = addSection('Operations');
  addTask(s1, 'Review vendor contracts', 'done');
  addTask(s1, 'Update team handbook', 'half', 'missing onboarding section');
  addTask(s1, 'Schedule Q2 retro');

  const s2 = addSection('People');
  addTask(s2, '1:1s this week');
  addTask(s2, 'Mid-cycle reviews', 'half', '3 of 5 written');
  addTask(s2, 'Async update to leadership', 'done');
}
