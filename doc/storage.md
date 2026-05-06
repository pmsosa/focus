# Storage & Persistence

Focus uses `localStorage` as its only persistence layer. There is no backend, no file system access, and no iCloud sync.

## localStorage Keys

| Key | Type | Description |
|---|---|---|
| `focus-v1` | JSON string | Serialized `sections[]` array |
| `focus-today-v1` | JSON string | Serialized `todayItems[]` array |
| `focus-settings-v1` | JSON string | Serialized `appSettings` object |
| `focus-last-date` | `'YYYY-MM-DD'` | Date of last app launch, used for rollover |

## Save

`save()` in `storage.js` is called after every mutation:

```js
localStorage.setItem('focus-v1', JSON.stringify(sections));
localStorage.setItem('focus-today-v1', JSON.stringify(todayItems));
```

There is no debounce. Every keystroke in a task input, every checkbox click, every drag drop — all call `save()` immediately. localStorage writes are synchronous and fast enough at these data sizes.

## Load

`loadSaved()` runs once at boot (called from `drag.js`). It:

1. Reads `focus-v1` from localStorage
2. Returns `false` if missing or empty (first launch — demo data is seeded instead)
3. Migrates any sections missing `archivedTasks` (adds empty array for backwards compatibility)
4. Calls `renderSection()` + `updateProgress()` + `renderArchiveToggle()` for each section
5. Reads and filters `focus-today-v1`, calls `handleDayRollover()`
6. Finishes with `updateEmptyState()`, `updateSummary()`, `rerenderTodayPanel()`, `syncAllTodayIndicators()`

## Settings

Settings are stored separately from board data so they survive an import without being overwritten.

`loadSettings()` is called before `loadSaved()` so the theme and font are applied before the board renders (avoids a flash of unstyled content).

`saveSettings()` is called any time a setting changes (`setTheme`, `setFont`, `setFontSize`, `setWindowSize`).

`applySettings()` applies the current `appSettings` to the DOM:
1. Sets `data-theme` on `<body>`
2. Calls `applyDynamicStyles()` to inject a `<style id="focus-dynamic-styles">` tag with font-family and size overrides
3. Calls `updateSettingsUI()` to mark the active option in the settings panel

**Dynamic styles** override the static CSS for font family and all font-size variants. The size map defines a coordinated scale:

| Setting | body | task | note | subtask | UI | tiny |
|---|---|---|---|---|---|---|
| S (12px) | 12 | 11 | 10 | 10.5 | 10 | 9 |
| M (13px) | 13 | 12 | 11 | 11.5 | 11 | 10 |
| L (15px) | 15 | 14 | 13 | 13.5 | 12.5 | 11.5 |

## Export / Import

**Export** (`exportData()`):
- Bundles `{ sections, todayItems, settings, exportedAt }` as JSON
- Creates a Blob, triggers a download via a temporary `<a>` element
- Filename: `focus-backup-YYYY-MM-DD.json`

**Import** (`importData(input)`):
- Reads the selected file as text with `FileReader`
- Validates that `data.sections` exists
- Writes each key directly to localStorage
- Calls `window.location.reload()` to re-initialize from the imported data

Import does a full page reload rather than a live state swap to avoid partial render state issues.

## Window Size

`setWindowSize(name)` sends a message to the Swift layer via `window.webkit.messageHandlers.focusBridge.postMessage({ type: 'resize', size: name })`. The Swift `WKScriptMessageHandler` receives this and resizes the window. The setting is stored in `appSettings` so the Swift layer can also read the last-used size on launch.

## Data Integrity Notes

- `loadSaved()` wraps everything in `try/catch` and returns `false` on any error. Corrupt localStorage is silently ignored and the demo seed data is shown instead.
- `importData()` validates `data.sections` exists before writing to localStorage. Other fields are written only if present.
- The undo/redo system snapshots the full `{ sections, todayItems }` state, so settings are not undoable (intentional — undo should not revert a theme change).
