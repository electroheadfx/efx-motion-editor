---
phase: quick-261027-klx
plan: W6.1
wave: 6.1
status: complete
commit: b148d5c0
plan_head_before: 4e6ad914e9f6dad17e6e20806b8a9afc2f5343d5
plan_head_after: b148d5c03c6b533a8d8c01e05580d48aaf459345
commits: 1
files_changed: 8
insertions: 671
deletions: 136
date: 2026-10-27
---

# Phase quick-261027-klx — Wave 6.1 Summary (targeted fix pass)

**Status: COMPLETE.** Four findings are closed, each with a regression test that
was proven RED on the pre-fix HEAD and GREEN after: **CR-01** (Copy→Apply
deadlock on the synchronous ledger), **CR-02** (session-global ledger made
Copy/Save capture the wrong strokes), **WR-02** (`isEmpty` always false), and
**WR-06** (`getRotoPort` replaced its seams). WR-01, WR-03, WR-04, WR-05 and
every INFO item were left open by instruction — they are enumerated at the end
of this summary. One atomic commit, `b148d5c0`, staged by exact pathspec only.
No push, no new dependency, no visual redesign, no server started.

## The four fixes

### CR-01 — Roto Copy→Apply deadlock (synchronous completion)

`paintMutationLedger.allocateStrokeMutation` emits its completion synchronously,
inside `enqueueRecordedStroke`, before that call returns. The clipboard
registered `expectedMutationIds` and the accepted target only AFTER the call, so
it ignored the completion of the brush it had just enqueued — including the
first brush of every Apply burst — and `finishApply` never ran.

The fix threads an optional `onAccepted(mutationId)` seam from the clipboard
through `PaintMutationRotoPort.enqueueRecordedStroke` to the ledger. In the
ledger it runs after `accepted.push(...)` and before the listener loop:

```ts
accepted.push(Object.freeze({ mutationId, kind: primary.tool, accepted: Object.freeze(actions), acceptedAt: Date.now() }));
const wasEmpty = acceptedStrokeCount === 0;   // WR-02
acceptedStrokeCount += actions.length;
onAccepted?.(mutationId);                      // CR-01: id registered before completion
const completion: CompletedPaintMutation = { kind: primary.tool, isEmpty: wasEmpty, mutationId };
for (const listener of Array.from(listeners)) listener(completion);
return mutationId;
```

The clipboard's `enqueueNextBrush` defines one idempotent `registerAccepted`
(adds the id to `expectedMutationIds`, sets the accepted target with
`publishPixels: brushIndex + 1 === operation.script.brushes.length`, and calls
`onFirstAcceptedBrush` for index 0), passes it as the second argument to
`enqueueRecordedStroke`, and calls it again defensively after the call returns.
`settleApplyIfDrained` now also requires every expected id to be consumed, so
the burst settles as soon as the last synchronous completion arrives.
`RotoScriptEnginePort.enqueueRecordedStroke` accepts the optional callback.

### CR-02 — frame-scoped capture

Copy/Save now read the **current frame's** watercolor record instead of the
session-wide ledger:

- `sourceHasBrushes` is `hasAquarelleScriptForFrame(sourceState.value.appFrame)`,
  re-evaluated on `aquarelleStrokesRevision` and the source revision tick. Copy is
  enabled only when the current frame actually owns a script.
- A new internal `captureFrameScript(engine, playFrame)` walks
  `frameCaptureEvents(playFrame)` (timeline order, Dry events at their exact
  position, duplicate mutation ids collapse to the LAST occurrence) and builds
  the capture from the **current frame's** strokes only: recorded strokes are
  projected via `recordedStrokeToGroup`, and matching live-ledger groups replace
  the projection by mutation id so continuations survive. Events are cloned with
  `cloneAquarelleEventForScript`.
- `snapshotBoundSource`, `captureScriptForPersistence` and `applyCurrentScript`
  all use that one function and attach `aquarelleEvents` to the snapshot; the
  persistence path therefore stores the restored script, not the ledger.

Navigation to an unpainted frame, a track switch and Trash all change the frame
truth (`restoreAquarelleRecordTimeline` / `purgeAllAquarelleKeyScripts`), so
Copy disables and no stroke crosses frames or tracks.

