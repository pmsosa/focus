# Data Model

All data is held in JavaScript memory and persisted to `localStorage`. There are three top-level data structures.

## sections[]

The primary state. An array of section objects, ordered by display order (index 0 = first section created, alternating columns by parity).

```js
{
  id: string,          // 7-char random base-36 uid, e.g. "a3f9k2m"
  title: string,       // section name shown in the header input
  collapsed: boolean,  // whether the task list is collapsed
  color: string|null,  // accent dot color (hex) or null for no color
  tasks: Task[],       // ordered list of active tasks
  archivedTasks: ArchivedTask[]  // swept-done tasks (read-only display)
}
```

### Task

```js
{
  id: string,       // 7-char uid
  text: string,     // task label
  state: 'none' | 'half' | 'done',
  note: string,     // optional italic note shown below the task text
  subtasks: Subtask[]
}
```

### Subtask

```js
{
  id: string,   // 7-char uid
  text: string,
  done: boolean
}
```

### ArchivedTask

Same shape as `Task` plus one extra field:

```js
{
  ...Task,
  archivedDate: string  // 'YYYY-MM-DD', set when swept
}
```

## todayItems[]

A flat list of task references pinned to the Today panel. Tasks live in `sections[]` and today items just point to them.

```js
{
  taskId: string,     // references Task.id in sections[]
  sectionId: string,  // references Section.id (used to look up section title)
  addedDate: string   // 'YYYY-MM-DD', used to calculate staleness
}
```

**Day rollover:** On app launch, if `focus-last-date` in localStorage differs from today's date, any today items whose referenced task is `done` are removed. Incomplete tasks carry over automatically.

**Staleness:** Days since `addedDate` are computed by `daysSince()` and mapped to CSS classes `s1` (≥1 day, amber), `s3` (≥3 days, orange), `s7` (≥7 days, red) shown as a `+N` badge in the Today panel.

## appSettings

```js
{
  theme: 'midnight-ember' | 'terracotta-ceramics',
  font: 'DM Mono' | 'JetBrains Mono' | 'IBM Plex Mono' | 'Space Mono' | 'Fira Code',
  fontSize: 12 | 13 | 15,
  windowSize: 'small' | 'medium' | 'large' | 'fullscreen'
}
```

## localStorage Keys

| Key | Contents |
|---|---|
| `focus-v1` | `JSON.stringify(sections)` |
| `focus-today-v1` | `JSON.stringify(todayItems)` |
| `focus-settings-v1` | `JSON.stringify(appSettings)` |
| `focus-last-date` | `'YYYY-MM-DD'` string for rollover detection |

## ID Generation

`uid()` returns a 7-character random base-36 string: `Math.random().toString(36).slice(2, 9)`. Collision probability at typical task counts (~hundreds) is negligible.

## Undo / Redo

A snapshot-based system. Before any destructive mutation, `takeSnapshot()` serializes the entire `{ sections, todayItems }` state as a JSON string and pushes it onto `undoStack` (max 20 entries). `redoStack` is cleared on every new snapshot, and populated only when the user undoes.

Undo: pop from `undoStack`, push current state to `redoStack`, parse and restore.  
Redo: pop from `redoStack`, push current state to `undoStack`, parse and restore.

Keyboard: `⌘Z` undo, `⌘⇧Z` or `⌘Y` redo.
