---
phase: 261030-np9-rail-key-scripts
plan: 01
subsystem: physic-paint-roto
tags: [preact, signals, aquarelle, roto, loop-clips, key-scripts, tdd]

requires:
  - phase: 261030-ig0
    provides: keyScriptEdits flag on the Loop Clip + the Create Rail opt-in card
provides:
  - per-key rail scripts recorded from the bake's own per-stroke start-frame anchors
  - onStrokeFrameAnchors seam in @efxlab/efx-watercolor/bake (fires once per bake, swallowed)
  - recordRailKeyScripts port — the Studio ledger is the sole mutation-id source
  - Key Script Editing card under Timing in column 1 on both Create Rail tabs
  - the ig0 per-key override model fully retired (26 files, no shim)
affects: [key-script-editing, reveal-rail, play-script, rail-key-scripts]

actuals:
  tokens: 62624
  tasks: 3
  commits: 7
  plan_head_before: 8cb900cbd298acc1c8b81953eb27bb4825395941
  plan_head_after: 24ccaef80f8a539d2e18587623e26fa6856cc680

tech-stack:
  added: []
  patterns:
    - "The bake is the ONE slicing authority: it reports the start frame it used per stroke; a pure slicer only decides which stroke lands on which committed key"
    - "Recording goes through a port so the Studio's paintMutationLedger stays the single mutation-id source"

key-files:
  created:
    - app/src/components/physic-paint/roto/physicsPaintRotoRailKeyScripts.ts
    - app/src/components/physic-paint/roto/physicsPaintRotoRailKeyScripts.test.ts
  modified:
    - packages/efx-watercolor/src/bake/aquarelleBake.ts
    - packages/efx-watercolor/src/bake/aquarelleBake.test.ts
    - app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptRenderer.ts
    - app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.ts
    - app/src/components/physic-paint/hooks/useRotoPlayScriptController.ts
    - app/src/components/physic-paint/PhysicsPaintStudio.tsx
    - app/src/stores/physicPaintStore.ts
    - app/src/stores/efxPaintStore.ts
    - app/src/components/physic-paint/view/PhysicsPaintPlayScriptDialog.tsx

key-decisions:
  - "D-02 static = complete drawing on every key; progressive = bucketed by start slot with last-started / first-later inheritance so every key owns a stroke"
  - "D-03 record into the existing aquarelle timeline — no schema change, no new serializer"
  - "D-04 mutation ids come from the ONE paintMutationLedger behind the recordRailKeyScripts port"
  - "D-05 gate on the PERSISTED keyScriptEdits flag, never the dialog signal; a re-bake replaces the cycle's scripts"
  - "D-06 OFF is byte-identical: zero purge, zero record, zero ids consumed"
  - "D-08 the card renders after the Timing/side-stack row without -wide, so 1fr/1fr puts it under Timing"
  - "D-09 replayRevealRail is deliberately not threaded"

requirements-completed: [QUICK-261030-NP9]

