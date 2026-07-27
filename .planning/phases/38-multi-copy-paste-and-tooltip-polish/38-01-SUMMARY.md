---
phase: 38-multi-copy-paste-and-tooltip-polish
plan: 01
subsystem: ui
tags: [preact, signals, roto, clipboard, physics-paint, typescript]

requires:
  - phase: 37-multi-select-physical-roto-keys
    provides: multi-selection state (selectedKeyIds signal), canonical physical real-key records (physicPaintStore.getRotoRealKeyRecords), session/controller key-utility architecture
provides:
  - Widened Roto clipboard slot as single|group discriminated union (RotoSessionCopiedKeyValue) with isRotoSessionCopiedKeyGroup guard
  - RotoSessionCopiedGroupEntry shape {payload, sourceAppFrame, sourceKeyId} — the structural-type seam consumed by 38-02's paste-key-group factory
  - Session copyKeyGroup method with frozen group entries and UI-SPEC locked feedback "Copied {N} keys"
  - Hook-level selection-size Copy branch (1 = byte-identical single copy, 2+ = group freeze from fresh store records)
  - Fail-closed group-shape narrowing guard in pasteKey (interface-first seam for 38-04)
  - Phase COVERAGE.md no-external-API declaration
affects: [38-02 paste-key-group resolver seam, 38-04 group paste route, 38-06 native UAT]

tech-stack:
  added: []
  patterns:
    - "ONE shared clipboard slot as a discriminated union: single shape keeps NO discriminant so the 1-key path stays byte-identical; group shape carries kind:'group'"
    - "Frozen clipboard snapshots: Object.freeze on entry, entries array, and group wrapper; store payload references are point-in-time snapshots because store mutations replace records immutably"
    - "Fresh store read at action time via input ports (getRotoKeyRecords) — never the memoized view model or frame-indexed session cache (Pitfall 6)"
    - "Fail-closed seam guards for interface-first plan splits: group paste branch narrows and aborts with a concise capsule message until 38-04 installs the real route"

key-files:
  created:
    - .planning/phases/38-multi-copy-paste-and-tooltip-polish/COVERAGE.md
  modified:
    - app/src/components/physic-paint/roto/physicsPaintRotoSession.ts
    - app/src/components/physic-paint/hooks/useRotoKeyUtilities.ts
    - app/src/components/physic-paint/PhysicsPaintStudio.tsx

key-decisions:
  - "D-02 honored: exactly one clipboard slot (copiedKey signal + copiedKeyRef mirror), widened to a union rather than pluralized; single/group overwrite each other and share one resetSession disposal path"
  - "D-01 honored: RotoSessionCopiedKey unchanged (no discriminant on the single shape); the three single-key byte-identity tokens verified exactly once each"
  - "Tracer human-verify gate resolved as automated: the plan frontmatter is autonomous:true with no checkpoint tasks, the tracer <verify> is fully automated (typecheck + greps, all green), and live end-to-end UAT is explicitly owned by plan 38-06 per the plan's verification section"

patterns-established:
  - "Group clipboard entry carries payload + sourceAppFrame + sourceKeyId provenance only; relative offsets derive from sourceAppFrames at paste time (no offset table in the clipboard)"
  - "Stale-selection fail-closed abort: any selected keyId without a store record shows 'The selected Roto keys are no longer available.' and leaves the clipboard untouched"

requirements-completed: [38-GROUP-COPY]

