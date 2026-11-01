---
phase: 261101-1pc-quick-c2-reveal-incoming-on-any-destinat
plan: 01
subsystem: physic-paint / roto loop clips (Run Script stacking — Reveal incoming)
tags: [preact-signals, roto, loop-clips, run-script, standard-rail, reveal, document-reference, vitest]
requires:
  - quick: 261031-i54 (Quick A — stack a script onto an existing Paint rail)
    provides: stack destination resolution, collision/extend-only law, Keep 2x2, one atomic undo
  - quick: 261031-qps (Quick B — Reveal adoption on a stack)
    provides: reveal rail kind, the render-only tail seam (renderRevealTail), document-reference refusal and reload round-trip
  - quick: 261031-vbo (Quick C1 — merge result becomes a Standard Rail)
    provides: the whitelist Standard projection, one picture law (union/composite), gray Standard presentation, Regenerate/Replay refusal
provides:
  - RotoPlayScriptStackRunKind axis (Motion / Static / Reveal Motion / Reveal Static) + setStackRunKind
  - bakeRevealStackRun run-only port wired Studio -> hook -> controller
  - the zero-write document-reference refusal for a Reveal run (port absent / no reference / reference removed before confirm)
  - the reveal-run render lane feeding C1's existing union/composite merge ports
  - the stack dialog's 2x2 Rail Type grid and the reveal-run card set with the document-reference notice + Place a reference...
affects: [physic-paint roto rails, run-script dialog, Reveal tab, Keep ON/OFF, Standard Rail presentation]
actuals:
  tokens: 19503
  tasks: 3
  commits: 3
plan_head_before: 7c36385b2519dc73c4bd93c68fa58b3b4dbe9903
plan_head_after: 152c0afc3b9d3ee5edd9db4acf3a00207568d4fa
tech-stack:
  added: []
  patterns:
    - 'Run kind is a dialog axis: setStackRunKind derives mode compare-then-write; the committed clip still stores the destination mode'
    - 'One reveal render seam (renderRevealTail) shared by the Reveal tab, the Quick B tail and the Quick C2 run port'
    - 'A reveal run differs only in WHICH bytes are the run sheet; the C1 union/composite picture law, pins and recording are reused unchanged'
    - 'Every refusal sits before acceptedGeneration so a rejected run can never bump a generation, request authority, bake or write'
    - 'One exact-coverage helper (unexpected / duplicate / missing) guards both reveal lanes before the single commit'
key-files:
  created: []
  modified:
    - app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.ts
    - app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.test.ts
    - app/src/components/physic-paint/PhysicsPaintStudio.tsx
    - app/src/components/physic-paint/PhysicsPaintStudio.test.ts
    - app/src/components/physic-paint/hooks/useRotoPlayScriptController.ts
    - app/src/components/physic-paint/hooks/useRotoPlayScriptController.test.ts
    - app/src/components/physic-paint/view/PhysicsPaintPlayScriptCards.tsx
    - app/src/components/physic-paint/view/PhysicsPaintPlayScriptDialog.tsx
    - app/src/components/physic-paint/view/PhysicsPaintPlayScriptDialog.test.ts
key-decisions:
  - 'A Reveal run renders its OWN wash through the DOCUMENT placed photo reference and is legal on any non-reveal destination; a Reveal DESTINATION keeps Quick B byte-identically.'
  - 'The run kind is never persisted: the committed Standard Rail keeps the destination stored mode, and the run mode/motion/colorize/photo wiggle/paint seed shape only that bake.'
  - 'The run-only port is deliberately NOT bakeRevealStackTail, whose slow path unions the destination recorded events; a reveal run must render only its own script.'
  - 'The new refusal mirrors the Quick B one BEFORE acceptedGeneration and re-validates the reference at confirm time.'
  - 'Reveal sheets flow through the existing C1 Keep ON union and Keep OFF composite ports: no fork of the picture law, staged pins, CR-01 or recording.'
  - 'The dialog notice names the DOCUMENT reference, which is why it offers Place a reference... while the Quick B rail notice stays read-only.'
