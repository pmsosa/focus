#!/bin/bash
set -e

if [ -f .env ]; then
  set -a
  source .env
  set +a
fi

SIGN=false
MAS=false
DEV=false
RELEASE=false
DRAFT=false
BUMP=""

while [ $# -gt 0 ]; do
  case $1 in
    --sign)    SIGN=true ;;
    --mas)     MAS=true ;;
    --dev)     DEV=true ;;
    --release) RELEASE=true ;;
    --draft)   DRAFT=true ;;
    --bump)
      BUMP="$2"
      shift
      case "$BUMP" in
        major|minor|patch) ;;
        *) echo "Error: --bump requires major, minor, or patch."; exit 1 ;;
      esac
      ;;
    -h|--help)
      echo "Usage: ./build-app.sh [flag]"
      echo ""
      echo "  (no flag)  Build unsigned DMG — local testing only. Users will see an"
      echo "             'unidentified developer' warning."
      echo ""
      echo "  --dev      Build and run the app locally (no bundle/DMG)."
      echo ""
      echo "  --sign     Build signed + notarized DMG for distribution."
      echo "             Requires: APPLE_ID, APPLE_APP_SPECIFIC_PASSWORD, APPLE_TEAM_ID"
      echo ""
      echo "  --mas      Build Mac App Store PKG (signed with MAS certs)."
      echo "             Requires: APPLE_TEAM_ID, build/embedded.provisionprofile"
      echo "             Upload the resulting .pkg with the Transporter app."
      echo ""
      echo "  --release  Create a GitHub release for the current version and upload the"
      echo "             matching DMG from dist/ as a downloadable asset."
      echo "             Requires: gh CLI authenticated (gh auth login)."
      echo "             Add --draft to create the release as an unpublished draft."
      echo "             Build the DMG first (e.g. ./build-app.sh --sign)."
      echo "             Auto-bumps the patch version after a successful publish."
      echo ""
      echo "  --bump <part>  Bump the version in the VERSION file and exit."
      echo "             <part> is major, minor, or patch (e.g. --bump minor)."
      echo ""
      echo "  -h, --help Show this help message."
      exit 0
      ;;
  esac
  shift
done

BUNDLE_ID="com.focus.app"
PRODUCT_NAME="Focus"
VERSION_FILE="$(pwd)/VERSION"
VERSION="$(cat "$VERSION_FILE" 2>/dev/null | tr -d '[:space:]')"
if [ -z "$VERSION" ]; then
  echo "Error: no version found. Create a VERSION file (e.g. 'echo 1.0.0 > VERSION')."
  exit 1
fi
DIST="$(pwd)/dist"
APP="$DIST/$PRODUCT_NAME.app"

# Bump a semver string ($1) by part ($2: major|minor|patch), print the result.
bump_version() {
  local v="$1" part="$2"
  local major minor patch
  IFS='.' read -r major minor patch <<< "$v"
  major=${major:-0}; minor=${minor:-0}; patch=${patch:-0}
  case "$part" in
    major) major=$((major + 1)); minor=0; patch=0 ;;
    minor) minor=$((minor + 1)); patch=0 ;;
    patch) patch=$((patch + 1)) ;;
  esac
  echo "${major}.${minor}.${patch}"
}

# ── Bump only ──────────────────────────────────────────────────────────
if [ -n "$BUMP" ]; then
  NEW_VERSION="$(bump_version "$VERSION" "$BUMP")"
  echo "$NEW_VERSION" > "$VERSION_FILE"
  echo "==> Bumped version: $VERSION -> $NEW_VERSION"
  exit 0
fi

# ── Helpers ────────────────────────────────────────────────────────────
# Resolve a signing identity's full common name from the keychain by matching
# a cert-type prefix ($1, e.g. "Developer ID Application") and the team ID.
# codesign/productbuild match on the common name, and the bare team ID is
# ambiguous when several cert types share it — so we resolve the exact name.
resolve_identity() {
  local prefix="$1"
  security find-identity -v \
    | grep "$prefix" | grep "$APPLE_TEAM_ID" \
    | head -1 \
    | sed -E 's/^[^"]*"(.*)"[^"]*$/\1/'
}

make_dmg() {
  local dmg_path="$1"
  local staging
  staging=$(mktemp -d)
  cp -r "$APP" "$staging/"
  ln -s /Applications "$staging/Applications"
  hdiutil create -volname "$PRODUCT_NAME" \
    -srcfolder "$staging" \
    -ov -format UDZO \
    "$dmg_path"
  rm -rf "$staging"
}

