---
phase: quick-260921-ffh
plan: 260921-ffh
subsystem: ui
tags: [tauri-webview-bridge, preact-signals, efx-paint, document-sync, push-guard, re-diagnosis, hoist]

# Dependency graph
requires:
  - phase: 260921-e21
    provides: the validated retry contract this run repairs — the failure-path guard re-arm, the bounded re-flush budget (DOCUMENT_SYNC_MAX_AUTO_RETRIES = 3) and the clear-dirty-inside-the-mode-gate placement; all three were correct and all three were unreachable from the retry they armed
  - phase: 52.2
    provides: the .mce reference-only package manifest and the child→main document pair (physic-paint:efx-paint-document) that carries the three surfaces — the format and the pair are exonerated and unchanged
  - phase: 260921-bjm
    provides: the two-realm bridge-pair idiom and the RED-EVIDENCE.json shape reused by this plan's diagnosis artifact
provides:
  - "Verdict (a) on all three Studio-origin surfaces at ONE composite link: the push decision reads a guard captured at render creation while the failure path re-arms the REF, so a retry with no render in between reads the failed content as its own duplicate, returns null, and the caller — which clears the pending flag BEFORE the push — consumes the change with no send and no re-mark"
  - "The guard DECISION hoisted out of pushLiveProjection into createDocumentSyncPushDecision as a pure move, so the link is drivable from a test at all"
  - "The fix: decide() reads guardRef.current at decision time; the three behavioural pins turn GREEN with no assertion weakened and none deleted"
  - "Three behavioural pins through the real child→parent chain (RED at base, GREEN after), plus a positive strokes control and a negative e21-guardrail control green in the same run"
affects: [53, any-future-studio-document-sync-work, any-future-child-realm-persistence-surface]

# Actuals (#2632) — pairs with the plan's `estimate` to calibrate future estimates.
# Same estimateTokens scale (chars/4 over the realized diff), never a harness token count.
actuals:
  tokens: 24525       # chars/4: 98,098 diff chars / 4 (git diff afc349aa..HEAD | wc -c)
  tasks: 3
  commits: 4          # MEASURED: git rev-list --count afc349aa..HEAD (#3968)
  plan_head_before: afc349aab77cb2bd825b573ebc750dd105da8334

tech-stack:
  added: []
  patterns:
    - "read-the-slot-at-decision-time: a decision that must observe a value another path swaps mid-flight reads the slot when it decides — never a value captured once at creation. A capture-at-creation that another path re-arms is a silent no-op re-arm"
    - "hoist-the-named-link, then pin it: when a diagnosis names a link inside a component closure that cannot be mounted (Tauri window/engine deps), the link is hoisted into a focused module as a PURE MOVE — same behaviour at the same call points — so the pin can drive it; the pre-existing source-shape contracts stay unedited"
    - "replaced pin, not weakened pin: a leg that is GREEN at base while its surface is reported lost is a verdict datum pointing at a different link — it is re-pointed at the named link and the original end-to-end contract is kept as a permanent green lock"

key-files:
  created:
    - app/src/stores/efxPaintStudioOriginSync.scratch.test.ts
  modified:
    - app/src/components/physic-paint/bridge/documentSyncPushGuard.ts
    - app/src/components/physic-paint/PhysicsPaintStudio.tsx
    - .planning/quick/260921-ffh-e21-uat-falsified-reference-selection-ba/260921-ffh-RED-EVIDENCE.json

