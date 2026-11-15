---
phase: 63-brush-tip-pipeline
plan: 08
subsystem: rotoscoping / brush tips
tags: [preact-signals, watercolor, roto-script, brush-pack, base64, webp, tauri-ipc, tdd]

requires:
  - phase: 63-05
    provides: cross-realm brush catalog snapshot (applyBrushCatalogPayload fills the Studio realm's asset cache)
  - phase: 63-07
    provides: project brush set apply on open and the wholesale reset that clears session masks
  - phase: 63-02
    provides: native WebP mask decode seam (exactly 192x192, fail-closed)
provides:
  - Roto script brush carrier — custom tips travel inline as `maskDataUrl`, never as a package asset ref
  - registerScriptMask — registry-only session masks, never a catalog row
  - decodeScriptMaskDataUrl — 512 KB pre-decode cap, canonical base64, exact 192x192 RIFF header
  - buildScriptBrushEntries / registerScriptBrushMasks — the save and load legs of the carrier
affects: [63-09, phase-63-verification]

actuals:
  tokens: 10620
  tasks: 2
  commits: 4

tech-stack:
  added: []
  patterns:
    - "Carrier asymmetry: package carrier = asset refs; script carrier = inline mask data URLs; each mode refuses the other's member"
    - "Registry-only session state: a script's masks paint for the session but never become project catalog data"
    - "Pre-decode byte cap: canonical base64 length arithmetic bounds the payload before any allocation"
    - "Two-realm proof: the save leg is tested on a fresh module graph seeded only through applyBrushCatalogPayload"

key-files:
  created: []
  modified:
    - app/src/components/physic-paint/roto/physicsPaintRotoScriptSchema.ts
    - app/src/components/physic-paint/roto/physicsPaintRotoScriptLibrary.ts
    - app/src/stores/aquarelleBrushCatalog.ts
    - app/src/components/physic-paint/roto/physicsPaintRotoScriptSchema.test.ts
    - app/src/components/physic-paint/roto/physicsPaintRotoScriptLibrary.test.ts
    - app/src/stores/aquarelleBrushCatalog.test.ts

key-decisions:
  - "The save leg REFUSES by name when a custom tip's stored WebP bytes are absent from the Studio realm rather than dropping the mask — that state means the catalog push never arrived"
  - "A structurally malformed carrier entry (over cap, wrong dimensions, non-canonical base64, `mask`/`asset` member, missing mask) refuses the whole document at parse time; runtime native-decode and registry failures degrade one entry with a named log"
  - "isBrushPack delegates to the package's parseBrushPackSnapshot(value, 'script') so the package and script carriers cannot drift"
  - "The dimension walk reads the RIFF header BEFORE the native decode, so an oversize or wrong-size drawing never allocates a mask buffer"

requirements-completed: [TIP-14]

coverage:
  - id: D1
    description: "A roto script saves each custom tip's mask inline as a WebP data URL and rehydrates it into the engine registry on load, painting without a project import"
    requirement: TIP-14
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/roto/physicsPaintRotoScriptLibrary.test.ts#save leg: each custom tip mask travels as an inline data URL read from the Studio realm cache"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/roto/physicsPaintRotoScriptLibrary.test.ts#load leg: registers the carried mask in the registry only and paints with it"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/roto/physicsPaintRotoScriptSchema.test.ts#serializes custom brush entries inline: a data URL, never a package asset ref"
        status: pass
      - kind: unit
        ref: "app/src/stores/aquarelleBrushCatalog.test.ts#a script mask is registry-only and never survives a project reset"
        status: pass
    human_judgment: false
  - id: D2
    description: "The script carrier is bounded and fail-closed: 512 KB cap, canonical base64, exactly 192x192, `mask`/`asset` refused, one bad entry degrades alone"
    requirement: TIP-14
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/roto/physicsPaintRotoScriptSchema.test.ts#bounds the mask carrier: 512 KB cap and exactly 192x192, checked before any native decode"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/roto/physicsPaintRotoScriptSchema.test.ts#the parser refuses every malformed script carrier entry with a named reason"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/roto/physicsPaintRotoScriptLibrary.test.ts#load leg: one bad mask degrades alone and never aborts the script"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/roto/physicsPaintRotoScriptSchema.test.ts#refuses to serialize a script entry carrying a package asset ref"
        status: pass
    human_judgment: false
  - id: D3
    description: "On a real machine, a script saved from a project with an imported tip paints that texture in a project that never imported it"
    verification: []
    human_judgment: true
    rationale: "Vitest stubs the Tauri mask-decode seam and never runs the watercolor wash; only the packaged app proves the native decode boundary and the live painted texture."

duration: 8min
completed: 2026-11-15
status: complete
---

# Phase 63 Plan 08: Roto Script Brush Carrier Summary

**Roto scripts now carry each imported tip's mask inline as a bounded WebP data URL, rehydrate it into a registry-only session mask, and refuse a save whose mask bytes never reached the Studio realm.**

## Performance

- **Duration:** 8 min
- **Started:** 2026-11-15T13:08:20Z
- **Completed:** 2026-11-15T13:16:00Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments

- `serializeAquarelleRotoScript` accepts `brushEntries` and builds the script-mode pack instead of hardcoding `entries: []`; the save leg pairs the open project's CUSTOM tips with the Studio realm's stored WebP bytes and refuses by name when a tip's bytes are absent.
- The load leg (activation, snapshot read, and the direct `registerScriptBrushMasks` entry point) decodes each inline mask, calls the native mask decode, validates exactly 36,864 bytes, and registers it through the new `registerScriptMask` — registry only, never a catalog row.
- The script carrier is bounded: `ROTO_SCRIPT_LIMITS.maskDataUrlBytes = 512 KB` checked arithmetically before any base64 decode, canonical base64 only, and an exact 192x192 RIFF header walked before the native decode; the retired `mask` member and any `asset` ref are refused.
- A throwing native decode degrades one entry with a named log while the rest of the script activates.

## Task Commits

Each task was committed atomically:

1. **Task 1: End-to-end script carrier — serialize, parse, register, paint** — `bffd116d9` (test, RED) + `5e58784dd` (feat, GREEN)
2. **Task 2: Script payload caps and refusals** — `8127400cb` (test, RED) + `08c38e84e` (feat, GREEN)

**Plan metadata:** see the `docs(63-08)` commit that carries this SUMMARY.

## Files Created/Modified

- `app/src/components/physic-paint/roto/physicsPaintRotoScriptSchema.ts` — `ROTO_SCRIPT_WEBP_PREFIX`, `brushEntries` serializer input, `decodeScriptMaskDataUrl` (cap + canonical base64 + exact 192x192), script-mode `isBrushPack`, `ROTO_SCRIPT_LIMITS.maskDataUrlBytes`.
- `app/src/components/physic-paint/roto/physicsPaintRotoScriptLibrary.ts` — `buildScriptBrushEntries`, `registerScriptBrushMasks` with per-entry isolation, `registerScriptMasks` controller port, save/load wiring.
- `app/src/stores/aquarelleBrushCatalog.ts` — `registerScriptMask` (registry-only choke point).
- `app/src/components/physic-paint/roto/physicsPaintRotoScriptSchema.test.ts` — carrier serialization/decoding, bounds and whole-document refusal tests; valid 26-byte VP8L fixture helper.
- `app/src/components/physic-paint/roto/physicsPaintRotoScriptLibrary.test.ts` — fresh-module save leg through `applyBrushCatalogPayload`, missing-bytes refusal, registry-only load, per-entry isolation.
- `app/src/stores/aquarelleBrushCatalog.test.ts` — registry-only and reset laws for script masks.

## TDD Gate Compliance

Both behavior-adding tasks ran RED → GREEN:

- **Task 1** (tracer): RED `bffd116d9` — 8 failed | 76 passed, zero collection errors. GREEN `5e58784dd`.
- **Task 2** (`tdd="true"`): RED `8127400cb` — 3 failed | 62 passed, zero collection errors. `gsd_run check tdd-red-evidence` on the TAP-flat record returned `RED_EVIDENCE_OK` (reason `target_test_failed`, target: "bounds the mask carrier: 512 KB cap and exactly 192x192"). GREEN `08c38e84e` — 75/75 green.
- Semantic assessment: every RED failure was the intended missing behavior (absent cap constant, permissive pack guard, unisolated throwing decode), never a fixture, collection or build fault.

## Decisions Made

- Save refusal over silent mask loss: a missing stored byte set means the catalog push never arrived, which is a defect the user must see, not a normal path.
- Parse-time vs activation-time strictness split: structurally malformed carriers refuse the whole document (a script that cannot paint its tips is not a valid script); only runtime native-decode and registry refusals degrade per entry.
- The script pack guard reuses the package's script-mode parser, so the two carriers share one shape authority.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Test VP8L helpers declared an invalid RIFF container**
- **Found during:** Task 2 GREEN (the new dimension walk exposed it)
- **Issue:** The 25-byte helper wrote RIFF size 0 and omitted the pad byte required by its odd-sized VP8L chunk, so `parseWebpDimensions` refused it. The helper had only "worked" because no walker ran over it before.
- **Fix:** 26-byte container with RIFF size 18 and the pad byte; both test files updated.
- **Files modified:** `physicsPaintRotoScriptSchema.test.ts`, `physicsPaintRotoScriptLibrary.test.ts`
- **Verification:** All 75 tests in the three Task 2 suites pass.
- **Committed in:** `08c38e84e`

**2. [Rule 1 - Bug] Task 1 mask fixture used a 1x1 WebP**
- **Found during:** Task 2 RED
- **Issue:** The schema carrier fixture reused the thumbnail's 1x1 `webp` constant as a mask, which the plan's exact-192x192 law must refuse.
- **Fix:** Replaced with a 192x192 fixture helper (`scriptDataUrl`), plus a non-canonical variant helper.
- **Files modified:** `physicsPaintRotoScriptSchema.test.ts`
- **Verification:** Serialization and parser tests pass under the new law.
- **Committed in:** `08c38e84e`

---

**Total deviations:** 2 auto-fixed (2 bugs, test fixtures)
**Impact on plan:** No scope creep; both fixes were required for the new fail-closed walker to be provable.

## Issues Encountered

- The plan listed `app/src/lib/efxPaintBrushAssets.ts` and its test under `files_modified`, but no change was needed: `brushAssetBytes` and `brushAssetDigestFromPath` already expose exactly what the save leg reads. Its suite runs as a regression in the Task 2 verify (10/10 pass).
- The RED evidence record was written for the classifier, verified as `RED_EVIDENCE_OK`, then removed to keep the tree clean; the verdict is recorded above.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- All plan verification gates pass: the three carrier suites (75 tests), `mceFieldContract.test.ts` (21 tests), `tsc --noEmit` clean (the phase's final production-typecheck gate), and the `asset:` literal pin in the schema source prints 0.
- Live UAT (D3) remains: save a script in a project with an imported tip, open a project without that tip, apply the script, and confirm the texture paints.
- Phase 63 plan 09 is next; no blockers.

## Self-Check: PASSED

- Files verified on disk: both source modules, both test suites, the catalog and its test, this SUMMARY.
- Commits verified as ancestors of HEAD: `bffd116d9`, `5e58784dd`, `8127400cb`, `08c38e84e`.

---
*Phase: 63-brush-tip-pipeline*
*Completed: 2026-11-15*
