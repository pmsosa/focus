# Contributing to focus.

Thanks for your interest. focus. is intentionally small — contributions that keep it that way are most welcome.

---

## Philosophy

The goal is a tool that feels like a piece of paper, not a project management system. Before proposing a feature, ask: would this exist on a notepad? If it needs an explanation, it's probably too much. Bug fixes, performance improvements, and polish are always fair game.

---

## Getting started

```bash
git clone https://github.com/yourusername/focus.git
cd focus
swift run
```

The app launches with a menu bar icon. ⌥ Space opens the panel.

There is no test suite right now — the UI is simple enough that manual testing is the primary workflow. If you add something non-trivial on the Swift side, please include basic error handling and note any edge cases in your PR.

---

## What's in scope

- Bug fixes
- macOS version compatibility
- Accessibility improvements (VoiceOver, keyboard nav)
- Performance or memory issues
- UI polish that doesn't add complexity

## What's out of scope

- Sync, cloud storage, or accounts
- Reminders, due dates, or calendar integration
- Themes or customization settings
- Mobile / cross-platform ports

If you're unsure whether something fits, open an issue to discuss before building it.

---

## Making a change

1. Fork the repo and create a branch: `git checkout -b your-change`
2. Make your changes — keep them focused and minimal
3. Test manually: `swift run`, open the panel, exercise the relevant paths
4. Open a pull request with a short description of what and why

---

## Code style

- Swift: follow the existing patterns — AppKit, no SwiftUI, no third-party dependencies
- JS/CSS: vanilla only, no frameworks or build steps
- Comments only where the *why* is non-obvious
- Keep files short — if something needs a wall of code, reconsider the approach

---

## Reporting bugs

Open a GitHub issue with:
- macOS version
- Steps to reproduce
- What you expected vs. what happened

---

## License

By contributing you agree your code will be released under the [BSD 3-Clause License](LICENSE).
