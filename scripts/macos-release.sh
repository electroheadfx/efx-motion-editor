#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd -P)"
TAURI_DIR="$REPO_ROOT/app/src-tauri"
CONFIG_PATH="$TAURI_DIR/tauri.conf.json"
TARGET_DIR="$TAURI_DIR/target"
PRODUCT_NAME="EFX Motion Editor"
PRODUCT_VERSION="0.8.0"
PRODUCT_IDENTIFIER="com.efxlab.motion-editor"

CODESIGN=/usr/bin/codesign
SECURITY=/usr/bin/security
XCRUN=/usr/bin/xcrun
HDIUTIL=/usr/bin/hdiutil
SPCTL=/usr/sbin/spctl
XCODE_SELECT=/usr/bin/xcode-select
FIND=/usr/bin/find
GIT=/usr/bin/git
PLUTIL=/usr/bin/plutil

NODE_BIN=""
PNPM_BIN=""
MOUNT_POINT=""
VERIFIED_TEAM_ID=""

log() {
  printf '%s\n' "$*"
}

die() {
  printf 'ERROR: %s\n' "$*" >&2
  exit 1
}

usage() {
  cat <<'USAGE'
Usage:
  bash scripts/macos-release.sh preflight
  bash scripts/macos-release.sh release
  bash scripts/macos-release.sh verify-downloaded /absolute/path/to/downloaded.dmg
USAGE
}

require_executable() {
  local path="$1"
  [[ -x "$path" ]] || die "Required executable is missing: $path"
}

require_command() {
  local name="$1"
  local resolved
  resolved="$(command -v "$name" 2>/dev/null || true)"
  [[ -n "$resolved" ]] || die "Required command is missing from PATH: $name"
  printf '%s\n' "$resolved"
}

is_private_asset_name() {
  local name lower
  name="${1##*/}"
  lower="$(printf '%s' "$name" | /usr/bin/tr '[:upper:]' '[:lower:]')"
  case "$lower" in
    *.p12|*.p8|*.key|id_rsa|id_rsa.*|id_ed25519|id_ed25519.*|*private*key*) return 0 ;;
    *) return 1 ;;
  esac
}

tracked_private_asset_exists() {
  local path
  while IFS= read -r -d '' path; do
    if is_private_asset_name "$path"; then
      return 0
    fi
  done < <("$GIT" -C "$REPO_ROOT" ls-files -z)
  return 1
}

worktree_private_asset_exists() {
  local path
  while IFS= read -r -d '' path; do
    if is_private_asset_name "$path"; then
      return 0
    fi
  done < <(
    "$FIND" "$REPO_ROOT" \
      \( -path "$REPO_ROOT/.git" -o -path '*/node_modules' \) -prune -o \
      -type f -print0
  )
  return 1
}

validate_tauri_config() {
  "$NODE_BIN" - "$CONFIG_PATH" "$TAURI_DIR" <<'NODE'
const fs = require('node:fs');
const path = require('node:path');
const [configPath, tauriDir] = process.argv.slice(2);
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
const fail = (message) => {
  console.error(`ERROR: Tauri release configuration drift: ${message}`);
  process.exit(1);
};

if (config.productName !== 'EFX Motion Editor') fail('productName must be EFX Motion Editor');
if (config.version !== '0.8.0') fail('version must be 0.8.0');
if (config.identifier !== 'com.efxlab.motion-editor') fail('identifier must be com.efxlab.motion-editor');
if (config.bundle?.macOS?.hardenedRuntime !== true) fail('bundle.macOS.hardenedRuntime must be true');
if (config.bundle?.macOS?.entitlements !== undefined) fail('bundle.macOS.entitlements must be absent');
if (config.bundle?.externalBin !== undefined) fail('bundle.externalBin must be absent');
if (!Array.isArray(config.bundle?.resources) || config.bundle.resources.length !== 1 || config.bundle.resources[0] !== 'resources/*') {
  fail('bundle.resources must contain only resources/*');
}

const resourcesDir = path.join(tauriDir, 'resources');
const regularFiles = fs.readdirSync(resourcesDir, { withFileTypes: true })
  .filter((entry) => entry.isFile())
  .map((entry) => entry.name)
  .sort();
if (regularFiles.length !== 1 || regularFiles[0] !== 'test-image.jpg') {
  fail('resources/* must match exactly the regular file resources/test-image.jpg');
}
NODE
}

