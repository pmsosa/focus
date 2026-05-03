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
- **⌥ Space** to open and close from anywhere — no Dock icon, no context switch
- All data is **saved automatically** via localStorage

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
    index.html          all UI — HTML/CSS/JS with localStorage persistence
build-app.sh            build script (unsigned / signed / MAS)
```

The entire UI lives in a single `index.html` rendered inside a native `WKWebView`. There is no JavaScript framework or build step — just vanilla JS and CSS.

---

## License

BSD 3-Clause — see [LICENSE](LICENSE). If you use this code, a credit is appreciated.
