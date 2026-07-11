# focus. — Feature Backlog

All UI lives in `Sources/Focus/Resources/index.html` (vanilla HTML/CSS/JS, WKWebView, localStorage persistence).
No build step. No framework. Changes to Swift files are needed only where noted.

---

## Feature Table

| ID      | Feature                        | Complexity | Status         |
|---------|--------------------------------|------------|----------------|
| FEAT-01 | Undo (Cmd+Z)                   | Low        | ✅ Done        |
| FEAT-02 | Collapse sections              | Low        | ✅ Done        |
| FEAT-03 | Section color dot              | Low        | ✅ Done        |
| FEAT-04 | Keyboard navigation            | Low        | ✅ Done        |
| FEAT-05 | Export board as text           | Low        | ✅ Done        |
| FEAT-06 | Archive sweep                  | Medium     | ✅ Done        |
| FEAT-07 | Drag task → Today panel        | Medium     | ✅ Done        |
| FEAT-08 | Quick search / filter          | Medium     | ✅ Done        |
| FEAT-09 | Drag to reorder tasks/sections | Medium     | ✅ Done        |
| FEAT-10 | Brain dump inbox               | Medium     | ✅ Done        |
| FEAT-11 | Section templates              | Medium     | — Backlog      |
| FEAT-12 | Task aging on the board        | Medium     | ✅ Done        |
| FEAT-13 | Focus timer (Pomodoro)         | High       | — Backlog      |
| FEAT-14 | End-of-day summary             | High       | — Backlog      |
| FEAT-15 | Daily standup generator        | High       | — Backlog      |
| FEAT-16 | Rolling week view              | High       | ✅ Done        |

---

## FEAT-01 — Undo (Cmd+Z) ✅ Done

**What:** Cmd+Z undoes the last destructive action — task delete, section delete, state change, or text clear. One level of undo is enough for v1; a full history stack is a bonus.

**How:**

1. Before any mutation, snapshot the current state:
   ```js
   let undoSnapshot = null;
   function takeSnapshot() {
     undoSnapshot = JSON.stringify({ sections, todayItems });
   }
   ```
2. Call `takeSnapshot()` at the top of `removeTask`, `removeSection`, `removeSubtask`, and before any `cycleState` call.
3. Add a global keydown listener:
   ```js
   document.addEventListener('keydown', e => {
     if ((e.metaKey || e.ctrlKey) && e.key === 'z' && undoSnapshot) {
       const { sections: s, todayItems: t } = JSON.parse(undoSnapshot);
       sections = s;
       todayItems = t;
       undoSnapshot = null;
       fullRerender();
       save();
     }
   });
   ```
4. Write a `fullRerender()` function that clears `#board`, re-runs `renderSection` for every section, then calls `updateEmptyState`, `updateSummary`, `rerenderTodayPanel`, `syncAllTodayIndicators`.
5. For a multi-step undo stack, replace `undoSnapshot` with `let undoStack = []` (max 20 entries), push on each mutation, pop on Cmd+Z.

**Files:** `index.html` only.

---

## FEAT-02 — Collapse sections ✅ Done

**What:** Clicking a chevron on the section header toggles the task list and add-task row in/out of view. Collapsed state persists across sessions.

**How:**

1. Add a `collapsed: false` field to each section object in the data model.
2. In `renderSection`, prepend a chevron button to `.section-header`:
   ```html
   <button class="collapse-btn" data-id="${section.id}" onclick="toggleCollapse('${section.id}')">▾</button>
   ```
3. Write `toggleCollapse(sectionId)`:
   ```js
   function toggleCollapse(sectionId) {
     const sec = sections.find(s => s.id === sectionId);
     sec.collapsed = !sec.collapsed;
     applyCollapse(sectionId, sec.collapsed);
     save();
   }
   function applyCollapse(sectionId, collapsed) {
     const el = document.querySelector(`.section[data-id="${sectionId}"]`);
     el.querySelector('.task-list').style.display      = collapsed ? 'none' : '';
     el.querySelector('.add-task-row').style.display   = collapsed ? 'none' : '';
     el.querySelector('.section-progress-bar').style.display = collapsed ? 'none' : '';
     el.querySelector('.collapse-btn').textContent     = collapsed ? '▸' : '▾';
   }
   ```
