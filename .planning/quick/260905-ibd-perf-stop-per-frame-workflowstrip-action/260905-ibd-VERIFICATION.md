---
phase: quick-260905-ibd
verified: 2026-09-05T14:40:00Z
status: human_needed
score: 5/5 must-haves verified
behavior_unverified: 0
overrides_applied: 0
human_verification:
  - test: "Scrub through dense reveal rails (baked keys ~1 per frame) and watch the workflow strip action-row buttons (Key/Create rail/Push/Insert/Duplicate/Copy/Paste/Cut/Scissor/All/Trash)."
    expected: "The action-row buttons no longer visibly refresh every frame during the scrub; after releasing on frame N, +Key/Delete/Scissor/Paste immediately reflect frame N's availability (correct enabled/disabled state and tooltip) — no stale state."
    why_human: "The per-frame re-render and post-release availability correctness are visual/runtime behaviors. Automated evidence proves the mechanism (memo-wrapped action-row, identity-stable props, live signal reads) but cannot observe the rendered scrub — the project's vitest setup has no DOM renderer (documented re-scope in CONTEXT.md)."
---

# Phase quick-260905-ibd: Perf — stop per-frame WorkflowStrip action-row re-renders during scrub (G-52-9)

**Phase Goal:** Stop the per-frame WorkflowStrip action-row re-renders during scrub (G-52-9) — narrow the RENDER SCOPE of the action-row while keeping availability LIVE.
**Verified:** 2026-09-05T14:40:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| #   | Truth   | Status     | Evidence       |
| --- | ------- | ---------- | -------------- |
| 1   | During a scrub, the workflow strip's action-row buttons no longer re-render every frame: the action-row is a memo-wrapped component whose props (signals, scalars, handlers) are identity-stable across Studio renders. | ✓ VERIFIED | `const PhysicsPaintRotoActionRow = memo(PhysicsPaintRotoActionRowImpl)` (PhysicsPaintWorkflowStrip.tsx:2021). All props identity-stable: `rotoPhysicalActions` (useMemo bundle, deps end `effectiveInput.publishStatus, effectiveInput.setApplyStatus` — useRotoTimelineActions.ts:3367), `sessionAvailability`/`hasCopiedRotoKey` (field-wise guarded-echo mirror signals, PhysicsPaintStudio.tsx:1705-1723), `currentFrameSignal` (Studio-owned useSignal, :390), handlers (stable useCallbacks via `actionRowHandlersRef` deferred-ref, :1795-1816), stable maps (`structuralIndex` useMemo :2246, `visibleFrameResolutions` useMemo :2315). Row body reads availability signals only; frame-dependent parts are narrow subscribers. Source-scan contract test asserts memo-wrapping + ReadonlySignal props (PhysicsPaintWorkflowStrip.test.ts). |
| 2   | Availability stays LIVE (HARD CONSTRAINT): after scrubbing to frame N and releasing, +Key/Delete/Scissor/Paste immediately reflect frame N's availability — no stale enabled/disabled state. | ✓ VERIFIED | Behavioral re-evaluation test (useRotoTimelineActions.test.ts:974-982): with a real key at frame 5, `canAddEmptyKey` is false at frame 5 and flips to true when `currentFrameSignal` flips 5→6 — proves the useComputed computeds re-evaluate on the tracked frame signal. Classifier ports read signal mirrors (`rotoKeyRecordsSignal.value`, `effectiveSelectedRotoKeyRailSignal.value`, etc.) so availability stays live after scrub release. |
| 3   | The availability computeds are identity-stable across renders (useComputed) and re-evaluate when their signal-tracked inputs change (every classifier input port reads a signal or a deferred ref). | ✓ VERIFIED | All ~26 availability computeds converted to `useComputed` (useRotoTimelineActions.ts:1819-1855); classifier logic byte-identical (diff shows only `computed(` → `useComputed(` and `input` → `effectiveInput`). Every port reads a signal mirror, a selection signal, `currentFrameSignal` (via `effectiveInput.getCurrentAppFrame`), or `launchContextRef.current` (deferred ref). Source-scan contract asserts `useComputed(` + `effectiveInput` (useRotoTimelineActions.test.ts:3736-3741). |
| 4   | The action-row buttons read ReadonlySignal props in narrow per-button subscribers; the strip's internal currentFrame mirror is replaced by the Studio-owned signal prop. | ✓ VERIFIED | `PhysicsPaintRotoKeyIdentity` (PhysicsPaintWorkflowStrip.tsx:1466-1477) and `PhysicsPaintRailCreateButton` (:1483-1526) read `props.currentFrameSignal.value` in their own render bodies; the row body uses `currentFrameSignal.peek()` for the generated-frame message (:1683) so it never subscribes per frame. The strip's internal mirror is replaced by the Studio-owned signal prop (:2060-2064 fallback mirror only when the prop is absent — test-harness path; production passes the prop at :4066). |
| 5   | The whole app test suite stays green and tsc --noEmit is clean. | ✓ VERIFIED | `pnpm exec vitest run`: 185 files passed, 3461 tests passed, exit 0. `pnpm exec tsc --noEmit`: exit 0. |

