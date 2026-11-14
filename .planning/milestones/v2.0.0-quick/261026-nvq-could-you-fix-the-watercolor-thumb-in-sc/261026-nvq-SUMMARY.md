---
phase: quick-261026-nvq
plan: 261026-nvq
subsystem: ui
tags: [preact, signals, canvas, aquarelle, watercolor, thumbnail, webp, composite-operation, roto-script]

# Dependency graph
requires:
  - phase: quick-260922-al1
    provides: script library scope in the main realm (save path is main-realm-owned)
  - phase: quick-260925-iy6
    provides: aquarelle MODE.transparent opaque-transmittance sheet and live/cache multiply law
provides:
  - Optional multiply composite mode in the persisted-script thumbnail encoder (source-over default)
  - Save-path snapshot seam from AquarelleCanvasLayer through PhysicsPaintCanvasMount into Studio
  - Ink-gated aquarelle sheet carried on RotoScriptPersistenceCapture for aquarelle-only scripts
  - Library save now thumbnails the live wash (chosen source + composite mode) instead of engine-1 guide proxies
affects: [roto-script-library, aquarelle, physic-paint-studio, thumbnails]

# Actuals (#2632) — same chars/4 scale as the plan estimate (estimate: 42000 tokens).
actuals:
  tokens: 11414
  tasks: 3
  commits: 3

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Opt-in composite law: a pixel source declares its blend law at the draw call, default preserves the existing path byte-for-byte"
    - "Save-path seam mirrors the existing flush-capture seam (callback ref + register/unregister through the mount lifecycle)"
    - "Eager in-memory capture before the first await on a frame-scoped surface"

key-files:
  created: []
  modified:
    - app/src/components/physic-paint/roto/physicsPaintRotoScriptThumbnail.ts
    - app/src/components/physic-paint/roto/physicsPaintRotoScriptThumbnail.test.ts
    - app/src/components/physic-paint/engine/AquarelleCanvasLayer.tsx
    - app/src/components/physic-paint/engine/PhysicsPaintCanvasMount.tsx
    - app/src/components/physic-paint/engine/aquarelleLayerContract.test.ts
    - app/src/components/physic-paint/PhysicsPaintStudio.tsx
    - app/src/components/physic-paint/hooks/useRotoScriptClipboardController.ts
    - app/src/components/physic-paint/hooks/useRotoScriptLibraryController.ts
    - app/src/components/physic-paint/hooks/useRotoScriptLibraryController.test.ts
    - app/src/components/physic-paint/roto/physicsPaintRotoScriptClipboard.ts
    - app/src/components/physic-paint/roto/physicsPaintRotoScriptClipboard.test.ts
    - app/src/components/physic-paint/roto/physicsPaintRotoScriptLibrary.ts
    - app/src/components/physic-paint/roto/physicsPaintRotoScriptLibrary.test.ts

key-decisions:
  - "The aquarelle sheet is drawn with globalCompositeOperation='multiply' because MODE.transparent is OPAQUE transmittance (white = no pigment); source-over would paint a white rectangle over the thumbnail paper (D-01/D-04, plan correction step 6)."
  - "scriptComposite is opt-in with source-over default so the engine-1 copyLiveAlphaCanvas path stays byte-identical and existing tests are untouched."
  - "The sheet is attached to the persistence capture only when aquarelleEvents exists AND the ink gate accepted a non-null sheet — mixed keys and blank sheets keep today's thumbnail (D-03)."
  - "The port reads the sheet eagerly after the canCopy gate and before any await/flush because the live sheet is frame-scoped and cleared on frame change."
  - "No useEffect/useState/signal writes: callback refs + useCallback([]) + the existing canvas-mount memo dependency list (D-05)."

patterns-established:
  - "Blend-law parameter at the draw site: composite is passed by the caller, not inferred from pixels"
  - "Save-path registration mirrors flush-capture registration (register after engine setup, null on cleanup, before engine.destroy())"

requirements-completed: []