coverage:
  - id: D1
    description: "Group Copy: 2+ selected real Roto keys freeze store-sourced {payload, sourceAppFrame, sourceKeyId} entries (sorted by sourceAppFrame) into the one shared slot with 'Copied {N} keys' feedback; stale selections abort without touching the clipboard"
    requirement: 38-GROUP-COPY
    verification:
      - kind: other
        ref: "pnpm --dir app typecheck (green) + grep gates: copyKeyGroup >= 3 in session, 'Copied ${entries.length} keys' == 1"
        status: pass
    human_judgment: true
    rationale: "Live end-to-end behavior (select 2 keys -> Copy -> 'Copied 2 keys' capsule) is user-owned native UAT in plan 38-06 per the plan's verification section; D-15 forbids test creation/execution in this plan"
  - id: D2
    description: "Single-key Copy and single-key Paste remain byte-identical (guard, 'Copied key {appFrame}.' feedback, slot shape, toClipboardPayload path)"
    requirement: 38-GROUP-COPY
    verification:
      - kind: other
        ref: "grep byte-identity gates: 'Copied key ${appFrame}.' == 1, 'copiedKey.value = { frame: appFrame, cachedFrame: normalized };' == 1, 'const clipboardPayload = toClipboardPayload(copiedKey);' == 1"
        status: pass
    human_judgment: true
    rationale: "Compile-time and token-identity gates pass; live confirmation deferred to user-owned native UAT in plan 38-06"
  - id: D3
    description: "Paste availability stays shape-agnostic (hasCopiedRotoKey = slot non-null) and group clipboards hit a fail-closed narrowing guard awaiting 38-04's real group paste route"
    requirement: 38-GROUP-COPY
    verification:
      - kind: other
        ref: "pnpm --dir app typecheck (green); isRotoSessionCopiedKeyGroup in hook >= 2"
        status: pass
    human_judgment: false

duration: 15min
completed: 2026-07-27
status: complete
---

# Phase 38 Plan 01: Group Copy — Widened Clipboard Slot Summary

**Roto clipboard slot widened to a frozen single|group discriminated union with group Copy (2+ selected keys snapshot store-fresh `{payload, sourceAppFrame, sourceKeyId}` entries with `Copied {N} keys` feedback) while 1-key Copy and single-key Paste stay byte-identical**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-07-27T15:00:00Z
- **Completed:** 2026-07-27T15:15:00Z
- **Tasks:** 2
- **Files modified:** 4 (3 production + 1 phase artifact)

## Accomplishments

- Clipboard slot widened to `RotoSessionCopiedKeyValue = RotoSessionCopiedKey | RotoSessionCopiedKeyGroup` with exported `RotoSessionCopiedGroupEntry`, `RotoSessionCopiedKeyGroup`, and `isRotoSessionCopiedKeyGroup` guard; the single shape keeps no discriminant so the 1-key path is byte-identical (D-01/D-02/D-03)
- New `copyKeyGroup(entries)` session method: fail-closed under 2 entries (`Select at least two real Roto keys to copy.`), freezes `{kind:'group', entries}` into the one slot, feedback verbatim `Copied {N} keys` (no trailing period); `hasCopiedRotoKey` availability unchanged (shape-agnostic)
- Hook `copyKey` branches on selection size: 2+ resolves each selected keyId against a FRESH `physicPaintStore.getRotoRealKeyRecords(layerId)` read (Pitfall 6 — never the session cache or memoized view model), aborts with `The selected Roto keys are no longer available.` on any stale keyId without touching the clipboard, otherwise freezes entries sorted ascending by sourceAppFrame
- `pasteKey` narrows group clipboards to a fail-closed guard (`The copied Roto key group cannot paste through the single-key route.`) — the interface-first seam whose body plan 38-04 replaces
- Studio wires the two new required ports (`getSelectedKeyIds` from the selectedKeyIds signal; `getRotoKeyRecords` as a fresh store getter) inside the keyUtilities input block
- Phase `COVERAGE.md` no-external-API declaration written (38-PLAN-OUTLINE API coverage checkpoint satisfied)

## Task Commits

Each task was committed atomically:

1. **Task 1 (tracer): End-to-end group Copy — 2+ selected keys freeze into the one shared slot** - `c434ed12` (feat)
2. **Task 2: Phase COVERAGE.md no-external-API declaration + final gates** - `f462a71a` (docs)

**Plan metadata:** recorded below (docs: complete plan)

## Files Created/Modified

- `app/src/components/physic-paint/roto/physicsPaintRotoSession.ts` — union types + guard, widened copiedKey signal/input, `copyKeyGroup` method, group branch in `normalizeCopiedKey`, `'copyKeyGroup'` action name
- `app/src/components/physic-paint/hooks/useRotoKeyUtilities.ts` — two new input ports, widened copiedKeyRef, selection-size Copy branch, group narrowing guard in `pasteKey`
- `app/src/components/physic-paint/PhysicsPaintStudio.tsx` — `getSelectedKeyIds` / `getRotoKeyRecords` port wiring in the keyUtilities input block
- `.planning/phases/38-multi-copy-paste-and-tooltip-polish/COVERAGE.md` — no-external-API declaration

