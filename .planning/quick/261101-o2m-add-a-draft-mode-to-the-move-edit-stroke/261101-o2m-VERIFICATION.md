---
phase: 261101-o2m-add-a-draft-mode-to-the-move-edit-stroke
verified: 2026-11-01T18:36:03Z
status: human_needed
score: 4/8 must-haves verified
covered_files:
  - .planning/quick/261101-o2m-add-a-draft-mode-to-the-move-edit-stroke/261101-o2m-PLAN.md
  - .planning/quick/261101-o2m-add-a-draft-mode-to-the-move-edit-stroke/261101-o2m-SUMMARY.md
  - app/src/components/physic-paint/PhysicsPaintStudio.test.ts
  - app/src/components/physic-paint/PhysicsPaintStudio.tsx
  - app/src/components/physic-paint/engine/AquarelleCachedBaseLayer.tsx
  - app/src/components/physic-paint/physicsPaintStudio.css
  - app/src/components/physic-paint/snapshot/studioScriptSnapshotController.test.ts
  - app/src/components/physic-paint/snapshot/studioScriptSnapshotController.ts
  - app/src/components/physic-paint/view/PhysicsPaintStrokeSettingsDialog.tsx
  - app/src/components/physic-paint/view/aquarelleStrokeSelection.test.ts
  - app/src/components/physic-paint/view/aquarelleStrokeSelection.ts
  - app/src/components/physic-paint/view/scriptStrokeEdition.test.ts
  - app/src/components/physic-paint/view/scriptStrokeEdition.ts
  - app/src/components/physic-paint/view/strokeSettingsModel.test.ts
  - app/src/components/physic-paint/view/strokeSettingsModel.ts
  - app/src/lib/autoSave.ts
  - app/src/lib/exportEngine.ts
  - app/src/lib/physicPaintDraftMode.test.ts
  - app/src/lib/physicPaintDraftMode.ts
  - app/src/main.tsx
  - app/src/stores/projectStore.ts
covered_digest: "v3:sha256:c50a48f5f8e3f9b378f7d93e6f2eeda587656787df919daac59d3b17f5790c34"
behavior_unverified: 4
overrides_applied: 0
behavior_unverified_items:
  - truth: "With Draft ON every edit still commits to the script and stays undoable while the watercolor engine is never reset or re-applied (the committed sheet keeps its last rendered pixels)."
    test: "Open a watercolor layer, enter Select mode, open the Stroke sheet, turn Draft ON, then run one committed edit of each kind (drag/move, transform handles, Geometry/Paint settings, delete, stack step/place, undo and redo)."
    expected: "Each edit updates the overlay and stays undoable; the committed sheet does not visually change; Draft stays ON and the dirty flag stays set until an exit."
    why_human: "The six handlers and the replay ports are source-pinned but never executed by a test (the Studio is a source-fixture suite), and the pixel behaviour is only observable live."
  - truth: "Draft OFF performs exactly ONE recompute and no path reaches Draft OFF without it — the dirty clear precedes the Draft flip, the setter refuses to leave while dirty, and racing exits join one recompute."
    test: "In a dirty Draft session, click the switch OFF and close/re-enter the sheet; then induce two exits at once (frame change while pressing play)."
    expected: "Exactly one re-render per session end, the switch lands OFF only after it, and a refused/racing settle never flips Draft OFF over stale pixels."
    why_human: "The leave guard is behaviourally tested at the signal level, but the settle ordering and single-flight join are source-pinned only — the one-render-per-session count is a live observation."
  - truth: "No Draft session starts without a resolved durable base: the ON click awaits the pre-edit base recovery for the current frame, writes draftMode only on true, and surfaces a refusal with Draft OFF."
    test: "Turn Draft ON on a fresh frame and immediately on a frame changed during the arm; force a base-recovery refusal."
    expected: "Draft turns ON only after the base resolves; a frame mismatch or refusal leaves Draft OFF with the refusal visible."
    why_human: "The dialog-side arm contract is behaviourally tested with a mock bundle; the Studio armDraftBase seam itself is source-pinned and its durable-base timing is only observable in the live app."
  - truth: "Exactly five exits force the single recompute first and act on its result; the Studio window close is refused while the pixels are dirty rather than recomputing."
    test: "In a dirty Draft: close the sheet, change frame, press Space and the play control, save, export; then close the Studio window."
    expected: "Each exit re-renders once then proceeds; a refused recompute aborts it; the window close refuses while dirty and closes normally after Draft is turned off."
    why_human: "Exit ordering and the close refusal are source-pinned; the actual abort/cancel behaviour (navigation cancel, playback not starting, save/export cancellation, window staying open) is runtime-only."