4. In `renderSection`, call `applyCollapse(section.id, section.collapsed)` after rendering.
5. CSS: style `.collapse-btn` similarly to `.section-menu-btn` (no background, muted color, hover brightens).

**Files:** `index.html` only.

---

## FEAT-03 — Section color dot ✅ Done

**What:** A small filled circle in the section header that cycles through ~8 preset colors on click. The color is purely decorative — a quick visual anchor when you have many sections. Persists in the data model.

**How:**

1. Add a `color: null` field to each section object. `null` means "no color / default".
2. Define a palette:
   ```js
   const SECTION_COLORS = [null, '#c8a97e', '#7ab07a', '#7a9ab0', '#b07a9a', '#b0a07a', '#7ab0a0', '#b08a7a'];
   ```
3. In `renderSection`, add a color dot button to `.section-header`:
   ```html
   <button class="color-dot-btn" id="cdot-${section.id}"
           onclick="cycleSectionColor('${section.id}')"
           style="background: ${section.color || 'transparent'}"></button>
   ```
4. Write `cycleSectionColor(sectionId)`:
   ```js
   function cycleSectionColor(sectionId) {
     const sec = sections.find(s => s.id === sectionId);
     const idx = SECTION_COLORS.indexOf(sec.color);
     sec.color = SECTION_COLORS[(idx + 1) % SECTION_COLORS.length];
     document.getElementById(`cdot-${sectionId}`).style.background = sec.color || 'transparent';
     save();
   }
   ```
5. CSS for `.color-dot-btn`: 10×10px circle, border `1px solid var(--border-light)` when no color is set, no border when colored, cursor pointer.

**Files:** `index.html` only.

---

## FEAT-04 — Keyboard navigation ✅ Done

**What:** Full keyboard flow so the mouse is never needed once the panel is open.

**Shortcuts to implement:**

| Key | Action |
|-----|--------|
| `Enter` on task input | Already works (adds new task below) |
| `Tab` on last task input in a section | Move focus to the first task of the next section |
| `Shift+Tab` on first task | Move focus to last task of previous section |
| `Cmd+Enter` on task input | Toggle task done/undone |
| `Cmd+Shift+Enter` | Toggle task half/undone |
| `Cmd+D` anywhere | Toggle Today membership for the focused task |
| `Escape` | Close the panel (call `window.webkit.messageHandlers` or the native close bridge) |

**How:**

1. Give each task input a `data-section` and `data-task` attribute (already present on `.task-item`, ensure inputs inherit via dataset or explicit attrs).
2. Extend `taskKeydown`:
   ```js
   function taskKeydown(e, sectionId, taskId) {
     if (e.key === 'Enter' && !e.metaKey) { ... } // existing
     if (e.key === 'Enter' && e.metaKey && !e.shiftKey) {
       e.preventDefault();
       const cb = document.querySelector(`.task-item[data-id="${taskId}"] .task-checkbox`);
       cycleState(sectionId, taskId, cb);
     }
     if (e.key === 'Enter' && e.metaKey && e.shiftKey) {
       e.preventDefault();
       const cb = document.querySelector(`.task-item[data-id="${taskId}"] .task-checkbox`);
       cycleStatePartial({ preventDefault(){} }, sectionId, taskId, cb);
     }
     if (e.key === 'd' && e.metaKey) {
       e.preventDefault();
       isInToday(taskId) ? removeFromToday(taskId) : addToToday(sectionId, taskId);
     }
     if (e.key === 'Tab') {
       e.preventDefault();
       focusAdjacentTask(sectionId, taskId, e.shiftKey ? -1 : 1);
     }
   }
   ```
