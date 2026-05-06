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