key-decisions:
  - "Verdict (a) x3 at one COMPOSITE link, not three separate defects: the render capture (PhysicsPaintStudio.tsx:3914) x the decision's read of it (:3928) x the failure path's re-arm of the REF (:3987) x the latch being set BEFORE the send resolves (documentSyncPushGuard.ts:19-20) x a null return (:3941) consumed by a caller that cleared its flag BEFORE the call (:4030, :4054, :4087). One root, three surfaces."
  - "e21's fix was CORRECT and STAYS: the guard re-arm, the bounded budget, the clear-inside-the-mode-gate placement and the close-gate reporting are all intact (guardrail 1, audited invariant by invariant below). e21's theory failed because its pins were source-shape and its probes handed the document straight to the transport — the guard was never IN the loop. This run closed that fidelity gap rather than replacing the fix."
  - "The link lived in a component-local closure the Studio cannot expose (it cannot be mounted under vitest), so the plan's clause was used: createDocumentSyncPushDecision was hoisted into documentSyncPushGuard.ts as a PURE MOVE that reproduces the CAPTURE faithfully — the bug was reproduced, not pre-fixed — and the component keeps calling the same behaviour at the same points."
  - "The fix is the minimum the verified link allows: one slot read moved from creation time to decision time, inside decide(). No file outside the two the link needs was touched; the transport, the parent apply, the reopen carrier, the store/package save and the .mce format are all untouched."
  - "The two fingerprint dedupe semantics are PRESERVED: a genuine duplicate still returns null and is still skipped. Only the case where the latch belongs to a FAILED send changes, and that case is exactly what the failure path's own re-arm was written for."
  - "The retry stays bounded: with the fix a failed send's retry actually sends, and a persistent failure terminates after DOCUMENT_SYNC_MAX_AUTO_RETRIES = 3 automatic re-flushes (asserted behaviourally, not narrated). No new timer, no new signal, no new hook, no new promise owner (efx-async-orchestration)."
  - "No manifest/package shape change, no new event pair, no new IPC or Rust command, no c7x revision/identity or loop-clip-lifecycle territory. Structural check S1..S4 all false — the halt path did NOT fire."

patterns-established:
  - "A drop whose cause is 'a value captured at render time' is invisible to a source-text pin: the pin must drive the decision with the real inputs and observe the consequence (no send, nothing owed). Source-shape assertions on a capture cannot distinguish the capture from a live read."
  - "When a re-arm and the decision that must observe it are separated by a render boundary, the re-arm is only reachable if every path between them reads the slot. Pin the reachability, not the presence of the re-arm line."

requirements-completed: []