### WR-02 — `isEmpty` measured before the increment

`wasEmpty` is captured before `acceptedStrokeCount += actions.length`, so the
first accepted mutation of a session reports `isEmpty: true` (previously every
completion reported `false`).

### WR-06 — seam merge in the memoized port

`getRotoPort` now merges instead of replacing:
`existing.seams = { ...existing.seams, ...seams }`. A later call that supplies one
seam no longer blanks every seam registered by an earlier call.

## Regression tests (new / retargeted)

| Finding | File | Test |
|---|---|---|
| CR-01 | `app/src/components/physic-paint/roto/physicsPaintRotoScriptClipboard.ledgerApply.test.ts` (new) | `quick 261027-klx CR-01 Copy -> Apply on the synchronous ledger > consumes every id and settles a multi-brush burst, including the first brush` — REAL `createPaintMutationLedger`, REAL `getRotoPort`, REAL controller; a 1000 ms `Promise.race` guard lets the pre-fix deadlock fail as a timeout instead of hanging the run |
| CR-01 (unit) | `engine/paintMutationLedger.test.ts` | `CR-01: onAccepted runs after acceptance and before the completion listener` |
| CR-01 (unit) | `roto/paintMutationRotoPort.test.ts` | `forwards the onAccepted seam ahead of the completion listener` |
| CR-02 | `roto/physicsPaintRotoScriptClipboard.test.ts`, `describe('261027-klx CR-02 frame-scoped capture')` | `CR-02a: navigating to an unpainted frame disables Copy and captures nothing` |
| CR-02 | same | `CR-02a2: Copy carries only the current frame, never the session ledger` |
| CR-02 | same | `CR-02b: a restored key is copyable and Save captures its restored script` |
| CR-02 | same | `CR-02c: a track switch replaces the frame truth — no cross-track capture` |
| CR-02 | same | `CR-02d: Trash clears the rail script and disables Copy` |
| WR-02 | `engine/paintMutationLedger.test.ts` | `WR-02: isEmpty is measured before the mutation joins the acceptance count` |
| WR-06 | `roto/paintMutationRotoPort.test.ts` | `WR-06: re-registering seams merges them instead of replacing them` |

Harness change behind CR-02: `physicsPaintRotoScriptClipboard.test.ts` gained a
`recordFrameStrokes(frame, strokes)` mirror (called by `harness` for its initial
strokes) plus `afterEach(resetAquarelleRecordState)`, because Copy now reads the
frame record rather than the ledger. `usePhysicsPaintLaunchIntegration.test.ts`
records the same frame strokes before both `copyScript()` calls for the same
reason. The previously vacuous "mixed key" test — it passed only because
`captureScriptForPersistence` returned `null` without a capture seam — was
replaced by `excludes a ledger stroke that has no record on the current frame`,
which assigns a capture canvas and asserts the capture still carries only the
recorded frame stroke.

## RED evidence on the pre-fix HEAD

The three production files were temporarily restored to their `HEAD` (`4e6ad914`)
versions (backups in `/tmp/klx-w6-1-edited/`, fully restored before the commit),
and the targeted suites were run: **23 failures**, exact failure signatures:

```
CR-01 integration      expected false to be true  (Promise.race settled=false at 1015 ms — the deadlock)
CR-02a                 expected true to be false
CR-02a2                expected [ 1, 2 ] to deeply equal [ 1 ]
CR-02b                 expected false to be true
CR-02c                 expected [ 1 ] to deeply equal [ 701 ]
CR-02d                 failed
WR-02                  expected [ false, false ] to deeply equal [ true, false ]
WR-06                  failed
CR-01 ledger pin       failed
CR-01 port pin         failed
```

With the fix restored, the same five files are green: `5 passed (5)`,
`Tests 114 passed (114)` — re-confirmed against the committed tree after
`b148d5c0`.

## Verification gates (post-commit)

### 1. Typecheck

```
$ pnpm --dir app run typecheck
> tsc --noEmit
TYPECHECK_EXIT=0
```

### 2. Full app suite

```
$ pnpm --dir app exec vitest run
FULL_VITEST_EXIT=0
 Test Files  343 passed | 2 skipped (345)
      Tests  6069 passed | 1 skipped | 96 todo (6166)
```