coverage:
  - id: D1
    description: "Option OFF (default): Create Rail behaves exactly as before; no frame script is touched"
    requirement: QUICK-261030-NP9
    verification:
      - kind: unit
        ref: "app/src/stores/efxPaintStore.reveal.test.ts#createRevealRail records each key's own slice when opted in and never records when off"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.test.ts#records each key's slice from the bake anchors only for an opted-in cycle"
        status: pass
    human_judgment: false
  - id: D2
    description: "Option ON, Motion: each key owns the stroke that starts on its frame (5-stroke/5-frame -> one stroke per key in script order)"
    requirement: QUICK-261030-NP9
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/roto/physicsPaintRotoRailKeyScripts.test.ts#progressive: the 5-stroke / 5-frame law puts stroke k on slot k in script order"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.test.ts#records each key's slice from the bake anchors only for an opted-in cycle"
        status: pass
    human_judgment: true
    rationale: "The slices are proven onto the committed keyIds, but the visible playback of one stroke per key and Move/Select availability on every key need the live Studio."
  - id: D3
    description: "Option ON, Static: every key owns the complete drawing"
    requirement: QUICK-261030-NP9
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/roto/physicsPaintRotoRailKeyScripts.test.ts#static: every key receives the complete drawing, each stroke projected onto that key frame"
        status: pass
    human_judgment: true
    rationale: "Same completeness argument on every key is asserted in the slicer; seeing the static rail hold the full wash on each key is a live check."
  - id: D4
    description: "Option ON, Reveal Motion/Static: the wash script is sliced the same way"
    requirement: QUICK-261030-NP9
    verification:
      - kind: unit
        ref: "app/src/stores/efxPaintStore.reveal.test.ts#createRevealRail records each key's own slice when opted in and never records when off"
        status: pass
    human_judgment: true
    rationale: "The store proves the slices land on the baked keyIds; the revealed wash per key must be looked at in the Studio."
  - id: D5
    description: "Per-key scripts survive save + reopen through the existing snapshot anchors with no new serializer"
    requirement: QUICK-261030-NP9
    verification: []
    human_judgment: true
    rationale: "Persistence rides the existing aquarelle timeline; no automated save/reopen round-trip exists for per-key scripts, so the user must save, reopen and inspect the keys."
  - id: D6
    description: "A re-bake of an opted-in rail replaces its cycle's scripts instead of leaving a stale one"
    requirement: QUICK-261030-NP9
    verification:
      - kind: unit
        ref: "app/src/stores/efxPaintStore.reveal.test.ts#createRevealRail records each key's own slice when opted in and never records when off"
        status: pass
    human_judgment: true
    rationale: "The purge-then-record seam is wired and the OFF path is pinned to zero calls, but replacement across two live applies needs a visible check."
  - id: D7
    description: "The Key Script Editing card sits directly below Timing in column 1 on both tabs"
    requirement: QUICK-261030-NP9
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/view/PhysicsPaintPlayScriptDialog.test.ts#261030-ig0: renders the Key Script Editing opt-in in apply mode only, defaulting unchecked"
        status: pass
    human_judgment: true
    rationale: "DOM order and the absence of -wide are pinned; the actual column position comes from the live 1fr/1fr grid and must be seen."
  - id: D8
    description: "Zero retired ig0 symbols, zero shims; tsc clean; every touched suite green"
    requirement: QUICK-261030-NP9
    verification:
      - kind: other
        ref: "grep -rEn 'PhysicPaintRotoKeyScriptOverride|keyScriptOverrides|rebakeRevealRailKey|key-edit|...' app/src packages/efx-watercolor/src packages/efx-paint-host/src -> no matches"
        status: pass
      - kind: other
        ref: "pnpm --filter efx-motion-editor exec tsc --noEmit -> clean"
        status: pass
    human_judgment: false

duration: 23min
completed: 2026-10-30
status: complete
---

# Quick 261030-np9: Create Rail "Save script on each key" Summary

**Each rail key now owns its own slice of the script — the bake reports the output frame it started every stroke on, and the slice is recorded as that key's aquarelle script; the ig0 per-key-override model is gone and the opt-in card sits under Timing.**

## Performance

- **Duration:** ~23 min (17:16 → 17:40 local, single execution run)
- **Started:** 2026-10-30T17:16+01:00 (plan handed to the executor)
- **Completed:** 2026-10-30T17:39:51+01:00 (last commit)
- **Tasks:** 3 / 3
- **Files modified:** 32 (801 insertions, 2304 deletions)

## Accomplishments

- **Task 1 — the ig0 override model is retired atomically.** `PhysicPaintRotoKeyScriptOverride`, `keyScriptOverrides`, the closed allowlist, `rebakeRevealRailKey`, the whole single-key edit mode, `editedKeySlots`, `persistNonCanonical` and every test pin for them are deleted across 26 files. The surviving `keyScriptEdits` boolean keeps its two commit spreads and the checkbox.
- **Task 2 — the bake is the only slicing authority.** `createAquarelleBake` gained `onStrokeFrameAnchors`, firing once per bake with `{ stroke, startFrame }` in script order (throwing consumers are swallowed). The new pure `sliceRailKeyScripts` maps those anchors onto the committed key frames (D-02): static gives every key the complete drawing, progressive buckets by start slot and fills gaps by inheritance so no key is ever script-less. The controller records through the new `recordRailKeyScripts` port only when the PERSISTED flag is on, and the Studio mints every mutation id from its one `paintMutationLedger`. The Reveal creation path records from the same wash bake.
- **Task 3 — the card moved.** The Key Script Editing card now renders after the Timing/side-stack row and before the summary bar, without the `-wide` modifier, so the 1fr/1fr content grid puts it in column 1 directly under Timing on both the Paint and Reveal tabs.

