---
phase: 40-macos-icon-regeneration-build-hygiene
plan: 01
subsystem: infra
tags: [tauri, macos, icons, release, icns, dmg]

# Dependency graph
requires:
  - phase: milestone/v0.8.1 release pipeline
    provides: scripts/macos-release.sh verify_app icon-check block, releaseContract.test.ts EXPECTED_ICONS contract, tauri.conf.json bundle.icon declaration
provides:
  - 5 regenerated tracked icons under app/src-tauri/icons/ from the approved 794x794 artwork
  - check-unsigned-app-icon.sh — reusable D-05 packaged-icon check proven against a fresh unsigned build
  - Fresh unsigned .app + DMG with proven CFBundleIconFile/icon.icns metadata, user-UAT-approved
affects: [44-macos-release, release-icon-contract]

# Actuals (#2632)
actuals:
  tokens: 1200
  tasks: 3
  commits: 3

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Staging-dir icon generation (`tauri icon -o /tmp/...`) then copy of ONLY the 5 declared files — keeps the exact-array contract true while the CLI emits ~45 extras"
    - "Extract-and-eval check script: sed range over the CFBundleIconFile block of scripts/macos-release.sh, evaluated with local die()/PLUTIL/app_path — reuses release logic without sourcing the script"

key-files:
  created:
    - .planning/phases/40-macos-icon-regeneration-build-hygiene/check-unsigned-app-icon.sh
  modified:
    - app/src-tauri/icons/32x32.png
    - app/src-tauri/icons/128x128.png
    - app/src-tauri/icons/128x128@2x.png
    - app/src-tauri/icons/icon.icns
    - app/src-tauri/icons/icon.ico

key-decisions:
  - "Generate icons into a staging dir and copy only the 5 declared files — tauri icon emits ~45 extras (Square logos, StoreLogo, ios/, android/) that must never enter the tracked tree"
  - "D-05 check script extracts the icon-check lines from scripts/macos-release.sh at runtime instead of duplicating them — checked logic cannot silently drift from release preflight"
  - "Fresh unsigned bundle built with explicit `--bundles app,dmg --ci` flags after the literal `pnpm --dir app tauri build` skipped bundling in the non-TTY shell"

patterns-established:
  - "Packaged-icon proof before release: unsigned-build D-05 check reusing release-script logic; Phase 44 re-proves at release time"

requirements-completed: [ICON-01, ICON-02, ICON-03, ICON-04]

# Coverage metadata (#1602)
coverage:
  - id: D1
    description: "5 tracked icons regenerated from SPECS/efxmotioneditor-icon-2.png via pnpm tauri icon staging-dir flow; exact-set contract green (5 modified / 0 untracked)"
    requirement: "ICON-01"
    verification:
      - kind: unit
        ref: "app/src/releaseContract.test.ts (exact-array, non-empty, icns-magic assertions)"
        status: pass
      - kind: other
        ref: "git status --porcelain -- app/src-tauri/icons/ => exactly 5 lines, all '^ M'"
        status: pass
    human_judgment: false
  - id: D2
    description: "check-unsigned-app-icon.sh proves CFBundleIconFile/icon.icns metadata on the fresh unsigned bundle (fail-closed on missing bundle)"
    requirement: "ICON-03"
    verification:
      - kind: other
        ref: "bash .planning/phases/40-macos-icon-regeneration-build-hygiene/check-unsigned-app-icon.sh => PASS (icon.icns declared, resource non-empty, icns magic); /nonexistent/EFX.app exits 1"
        status: pass
    human_judgment: false
  - id: D3
    description: "Icon legibility across Finder, Dock, Cmd-Tab, and mounted DMG on the fresh unsigned build"
    requirement: "ICON-04"
    verification: []
    human_judgment: true
    rationale: "Per plan flagged assumption: legibility is accepted solely by user visual UAT; no automated pixel/legibility validation exists. User APPROVED at the Task 3 checkpoint (and at the Task 1 tracer gate for the running app)."

# Metrics
duration: ~1h 30m (across 2 human-verify gates)
completed: 2026-08-04
status: complete
---

# Phase 40 Plan 01: macOS Icon Regeneration + Build Hygiene Summary

**Real EFX Motion Editor release identity shipped: 5 tracked icons regenerated from the approved 794x794 artwork via `pnpm tauri icon`, packaged-icon metadata proven on a fresh unsigned bundle by a D-05 check script reusing release-script logic, and user visual UAT approved across Finder/Dock/Cmd-Tab/DMG.**

## Performance

- **Duration:** ~1h 30m (across two human-verify gates)
- **Started:** 2026-08-04
- **Completed:** 2026-08-04
- **Tasks:** 3
- **Files modified:** 6 (5 regenerated binaries + 1 new script)

## Accomplishments
- Tracked icon set regenerated from `SPECS/efxmotioneditor-icon-2.png` (794x794 used directly, no manual upscale) — placeholder template icon from the T-jun-02 incident replaced
- Exact-set contract preserved: staging-dir generation then copy of ONLY the 5 declared files; `releaseContract.test.ts` green with no test edits
- D-05 packaged-icon check script created and proven against a fresh unsigned build; `scripts/macos-release.sh` byte-identical (D-06)
- User visual UAT APPROVED: icon correct and legible in Finder, Dock, Cmd-Tab, and the mounted DMG

## Task Commits

