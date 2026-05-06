# Rendering

All rendering is done in `js/render.js`. The app uses direct DOM manipulation with `innerHTML` template strings — no virtual DOM, no diffing. When data changes, the affected part of the DOM is rebuilt from scratch.

## Section Rendering

`renderSection(section)` builds a complete section card and appends it to the correct board column.

**Column assignment:** sections alternate between `board-col-0` and `board-col-1` based on their index in the `sections[]` array (`index % 2`). This gives the two-column staggered layout.

**What gets rendered:**
- Section header: collapse button, color dot, title input, progress pill, sweep button, remove button, drag handle
- Task list container (`#tasks-{id}`)
- Add task button row
- Archive section container (`#archive-section-{id}`, initially `display:none`)
- Progress bar at the bottom

After building the HTML shell, `renderSection` immediately:
1. Calls `renderTask()` for each task in `section.tasks`
2. Calls `applyCollapse()` to restore collapsed state
3. Attaches drag event listeners (dragstart/dragend on the handle, dragover/dragleave/drop on the task list)

The drag listeners are attached here rather than in `drag.js` because they need a closure over the specific section's `id` and its task list element.

## Task Rendering

`renderTask(sectionId, task)` appends a task item to `#tasks-{sectionId}`.

**What gets rendered:**
- Three-state checkbox (`data-state="none|half|done"`)
- Task text input
- Note input (hidden by default, shown when `.visible` class is present)
- Subtask list container (`#subtasks-{task.id}`)
- Action buttons (note toggle, add subtask, remove)

After building HTML, `renderTask` attaches:
- `dragstart`/`dragend` on the task element itself
- `contextmenu` handler → `showContextMenu()`
- `click` handler to focus the text input when clicking on blank space

Tasks with an existing note (non-empty `task.note`) start with the note visible.  
New empty tasks auto-focus their text input after a 30ms delay (needed because the element is appended synchronously but focus requires the element to be in the document).

## Subtask Rendering

`renderSubtask(taskId, subtask, sectionId)` appends to `#subtasks-{taskId}`. Simple: a clickable dot + text input. Same 30ms auto-focus for new empty subtasks.

## Today Panel Rendering

`rerenderTodayPanel()` fully rebuilds both the active list and the done list. Called whenever `todayItems` changes or any today-visible task changes state.

It splits `todayItems` into:
- `active` — tasks where `state !== 'done'`
- `done` — tasks where `state === 'done'`

Active tasks are shown in the main scrollable list. Done tasks go in the collapsible "done" section at the bottom.

`buildTodayItemEl(ti)` constructs a single today item element. It looks up the task and its parent section (for the source label), computes staleness, and inlines a shared checkbox using the same `cycleState`/`cycleStatePartial` functions as the board — so checking off a task in the today panel updates the board and vice versa.

## Archive Rendering

`renderArchiveToggle(sectionId)` rebuilds the archive sub-section inside a section card. It's called:
- After `sweepDone()` moves tasks to the archive
- During `loadSaved()` to restore existing archives
- During `fullRerender()`

If `archivedTasks` is empty, the container is hidden and emptied. Otherwise it renders a toggle button (with a count badge) and a scrollable list of archived task names + dates.

## Progress & Summary

`updateProgress(sectionId)` updates two elements inside a section:
- `#pill-{id}` — text like `"2 + 1~ / 5"` (done + partial~ / total)
- `#prog-{id}` — the width of the progress bar fill (done + half×0.5 / total × 100%)
- `#sweep-{id}` — the sweep button visibility (shown only when `done > 0`)

`updateSummary()` aggregates all tasks across all sections and updates the bottom summary bar.

`updateEmptyState()` toggles the `#emptyState` placeholder based on whether `sections[]` is empty.

## Full Rerender

`fullRerender()` is the nuclear option — clears both board columns and re-renders everything from scratch. Used after undo/redo and after section drag-drop reorder.

Before clearing, `rescueIndicators()` moves the two drop indicator elements (`#task-drop-indicator`, `#section-drop-indicator`) to `document.body`. This prevents them from being destroyed when `innerHTML = ''` clears the columns — they're shared singletons reused across all drag operations.

## rerenderTaskList

`rerenderTaskList(sectionId)` is a lighter alternative — only rebuilds the task list within a single section. Used after task drag-drop reorder between sections.
