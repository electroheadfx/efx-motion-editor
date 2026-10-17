---
phase: quick-261017-dc2
plan: 261017-dc2
subsystem: physic-paint
tags: [validator, parser, paper, physic-paint, roto, parity-pin, vitest]

# Dependency graph
requires:
  - phase: 56-05
    provides: "PAPER-01 — paper/${string} as first-class PhysicPaintRotoBackgroundMode + apply-payload validator migration"
provides:
  - "document-parser background validator accepts paper/* (live throw site unblocked)"
  - "_writePaperDisplay never writes background: '' — legal 'transparent' no-paper encoding + explicit clear arm"
  - "parity pin physicsPaintRotoBackgroundValidatorParity.test.ts locking both background contracts to identical accept/reject sets"
affects: [physic-paint, studio-navigation, paper-display, background-metadata]

actuals:
  tokens: 5200
  tasks: 1
  commits: 1

tech-stack:
  added: []
  patterns:
    - "duplicated one-liner acceptance check instead of a shared predicate (avoids a runtime import cycle types/physicPaint.ts <-> physicsPaintRotoPhysicalModel.ts)"
    - "parity pin test as the anti-divergence mechanism between two validators that must accept identical sets"

key-files:
  created:
    - app/src/components/physic-paint/roto/physicsPaintRotoBackgroundValidatorParity.test.ts
  modified:
    - app/src/components/physic-paint/roto/physicsPaintRotoPhysicalModel.ts
    - app/src/stores/physicPaintStore.ts
    - app/src/components/physic-paint/roto/physicsPaintRotoBackgroundGrainOff.test.ts

key-decisions:
  - "Duplicate the paper/ acceptance one-liner in isPhysicPaintRotoBackground (module-private stays module-private); parity pin is the anti-divergence lock — no shared predicate (import cycle)"
  - "Strength/scale-only edit on a non-paper source is a no-op (return false), never a transparent track mirror (would hide a solid-colour document fond)"
  - "Explicit paperId 'transparent' writes { mode: 'transparent' } + a transparent track mirror (legal no-paper encoding)"

patterns-established:
  - "Two validators on one type union stay locked by a parity pin test, not by extracting a shared predicate across a type-import cycle"

requirements-completed: []

coverage:
  - id: D1
    description: "Document parser accepts paper/* backgrounds — parsePhysicPaintRotoPhysicalDocument no longer throws on a paper-backed document"
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/roto/physicsPaintRotoBackgroundValidatorParity.test.ts#PARITY ACCEPT"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/roto/physicsPaintRotoBackgroundGrainOff.test.ts"
        status: pass
    human_judgment: false
  - id: D2
    description: "_writePaperDisplay never writes background: '' — legal 'transparent' encoding + explicit clear arm + strength/scale no-op"
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/roto/physicsPaintRotoBackgroundValidatorParity.test.ts#NO EMPTY-STRING WRITE"
        status: pass
      - kind: unit
        ref: "app/src/stores/physicPaintStore.paper.test.ts"
        status: pass
    human_judgment: false
  - id: D3
    description: "Both validators accept/reject the identical sets, grainStrength/grainScale stay fail-closed"
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/roto/physicsPaintRotoBackgroundValidatorParity.test.ts#PARITY REJECT + GRAIN RANGE"
        status: pass
    human_judgment: false
  - id: D4
    description: "Live PHYSIC PAINT STUDIO navigation on a paper-backed layer (timeline frame click, key-rail click, paper picker, grain edit)"
    verification: []
    human_judgment: true
    rationale: "Cross-webview / Tauri live navigation crash — vitest is blind to the Studio webview path; the user judges the six UAT rows in the live app"

# Metrics
duration: 15min
completed: 2026-10-17
status: complete
---

# Quick 261017-dc2: Fix validator divergence (document parser) Summary

**Document-parser background validator now accepts `paper/*` (same arm as the apply-payload validator), and `_writePaperDisplay` never writes an empty-string background — PHYSIC PAINT STUDIO navigation on paper-backed layers is unblocked, pinned by a parity suite.**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-10-17T09:48:00Z
- **Completed:** 2026-10-17T10:05:00Z
- **Tasks:** 1
- **Files modified:** 4

## Accomplishments

- `isPhysicPaintRotoBackground` (physicsPaintRotoPhysicalModel.ts) mirrors the `startsWith('paper/')` acceptance arm of `isPhysicPaintRotoBackgroundMetadata` — `parsePhysicPaintRotoPhysicalDocument` no longer throws `invalid background metadata` on a `paper/*` background (the live Studio navigation death).
- `_writePaperDisplay` (physicPaintStore.ts) falls back to the legal `'transparent'` no-paper encoding instead of `''`; a strength/scale-only edit on a non-paper source is an explicit no-op; an explicit `paperId: 'transparent'` writes `{ mode: 'transparent' }` + a transparent track mirror.
- New parity pin `physicsPaintRotoBackgroundValidatorParity.test.ts` locks both contracts to the identical accept set (`transparent`, `white`, `canvas1/2/3`, `paper/cold-press`, `paper/real-1`) and reject set (`photo`, `''`, `grainStrength: 2`, missing `grainStrength`, `grainScale: 0`, `grainScale: 11`).
- Grain-off suite reject block extended with the empty-string shape (existing cases byte-untouched).
- `app/src/types/physicPaint.ts` byte-untouched; grainStrength/grainScale range checks stay fail-closed in both validators.