## Decisions Made

- Tracer feedback gate resolved as automated: plan frontmatter `autonomous: true`, no checkpoint tasks in the plan, and the plan's verification section assigns live UAT to plan 38-06 — the tracer's fully automated `<verify>` (typecheck + greps) was run and is green, so execution proceeded without a human-verify stop.
- No `currentIsRealKey` consultation in the group branch per plan: a 2+ selection only contains real keys per the Phase 37 selection model; the store-record lookup is the authoritative check.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Plan verification inconsistency] Studio port grep expectations adjusted to scoped count**
- **Found during:** Task 1 verification
- **Issue:** The plan's `<verify>` expects `grep -c "getSelectedKeyIds: () => selectedKeyIds.value" PhysicsPaintStudio.tsx == 1` and `grep -c "getRotoKeyRecords:" PhysicsPaintStudio.tsx == 1`, but both tokens already exist in the same file inside the `useRotoTimelineActions` input block (the plan's action text itself notes "the identical getter already exists at line 473 for another port — mirror it"). After the mandated addition, the whole-file counts are necessarily 2.
- **Fix:** Kept the implementation exactly per the action text; ran the greps scoped to the `keyUtilities: { ... }` block (each == 1) to prove the new ports are wired, and recorded the whole-file counts (2 each) for transparency.
- **Files modified:** none (verification methodology only)
- **Verification:** `awk '/keyUtilities: \{/,/^    \},$/'` scoped greps each return 1; typecheck green
- **Committed in:** `c434ed12` (part of Task 1 commit)

---

**Total deviations:** 1 (verification-gate expectation correction; no production behavior change)
**Impact on plan:** None on scope or behavior — the verify intent ("each new Studio port wired exactly once in the keyUtilities block") is satisfied and proven.

## Issues Encountered

None. Typecheck passed on the first run; all other grep gates matched the plan's expected counts (copyKeyGroup 6 ≥ 3, group feedback 1, guard in hook 2, three single-key byte-identity tokens 1 each).

## User Setup Required

None - no external service configuration required.

## Threat Flags

None — all mitigations in the plan's threat register were implemented as specified (frozen entries T-38-01a; fail-closed stale-selection and entries<2 guards T-38-01b; concise fixed strings T-38-02; Preact text-only rendering path T-38-04; no installs T-38-SC). No new security-relevant surface beyond the plan's threat model.

## Next Phase Readiness

- Wave-1 contract artifacts are in place for parallel consumers: 38-02 can build the `paste-key-group` factory against the structural `RotoSessionCopiedGroupEntry` seam (this plan imports nothing from `app/src/types/physicPaint.ts` for the clipboard shape), and 38-04 replaces the fail-closed `pasteKey` group-branch guard with the real group paste route.
- Live end-to-end confirmation (select 2 keys -> Copy -> `Copied 2 keys` capsule; single-key copy/paste unchanged) is owned by the user-run native UAT checkpoint in plan 38-06; per CLAUDE.md the agent did not launch the server/app.
- Zero vitest invocations and zero test files touched (D-15); typecheck green.

## Self-Check: PASSED

- FOUND: `app/src/components/physic-paint/roto/physicsPaintRotoSession.ts` (copyKeyGroup, union types, guard)
- FOUND: `app/src/components/physic-paint/hooks/useRotoKeyUtilities.ts` (ports, group branch, narrowing guard)
- FOUND: `app/src/components/physic-paint/PhysicsPaintStudio.tsx` (keyUtilities port wiring)
- FOUND: `.planning/phases/38-multi-copy-paste-and-tooltip-polish/COVERAGE.md`
- FOUND: commit `c434ed12` (Task 1) and `f462a71a` (Task 2) in git log

---
*Phase: 38-multi-copy-paste-and-tooltip-polish*
*Completed: 2026-07-27*