3. Write `focusAdjacentTask(sectionId, taskId, dir)` — walks the flat list of all rendered task inputs in DOM order and focuses `currentIndex + dir`.
4. For Escape, `FocusWindow.swift` already handles the hotkey toggle. Add a JS bridge: `window.addEventListener('keydown', e => { if (e.key === 'Escape') window.webkit.messageHandlers.focusClose?.postMessage(null); })` and wire it in `FocusWindow.swift` via `WKScriptMessageHandler`.

**Files:** `index.html` (majority), `FocusWindow.swift` (Escape bridge, minor).

---

## FEAT-05 — Export board as text ✅ Done

**What:** Cmd+Shift+C copies the entire board to the clipboard as clean plain text (markdown checklist format). Useful for pasting into Slack, docs, or email.

**Output format:**
```
## Operations
- [x] Review vendor contracts
- [~] Update team handbook  (missing onboarding section)
  - [x] sub-item one
- [ ] Schedule Q2 retro

## People
...
```

**How:**

1. Add a global keydown listener for `Cmd+Shift+C`:
   ```js
   document.addEventListener('keydown', e => {
     if (e.metaKey && e.shiftKey && e.key === 'c') {
       e.preventDefault();
       copyBoardAsText();
     }
   });
   ```
2. Write `copyBoardAsText()`:
   ```js
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
     navigator.clipboard.writeText(lines.join('\n'));
     showToast('Copied to clipboard');
   }
   ```
3. Add a lightweight `showToast(msg)` function — a small absolutely-positioned label that fades in/out over 1.5s, no library needed.
4. Optionally add an export button to the topbar for discoverability.

**Files:** `index.html` only.

---

## FEAT-06 — Archive sweep ✅ Done

**What:** A "sweep done" button (or Cmd+Shift+Backspace) on each section that moves all `done` tasks into a hidden archive list. The archive is collapsible and shows tasks with their completion context. Done tasks are gone from the active list but not permanently deleted.

**How:**

1. Add an `archivedTasks: []` array to each section in the data model. Each entry: `{ id, text, note, subtasks, archivedDate }`.
2. Add a sweep button to `.section-header` (only visible when section has done tasks):
   ```html
   <button class="sweep-btn" id="sweep-${section.id}" onclick="sweepDone('${section.id}')" title="Archive done tasks">↓</button>
   ```
3. Write `sweepDone(sectionId)`:
   ```js
   function sweepDone(sectionId) {
     const sec = sections.find(s => s.id === sectionId);
     const toArchive = sec.tasks.filter(t => t.state === 'done');
     toArchive.forEach(t => {
       sec.archivedTasks.push({ ...t, archivedDate: todayStr() });
       document.querySelector(`.task-item[data-id="${t.id}"]`)?.remove();
       if (isInToday(t.id)) removeFromToday(t.id);
     });
     sec.tasks = sec.tasks.filter(t => t.state !== 'done');
     updateProgress(sectionId);
     updateSummary();
     renderArchiveToggle(sectionId);
     save();
   }
   ```
4. Render a collapsible archive row at the bottom of each section (below `.add-task-row`) when `archivedTasks.length > 0`. Shows date and text, dimmed, non-interactive. A "clear archive" button permanently deletes them.
5. Update `renderSection` and `loadSaved` to handle the new `archivedTasks` field (default to `[]` if missing for backward compatibility).

**Files:** `index.html` only.

---

## FEAT-07 — Drag task → Today panel ✅ Done

**What:** Tasks can be dragged from the board and dropped onto the Today panel as an alternative to right-click. The Today panel shows a drop zone highlight while a drag is in progress.

**How:**

1. In `renderTask`, make the task item draggable:
   ```js
   el.setAttribute('draggable', true);
   el.addEventListener('dragstart', e => {
     e.dataTransfer.setData('text/plain', JSON.stringify({ taskId: task.id, sectionId }));
     e.dataTransfer.effectAllowed = 'copy';
   });
   ```
