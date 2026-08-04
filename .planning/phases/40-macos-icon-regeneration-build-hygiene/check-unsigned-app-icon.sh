#!/usr/bin/env bash
# D-05 phase check (Plan 40-01): prove the packaged .app icon metadata against
# a fresh unsigned build by reusing the release script's existing icon-check
# logic verbatim (extract-and-eval, never copy, never source).
#
# Hard constraints:
# - NEVER source scripts/macos-release.sh (it ends with an unconditional
#   `main "$@"` that would execute the full signed-release CLI).
# - NEVER run codesign/spctl/stapler — only the Info.plist/bundled-icon
#   portion of verify_app is in scope for the unsigned UAT bundle.
# - NEVER modify scripts/macos-release.sh (D-06); the icon-check lines are
#   extracted from it at runtime via a sed range so the checked logic cannot
#   silently drift from release preflight.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd -P)"
RELEASE_SCRIPT="$REPO_ROOT/scripts/macos-release.sh"

# Optional app-bundle path argument; default resolves relative to repo root.
app_path="${1:-app/src-tauri/target/release/bundle/macos/EFX Motion Editor.app}"
case "$app_path" in
  /*) ;;
  *) app_path="$REPO_ROOT/$app_path" ;;
esac

die() {
  printf 'ERROR: %s\n' "$*" >&2
  exit 1
}

PLUTIL=/usr/bin/plutil

[[ -f "$RELEASE_SCRIPT" ]] || die "Release script not found: $RELEASE_SCRIPT"

# Extract the exact icon-check lines from verify_app at runtime: the range
# starts at the CFBundleIconFile plutil extraction line and ends at the
# "icns magic bytes" die line (icon lines only — no PRODUCT_VERSION plumbing).
icon_check_block="$(/usr/bin/sed -n '/CFBundleIconFile raw/,/icns magic bytes/p' "$RELEASE_SCRIPT")"
[[ -n "$icon_check_block" ]] || die "Could not extract the icon-check block from scripts/macos-release.sh"

check_packaged_icon() {
  local app_path="$1"
  local info_plist="$app_path/Contents/Info.plist"
  [[ -f "$info_plist" ]] || die "App bundle is missing Contents/Info.plist"
  local icon_file
  eval "$icon_check_block"
  printf 'PASS: %s declares CFBundleIconFile=%s; bundled resource Contents/Resources/%s exists, is non-empty, and starts with the icns magic bytes\n' \
    "$app_path/Contents/Info.plist" "$icon_file" "$icon_file"
}

check_packaged_icon "$app_path"
