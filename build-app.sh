#!/bin/bash
set -e

if [ -f .env ]; then
  set -a
  source .env
  set +a
fi

SIGN=false
MAS=false

for arg in "$@"; do
  case $arg in
    --sign) SIGN=true ;;
    --mas)  MAS=true ;;
  esac
done

BUNDLE_ID="com.focus.app"
PRODUCT_NAME="Focus"
VERSION="1.0"
DIST="$(pwd)/dist"
APP="$DIST/$PRODUCT_NAME.app"

# ── Helpers ────────────────────────────────────────────────────────────
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

  echo "==> Signing for Mac App Store..."
  codesign --deep --force \
    --sign "3rd Party Mac Developer Application: $APPLE_TEAM_ID" \
    --entitlements "$ENTITLEMENTS" \
    "$APP"

  PKG_PATH="$DIST/${PRODUCT_NAME}-${VERSION}.pkg"
  echo "==> Creating and signing MAS PKG..."
  productbuild --component "$APP" /Applications \
    --sign "3rd Party Mac Developer Installer: $APPLE_TEAM_ID" \
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

  echo "==> Signing app bundle..."
  codesign --deep --force --options runtime \
    --sign "Developer ID Application: $APPLE_TEAM_ID" \
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