2. On the `#todayPanel` element, wire drag events:
   ```js
   todayPanel.addEventListener('dragover', e => {
     e.preventDefault();
     e.dataTransfer.dropEffect = 'copy';
     todayPanel.classList.add('drop-target');
   });
   todayPanel.addEventListener('dragleave', () => todayPanel.classList.remove('drop-target'));
   todayPanel.addEventListener('drop', e => {
     e.preventDefault();
     todayPanel.classList.remove('drop-target');
     const { taskId, sectionId } = JSON.parse(e.dataTransfer.getData('text/plain'));
     addToToday(sectionId, taskId);
   });
   ```
3. CSS for `.today-panel.drop-target`: brighten the border and add a subtle glow using `--today-border` at higher opacity.

**Files:** `index.html` only.

---

## FEAT-08 — Quick search / filter ✅ Done

**What:** Cmd+F opens an inline search bar in the topbar. As the user types, tasks that don't match the query are dimmed (or hidden). Escape clears the search. Matches are highlighted.

**How:**

1. Add a hidden search input to `.topbar-right`:
   ```html
   <input id="searchInput" class="search-input" placeholder="search tasks…"
          oninput="filterTasks(this.value)" style="display:none">
   ```
2. Toggle with `Cmd+F`:
   ```js
   document.addEventListener('keydown', e => {
     if (e.metaKey && e.key === 'f') {
       e.preventDefault();
       const inp = document.getElementById('searchInput');
       inp.style.display = inp.style.display === 'none' ? '' : 'none';
       if (inp.style.display !== 'none') inp.focus();
       else { inp.value = ''; filterTasks(''); }
     }
     if (e.key === 'Escape') { /* clear search if open */ }
   });
   ```
3. Write `filterTasks(query)`:
   ```js
   function filterTasks(query) {
     const q = query.toLowerCase().trim();
     document.querySelectorAll('.task-item').forEach(el => {
       const text = el.querySelector('.task-text-input')?.value.toLowerCase() || '';
       el.style.opacity = (!q || text.includes(q)) ? '' : '0.2';
     });
     document.querySelectorAll('.section').forEach(sec => {
       const visibleTasks = [...sec.querySelectorAll('.task-item')]
         .filter(el => el.style.opacity !== '0.2');
       sec.style.opacity = (!q || visibleTasks.length > 0) ? '' : '0.3';
     });
   }
   ```
4. CSS: `.search-input` styled like `.add-section-btn` — same height, monospace font, fits the topbar.

**Files:** `index.html` only.

---

## FEAT-09 — Reorder tasks and sections ✅ Done

**What:** Tasks within a section can be reordered, sections on the board can be reordered, and tasks can be dragged across sections. Order persists via localStorage.

**Status:** Shipped with **pointer events**, not the native HTML5 drag API. The native API kept breaking in WKWebView — `dragstart` gets swallowed near text inputs and fights the browser's own text-selection drag — so it was abandoned. The ↑/↓ arrow-button fallback has been removed now that drag is solid.

**Implementation (`js/drag.js`):**

