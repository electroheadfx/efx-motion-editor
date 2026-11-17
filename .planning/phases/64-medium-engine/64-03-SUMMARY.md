---
phase: 64-medium-engine
plan: 03
subsystem: engine
tags:
  - watercolor
  - medium
  - thickness
  - relief
  - emboss
  - lift
  - undo
  - webgl2
  - probe
  - tdd

# Dependency graph
requires:
  - phase: 64-medium-engine (plan 01)
    provides: the committed neutral-identity probe baseline and the seeded probe harness this plan extends
  - phase: 64-medium-engine (plan 02)
    provides: emboss in the canonical 0..100 bag and the engine 0..1 Params bag through the ONE clamp01 mapping
provides:
  - A document-resolution HALF_FLOAT_R thickness target (`relief`) in docTargets, cleared by the sheet wipe and resetSheet
  - reliefFS, mirroring stampFS's thirteen footprint uniforms plus uAmount through one shared bindFootprint helper
  - The per-dab deposit law (reliefAmount = P.emboss × that dab's ink amount, additive ONE/ONE) and Lift erosion under ZERO/ONE_MINUS_SRC_COLOR
  - The three-way positional undo pairing (pool-0 formats, snapshotLayers, travel layer map) and the WholeDoc relief carry
  - The probe `--emboss <0..100>` knob and the emboss-100 replay determinism row
affects:
  - 64-04 (lights the thickness gradient in the composite)
  - 64-06 (the cover pass erodes the field through the same draw)
  - 64-07 (every render path reads the lit thickness)
  - 64-09 (the intensity controls)
  - 64-10 (the no-additional-target cost pin references the relief entry)

# Actuals (#2632) — chars/4 over the realized diff, never a harness token count
actuals:
  tokens: 11329
  tasks: 3
  commits: 5
  plan_head_before: 0f869915d536fd55b6150e7aa87737f05ec52f8f
  plan_head_after: b9a5c2e7d6a8d7dd2248b036564f918941620ddf

# Tech tracking
tech-stack:
  added: []
  patterns:
    - One document-resolution single-channel target beside the other document targets, LAST in docTargets so the sheet wipe covers it
    - Three-list positional pairing for undo (pool-0 formats, snapshotLayers, travel layer map) with a single-framebuffer entry for a non-ping-pong layer
    - One shared footprint-binding helper so two programs (stamp and relief) cannot drift in uniforms
    - An optional-rect/brush/zeroed-jitter draw so an erosion reuses the identical rect and amount as the pigment lift
    - A probe knob that folds a value into the fixed stroke's canonical bag while keeping the gate name and baseline untouched

key-files:
  created:
    - packages/efx-watercolor/src/playground/relief.test.ts
  modified:
    - packages/efx-watercolor/src/playground/Engine.ts
    - packages/efx-watercolor/src/playground/shaders.ts
    - packages/efx-watercolor/src/determinismContract.test.ts
    - packages/efx-watercolor/probe/medium-engine/probe.ts
    - packages/efx-watercolor/probe/medium-engine/run.mjs

key-decisions:
  - "The thickness target is a single HALF_FLOAT_R target, not a ping-pong pair: nothing advects it, and History.swap reads fbs[0] and writes every framebuffer, so a one-element entry in travel()'s pool-0 map is the correct pairing."
  - "The stamp footprint binding was extracted into bindFootprint and is shared by drawStamp and drawRelief, so the relief program cannot drift from the pigment footprint; drawRelief takes optional brush, rect, rough and jitter so Lift can reuse the lift brush, the lift rect and zeroed grain/rough/jitter — the eroded mask then equals liftFS's."
  - "The deposit is guarded with `if (reliefAmount > 0)`, so emboss 0 takes no GL path at all — bit-identity for the render and for the undo history is structural, not numerical."
  - "resizeDocument forward-copies the overlapping thickness (Rule 2): the plan's must_have requires a size change to keep relief, and without the copy the field would silently zero on every resize."
  - "Both probe runs keep the gate name neutral-identity: the plan forbids inventing a second gate name for a neutral scenario because only the plan-01 baseline exists as a committed reference; the emboss value is echoed in the report and the URL only."
  - "The RED evidence records were gate artifacts (persisted for validation, then removed), matching 64-01/64-02; their verdicts and targets are recorded in the TDD Gate Compliance section below."
  - "Emboss input is validated at both ends: run.mjs rejects a non-0..100 value before launching Chrome, and probe.ts rejects it again with a FAIL verdict so a hand-crafted URL cannot silently run a different script."

patterns-established:
  - "New document state joins as: one target, last in docTargets, one WholeDoc layer with an explicit channel count, and one positional undo entry — the three lists edited in the same commit and pinned by a length/index test."
  - "Cross-program footprint parity is enforced by extracting the uniform binding and scanning both shader bodies for the same uniform set, rotation formula and paper-tooth gate."
  - "Engine-only state is proven engine-only by scanning every other module and the Rust sources for the layer name, not by asserting the absence in prose."

requirements-completed: [MED-14, MED-16, MED-18]

# Coverage metadata (#1602)
coverage:
  - id: D1
    description: "One document-resolution HALF_FLOAT_R thickness target exists beside the other document targets, is listed last in docTargets so the sheet wipe and resetSheet clear it, and is named by no app module and no Rust file — it is never persisted."
    requirement: MED-14
    verification:
      - kind: unit
        ref: "packages/efx-watercolor/src/playground/relief.test.ts#allocates exactly one document-resolution HALF_FLOAT_R target in allocateTargets"
        status: pass
      - kind: unit
        ref: "packages/efx-watercolor/src/playground/relief.test.ts#lists the thickness target LAST in docTargets, so the sheet wipe clears it"
        status: pass
      - kind: unit
        ref: "packages/efx-watercolor/src/playground/relief.test.ts#no module and no Rust file outside the engine names the thickness layer"
        status: pass
    human_judgment: false
  - id: D2
    description: "The undo pool, snapshotLayers() and travel()'s layer map carry the thickness view at the same last index, WholeDoc captures it as one channel and uploads it as gl.RED, and a resize copies the overlapping thickness forward."
    requirement: MED-18
    verification:
      - kind: unit
        ref: "packages/efx-watercolor/src/playground/relief.test.ts#keeps pool 0's formats, snapshotLayers() and the undo layer map the same length with thickness last"
        status: pass
      - kind: unit
        ref: "packages/efx-watercolor/src/playground/relief.test.ts#adds 'relief' to the LayerId union and the WholeDoc layer record"
        status: pass
      - kind: unit
        ref: "packages/efx-watercolor/src/playground/relief.test.ts#captures the layer as a single channel and uploads it back as gl.RED"
        status: pass
      - kind: unit
        ref: "packages/efx-watercolor/src/playground/relief.test.ts#copies the overlapping thickness forward on a resize"
        status: pass
    human_judgment: false
  - id: D3
    description: "reliefFS mirrors stampFS's footprint exactly (thirteen uniforms, tip mapping, rotation, dry re-threshold, paper-tooth gate) and each brush dab deposits its own amount once per dab, after the ink and before the wet branch; pen and vector deposit nothing."
    requirement: MED-14
    verification:
      - kind: unit
        ref: "packages/efx-watercolor/src/playground/relief.test.ts#declares exactly the stamp footprint uniforms plus uAmount, and one output"
        status: pass
      - kind: unit
        ref: "packages/efx-watercolor/src/playground/relief.test.ts#applies the same paper-tooth gate, rotation and dry re-threshold as stampFS"
        status: pass
      - kind: unit
        ref: "packages/efx-watercolor/src/playground/relief.test.ts#binds the footprint from one private helper shared by the stamp and the relief draw"
        status: pass
      - kind: unit
        ref: "packages/efx-watercolor/src/playground/relief.test.ts#deposits once per dab inside the brush callback, after the ink and before the wet branch"
        status: pass
      - kind: unit
        ref: "packages/efx-watercolor/src/playground/relief.test.ts#blends the deposit additively and draws only into the thickness target"
        status: pass
      - kind: unit
        ref: "packages/efx-watercolor/src/playground/relief.test.ts#no step, fill or pen path reads or writes the thickness target"
        status: pass
    human_judgment: false
  - id: D4
    description: "Lift erodes thickness with the same rect and amount it erodes pigment with, under the already-bound ZERO / ONE_MINUS_SRC_COLOR, with grain, roughness and jitter zeroed for liftFS mask parity."
    requirement: MED-16
    verification:
      - kind: unit
        ref: "packages/efx-watercolor/src/playground/relief.test.ts#Lift erodes thickness with the same rect and amount under ZERO / ONE_MINUS_SRC_COLOR"
        status: pass
      - kind: unit
        ref: "packages/efx-watercolor/src/playground/relief.test.ts#draws relief from exactly two call sites: the guarded deposit and the Lift erosion"
        status: pass
    human_judgment: false
  - id: D5
    description: "The new target, program and per-dab seam leave the real WebGL2 render byte-identical to the plan-01 baseline both at emboss 0 and at emboss 100 — the deposit exists but nothing reads it yet."
    requirement: MED-16
    verification:
      - kind: e2e
        ref: "node packages/efx-watercolor/probe/medium-engine/run.mjs --gate neutral-identity --emboss 0 && node packages/efx-watercolor/probe/medium-engine/compare.mjs neutral-identity (PASS, 6/6 fields equal)"
        status: pass
      - kind: e2e
        ref: "node packages/efx-watercolor/probe/medium-engine/run.mjs --gate neutral-identity --emboss 100 && node packages/efx-watercolor/probe/medium-engine/compare.mjs neutral-identity (PASS, 6/6 fields equal)"
        status: pass
    human_judgment: false
  - id: D6
    description: "An embossed stroke replays identically and the recorded canonical bag carries the emboss that drove the deposit into the engine's 0..1 mapping."
    requirement: MED-18
    verification:
      - kind: unit
        ref: "packages/efx-watercolor/src/determinismContract.test.ts#replays identically with emboss 100 and carries the value"
        status: pass
    human_judgment: false
  - id: D7
    description: "Undo and redo of a stroke that changed thickness restore the field exactly, and a later redo restores the same deposited or eroded value (the plan's named backstop row)."
    requirement: MED-18
    verification: []
    human_judgment: true
    rationale: "vitest has no real WebGL2 surface, so the actual half-float field restore on a live sheet cannot be observed in the suite; the positional pairing and snapshot/restore paths are pinned structurally, but the live undo/redo of a thick stroke is the plan's declared UAT backstop row."
  - id: D8
    description: "Replay rebuilds thickness from the stroke script alone — a reopened document repaints the same relief without any persisted thickness field (the plan's named backstop row)."
    requirement: MED-14
    verification: []
    human_judgment: true
    rationale: "Proven structurally that no app module or Rust file names the layer and that replays are deterministic, but only a live reopen-and-replay on a real GPU can confirm the repainted field visually matches."
  - id: D9
    description: "The package builds with no TypeScript error and the full package suite is green."
    verification:
      - kind: other
        ref: "pnpm --filter @efxlab/efx-watercolor build (exit 0)"
        status: pass
      - kind: other
        ref: "pnpm --filter @efxlab/efx-watercolor exec vitest run (26 files, 466 passed, 8 skipped)"
        status: pass
    human_judgment: false

# Metrics
duration: 11min
completed: 2026-11-17
status: complete
---

# Phase 64 Plan 03: The paint thickness field, its footprint deposit and its positional undo pairing Summary

**One document-resolution half-float thickness channel deposited through every dab's own tip footprint, eroded by Lift, and carried positionally by undo, the sheet wipe, a resize and the whole-document snapshot — with the real WebGL2 render proven byte-identical at both emboss 0 and emboss 100**

## Performance

- **Duration:** 11 min
- **Started:** 2026-11-17T16:15:52Z
- **Completed:** 2026-11-17T16:26:36Z
- **Tasks:** 3
- **Files modified:** 6 (1 created, 5 modified)
- **Commits:** 5 measured (`0f869915..b9a5c2e7`)

## Accomplishments

- `Engine.relief` is a single document-resolution `HALF_FLOAT_R` target beside `wet`, last in `docTargets()` so `clear()` and `resetSheet()` wipe it with the sheet. It appears in `LayerId` and `WholeDoc.layers` (captured as one channel, uploaded as `gl.RED`), is copied forward on a resize, and is named by no app module and no Rust file — it is engine-only, never persisted state.
- Pool 0 of the undo history grew its fourth `HALF_FLOAT_R` layer positionally: `allocateHistory()`'s format list, `snapshotLayers()` and `travel()`'s layer map all carry it as the same last entry, and `travel()` pairs it as a one-element framebuffer list because `History.swap` reads `fbs[0]` and writes every framebuffer.
- `reliefFS` mirrors `stampFS`'s footprint exactly — the same thirteen uniforms, tip-space mapping, rotation formula, dry re-threshold and paper-tooth gate — with only `uAmount` added and one output. The binding lives in one `bindFootprint` helper shared by `drawStamp` and `drawRelief`, so the two programs cannot drift.
- Each brush dab deposits `P.emboss ×` its own ink amount once per dab, additively (`FUNC_ADD`, `ONE, ONE`) into the thickness target only, placed at the spec-06 seam comment between the ink and the wet branch. At emboss 0 the guard skips the draw entirely. Lift erodes the same rect and amount under the already-bound `ZERO, ONE_MINUS_SRC_COLOR`, with grain, roughness and jitter zeroed so the eroded mask equals `liftFS`'s. Pen and vector deposit nothing.
- The probe gained `--emboss <0..100>` and the determinism suite an emboss-100 row. Both probe pairs — emboss 0 and emboss 100 — match the committed plan-01 baseline field for field: the depot is provably inert in the composite until 64-04 lights it.

## Probe results (real WebGL2, headless Chrome, seeded constructor)

Sheet 256×256, paper preset `cold`, paperStrength 1, mutationId 0x6d65d1, ticks 0–8 then `fix()`, renderer "WebKit WebGL".

| Run | digestPaper | digestTransparent | digestWhite | byteLength | vs baseline (d1fd7ea3c) |
|-----|-------------|-------------------|-------------|------------|--------------------------|
| `--emboss 0` | `d2bd637a` | `291d4a11` | `6ba88334` | 262144 | equal on all 6 fields |
| `--emboss 100` | `d2bd637a` | `291d4a11` | `6ba88334` | 262144 | equal on all 6 fields |

The emboss-100 equality is the load-bearing invariant of this plan: the thickness field is deposited on every dab but no export path reads it yet, so any digest change would have meant the deposit was leaking into the pigment targets.

## T-64-08 measured GPU cost

- Document target: `dw × dh × 2` bytes for one R16F channel — 131,072 bytes at the probe's 256×256 sheet.
- History: one extra `HALF_FLOAT_R` layer in pool 0's atlas plus its scratch tile — `ceil(w/128) × ceil(h/128) × 128 × 128 × 2` atlas bytes + 32,768 scratch bytes — 163,840 bytes at 256×256.
- Total added at the probe sheet: 294,912 bytes (~288 KiB). Derived worst case at a 3072-long, ~4.2M-texel sheet: ~8.4 MB document + ~20 MiB atlas + 32 KiB scratch ≈ 28 MiB. No per-band, per-tip or height-texture allocation was added (pinned: exactly one new target, exactly one new pool-0 format entry).

## Task Commits

Each task was committed atomically (TDD tasks carry a RED test commit then a GREEN feat commit):

1. **Task 1: The thickness target and its positional undo pairing** — `bd7d8bdd3` (test, RED) → `dde6d0ede` (feat, GREEN)
2. **Task 2: Deposit through the dab's own footprint, and erode with Lift** — `c656a049f` (test, RED) → `abb9bc1e3` (feat, GREEN)
3. **Task 3: Prove the channel is inert until it is lit** — `b9a5c2e7d` (test)

**Plan metadata:** this SUMMARY commit (docs)

## Files Created/Modified

- `packages/efx-watercolor/src/playground/relief.test.ts` — 16 pins: target allocation, docTargets order, positional undo pairing, WholeDoc carry and resize copy, engine-only scanning (app + Rust), reliefFS footprint parity, the deposit law and blending, the Lift erosion, and the never-flows prohibitions
- `packages/efx-watercolor/src/playground/Engine.ts` — `LayerId` member `'relief'`, `WholeDoc.layers.relief`, the private target, pool-0 fourth format, `docTargets` last entry, capture/upload, resize copy, `travel`/`snapshotLayers` fourth entries, the `relief` program, `bindFootprint`, `drawRelief`, `brushRelief`, the guarded per-dab deposit and the Lift erosion
- `packages/efx-watercolor/src/playground/shaders.ts` — `reliefFS`, the exact `stampFS` footprint body with one `uAmount` output
- `packages/efx-watercolor/src/determinismContract.test.ts` — `makeStroke` gains the optional emboss key and the emboss-100 replay identity row
- `packages/efx-watercolor/probe/medium-engine/probe.ts` — `makeStroke(emboss?)`, `run(gate, renderer, emboss?)`, `readEmboss()` 0..100 validation, `emboss` echoed (never folded into the compared fields)
- `packages/efx-watercolor/probe/medium-engine/run.mjs` — `--emboss <0..100>` parsing/validation and the URL pass-through, with the gate name and output path unchanged

## Decisions Made

- **Single target, not a ping-pong pair.** Nothing advects thickness, and `History.swap` reads `fbs[0]` and writes back to every framebuffer in the entry, so `travel()` pairs the layer as a one-element list — a two-element list would have been wrong (it would double-write a single target).
- **One footprint binder.** `bindFootprint` was extracted from `drawStamp` and is called by both programs; `uAspect` now reads `this.dw / this.dh`, which is the same value the previous code passed for doc-sized targets. `drawRelief` accepts optional brush, rect, roughness and jitter so Lift passes the lift brush, the lift rect and zeros — giving mask parity with `liftFS` instead of an approximate re-derivation.
- **The deposit is structurally guarded.** `if (reliefAmount > 0)` means emboss 0 executes no GL call at all, so the neutral path cannot accumulate a numerical zero or disturb blend state.
- **Resize keeps the field** (see Deviations): without the forward copy, every resize would have zeroed a document state the plan's must_haves require to survive.
- **Both probe runs keep the gate name `neutral-identity`.** The baseline file is the only committed reference; inventing a second name would have made the comparison impossible, so the value rides the URL and the report instead.
- **Invalid emboss is rejected twice** (before Chrome launches and again in the page) so a hand-edited URL cannot silently render a different deterministic script.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical functionality] Thickness is carried across a resize**
- **Found during:** Task 1 (the thickness target and its positional undo pairing)
- **Issue:** The plan's Task 1 action list added the target, the docTargets entry, the undo pairing and the WholeDoc carry, but not `resizeDocument`. The must_have explicitly requires that "a size change and a snapshot restore carry thickness ... so a resized or restored sheet keeps its relief"; without the copy the field would silently reset on every sheet resize.
- **Fix:** Added `relief: this.relief` to the `old` record and `copy(old.relief, [this.relief])` beside the existing document-target copies in `resizeDocument()`.
- **Files modified:** `packages/efx-watercolor/src/playground/Engine.ts`, `packages/efx-watercolor/src/playground/relief.test.ts`
- **Verification:** `relief.test.ts#copies the overlapping thickness forward on a resize` passes; the whole-document round-trip pin also passes.
- **Committed in:** `dde6d0ede` (Task 1 GREEN)

