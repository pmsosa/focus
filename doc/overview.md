# Focus — App Overview

Focus is a macOS menubar/floating-window task manager built as a native Swift app with a WKWebView UI. All visual logic lives in a single-page web app loaded from the app bundle.

## Architecture

```
Swift (AppDelegate / WindowController)
  └── WKWebView
        └── Sources/Focus/Resources/
              ├── index.html          ← HTML shell + script/style links
              ├── styles/             ← CSS split by concern
              │     ├── base.css      ← variables, reset, themes, body
              │     ├── layout.css    ← topbar, board, sections
              │     ├── tasks.css     ← tasks, checkboxes, subtasks
              │     ├── panels.css    ← today panel, archive, context menu
              │     └── settings.css  ← settings drawer, toast, dev log
              └── js/                 ← JavaScript split by concern
                    ├── state.js      ← global state & constants
                    ├── utils.js      ← uid, dates, dev log, escHtml, toast
                    ├── storage.js    ← settings, persistence, import/export
                    ├── render.js     ← all DOM rendering functions
                    ├── interactions.js ← mutations, event handlers
                    └── drag.js       ← drag & drop + boot sequence
```

## Swift ↔ JS Bridge

The Swift layer communicates with the web layer through WKWebView's message handler API:

- **`focusBridge`** — used by JS to send messages to Swift (e.g. `{ type: 'resize', size: 'medium' }` for window resizing)
- **`focusClose`** — used by JS to ask Swift to close/hide the window (triggered by Escape key)

The JS side uses `try { window.webkit.messageHandlers.X.postMessage(payload) } catch(_) {}` so it degrades gracefully when running outside the native app (e.g. in a browser for testing).

## Data Flow

All state lives in JavaScript memory and is persisted to `localStorage`. There is no server, no network calls (beyond Google Fonts), and no SQLite. The Swift layer does not own any app data — it only controls window geometry.

```
User action
  → JS mutation (interactions.js)
  → State update (sections[] / todayItems[])
  → DOM update (render.js)
  → localStorage save (storage.js → save())
```

On next launch, `loadSaved()` reads from `localStorage` and re-renders from scratch.

## JS Load Order

Scripts must load in this order because later files call functions defined in earlier ones:

1. `state.js` — declares globals (`sections`, `todayItems`, `undoStack`, etc.)
2. `utils.js` — pure helpers, no dependencies
3. `storage.js` — calls `renderSection`, `updateProgress`, etc. (render.js), and `findTask`, `rerenderTodayPanel`, etc.
4. `render.js` — calls `interactions.js` functions (`takeSnapshot`, `cycleState`, etc.) via inline event handlers, and `drag.js` helpers (`getDragAfterTask`)
5. `interactions.js` — calls render and storage functions
6. `drag.js` — wires DOM event listeners and runs the boot sequence (last file executed)

## Key Design Decisions

- **No framework.** Vanilla JS + CSS. Keeps the bundle tiny and WKWebView-compatible without a build step.
- **innerHTML for rendering.** Sections and tasks are rendered via `innerHTML` template strings. This is intentional — the DOM is cheap to rebuild and the app never has thousands of nodes.
- **localStorage as the database.** Three keys: `focus-v1` (sections), `focus-today-v1` (today items), `focus-settings-v1` (settings). Simple, zero-dependency, survives app restarts.
- **Two-column layout.** Sections alternate between two CSS grid columns (`board-col-0`, `board-col-1`) by index parity. No complex masonry library needed.
