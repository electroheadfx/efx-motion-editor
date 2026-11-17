---
phase: 64-medium-engine
plan: 05
subsystem: efx-paint document persistence
tags: [preact-signals, efx-watercolor, light, document-revision, mce, fail-closed-parser]

# Dependency graph
requires:
  - phase: 64-04
    provides: engine-held LightSettings/DEFAULT_LIGHT and the emboss render term
provides:
  - optional-additive per-document light member with byte-identical absence
  - normalizeDocumentLight fail-closed admission
  - setDocumentLight single writer on the unified undo ledger
  - light term in the canonical document revision (cache-key rotation)
  - MceDocumentLight dual-language .mce declaration pin
affects: [64-07 render-path wiring, later 64 Studio UI plans]

# Actuals (#2632) — same scale as the plan's estimate (chars/4 over the realized
# diff, never a harness token count).
actuals:
  tokens: 8509
  tasks: 3
  commits: 5
  plan_head_before: e8e98994f272a1d4087d0d3c3175738329f25374
  plan_head_after: cd170b083cd0f6f4e0bd3dee838dd669a8add1de

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Optional-additive document member: absent contributes no revision term (D-29 idiom) and no default is manufactured into saved bytes"
    - "Single-writer store mutation: immutable spread, canonical-revision idempotence compare, one bump, one change notification, one ledger descriptor"
    - "Dual-language Mce* declaration: the TS interface, the Rust struct and the expectMemberKeys pin land in one pass"

key-files:
  created:
    - app/src/efx-paint/document/paintDocumentLight.test.ts
  modified:
    - app/src/efx-paint/document/efxPaintDocument.ts
    - app/src/efx-paint/document/efxPaintDocumentParsers.ts
    - app/src/efx-paint/document/efxPaintDocumentRevision.ts
    - app/src/stores/efxPaintStore.ts
    - app/src/types/project.ts
    - app/src/lib/mceFieldContract.test.ts
    - app/src-tauri/src/models/project.rs

key-decisions:
  - "PaintDocumentLight IS the engine's LightSettings; the absent default resolves to DEFAULT_LIGHT from the package barrel, never retyped in the app"
  - "Absent stays absent: the parser spreads a present light only, so an untouched pre-milestone project re-encodes byte-identically"
  - "Parser bands mirror Engine.setLight: azimuth 0..360, elevation 0..90, intensity 0..4; unknown/missing/non-finite/out-of-range/null all throw"
  - "setDocumentLight resolves the patch over the current light (DEFAULT_LIGHT when absent), compares canonical revisions, and returns a null descriptor on a same-value no-op"
  - "An empty patch never injects a default light into a document that had none"
  - "The launch envelope is unchanged: the light rides the opaque document member end to end; no launch key, launch field or Rust launch-struct member is added"

patterns-established:
  - "Optional-additive member: absent contributes no term and no default is written to disk"
  - "One writer per document setting: immutable spread, revision compare, one bump, one notify, one descriptor"

requirements-completed: [MED-17]

# Coverage metadata (#1602)
coverage:
  - id: D1
    description: "A document with no light keeps no light through parse and re-encode (byte identity)"
    requirement: MED-17
    verification:
      - kind: unit
        ref: "app/src/efx-paint/document/paintDocumentLight.test.ts#keeps an absent light absent through parse and re-encode"
        status: pass
    human_judgment: false
  - id: D2
    description: "A present light round-trips frozen; any malformed shape fails closed at parse"
    requirement: MED-17
    verification:
      - kind: unit
        ref: "app/src/efx-paint/document/paintDocumentLight.test.ts#round-trips a valid light unchanged and freezes it (plus the unknown/missing/non-finite/out-of-range/null rejection tests)"
        status: pass
    human_judgment: false
  - id: D3
    description: "A light change rotates the document revision and the sync fingerprint; equal content does not"
    requirement: MED-17
    verification:
      - kind: unit
        ref: "app/src/efx-paint/document/paintDocumentLight.test.ts#rotates the document revision when the light changes, and only then"
        status: pass
      - kind: unit
        ref: "app/src/efx-paint/document/paintDocumentLight.test.ts#rotates the sync fingerprint with the revision (no second light term)"
        status: pass
    human_judgment: false
  - id: D4
    description: "setDocumentLight is the single writer: engine clamps, one revision bump, same-value no-op, per-layer isolation"
    requirement: MED-17
    verification:
      - kind: unit
        ref: "app/src/efx-paint/document/paintDocumentLight.test.ts#setDocumentLight — the one light writer (MED-17)"
        status: pass
    human_judgment: false
  - id: D5
    description: "MceDocumentLight is declared and pinned in both languages; the launch path is unchanged"
    requirement: MED-17
    verification:
      - kind: unit
        ref: "app/src/lib/mceFieldContract.test.ts#declares the document light shape in both languages"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/bridge/physicsPaintLaunchContext.test.ts (unchanged validator regression, document-carried payloads)"
        status: pass
    human_judgment: false

# Metrics
duration: 6min
completed: 2026-11-17
status: complete
---

# Phase 64 Plan 05: Persist the per-document emboss light Summary

**Optional per-paint-layer-document light (azimuth, elevation, intensity) with byte-identical absence, a fail-closed parser, a revision term, one undo-ledgered writer, and a dual-language `.mce` pin**

## Performance

