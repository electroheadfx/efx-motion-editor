---
phase: quick-261022-mne
plan: 261022-mne
subsystem: physic-paint / session solo
tags: [solo, session-arm, frame-navigation, preact-signals, source-pins]
status: complete
requires:
  - physicsPaintSoloArm session-only arm signal (261022-iff)
  - mutation-lock effect with push-tool disarm (43.5-05)
provides:
  - Solo arm persists for the whole Studio session across frame navigation, playback, selection changes and mutation locks
  - unmount-only Solo disarm effect (session boundary)
  - source pins for the five edited regions, the two remaining call sites, and the unmount-only shape
affects:
  - PhysicsPaintStudio session Solo behavior
  - timeline navigation / rail selection (no behavior change beyond Solo persistence)
tech-stack:
  added: []
  patterns:
    - session-scoped UI arm with an unmount-only cleanup
    - source-slice pins that forbid disarm calls in navigation-time handlers
key-files:
  created: []
  modified:
    - app/src/components/physic-paint/PhysicsPaintStudio.tsx
    - app/src/components/physic-paint/PhysicsPaintStudio.test.ts
    - app/src/components/physic-paint/view/physicsPaintSoloArm.ts
decisions:
  - Solo is a session-scoped view focus; frame navigation, playback, selection changes of any kind, active-track changes and mutation locks never disarm it
  - Exactly four exits remain — pill re-click, keyboard Escape layer, launch replacement, Studio unmount
  - The unmount disarm lives in its own empty-dep effect so the mutation-lock effect no longer re-fires it
requirements-completed: [MNE-01, MNE-02, MNE-03]
metrics:
  duration: ~6m
  completed: 2026-10-22
  tasks: 1
  commits: 1
actuals:
  tokens: 3129
  tasks: 1
  commits: 1
  plan_head_before: 91883c92
  plan_head_after: 23229e73e3696c631b97f3a3aca0e06f0f832181
---

# Quick 261022-mne: Solo Persists Through Frame Navigation — Summary

The session Solo arm now survives the whole Studio session: frame navigation, playback, every selection change and mutation locks no longer end it; only a pill re-click, the keyboard Escape layer, a launch replacement, or the Studio unmount do.

## What Was Built

### Task 1 — Session Solo persistence (`23229e73`)

- **Mutation-lock effect** (`PhysicsPaintStudio.tsx`): removed both Solo disarms (lock-entry and cleanup). Frame navigation calls `prepareNavigation` → `beginOperation` (mutationLocked true) and `completeNavigation` → `endOperation` (false), so this effect fired on every transport/arrow/cell/ruler move. Push-tool behavior is byte-identical.
- **Unmount-only boundary**: added its own `useEffect(() => () => { disarmSolo(); }, [])` so the arm still never outlives a Studio session without re-firing on lock flips.
- **`clearRotoLoopSelection`**: removed the disarm — it is reached by every timeline frame-cell click (`handleSelectTrackFrame`), key/loop rail clicks and selection resets.
- **`selectAllRotoKeys`**, **`handleSelectRotoLoopClip`** (plain branch), **`collapseRotoSelection`** (set branch), **`handleSelectTrackRail`** (loop branch): removed the disarm calls and the 43.6-06 comments; `disarmSolo` dropped from `handleSelectTrackRail`'s dep array.
- **Kept**: launch-replacement disarm in `setLaunchContext` and the keyboard Escape layer (the keyboard action bundle still passes the function; it is not a call site).
- **Arm module doc** (`physicsPaintSoloArm.ts`): documents the session-persistence law, the four exits, and the navigation lock; behavior and function contracts untouched.
- **Pins** (`PhysicsPaintStudio.test.ts`): five source-slice `not.toContain('disarmSolo()')` assertions (mutation-lock effect, `clearRotoLoopSelection`, Select All + loop/frame-cell/track-rail handlers), the updated collapse test, the exact unmount shape, and a count assertion requiring exactly two Solo disarm calls in the Studio. The count went 8 → 2.

## Deviations from Plan

None — plan executed exactly as written. One test addition beyond the literal behavior list: the launch-replacement slice also asserts the surviving disarm positively, so the two allowed call sites are discriminated rather than merely counted.

## Verification

- Targeted suites: `PhysicsPaintStudio.test.ts`, `physicsPaintStudioKeyboard.test.ts` (Escape-layer order unchanged), `physicsPaintSoloArm.test.ts`, `physicsPaintProgramMonitor.test.ts` — 4 files / 329 tests green.
- RED confirmed before the source edits: the new pins failed (8 disarm calls vs 2; the five regions still contained disarms).
- Source gates: exactly two `disarmSolo()` calls in `PhysicsPaintStudio.tsx` (launch replacement + unmount); the arm module doc names frame navigation.
- Typecheck: 16 errors = 16-error baseline (recorded before editing, `/tmp/mne-typecheck-baseline.txt`).
- Full suite: 5 failures in 4 unrelated files, reproduced against unmodified HEAD sources — pre-existing from the 261022-iff solo semantics change, out of scope (see `deferred-items.md`).

## Known Stubs

None.

## Threat Flags

None. No persisted document state, revision term, cache-key term, compositor or export path changed; the arm remains session-only and monitor-only. The launch replacement still starts a new session disarmed (T-mne-01).

## Live UAT Rows — PENDING

Automated-ready, not done until the user runs these.

| # | Action | Expected | Observed | Status |
|---|--------|----------|----------|--------|
| 1 | Two Paint tracks with content; arm Solo on A; navigate by row cells on A and B, transport previous/next, arrow keys, ruler scrub | Pill stays armed (tinted, aria-pressed true) with no on/off flicker; only the active track's content shows on every frame | — | PENDING |
| 2 | With Solo armed: click a Key Rail, Loop Rail, rail set, spacing proxy, Select All, and the track B header | Arm stays on; focus follows the active track; capsule reads `Solo - {track name}.` | — | PENDING |
| 3 | Escape once with a rail selected; re-arm and click the pill; close and reopen the Studio | One Escape, one layer: Solo disarms first, selection untouched; re-click disarms; reopen starts disarmed | — | PENDING |
| 4 | While armed, hide the focused track, then show it; hide a non-focused track | Focused content disappears and returns; a hidden non-focused track never appears | — | PENDING |

## Self-Check

- Changed artifacts exist on disk: `PhysicsPaintStudio.tsx`, `PhysicsPaintStudio.test.ts`, `physicsPaintSoloArm.ts`.
- Commit `23229e73` is an ancestor of HEAD; working tree clean apart from the uncommitted `.planning/quick/261022-mne-*` docs.
- Automated gates passed; live UAT rows pending.

## Self-Check: PASSED
