# Today Panel

The Today panel is a persistent right sidebar showing a curated daily task list. It is not a separate data store — it holds references to tasks that live in the board sections.

## Data Structure

Each entry in `todayItems[]` is:

```js
{ taskId: string, sectionId: string, addedDate: 'YYYY-MM-DD' }
```

`sectionId` is stored so the section title can be shown as the source label beneath each task, even without traversing `sections[]` every render (though in practice `findTask` does traverse).

## Adding and Removing

**Via right-click (context menu):**  
Right-clicking any board task shows a one-item context menu. If the task is not in today, it shows "+ add to today". If it is, it shows "— remove from today".

**Via keyboard:**  
`⌘D` on a focused task toggles it in/out of the today panel.

**Via drag and drop:**  
Dragging a task card from the board and dropping it onto the today panel adds it to today.

**Visual indicator:**  
Board tasks that are in today get a left border: `border-left: 2px solid rgba(210,165,90,0.4)` (`.in-today` class). This is applied/removed by `syncTodayIndicator()`, which does a targeted DOM query rather than a full re-render.

## Rendering

`rerenderTodayPanel()` fully rebuilds the panel content. It splits `todayItems` into:

- **active** — tasks where `state !== 'done'`, shown in the scrollable main list
- **done** — tasks where `state === 'done'`, shown in a collapsible "done" sub-section at the bottom

The "done" section has a count badge and is hidden by default, toggled by `toggleTodayDone()`.

The badge at the top of the panel shows:
- Nothing when there are no today items
- `"N left"` when there are active items
- `"all done"` when all items are done

## Staleness

Each today item shows a day counter (`+1`, `+3`, `+7`) when the task has been in the panel for more than 0 days. This is computed by `daysSince(ti.addedDate)` on every render.

The counter uses CSS classes for color intensity:
- `.s1` (≥1 day) — amber `#c8943a`
- `.s3` (≥3 days) — orange `#d4682a`
- `.s7` (≥7 days) — red `#c84030`

The counter is only shown for active (non-done) tasks.

## State Sync

The today panel renders its own checkbox for each task, wired to the same `cycleState` / `cycleStatePartial` functions as the board. When a task is checked off from the today panel, `setTaskState()` syncs the state back to the board task's DOM element (`data-state` on the board checkbox and text input), so both views stay consistent without a full re-render.

After any full re-render (`fullRerender`), `syncAllTodayIndicators()` restores the `.in-today` class on all board task elements.

## Day Rollover

On every app launch (during `loadSaved()`), `handleDayRollover()` checks whether the calendar date has changed since last launch:

1. Reads `focus-last-date` from localStorage
2. If it differs from today's date, filters `todayItems` to remove any entries whose task is `state === 'done'` (completed tasks do not carry over)
3. Writes today's date back to `focus-last-date`

Incomplete tasks (state `none` or `half`) carry over to the next day automatically.