- **Duration:** 6 min
- **Started:** 2026-11-17T16:20:31Z
- **Completed:** 2026-11-17T16:26:09Z
- **Tasks:** 3
- **Files modified:** 8

## Accomplishments

- `EfxPaintDocument` admits an optional `light` member whose absence survives parse and re-encode byte-identically — an untouched pre-milestone project gains no manufactured default.
- The fail-closed parser admits exactly `azimuth`/`elevation`/`intensity`, rejects unknown, missing, non-finite, out-of-range and `null` values, and accepts the engine's band edges.
- A light change now rotates the canonical document revision (and the sync fingerprint inherits it), so every cache keyed on the revision misses.
- `setDocumentLight` is the sole writer: patch resolved over the current light, engine clamp/wrap bands, a same-value no-op with a null descriptor, one revision bump, one change notification.
- `MceDocumentLight` is declared in both TS and Rust and pinned by `expectMemberKeys`; the launch envelope stays unchanged because the light rides its opaque `document` member end to end.

## Task Commits

Each task was committed atomically:

1. **Task 1: Optional light member and fail-closed parser** — `809662ff6` (test, RED) → `309ca5a37` (feat, GREEN)
2. **Task 2: Revision term and the one light mutation** — `9cfaa81f1` (test, RED) → `e44ac5aeb` (feat, GREEN)
3. **Task 3: Dual-language `.mce` declaration pin** — `cd170b083` (feat)

**Plan metadata:** pending final docs commit.

## Files Created/Modified

- `app/src/efx-paint/document/paintDocumentLight.test.ts` — 28 tests: absent-stays-absent byte identity, freeze/round-trip, fail-closed rejections, band edges, revision/fingerprint rotation, the full `setDocumentLight` contract.
- `app/src/efx-paint/document/efxPaintDocument.ts` — `PaintDocumentLight` type (the engine's `LightSettings`) and the optional `EfxPaintDocument.light` member; the factory still writes nothing.
- `app/src/efx-paint/document/efxPaintDocumentParsers.ts` — `light` joins `DOCUMENT_KEYS`; `normalizeDocumentLight` admits the three members with finite/band checks and spreads a present light only.
- `app/src/efx-paint/document/efxPaintDocumentRevision.ts` — absent-contributes-nothing `light:` term between `bgrevision:` and `photo:`.
- `app/src/stores/efxPaintStore.ts` — `'set-document-light'` operation kind and `setDocumentLight` (single writer on the unified undo ledger).
- `app/src/types/project.ts` — `MceDocumentLight` beside `McePaperDisplayState`.
- `app/src/lib/mceFieldContract.test.ts` — Phase 64 describe block pinning the three wire keys; allowlist untouched.
- `app/src-tauri/src/models/project.rs` — matching `MceDocumentLight` struct with the reason the launch path stays unchanged recorded in the doc comment.

## Decisions Made

- `PaintDocumentLight` IS the engine's `LightSettings`; the absent default resolves to `DEFAULT_LIGHT` from the package barrel — one source, never retyped.
- Absence is preserved by spreading a present light only — no default ever materializes in saved bytes.
- The parser's bands mirror `Engine.setLight` exactly (azimuth wraps 0..360, elevation clamps 0..90, intensity clamps 0..4; a non-finite patch value falls back to the `DEFAULT_LIGHT` field in the store writer).
- An empty patch is a hard no-op and never injects a default light into a document that had none.
- No launch key, launch interface field or Rust launch-struct member was added: the light crosses the native handoff inside the opaque `document` member and is validated by the unchanged `parseEfxPaintDocument` delegate.

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

- **RED report capture.** Task 2's first RED classifier run returned `INVALID_RED` (`Unsupported report format`) because Vite sourcemap warnings were merged into the TAP file via `2>&1`. Re-ran with stdout and stderr separated, committed the TAP-only report and preserved the stderr noise as `otherConsoleOutput` in the RED record; the classifier then returned `RED_EVIDENCE_OK`.
- **zsh `PIPESTATUS`.** Capturing a piped `tsc --noEmit` exit code through `${PIPESTATUS[0]}` returned empty under zsh; re-ran with output redirected to a log and captured `$?` directly (exit 0).

## TDD Gate Compliance

- RED (Task 1): `809662ff6` `test(64-05): add failing test for the optional document light member` — 19 tests, 1 passed / 18 failed on the planned source pins; `gsd_run check tdd-red-evidence` returned `RED_EVIDENCE_OK`.
- GREEN (Task 1): `309ca5a37` `feat(64-05): persist the optional document light through a fail-closed parser` follows the RED commit.
- RED (Task 2): `9cfaa81f1` `test(64-05): add failing test for the light revision term and one mutation` — 28 tests, 19 passed / 9 failed on the planned source pins; `RED_EVIDENCE_OK`.
- GREEN (Task 2): `e44ac5aeb` `feat(64-05): rotate the document revision with the light and add the one light writer` follows the RED commit.
- Task 3 is declaration-only (not TDD); no REFACTOR pass was required.
- No gate violations.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- The light is now durable: render-path wiring (64-07) can read `document.light ?? DEFAULT_LIGHT` without inventing a transport, and every cache keyed on the document revision already rotates on a light change.
- A pre-milestone document with no light re-encodes byte-identically, so the remaining 64 plans can ship without touching old projects.

---
*Phase: 64-medium-engine*
*Completed: 2026-11-17*

## Self-Check: PASSED