requirements-completed: [QUICK-261101-1PC]
metrics:
  duration: 35min
  completed: 2026-11-01
status: complete
---

# Phase 261101-1pc Plan 01: Reveal incoming on any destination

A Reveal Motion or Reveal Static run can now stack onto any Motion, Static or already-Standard rail: it renders its own wash through the document's placed photo reference, merges over each touched key's current picture through C1's existing union/composite ports, and commits ONE gray Standard Rail — with a zero-write refusal and a "Place a reference…" action when the document has no reference.

## Performance

- **Duration:** ~35 min (base commit `7c36385b2` at 01:13:34 to final task commit 01:48:32, +01:00)
- **Started:** 2026-11-01T01:13:34+01:00 (plan base)
- **Completed:** 2026-11-01T01:48:32+01:00
- **Tasks:** 3
- **Files modified:** 9

## Accomplishments

- Added `RotoPlayScriptStackRunKind` (`motion | static | reveal-motion | reveal-static`) with `isRevealRunKind`, `stackRunKindMode` and `setStackRunKind`. The setter compare-then-writes the kind and derives `mode`, so the paint bake (anchors and slices) and the applied summary follow the chosen run; the committed record still takes `mode` from the destination through the C1 whitelist.
- Added the optional `bakeRevealStackRun` port (controller interface, Studio implementation, hook forwarding). It renders the run's own script through the ONE `renderRevealTail` seam with `canonicalStart: frames[0]`, `frameCount: frames.length`, and clears stale staged base pins first. It never calls the recorded-event union helpers, never purges, never pins and never writes the durable-base map.
- Added the two-part refusal in `confirmStack`, placed after the Quick B reveal-target block and BEFORE `acceptedGeneration`: missing port → 'This build cannot render a Reveal run. Nothing changed.'; missing document reference → 'This Reveal run has no photo reference. Place a reference, then run again. Nothing changed.'. Both clear `collisionChoice`, set phase `idle`, set `error` and return false with zero authority requests, bakes and writes. The reference is re-checked at confirm time, so removing it while the dialog is open refuses identically.
- The reveal render replaces the run sheets only: `sheets` is reassigned to the reveal bytes in destination slot order, then the EXISTING C1 `bakeStackedRailKey` (Keep ON) and `composeStackedRailKey` (Keep OFF) paths run unchanged. `renderOverrideColor` is `null` and `renderPaintSeedVariation` follows the dialog, so a reveal run never carries a color tint and its anchor bake matches the reveal bake.
- Extracted one local `collectExactFrameCoverage` helper used by both reveal lanes (Quick B tail and Quick C2 run) enforcing unexpected / duplicate / missing frames before the single commit; the CR-01 no-strokes gate continues to cover a reveal run.
- The stack Rail Type card now offers the 2x2 grid (Motion, Static, Reveal Motion, Reveal Static) bound to `stackRunKind`; creation and the Reveal tab keep their two-option groups bound to `mode`. The dialog composes the reveal-run card set (Colorize + Motion wiggle on the side, Photo wiggle + Paint seed in the key column, no Color / Key Script / source-cycle card) and the reference notice, with a single "Place a reference…" action when none is placed.

## Task Commits

Each task was committed atomically (code only):

1. **Task 1: A Reveal run on a Motion, Static or Standard destination commits one Standard Rail, end to end** — `0aa8625aa` (feat, 8 files, +591/−46)
2. **Task 2: The stack dialog composes the Reveal-run card set and the document-reference notice** — `206d51379` (feat, 2 files, +144/−7)
3. **Task 3: The reveal-run edge laws are pinned and the reveal-destination path is proven untouched** — `152c0afc3` (test, 1 file, +260)

Measured with the on-disk ledger (`7c36385b2519dc73c4bd93c68fa58b3b4dbe9903..HEAD`, 3 commits).

## Run-kind axis and mode derivation