run_preflight() {
  [[ "$(uname -s)" == "Darwin" ]] || die "macOS is required for Developer ID release verification"

  require_executable "$CODESIGN"
  require_executable "$SECURITY"
  require_executable "$XCRUN"
  require_executable "$HDIUTIL"
  require_executable "$SPCTL"
  require_executable "$XCODE_SELECT"
  require_executable "$FIND"
  require_executable "$GIT"
  require_executable "$PLUTIL"
  NODE_BIN="$(require_command node)"
  PNPM_BIN="$(require_command pnpm)"

  local developer_dir notarytool_path stapler_path
  developer_dir="$($XCODE_SELECT -p 2>/dev/null)" || die "No Apple developer directory is selected; install/select a current Apple toolchain"
  log "Selected Apple developer directory: $developer_dir"

  notarytool_path="$($XCRUN --find notarytool 2>/dev/null)" || die "notarytool is unavailable; install/select a current Apple toolchain"
  stapler_path="$($XCRUN --find stapler 2>/dev/null)" || die "stapler is unavailable; install/select a current Apple toolchain"
  [[ -x "$notarytool_path" ]] || die "xcrun resolved a non-executable notarytool"
  [[ -x "$stapler_path" ]] || die "xcrun resolved a non-executable stapler"
  log "Apple capability probes: codesign, security, notarytool, and stapler available"
  log "Full Xcode is not required when these capability probes succeed."

  validate_tauri_config

  if tracked_private_asset_exists; then
    die "Git tracks a private Apple signing/notarization asset; remove it from repository history before release"
  fi
  if worktree_private_asset_exists; then
    die "A private Apple signing/notarization asset exists inside the repository; move it outside the repository before release"
  fi

  log "Certificate setup distinction:"
  log "- New identity: obtain a Developer ID Application certificate through Apple Developer Certificates using a Keychain Access CSR; the locally generated private key must remain available in that keychain."
  log "- Existing identity: importing a .p12 only installs a previously issued certificate and matching private key; it does not issue a new Apple certificate."
  log "PREFLIGHT PASS: release configuration, Apple CLI capabilities, resources, and private-asset guards"
}

require_present_variable() {
  local name="$1"
  [[ -n "${!name:-}" ]] || die "Required environment variable is not set: $name"
}

resolve_real_path() {
  "$NODE_BIN" -e 'const fs=require("node:fs"); process.stdout.write(fs.realpathSync(process.argv[1]));' "$1"
}

