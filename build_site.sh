#!/usr/bin/env bash
set -euo pipefail

# ─────────────────────────────────────────────────────────────
# focus. — marketing site + live in-browser demo build
#
# Produces a single self-contained folder you can upload as-is to any static
# host (Netlify, Cloudflare Pages, GitHub Pages, S3, nginx, …):
#
#   site/            ← upload THIS whole folder
#   ├── index.html   ← marketing site (from website/)
#   ├── privacy.html
#   ├── support.html
#   ├── css/ assets/ ← its styles + logo
#   └── demo/        ← the real app UI, running backend-free (iframe src="demo/")
#
# The demo is just the app's own WKWebView front-end (Sources/Focus/Resources).
# Every native bridge call in that code is wrapped in try/catch, and all state
# lives in localStorage — so it runs unmodified in a plain browser, seeding the
# same sample board the real app shows on first launch.
#
# Usage: ./build_site.sh   then serve site/ (e.g. python3 -m http.server -d site)
# ─────────────────────────────────────────────────────────────

CYAN='\033[0;36m'; GREEN='\033[0;32m'; DIM='\033[2m'; BOLD='\033[1m'; RESET='\033[0m'
info() { echo -e "  ${DIM}$*${RESET}"; }
ok()   { echo -e "  ${GREEN}✔${RESET} $*"; }

cd "$(dirname "$0")"

WEBSITE="website"
RESOURCES="Sources/Focus/Resources"
OUT="site"

echo -e "\n${BOLD}${CYAN}focus. — site + demo build${RESET}\n"

[ -d "$WEBSITE" ]   || { echo "Error: $WEBSITE/ not found — run from the repo root."; exit 1; }
[ -d "$RESOURCES" ] || { echo "Error: $RESOURCES/ not found — run from the repo root."; exit 1; }

# ── 1. Marketing site ────────────────────────────────────────────────────────
info "Assembling $OUT/ from $WEBSITE/ …"
rm -rf "$OUT"
mkdir -p "$OUT"
cp -R "$WEBSITE/." "$OUT/"
ok "Marketing pages copied"

# ── 2. Live demo = the app's own front-end ───────────────────────────────────
info "Copying app UI into $OUT/demo/ …"
mkdir -p "$OUT/demo"
cp "$RESOURCES/index.html" "$OUT/demo/index.html"
cp -R "$RESOURCES/js"      "$OUT/demo/js"
cp -R "$RESOURCES/styles"  "$OUT/demo/styles"

# The native app draws a blurred window behind the (93%-opaque) UI. In a browser
# there is no blur layer, so give the demo a solid dark backdrop to match.
DEMO_BG='<style>html,body{background:#0f0e0e;}</style>'
# Insert the backdrop style just before </head> (portable in-place edit).
tmp="$(mktemp)"
awk -v ins="$DEMO_BG" '/<\/head>/ && !done { print ins; done=1 } { print }' \
  "$OUT/demo/index.html" > "$tmp" && mv "$tmp" "$OUT/demo/index.html"
ok "Demo bundled (backend-free, seeds sample board on first load)"

# ── 3. Done ──────────────────────────────────────────────────────────────────
echo ""
ok "Site ready → ${BOLD}$OUT/${RESET}"
echo -e "  ${DIM}Preview locally:${RESET}  python3 -m http.server -d $OUT 8000  ${DIM}→ http://localhost:8000${RESET}"
echo -e "  ${DIM}Deploy:${RESET}          upload the whole ${BOLD}$OUT/${RESET} folder to any static host."