# Coverage metadata (#1602) — one entry per shipped deliverable.
coverage:
  - id: D1
    description: "The reference image selected in the Studio reaches the PARENT realm's document after a failed push is retried, so the next Studio launch carries the same active reference."
    verification:
      - kind: unit
        ref: "app/src/stores/efxPaintStudioOriginSync.scratch.test.ts#PIN 1 (reference selection): the parent realm and the reopen carrier hold the selected reference after a failed push is retried"
        status: pass
      - kind: unit
        ref: "app/src/stores/efxPaintStudioOriginSync.scratch.test.ts (Task-1 probe) step4_crossing — parentAfterCarries.photoReference true through the real transport and the real parent listener"
        status: pass
    human_judgment: true
    rationale: "A real cross-webview emitTo and a real onCloseRequested are mocked in every unit leg, and the Studio cannot be mounted under vitest (Tauri window/engine deps) — the live close/reopen behaviour is native UAT row 1."
  - id: D2
    description: "The background image keyframe placed in the Studio reaches the PARENT realm's document at its startFrame with its source refs after a failed push is retried, so the reopen renders the clip at the same frame."
    verification:
      - kind: unit
        ref: "app/src/stores/efxPaintStudioOriginSync.scratch.test.ts#PIN 2 (background keyframe): the parent realm and the reopen carrier hold the clip at its placement frame after a failed push is retried"
        status: pass
    human_judgment: true
    rationale: "Same mock boundary as D1; the live clip-at-its-frame rendering after a real close and a real quit/relaunch is native UAT row 2."
  - id: D3
    description: "Every track added with the Studio's (+) reaches the PARENT realm's document with its content after a failed push is retried, so the reopen shows the track."
    verification:
      - kind: unit
        ref: "app/src/stores/efxPaintStudioOriginSync.scratch.test.ts#PIN 3 ((+) track with its content): the parent realm holds the added, activated track after a failed push is retried"
        status: pass
    human_judgment: true
    rationale: "Same mock boundary as D1/D2, plus the painted content's visual reproduction after a real reopen is native UAT row 3."
  - id: D4
    description: "The three surfaces survive the .mce roundtrip: the parent save writes them into layers/<layerId>.json."
    verification:
      - kind: unit
        ref: "app/src/stores/efxPaintChildParentSync.scratch.test.ts (5 tests, pass, untouched by this plan — the store/package seam is exonerated, and exonerated is not the same as unverified)"
        status: pass
    human_judgment: true
    rationale: "Unit-proven at the store/package seam; the durability of a real .mce package through a real quit/relaunch is native UAT row 4."
  - id: D5
    description: "The 260921-bjm gallery import path is unchanged and still persists."
    verification:
      - kind: unit
        ref: "bjm regression row: vitest run on physicsPaintBridgeTransport + PhysicsPaintStudio + BackgroundAssetPickerView + projectStore + physicPaintStore → 5 files passed, 313 passed | 9 todo (322), 0 failed"
        status: pass
    human_judgment: true
    rationale: "The automated row proves the legs are green in the same run; the live end-to-end import-then-reopen is native UAT row 5."
  - id: D6
    description: "The transfer stays on the pre-existing child→main document pair: no added event pair, no added IPC/Rust command, no manifest schema change — the 52.2 reference-only law holds."
    verification:
      - kind: other
        ref: "event-pair gate: no new event-name string constant in the production diff; no new invoke()/emitTo()/listen() in production files; the transfer stays on physic-paint:efx-paint-document"
        status: pass
      - kind: other
        ref: "scope gate: git diff --name-only afc349aa..HEAD lists 4 paths, none in src-tauri/, none in app/src/efx-paint/document/**, no capability file, no dependency manifest, no app/src/stores/efxPaintStore.ts"
        status: pass
    human_judgment: false
  - id: D7
    description: "Quick 260921-c7x is not reopened: the canonical loop-clip revision authority and the terminal physical-edit mismatch release behave exactly as shipped, and this plan's diff shares no file with c7x's."
    verification:
      - kind: unit
        ref: "c7x regression row: vitest run src/components/physic-paint/hooks/useRotoPhysicalEditCoordinator.test.ts src/lib/physicPaintBridge.test.ts → 2 files passed, 218 passed | 1 skipped (219), 0 failed"
        status: pass
      - kind: other
        ref: "comm -12 between the c7x commits' file list (a4605d67, 49992816 — 5 files) and this plan's diff (4 paths) → empty"
        status: pass
    human_judgment: false
  - id: D8
    description: "The four fidelity gaps that made e21's probes blind are each closed with a control that passes: the guard in the loop driven behaviourally (FG-1), the serialize diff with its write-back (FG-2), two real module instances (FG-3), and the close sequence driven with real inputs (FG-4)."
    verification:
      - kind: unit
        ref: "app/src/stores/efxPaintStudioOriginSync.scratch.test.ts#diagnoses each surface through the composition the product runs, and records the raw probe output — realmIsolation.separateInstances true, FG-2 d2 === d3, FG-3 child document invisible to the parent, FG-4 gate fires and the flush pushes"
        status: pass
    human_judgment: false

# Metrics
duration: 25min
completed: 2026-09-21
status: complete
---

# Quick 260921-ffh: Studio-origin surfaces reach the save realm — the push decision reads the guard at decision time

**The three Studio-origin document surfaces were lost because the push decision consulted a guard captured at render creation while the failure path re-armed the REF: a retry with no render in between read the failed content as its own duplicate, returned null, and the caller — which clears the pending flag BEFORE the push — consumed the change with no send and no re-mark. The decision now reads the slot when it decides; the three behavioural pins are RED at base and GREEN after, with nothing weakened.**

## Performance

- **Duration:** 25 min
- **Started:** 2026-09-21T09:12:40Z
- **Completed:** 2026-09-21T09:37:38Z
- **Tasks:** 3
- **Files modified:** 4 (2 production, 1 harness, 1 evidence)

## Diagnosis — the (a)/(b)/(c) verdicts

All three surfaces are **verdict (a)** at **one composite link**, not three separate defects.