coverage:
  - id: D1
    description: "A saved Water color script's library row thumbnails the final wash instead of the thin engine-1 guide outlines"
    verification:
      - kind: manual_procedural
        ref: "native UAT row 1 — save from the Studio SCRIPTS panel"
        status: unknown
    human_judgment: true
    rationale: "The actual saved row is a live-rendered artifact; only the user's native Studio run can confirm the pixels shown in the library."
  - id: D2
    description: "The wash multiplies over the thumbnail paper/background instead of covering it with opaque white"
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/roto/physicsPaintRotoScriptThumbnail.test.ts#261026-nvq: an aquarelle sheet draws MULTIPLY over the composed background"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/roto/physicsPaintRotoScriptThumbnail.test.ts#261026-nvq: omitting scriptComposite keeps the engine-1 path source-over"
        status: pass
    human_judgment: false
  - id: D3
    description: "Brush-module and mixed engine-1 + watercolor keys keep today's source-over engine canvas thumbnail"
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/roto/physicsPaintRotoScriptClipboard.test.ts#261026-nvq persistence aquarelle sheet seam"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/roto/physicsPaintRotoScriptLibrary.test.ts#saveActiveFrame thumbnail source"
        status: pass
    human_judgment: false
  - id: D4
    description: "A blank/cleared live sheet falls back to the engine canvas — no blank or white thumbnail is persisted"
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/roto/physicsPaintRotoScriptClipboard.test.ts#a blank sheet leaves aquarelleAlphaCanvas undefined"
        status: pass
    human_judgment: false
  - id: D5
    description: "The snapshot seam registers/unregisters through the mount lifecycle with identity-stable callbacks and no effect/state/signal writes"
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/engine/aquarelleLayerContract.test.ts#SAVE: the live sheet snapshot is registered after engine setup and unregistered on cleanup"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/engine/PhysicsPaintCanvasMount.test.ts"
        status: pass
    human_judgment: false

duration: 6min
completed: 2026-10-26
status: complete
commits: 3
plan_head_before: ca701523486a72ed37b2189dfa6b2400eddb74a2
plan_head_after: 312a4252347206aaccbcde8009507650e36a9036
---

# Quick 261026-nvq: Watercolor script thumbnail Summary

**Saved Water color Scripts now thumbnail the live aquarelle wash multiplied over the paper, replacing the thin engine-1 guide outlines**

## Performance

- **Duration:** ~6 min
- **Started:** 2026-10-26T16:18:47Z
- **Completed:** 2026-10-26T16:24:36Z
- **Tasks:** 3/3
- **Files modified:** 13 (325 insertions, 12 deletions)
- **Commits:** 3 task commits (docs artifacts left uncommitted for the orchestrator)

## Accomplishments

- `createRotoScriptThumbnail` accepts an optional `scriptComposite` and sets `globalCompositeOperation` only for the script-canvas draw; `'multiply'` keeps the paper visible under the opaque transmittance sheet, and the default `'source-over'` keeps the engine-1 path byte-identical.
- `AquarelleCanvasLayer` registers its existing `snapshot` closure (the same `engine.exportCanvas('transparent')` the cache path resolves) through a new `onSnapshotReady` seam, unregisters `null` on cleanup next to the flush-capture unregister, and `PhysicsPaintCanvasMount` forwards it via `onAquarelleSnapshotReady`.
- `captureScriptForPersistence` reads the host sheet eagerly after the `canCopy` gate and attaches it as `RotoScriptPersistenceCapture.aquarelleAlphaCanvas` only when `aquarelleEvents` exists; `saveActiveFrame` then passes `(aquarelleAlphaCanvas, 'multiply')` or `(scriptAlphaCanvas, 'source-over')` to the existing thumbnail encoder.
- The Studio wires an ink-gated `captureAquarelleCanvas` port (`measureAquarelleCanvasInk >= AQUARELLE_MIN_CAPTURE_INK`) and an identity-stable `handleAquarelleSnapshotReady` into the existing canvas-mount memo, with no effect, state or signal write.