---

**Total deviations:** 1 auto-fixed (Rule 2). No Rule 1 or Rule 3 deviations; no architectural change.
**Impact on plan:** The fix is the minimum needed to satisfy the plan's own must_have, with no scope creep.

## TDD Gate Compliance

Both `tdd="true"` tasks ran RED → GREEN with no REFACTOR commit needed:

| Task | RED commit | GREEN commit | RED evidence |
|------|-----------|--------------|--------------|
| 1 — thickness target and undo pairing | `bd7d8bdd3` | `dde6d0ede` | exit 1, 7 of 8 pins failing; target `src/playground/relief.test.ts#thickness target allocation (MED-14) > allocates exactly one document-resolution HALF_FLOAT_R target in allocateTargets`; validated `RED_EVIDENCE_OK`. The eighth pin (docTargets order) was green at RED because the docTargets list can be scanned before the target exists; declared in the record's `semanticAssessment`. |
| 2 — footprint deposit and Lift erosion | `c656a049f` | `abb9bc1e3` | exit 1, 7 of 8 new pins failing; target `src/playground/relief.test.ts#reliefFS (MED-14) > declares exactly the stamp footprint uniforms plus uAmount, and one output`; validated `RED_EVIDENCE_OK`. The eighth (the two-call-site count) was green at RED and is declared in the `semanticAssessment`. |