human_verification:
  - test: "Draft ON edit session (truths 1-3)"
    expected: "Every listed edit commits and stays undoable while the committed sheet stays frozen; the overlay follows the script; Draft arms only after the durable base resolves."
    why_human: "Live pixel behaviour and the pre-edit base recovery cannot be exercised by the source-fixture Studio suite."
  - test: "Draft OFF and the five exits (truths 2 and 4)"
    expected: "Dialog close, frame change, play (Space and the control), save and export each re-render exactly once first and then proceed; a refusal aborts the exit; with Draft OFF every exit is a pure no-op."
    why_human: "The one-recompute count, single-flight join and fail-closed aborts are runtime ordering/cancellation invariants."
  - test: "Studio window-close refusal and the D-07 exception"
    expected: "With dirty Draft pixels the window refuses to close and nothing is captured or written; after a refused exit, reopening the sheet keeps Draft ON with the stale pixels until the next successful settle."
    why_human: "The refusal path spans the close flush hook and the main-realm window lifecycle; only a live close proves it."
  - test: "Autosave gate and resume (truth 5)"
    expected: "No autosave is written while Draft is ON, including past the 60s safety net; the deferred autosave resumes after a successful recompute or a closed Studio; a stalled Studio is released by the 20s staleness belt."
    why_human: "The transport state machine is behaviourally tested, but the actual autosave write/no-write across a live session and the staleness belt against a blocked webview are runtime observations."
  - test: "Cache eye live (truth 7)"
    expected: "The eye hides and restores the committed sheet in Draft and in Live, defaults visible, and changes nothing about commits, captures, saves or exports."
    why_human: "Display-only behaviour is structural and harness-tested, but the visual result must be confirmed live."
  - test: "Track switch under a dirty Draft (CR-01 fix)"
    expected: "A row click, cross-track frame click, rail click, add/duplicate track or blend toggle settles the Draft first; a refused settle stays on the outgoing track with no capture, save or reset."
    why_human: "The commit-tail belt and capture guard are source-pinned; the data-loss path itself is only exercised live."
  - test: "Delete-last-stroke auto-close (WR-02 fix)"
    expected: "Deleting the last stroke under Draft marks pixels dirty before the sheet auto-closes, and the close settle retries once the delete clears its in-flight flag."
    why_human: "The retry ordering is source-pinned; the auto-close race is runtime-only."
  - test: "Accept the remaining review findings"
    expected: "Decide whether to accept or schedule WR-01 (silent close refusal), WR-04 (hidden cache never reset), WR-05 (unhandled rejections on async seams), WR-06 (main.tsx mid-chain await), IN-01 (rebake under Draft / Trash dirty flag), IN-02 (arm race after close), IN-03 (20s staleness residual)."
    why_human: "These are non-blocking quality/robustness findings from the code review, not must-have failures; acceptance is a developer decision."
---

# Phase 261101-o2m: Draft mode for the Move/Edit Stroke dialog — Verification Report

