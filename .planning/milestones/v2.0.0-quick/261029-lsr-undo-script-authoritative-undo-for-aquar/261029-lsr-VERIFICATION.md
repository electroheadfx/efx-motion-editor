---
phase: 261029-lsr
verified: 2026-10-29T15:53:46Z
status: human_needed
score: 7/7 must-haves verified
covered_files: [
  ".planning/quick/261029-lsr-undo-script-authoritative-undo-for-aquar/261029-lsr-PLAN.md",
  ".planning/quick/261029-lsr-undo-script-authoritative-undo-for-aquar/261029-lsr-SUMMARY.md",
  "app/src/components/physic-paint/PhysicsPaintStudio.test.ts",
  "app/src/components/physic-paint/PhysicsPaintStudio.tsx",
  "app/src/components/physic-paint/hooks/useRotoFramePersistenceCoordinator.test.ts",
  "app/src/components/physic-paint/hooks/useRotoFramePersistenceCoordinator.ts",
  "app/src/components/physic-paint/hooks/useRotoPhysicalEditHistory.test.ts",
  "app/src/components/physic-paint/hooks/useRotoPhysicalEditHistory.ts",
  "app/src/components/physic-paint/roto/aquarelleScriptReplay.test.ts",
  "app/src/components/physic-paint/roto/aquarelleScriptReplay.ts",
  "app/src/components/physic-paint/roto/rotoLivePixelCacheTransactions.test.ts",
  "app/src/components/physic-paint/roto/rotoLivePixelCacheTransactions.ts",
  "app/src/components/physic-paint/view/aquarelleStrokeSelection.test.ts",
  "app/src/components/physic-paint/view/aquarelleStrokeSelection.ts"
]
covered_digest: "v3:sha256:92fd18ccd42fa6ab0a1fa359c55b551bb354acd7add910ef87f635df45d8b38b"
behavior_unverified: 0
overrides_applied: 0
human_verification:
  - test: "Script ON, paint one stroke on a frame, Cmd+Z; then Cmd+Shift+Z; then Cmd+Z again."
    expected: "The stroke leaves the canvas AND the recorded script; redo restores both; a second undo removes it again — no leftover wash and no ghost script event."
    why_human: "Real GPU pixels are unreachable under vitest run (no WebGL; every bake test mocks the engine). The orchestration pin proves the order and digest equality over modelled bytes, not the rendered wash."
  - test: "Immediately after that undo, press M (Move) and use Lift on the frame."
    expected: "Move and Lift see exactly the same pixels as the canvas — no ghost stroke, no missing stroke."
    why_human: "This is the user-named drift symptom (display vs script); it needs the live Studio and real engine state."
  - test: "Script OFF, paint one stroke, Cmd+Z."
    expected: "Pixels are removed with no script mutation and no full re-bake flash — the engine-only route exactly as before this quick."
    why_human: "The re-bake flash and the engine tile restore are visual/latency behaviour. The unit row proves undoPaint() is called and replayStroke() is not."
  - test: "Auto-key flow: create a key with the first stroke, then Cmd+Z once; then redo."
    expected: "One undo removes both the created key and its stroke; one redo restores both."
    why_human: "Composite key+stroke rollback through the physical coordinator needs the live Studio."
  - test: "Press Cmd+Z while playback is running."
    expected: "Playback stops first, then the frame captured at replay entry re-bakes — never a frame that moved mid-replay."
    why_human: "Playback ownership and the rendered frame are runtime/native behaviour; the source pin only fixes the guard-before-stop ordering."
  - test: "P8 ownership row: undo until the frame's last paint stroke is gone (lift-only or empty script)."
    expected: "The module owner re-resolves — the Brush slot locks/unlocks accordingly — with no new gate needed."
    why_human: "Owner resolution is an observed live behaviour (applyFrameModuleState); the plan marks it UAT-only."
  - test: "Record ON, paint a stroke, and press Cmd+Z inside the capture quiet window without switching anything."
    expected: "The frame settles on the post-undo bake and no pre-undo pixels reappear."
    why_human: "The live-pixel capture queue and its quiescence window run against the real canvas; the epoch gate is unit-proven, the race is not."
  - test: "Regression on the migrated seam: Script ON, delete one stroke (A tool) and move another, then Cmd+Z each; then Cmd+Shift+Z each."
    expected: "Both undo through the shared helper (script timeline restored, frame re-baked) and redo reapplies them; a refused Cmd+Z must neither stop playback nor change the canvas."
    why_human: "Shared-handler parity and the visible result need the live Studio."