### 3. Watercolor package

```
$ pnpm --dir packages/efx-watercolor run check
CHECK_EXIT=0
$ pnpm --dir packages/efx-watercolor exec vitest run
WC_VITEST_EXIT=0
 Test Files  10 passed (10)
      Tests  136 passed | 4 skipped (140)
```

### 4. App build and Studio chunk

```
$ pnpm --dir app run build
BUILD_EXIT=0
$ ls -l app/dist/PhysicsPaintStudio-*.js
-rw-r--r--@ 1 lmarques  staff  911432 27 oct 21:33 app/dist/PhysicsPaintStudio-CyiGGNIV.js
```

**911,432 bytes <= 951,080** — PASS, 39,648 bytes of headroom. Single matching
chunk; `chunkSizeWarningLimit: 2000` untouched.

### 5. Rust

```
$ cargo test --manifest-path app/src-tauri/Cargo.toml
CARGO_EXIT=0
104 + 0 + 20 + 39 + 4 + 0 + 0 + 0 + 21 + 0 passed; 0 failed   (188 tests, 10 suites)
```

### 6. Static gates and probe

```
G1-prod=0
G2=0
G3=0
G4=0
G5 count=46, 17 files, all allowlisted   (G5_ALLOWLIST_EXIT=0)
PROBE_MISSING=0
PROBE_PATHS=21
```

### 7. Targeted suites

`5 files passed (5)`, `114 tests passed (114)` — including every test named in
the table above.

## Constraints observed

- Atomic commit `b148d5c0` staged with `git add -- <exact paths>` for the eight
  files (four production, four tests plus the new suite). No `git add -A`, no
  `git add .`.
- `.planning/`, `SPECS/`, `app/dist/` and every unrelated dirty file left
  unstaged. The three untracked `.planning` documents (`-REVIEW.md`,
  `-VERIFICATION.md`, `-W6-SUMMARY.md`) remain untracked; this W6.1 summary is
  written and deliberately **not committed**.
- No push. `pnpm` only, `vitest run` only, server never started.
- Preact + `@preact/signals` conventions unchanged: the controller keeps its
  computed/signal structure, setters stay idempotent, no selection work was
  moved into effects, no render-body signal writes were introduced.
- No new dependency, no visual redesign. No do-not-delete surface was touched:
  the 21-path probe is green.

## Findings deliberately left open (not re-scoped)

| ID | Finding | Status |
|---|---|---|
| WR-01 | Completion-listener throws are not isolated; `handleAquarelleStrokeEnd` swallows errors in an empty catch | OPEN |
| WR-03 | Rust `validate_brush_pack` accepts any `kind` value | OPEN |
| WR-04 | Rust `brush_count` counts Dry markers as brushes | OPEN |
| WR-05 | The ledger's input lock has no reader (dead lock) | OPEN |
| IN-01 | Dead APIs identified by the review remain exported | OPEN |
| IN-02 | `guideProxy` is unread. Its claim that `snapshotBoundSource` captures every ledger stroke is now **obsolete** — CR-02 makes capture frame-scoped by construction; the dead field itself remains | OPEN (claim obsolete) |
| IN-03 | `shouldPersistRotoFrame` is duplicated in two places | OPEN |

## Commits

- `b148d5c0` — `fix(261027-klx): frame-scope Roto script capture and settle Apply on the synchronous ledger`
  (8 files, +671 / −136; creates `physicsPaintRotoScriptClipboard.ledgerApply.test.ts`)

Since `plan_head_before` (`4e6ad914`): `git rev-list --count 4e6ad914..HEAD` = `1`.
Post-commit deletion check: no deletions. `app/dist/PhysicsPaintStudio-CyiGGNIV.js`
(911,432 bytes) present after the commit.

## Self-Check: PASSED

- All four fixes committed in `b148d5c0`; targeted suites 114/114 green against
  the committed tree.
- Typecheck, full app suite, watercolor suite, app build, Rust suite, five static
  gates and the 21-path probe all pass.
- The W6.1 summary is written with `status: complete` and is **not** committed,
  per the wave instruction.