**Phase Goal:** Add a **Draft** mode to the Move/Edit Stroke settings dialog (the surface shared by Water color Select mode and Brush Move). Draft ON suspends ONLY the watercolor engine re-render: every edit still works and commits exactly as today (drag/move, transform handles, resize, Geometry X/Y/Rotation, Paint settings, delete, stack order, undo/redo). The visible cache stays frozen at its last rendered state while the stroke overlay shows the current edited script. A cache-visibility icon hides the frozen cache (display-only, default visible). Draft OFF performs ONE recompute from the current script and restores the normal display and render cadence. Every path that leaves the editing surface (dialog close, frame change, play, export, save) performs that same single recompute first. Draft is session/view state: not persisted in the document, not undoable, reset to Live on every dialog open (with a documented dirty-state exception). A stale cache is never exported, played, saved or persisted. Autosave is blocked while Draft is ON.

**Verified:** 2026-11-01T18:36:03Z
**Status:** human_needed
**Re-verification:** No — initial verification
**HEAD:** `8fc6fcfcb` (working tree clean except the untracked REVIEW.md / SUMMARY.md planning docs)

## Goal Achievement

### Observable Truths

| #   | Truth   | Status     | Evidence       |
| --- | ------- | ---------- | -------------- |
| 1   | With Draft ON every edit still commits to the script and stays undoable while the watercolor engine is never reset or re-applied — frozen sheet retained | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | All six handlers carry a Draft branch that records the edit, marks dirty and returns before the reset/apply tail: delete `PhysicsPaintStudio.tsx:8326/8341/8357`, move `:8477/8487`, appearance `:8564/8573`, transform `:8659/8677`, step `:8736/8743`, place `:8800/8807`. Replay ports gate only the pixel side: `resetSheet` returns on `draftMode.peek()` (`:5627`), `rebake` marks dirty and returns `true` so `notify`/`publishOwner` still run (`:5636-5638`), post-replay capture is gated (`:5664`); `restore`/`rollback`/`notify`/`publishOwner`/`invalidate`/`ensureBase` are untouched (`:5620-5666`). Source pins at `PhysicsPaintStudio.test.ts:5607+`. No executing test drives the Studio handlers — see Human Verification. |
| 2   | Draft OFF recomputes once; no path reaches Draft OFF without it (dirty clears first, setter refuses OFF while dirty, racing exits join one recompute) | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | Leave guard `scriptStrokeEdition.ts:157-161` is behaviourally tested (`scriptStrokeEdition.test.ts:387`). Settle no-op on clean flags `:5125`, single-flight `:5127`, guard `:5128-5133`, one recompute `:5138-5143`, order `setDraftPixelsDirty(false)` → `setDraftMode(false)` only after the apply `:5159-5160`, snapshot re-arm `:5163`. Dialog OFF click calls `settleDraft` (`PhysicsPaintStrokeSettingsDialog.tsx:925`). Ordering/single-flight are source-pinned (`PhysicsPaintStudio.test.ts:5549`), not executed — the "N edits = one render / racing exits join" count is live-only. |
| 3   | No Draft session starts without a resolved durable base; ON awaits the single-flight pre-edit recovery and refuses on frame mismatch | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | `armDraftBase` `PhysicsPaintStudio.tsx:5094-5120`: single-flight `:5096`, captures `playFrame` `:5098`, awaits `ensureAquarelleDurableBaseRef` `:5102`, re-reads live frame `:5106`, refusal surfaces error and returns false `:5107-5113`. Dialog awaits the arm and writes ON only on true (`PhysicsPaintStrokeSettingsDialog.tsx:930-936`), behaviourally tested (`strokeSettingsModel.test.ts:3221`, `:3238`); Studio seam source-pinned (`PhysicsPaintStudio.test.ts:5530`). |
| 4   | Exactly five exits force the single recompute first and act on its result; the Studio window close REFUSES while dirty (never a sixth recompute) | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | Dialog close effect `PhysicsPaintStrokeSettingsDialog.tsx:537`; frame change settles BEFORE the frame-leave capture with refusal and generation re-checks `PhysicsPaintStudio.tsx:5263-5267`; play wrapper for both entry points `:5226-5229` wired at `:6441`/`:10870` (bare Space calls it via `view/physicsPaintStudioKeyboard.ts:401`); save/export flush step 0 throws on refusal `:10170-10172`; close refusal is the FIRST flush step `:3997` with no settle in that block; main-realm aborts `projectStore.ts:984/1039`, `exportEngine.ts:152`. All ordered source pins (`PhysicsPaintStudio.test.ts:5752+`); runtime abort behaviour is live-only. |
| 5   | Autosave is blocked entirely while Draft is ON; released only on a clean state; the gate cannot stick (heartbeat + 20s belt + window-closed clear), and deferred autosave resumes | ✓ VERIFIED | Transport is behaviourally tested: payload validation, true→false-only release, window-closed clear, staleness belt with fake timers, re-arm on heartbeat, publish/install (`physicPaintDraftMode.test.ts:32-200`). Autosave skips both save sites `autoSave.ts:42/46/97`; release handler registration `:90`, clearing `:108`; publisher follows `draftMode || draftPixelsDirty` with a 5s heartbeat `PhysicsPaintStudio.tsx:10221-10225`; Studio destroy clears the gate. |
| 6   | The Draft strip sits below the header and above the view gate, reachable in both views; role=switch, labelled Draft, OFF by default, session-only, never persisted/undoable; D-07 resets Draft on the genuine open edge except while dirty | ✓ VERIFIED | Markup `PhysicsPaintStrokeSettingsDialog.tsx:905-967`; placement in BOTH views behaviourally tested (`strokeSettingsModel.test.ts:3171`), role/aria/OFF default/drag-safe (`:3203`), brush bundle excluded (`:3286`). Session law compare-then-write and teardown survival (`scriptStrokeEdition.test.ts:344-444`); D-07 reset `aquarelleStrokeSelection.ts:345`, behaviourally tested (`aquarelleStrokeSelection.test.ts:397-420`) including the dirty no-op exception. Signals are not imported by any serialization/persistence path, and the setters mint no ledger entry. |
| 7   | The cache eye is always available in Draft AND Live, default visible, toggles both ways, and is display-only (never gates a commit, capture, save or export) | ✓ VERIFIED | Signal default true and compare-then-write `scriptStrokeEdition.ts:171-177`; behaviourally tested both ways and never reset by Draft/Preview/select-mode (`scriptStrokeEdition.test.ts:446-494`); dialog tests LIVE, Draft and Settings views (`strokeSettingsModel.test.ts:3335-3422`). Leaf reads it and swaps only a class on a still-mounted canvas `AquarelleCachedBaseLayer.tsx:198-204`; CSS is `visibility: hidden` `physicsPaintStudio.css:8128`; no capture/save/export/persistence path reads the signal (grep). |
| 8   | Nothing crosses into the document: no schema/persisted-format change, no engine math, no recorded points/params, no hit-test/bounds/stack/punch change, no new undo entry for the Draft or cache flips themselves | ✓ VERIFIED | The diff touches only the 19 declared files (`git diff --name-only a85b9aade..HEAD`) — no schema, serialization, engine-math, hit-test, bounds, stack or punch file. The three new signals live in the view module and are read only by the strip leaf, the cached-base leaf and Studio handlers/effect. `setDraftMode`/`setDraftPixelsDirty`/`setFrozenCacheVisible` perform signal writes only — no `recordAquarelleScriptEdit` or ledger call. |