make_entitlements() {
  local path="$1"
  local sandbox="$2"
  mkdir -p "$(dirname "$path")"
  cat > "$path" << EOENT
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
EOENT
  if [ "$sandbox" = true ]; then
    cat >> "$path" << 'EOENT'
    <key>com.apple.security.app-sandbox</key>
    <true/>
EOENT
  else
    cat >> "$path" << 'EOENT'
    <key>com.apple.security.cs.allow-jit</key>
    <true/>
EOENT
  fi
  cat >> "$path" << 'EOENT'
    <key>com.apple.security.network.client</key>
    <true/>
    <key>com.apple.security.files.user-selected.read-write</key>
    <true/>
</dict>
</plist>
EOENT
}

# ── GitHub release ─────────────────────────────────────────────────────
if [ "$RELEASE" = true ]; then
  TAG="v${VERSION}"
  DMG_PATH="$DIST/${PRODUCT_NAME}-${VERSION}.dmg"

  if [ ! -f "$DMG_PATH" ]; then
    echo "Error: DMG not found at $DMG_PATH"
    echo "  Build it first with: ./build-app.sh --sign"
    exit 1
  fi

  if git rev-parse "$TAG" >/dev/null 2>&1; then
    echo "Error: tag $TAG already exists. Bump VERSION or delete the tag."
    exit 1
  fi

  DRAFT_FLAG=""
  if [ "$DRAFT" = true ]; then
    DRAFT_FLAG="--draft"
    echo "==> Creating DRAFT release $TAG..."
  else
    echo "==> Creating release $TAG..."
  fi

  gh release create "$TAG" "$DMG_PATH" \
    --title "${PRODUCT_NAME} ${VERSION}" \
    --generate-notes \
    $DRAFT_FLAG

  NEXT_VERSION="$(bump_version "$VERSION" patch)"
  echo "$NEXT_VERSION" > "$VERSION_FILE"
  echo "==> Released $TAG. Bumped VERSION to $NEXT_VERSION for the next build."
  echo "    Commit the VERSION bump when you're ready: git add VERSION && git commit -m \"chore: bump to $NEXT_VERSION\""
  exit 0
fi

# ── Dev run ────────────────────────────────────────────────────────────
if [ "$DEV" = true ]; then
  echo "==> Building and running Focus (dev)..."
  swift build -c release
  exec .build/release/Focus
fi

# ── Build ──────────────────────────────────────────────────────────────
echo "==> Building Focus..."
swift build -c release

BINARY=".build/release/Focus"
BUNDLE=".build/release/Focus_Focus.bundle"

# ── Assemble .app bundle ───────────────────────────────────────────────
echo "==> Assembling $PRODUCT_NAME.app..."
rm -rf "$APP"
mkdir -p "$APP/Contents/MacOS"
mkdir -p "$APP/Contents/Resources"
mkdir -p "$DIST"

cp "$BINARY" "$APP/Contents/MacOS/$PRODUCT_NAME"
cp -r "$BUNDLE" "$APP/Contents/Resources/"

CATEGORY_KEY=""
if [ "$MAS" = true ]; then
  CATEGORY_KEY="
    <key>LSApplicationCategoryType</key>
    <string>public.app-category.productivity</string>"
fi

cat > "$APP/Contents/Info.plist" << EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>CFBundleName</key>
    <string>$PRODUCT_NAME</string>
    <key>CFBundleDisplayName</key>
    <string>$PRODUCT_NAME</string>
    <key>CFBundleIdentifier</key>
    <string>$BUNDLE_ID</string>
    <key>CFBundleVersion</key>
    <string>$VERSION</string>
    <key>CFBundleShortVersionString</key>
    <string>$VERSION</string>
    <key>CFBundleExecutable</key>
    <string>$PRODUCT_NAME</string>
    <key>CFBundlePackageType</key>
    <string>APPL</string>
    <key>LSUIElement</key>
    <true/>
    <key>NSHighResolutionCapable</key>
    <true/>
    <key>LSMinimumSystemVersion</key>
    <string>13.0</string>$CATEGORY_KEY
</dict>
</plist>
EOF