- `stackRunKindMode('static' | 'reveal-static') = 'static'`; `stackRunKindMode('motion' | 'reveal-motion') = 'progressive'`.
- `setStackRunKind(kind)` compare-then-writes `stackRunKind`, then derives `mode` compare-then-write — one event-handler write per changed signal, never during render (`efx-preact-reactivity` rule 3).
- Open reset returns the kind to `'motion'`; a stack open seeds it from the destination's stored mode (`static` → `static`, `progressive` → `motion`) without writing `mode` a second time; a creation open leaves it at `'motion'`.
- The axis is dialog state only — nothing is persisted, and the C1 whitelist keeps storing the destination's `mode`.

## Why the run port is not `bakeRevealStackTail`

`bakeRevealStackTail` is the Quick B DESTINATION seam: its slow path unions the destination's recorded events before rendering. A Reveal RUN must render only its own script through the DOCUMENT reference, with no destination events, records or pins; routing it through the tail would replay the destination's animation into the run. The new `bakeRevealStackRun` therefore takes `frames`, `scriptEvents`, `mode`, `motion`, the four knobs, `signal` and `onProgress` and maps `renderRevealTail` output to `{ appFrame, bytes }`. A reveal destination never calls it: `isRevealRun = !isRevealTarget && isRevealRunKind(...)`, so Quick B keeps its own path byte-identically (proven by a regression test with BOTH ports supplied: the tail runs, the run port does not, and the committed record is Standard).

## Refusal placement and copy

- Both reveal-run gates live after the reveal-target block and before `acceptedGeneration`; they never bump the generation, request authority, bake or write.
- Absent port: 'This build cannot render a Reveal run. Nothing changed.'
- Absent document reference: 'This Reveal run has no photo reference. Place a reference, then run again. Nothing changed.'
- If the port becomes present after the gate but is missing at render time (defensive), the lane throws 'This build cannot render a Reveal run. Nothing changed.' before `ports.commit`.
- A refused render (`kind: 'refused'`) throws `Reveal run render refused: <reason>`; a coverage mismatch throws the label-specific message, e.g. 'Reveal run render produced an unexpected frame 11. Nothing changed.' or 'Reveal run render is missing frame 12. Nothing changed.'.

## Dialog composition and reference notice

- `stackRevealRun = stacking && !stackReveal && isRevealRunKind(playScript.stackRunKind.value)`.
- Reveal-run cards: Colorize (with mix), Motion wiggle on the side; Photo wiggle and Paint seed in the key column; Color, Key Script and the source-cycle card hidden. Switching back to Motion/Static restores the paint composition.
- Placed reference: read-only notice "This run renders through the document's placed photo reference." with no button.
- Unplaced: "Reveal bakes the placed photo reference — no reference placed yet." plus one `physics-paint-play-script-heading-link` button "Place a reference…", disabled while busy, calling the existing `requestPhotoReference`.
- A reveal DESTINATION keeps Quick B: no Rail Type card, Colorize + Photo wiggle + Paint seed, its own read-only notice, blue until the merge commits.

## New law pins