| Surface | Handler driven | Verdict | Link |
|---|---|---|---|
| reference selection | `handleConfirmReferencePicker` (`PhysicsPaintStudio.tsx:4298-4329` → `setPhotoReferenceSource`) | **a** | `:3914` (the render-captured guard) × `:3928` (the decision reads the capture) × `:3987` (the failure path re-arms the REF) × `documentSyncPushGuard.ts:19-20` (the latch is set BEFORE the send resolves) × `:3941` (a null returns) × `:4030` (the caller cleared `documentSyncDirty` BEFORE the push) |
| background-image keyframe | `handleConfirmBackgroundPicker` (`:4209-4285` → `addBackgroundClip` + the library hydration read) | **a** | the same composite link |
| (+) track | `handleAddTrack` (`:2866-2875` → `addTrack` THEN `setActiveTrackId`) | **a** | the same composite link, and this is the surface the CLOSE path destroys the evidence for: the gate fires, the flush clears inside the mode gate and pushes, the push hits the stale capture, the flush reports a clean outcome, and `usePhysicsPaintCloseFlush` destroys the window with the parent stale |

**Every downstream link is exonerated by probe, not by assumption:** the mutation itself (step 1 — the child document carries all three), `serializeRuntimeIntoDocument` (step 2 — `d2 === d3`, the write-back does not revert them), the transport and the real parent listener (step 4 — the parent applies and carries all three), the reopen carrier (step 5), and the store/package save seam (pre-existing `efxPaintChildParentSync.scratch.test.ts`, 3 pass).

## Structural check — the halt path did NOT fire

| Structural trigger | Measured |
|---|---|
| S1 manifest/package format or the 52.2 reference-only law | **false** |
| S2 a new independent transport | **false** |
| S3 c7x revision/identity authority or loop-clip lifecycle | **false** |
| S4 a Rust command or capability | **false** |

`halt.fired = false`, `proceedToTask2 = true`. The root sits inside the existing push wiring on the pre-existing `physic-paint:efx-paint-document` pair, so the plan proceeded to Tasks 2 and 3.

## The four fidelity controls and what each changed

| Gap | What e21 could not see | How this run closed it | Observed |
|---|---|---|---|
| **FG-1** the guard in the loop | e21 handed the document straight to `sendEfxPaintDocumentSync` and pinned the guard with a **source-text** assertion — the guard-in-the-loop behaviour was never entered | every push-shaped probe routes its document through `createDocumentSyncPushGuard().evaluate(...)` exactly as the component does, and the caller contract is driven with a real signal | the second, re-entrant `evaluate` on the same guard returns `null` with `dirtyAfterClear=false`, `documentStillOwed=false` — the drop SHAPE is real, but there it is a true duplicate and nothing is lost. The reachable drop is step 8 |
| **FG-2** the serialize diff | e21 used a hand-built document, or serialized in the realm that had not mutated | `d1` = revision before, `d2` = what serialize returned, `d3` = the child document after the write-back | **GREEN — FG-2 is exonerated for these three surfaces**: `serializeThrew=null`, `d2 === d3`, `documentRevision` 4→5, all three surfaces carried before AND after |
| **FG-3** realm isolation | e21 drove ONE module instance and faked the parent with `resetEfxPaintStore()` mid-test, so module state leaked across the "boundary" | two real module instances (`vi.resetModules()` between them), with the isolation control asserted BEFORE any probe | **PASS** — `separateInstances`, `separateEfxVersionSignals`, `separatePhysicStores`, `childDocumentVisibleInChild=true`, `childDocumentVisibleInParent=false` |
| **FG-4** teardown | e21 never drove the close sequence at all | the close gate is composed with its real terms and evaluated for the state each surface's mutation leaves, then the flush body is driven through the mode gate | **GREEN for the gate itself** — for all three surfaces the gate WOULD fire, the flush WOULD clear inside the mode gate and WOULD push. The push it then makes is the step-8 link |

## The hoist — a pure move, recorded

The verdict named a link inside `pushLiveProjection`, a component-local closure with no exported entry, and the Studio cannot be mounted under vitest (Tauri window/engine deps) — so the plan's clause was used. `documentSyncPushGuard.ts` gained `createDocumentSyncPushDecision(guardRef, readVersion) → { decide(serialize) }`.

