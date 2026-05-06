# Drag and Drop

Focus supports two types of drag: **task reorder** (within and across sections) and **section reorder** (between columns). There is also a **today panel drop target** for adding tasks by dragging.

## Shared State

`currentDrag` in `state.js` tracks the active drag operation:

```js
// task drag:
{ type: 'task', taskId: string, sectionId: string }

// section drag:
{ type: 'section', sectionId: string }

// no drag in progress:
null
```

## Task Drag

Tasks are draggable elements. The drag source is the `.task-item` div itself (set via `el.setAttribute('draggable', true)` in `renderTask`).

**dragstart** — sets `currentDrag`, serializes payload to `dataTransfer`, adds `.task-dragging` opacity class.

**Drop zones** — each section's `.task-list` is a drop zone, wired inside `renderSection`. Each task list maintains a private `_taskDropAfter` variable (closure scope) to cache the insertion position:

- `dragover`: calls `getDragAfterTask(container, clientY)` to find which task element the dragged item should be inserted before. Moves the `#task-drop-indicator` (a 2px accent line) to the correct position. Caches result in `_taskDropAfter`.
- `dragleave`: hides indicator, resets `_taskDropAfter` to `undefined`.
- `drop`: reads the cached `_taskDropAfter` (not `clientY` — that's unreliable in WKWebView's drop event), splices the task from the source section to the target section at the correct index, calls `rerenderTaskList` on affected sections, updates progress, saves.

`_taskDropAfter === null` means "append to end". `_taskDropAfter === undefined` means "not over this list" (drop should be ignored).

**dragend** — cleans up class and `currentDrag` regardless of whether drop succeeded.

## Section Drag

Section handles (`.section-drag-handle`, the braille ⠿ icon) are the drag source, not the full section card. This is a WKWebView workaround: WKWebView fires `mouseup` before `dragstart`, which can cancel the drag if the whole card is the source. Using the handle element avoids this.

**dragstart** — sets `currentDrag`, stops propagation to prevent board column from also seeing it.

**Drop zones** — each board column (`#board-col-0`, `#board-col-1`) is a drop zone, wired in `wireBoardReorder` in `drag.js`. Same pattern as task drop zones: `_sectionDropAfter` cache, `#section-drop-indicator` visual line.

**drop** — splices the section in `sections[]` to the new position (determined by the target column's DOM order), then calls `fullRerender()` to rebuild the entire board with corrected column assignments.

## Position Calculation

`getDragAfterTask(container, y)` and `getDragAfterSection(col, y)` use the same reduce pattern:

```js
els.reduce((closest, child) => {
  const box = child.getBoundingClientRect();
  const offset = y - box.top - box.height / 2;
  if (offset < 0 && offset > closest.offset) return { offset, element: child };
  return closest;
}, { offset: Number.NEGATIVE_INFINITY }).element ?? null
```

This finds the first element whose midpoint is below the cursor position `y`. If no such element exists (cursor is below all elements), returns `null` (= append to end).

## Today Panel Drop

The today panel is a drop target only for tasks (not sections). Wired as an IIFE in `drag.js`.

- `dragover`: adds `.drop-target` visual highlight to the panel border
- `dragleave`: removes highlight
- `drop`: parses `dataTransfer` payload (since `currentDrag` may have been cleared), calls `addToToday(sectionId, taskId)`

Uses `dataTransfer.getData()` rather than `currentDrag` as a fallback because WKWebView occasionally delivers drop events after `dragend` has already cleared `currentDrag`.

## Drop Indicator Elements

`#task-drop-indicator` and `#section-drop-indicator` are two singleton `div` elements in the HTML. They are physically moved in the DOM to show the insertion point during drag. 

`rescueIndicators()` (called at the top of `fullRerender` and `rerenderTaskList`) moves them back to `document.body` before clearing column/list innerHTML — otherwise `innerHTML = ''` would destroy them.
