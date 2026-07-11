# focus.

A lightweight macOS task dashboard that lives in your menu bar. Press **⌥ Space** anywhere to open it.

![focus screenshot](docs/screenshot.png)

---

## What it is

focus. is a section-based to-do app inspired by the way a lot of people actually work — not kanban pipelines, but a sheet of paper split into domains. You have Operations tasks, People tasks, Product tasks — each lives in its own column, not in a shared "in progress" lane.

**Key ideas:**
- **Sections**, not pipelines — one column per context (project, team, domain)
- **Three-state tasks** — open → partial (with a "what's remaining" note) → done
- **Subtasks** for when a task has moving parts
- **Today & past-week panels** — pull tasks into a focused "today" list, then look back on the last 7 days of what you finished
- **⌥ Space** to open and close from anywhere — no Dock icon, no context switch
- **Fully local & private** — everything is saved on your machine (localStorage); no accounts, no network requests, no telemetry

---

## Requirements

- macOS 13 (Ventura) or later
- Xcode command line tools (`xcode-select --install`)

---

## Running locally

```bash
git clone https://github.com/yourusername/focus.git
cd focus
swift run
```

The app will appear as a checkmark icon in your menu bar. Press ⌥ Space to open the panel.

---

## Building a distributable

```bash
./build-app.sh              # unsigned DMG — for local use / testing
./build-app.sh --sign       # signed + notarized DMG — direct distribution outside App Store
./build-app.sh --mas        # signed PKG — Mac App Store via Transporter
```

**For `--sign` and `--mas`**, set these in your environment or a `.env` file:

```
APPLE_ID=your@email.com
APPLE_APP_SPECIFIC_PASSWORD=xxxx-xxxx-xxxx-xxxx
APPLE_TEAM_ID=XXXXXXXXXX
```

The MAS build additionally requires a provisioning profile at `build/embedded.provisionprofile`, downloaded from the Apple Developer portal.

---

## Project structure

```
Sources/Focus/
  main.swift            app entry point
  AppDelegate.swift     menu bar icon, About dialog
  FocusWindow.swift     floating panel + WKWebView
  GlobalHotkey.swift    ⌥ Space via Carbon API
  Resources/
    index.html          UI markup + panel layout
    js/                 vanilla JS — state, storage, render, interactions, drag
    styles/             CSS — base, layout, tasks, panels, settings, fonts
    fonts/              self-hosted woff2 (SIL OFL) — no external font CDN
build-app.sh            build script (unsigned / signed / MAS)
```

The UI is vanilla HTML/CSS/JS rendered inside a native `WKWebView` — no JavaScript framework and no build step. Fonts are bundled locally, so the app makes no network requests and works fully offline.

---

## License

PolyForm Noncommercial License 1.0.0 — free for personal and other noncommercial use. See [LICENSE](LICENSE). Commercial use requires a separate license from the author. If you use this code, a credit is appreciated.