## Task Commits

Each task was committed atomically:

1. **Task 1: Multiply composite mode for the aquarelle transmittance sheet** — `279f19e9` (feat)
2. **Task 2: Register the live aquarelle sheet through the mount seam** — `f9fed616` (feat)
3. **Task 3: Save the live aquarelle wash as the script thumbnail** — `312a4252` (feat)

**Plan metadata:** not committed by the executor (docs commit is the orchestrator's).

## TDD Gate Compliance

All three tasks were `tdd="true"`. RED evidence:

- **Task 1 RED:** `physicsPaintRotoScriptThumbnail.test.ts` — 1 failed | 4 passed; the new multiply test failed with `expected 'source-over' to be 'multiply'` because `scriptComposite` did not exist yet. GREEN: 6/6 pass.
- **Task 2 RED:** `aquarelleLayerContract.test.ts` — 1 failed | 13 passed; the new contract test failed because `onSnapshotReady` and the mount forwarding were absent. GREEN (with `PhysicsPaintCanvasMount.test.ts`): 25/25 pass.
- **Task 3 RED:** the 4 new clipboard tests and 2 new library tests failed before wiring. GREEN (gate suites): 416 tests across 5 suites pass; `pnpm --filter efx-motion-editor run typecheck` clean; full app suite `337 passed | 2 skipped` files, `6119 passed | 1 skipped | 96 todo`.

## Files Created/Modified

- `app/src/components/physic-paint/roto/physicsPaintRotoScriptThumbnail.ts` — `RotoScriptThumbnailComposite` type, optional `scriptComposite` input, composite assignment before the script draw.
- `app/src/components/physic-paint/roto/physicsPaintRotoScriptThumbnail.test.ts` — recording-context harness + multiply/default tests.
- `app/src/components/physic-paint/engine/AquarelleCanvasLayer.tsx` — `onSnapshotReady` prop, ref sync, register after engine setup, unregister `null` in cleanup.
- `app/src/components/physic-paint/engine/PhysicsPaintCanvasMount.tsx` — `onAquarelleSnapshotReady` prop forwarded through a ref.
- `app/src/components/physic-paint/engine/aquarelleLayerContract.test.ts` — ordering/cleanup contract pins plus mount forwarding.
- `app/src/components/physic-paint/PhysicsPaintStudio.tsx` — `aquarelleSnapshotRef`, ink-gated port, identity-stable registration callback, canvas-mount memo dep + prop, `captureThumbnail` composite forwarding.
- `app/src/components/physic-paint/hooks/useRotoScriptClipboardController.ts` — `captureAquarelleCanvas` forwarding port.
- `app/src/components/physic-paint/hooks/useRotoScriptLibraryController.ts` — production adapter now forwards the `captureThumbnail` composite argument (deviation fix).
- `app/src/components/physic-paint/hooks/useRotoScriptLibraryController.test.ts` — pins the adapter's second-argument forwarding.
- `app/src/components/physic-paint/roto/physicsPaintRotoScriptClipboard.ts` — `aquarelleAlphaCanvas` field, `captureAquarelleCanvas` port, eager read, conditional attach.
- `app/src/components/physic-paint/roto/physicsPaintRotoScriptClipboard.test.ts` — persistence-seam describe (4 tests) incl. blank/mixed/eager cases.
- `app/src/components/physic-paint/roto/physicsPaintRotoScriptLibrary.ts` — thumbnail source + composite selection in `saveActiveFrame`.
- `app/src/components/physic-paint/roto/physicsPaintRotoScriptLibrary.test.ts` — harness exposes `captureThumbnail`; multiply/default save assertions.

## Decisions Made

- Followed the plan's locked decisions D-01..D-06 without reopening: live sheet is the source for aquarelle scripts, engine alpha otherwise; encoding/size/schema untouched; mixed keys unchanged; blank sheets fall back; no effects/state/signals; pnpm + `vitest run` only.
- The composite is a caller-supplied blend law rather than an inferred one, keeping the encoder branch-free and the engine-1 output identical.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical functionality] Production adapter dropped the new composite argument**
- **Found during:** Task 3 (Carry the ink-gated sheet through save into the library thumbnail source)
- **Issue:** `createRotoScriptLibraryControllerAdapter` forwarded only the first `captureThumbnail` argument, so the library's `'multiply'` mode would have been silently discarded in production while unit tests (which inject the port directly) stayed green.
- **Fix:** Forward the optional composite through the adapter and pin it with an assertion in the hook test.
- **Files modified:** `app/src/components/physic-paint/hooks/useRotoScriptLibraryController.ts`, `app/src/components/physic-paint/hooks/useRotoScriptLibraryController.test.ts` (the latter was not in the plan's `files_modified` list).
- **Verification:** Hook suite green; the composite assertion runs in the Task 3 gate (416 tests) and the full app suite.
- **Committed in:** `312a4252` (part of Task 3 commit)

---

**Total deviations:** 1 auto-fixed (1 missing critical functionality)
**Impact on plan:** Required for correctness — without it the planned multiply law would not reach production. No scope creep; encoding, size contract and persisted schema are unchanged.

## Issues Encountered

- **Library save returned false with `Error: Captured Roto script is not persistable`:** the test harness used `testWebpBytes()`, which has RIFF/WEBP/VP8L magic but no parseable dimensions, so `isPersistedRotoScriptV1 → isThumbnail → parseWebpDimensions` rejected the row. Resolved by using the suite's valid 1×1 VP8L WebP fixture already defined at module level.
- **Clipboard event count was 2 instead of 1:** `purgeAllAquarelleKeyScripts()` intentionally preserves Dry events from earlier suites. Resolved by filtering `!isAquarelleDryEvent(event)` before asserting the stroke set; production behavior unaffected.

## User Setup Required

None — no external service configuration or dependency was added.

## Native UAT (user-driven — executor never started the dev server)

| # | Action | Expected |
|---|--------|----------|
| 1 | Water color module, paint a wash on a real key, let it settle, then Save Script from the SCRIPTS panel | The new library row thumbnail shows the actual watercolor wash over the selected paper — no thin guide outlines |
| 2 | Same key, press Dry, then Save Script again | The saved thumbnail shows the settled (dry) wash, matching what is on canvas |
| 3 | Brush module (or a mixed key with engine-1 strokes), Save Script | The thumbnail is unchanged from today: the painted strokes over the paper |
| 4 | Water color, empty a freshly created key with no paint, Save Script | Still refused with "Paint at least one brush on a real Roto key." — no blank row appears |
| 5 | Reopen a saved script from the library (Load/Apply) | Applies exactly as before; the script schema is unchanged |
| 6 | Save, then navigate frames and Save on another key | Each row gets its own frame's wash; no stale sheet leaks between frames, and frame navigation stays responsive |

**Approved 2026-10-26** — all 6 rows passed in native UAT (user-driven, dev server on the user's side).

## Known Stubs

None — no stub, placeholder, skipped test, or unrun `<verify>` was left behind.

## Threat Flags

None — no new security-relevant surface beyond the plan's `<threat_model>`; the single extra `exportCanvas('transparent')` readback per explicit Save is the mitigated T-quick-261026-nvq-03 path.

## Next Phase Readiness

- Automated work is complete and typechecked; the fix is ready for the user's native live UAT rows above.
- No blocker: the accepted scope remains session-scoped (a sheet with no fresh ink falls back to today's thumbnail; cached frame bytes are not merged).

---

## Self-Check: PASSED

- All 13 modified files exist on disk.
- All 3 task commits are ancestors of HEAD (`279f19e9`, `f9fed616`, `312a4252`).
- Working tree contains only the untracked plan directory; no docs artifact was committed.

---

*Quick: 261026-nvq*
*Completed: 2026-10-26*
