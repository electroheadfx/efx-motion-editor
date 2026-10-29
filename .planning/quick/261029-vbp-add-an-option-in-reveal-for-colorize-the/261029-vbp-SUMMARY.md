---
phase: quick-261029-vbp
plan: 261029-vbp
subsystem: physic-paint
tags: [canvas-compositing, source-atop, preact-signals, persistence, undo-redo, bridge-canonicalization]

requires:
  - phase: 52-01
    provides: reveal rail create/replay bake chain, compositeRevealMask and the destination-in wash alpha mask
  - phase: 52-05
    provides: G-52-4 whole-clip canonical re-verification (stableSerialize) and the loop-clip rebuilders

provides:
  - Reveal Colorize option (checkbox + 0-100 mix) that tints the revealed photo with the per-stroke wash pigment
  - 'color' draw on a scratch canvas pre-loaded with the placed-reference footprint, transferred by 'source-atop' before the destination-in mask
  - Both-or-neither persisted colorize/colorizeMix pair threaded through replay, payload clone, rail-set duplicate, undo settlement, bridge equality and save/load

affects: [reveal-edit-mode, phase-53, compositor-work]

actuals:
  tokens: 16476
  tasks: 2
  commits: 2
plan_head_before: 4e84d2615c1423d84475bb29425bdbe676db785b
plan_head_after: 18da7276b79c31af1b5b4ec235a47c568c478e79

tech-stack:
  added: []
  patterns:
    - "Scratch-canvas tint: build the tint on a copy pre-loaded with the SAME placed-reference footprint, then transfer with 'source-atop' so the tint never adds coverage"
    - "Both-or-neither optional identity: presence mismatch is a parse/settlement rejection, absence writes no keys"

key-files:
  created: []
  modified:
    - app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptRenderer.ts
    - app/src/components/physic-paint/roto/physicsPaintRotoPhysicalModel.ts
    - app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.ts
    - app/src/components/physic-paint/view/PhysicsPaintPlayScriptDialog.tsx
    - app/src/components/physic-paint/hooks/useRotoPhysicalEditCoordinator.ts
    - app/src/components/physic-paint/roto/physicsPaintRotoRailSetCopy.ts
    - app/src/components/physic-paint/hooks/useRotoPhysicalEditHistory.ts
    - app/src/stores/efxPaintStore.ts
    - app/src/stores/physicPaintStore.ts

key-decisions:
  - "Tint on a scratch canvas pre-loaded with the placed-reference footprint and transfer with 'source-atop' (alpha_o = alpha_b) instead of tinting the output directly — a direct 'color' draw would deposit alpha outside the photo and be squared by the final destination-in mask"
  - "Keep colorize/colorizeMix out of encodeCanonicalLoopClips: the fingerprint is a fixed term list with a Rust mirror, and the saved revision stays byte-identical"
  - "Persist the pair both-or-neither and only when enabled, so an off reveal writes exactly today's keys"
  - "Resolve the mount-time dialog by extending the existing reveal side stack after motionCard; no new card ordering or style rule"

patterns-established:
  - "Optional persisted member added end-to-end: allowlist + validator + parser + writer + clone + duplicate + settlement + bridge + save/load, with the allowlist and writer in the same commit"
  - "Op-ledger tests assert composite order (reference -> source-atop transfer -> destination-in last) and canvas counts to pin the off-path byte identity"

requirements-completed: []

coverage:
  - id: D1
    description: "Reveal bake tints with the per-stroke wash pigment at the chosen mix, on a scratch copy, transferred by source-atop before a final globalAlpha-1 destination-in mask"
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/roto/physicsPaintRotoRevealBake.test.ts#renderRotoRevealFrames colorize (261029-vbp)"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptRenderer.test.ts#261029-vbp: tints a scratch copy and transfers it with source-atop BEFORE the destination-in mask"
        status: pass
    human_judgment: false
  - id: D2
    description: "Colorize off, false or mix 0 produces today's op ledger with no scratch canvas and no tint draw; no new record keys are written"
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/roto/physicsPaintRotoRevealBake.test.ts#261029-vbp off path"
        status: pass
      - kind: unit
        ref: "app/src/stores/efxPaintStore.reveal.test.ts#261029-vbp: a default creation writes no colorize keys and never asks the bake for a tint"
        status: pass
    human_judgment: false
  - id: D3
    description: "The mix is a clamped integer 0-100, defaults to 100 on enable, and resets to off/100 on every apply-mode open"
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.test.ts#261029-vbp controller colorize tests"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/view/PhysicsPaintPlayScriptDialog.test.ts#261029-vbp Colorize card tests"
        status: pass
    human_judgment: false
  - id: D4
    description: "The persisted pair survives a fail-closed parse, replay, payload clone, rail-set duplicate, undo settlement, bridge equality and project save/load"
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/roto/physicsPaintRotoLoopClips.test.ts#261029-vbp reveal colorize pair"
        status: pass
      - kind: unit
        ref: "app/src/stores/efxPaintStore.reveal.test.ts#261029-vbp: replay re-bakes a colorized rail with its persisted tint pair"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/hooks/useRotoPhysicalEditCoordinator.test.ts#round-trips railKind + the stamped lifecycle (G-52-4)"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/roto/physicsPaintRotoRailSetCopy.test.ts#RED 2reveal"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/hooks/useRotoPhysicalEditHistory.test.ts#261029-vbp: a before/after differing only in the colorize mix settles as a real edit"
        status: pass
      - kind: unit
        ref: "app/src/lib/physicPaintBridge.test.ts#retains the complete physical document through close sync and child reopen hydration"
        status: pass
      - kind: unit
        ref: "app/src/efx-paint/document/efxPaintDocumentParsers.reveal.test.ts#261029-vbp: a colorized reveal clip round-trips its pair through save/load"
        status: pass
    human_judgment: false
  - id: D5
    description: "Live visual behavior: photo luminance detail survives the tint, per-stroke wash colours stay distinct, 30% sits between photo and wash, 0% matches unchecked, and no wash-coloured spill appears outside a scaled/panned photo"
    verification: []
    human_judgment: true
    rationale: "Colour and silhouette fidelity on the live Studio canvas are perceptual; the op-ledger pins the composite order but cannot judge whether the revealed sea reads red with wave detail intact."
  - id: D6
    description: "Live project reopen plus undo/redo and duplicate/paste on a colorized reveal rail"
    verification: []
    human_judgment: true
    rationale: "Requires the packaged app to save, close, reopen and replay a real project; automated tests prove the data path but not the live window."