**Score:** 4/8 truths verified (4 present, behavior-unverified)

### Deferred Items

None — every truth, artifact and key link in the plan is in this phase's scope; Step 9b found no match to a later milestone phase (the quick task is self-contained).

### Required Artifacts

| Artifact | Expected    | Status | Details |
| -------- | ----------- | ------ | ------- |
| `app/src/components/physic-paint/view/scriptStrokeEdition.ts` | Draft + dirty + cache signals and setters | ✓ VERIFIED | 3 signals + compare-then-write setters, leave guard, doc comments `:130-177` |
| `app/src/components/physic-paint/view/aquarelleStrokeSelection.ts` | D-07 reset at the select-mode choke point | ✓ VERIFIED | `setAquarelleSelectMode` reset at `:345`; shared in-flight flag aliases `:629-630` |
| `app/src/components/physic-paint/view/strokeSettingsModel.ts` | Bundle type extensions | ✓ VERIFIED | `armDraft`/`settleDraft` optional members consumed by the dialog |
| `app/src/components/physic-paint/view/PhysicsPaintStrokeSettingsDialog.tsx` | Draft strip + cache eye | ✓ VERIFIED | Strip below header above filter gate `:905-967`; close effect `:531-545`; OFF routes to settle `:925`; ON awaits arm `:930-936` |
| `app/src/components/physic-paint/PhysicsPaintStudio.tsx` | Arm, settle, Draft branches, exits, close refusal, publisher | ✓ VERIFIED | Arm `:5094-5120`, settle `:5122-5175`, guarded switch `:5192-5216`, replay ports `:5620-5666`, six handlers `:8326-8807`, close refusal `:3997`, flush step `:10170-10172`, publisher/heartbeat `:10212-10233`, controller dep `:1255` |
| `app/src/components/physic-paint/engine/AquarelleCachedBaseLayer.tsx` | Display-only hide class | ✓ VERIFIED | Reads `frozenCacheVisible` `:198`, class swap `:202`, canvas stays mounted |
| `app/src/components/physic-paint/physicsPaintStudio.css` | Strip + hide rules | ✓ VERIFIED | Strip `:5846-5876`; `visibility: hidden` rule `:8128` |
| `app/src/components/physic-paint/snapshot/studioScriptSnapshotController.ts` | Optional `shouldDeferSave` at both chokepoints | ✓ VERIFIED | Port `:139`; `prepareSave` `:800`; `markDirty` `:921` |
| `app/src/lib/physicPaintDraftMode.ts` | Cross-realm transport + gate | ✓ VERIFIED | 161 lines: constants, payload validation, transition law, clear, staleness belt, publish, install (behaviourally tested) |
| `app/src/lib/autoSave.ts` | Gate + release resume | ✓ VERIFIED | Checks `:42/46/97`; handler registration `:90`; clearing `:108` |
| `app/src/lib/exportEngine.ts` | Export abort on refused recompute | ✓ VERIFIED | `:145-155` |
| `app/src/stores/projectStore.ts` | Save/save-as abort on refused recompute | ✓ VERIFIED | `:976-986`, `:1034-1041` |
| `app/src/main.tsx` | Install the main-realm listener | ✓ VERIFIED | Import `:21`, install `:115` (mid-chain — see WR-06) |

