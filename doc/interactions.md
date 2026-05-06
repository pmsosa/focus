# Interactions

All user-facing mutations and event handlers live in `js/interactions.js`.

## Keyboard Shortcuts

Global `keydown` listener handles all shortcuts:

| Shortcut | Action |
|---|---|
| `Escape` | Close search bar (if open), otherwise send `focusClose` to Swift to hide window |
| `⌘F` | Toggle search bar |
| `⌘Z` | Undo |
| `⌘⇧Z` / `⌘Y` | Redo |
| `⌘⇧C` | Copy board as Markdown text |

Per-task keyboard shortcuts (handled in `taskKeydown`):

| Shortcut | Action |
|---|---|
| `Enter` | Add new task below in same section |
| `Backspace` on empty task | Remove the task |
| `⌘Enter` | Cycle task to done/none |
| `⌘⇧Enter` | Cycle task to half/none |
| `⌘D` | Toggle task in today panel |
| `Tab` / `⇧Tab` | Move focus to next/previous task |
| `⌘⇧⌫` | Sweep done tasks to archive in this section |

Per-subtask shortcuts (handled in `subtaskKeydown`):

| Shortcut | Action |
|---|---|
| `Enter` | Add new subtask |
| `Backspace` on empty subtask | Remove the subtask |

## Task State Machine

Tasks have three states: `none` → `done` → `none` (left-click cycles), and a separate path for `half` (right-click toggles half/none).

```
left-click:   none ──→ done ──→ none
right-click:  none ──→ half ──→ none
              done  (right-click ignored if already done — cycleStatePartial goes none/half only)
```

`setTaskState()` is the single point of truth for applying a state change. It:
1. Updates the in-memory `task.state`
2. Sets `data-state` on the checkbox element
3. Syncs `data-state` on the board task's checkbox and text input (important when the change comes from the Today panel's checkbox)
4. Auto-shows the note input when transitioning to `half` (the "what's remaining?" prompt)
5. Calls `updateProgress`, `updateSummary`, optionally `rerenderTodayPanel`, and `save()`

## Search / Filter

`filterTasks(query)` is called on every keystroke in the search input. It:
1. Dims non-matching tasks to 15% opacity
2. Dims entire sections without any match to 30% opacity
3. Highlights matching sections with `.search-match` border
4. Auto-expands collapsed sections that have matches
5. Restores collapse state when search is cleared

## Section Management

- **`addSection(title)`** — creates a new section object, pushes to `sections[]`, renders it, saves
- **`removeSection(sectionId)`** — removes section and all its tasks from today panel before deleting, saves
- **`toggleCollapse(sectionId)`** / **`applyCollapse(sectionId, collapsed)`** — hide/show task list, add-task row, progress bar, archive; update chevron icon
- **`cycleSectionColor(sectionId)`** — cycles through `SECTION_COLORS` palette (null → amber → green → blue → purple → tan → teal → terracotta → null)
- **`updateSectionTitle(sectionId, val)`** — debounce-free: saves on every keystroke

## Today Panel Operations

- **`addToToday(sectionId, taskId)`** — pushes a `todayItem` entry, adds `.in-today` left border to the board task, re-renders panel, saves
- **`removeFromToday(taskId)`** — filters out the entry, removes `.in-today` class, re-renders panel, saves
- **`syncTodayIndicator(taskId, inToday)`** — lightweight: just toggles `.in-today` on a single DOM element without re-rendering the whole panel
- **`syncAllTodayIndicators()`** — called after a full rerender to restore all `.in-today` borders

## Context Menu

Right-clicking a task shows a one-item context menu positioned at the cursor. The item label and action toggle based on `isInToday(taskId)`:
- "add to today" → `addToToday()`
- "remove from today" → `removeFromToday()`

The menu is repositioned via `requestAnimationFrame` after first paint to avoid overflow beyond the window edges.

The global `click` listener on `document` closes both the context menu and the settings panel when clicking outside them.

## Archive

- **`sweepDone(sectionId)`** — moves all `done` tasks from `sec.tasks` to `sec.archivedTasks`, removes their DOM elements, updates progress, saves, shows toast
- **`toggleArchive(sectionId)`** — toggles the archive list visibility; state tracked via `container.dataset.open`
- **`clearArchive(sectionId)`** — empties `archivedTasks`, re-renders the (now empty) archive toggle, saves

## Copy Board as Text

`copyBoardAsText()` serializes all sections and tasks to a Markdown-ish plain text format:

```
## Section Title
- [ ] open task
- [~] partial task  (note text)
- [x] done task
  - [ ] subtask
  - [x] done subtask
```

Uses `navigator.clipboard.writeText()` with a `textarea`-based fallback for WKWebView compatibility.