duration: 51min
completed: 2026-10-29
status: complete
---

# Quick 261029-vbp: Reveal Colorize Summary

**Reveal gains a Colorize option: the revealed photo takes each stroke's wash pigment at an integer 0-100 mix via a scratch `'color'` draw and a `'source-atop'` transfer before the unchanged destination-in mask, with the persisted pair riding replay, clones, duplicates, undo, bridge and save/load.**

## Performance

- **Duration:** 51 min
- **Started:** 2026-10-29T21:29:29Z
- **Completed:** 2026-10-29T22:18:46Z
- **Tasks:** 2
- **Files modified:** 20 (12 in Task 1, 10 in Task 2, 2 overlap)

## Accomplishments

- Renderer tints on a scratch canvas pre-loaded with the SAME placed-reference footprint (`drawPlacedReference`), transfers it with `'source-atop'` at `globalAlpha 1`, then runs the `destination-in` wash-alpha mask last — so the silhouette and every edge stay byte-identical and no tint can land outside the placed photo (0 outside the footprint at every mix).
- The colorize pair is allowlisted, validated both-or-neither (boolean + integer 0-100), parsed fail-closed and written only when enabled; `encodeCanonicalLoopClips` is untouched, so a colorized project's saved revision is byte-identical to a plain one.
- Controller holds `colorize`/`colorizeMix` signals with clamped writes (100 on enable, off/100 on every apply-mode open); the dialog renders a Colorize card on the Reveal tab only, after the Motion card, with the mix slider disabled while unchecked or busy.
- Durability: replay re-bakes with the persisted pair; `cloneLoopClips` and `buildDuplicatedLoopClip` round-trip it; `snapshotRecordsEqual` treats a mix-only difference as a real edit and identical pairs as no-op; the bridge verifies with the pair present; save/load preserves it.

## Task Commits

Each task was committed atomically:

1. **Task 1: End-to-end colorize tracer** - `b0ecf38e` (feat)
2. **Task 2: Persistence durability** - `18da7276` (fix)

Plan metadata commit is handled by the orchestrator (docs artifacts are not committed by the executor).

## Files Created/Modified