All 13 artifacts exist, are substantive, and are wired; the 6 test files in `key-files` are present and meaningful.

### Key Link Verification

| From | To  | Via | Status | Details |
| ---- | --- | --- | ------ | ------- |
| draftMode + draftPixelsDirty | dialog strip / Studio guards / settle | leaf render read + `.peek()` only | ✓ WIRED | Studio render body never reads them; one lifecycle effect `PhysicsPaintStudio.tsx:10212` |
| dialog open true → false | settleDraftScript | close effect `:537` | ✓ WIRED | Behaviourally exercised via mock bundle |
| settleDraftScript | dirty clear then Draft false only after apply | `:5159-5160` | ✓ WIRED | Source-pinned ordering |
| every Draft edit (six handlers + rebake port) | setDraftPixelsDirty(true) | handler branches `:8341, 8487, 8573, 8677, 8743, 8807`, port `:5637` | ✓ WIRED | Source-pinned |
| strip ON | armDraft → base recovery → setDraftMode(true) | dialog `:930-936`, Studio `:5094-5120` | ✓ WIRED | Dialog behaviourally tested; arm refusal surfaces error |
| draftPixelsDirty | close flush first step throws → `failed` → window open | `:3997` + flush pipeline | ✓ WIRED | Source-pinned close block |
| draftPixelsDirty | shouldDeferSave at markDirty/prepareSave | controller `:139/800/921` | ✓ WIRED | Behaviourally tested (`studioScriptSnapshotController.test.ts:1436-1500`) |
| replay ports | gate resetSheet/rebake/post-capture only | `:5627/5636/5664` | ✓ WIRED | Restore/rollback/notify/publishOwner untouched |
| frozenCacheVisible | cached-base class → visibility:hidden | leaf `:198-204`, CSS `:8128` | ✓ WIRED | Display-only |
| draftMode OR draftPixelsDirty | publisher + heartbeat → main gate → autosave | `:10221-10225`, `autoSave.ts:42/46/97` | ✓ WIRED | Publisher is a lifecycle effect, not the render body |
| navigation | settle result checked before capture/generation | `:5263-5267` | ✓ WIRED | Source-pinned |
| handleToggleRotoPlayback | both play entry points | `:6441`, `:10870`; keyboard `view/physicsPaintStudioKeyboard.ts:401` | ✓ WIRED | One wrapper, fail closed |
| flushStudioStateRef | settle as throwing step 0 → save/export abort | `:10170-10172`; `projectStore.ts:984/1039`; `exportEngine.ts:152` | ✓ WIRED | Main-realm abort only while the gate is active |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| -------- | ------------- | ------ | ------------------ | ------ |
| Stroke settings strip | `draftMode`, `draftPixelsDirty` | Signal writes from the ON arm and the six Draft edit branches | Yes — live session state | ✓ FLOWING |
| Stroke settings strip / cached base | `frozenCacheVisible` | Eye button click in the strip | Yes — real view preference | ✓ FLOWING |
| Studio settle / exits | `draftPixelsDirty` | Every committed Draft edit (six handlers + replay rebake) | Yes — real dirty state | ✓ FLOWING |
| Main realm autosave gate | Studio draft gate | `publishStudioDraftMode` from the lifecycle effect + 5s heartbeat + window-closed clear | Yes — event-driven transport | ✓ FLOWING |
| Script snapshot writer | `shouldDeferSave` | `draftPixelsDirty.peek()` | Yes — real deferral state | ✓ FLOWING |

