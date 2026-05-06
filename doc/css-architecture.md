# CSS Architecture

All styles are split across five files in `styles/`. They must load in this order (as they appear in `index.html`):

1. `base.css` — custom properties + reset + themes
2. `layout.css` — topbar + board + sections
3. `tasks.css` — tasks + progress
4. `panels.css` — today panel + archive + context menu
5. `settings.css` — settings drawer + toast + dev log

## CSS Custom Properties

All design tokens are defined in `:root` in `base.css` and overridden per-theme via `[data-theme="..."]` selectors.

### Color tokens

| Variable | Purpose |
|---|---|
| `--bg` | Page/window background |
| `--surface` | Section card background |
| `--surface-2` | Hover background, input/button fills |
| `--border` | Default border color |
| `--border-light` | Slightly lighter border (hover states) |
| `--text` | Primary text |
| `--text-muted` | Secondary text (dates, labels) |
| `--text-dim` | Tertiary text (placeholders, disabled) |
| `--accent` | Primary accent (amber / terracotta) |
| `--accent-soft` | Transparent accent for background fills |
| `--done-color` | Done-state green |
| `--half-color` | Partial-state tan |
| `--ctx-bg` | Context menu background |
| `--settings-bg` | Settings panel background |

### Today panel tokens

The today panel has its own sub-palette because it uses a distinctly darker background in Midnight Ember:

| Variable | Purpose |
|---|---|
| `--today-bg` | Panel background |
| `--today-surface` | Hover background within panel |
| `--today-border` | Panel left border |
| `--today-accent` | Panel accent (gold / terracotta) |
| `--today-accent-soft` | Transparent today accent |
| `--today-divider` | Divider lines within panel |
| `--today-header-gradient` | Subtle gradient on panel header |

### Staleness tokens

| Variable | Meaning |
|---|---|
| `--staleness-1` | Amber — task in today for ≥1 day |
| `--staleness-3` | Orange — ≥3 days |
| `--staleness-7` | Red — ≥7 days |

### Layout tokens

| Variable | Value | Purpose |
|---|---|---|
| `--radius` | `16px` | Window and section border radius |
| `--mono` | `'DM Mono', monospace` | Default font (overridden by dynamic styles) |
| `--serif` | `'Instrument Serif', Georgia, serif` | Display font for logos and titles |
| `--font-size` | `13px` | Base font size (overridden by dynamic styles) |

## Theming

Themes override the `:root` variables. Most color logic is variable-driven, so themes work with zero additional rules for most elements.

Some elements have hard-coded colors (particularly in `panels.css` for today items) because they require specific opacity values that don't translate well to CSS variables. These get explicit `[data-theme="terracotta-ceramics"]` overrides.

The dynamic `<style id="focus-dynamic-styles">` injected by JavaScript overrides fonts and size-scale values. It has higher specificity than any of the static stylesheets because it is injected later, not because it uses `!important`.

## Animations

Two animations are defined:

**`fadeUp`** (in `layout.css`) — section cards fade in with a slight upward translate when added:
```css
@keyframes fadeUp {
  from { opacity: 0; transform: translateY(8px); }
  to   { opacity: 1; transform: translateY(0); }
}
```

**`softPulse`** (in `tasks.css`) — focused sections pulse with a faint accent shadow:
```css
@keyframes softPulse {
  0%, 100% { box-shadow: 0 0 0 0 rgba(200,169,126,0); }
  50%       { box-shadow: 0 0 0 3px rgba(200,169,126,0.07); }
}
.section:focus-within { animation: softPulse 2s ease infinite; }
```

**`ctxIn`** (in `panels.css`) — context menu scales and fades in:
```css
@keyframes ctxIn {
  from { opacity: 0; transform: scale(0.96) translateY(-2px); }
  to   { opacity: 1; transform: scale(1) translateY(0); }
}
```

## WKWebView-specific CSS

- `body` uses `border-radius: var(--radius)` — WKWebView renders the window with this radius applied, giving the rounded-corner look.
- `-webkit-app-region: drag` on `.topbar` makes it draggable as a native window drag handle.
- `-webkit-app-region: no-drag` on `.topbar-right` restores click interactivity within the drag region.
- `-webkit-user-drag: element` on `.section-drag-handle` enables the element as a native drag source in WebKit.
- `::-webkit-scrollbar` rules provide a slim 4px track-less scrollbar throughout.
- `-webkit-font-smoothing: antialiased` on `body` applies macOS subpixel-free rendering.

## Scrollbar

A uniform thin scrollbar is applied globally:
```css
::-webkit-scrollbar { width: 4px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: var(--border); border-radius: 2px; }
```

This applies to the board scroll area, today list, done list, archive list, settings body, and dev log.