## Task Commits

Each task was committed atomically:

1. **Task 1: accept paper/* in the document parser + never write an empty-string background** - `1876f4b3` (fix)

## Files Created/Modified

- `app/src/components/physic-paint/roto/physicsPaintRotoPhysicalModel.ts` - `isPhysicPaintRotoBackground` gains the `paper/` arm (still module-private)
- `app/src/stores/physicPaintStore.ts` - `_writePaperDisplay` legal `'transparent'` placeholder + no-op arm + explicit transparent clear
- `app/src/components/physic-paint/roto/physicsPaintRotoBackgroundValidatorParity.test.ts` - NEW parity pin (7 accept + 4 reject + 2 grain-range + 2 write-path cases)
- `app/src/components/physic-paint/roto/physicsPaintRotoBackgroundGrainOff.test.ts` - reject block extended with `background: ''`

## Acceptance shape used

Parser (`isPhysicPaintRotoBackground`) — mirrors `isPhysicPaintRotoBackgroundMetadata` (types/physicPaint.ts:2436):

```ts
const backgroundOk =
  value.background === 'transparent'
  || value.background === 'white'
  || value.background === 'canvas1'
  || value.background === 'canvas2'
  || value.background === 'canvas3'
  || (typeof value.background === 'string' && value.background.startsWith('paper/'));
```

Write arm (`_writePaperDisplay`): `nextBackground === 'transparent' && edit.paperId === undefined` → return false (no write); `edit.paperId === 'transparent'` → `setBackgroundFallback(layerId, { mode: 'transparent' })` + mirror `{ background: 'transparent', grainStrength, grainScale }`; otherwise the existing `mode: 'paper'` arm unchanged.

## Decisions Made

- Duplicated the one-liner acceptance check rather than extracting a shared predicate — `types/physicPaint.ts` value-imports from the model while the model type-imports back; a value import would create a runtime cycle. The parity pin is the anti-divergence mechanism.
- Strength/scale-only edit on a non-paper source is a no-op (no write), not a transparent track mirror — `_resolveFondSource` returns null on a transparent mirror and never falls through, which would hide a solid-colour document fond.
- Kept `isPhysicPaintRotoBackground` module-private; the pin tests through the exported `parsePhysicPaintRotoPhysicalDocument`.

## Deviations from Plan

None - plan executed as written.

Note on RED evidence: the plan predicted the empty-string write leg would fail today. The strength/scale-only behavioural leg was already green at RED (`setBackgroundFallback` is a second gate that rejects `''` as an illegal `PaperTexture`, so the illegal value was constructed but never persisted). The write-arm failure that was actually RED is the explicit `setPaperId(layer, 'transparent')` clear (returned `false`, wrote nothing) — that leg is in the pin and is now green. The production fix still removes the `''` construction exactly as specified.

## Issues Encountered

None.

## Live UAT (user-run — status stays automated-ready until these pass)

1. Open PHYSIC PAINT STUDIO
2. Click a different timeline frame → playhead moves
3. Click a key-rail key → playhead moves and the key highlights
4. Select a procedural paper (e.g. Cold Press) in the Paper picker → no console rejection of `invalid background metadata`
5. With a paper selected, click another frame → still navigates
6. Change only Grain strength → still no rejection

## Verification

- Four plan suites green: `physicsPaintRotoBackgroundValidatorParity.test.ts` (5 tests), `physicsPaintRotoBackgroundGrainOff.test.ts` (3), `physicsPaintRotoPhysicalModel.test.ts` (4), `physicPaintStore.paper.test.ts` (8) — 20 passed.
- Full suite `pnpm vitest run` from `app/`: **5157 passed | 1 skipped | 96 todo** (297 files passed, 2 skipped). Parity test collected and ran (`.test.ts`, not `.test.tsx`).
- Guardrails: `git diff app/src/types/physicPaint.ts` empty; `git diff app/package.json app/vitest.config.ts` empty; diff confined to the four plan files.

## Next Steps

- User runs the six live UAT rows above.
- Out of scope (untouched): paperPass, engineBgMode, PaperPicker, AquarelleCanvasLayer, PhysicsPaintTopBar, PhysicsPaintRightPanel, SPECS/v1.1.0-water-color/phase-55-issues rows.

## Self-Check: PASSED

- FOUND: app/src/components/physic-paint/roto/physicsPaintRotoPhysicalModel.ts
- FOUND: app/src/stores/physicPaintStore.ts
- FOUND: app/src/components/physic-paint/roto/physicsPaintRotoBackgroundValidatorParity.test.ts
- FOUND: app/src/components/physic-paint/roto/physicsPaintRotoBackgroundGrainOff.test.ts
- FOUND: 1876f4b3 (ancestor of HEAD)

---
*Phase: quick-261017-dc2*
*Completed: 2026-10-17*