Each task was committed atomically on `milestone/v0.9.0` (user-approved main-checkout exception for Tasks 2-3; worktree isolation bypassed with explicit approval):

1. **Task 1: End-to-end icon regeneration (tracer)** - `6cee9d0e` (feat)
2. **Task 2: D-05 packaged-icon check script + fresh unsigned build** - `1c7a90e2` (feat)
3. **Task 3: User visual UAT** - checkpoint, APPROVED by user (no code commit)

**Plan metadata:** this summary commit (docs: complete 40-01 plan)

## Execution Evidence (per plan `<output>`)

**Icon command (Task 1):**
```
pnpm tauri icon ../SPECS/efxmotioneditor-icon-2.png -o /tmp/efx-icons-staging-40
# then copied ONLY the 5 declared files from staging into app/src-tauri/icons/:
# 32x32.png, 128x128.png, 128x128@2x.png, icon.icns, icon.ico
```

**git-status proof (Task 1):** `git status --porcelain -- app/src-tauri/icons/` returned exactly 5 lines, every line ` M` — 5 modified, 0 untracked. No Square logos, StoreLogo, 64x64.png, icon.png, ios/, or android/ output entered the tracked tree. `releaseContract.test.ts` passed; `head -c 4 app/src-tauri/icons/icon.icns` prints `icns`; zero package.json/lockfile changes.

**Fresh build (Task 2):**
- Bundle: `app/src-tauri/target/release/bundle/macos/EFX Motion Editor.app` — Info.plist mtime **Aug 4 15:43:56 2026** (fresh; supersedes the stale 2026-08-01 bundle)
- DMG: `app/src-tauri/target/release/bundle/dmg/EFX Motion Editor_0.8.1_aarch64.dmg`
- Built unsigned via `pnpm --dir app tauri build --bundles app,dmg --ci` (no signing/notarization/stapling path exercised)

**D-05 check PASS output (Task 2):**
```
PASS: CFBundleIconFile=icon.icns declared in Info.plist; bundled resource
Contents/Resources/icon.icns exists, is non-empty, and starts with the icns magic bytes
```
(exit 0). Negative case: the same script against `/nonexistent/EFX.app` exits 1 (fail-closed via the local `die`). `git diff -- scripts/macos-release.sh` empty.

**User UAT verdict (Task 3):** **APPROVED.** Icons in the running app were approved at the Task 1 tracer gate; the fresh bundle's icon in Finder, Dock, Cmd-Tab, and the mounted DMG was approved at the Task 3 checkpoint. The LaunchServices icon-cache caveat (stale cached icon is a display concern only, resolvable via `touch` on the .app or re-login, not a build defect) was communicated to the user.

## Files Created/Modified
- `app/src-tauri/icons/32x32.png` - Regenerated from approved artwork
- `app/src-tauri/icons/128x128.png` - Regenerated from approved artwork
- `app/src-tauri/icons/128x128@2x.png` - Regenerated from approved artwork
- `app/src-tauri/icons/icon.icns` - Regenerated from approved artwork (macOS bundle icon)
- `app/src-tauri/icons/icon.ico` - Regenerated from approved artwork (Windows)
- `.planning/phases/40-macos-icon-regeneration-build-hygiene/check-unsigned-app-icon.sh` - NEW executable D-05 check; extracts the CFBundleIconFile/icon block from `scripts/macos-release.sh` at runtime via sed range and evaluates it with local `die()`/`PLUTIL`/`app_path`; never sources the release script, never invokes codesign/spctl/stapler

## Decisions Made
- Staging-dir generation + selective 5-file copy (keeps exact-array contract true despite ~45 CLI extras)
- Runtime extract-and-eval for the D-05 check instead of duplicating check logic (cannot drift from release preflight; T-40-03 mitigation)
- 794x794 source used directly with no manual 1024 upscale (D-01/D-03; verified supported by installed @tauri-apps/cli)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Explicit `--bundles app,dmg --ci` flags required for non-TTY build**
- **Found during:** Task 2 (D-05 check script + fresh unsigned build)
- **Issue:** The literal `pnpm --dir app tauri build` from the plan action skipped bundling in the non-TTY shell — no fresh `.app`/DMG was produced, blocking the mtime guard and the D-05 check
- **Fix:** Re-ran the build with explicit `pnpm --dir app tauri build --bundles app,dmg --ci`; produced the fresh unsigned bundle (Info.plist mtime Aug 4 15:43:56 2026) and DMG
- **Files modified:** none (build output only; no source/config changes)
- **Verification:** Fresh bundle mtime from today; D-05 check exits 0 against it; negative case exits 1; `git diff -- scripts/macos-release.sh` empty
- **Committed in:** `1c7a90e2` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (blocking)
**Impact on plan:** Minimal — same unsigned build the plan intended, with explicit non-interactive flags. No scope creep; no signing/notarization path touched.

## Issues Encountered
- Non-TTY shell caused `tauri build` to skip bundling (resolved via the deviation above).
- macOS LaunchServices may cache the old icon in Finder/Dock — communicated to the user as a display-only concern, not a build defect; UAT passed regardless.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Real release identity is in the tracked tree and contract-protected; Phase 44 will re-prove the packaged-icon guard at signed-release time using the same release-script logic this plan validated.
- `check-unsigned-app-icon.sh` is reusable for any future unsigned-build icon verification.
- No blockers.

---
*Phase: 40-macos-icon-regeneration-build-hygiene*
*Completed: 2026-08-04*