The raw RED records were gate artifacts, persisted inside the project for validation and removed before the Task 3 commit, matching 64-01/64-02 (their verdicts and targets are recorded above). RED evidence was captured with Vitest's JUnit reporter and wrapped in the classifier's JSON record shape, as in 64-02. No vacuous RED: every failing pin asserts a positive landed value (a uniform name, a call-site count, a list length) before it can pass.

## Issues Encountered

- The plan's line numbers for `Engine.ts` had drifted from the live tree; every edit site was located by anchor text instead (and the test's slice anchors were chosen from those live positions).
- A bare `relief` / `thickness` token scan proved unusable — `thickness` already exists in app generator-lines stroke data and `relief` in the paper picker. The engine-only pin therefore scans for `layers.relief` outside `Engine.ts` and for `/relief/i` only over `app/src-tauri/src` Rust files (verified zero hits before writing the pin).
- The probe's `compare.mjs` reads only the digest fields, so the new `emboss` echo required no comparator change; the run/compare pair must stay adjacent because both captures write the same `/tmp/medium-engine/neutral-identity.json`.

## Declared behaviours (must not be contradicted in UAT)

- Thickness is destroyed by Lift, like paint.
- A stroke edge is thinner than its core by construction, so a lit lip at the stroke edge is expected and is tuned by intensity — it is not a defect.
- Thickness never changes colour, absorbance or hue.

