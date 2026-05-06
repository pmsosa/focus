# Settings

The settings panel slides in from the right edge of the window. It is an overlay-based drawer (not a modal) — the `settings-overlay` captures clicks outside the panel to dismiss it.

## Opening / Closing

`openSettings()` adds `.open` to both `#settingsPanel` and `#settingsOverlay`, and calls `flushDevLog()` to display the latest log entries.

`closeSettings()` removes `.open` from both. The panel slides out via CSS `transform: translateX(100%)` transition.

The global click listener in `interactions.js` also calls `closeSettings()` whenever a click lands outside the panel and the settings button.

## Theme

Two themes are available:

| Name | Key | Style |
|---|---|---|
| Midnight Ember | `midnight-ember` | Dark brown/charcoal with amber accents |
| Terracotta Ceramics | `terracotta-ceramics` | Warm cream background with terracotta accents |

Themes are implemented as CSS `[data-theme="..."]` attribute selectors that override the `:root` CSS custom properties in `styles/base.css`. The active theme is set on `<body data-theme="...">` by `applySettings()`.

Theme-specific overrides appear throughout the CSS as `[data-theme="terracotta-ceramics"] .some-class { ... }` rules. Most are for elements that use hard-coded colors rather than CSS variables (e.g. today panel text colors).

## Font

Five monospace fonts are available (all loaded from Google Fonts):

- DM Mono (default)
- JetBrains Mono
- IBM Plex Mono
- Space Mono
- Fira Code

Font is applied via the dynamic `<style>` tag injected by `applyDynamicStyles()`, which overrides `font-family` on `body`, `input`, `button`, `textarea`, and all specific element classes. The static CSS in `styles/base.css` sets `--mono` as the default, but the dynamic style takes precedence.

## Font Size

Three sizes available: S (12px), M (13px, default), L (15px). Each maps to a full scale of 6 size values applied to different UI elements. See the size scale table in [storage.md](storage.md).

## Window Size

Four window sizes communicate with the Swift layer:

| Option | Key | Behavior |
|---|---|---|
| S | `small` | Compact floating window |
| M | `medium` | Default size |
| L | `large` | Wide layout |
| ⛶ | `fullscreen` | Fills screen |

The actual pixel dimensions are defined in Swift. JS only sends the size name via the `focusBridge` message handler.

## Data Section

- **Export backup** — downloads a JSON file with all data (see [storage.md](storage.md))
- **Import backup** — prompts a file picker, parses JSON, writes to localStorage, reloads

## Developer Log

The developer log is a live console capture visible in the settings panel. It intercepts `console.log`, `console.info`, `console.warn`, and `console.error` via IIFE in `utils.js`, and also catches `window.error` and `unhandledrejection` events.

Entries are stored in `devLogs[]` (max 300) and rendered as colored `<span>` elements on each update:
- log → green `#7ab878`
- info → blue `#78a8d4`
- warn → yellow `#d4a840`
- error → red `#d46858`

Format: `[HH:MM:SS] [LEVEL] message`

**Copy all** — copies the full log as plain text to clipboard.  
**Clear** — empties `devLogs[]` and re-renders the empty state.

The log is always scrolled to the bottom on update.