No static fallback, hardcoded literal or mock reaches rendering/user-visible output; no hollow prop or orphaned fetch.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| Draft-related suites (signals, selection, dialog harness, Studio pins, controller deferral, transport) | `pnpm --filter efx-motion-editor exec vitest run` on the 7 Draft-related suites | 7 files / 650 tests passed | ✓ PASS |
| TypeScript | `pnpm --filter efx-motion-editor run typecheck` | exit 0, no output (`tsc --noEmit`) | ✓ PASS |
| Leave guard / cache-eye signal laws | included in `scriptStrokeEdition` suite | pass | ✓ PASS |
| Strip + eye harness (placement, role, arm, refusal, both views) | included in `strokeSettingsModel` suite | pass | ✓ PASS |
| Deferred snapshot writes and re-arm | included in `studioScriptSnapshotController` suite | pass | ✓ PASS |
| Transport transition law, staleness belt, window-closed clear | included in `physicPaintDraftMode` suite | pass | ✓ PASS |

The Studio-level Draft laws (settle ordering, single-flight, six handlers, five exits, close refusal) are **source pins** (readFileSync region assertions), not executing behaviour — this is why truths 1-4 remain behavior-unverified.

### Probe Execution

Not applicable — no probes are declared in the plan/SUMMARY and this is a feature phase (not a migration, CLI or tooling phase); no `scripts/*/tests/probe-*.sh` convention applies.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| ----------- | ---------- | ----------- | ------ | -------- |
| QUICK-261101-O2M | `261101-o2m-PLAN.md` | Draft ON suspends only the watercolor re-render; every edit commits and stays undoable; cache eye display-only; one recompute on Draft OFF and on each of five exits; stale cache never saved/played/exported; autosave blocked while Draft is ON | ✓ SATISFIED (automated evidence) — live UAT pending | Truths 1-8 above; 650 tests + clean typecheck; the runtime half is listed under Human Verification |