## Row ledger (plan-owned rows)

- `MED-14.adjacency` — the deposit uses the dab's own footprint (shared `bindFootprint`, same uniforms and paper gate), pinned in `reliefFS (MED-14)` and `relief deposit (MED-14)`.
- `MED-14.empty` — emboss 0 deposits nothing at all, structurally guarded, pinned by the deposit guard scan and by the emboss-0 probe equality.
- `MED-14.ordering` — the deposit runs once per dab, after the ink and before the wet branch, pinned by the callback-order scan.
- `MED-18.adjacency` — pool-0 formats, `snapshotLayers()` and the undo layer map list the thickness view at the same last index, pinned by the length/index test.
- `MED-18.empty` — a sheet with no deposits restores an empty thickness field: the target is cleared by `docTargets()` and the snapshot restore path carries it (structural pins plus the empty-sheet replay arm).
- `MED-18.ordering` — undo then redo restores the deposited then the pre-stroke state in order: guaranteed by the per-tile copy-on-write pool pairing; the live check is UAT row D7.

## User Setup Required

None — no external service configuration required. The probe uses a locally installed Chrome/Chromium; no package or credential was added.

## Next Phase Readiness

- 64-04 can light the field: the target, the per-dab seam and the program all exist, and the plan-01 baseline proves nothing reaches the render before the composite does.
- 64-06's cover pass can erode through the same `drawRelief` path (the spec-06 seam comment marks the placement).
- Named UAT backstops for the verifier: (1) undo/redo of a stroke that changed thickness restores the field exactly, including redo of the same deposited or eroded value; (2) a reopened document replays the same relief from the stroke script alone, with no persisted thickness field.
- No blockers.

---

*Phase: 64-medium-engine*
*Completed: 2026-11-17*

## Self-Check: PASSED

- Verified all 6 plan files exist on disk (1 created, 5 modified) and the summary exists.
- Verified all 5 task commits (`bd7d8bdd3`, `dde6d0ede`, `c656a049f`, `abb9bc1e3`, `b9a5c2e7d`) are ancestors of HEAD.
- Verified `pnpm --filter @efxlab/efx-watercolor build` exits 0 and the full package suite is green (26 files, 466 passed, 8 skipped).
- Verified both probe pairs PASS against the committed baseline on all 6 fields.