- A **⠿ grip handle** on each section header (non-inbox) and each task row starts a drag via `startSectionDrag` / `startTaskDrag`. Everything runs through a shared `pointerdown` → `pointermove` → `pointerup` engine.
- A **5px movement threshold** distinguishes a click from a drag, so text editing in inputs is untouched. `-webkit-user-select` is disabled on card chrome (re-enabled on inputs) so a mis-grab doesn't start a text highlight.
- `elementFromPoint` under the cursor resolves the drop target; a fixed-position `.drop-indicator` line shows where the item will land (before/after the target's vertical midpoint).
- **Sections** reorder by re-sequencing the existing DOM nodes in place (no `fullRerender`, so no entrance-animation flicker). Inbox stays pinned at index 0.
- **Tasks** reorder within a section and move across sections; only the affected list(s) re-render. A moved task keeps its Today membership (its `todayItems` entry's `sectionId` is updated).
- All drops are undo-aware via `takeSnapshot()` (Cmd+Z).
- Bonus: dragging a task onto the **Today panel** adds it there (revived the previously-dead FEAT-07 native-DnD path through the same engine).

**Layout dependency:** required reworking the board from two hard-coded columns (`board-col-0/1` + `index % 2` distribution) to a single flex-wrap `#board` where a section's DOM position equals its array index — that's what makes reorder a simple array splice.

**Files:** `js/drag.js`, `js/render.js`, `js/state.js`, `styles/layout.css`, `index.html`.

---

## FEAT-10 — Brain dump inbox

**What:** A persistent "inbox" section that always appears first and cannot be deleted. Accessed via a dedicated keyboard shortcut (Cmd+I) that focuses a quick-entry field. Tasks captured here stay until the user drags or moves them to a named section. The inbox has a distinct visual treatment to signal it's a temporary holding area.

**How:**

1. Initialize the inbox on first load:
   ```js
   const INBOX_ID = 'inbox';
   function ensureInbox() {
     if (!sections.find(s => s.id === INBOX_ID)) {
       sections.unshift({ id: INBOX_ID, title: 'inbox', tasks: [], color: null, collapsed: false });
     }
   }
   ```
2. In `removeSection`, guard against deleting the inbox: `if (sectionId === INBOX_ID) return;`. Hide the delete button for this section.
3. In `renderSection`, if `section.id === INBOX_ID`, apply an `.inbox-section` class for distinct styling (dashed border, slightly different background).
4. Cmd+I shortcut: open the panel (if closed) and focus the add-task input of the inbox section.
5. For FEAT-09 (drag reorder), keep inbox pinned at position 0 — don't allow other sections to be dragged before it.
6. Optionally add a "move to…" option in the task right-click context menu that lists all non-inbox sections and transfers the task.

**Files:** `index.html` only.

---

## FEAT-11 — Section templates

**What:** A section's structure (title + task names, without state) can be saved as a named template. When adding a new section, the user can choose "from template" to pre-populate it. Useful for recurring contexts like "weekly review" or sprint planning.

**How:**

1. Add a `templates` array to the persisted state (stored separately under `focus-templates-v1` in localStorage): `[{ id, name, tasks: [{ text, subtasks: [text] }] }]`.
2. In the section `⋯` menu (currently just a delete button — extend it into a real dropdown), add "Save as template…". Prompt for a template name via a small inline input, then snapshot the section's task texts.
3. Modify the `+ section` button to open a small popover:
   - "blank section" (existing behavior)
   - One entry per saved template
4. When a template is selected, call `addSection(template.name)` then iterate `template.tasks` calling `addTask(...)` for each.
5. Template management (rename, delete) can live in a small "manage templates" modal accessed from the same popover — low priority for v1.

**Files:** `index.html` only.

---

## FEAT-12 — Task aging on the board

**What:** Tasks that have been open (`state === 'none'`) or partial (`state === 'half'`) for more than a configurable number of days show a subtle age indicator directly on the board card — the same `+N` staleness dot already used in the Today panel.

**How:**

1. Add a `createdDate: todayStr()` field to every new task object in `addTask`. For existing tasks loaded from storage that lack this field, backfill with `null` (no indicator shown until the date is known).
2. In `renderTask`, after rendering the task actions, conditionally append a staleness span:
   ```js
   const days = task.createdDate ? daysSince(task.createdDate) : 0;
   if (days >= 3 && task.state !== 'done') {
     const span = document.createElement('span');
     span.className = `staleness ${stalenessClass(days)}`;
     span.textContent = `+${days}`;
     el.querySelector('.task-actions').before(span);
   }
   ```
3. Re-render the staleness indicators when the panel is opened (the window gains focus) so the count stays accurate without requiring a page reload. Wire this to the `visibilitychange` or WKWebView focus event.
4. Consider adding a threshold setting (default: 3 days for amber, 7 for red) as a constant at the top of the script.

**Files:** `index.html` only. Optionally `FocusWindow.swift` to fire a JS call on window focus.

---

## FEAT-13 — Focus timer (Pomodoro)

**What:** Right-clicking a task in the Today panel offers "start focus timer." A countdown (25 min default) appears in the Today panel header. When the timer ends, a native macOS notification fires. The menubar icon optionally pulses while a timer is running.

**How:**

**JS side (index.html):**

1. Add timer state: `let timerInterval = null, timerSeconds = 0, timerTaskId = null`.
2. Add "▶ Focus 25m" to the task context menu (only for Today-panel tasks).
3. `startFocusTimer(taskId, minutes = 25)`:
   ```js
   function startFocusTimer(taskId, minutes) {
     if (timerInterval) clearInterval(timerInterval);
     timerSeconds = minutes * 60;
     timerTaskId = taskId;
     timerInterval = setInterval(tickTimer, 1000);
     renderTimerInHeader();
   }
   function tickTimer() {
     timerSeconds--;
     renderTimerInHeader();
     if (timerSeconds <= 0) {
       clearInterval(timerInterval);
       timerInterval = null;
       window.webkit.messageHandlers.timerDone?.postMessage({ taskId: timerTaskId });
     }
   }
   ```
4. `renderTimerInHeader()` updates a `<span id="timerDisplay">` in `.today-header` showing `MM:SS`.

**Swift side (FocusWindow.swift + AppDelegate.swift):**

1. Add a `WKScriptMessageHandler` for the `timerDone` message name.
2. On receipt, fire a `UNUserNotificationCenter` local notification: "Focus session complete — {task name}".
3. Optionally, toggle a pulsing animation on the `NSStatusItem` button while the timer runs by posting a JS message to the webview from a native `Timer`.

**Files:** `index.html`, `FocusWindow.swift`, `AppDelegate.swift`.

---

## FEAT-14 — End-of-day summary

**What:** When the user opens focus. after a gap of more than 4 hours since last use (configurable), and the current time is between 4 PM and midnight, show a brief overlay before the main board: "Today you completed X tasks. Y are still open." with a dismiss button. The overlay is non-blocking and auto-dismisses after 5 seconds.

**How:**

1. On every save, write `localStorage.setItem('focus-last-active', Date.now())`.
2. On load, check:
   ```js
   function checkEndOfDay() {
     const last = parseInt(localStorage.getItem('focus-last-active') || '0');
     const gapHours = (Date.now() - last) / 3_600_000;
     const hour = new Date().getHours();
     if (gapHours >= 4 && hour >= 16) showEodOverlay();
   }
   ```
3. `showEodOverlay()` creates a full-panel overlay div (z-index above everything):
   - Count done tasks created today (requires `createdDate` from FEAT-12).
   - Count open/half tasks.
   - Display the summary text, a "got it" button, and a 5s auto-dismiss countdown.
4. Style the overlay consistently with the dark theme — semi-transparent backdrop, centered card with serif headline.
5. Do not show the overlay if there are zero tasks total (fresh install).

**Files:** `index.html` only.

---

## FEAT-15 — Daily standup generator

**What:** A "standup" button (or Cmd+Shift+S) generates a formatted standup message and copies it to the clipboard. The format is: **Yesterday** (tasks completed since the last time the panel was closed the prior day) · **Today** (current Today panel contents) · **Blockers** (tasks in `half` state with a note).

**How:**

1. On every save, persist a daily task log under `focus-daily-log-v1`:
   ```js
   // Structure: { 'YYYY-MM-DD': { completed: [taskText], ...] } }
   ```
   When a task transitions to `done`, append its text to today's log entry.

2. `generateStandup()`:
   ```js
   function generateStandup() {
     const yesterday = getPrevWorkdayStr(); // skip weekends
     const log = JSON.parse(localStorage.getItem('focus-daily-log-v1') || '{}');
     const completed = log[yesterday] || [];

     const todayTasks = todayItems
       .map(ti => findTask(ti.taskId))
       .filter(t => t && t.state !== 'done')
       .map(t => `• ${t.text}`);

     const blockers = sections.flatMap(s => s.tasks)
       .filter(t => t.state === 'half' && t.note)
       .map(t => `• ${t.text}: ${t.note}`);

     const lines = [
       '**Yesterday**',
       ...(completed.length ? completed.map(t => `• ${t}`) : ['• (nothing logged)']),
       '',
       '**Today**',
       ...(todayTasks.length ? todayTasks : ['• (nothing planned)']),
     ];
     if (blockers.length) lines.push('', '**Blockers**', ...blockers);

     navigator.clipboard.writeText(lines.join('\n'));
     showToast('Standup copied');
   }
   ```

3. `getPrevWorkdayStr()` — returns the ISO date string of the most recent Mon–Fri before today.

4. Wire to Cmd+Shift+S and add a button to the topbar.

**Files:** `index.html` only.

---

## FEAT-16 — Rolling week view ✅ Done

**What:** A second panel tab (alongside "today") labeled "week" that shows a 7-day history of completed tasks, grouped by day. Each day shows which tasks were done. Helps with weekly reviews and gives a sense of momentum.

**Shipped:** Instead of the FEAT-15 snapshot log (which isn't built), the week view is **derived** from a `completedDate` field stamped on each task when it flips to `done` and cleared when un-completed. Grouping scans active + archived tasks by that date. This keeps the view self-consistent for free: un-completing removes it, renaming reflects live (text is read from the task, not a snapshot), re-completing stays a single entry, and undo works because `completedDate` lives in the task model. Clearing an archive drops those completions from history. A `refreshWeekIfActive()` hook re-renders the panel on the relevant mutations while the week tab is open.

**How (original plan — kept for reference; superseded by the derived approach above):**

This feature builds on the daily task log introduced in FEAT-15.

1. Add a tab switcher to the right panel header:
   ```html
   <div class="panel-tabs">
     <button class="panel-tab active" onclick="switchTab('today')">today</button>
     <button class="panel-tab" onclick="switchTab('week')">week</button>
   </div>
   ```
2. Add a `#weekPanel` div as a sibling to `#todayList`, hidden by default.
3. `renderWeekPanel()`:
   ```js
   function renderWeekPanel() {
     const log = JSON.parse(localStorage.getItem('focus-daily-log-v1') || '{}');
     const panel = document.getElementById('weekPanel');
     panel.innerHTML = '';
     for (let i = 0; i < 7; i++) {
       const d = new Date();
       d.setDate(d.getDate() - i);
       const key = fmtDate(d); // 'YYYY-MM-DD'
       const label = i === 0 ? 'today' : i === 1 ? 'yesterday' : d.toLocaleDateString('en', { weekday: 'short', month: 'short', day: 'numeric' });
       const tasks = log[key] || [];
       const dayEl = document.createElement('div');
       dayEl.className = 'week-day';
       dayEl.innerHTML = `
         <div class="week-day-label">${label}</div>
         ${tasks.length
           ? tasks.map(t => `<div class="week-task">✓ ${escHtml(t)}</div>`).join('')
           : '<div class="week-task week-empty">—</div>'}
       `;
       panel.appendChild(dayEl);
     }
   }
   ```
4. `switchTab(tab)` toggles visibility between `#todayList`/`#todayDoneSection` and `#weekPanel`, and calls `renderWeekPanel()` when switching to week.
5. CSS: `.week-day-label` uses the existing serif italic style; `.week-task` uses the muted mono style. Days with no completions are visually quieter.

**Dependencies:** Requires the daily task log from FEAT-15. FEAT-12 (`createdDate`) is optional but helps distinguish tasks completed today vs. carried over.

**Files:** `index.html` only.