No orphaned requirements: the phase declares exactly this one requirement.

### Anti-Patterns Found

No debt markers (`TBD`/`FIXME`/`XXX`) and no warning-level markers (`TODO`/`HACK`/`PLACEHOLDER`) in any of the 19 changed files, no empty-implementation or hardcoded-empty-data patterns in the new code. The review's blocking findings are verified fixed at `8fc6fcfcb`:

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| `PhysicsPaintStudio.tsx` | `:5192-5216` | CR-01 fixed: ONE guarded `switchActiveTrack` (only raw `setActiveTrackId` at `:5199`), all six entry points route through it; commit-tail belt `:5420`, outgoing-capture guard `:5440` | — | Data-loss path closed |
| `PhysicsPaintStudio.tsx` | `:8357/8477/8564/8659/8736/8800` | WR-03 fixed: Draft state re-read after the durable-base await in every handler | — | No Draft-OFF-over-dirty race |
| `PhysicsPaintStudio.tsx` | `:8341/8342`, `:8409-8412` | WR-02 fixed: dirty marked before the shared in-flight flag; close settle retried after the delete | — | Auto-close cannot observe a clean flag |
| `PhysicsPaintStudio.tsx` | `:3997` | WR-01 (open): close refusal throws but the hook only `console.error`s, so the refusal is silent in the UI | ⚠️ Warning | Dead close button while dirty; must-have (refusal) still holds |
| `scriptStrokeEdition.ts` | `:171-177` | WR-04 (open): `frozenCacheVisible` is never reset on sheet/track/frame exit | ⚠️ Warning | Committed sheet can stay invisible for the session |
| `PhysicsPaintStudio.tsx` | `:10223/10225`, `:8409`; dialog `:537/925/934` | WR-05 (open): bare `void` on rejectable promises (publish, settle, arm) | ⚠️ Warning | Project "no unhandled rejections" rule |
| `main.tsx` | `:115` | WR-06 (open): the new listener install is awaited mid-chain before `mountShortcuts()` and nine bridges | ⚠️ Warning | One rejection would disable every later install |
| `PhysicsPaintStudio.tsx` | `:5621-5651`, `:5040-5079` | IN-01 (open): `handleRebakeScript` re-renders under Draft; Trash does not reconcile `draftPixelsDirty` | ℹ️ Info | Explicit rebake action vs Draft law; stale dirty flag after Trash |
| `PhysicsPaintStudio.tsx` / dialog | `:5094-5120`, `:934` | IN-02 (open): an uncancellable arm can turn Draft ON after the sheet closed | ℹ️ Info | Draft ON with no visible switch |
| `physicPaintDraftMode.ts` | `:72-80`, `:138-148` | IN-03 (open): 20s staleness belt is the only protection against a blocked event loop | ℹ️ Info | Documented residual risk |

None of these is a must-have failure: the five exits, the close refusal, the deferral, the gate and the eye all exist and are wired; WR-01/WR-04..06 and IN-01..03 are quality/robustness findings carried from the code review for developer acceptance.

### Human Verification Required

1. **Draft ON edit session (truths 1-3)**
   **Test:** Open a watercolor layer, enter Select mode, open the Stroke sheet, turn Draft ON, and run one edit of each kind — drag/move, transform handles, Geometry X/Y/Rotation, Paint settings, delete, stack step/place, then undo and redo.
   **Expected:** Every edit updates the overlay and stays undoable; the committed sheet does not change; Draft stays ON with dirty pixels; the durable base was resolved before the first edit.
   **Why human:** The handlers are source-pinned, not executed; live pixel behaviour is the evidence.