## Task Commits

Each task was committed atomically:

1. **Task 1: Retire the ig0 per-key-override model** — `e3264193` (refactor)
2. **Task 2: Slice the bake's own anchors onto each rail key** (TDD)
   - `12ec3f0d` (test — RED, slicer)
   - `03104eef` (feat — GREEN, slicer)
   - `f1b7b4f7` (test — RED, bake anchors)
   - `1b8d33f1` (feat — GREEN, bake anchors)
   - `f8e2c8d4` (feat — controller/Studio/reveal wiring, slices, tests)
3. **Task 3: Move the Key Script Editing card under Timing** — `24ccaef8` (style)

Measured: `plan_head_before 8cb900cb` → `plan_head_after 24ccaef8`, 7 commits.

## Files Created/Modified

- `packages/efx-watercolor/src/bake/aquarelleBake.ts` — `AquarelleStrokeFrameAnchor`, `onStrokeFrameAnchors`, fired once after both `startFrameOf` branches
- `packages/efx-watercolor/src/bake/aquarelleBake.test.ts` — 3 new tests (order/values, static absent-safe, throwing consumer)
- `app/src/components/physic-paint/roto/physicsPaintRotoRailKeyScripts.ts` — NEW pure `sliceRailKeyScripts` + `RailKeyScriptResult`
- `app/src/components/physic-paint/roto/physicsPaintRotoRailKeyScripts.test.ts` — NEW, 8 cases covering every D-02 law
- `app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptRenderer.ts` — forwards `onStrokeFrameAnchors` into the reveal bake
- `app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.ts` — `bakeAquarelleScript` returns `{ staged, anchors }`, `recordRailKeyScripts` port, `preserveKeyScripts` gate on the main path, flag-gated link branch
- `app/src/components/physic-paint/hooks/useRotoPlayScriptController.ts` — forwards the recording port
- `app/src/components/physic-paint/PhysicsPaintStudio.tsx` — `recordRailKeyScripts` helper (purge + ledger ids + `recordAquarelleStroke`), wired to the controller and to `createRevealRail`
- `app/src/stores/physicPaintStore.ts` — `RevealBakeInput.onStrokeFrameAnchors` pass-through
- `app/src/stores/efxPaintStore.ts` — `createRevealRail` anchors capture + post-commit recording, gated on the opt-in
- `app/src/components/physic-paint/view/PhysicsPaintPlayScriptDialog.tsx` — card moved after the tab conditional, `-wide` dropped
- 19 further files under `app/src` carry the Task 1 deletions and their test-pin rewrites

## Decisions Made

- D-02: static = complete drawing on every key; progressive = bucketed by the bake's start slot, gaps inherit the last started stroke (leading gaps borrow the first stroke of the nearest later non-empty slot).
- D-03/D-04: recording writes into the existing aquarelle timeline; mutation ids come only from the Studio's `paintMutationLedger` through the new port.
- D-05/D-06: the gate reads the persisted clip collection (`loopClips ?? currentLoopClips()`), never the dialog signal; when off, nothing is purged, recorded or allocated.
- D-09: `replayRevealRail` is deliberately left unthreaded.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Invalid `toolOverrides` fixture in the new slicer test**
- **Found during:** Task 2, STEP E (`tsc --noEmit`)
- **Issue:** the RED fixture used `toolOverrides: { width: 1.5 }`; `AquarelleToolOverrides` requires the eight multipliers (`tip`, `aspect`, `rotation`, `sizeCurve`, `scatter`, `capacity`, `grain`, `wetRound`). Vitest passed (esbuild strips types) but tsc reported TS2353.
- **Fix:** replaced the fixture and the matching projection assertion with a valid eight-field object.
- **Files modified:** `app/src/components/physic-paint/roto/physicsPaintRotoRailKeyScripts.test.ts`
- **Verification:** `tsc --noEmit` clean; slicer suite 8/8.
- **Committed in:** `f8e2c8d4`

**2. [Rule 3 - Blocking] Stale `@efxlab/efx-watercolor` type declarations**
- **Found during:** Task 2, STEP E
- **Issue:** the app's tsc resolves the package from gitignored `packages/efx-watercolor/dist/*.d.ts`; the new `AquarelleStrokeFrameAnchor` export was invisible, producing TS2305 in five files.
- **Fix:** rebuilt the package (`pnpm --filter @efxlab/efx-watercolor build`, tsup). No tracked file changed.
- **Verification:** `tsc --noEmit` clean afterwards.
- **Committed in:** n/a (gitignored build output)