# ── MAS ────────────────────────────────────────────────────────────────
if [ "$MAS" = true ]; then
  if [ -z "$APPLE_TEAM_ID" ]; then
    echo "Error: --mas requires APPLE_TEAM_ID to be set."
    echo "  export APPLE_TEAM_ID=XXXXXXXXXX"
    exit 1
  fi
  if [ ! -f "build/embedded.provisionprofile" ]; then
    echo "Error: --mas requires build/embedded.provisionprofile"
    echo "  Download from Apple Developer portal and place at build/embedded.provisionprofile"
    exit 1
  fi

  cp "build/embedded.provisionprofile" "$APP/Contents/embedded.provisionprofile"

  ENTITLEMENTS="build/mas.entitlements"
  if [ ! -f "$ENTITLEMENTS" ]; then
    echo "==> Generating $ENTITLEMENTS (sandbox + network)..."
    make_entitlements "$ENTITLEMENTS" true
    echo "    Review $ENTITLEMENTS before submitting."
  fi

  # Modern MAS uses "Apple Distribution"; older setups use "3rd Party Mac
  # Developer Application". Try the modern name first, fall back to the legacy.
  APP_SIGN_ID="$(resolve_identity "Apple Distribution")"
  if [ -z "$APP_SIGN_ID" ]; then
    APP_SIGN_ID="$(resolve_identity "3rd Party Mac Developer Application")"
  fi
  INSTALLER_SIGN_ID="$(resolve_identity "3rd Party Mac Developer Installer")"
  if [ -z "$INSTALLER_SIGN_ID" ]; then
    INSTALLER_SIGN_ID="$(resolve_identity "Apple Distribution Installer")"
  fi
  if [ -z "$APP_SIGN_ID" ] || [ -z "$INSTALLER_SIGN_ID" ]; then
    echo "Error: missing MAS signing identities for team $APPLE_TEAM_ID."
    echo "  Need an app-signing cert (Apple Distribution / 3rd Party Mac Developer Application)"
    echo "  and an installer cert (3rd Party Mac Developer Installer / Apple Distribution Installer)."
    echo "  Available identities:"
    security find-identity -v | sed 's/^/    /'
    exit 1
  fi

  echo "==> Signing for Mac App Store as: $APP_SIGN_ID"
  codesign --deep --force \
    --sign "$APP_SIGN_ID" \
    --entitlements "$ENTITLEMENTS" \
    "$APP"

  PKG_PATH="$DIST/${PRODUCT_NAME}-${VERSION}.pkg"
  echo "==> Creating and signing MAS PKG as: $INSTALLER_SIGN_ID"
  productbuild --component "$APP" /Applications \
    --sign "$INSTALLER_SIGN_ID" \
    "$PKG_PATH"

  echo ""
  echo "==> Done. Upload $PKG_PATH using the Transporter app."

# ── Signed DMG ────────────────────────────────────────────────────────
elif [ "$SIGN" = true ]; then
  if [ -z "$APPLE_ID" ] || [ -z "$APPLE_APP_SPECIFIC_PASSWORD" ] || [ -z "$APPLE_TEAM_ID" ]; then
    echo "Error: --sign requires APPLE_ID, APPLE_APP_SPECIFIC_PASSWORD, and APPLE_TEAM_ID to be set."
    echo "  export APPLE_ID=your@email.com"
    echo "  export APPLE_APP_SPECIFIC_PASSWORD=xxxx-xxxx-xxxx-xxxx"
    echo "  export APPLE_TEAM_ID=XXXXXXXXXX"
    exit 1
  fi

  ENTITLEMENTS="build/app.entitlements"
  if [ ! -f "$ENTITLEMENTS" ]; then
    echo "==> Generating $ENTITLEMENTS (hardened runtime)..."
    make_entitlements "$ENTITLEMENTS" false
    echo "    Review $ENTITLEMENTS before submitting."
  fi

  SIGN_ID="$(resolve_identity "Developer ID Application")"
  if [ -z "$SIGN_ID" ]; then
    echo "Error: no 'Developer ID Application' identity for team $APPLE_TEAM_ID found in your keychain."
    echo "  Available identities:"
    security find-identity -v -p codesigning | sed 's/^/    /'
    exit 1
  fi

  echo "==> Signing app bundle as: $SIGN_ID"
  codesign --deep --force --options runtime \
    --sign "$SIGN_ID" \
    --entitlements "$ENTITLEMENTS" \
    "$APP"

  DMG_PATH="$DIST/${PRODUCT_NAME}-${VERSION}.dmg"
  echo "==> Creating DMG..."
  make_dmg "$DMG_PATH"

  echo "==> Notarizing DMG..."
  xcrun notarytool submit "$DMG_PATH" \
    --apple-id "$APPLE_ID" \
    --password "$APPLE_APP_SPECIFIC_PASSWORD" \
    --team-id "$APPLE_TEAM_ID" \
    --wait

  echo "==> Stapling DMG..."
  xcrun stapler staple "$DMG_PATH"

  echo ""
  echo "==> Done. Output: $DMG_PATH"

# ── Unsigned DMG ──────────────────────────────────────────────────────
else
  DMG_PATH="$DIST/${PRODUCT_NAME}-${VERSION}.dmg"
  echo "==> Creating unsigned DMG (local testing only)..."
  make_dmg "$DMG_PATH"

  echo ""
  echo "==> Done. Output: $DMG_PATH"
  echo "    Note: users will see an 'unidentified developer' warning."
  echo "    Run with --sign to build a notarized DMG for distribution."
fi