2. **Draft OFF and the five exits (truths 2 and 4)**
   **Test:** In a dirty Draft, click the switch OFF; then close the sheet, change frame, press Space and the play control, save, and export. Repeat once with Draft OFF.
   **Expected:** Each exit renders exactly once first and then proceeds; a refused recompute aborts the exit; with Draft OFF every exit is a pure no-op; racing exits join one recompute.
   **Why human:** One-render count, single-flight join and fail-closed cancellation are runtime ordering invariants.

3. **Studio window-close refusal and the D-07 exception**
   **Test:** With Draft ON and at least one committed edit, close the Studio window; then turn Draft off and close. Finally, induce a refused exit, reopen the sheet.
   **Expected:** The window refuses to close while dirty (nothing captured or written) and closes normally once Draft is off; after a refused exit the sheet reopens with Draft ON and stale pixels until the next successful settle.
   **Why human:** Spans the close flush hook and the main-realm window lifecycle; only a live close proves it.

4. **Autosave gate and resume (truth 5)**
   **Test:** Leave the Studio idle in Draft past 60s; then trigger a successful settle; then simulate a stalled Studio past 20s.
   **Expected:** No autosave is written while Draft is ON; the deferred autosave resumes after the recompute or a closed Studio; the staleness belt releases a dead Studio.
   **Why human:** The transport is unit-tested; the live autosave write/no-write and belt timing are runtime observations.

5. **Cache eye live (truth 7)**
   **Test:** Toggle the eye in Draft and in Live, in both the list and settings views.
   **Expected:** The committed sheet hides and restores; the edited overlay stays readable; no save/capture/export behaviour changes.
   **Why human:** Display-only is structural; the visual result needs eyes.

6. **Track switch under a dirty Draft (CR-01 fix)**
   **Test:** With dirty Draft pixels, switch tracks via a row click, cross-track frame click, rail click, add/duplicate track, and the blend toggle; also force a refused settle.
   **Expected:** The switch settles first; a refusal stays on the outgoing track with no capture, save or session reset.
   **Why human:** The guard is source-pinned; the data-loss path is only exercised live.

7. **Delete-last-stroke auto-close (WR-02 fix)**
   **Test:** Under Draft, delete the last stroke of a frame so the sheet auto-closes.
   **Expected:** The pixels are marked dirty before the close, and the settle retries once the delete clears its in-flight flag; the session is recoverable.
   **Why human:** The retry ordering is source-pinned; the auto-close race is runtime-only.

8. **Accept the remaining review findings**
   **Test:** Decide on WR-01, WR-04, WR-05, WR-06, IN-01, IN-02, IN-03 (see Anti-Patterns).
   **Expected:** Accepted as-is, or scheduled as follow-up work; none blocks this phase's contract.
   **Why human:** Developer judgment; they are non-blocking quality/robustness findings.

### Gaps Summary

No must-have gap was found: every plan truth is delivered structurally, all 13 artifacts exist and are wired, all 13 key links are connected, 650 tests pass across the 7 Draft-related suites and `tsc --noEmit` is clean. Four truths (Draft ON edit behaviour, the one-recompute leave path, the pre-edit base arm, and the five-exit/close-refusal semantics) are runtime ordering/cancellation behaviour that the source-pinned Studio suite cannot execute, and live visual UAT belongs to the user — so the status is `human_needed`, not `passed`. The code review's remaining findings (WR-01, WR-04, WR-05, WR-06, IN-01, IN-02, IN-03) are non-blocking and listed for acceptance; CR-01, WR-02 and WR-03 are verified fixed in `8fc6fcfcb`.

---

_Verified: 2026-11-01T18:36:03Z_
_Verifier: Claude (gsd-verifier)_