- **Pure move.** The hoisted version reproduced the defect FAITHFULLY (`const captured = guardRef.current` at creation). The bug was reproduced, not pre-fixed — a hoist that had already fixed it would have been green at base and proven nothing.
- **The component keeps the same behaviour at the same points.** It creates the decision where it used to read the ref, and calls `decide(serialize)` instead of the inline evaluate. The failure path, the bounded budget, the clear placement, the close-gate reporting and both effect deps arrays are untouched.
- **No new signal, no new timer, no `useState`, no new promise owner.**
- **Pre-existing source-shape contracts were neither re-pointed nor loosened.** `PhysicsPaintStudio.test.ts` reads the component's push path around the send, the `.catch` and the re-arm — none of which moved. That file's 147 tests pass unedited, as do `documentSyncPushGuard.test.ts`'s 5.

## The diagnosed link — before / after

```ts
// BEFORE — the decision consulted the guard this render captured
export function createDocumentSyncPushDecision(guardRef, readVersion) {
  const captured = guardRef.current;
  return {
    decide: (serialize) => (captured === null ? null : captured.evaluate(serialize, readVersion)),
  };
}

// AFTER — the decision consults the slot, so the failure path's re-arm is reachable
export function createDocumentSyncPushDecision(guardRef, readVersion) {
  return {
    decide: (serialize) => {
      const guard = guardRef.current;
      return guard === null ? null : guard.evaluate(serialize, readVersion);
    },
  };
}
```

One slot read moved from creation time to decision time. Nothing else in the two files changed except a comment.

## Task Commits

Each task was committed atomically:

1. **Task 1: Diagnose the three surfaces through the real child→parent chain (FG-1..FG-4 closed)** - `7fc456b0` (test)
2. **Task 2: Pin the three surfaces RED, behaviourally, through the real chain** - `5e860169` (test)
3. **Task 3: Fix the diagnosed link inside the existing channel** - `eecadba2` (fix)
4. **Evidence: the GREEN run and the seven verification checks** - `026e70a9` (test)

**Plan metadata:** not committed by this executor — the orchestrator owns the docs commit (SUMMARY.md, STATE.md, PLAN.md), and ROADMAP.md was deliberately not touched.

## RED → GREEN

**RED at base** (`pnpm --filter efx-motion-editor exec vitest run src/stores/efxPaintStudioOriginSync.scratch.test.ts`):

```
 Test Files  1 failed (1)
      Tests  3 failed | 3 passed (6)
   Start at  11:34:42
```

Three `AssertionError`s, one per pin. Verbatim, PIN 3's received object:

```
received { firstPushCarriedTheTrack: true, firstSendFailed: true,
           retryDecisionYieldedTheDocument: false, retryWasSent: false,
           parentCarriesTheAddedTrack: false, parentActivatedTheAddedTrack: false }
```

Each pin therefore failed for the DIAGNOSED reason: the first push carried the surface and the send failed (the two legs that prove the pin drove the real chain), and the retry — through the SAME decision with no render in between — decided against the captured guard, so `retryDecisionYieldedTheDocument` and `retryWasSent` are false and the parent never saw the surface. **No pin failed for a missing symbol, a compile error or a source-text offset; none asserted on source text or a file offset.**

**GREEN after the fix** (same command):

```
 Test Files  1 passed (1)
      Tests  6 passed (6)
   Start at  11:35:29
```

All three pins, the Task-1 diagnostic probe, the positive strokes control and the negative e21-guardrail control pass in the same run. **Zero assertions weakened, zero deleted.**

## The two-channel contrast (H4) — as executable evidence, not narration

| | strokes / physical edits | the three Studio-origin surfaces |
|---|---|---|
| sender | `sendPhysicPaintApplyPayload` (:420) | `sendEfxPaintDocumentSync` (:323) |
| event | `physic-paint:apply` (bridge:89) | `physic-paint:efx-paint-document` (bridge:97) |
| ack | **yes** — `physic-paint:apply-result` (bridge:90), correlated by `operationId` | **none** |
| gated by a dirty flag | no | **yes** |
| debounced | no | 2000 ms / 2500 ms gesture-quiet |
| close flush required | no | **yes** |
| guard in the loop | no | **yes** |

In the same run, the strokes control is GREEN (`parentAppliedTheStroke=true`, `parentAppliedOneFrame=true`, `parentHoldsTheStrokeFrame=true`) while all three surface pins are RED. A stroke is safe the moment its gesture ends; a structural change is safe only if a flush fires AND the guard lets it through AND the parent apply accepts it. That asymmetry is why the three surfaces died on a plain close while the paint survived — and it is now a passing leg and a failing leg in one file rather than a paragraph.