require_release_credentials() {
  require_present_variable APPLE_SIGNING_IDENTITY
  require_present_variable APPLE_API_ISSUER
  require_present_variable APPLE_API_KEY
  require_present_variable APPLE_API_KEY_PATH

  [[ "$APPLE_API_KEY_PATH" == /* ]] || die "APPLE_API_KEY_PATH must be an absolute path"
  [[ -f "$APPLE_API_KEY_PATH" && -r "$APPLE_API_KEY_PATH" ]] || die "APPLE_API_KEY_PATH must reference a readable regular file"

  local key_real_path
  key_real_path="$(resolve_real_path "$APPLE_API_KEY_PATH")" || die "APPLE_API_KEY_PATH could not be resolved"
  case "$key_real_path" in
    "$REPO_ROOT"|"$REPO_ROOT"/*) die "APPLE_API_KEY_PATH must be outside the repository" ;;
  esac

  [[ "$APPLE_SIGNING_IDENTITY" == "Developer ID Application: "* ]] || die "APPLE_SIGNING_IDENTITY must name a Developer ID Application identity"

  local identities identity_count
  identities="$($SECURITY find-identity -v -p codesigning 2>/dev/null)" || die "Unable to query usable code-signing identities"
  identity_count="$(printf '%s\n' "$identities" | APPLE_SIGNING_IDENTITY="$APPLE_SIGNING_IDENTITY" "$NODE_BIN" -e '
    const fs = require("node:fs");
    const requested = process.env.APPLE_SIGNING_IDENTITY;
    const input = fs.readFileSync(0, "utf8");
    const names = [...input.matchAll(/^\s*\d+\)\s+[0-9A-F]+\s+"([^"]+)"/gm)].map((match) => match[1]);
    process.stdout.write(String(names.filter((name) => name === requested).length));
  ')"
  [[ "$identity_count" == "1" ]] || die "The requested Developer ID Application identity is absent or ambiguous in the usable codesigning identities"
}

expected_team_from_identity() {
  local team
  team="${APPLE_SIGNING_IDENTITY##*(}"
  team="${team%)}"
  [[ "$team" =~ ^[A-Z0-9]{10}$ ]] || die "APPLE_SIGNING_IDENTITY must end with a 10-character Apple Team ID in parentheses"
  printf '%s\n' "$team"
}

extract_and_verify_signature_metadata() {
  local artifact="$1"
  local require_runtime="$2"
  local expected_team="${3:-}"
  local metadata team

  metadata="$($CODESIGN --display --verbose=4 "$artifact" 2>&1)" || die "Unable to inspect code-signature metadata"
  team="$(printf '%s\n' "$metadata" | /usr/bin/grep '^TeamIdentifier=' | /usr/bin/cut -d= -f2-)"
  [[ "$team" =~ ^[A-Z0-9]{10}$ ]] || die "Signed artifact has no valid Apple TeamIdentifier"
  printf '%s\n' "$metadata" | /usr/bin/grep -Fq "Authority=Developer ID Application:" || die "Signed artifact is not signed by a Developer ID Application identity"
  printf '%s\n' "$metadata" | /usr/bin/grep -Fq "($team)" || die "Developer ID signing authority does not match TeamIdentifier"
  if [[ -n "$expected_team" && "$team" != "$expected_team" ]]; then
    die "Signed artifact TeamIdentifier does not match the requested Developer ID identity"
  fi
  if [[ "$require_runtime" == "true" ]]; then
    printf '%s\n' "$metadata" | /usr/bin/grep -Eq '^CodeDirectory .*flags=.*runtime' || die "App signature does not contain the Hardened Runtime flag"
  fi
  VERIFIED_TEAM_ID="$team"
}

verify_no_entitlements() {
  local app_path="$1"
  local entitlements_file json
  entitlements_file="$(/usr/bin/mktemp -t efx-motion-entitlements.XXXXXX)"
  if ! "$CODESIGN" --display --entitlements :- "$app_path" >"$entitlements_file" 2>/dev/null; then
    /bin/rm -f "$entitlements_file"
    die "Unable to extract app entitlements"
  fi

  if [[ -s "$entitlements_file" ]]; then
    json="$($PLUTIL -convert json -o - "$entitlements_file" 2>/dev/null)" || {
      /bin/rm -f "$entitlements_file"
      die "Extracted app entitlements are not a valid property list"
    }
    if ! printf '%s' "$json" | "$NODE_BIN" -e '
      const fs = require("node:fs");
      const value = JSON.parse(fs.readFileSync(0, "utf8"));
      if (!value || Array.isArray(value) || typeof value !== "object" || Object.keys(value).length !== 0) process.exit(1);
    '; then
      /bin/rm -f "$entitlements_file"
      die "App signature contains unexpected entitlement keys"
    fi
  fi
  /bin/rm -f "$entitlements_file"
}

verify_app() {
  local app_path="$1"
  local expected_team="$2"

  "$CODESIGN" --verify --deep --strict --verbose=2 "$app_path"
  extract_and_verify_signature_metadata "$app_path" true "$expected_team"

  local metadata
  metadata="$($CODESIGN --display --verbose=4 "$app_path" 2>&1)"
  printf '%s\n' "$metadata" | /usr/bin/grep -Fxq "Identifier=$PRODUCT_IDENTIFIER" || die "App signature identifier is not $PRODUCT_IDENTIFIER"

  verify_no_entitlements "$app_path"
  "$SPCTL" --assess --type execute --verbose=4 "$app_path"
  "$XCRUN" stapler validate "$app_path"
}

verify_dmg() {
  local dmg_path="$1"
  local expected_team="${2:-}"

  "$HDIUTIL" verify "$dmg_path"
  "$CODESIGN" --verify --strict --verbose=2 "$dmg_path"
  extract_and_verify_signature_metadata "$dmg_path" false "$expected_team"
  "$XCRUN" stapler validate "$dmg_path"
  "$SPCTL" --assess --type open --context context:primary-signature --verbose=4 "$dmg_path"
}

find_release_artifacts() {
  local -a apps=()
  local -a dmgs=()
  local path

  while IFS= read -r -d '' path; do apps+=("$path"); done < <(
    "$FIND" "$TARGET_DIR" -type d -path '*/release/bundle/macos/EFX Motion Editor.app' -print0 2>/dev/null
  )
  while IFS= read -r -d '' path; do dmgs+=("$path"); done < <(
    "$FIND" "$TARGET_DIR" -type f -path '*/release/bundle/dmg/*_0.8.0_*.dmg' -print0 2>/dev/null
  )

  [[ "${#apps[@]}" -eq 1 ]] || die "Expected exactly one v$PRODUCT_VERSION $PRODUCT_NAME.app release artifact, found ${#apps[@]}"
  [[ "${#dmgs[@]}" -eq 1 ]] || die "Expected exactly one v$PRODUCT_VERSION DMG release artifact, found ${#dmgs[@]}"
  RELEASE_APP="${apps[0]}"
  RELEASE_DMG="${dmgs[0]}"
}

submit_and_staple_dmg() {
  local dmg_path="$1"
  local evidence_dir submit_evidence log_evidence submission_id
  evidence_dir="$(dirname "$dmg_path")/notarization-evidence"
  /bin/mkdir -p "$evidence_dir"
  submit_evidence="$evidence_dir/dmg-submit.json"
  log_evidence="$evidence_dir/dmg-log.json"

  "$XCRUN" notarytool submit "$dmg_path" \
    --key "$APPLE_API_KEY_PATH" \
    --key-id "$APPLE_API_KEY" \
    --issuer "$APPLE_API_ISSUER" \
    --wait \
    --output-format json >"$submit_evidence"

  submission_id="$("$NODE_BIN" - "$submit_evidence" <<'NODE'
const fs = require('node:fs');
const result = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
if (result.status !== 'Accepted' || typeof result.id !== 'string' || result.id.length === 0) {
  console.error(`ERROR: DMG notarization was not accepted (status: ${result.status ?? 'unknown'}, submission: ${result.id ?? 'unknown'})`);
  process.exit(1);
}
process.stdout.write(result.id);
NODE
  )"

  "$XCRUN" notarytool log "$submission_id" "$log_evidence" \
    --key "$APPLE_API_KEY_PATH" \
    --key-id "$APPLE_API_KEY" \
    --issuer "$APPLE_API_ISSUER"
  "$XCRUN" stapler staple "$dmg_path"
  log "DMG notarization accepted (submission $submission_id); evidence saved beneath the ignored Tauri target directory"
}