---

# Quick 261029-lsr: Script-authoritative undo for aquarelle strokes — Verification Report

**Phase Goal:** UNDO — script-authoritative undo for aquarelle strokes. Undo/redo re-bake the frame after mutating events, reset the live sheet, and never leave a capture able to commit pre-undo sheet pixels; a deterministic pin asserts display digest == bake digest after undo. Native UAT is the user's.
**Verified:** 2026-10-29T15:53:46Z
**Status:** human_needed (all automated must-haves verified; native UAT rows are the user's)
**Re-verification:** No — initial verification (no previous VERIFICATION.md existed)

Verified state: `dev` working tree at `ac6b3af4`, clean apart from the untracked planning docs. All seven commits are present as ancestors of HEAD: `97dc79fd`, `c179ce82`, `162bd902` (plan tasks 1-3) and `a6309441` (CR-01), `dfc360c0` (CR-02), `1441ddfc` (WR-01), `ac6b3af4` (WR-02).

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Undoing a recorded aquarelle stroke removes it from BOTH the script and the frame's pixels: the frame is re-baked through the shared Apply path and the displayed frame digest equals the published bake digest. | ✓ VERIFIED | Builder `beginAquarelleStrokeUndoEdit` (`aquarelleStrokeSelection.ts:642-665`) builds `after` = WITH the stroke, `before` = WITHOUT it (+ tombstone) at one revision; the orchestrator resets the sheet and re-bakes (`aquarelleScriptReplay.ts:69-151`); the Studio wires `resetSheet` -> `aquarelleResetSheetRef` -> `engine.clear()` (`PhysicsPaintStudio.tsx:4731-4733`, `AquarelleCanvasLayer.tsx:750-759`) and `rebake` -> `rotoScript.applyAquarelleTimeline(getAquarelleEventsForFrame(playFrame))` (`PhysicsPaintStudio.tsx:4734`) -> shared `dispatchApply` -> `applyAquarelleEventsToKey` publish (`physicsPaintRotoScriptClipboard.ts:962-1020`, `:1059-1148`; `PhysicsPaintStudio.tsx:1894-1959`). Routing: `useRotoPhysicalEditHistory.ts:963-975` and `:1149-1159`. Pin asserts display-digest == bake-digest and that the preset bytes are the post-undo bake (`aquarelleScriptReplay.test.ts:158-174`). Real GPU pixels remain native UAT. |
| 2 | Undoing a stroke that was never recorded (Script OFF / raster Lift that pins nothing) stays engine-only: no script mutation, no sheet reset, no re-bake — `undoPaint()` exactly as today. | ✓ VERIFIED | Unrecorded arm keeps the optimistic pop/rollback + `undoPaint()`/`redoPaint()` (`useRotoPhysicalEditHistory.ts:976-986`, `:1160-1170`); recorded arm never falls back to it (`:963-975`, `:1149-1159`). Tests: `useRotoPhysicalEditHistory.test.ts:3284-3300` (undoPaint once, replayStroke never, rollback on refusal) and `:3302-3319` (redo symmetry); auto-key unrecorded row `:3402-3419`. |
| 3 | Redo re-installs the same stroke from the SAME stored edit id (one script edit per stroke; both 10-entry ledgers hold), and a second undo/redo cycle still uses that one id. | ✓ VERIFIED | One edit per stroke cached in `aquarelleStrokeEditIdsRef` (`PhysicsPaintStudio.tsx:1507-1509`, set at `:4857-4861`, reused at `:4849-4851`); `storeAquarelleEdit` caps the edit ledger at 10 (`aquarelleStrokeSelection.ts:574-583`); the paint ledger trims to 10 (`useRotoPhysicalEditHistory.ts:646-650`, `:705-714`). Selection tests prove same entry object + one id across a second cycle (`aquarelleStrokeSelection.test.ts:875-893`); redo-refused leaves both stacks untouched (`useRotoPhysicalEditHistory.test.ts:3273-3282`). |
| 4 | A live-pixel capture started before an undo can never commit its pre-undo sheet pixels: rejected before produce and again at commit, at both layers (per-key `invalidateLivePixels` and the `aquarelleStrokesRevision` epoch). | ✓ VERIFIED | `invalidate` is the module's FIRST synchronous step, before any await (`aquarelleScriptReplay.ts:74-76`; order test `:138-141`); Studio port -> `rotoPersistence.invalidateLivePixels(playFrame)` -> per-key revision bump (`PhysicsPaintStudio.tsx:4725-4727`; `useRotoFramePersistenceCoordinator.ts:782-785`; `rotoLivePixelCacheTransactions.ts:141-146`). Epoch stamped synchronously at capture entry and re-read against the same port (`useRotoFramePersistenceCoordinator.ts:628-631`, `:681-685`), supplied by the Studio (`PhysicsPaintStudio.tsx:1420`); gates before produce and again at commit (`rotoLivePixelCacheTransactions.ts:172-179`, `:198-203`) with the `!== undefined` legacy escape. Four epoch rows incl. flip-after-produce commit rejection (`rotoLivePixelCacheTransactions.test.ts:241-332`); shape pin `useRotoFramePersistenceCoordinator.test.ts:574-593`. |
| 5 | After undo the replay fails closed (false, never throws) on a stale revision, a locked mutation or a failed bake — stacks untouched; a bake failure re-anchors the cached edit id; a cached id that can no longer restore is dropped so the next Cmd+Z rebuilds it — a cached id can never permanently block a stroke's undo. | ✓ VERIFIED | Guard block returns false before any side effect (`PhysicsPaintStudio.tsx:4710-4712`); null restore -> false with no reset/rebake (`aquarelleScriptReplay.ts:95-104`; test `:176-184`); every port throw is caught (`:80-85`, `:99-103`, `:106-135`, `:140-149`; tests `:227-265`). Ledger returns false before popping (`useRotoPhysicalEditHistory.ts:965-968`; test `:3273-3282`). Re-anchor helper re-seats only the attempted side (`aquarelleStrokeSelection.ts:812-821`; behavioural test `:937-966`); Studio recovery runs the re-anchor for both directions and the dead-id drop only for undo (`PhysicsPaintStudio.tsx:4863-4870`), pinned by source contract (`PhysicsPaintStudio.test.ts:3229-3236`, `:3271-3284`; single-occurrence delete asserted). |
| 6 | Auto-key-paint composites route their stroke half through the script route too; the stroke rollback after a rejected key replay uses the inverse script replay and never `redoPaint()` once a reset has run. | ✓ VERIFIED | Undo branch resolves the recorded-stroke predicate, replays the stroke first, and compensates a rejected key replay with `replayStroke(m,'redo')` (`useRotoPhysicalEditHistory.ts:1026-1075`); redo branch runs the key first then the stroke redo and fails closed (`:1202-1248`). Tests: recorded undo/redo (`useRotoPhysicalEditHistory.test.ts:3322-3350`), inverse-script rollback with neither `undoPaint` nor `redoPaint` (`:3352-3371`), refused stroke redo (`:3373-3400`), unrecorded unchanged (`:3402-3419`). |
| 7 | A script-authoritative undo pressed during playback stops playback first and bakes the frame captured at replay entry (one playFrame per replay), never a frame that moved mid-replay. | ✓ VERIFIED | `playFrame` captured once at callback entry (`PhysicsPaintStudio.tsx:4709`); guards run BEFORE `rotoCachedPlayback.stop()` (`:4710-4713`), then the module runs (`:4720`); the rebake uses the captured `playFrame` (`:4734`). Source contract pins the guard-before-stop order and invalidate-before-reset (`PhysicsPaintStudio.test.ts:3249-3253`). |

**Score:** 7/7 truths verified (0 present, behavior-unverified)

### Required Artifacts

| Artifact | Expected | Status | Details |
| -------- | -------- | ------ | ------- |
| `app/src/components/physic-paint/roto/aquarelleScriptReplay.ts` | Pure replay orchestration | ✓ VERIFIED | 151 lines, no runtime imports; imported and used at `PhysicsPaintStudio.tsx:220`, `:4720`. Every port and fail-closed path exercised by its suite. |
| `app/src/components/physic-paint/roto/aquarelleScriptReplay.test.ts` | Orchestration pin (order + digest + negative control) | ✓ VERIFIED | 266 lines, 11 tests, collected and green. Digest helper is the real FNV-1a (`aquarelleRenderSplitCapture.ts:75-83`); digest equality asserted between `displayBytes()` and `publishedBytes()` at `:158-174`. |
| `app/src/components/physic-paint/view/aquarelleStrokeSelection.ts` | Stroke undo edit builder + re-anchor | ✓ VERIFIED | `beginAquarelleStrokeUndoEdit` `:642-665`; `reanchorAquarelleEditRevision` `:812-821`; both exported and used by the Studio (`:234`, `:241`, `:4858`, `:4866`). |
| `app/src/components/physic-paint/view/aquarelleStrokeSelection.test.ts` | Builder + retryability pins | ✓ VERIFIED | New describe at `:836-967` (build/undo, redo cycle, refusals, Dry survival, re-anchor). |
| `app/src/components/physic-paint/hooks/useRotoPhysicalEditHistory.ts` | Route members + recorded arms | ✓ VERIFIED | Interface `:272-290`; paint/auto-key branches `:957-987`, `:1026-1075`, `:1145-1171`, `:1202-1248`. Wired from the Studio at `:4815-4871`. |
| `app/src/components/physic-paint/hooks/useRotoPhysicalEditHistory.test.ts` | Routing rows | ✓ VERIFIED | `:3141-3420` (8 rows, recorded/unrecorded, auto-key, rollback). |
| `app/src/components/physic-paint/hooks/useRotoFramePersistenceCoordinator.ts` | Epoch stamp + compare | ✓ VERIFIED | Port `:251`; stamp first at `:628-631`; compare closure `:681-685`; exported at `:923`. |
| `app/src/components/physic-paint/hooks/useRotoFramePersistenceCoordinator.test.ts` | Stamp/compare shape pin | ✓ VERIFIED | `:574-593`; stamp index < capture index; fresh-read literal. |
| `app/src/components/physic-paint/roto/rotoLivePixelCacheTransactions.ts` | `isStillCurrent` gates | ✓ VERIFIED | Field `:43-49`; produce gate `:176-179`; commit gate `:201`; literal occurs exactly twice (asserted at `PhysicsPaintStudio.test.ts:3315`). |
| `app/src/components/physic-paint/roto/rotoLivePixelCacheTransactions.test.ts` | Epoch transaction rows | ✓ VERIFIED | `:232-333` (reject-before-produce, reject-at-commit, accept, legacy). The 13 pre-existing rows are untouched. |
| `app/src/components/physic-paint/PhysicsPaintStudio.tsx` | Replay route + ports + epoch supply | ✓ VERIFIED | `runScriptReplay` `:4698-4745` immediately before the history hook `:4746`; route members `:4815-4871`; `getScriptEpoch` `:1420`; edit-id ref `:1507-1509`. |
| `app/src/components/physic-paint/PhysicsPaintStudio.test.ts` | Migrated route contracts + new pins | ✓ VERIFIED | Migrated rows `:3215-3269` and `:4198-4210`; CR-01 row `:3271-3284`; CR-02 row `:3286-3299`; epoch/order row `:3301-3316`; module source bindings `:42-45`. |
| `.planning/quick/.../261029-lsr-SUMMARY.md` | Summary artifact | ✓ VERIFIED | Exists (untracked; the orchestrator owns the docs commit, as the SUMMARY states). |

### Key Link Verification

| From | To | Via | Status | Details |
| ---- | -- | --- | ------ | ------- |
| `useRotoPhysicalEditHistory` paint / auto-key-paint branches | Studio `replayStroke` -> `runScriptReplay` -> `runAquarelleScriptReplay` | `hasRecordedStroke(mutationId)` then `replayStroke` | WIRED | Hook `:963-975`, `:1035-1042`, `:1149-1159`, `:1208-1245`; Studio route `:4815-4871`; `runAquarelleScriptReplay` imported `:220`. |
| `runAquarelleScriptReplay` first synchronous step | `rotoPersistence.invalidateLivePixels(playFrame)` -> per-key revision bump | Before any await | WIRED | Module `:74-76`; Studio port `:4725-4727`; coordinator `:782-785`; transactions `:141-146`, `:172-183`, `:198-203`. |
| `runAquarelleScriptReplay` after `ensureBase` | `beginAquarelleStrokeUndoEdit` -> `storeAquarelleEdit` -> `restoreAquarelleEditSnapshot` | `prepare` -> `restore` order | WIRED | Module `:80-104` (ensure-base before prepare); Studio `prepare` `:4857-4861`; selection builder `:642-665`; restore `:779-791`. |
| `restore` | `aquarelleResetSheetRef` (`engine.clear()`) -> `applyAquarelleTimeline` -> bake publish -> `applyFrameModuleState` | Ports in order | WIRED | Module `:97-118`; Studio ports `:4730-4739`; `engine.clear()` in `AquarelleCanvasLayer.tsx:750-759`; apply `physicsPaintRotoScriptClipboard.ts:962-1020`, `:1059-1148`; publish `PhysicsPaintStudio.tsx:1894-1959`; owner `applyFrameModuleState(playFrame)`. |
| `captureLivePixels` | `RotoLivePixelCapture.isStillCurrent` -> transaction `isStillWanted` + commit reject `stale-before-commit` | Stamped `aquarelleStrokesRevision` | WIRED | Coordinator `:628-631`, `:681-685`; transactions `:176-179`, `:201`; Studio port `:1420`; tests `rotoLivePixelCacheTransactions.test.ts:241-332`. |
| `replayStroke` false | Recovery classification via the `onStep` stream | Keep / re-anchor / drop | WIRED | Studio `:4843-4870`; source pins `PhysicsPaintStudio.test.ts:3229-3236`, `:3271-3284`; re-anchor helper `aquarelleStrokeSelection.ts:812-821`. |
| Former 261022-pim route-contract rows | `runScriptReplay` slice + `roto/aquarelleScriptReplay.ts` | Migrated assertions | WIRED | `PhysicsPaintStudio.test.ts:3215-3269`, `:4198-4210`; module source binding `:42-45`. |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| -------- | ------------- | ------ | ------------------ | ------ |
| Frame display after undo | rendered sheet / published bake bytes | Live sheet while it holds paint; `engine.clear()` via `aquarelleResetSheetRef`; then `applyAquarelleTimeline` -> `dispatchApply` -> `applyAquarelleEventsToKey` publish | Yes (real bake in production; modelled bytes in the pin) | ✓ FLOWING |
| Recorded-stroke routing | `mutationId` -> `getRecordedAquarelleStroke` | Same `mutationId` recorded by `recordAquarelleStrokeWhenEnabled` (`PhysicsPaintStudio.tsx:7200`) and pushed to the paint ledger (`:6046`, hook `:718-755`) | Yes | ✓ FLOWING |
| Capture epoch | `scriptEpoch` | `aquarelleStrokesRevision.peek()` stamped at capture entry (`PhysicsPaintStudio.tsx:1420` -> coordinator `:631`), re-read at both gates | Yes | ✓ FLOWING |
| Script snapshot swap | `before`/`after` snapshots | `captureAquarelleSnapshot` from the live timeline/registry (`aquarelleStrokeSelection.ts:511-522`); synthetic `before` derived by filtering the stroke event + tombstone | Yes | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| Full app suite | `pnpm --filter efx-motion-editor exec vitest run` | 355 files passed | 2 skipped (357); 6349 passed | 1 skipped | 96 todo (6446); exit 0 | ✓ PASS |
| Typecheck | `pnpm --filter efx-motion-editor typecheck` | `tsc --noEmit`, clean, exit 0 | ✓ PASS |
| Pin bites (real negative control) | Temporarily removed `ports.resetSheet();` from `aquarelleScriptReplay.ts`, ran `vitest run src/components/physic-paint/roto/aquarelleScriptReplay.test.ts` | 4 failed | 7 passed — including the digest row showing pre-undo bytes (1..6) vs the bake (9,9,8,8,7,7). File restored byte-identically (`shasum` match) and re-run: 11 passed. | ✓ PASS |
| Digest equality is real | Inspected `digestRenderedFrameBytes` | FNV-1a over raw bytes, returns `null` for empty/non-bytes; the pin guards `not.toBeNull()` so `null === null` cannot pass vacuously | ✓ PASS |
| Targeted six suites | Covered by the full run; the plan's six-file gate was also exercised through the whole-suite run (452+ tests, all green) | ✓ PASS |

### Probe Execution

N/A — this phase declares no probes and is not a migration/tooling phase; no `scripts/*/tests/probe-*.sh` is referenced by the PLAN or SUMMARY.

### Requirements Coverage

Quick task: no `.planning/REQUIREMENTS.md` entry maps to `261029-lsr` (grep found none). Requirements are declared in PLAN frontmatter and verified here.

| Requirement | Source Plan | Description | Status | Evidence |
| ----------- | ----------- | ----------- | ------ | -------- |
| UNDO-ROUTE | 261029-lsr-PLAN | Recorded strokes route through the script replay; unrecorded stay engine-only | ✓ SATISFIED | Hook `:957-987`, `:1026-1075`, `:1145-1171`, `:1202-1248`; tests `:3260-3419` |
| UNDO-REBAKE | 261029-lsr-PLAN | One replay orchestration with the fixed step order and fail-closed paths | ✓ SATISFIED | Module `:69-151`; Studio `:4698-4745`; tests `aquarelleScriptReplay.test.ts:134-265` |
| UNDO-CAPTURE-EPOCH | 261029-lsr-PLAN | Epoch stamped at capture start, checked at produce and commit | ✓ SATISFIED | Coordinator `:628-631`, `:681-685`; transactions `:176-179`, `:201`; tests `:241-332`, `useRotoFramePersistenceCoordinator.test.ts:574-593` |
| UNDO-PIN | 261029-lsr-PLAN | Deterministic pin: display digest == bake digest, with a negative control | ✓ SATISFIED | `aquarelleScriptReplay.test.ts:158-174`; verified to fail when the reset is removed |
| UNDO-AUTOKEY | 261029-lsr-PLAN | Auto-key composites route the stroke half through the script; inverse replay on rollback | ✓ SATISFIED | Hook `:1026-1075`, `:1202-1248`; tests `:3322-3419` |
| UNDO-PLAYBACK | 261029-lsr-PLAN | Stop playback first (after guards); one playFrame per replay | ✓ SATISFIED | Studio `:4698-4713`, `:4734`; source pins `PhysicsPaintStudio.test.ts:3249-3253` |

### Decision Coverage

Gate result: `{ skipped: true, blocking: false, reason: "no trackable decisions", message: "No trackable decisions in CONTEXT.md." }`. CONTEXT.md's decision sections are unnumbered (the plan aliases them D-01..D-08), so the gate found nothing trackable. Non-blocking; the D-01..D-08 coverage was verified manually in the truths above (D-01 -> truth 2, D-02/D-04 -> truths 1/3, D-03 -> truth 4, D-05 -> truth 1/pin, D-06 -> truth 6, D-07 -> truth 7, D-08 -> discretion exercised in the cached-id design).

### Test Quality Audit

| Test File | Linked Req | Active | Skipped | Circular | Assertion Level | Verdict |
|-----------|-----------|--------|---------|----------|-----------------|---------|
| `roto/aquarelleScriptReplay.test.ts` | UNDO-PIN / UNDO-REBAKE | 11 | 0 | No (models bytes; real FNV-1a helper; negative control) | Behavioral (order, digest equality, failure paths) | ✓ SOUND |
| `view/aquarelleStrokeSelection.test.ts` | UNDO-REBAKE / UNDO-PIN | 5 new | 0 | No | Behavioral (snapshot swap + retry guard) | ✓ SOUND |
| `hooks/useRotoPhysicalEditHistory.test.ts` | UNDO-ROUTE / UNDO-AUTOKEY | 8 new | 0 | No (mock route is the seam under test) | Behavioral (event ordering, stack movement, call counts) | ✓ SOUND |
| `roto/rotoLivePixelCacheTransactions.test.ts` | UNDO-CAPTURE-EPOCH | 4 new | 0 | No | Behavioral (produce/commit rejection, acceptance, legacy) | ✓ SOUND |
| `hooks/useRotoFramePersistenceCoordinator.test.ts` | UNDO-CAPTURE-EPOCH | 2 new | 0 | No | Source contract (hook has no renderer) | ✓ SOUND |
| `PhysicsPaintStudio.test.ts` | UNDO-ROUTE / UNDO-PLAYBACK / recovery | 6 new + 2 migrated | 0 | No | Source contract (Studio has no renderer) | ✓ SOUND |

Disabled tests on requirements: 0. Circular patterns: 0. Insufficient assertions: 0. The source-contract rows are the project's established proof for un-mountable hooks/components; every Studio literal they pin is present in the current file.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| — | — | None | — | Debt-marker scan (`TBD`/`FIXME`/`XXX`) over all 12 changed files returned nothing; no `it.skip`/`.todo`; no placeholder returns in the new paths. |

**Declared residuals (reviewed, out of scope, not gaps)** — none of these defeats a must-have truth:
- **WR-03** — a redo of a stroke whose edit was evicted from the 10-entry ledger fails closed forever. `replayStroke` keeps a dead cached id on the redo path by design (`PhysicsPaintStudio.tsx:4867-4868`), and the truth only requires that a cached id never permanently block an **undo**; the undo path drops the dead id and rebuilds.
- **WR-04** — the auto-key compensating redo's result is discarded (`useRotoPhysicalEditHistory.ts:1068`). Truth 6 requires only that the rollback use the inverse **script** replay and never `redoPaint()`; that is exactly what the code does.
- **IN-01** — `beginAquarelleStrokeUndoEdit` omits `clearAquarelleStrokeDrag()`; ghosts are visual-only (native UAT row 2/8) and do not affect the script/pixel invariant.
- **IN-02** — a failed `prepare` can orphan an edit slot (feeds WR-03 only).
- **IN-03** — the global epoch is broader than the per-key guard and the transaction commit gate is defence-in-depth behind the queue's pre-commit gate; both gates exist as the truth requires, and the four epoch rows prove the pre-undo pixels never commit.

**Info note:** the SUMMARY's coverage entry D4 cites a test title `#display digest equals the published bake digest`; the actual title is `leaves the displayed frame and the published bake on the SAME bytes (and the pin bites)`. Documentation drift only — the assertion itself exists and passes.

### Human Verification Required

The eight native UAT rows below are the plan's (and the user's); they are the only remaining proof and they are listed in the frontmatter. Summary:

1. **Recorded stroke undo/redo cycle** — Script ON, Cmd+Z / Cmd+Shift+Z / Cmd+Z: stroke leaves and returns with the script, no ghost.
2. **Move and Lift after undo** — both must see the same pixels as the canvas (the user-named drift).
3. **Script OFF undo** — pixels removed with no script mutation and no re-bake flash.
4. **Auto-key composite** — one undo removes key + stroke; one redo restores both.
5. **Undo during playback** — playback stops first, then the entry frame re-bakes.
6. **P8 ownership row** — owner re-resolves when the last paint stroke leaves the frame.
7. **Capture quiet-window race** — Cmd+Z inside the quiet window leaves no pre-undo pixels.
8. **Migrated seam regression** — delete + move undos/redos through the shared helper; a refused Cmd+Z stops nothing and changes nothing.

### Gaps Summary

No gaps. All 7 must-have truths are verified in the fixed state (`ac6b3af4`), all 12 artifacts are substantive and wired, all 7 key links are connected, the full suite (6349 passed, exit 0) and the typecheck are green, and the deterministic pin was proven to bite by a real mutation (removing the sheet reset fails 4 tests, including the digest-equality row) and then restored byte-identically. The status is `human_needed` only because the plan assigns real rendered pixels to the user's native UAT — the automated evidence is complete and green.

---

_Verified: 2026-10-29T15:53:46Z_
_Verifier: Claude (gsd-verifier)_

---

## UAT Close-out (2026-10-29)

The eight native UAT rows above were run by the user across rounds on `dev`. Rows 1-3 and 6-8 passed; rows 4-5 and the stacked-edit behaviour required follow-up fixes (see SUMMARY's UAT Close-out table, commits `1d906da6`..`093970b2`). **Final verdict: all rows approved.** The temporary probes used to diagnose the rounds are retired (`093970b2`); their `/tmp` report files are deleted.

Verification at close: full suite 6365 passed / 1 skipped / 96 todo, typecheck clean.