**Score:** 5/5 truths verified (0 present, behavior-unverified)

### Required Artifacts

| Artifact | Expected    | Status | Details |
| -------- | ----------- | ------ | ------- |
| `app/src/components/physic-paint/hooks/useRotoTimelineActions.ts` | useComputed availability computeds + currentFrameSignal hook argument + effectiveInput override | ✓ VERIFIED | Signature `(input, currentFrameSignal: ReadonlySignal<number>)` (:1783); `effectiveInput` overrides `getCurrentAppFrame: () => currentFrameSignal.value` (:1784); ~26 useComputed computeds (:1819-1855); `pendingOperationIdSignal = effectiveInput.pendingOperationId` (:1856); bundle useMemo deps end `effectiveInput.publishStatus, effectiveInput.setApplyStatus` (:3367). |
| `app/src/components/physic-paint/PhysicsPaintStudio.tsx` | Studio-owned currentFrameSignal + signal mirrors + useComputed selection signals + memoized hook input | ✓ VERIFIED | `currentFrameSignal = useSignal(launchContext?.startFrame ?? 0)` (:390); guarded-echo writes in the three startFrame callers (:548, :1323, :1385); six mirror signals (:639-644, :660-661, :674-675, :916-917); three useComputed selection signals (:662-666, :676-689, :935-940); memoized input on stable deps (:1508-1570); `useRotoTimelineActions(rotoTimelineActionsInput, currentFrameSignal)` (:1571). |
| `app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.tsx` | memo-wrapped PhysicsPaintRotoActionRow + currentFrameSignal prop, internal mirror removed | ✓ VERIFIED | `PhysicsPaintRotoActionRow = memo(PhysicsPaintRotoActionRowImpl)` (:2021); `currentFrameSignal: ReadonlySignal<number>` prop (:215, :1436); narrow subscribers (:1466, :1483); internal mirror replaced by Studio-owned signal prop (:2060-2064 fallback only for test harnesses). |
| `app/src/components/physic-paint/hooks/useRotoTimelineActions.test.ts` | updated harness + re-evaluation test + source-scan contract | ✓ VERIFIED | `vi.mock('@preact/signals')` mapping `useComputed → computed` (:12-17); harness passes `signal(...)` second arg (:189-191); re-evaluation test (:974-982); source-scan contract (:3736-3741). 131 tests pass. |
| `app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.test.ts` | updated source-scan assertions + new action-row contract test | ✓ VERIFIED | `getActionRowBlock` retargeted to the extracted component (:39-46); action-row contract tests assert memo-wrapping, ReadonlySignal props, narrow subscribers (:2131-2210); rail-drag assertions unchanged. 141 tests pass. |

### Key Link Verification