- `app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptRenderer.ts` - `colorize`/`colorizeMix` render input, `resolveRevealColorizeMix`, `drawPlacedReference`, `buildRevealTint`, `'source-atop'` transfer in `compositeRevealMask`
- `app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptRenderer.test.ts` - re-pinned `compositeRevealMask` arity and the source contract (order, `'color'`, `'source-atop'`, `colorizeMix / 100`)
- `app/src/components/physic-paint/roto/physicsPaintRotoRevealBake.test.ts` - op-ledger tests for off/mix 0/mix 100/mix 40/clamp/NaN, canvas counts, order and the shared posed coverage canvas
- `app/src/components/physic-paint/roto/physicsPaintRotoPhysicalModel.ts` - clip fields, allowlist keys, both-or-neither validator, conditional parser projection
- `app/src/components/physic-paint/roto/physicsPaintRotoLoopClips.test.ts` - pair round-trip, absence, half-pair and range rejections, v1.0 persistence
- `app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.ts` - signals, clamps, reset on open, port object on confirm
- `app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.test.ts` - defaults/reset, 100-on-enable, clamps, confirm payload
- `app/src/components/physic-paint/view/PhysicsPaintPlayScriptDialog.tsx` - Colorize card rendered after the Motion card on the Reveal tab only
- `app/src/components/physic-paint/view/PhysicsPaintPlayScriptDialog.test.ts` - card presence, checkbox/slider wiring, Paint-tab absence
- `app/src/components/physic-paint/hooks/useRotoPhysicalEditCoordinator.ts` - conditional pair copy in `cloneLoopClips`
- `app/src/components/physic-paint/hooks/useRotoPhysicalEditCoordinator.test.ts` - G-52-4 test now carries the pair through the staged payload
- `app/src/components/physic-paint/roto/physicsPaintRotoRailSetCopy.ts` - conditional pair copy in `buildDuplicatedLoopClip`
- `app/src/components/physic-paint/roto/physicsPaintRotoRailSetCopy.test.ts` - duplicate keeps the pair, source clip unchanged
- `app/src/components/physic-paint/hooks/useRotoPhysicalEditHistory.ts` - pair comparisons in `snapshotRecordsEqual`
- `app/src/components/physic-paint/hooks/useRotoPhysicalEditHistory.test.ts` - lifecycle clip carries the pair; mix-only change detected; identical pairs not recorded
- `app/src/stores/physicPaintStore.ts` - `RevealBakeInput` pair fields passed to `renderRotoRevealFrames`
- `app/src/stores/efxPaintStore.ts` - `normalizeRevealColorizeMix`, `createRevealRail` writer, `replayRevealRail` reads the persisted pair
- `app/src/stores/efxPaintStore.reveal.test.ts` - creation threads the pair, default creation writes none, replay re-bakes, non-colorized replay sends no tint
- `app/src/lib/physicPaintBridge.test.ts` - close-sync/reopen fixture carries the pair and verifies
- `app/src/efx-paint/document/efxPaintDocumentParsers.reveal.test.ts` - save/load round-trip plus fingerprint-unchanged assertion

## Decisions Made

- Scratch canvas + `'source-atop'` rather than tinting the output: preserves destination alpha by definition, so colorize can never add coverage.
- Extracted `drawPlacedReference` so the tint footprint is literally the same op sequence as the photo draw — a divergent footprint would grow the silhouette.
- The pair stays out of the canonical fingerprint (no Rust mirror), proven by a test asserting identical revisions with and without it.
- Skipped the tint branch entirely when the resolved mix is 0, so the off path allocates no scratch canvas.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Controller test mock had no declared input parameter**
- **Found during:** Task 1 typecheck
- **Issue:** `createReveal.mock.calls[0]![0]` failed with TS2493 (`Tuple type '[]' has no length '0'`) because the `vi.fn(async () => ...)` mock declared no parameter.
- **Fix:** Declared the input shape on the mock (`async (_input: { colorize?: boolean; colorizeMix?: number }) => ...`), matching the pattern already used by neighbouring tests.
- **Files modified:** `app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.test.ts`
- **Verification:** `pnpm --filter efx-motion-editor run typecheck` clean; suite 154/154 green.
- **Committed in:** `b0ecf38e` (Task 1)

### Process note (not a code deviation)

Task 2's production edits landed before its tests were extended, so RED was established by temporarily reverting the four production hunks: exactly 4 tests failed, one per anchor (replay, payload clone, rail-set duplicate, settlement), with no unrelated failures; restoring the hunks returned 380/381 green (1 pre-existing skip). The bridge and document-parser assertions pass both ways because Task 1's parser already preserves the pair — they are durability assertions, not implementation guards.

### Scope held

No flat colour picker, no canonical fingerprint change, no Rust edit, no compositor/export change, no `PhysicsPaintStudio.tsx` edit, no new dependency, no CSS restyle.

**Total deviations:** 1 auto-fixed (Rule 1)
**Impact on plan:** Test typing only; no behavior change.

## Issues Encountered

- None. The pre-existing `viteBuild` chunk-budget test and the full app suite passed unchanged.

## Verification

- Task 1 suites: 6 files, 365 tests passed.
- Task 2 suites: 6 files, 380 passed, 1 pre-existing skip.
- Typecheck: `tsc --noEmit` clean.
- Full regression: `vitest run` - 355 files passed (2 skipped), 6398 tests passed, 1 skipped, 96 todo, 0 failed.
- Executor status: **automated-ready**, not done — the eight native UAT rows require the live app and the user.

## Next Phase Readiness

- Native UAT rows 1-8 from the plan are ready for the user's live run (dialog placement, visual parity off, wash tint at 100/30/0, per-stroke variety, scaled/panned footprint, reopen + undo/redo, duplicate/paste).
- The three pair-blind comparisons recorded in the plan (`snapshotCanonicalContentEqual`, `railSetCopyLoopMemberEqual`, `sameLoopClipCollections`) remain untouched by design; extending them belongs to the reveal edit-mode phase where the mix can change after creation.

---
*Quick: 261029-vbp*
*Completed: 2026-10-29*

## Self-Check: PASSED

- `b0ecf38e` is an ancestor of HEAD (Task 1 commit exists)
- `18da7276` is an ancestor of HEAD (Task 2 commit exists)
- `261029-vbp-SUMMARY.md` written to the required path