**3. [Plan-naming] Slice type renamed to the plan's name**
- **Found during:** Task 2, STEP C
- **Issue:** STEP A left the type name to the module (I first wrote `RailKeyScriptSlice`), while STEP C/D name the port's slice type `RailKeyScriptResult`.
- **Fix:** renamed the interface (no alias, no shim) so the slicer, the controller port, the Studio helper and `createRevealRail` all use `RailKeyScriptResult`.
- **Committed in:** `f8e2c8d4`

**4. [Plan-literal, safe by construction] Link-branch recording never fires**
- **Found during:** Task 2, STEP C
- **Issue:** the plan asks to record in the Link-to-existing-cycle branch after its ack. That branch performs NO bake (loop-only commit, returns before `bakeAquarelleScript`), so it has no anchors.
- **Fix:** implemented the gate exactly as written (`linkedLoop.keyScriptEdits === true && anchors.length > 0`). With no anchors it never fires — which is also the safe behavior: recording there would purge a shared cycle whose script set this path did not produce.
- **Committed in:** `f8e2c8d4`

**5. [Rule 2 - Missing critical verification] Added a Paint-path gate test**
- **Found during:** Task 2, STEP E
- **Issue:** the plan's test list covered the slicer, the bake and the reveal store, but nothing proved the controller's `preserveKeyScripts` gate on the Paint path.
- **Fix:** added `261030-np9: records each key's slice from the bake anchors only for an opted-in cycle` (ON records on the committed keyIds with the D-02 inheritance; OFF never calls the recorder).
- **Committed in:** `f8e2c8d4`

---

**Total deviations:** 4 code-relevant (1 bug, 1 blocking, 1 naming, 1 added verification) + 1 plan-literal note.
**Impact on plan:** No scope creep. Nothing in the plan was weakened or skipped.

## Issues Encountered

- Task 3's commit was first created with a `docs(...)` subject and immediately amended to `style(...)` before anything left the machine; content unchanged.
- The `dist` rebuild prerequisite is pre-existing: a fresh clone must build `@efxlab/efx-watercolor` before the app's tsc sees package type changes.

## Threat Flags

None — no new network endpoint, auth path, schema field or file-access pattern. The recording seam reuses the existing aquarelle timeline and the existing mutation ledger.

## Known Stubs

None.

## TDD Gate Compliance

Plan frontmatter is `type: execute` (no plan-level TDD gate), but Task 2 carries `tdd="true"`:

- RED `12ec3f0d` — slicer test failing as designed; evidence validated with `gsd_run check tdd-red-evidence` → `RED_EVIDENCE_OK` (`red-evidence-task2.json`).
- GREEN `03104eef` — slicer implemented, 8/8.
- RED `f1b7b4f7` — bake anchor test failing; `RED_EVIDENCE_OK` (`red-evidence-task2-bake.json`).
- GREEN `1b8d33f1` — bake implemented, 43/43.
- GREEN `f8e2c8d4` — wiring plus its regression tests.

The two evidence JSON files live in the quick's own folder and are deliberately not committed (docs artifacts).

## Verification Results

| Command | Result |
| --- | --- |
| `pnpm --filter efx-motion-editor exec tsc --noEmit` | clean |
| `pnpm --filter @efxlab/efx-watercolor exec vitest run src/bake/aquarelleBake.test.ts` | 43/43 pass |
| Task 1 eleven-suite set | 855 passed, 1 skipped |
| Task 2 set (slicer + controller + reveal) | 213/213 pass |
| Task 3 dialog suite | 64/64 pass |
| Plan-wide `vitest run src/components/physic-paint/roto src/components/physic-paint/hooks src/components/physic-paint/view src/stores src/lib` | 263 files passed, 2 pre-existing skips; 5096 passed |
| Retired-symbol grep gate | no matches (`GREP_GATE_CLEAN`) |

## Next Phase Readiness

Feature-complete and automated-green. Live UAT is the remaining gate — the visible per-key ownership, Static completeness, Reveal slicing, save/reopen survival and the card's column position must be seen in the running Studio.

---

*Phase: 261030-np9-rail-key-scripts*
*Completed: 2026-10-30*

## Self-Check: PASSED