run_release() {
  run_preflight
  require_release_credentials

  local expected_team
  expected_team="$(expected_team_from_identity)"

  log "Starting Tauri app and DMG release build"
  "$PNPM_BIN" --dir "$REPO_ROOT/app" tauri build --bundles app,dmg --ci
  find_release_artifacts
  submit_and_staple_dmg "$RELEASE_DMG"

  verify_app "$RELEASE_APP" "$expected_team"
  verify_dmg "$RELEASE_DMG" "$expected_team"

  log "RELEASE PASS"
  log "- app: $RELEASE_APP"
  log "- dmg: $RELEASE_DMG"
  log "- app signature, Developer ID team, Hardened Runtime, no-custom-entitlements, Gatekeeper, and stapler checks passed"
  log "- DMG integrity, signature, Developer ID team, notarization, stapler, and Gatekeeper checks passed"
}

cleanup_mount() {
  if [[ -n "$MOUNT_POINT" && -d "$MOUNT_POINT" ]]; then
    "$HDIUTIL" detach "$MOUNT_POINT" >/dev/null 2>&1 || true
    /bin/rmdir "$MOUNT_POINT" >/dev/null 2>&1 || true
  fi
}

run_verify_downloaded() {
  [[ "$#" -eq 1 ]] || die "verify-downloaded requires exactly one DMG path"
  run_preflight

  local dmg_path="$1"
  [[ -f "$dmg_path" && -r "$dmg_path" ]] || die "Downloaded DMG must be a readable regular file"
  dmg_path="$(resolve_real_path "$dmg_path")" || die "Downloaded DMG path could not be resolved"
  [[ "$dmg_path" == *.dmg ]] || die "Downloaded artifact must have a .dmg extension"

  verify_dmg "$dmg_path"
  local dmg_team="$VERIFIED_TEAM_ID"

  MOUNT_POINT="$(/usr/bin/mktemp -d -t efx-motion-dmg.XXXXXX)"
  trap cleanup_mount EXIT INT TERM
  "$HDIUTIL" attach -readonly -nobrowse -mountpoint "$MOUNT_POINT" "$dmg_path" >/dev/null

  local -a apps=()
  local path
  while IFS= read -r -d '' path; do apps+=("$path"); done < <(
    "$FIND" "$MOUNT_POINT" -type d -name 'EFX Motion Editor.app' -prune -print0
  )
  [[ "${#apps[@]}" -eq 1 ]] || die "Expected exactly one EFX Motion Editor.app in the downloaded DMG, found ${#apps[@]}"

  verify_app "${apps[0]}" "$dmg_team"
  "$HDIUTIL" detach "$MOUNT_POINT" >/dev/null
  /bin/rmdir "$MOUNT_POINT"
  MOUNT_POINT=""
  trap - EXIT INT TERM

  log "DOWNLOADED ARTIFACT PASS"
  log "- dmg: $dmg_path"
  log "- DMG integrity/signature/ticket/Gatekeeper checks passed"
  log "- contained app signature/team/Hardened Runtime/no-custom-entitlements/ticket/Gatekeeper checks passed"
  log "- normal visible launch remains a required user-owned check"
}

main() {
  local mode="${1:-}"
  case "$mode" in
    preflight)
      [[ "$#" -eq 1 ]] || { usage >&2; exit 2; }
      run_preflight
      ;;
    release)
      [[ "$#" -eq 1 ]] || { usage >&2; exit 2; }
      run_release
      ;;
    verify-downloaded)
      shift
      run_verify_downloaded "$@"
      ;;
    *)
      usage >&2
      exit 2
      ;;
  esac
}

main "$@"