## Regression rows

| Row | Result |
|---|---|
| the 5-suite row | **5 files passed, 192 passed (192)**, exit 0 — includes `efxPaintChildParentSync.scratch.test.ts` (the bjm store-seam suite) |
| full suite | **217 passed \| 2 skipped (219) files; 4071 passed \| 1 skipped \| 101 todo (4173)**, exit 0 |
| full-suite base + delta | base = **4065 passed** (derived: the harness file is new in this plan — absent at `planBase` — and contributes exactly 6 legs, and this plan's diff touches no pre-existing test file, so no other count moved). **Delta = +6. Zero failures, zero absorbed** (skipped count 1 before, 1 after) |
| bjm regression | **5 files passed, 313 passed \| 9 todo (322)**, exit 0 |
| c7x regression | **2 files passed, 218 passed \| 1 skipped (219)**, exit 0 |
| `comm -12` (c7x ∩ this plan) | **empty** — c7x touched 5 files (`a4605d67`, `49992816`), none of them in this plan's diff |

## Gate results — the plan's seven checks

| # | Check | Result |
|---|---|---|
| 1 | the 5-suite row | exit 0 — 5 files passed, 192 passed |
| 2 | `tsc --noEmit` | exit 0, **no output** |
| 3 | full suite | exit 0 — 4071 passed, base 4065 + 6 new legs, zero absorbed |
| 4 | bjm regression | exit 0 — 5 files passed, 313 passed \| 9 todo |
| 5 | c7x regression + `comm -12` | exit 0, 218 passed \| 1 skipped; the intersection is empty |
| 6 | scope gate | **PASS** — see below |
| 7 | event-pair gate | **PASS** — see below |

## Scope gate

```
$ git diff --name-only afc349aab77cb2bd825b573ebc750dd105da8334..HEAD
.planning/quick/260921-ffh-e21-uat-falsified-reference-selection-ba/260921-ffh-RED-EVIDENCE.json
app/src/components/physic-paint/PhysicsPaintStudio.tsx
app/src/components/physic-paint/bridge/documentSyncPushGuard.ts
app/src/stores/efxPaintStudioOriginSync.scratch.test.ts
```

Every path is inside the plan's authorized set. No `src-tauri/`, no capability file, no dependency manifest, no `app/src/efx-paint/document/**`, no `app/src/stores/efxPaintStore.ts` — the last one is significant: the verdict did **not** name the serialize write-back (FG-2 was GREEN), so the store was correctly left alone.

**Event-pair gate:** no new event-name string constant appears in the production diff. The only added occurrences are probe NARRATION strings that quote the pre-existing constants with their source locations. No `invoke()` in production files; the added `unlisten()` calls are the harness's teardown of its own parent-realm listener. The transfer stays on `physic-paint:efx-paint-document`, and the stroke control stays on `physic-paint:apply`.

## Guardrail audit — the e21 fix, invariant by invariant

Audited by reading the post-fix file. Line numbers are post-fix (the comment added in this plan shifted the region by +6).

| Invariant | Where it lives now | Held |
|---|---|---|
| `DOCUMENT_SYNC_MAX_AUTO_RETRIES = 3` | `:359`, used `:3988` | **yes** |
| `documentSyncPushFailuresRef` | `:3928` declared, `:3981` reset on a landed push, `:3988-3989` bounded increment, `:4018`/`:4020` close gate + early return | **yes** |
| the `.catch` re-arm | `:3987` `documentSyncPushGuardRef.current = createDocumentSyncPushGuard()` | **yes** |
| clear-dirty INSIDE the mode gate | `:4030` (close flush), `:4054` (debounce), `:4087` (gesture) — each preceded by `if (layerId && (mode === 'Tauri' \|\| mode === 'Browser fallback'))` | **yes** |
| close gate reports a still-owed change | `:4018` + `:1919` (`dirty.peek() \|\| failures > 0`) | **yes** |
| the deps arrays that make the re-arm reachable | `:4063` reads `documentSyncDirty.value`; `:4096` reads `interactionIdle.value` | **yes** |

**Behaviourally, not just textually:** the negative control asserts a failed send still re-arms, still stays owed, and still terminates — `rearmReplacedTheGuard=true`, `automaticReFlushes=3` (6 attempts arm 3), `rearmedGuardCarriesTheSameContent=true`, `closeGateReportsTheOwedChange=true`, `unresolvedModeLeavesItPending=true`, `confirmedModeConsumesAndAttempts=true`. Loop termination with the fix: a persistent failure exhausts the budget after 3 automatic re-flushes and stops re-marking; a landed push resets the streak and the guard's fingerprint then dedupes the serialize's own re-entrant re-fire. No new timer, no new signal, no new promise owner.

**Threat model:** the fail-closed parse (`physicPaintBridge.ts:3277`) and the parent's idempotency/anti-rollback guard (`:3283`) are untouched — neither file is in the diff — and the fix does not change when or whether the document's revision bumps, so the anti-rollback guard still skips only genuinely identical content (T-01, T-02 mitigated). The retry budget holds (T-03). The close gate still reports the owed change (T-04). No package was installed, so the package-legitimacy gate did not fire (T-SC).

**Skills consulted:** `efx-preact-reactivity` (rule by rule: no new hook or state; no setter changed; no effect dep array touched; `efxPaintVersion.peek()` is a non-subscribing read; no render-body write; the retry's termination condition is stated and asserted) and `efx-async-orchestration` (hand-rolled FSM and retry kept — no library adoption against a named problem; the retry stays bounded and every await still terminates).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Three `tsc --noEmit` errors surfaced by Task 1's harness under Task 2's type-check**
- **Found during:** Task 2 (running `tsc --noEmit` before the commit)
- **Issue:** (i) `let firstDocument: unknown = null;` passed to `sendEfxPaintDocumentSync` — `unknown` is not assignable; (ii) `let applied: {...} | null = null;` assigned only inside a listener callback narrowed to `never`, so `applied.ok` errored; (iii) in the e21-guardrail control, `decision.decide(...)` types as `EfxPaintDocument | null` and was passed straight to the sender.
- **Fix:** typed the first via `Parameters<TransportModule['sendEfxPaintDocumentSync']>[0] | null` with a null guard around the send; held the second in a `{ result: ... }` holder object; added an explicit null guard before the third's send.
- **Files modified:** `app/src/stores/efxPaintStudioOriginSync.scratch.test.ts`
- **Verification:** `tsc --noEmit` exit 0 with no output; the RED run unchanged at `3 failed | 3 passed (6)`
- **Committed in:** `5e860169` (Task 2 commit)

### Plan-authorized action that Task 2's `<files>` list does not name

Task 2's `<files>` lists only the harness and the evidence JSON, but Task 2's action clause authorizes the hoist explicitly ("If, and only if, the verdict names a link that lives inside a component-local closure with no exported entry, HOIST that link into a focused, testable module as a PURE MOVE … and pin the hoisted function"). The verdict named exactly that link, so `documentSyncPushGuard.ts` and `PhysicsPaintStudio.tsx` were modified in the Task 2 commit. Both are named in Task 3's `<files>` and the plan's frontmatter `files_modified`, so the scope gate is satisfied — but this is recorded here rather than left implicit.

### Execution-mode note

Worktree isolation was auto-degraded before dispatch (local HEAD `afc349aa` is ahead of the unpushed `origin/HEAD` `81730d01`), so this plan ran **sequentially on `main`** as the dispatch directed, and all four commits are `main` commits. The executor's default protected-branch assertion would otherwise have halted; the dispatch instruction and the prior quicks in this series (e21, c7x, bjm) all commit on `main`, so the dispatch governs.

---

**Total deviations:** 1 auto-fixed (Rule 1) + 1 plan-clause-authorized file expansion, both recorded above.
**Impact on plan:** The auto-fix was typing only — no behaviour, and the RED run was identical before and after. The hoist is the plan's own clause and is the reason the link could be pinned behaviourally at all. No scope creep.

## Issues Encountered

**A design dead-end worth recording, because it would have made Task 3 an edit of the test.** Four candidate seams were considered for driving the broken link and rejected: an `onDeliveryFailed` options bag (it would have forced Task 3 to edit the pins — "editing the test to make it pass"); a guard-level `release()`/`rearm()` API (the base failure would have become a missing symbol, which the plan bans); reproducing `pushLiveProjection`'s buggy composition inside the harness (unfixable by any production change); and a "pure move" that already read the live slot (green at base). The hoist that preserves the capture is the only shape satisfying both the plan and the honesty rule.

**One probe narration string describes the BASE composition.** `step8_rearmReachability` reconstructs the capture-at-creation shape locally (that is what makes it a permanent green lock on the diagnosis), so its `note` and its `guardOutcomeForTheClosePush` string describe what was true at base. It is a base measurement deliberately kept, not a statement about the current component — the pins in the same file are the live contract.

**`[physicPaintBridge] Rejected EFX Paint document sync: EfxPaintDocument: expected a record.` on stderr during the RED run** is the expected consequence of dispatching a null payload: at base there is no wire payload when the retry is suppressed. Post-fix the dispatch carries the real payload, as step 4 measured.

**A read-hook injection scan flagged `PhysicsPaintStudio.tsx`** (LOW, "act-as-?"). It matched a comment in the file; no action taken.

## Deferred Issues

`documentSyncDirtyRef` / the `documentSyncDirty` signal, the hand-rolled bounded retry and the close-flush ref dance remain a hand-rolled FSM. `efx-async-orchestration` §1 requires adoption only against a named architectural problem, and the named problem here was a stale read, not a missing machine — so no library was introduced. If this region is touched again for a NEW reason, the pilot pattern in `app/src/components/physic-paint/pilot/` is the reference.

## Known Stubs

None. No hardcoded empty value flows to a UI surface, no placeholder text was introduced, and every new code path in this plan is wired to a real consumer: `decide()` is called by `pushLiveProjection`, which is called by all four flush paths.

## Threat Flags

None. This plan introduces no new network endpoint, no new auth path, no new file-access pattern and no schema change at a trust boundary. It moves one slot read inside an existing function.

## Native UAT — PENDING, NOT CLAIMED

No unit leg can prove a real cross-webview `emitTo` delivery or a real `onCloseRequested`. **The five rows below are the user's, and are not claimed by this run.**

| # | Row | Status |
|---|---|---|
| 1 | A reference image selected in the Studio is present in the parent realm's document before the child window is destroyed, so the next Studio launch carries the same active reference | **PENDING — native UAT is the user's** |
| 2 | A background image keyframe placed in the Studio is present in the parent realm's document with its `startFrame` and source refs, so the reopen renders the clip at the same frame | **PENDING — native UAT is the user's** |
| 3 | Every track added with the Studio's (+) — painted or empty — is present in the parent realm's document with its content, so the reopen shows the track | **PENDING — native UAT is the user's** |
| 4 | The three surfaces survive the `.mce` roundtrip: the parent save writes them into `layers/<layerId>.json` | **PENDING — native UAT is the user's** |
| 5 | The 260921-bjm gallery import path still persists (regression row) | **PENDING — native UAT is the user's** |

**The residual risk this run cannot retire, stated plainly:** a real failed `emitTo` in the live app must be what drives the failure path. The unit legs make `emitTo` reject once; the live transport's failure modes (a destroyed sibling webview, a refused delivery) are the ones the re-arm exists for. If native UAT still shows the three surfaces lost, the next place to look is the close/teardown delivery — that is the boundary this plan measured the DECISIONS of but could not execute.

## Next Phase Readiness

- The push path's decision/guard seam is now a testable module (`createDocumentSyncPushDecision`) with three behavioural pins over the real child→parent chain — future work on this region can drive it without mounting the Studio.
- The `.mce` format, the transport, the parent apply, the reopen carrier and the store/package save are all measured-clean for these three surfaces, so any remaining live loss is in the cross-webview delivery or teardown, not in the serialization.
- Phase 53 is unaffected by this diff: it shares no file with c7x, changes no event pair, no manifest and no Rust surface.

---
*Phase: quick-260921-ffh*
*Completed: 2026-09-21*

## Self-Check: PASSED