- Setter matrix: kind + derived mode, compare-then-write on both signals (same-kind and same-mode writes emit nothing).
- Open seeding matrix: Static destination seeds `static`, Progressive seeds `motion`, creation stays `motion`, and `mode` is not written twice.
- End-to-end reveal run on a Static destination: `bakeRevealStackRun` called once with frames `[11,12]`, progressive mode, the dialog motion and the four knobs false/100/false/false; the tail port is never called; Keep ON union receives `['S2','S3']` with the reveal payloads slot-aligned; exactly one commit; the committed clip is Standard with the destination mode, `keyScriptEdits`/`paintSeedVariation` preserved and no `scriptId`/`motion`/`overrideColor`/`railKind`/`colorize`/`colorizeMix`/`photoWiggle`; the pre-run rail is byte-identically untouched; the record port receives `recordMode: 'append'` with the run's slices `[11,12]`; the applied summary says 'Original colors' and never the destination's `#abcdef`.
- Refusals: no port, no reference, and reference-removed-between-open-and-confirm each assert the exact copy, phase `idle`, zero confirm-time authority requests, zero bake options, zero run/tail/union/compose calls, zero commits and zero recordings.
- Coverage: extra (`[11,12,111]`), duplicate (`[11,11]`) and missing (`[11]`) each abort before the single commit with the exact label-specific error, zero union/compose/record calls and untouched pre-run clips.
- Keep OFF reveal run: the composite port is called twice with `('S2', 11, reveal-run-11)` and `('S3', 12, reveal-run-12)`; the union port is never called; nothing is recorded; the publication carries the composite bytes; the committed clip is Standard and never grows `keyScriptEdits`.
- One undo + reload: exactly one commit, a NEW committed object, the pre-run deep snapshot still equal; `isPhysicPaintRotoLoopClip`, `parsePhysicPaintRotoLoopClips([committed])` deep-equal and the parsed document round-trip the record unchanged; projection 'Standard Rail', railKind 'standard', lifecycle 'standard', null dot and the merged Regenerate reason.
- Reveal destination with both ports supplied: the tail is called once (with the rail's own stored `static` mode even after a defensive `setStackRunKind('reveal-motion')`), the run port never, Keep ON still records once, the committed record is Standard, and the pre-run clip is untouched.
- Studio source scan: the run port slice asserts no recorded-event union helper, no per-slice loop, no purge, no pin/durable-base write, no direct reveal commit; the positive half covers the staged-pin clear, empty-span refusal, `events: input.scriptEvents`, `canonicalStart: start`, `frameCount: input.frames.length`, the refused return, the mapping and the ports wiring. Hook pins cover forward-verbatim and omit-when-absent. Dialog pins cover the four radios, the card matrix, both notice states, the disabled action, switch-back and the reveal-destination regression.

## Files Created/Modified

- `app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.ts` — run-kind axis + setter, the `bakeRevealStackRun` port, the confirm-time refusal, the reveal-run render lane, color/seed routing, the shared exact-coverage helper.
- `app/src/components/physic-paint/PhysicsPaintStudio.tsx` — `bakeRevealStackRun` implementation through `renderRevealTail` and its ports wiring.
- `app/src/components/physic-paint/hooks/useRotoPlayScriptController.ts` — conditional forwarding of the run port (absent stays absent → the controller refusal stays reachable).
- `app/src/components/physic-paint/view/PhysicsPaintPlayScriptCards.tsx` — `STACK_RUN_KINDS` and the four-option Rail Type grid for a stack destination.
- `app/src/components/physic-paint/view/PhysicsPaintPlayScriptDialog.tsx` — reveal-run card composition and the document-reference notice with Place a reference….
- Test files: controller spec (edge laws), Studio spec (source scan), hook spec (port forwarding), dialog spec (card set and notice).

## Deviations from Plan

No code deviations — the plan executed as written. One placement note:

- **Studio negative-half pin authored in Task 1 instead of Task 3.** The plan asked Task 3 to "extend the new source-scan pin with the negative half"; the pin was written complete (negative + positive halves) alongside the port in Task 1 (`0aa8625aa`), so Task 3 changed only the controller spec (`152c0afc3`). Coverage is identical; no assertion was weakened or reversed. No intentional test-law reversals were required — the full suite passes untouched (0 failed).

## Auth gates

None.

## Known Stubs

None — no placeholder data, hardcoded empty UI sources, TODO/FIXME markers or unwired components were introduced. No `gsd windows append` entries were needed.

## Threat Flags

None beyond the plan's threat register. All T-261101-1PC-01..06 mitigations landed and are pinned:

- T-01: the C1 whitelist projection is untouched; the committed clip drops every single-script/reveal field.
- T-02: both refusal gates precede `acceptedGeneration`; `renderRevealTailFrames` still fails closed on a missing reference; a refused render throws before commit.
- T-03: one exact-coverage helper guards both reveal lanes (unexpected, duplicate, missing).
- T-04: the reveal render writes nothing; the picture merge stays in the C1 ports and the one `ports.commit`; undo/reload pins prove one commit and an unmutated pre-run collection.
- T-05: no model/serializer/parser/persisted-field file is in the diff; the reload pin parses the record back unchanged.
- T-06: the only new action is the existing `requestPhotoReference`; the button is disabled while busy; no new write path.

## Schema statement (required)

**No persisted schema or format changed.** The run kind is dialog state; Standard is still expressed by ABSENT provenance in the existing Loop Clip shape, and the required `mode` field keeps the destination's stored value. `physicsPaintRotoPhysicalModel.ts`, the serializers/parsers and every persisted rail field are untouched — `git diff --stat` over the three commits lists only controller/UI/hook/test files. The committed record round-trips through the existing parser and fingerprint.

**The Quick B reveal-DESTINATION path is byte-identical.** Its own render-only tail port, its rail-knob seeding, its read-only notice copy and its Standard commit are unchanged; the new run-kind axis never treats it as a Reveal run. Quick A/B/C1 collision, extend-only, repeat-unchanged, Keep ON append / Keep OFF record-nothing-no-purge, one atomic undo, Standard whitelist projection, gray presentation and Regenerate/Replay refusal all still hold.

## Verification evidence

- Targeted Task 3: controller 254/254, Studio 303/303 (both green).
- Targeted Task 1/2: hook 13/13, dialog 89/89 (green).
- Full suite: 363 files (361 passed, 2 skipped) · 6,844 passed · 1 skipped · 96 todo · **0 failed** (baseline floor 6,818 passed; +26 pins over baseline including remediation).
- Typecheck: clean (`tsc --noEmit`).
- Schema tripwire: clean (no model/serializer/parser/persisted-field file in the diff).

## Code review remediation

First review: 0 blockers, 2 warnings, 5 info. Fixer commits `50ed58a19`..`30fb955d9` addressed WR-01 (non-default knob wiring), WR-02 (reference refusal copy), IN-01..IN-05 and IN-02's note. Re-review confirmed all but WR-02, whose copy was still wrong for the hydration case (`missing reference source` = the reference exists but bytes are not hydrated; telling the user to place one contradicts the dialog's placed-reference notice). Final fix `9285362aa`:

- `REVEAL_RUN_REFERENCE_MISSING_COPY` (no track → place a reference) and `REVEAL_RUN_REFERENCE_LOADING_COPY` (track exists, bytes loading) are exported constants used by the gate and the render refusal.
- A mid-run reference failure now returns the gate's idle surface (phase `idle`, no "Play Script failed") with the accurate copy, zero writes; every other refusal keeps `Reveal run render refused: <reason>`.
- Tests assert each reason's exact copy, the idle phase and the cleared status/progress (`3052519a6`).

The Quick B tail lane keeps its existing wording deliberately (the reveal-destination path is plan-locked byte-identical); its reference failures were already gated before the render.

Re-review after the fix: no blocker or warning outside that resolved item; the remaining info notes (shared copy extraction is done for the run lane; the tail lane divergence is intentional) are non-blocking.

## UAT rows handed to the user (live visible UAT — automated green is not done)

1. Motion rail + Reveal Motion run: one gray Standard Rail whose wash shows the placed photo, with the rail's animation surviving where the wash is transparent.
2. Static rail + Reveal Static run: same Standard result, held frames.
3. Standard rail + Reveal run: stays Standard, keeps its cycle and repeat options.
4. No document reference: the dialog shows the reason and a "Place a reference…" action; confirming refuses and nothing changes; after placing the reference the same dialog runs.
5. Place a reference, then clear it while the dialog is open, then Run Script: the run refuses with the same reason and nothing changes.
6. Keep ON: the reveal run's per-key slices are recorded and a per-key edit still works; Keep OFF: nothing is recorded and the destination picture and scripts survive.
7. One Undo restores the typed destination rail exactly (type, colour, source script and any reveal knobs).
8. Save then reopen: the rail is still a gray Standard Rail with the same picture and blend.
9. Reveal destination (Quick B) is unchanged: no Rail Type card, its own knobs seed, its own reference notice copy, blue until the merge commits.
10. Regenerate and Replay stay unavailable on the merged rail with the merged-rail reason; typed rails keep their own behaviour.

## Self-Check: PASSED

- Files verified present: controller, Studio port, hook, cards, dialog and their four specs.
- Commits verified in history: `0aa8625aa`, `206d51379`, `152c0afc3` (all ancestors of HEAD; measured 3 commits over `7c36385b2..152c0afc3`).