| From | To  | Via | Status | Details |
| ---- | --- | --- | ------ | ------- |
| `effectiveInput` (hook) | `currentFrameSignal` | `getCurrentAppFrame: () => currentFrameSignal.value` | ✓ WIRED | useRotoTimelineActions.ts:1784 — the single point where the frame becomes signal-tracked. |
| Studio-owned `currentFrameSignal` | three startFrame callers | guarded echo `if (sig.peek() !== next) sig.value = next` | ✓ WIRED | scheduleRotoStartFramePropagation (:548), setCurrentAppFrame (:1323), setLaunchContextStartFrame (:1385). None write inside the setLaunchContextState updater (Rule 6 respected). |
| Memoized hook input | `rotoPhysicalActions` identity | useMemo on stable deps | ✓ WIRED | PhysicsPaintStudio.tsx:1508-1570; bundle useMemo deps stable (useRotoTimelineActions.ts:3367) — the memo-wrapped action-row skips re-renders during scrub. |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| -------- | ------------- | ------ | ------------------ | ------ |
| Action-row availability | `sessionAvailability` | `rotoSession.actionAvailability` via stable mirror signal | ✓ FLOWING | Mirror signal written by field-wise guarded echo from the session signal (PhysicsPaintStudio.tsx:1705-1719); action-row reads `.value` in render. |
| Action-row availability | `rotoPhysicalActions.*` | useComputed computeds over signal mirrors + currentFrameSignal | ✓ FLOWING | Classifier ports read `rotoKeyRecordsSignal.value`, `effectiveSelectedRotoKeyRailSignal.value`, etc. — real store-derived data, not static. |
| Key identity / + Rail frame | `currentFrameSignal` | Studio-owned useSignal written by the three startFrame callers | ✓ FLOWING | Narrow subscribers read `.value`; the signal is written from real scrub/seek events. |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| Hook test file (harness + re-evaluation + source-scan) | `pnpm exec vitest run src/components/physic-paint/hooks/useRotoTimelineActions.test.ts` | 131 passed | ✓ PASS |
| Strip test file (action-row contracts + updated assertions) | `pnpm exec vitest run src/components/physic-paint/view/PhysicsPaintWorkflowStrip.test.ts` | 141 passed | ✓ PASS |
| Full suite | `pnpm exec vitest run` | 185 files / 3461 tests passed, exit 0 | ✓ PASS |
| Type check | `pnpm exec tsc --noEmit` | exit 0 | ✓ PASS |
| Re-evaluation (availability stays live) | hook test `re-evaluates a frame-dependent computed when currentFrameSignal flips` | canAddEmptyKey false@5 → true@6 | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| ----------- | ---------- | ----------- | ------ | -------- |
| G-52-9 | 260905-ibd | Workflow strip action-button re-render during scrub (deferred from Phase 52 UAT) | ✓ SATISFIED | Memo-wrapped action-row with identity-stable props; availability computeds useComputed-stabilized with signal-backed classifier ports; re-evaluation test proves live availability; full suite green. |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| PhysicsPaintWorkflowStrip.tsx | 1714 | aria-label on the key-utilities group changed from `Roto key tools for frame ${frame}` to `Roto key tools` | ⚠️ Warning | Minor DOM-attribute deviation from the "no DOM change" constraint. Necessary consequence of the extraction: the row body cannot subscribe to the frame. Not a visual/class/tooltip/disabled-logic change; the frame number is still announced by the key-identity block (`Roto layer ... key ${frame}`). No test asserted the old label. |

No TBD/FIXME/XXX markers in the modified files. No new window-level listeners (the rail-create menu listeners were moved from the strip body into the extracted component, not added). No new `useState` additions. No module-scope signals (all new signals are per-instance `useSignal`/`useComputed` inside the Studio component). Rails grid and `RotoTimelineCellButton` untouched (diff shows only the action-row extraction). No full-strip memo wall (strip still exported unmemoized at :2023).

### Human Verification Required

1. **Native UAT — scrub through dense reveal rails**
   **Test:** Scrub through dense reveal rails (baked keys ~1 per frame) and watch the workflow strip action-row buttons (Key/Create rail/Push/Insert/Duplicate/Copy/Paste/Cut/Scissor/All/Trash).
   **Expected:** The action-row buttons no longer visibly refresh every frame during the scrub; after releasing on frame N, +Key/Delete/Scissor/Paste immediately reflect frame N's availability (correct enabled/disabled state and tooltip) — no stale state.
   **Why human:** The per-frame re-render and post-release availability correctness are visual/runtime behaviors. Automated evidence proves the mechanism (memo-wrapped action-row, identity-stable props, live signal reads) but cannot observe the rendered scrub — the project's vitest setup has no DOM renderer (documented re-scope in CONTEXT.md; SUMMARY D4, `human_judgment: true`).

### Gaps Summary

No gaps found. All 5 must-have truths verified, all 5 artifacts pass at all three levels (exists, substantive, wired), all 3 key links wired, full suite green (3461 passed), tsc clean. One minor warning: the key-utilities group aria-label lost the frame number — a necessary consequence of the extraction, not a visual/disabled-logic regression. The only outstanding item is the native UAT (visual confirmation of the re-render stop and post-release availability), which requires the user to drive the live app.

---

_Verified: 2026-09-05T14:40:00Z_
_Verifier: Claude (gsd-verifier)_
