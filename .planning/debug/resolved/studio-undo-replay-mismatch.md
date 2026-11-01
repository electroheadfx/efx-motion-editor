---
status: resolved
trigger: "I selected 2 strokes then deleted them, I wanted undo, not worked. Error: [PhysicsPaintStudio] physical edit: Roto physical edit failed (parent-rejection): Could not apply physics paint output. Keep the standalone open and try again from the current layer/frame. Roto physical replay target snapshot does not match the original accepted command. [cursor 0 != 2 | selectedKeyId a06d61af-7573-43e1-a297-d9df1e38100f != f726efd4-fecc-461b-8a00-aabebd67b5e4 | selectedAppFrame 0 != 2]"
created: 2026-11-01T00:00:00Z
updated: 2026-11-01T14:22:07Z
---

## Symptoms

expected: Undo (Cmd+Z) after deleting 2 selected strokes restores them in the Physics Paint Studio, and the parent (Roto) accepts the resulting physical edit output.

actual: Undo does nothing — the 2 strokes are not restored. A parent-rejection error is logged: "Roto physical edit failed (parent-rejection): Could not apply physics paint output. Keep the standalone open and try again from the current layer/frame. Roto physical replay target snapshot does not match the original accepted command."

errors: |
  [Error] [PhysicsPaintStudio] physical edit: – "Roto physical edit failed (parent-rejection): Could not apply physics paint output. Keep the standalone open and try again from the current layer/frame. Roto physical replay target snapshot does not match the original accepted command. [cursor 0 != 2 | selectedKeyId a06d61af-7573-43e1-a297-d9df1e38100f != f726efd4-fecc-461b-8a00-aabebd67b5e4 | selectedAppFrame 0 != 2]"
  Stack: logDiagnostic (PhysicsPaintStudio.tsx:1958) <- useRotoPhysicalEditCoordinator.ts:859/886 <- consumeBridgeApplyResult (PhysicsPaintStudio.tsx:4257/858) <- usePhysicsPaintApplyResultController.ts:83 <- usePhysicsPaintParentBridge.ts:306 <- user-script <- physics-paint:1

timeline: Unknown whether this is a regression or has always failed in this flow (user answered "not sure").

reproduction: In the Physics Paint Studio, select 2 strokes, delete them (Cmd+Z undo triggered immediately after, inside the Studio window). Undo produces no visible restoration of the strokes, and the parent-rejection error above is logged.

## Current Focus

status: resolved — live UAT passed 2026-11-01

guardrail_verdict: accepted
verification_summary: |
  target_test: pass — new coordinator test (payload carries the child capture) and
  new bridge test (undo accepted across a divergent parent mirror) both green.
  mutation_check: skipped — no Stryker config in the repo (no stryker reference in
  app/package.json or root package.json). Compensated by reversible fix-site
  reverts (signal 5): reverting the bridge hunk reproduces the EXACT live error
  ("cursor 0 != 2 | selectedKeyId key-A != key-B | selectedAppFrame 0 != 2");
  reverting the coordinator hunk drops the payload pair ("expected undefined to be 'A'").
  no_op_deletion: pass — additive diff only (new optional fields + authority branch).
  adjacent_tests: pass — 4 primary suites 387 passed / 1 skipped; 7 related
  suites (transport, Studio, resolver, loop clips, launch parity, webp, timeline
  actions) 811 passed; tsc --noEmit clean.
  revert_and_reconfirm: pass — bug returned on revert, cleared on reapply (both halves).
next_action: Request human live UAT in the Physics Paint Studio (see Resolution.verification).

previous: root cause confirmed — entering fix_and_verify

reasoning_checkpoint:
  hypothesis: "The parent ledger's `before` selection/cursor for ordinary physical edits (delete-rails and all non-lifecycle kinds) is captured from the parent's passive mirror document, while the child's undo replay target (`entry.before`) is captured from the child's own last-accepted/current-document authority. The two authorities are refreshed by different events (mirror: accepted edits + paint-driven document syncs + launch; child ref: accepted edits only, else the live child document at first capture), so a child-local navigation or a paint-driven sync leaves them diverged. The undo then proposes a target snapshot whose selection/cursor do not equal the ledger's recorded before, and the parent rejects the replay."
  confirming_evidence:
    - "physicPaintBridge.ts:2041-2053 builds the ledger `before` selection/cursor from the PARENT's `currentDocument` for every non-lifecycle kind (delete-rails explicitly excluded from payload authority)."
    - "useRotoPhysicalEditCoordinator.ts:1176-1249,2354 captures the child's before snapshot from `lastAcceptedSelectionRef` (initialized from the child document at :1190-1197, updated only on accepted edits at :1259-1262)."
    - "useRotoPhysicalEditHistory.ts:1193-1208 submits `replayTargetSnapshot: entry.before`; the parent's target check (physicPaintBridge.ts:1978-1998) therefore compares the child capture against the parent mirror."
    - "The live rejection names exactly the three selection/cursor fields (cursor 0 != 2, selectedKeyId a06d61af != f726efd4, selectedAppFrame 0 != 2) and no records/revision/interpolation/loops/breaks diff — records and revision matched; only the selection authority diverged."
    - "Selection-only writes never bump `efxPaintVersion` (efxPaintStore.ts:83-86 is the sole bump; physicPaintStore.ts:4555-4565 writes selection without a bump), so the two realms' selections can drift silently."
  falsification_test: "If, after carrying the child's captured pre-edit selection into the forward payload and recording it as the ledger `before`, the parent still rejects an Undo with the same cursor/selectedKeyId/selectedAppFrame diff — or the new regression tests fail — the hypothesis is wrong."
  fix_rationale: "Removes the second authority instead of reconciling values. The child is the editor; its captured pre-edit pair is what its history entry will replay. Sending that pair in the forward payload and using it for the ledger `before` makes the undo target check validate records/revision strictly against one shared selection authority, so a mirror lag can no longer reject a faithful undo. Lifecycle/move-group payload authority (43.6 G-43.6-2 comment) and the Key Rail cleared-selection protection (43.4 defects 2/4) are unchanged because the child's captured value already encodes both."
  blind_spots: "The exact live sequence (navigation vs paint-driven sync) and the exact operation kind (delete-rails vs delete-key-group vs another ordinary kind) are not confirmed; both share the same parent branch, so the fix covers both. The restored selection equals the child's captured pair, which may lag the live document if the last accepted edit predates a local navigation — records restore correctly, selection fidelity is unchanged from the existing capture contract."
  candidate_causes:
    - "code: split authority — parent mirror document vs child capture for the ledger before selection (confirmed root cause)"
    - "environment: two-realm, event-driven document sync — the parent mirror only refreshes on accepted edits / paint-driven syncs / launch, never on child navigation (contributing condition that makes the split observable)"
    - "data: the child's `lastAcceptedSelectionRef` lags the child document after navigation or paint activity (contributing condition)"
  and_gate: "no — a single root cause (split authority) is sufficient: any divergence between the two authorities rejects the next undo. The environment/data items are how divergence arises, not additional independent causes."

fix_applied: |
  Forward edits now carry `beforeSelectedKeyId` + `beforeCursorAppFrame`
  (the child's captured pre-edit pair) in the physical-edit payload. The parent
  ledger's `before` snapshot uses that pair for delete-rails and every
  non-lifecycle operation kind, with the passive mirror kept only as a
  legacy-payload fallback. Lifecycle/move-group payload authority and all
  replay kinds are unchanged.

## Evidence

- timestamp: 2026-11-01T03:00:00Z
  checked: physicPaintBridge.ts:1974-2001 (replay target check) and :388-489 (comparator + diff)
  found: The rejection is the replay TARGET check. `expectedTargetSnapshot` = `original.before` for undo; `proposedTargetSnapshot` is built from the payload (records + payload.selectedKeyId + payload.cursorAppFrame + stagedRevision). `replayDiffSuffix(proposed, expected)` yields "proposed != expected", so the live error reads: child proposed a06d61af@0, parent ledger before f726efd4@2.
  implication: The undo proposal itself is well-formed; the ledger's recorded `before` selection/cursor disagrees with the child's captured before snapshot.

- timestamp: 2026-11-01T03:00:00Z
  checked: physicPaintBridge.ts:2029-2077 (ledger write on forward accept)
  found: `beforeSelectionFromPayload = childBeforeAuthority && payload.operationKind !== 'delete-rails'`. For ordinary ops (`delete-key`, `delete-key-group`, `delete-key-rail`, scissor, etc.) and for `delete-rails`, the ledger `before` selection/cursor come from the PARENT's live `currentDocument` (:2048-2053). Only `move-group` and the other GROUP_LIFECYCLE kinds (minus delete-rails) take the payload's post-op selection.
  implication: For the failing op the parent authority is its mirrored document, not anything the child captured.

- timestamp: 2026-11-01T03:00:00Z
  checked: physicPaintBridge.ts:1791-1808 (replay SOURCE check)
  found: The source check compares the parent's live snapshot (its currentDocument selection/cursor) with `replayEntry.after` using `ignoreBytes=true` — selection/cursor ARE compared here. The live error surfaced only the target check, so the parent document selection equaled the accepted delete's `after` selection at undo time.
  implication: Parent doc selection follows the accepted document after each physical edit; the divergence is specifically in the pre-op (`before`) authority.

- timestamp: 2026-11-01T03:00:00Z
  checked: useRotoPhysicalEditCoordinator.ts:1111-1117, 1176-1249, 1251-1271, 2354-2359
  found: `captureSnapshot` builds the child's before/after snapshots with `selectedKeyId` from `lastAcceptedSelectionRef`; the ref is initialized lazily on first capture from the child document (`document?.selectedKeyId ?? launchRoto?.selectedKeyId`, :1190-1197) and updated ONLY in `publishCompleteDocument` on an accepted edit (:1259-1262). `const before = captureSnapshot(...)` is the dispatch-time before authority (:2354).
  implication: The child before authority is "last accepted physical edit's selection, else current child document/launch". Child navigation or paint activity does not update it.

- timestamp: 2026-11-01T03:00:00Z
  checked: useRotoPhysicalEditHistory.ts:1178-1208 (undo dispatch)
  found: Undo submits `replayTargetSnapshot: entry.before`, `selectedKeyId: entry.before.selectedKeyId`, `selectedAppFrame: entry.before.selectedAppFrame`, provenance sourceRevision = entry.acceptedRevision, targetRevision = snapshotRevision(entry.before). Redo is symmetric (:1348-1376).
  implication: The undo's proposed target is exactly the child's captured `entry.before`; the only way the parent can accept it is if the ledger `before` selection equals that captured value.

- timestamp: 2026-11-01T03:00:00Z
  checked: efxPaintStore.ts:57-95; physicPaintStore.ts:4282-4394, 4545, 4555-4565
  found: `efxPaintVersion` is bumped only by `_notifyChange()` on document mutations. Selection-only writes go through `physicPaintStore.setRotoPhysicalSelection`, which writes the selection/cursor maps and mirrors a healed document without bumping any version. The parent's `currentDocument` selection is refreshed by (a) accepted physical edits, (b) document-sync mirrors of child documents (paint changes), (c) launch, and (d) the parent-side heal at :4545.
  implication: The parent's mirrored selection and the child's `lastAcceptedSelectionRef` are refreshed by different event sets; no invariant keeps them equal. The two-authority split is structural, not a one-off value bug.

- timestamp: 2026-11-01T03:00:00Z
  checked: useRotoTimelineActions.ts:712-810, 1987-2074 (delete classification)
  found: With an active rail set, Delete classifies as `rail-set` → operationKind `delete-rails`; with >=2 selected key ids it classifies as `ordinary-key-group` → operationKind `delete-key-group`. Both take the parent-document authority branch for the ledger `before`.
  implication: The user's "selected 2 strokes then deleted" flow (either kind) is exposed to the split authority.

- timestamp: 2026-11-01T03:00:00Z
  checked: physicPaintBridge.test.ts:4901-5069 (G-43.6-2) and useRotoPhysicalEditCoordinator.test.ts:2448-2549 (43.4 defects 2/4)
  found: G-43.6-2 pins that delete-rails undo restores the TRUE pre-delete selection (seeded doc 'ordinary'@20) rather than the post-delete proposal selection ('source-B'@2). 43.4 pins that a Key Rail gesture's local document-selection clear must not become the before authority — the last accepted selection ('B') must. Both tests run with the parent document and the child ref agreeing.
  implication: Any fix must keep the pre-op (not post-op) selection as the ledger `before`, and keep the Key Rail cleared-selection protection.

- timestamp: 2026-11-01T14:22:07Z
  checked: fix-site reverts (bridge hunk, coordinator hunk) against the new regression tests
  found: Reverting ONLY the bridge ledger hunk makes the new bridge test fail with the verbatim live rejection: 'Roto physical replay target snapshot does not match the original accepted command. [cursor 0 != 2 | selectedKeyId key-A != key-B | selectedAppFrame 0 != 2]'. Reverting ONLY the coordinator payload hunk makes the new coordinator test fail with 'expected undefined to be 'A'' (payload pair absent).
  implication: Both halves of the fix are load-bearing; the regression tests reproduce the exact reported failure class and die when the fix is removed.

- timestamp: 2026-11-01T14:22:07Z
  checked: verification runs — vitest run (4 primary suites + 7 adjacent suites) and tsc --noEmit
  found: Primary suites 387 passed / 1 skipped (physicPaint.test 61, coordinator 91, bridge 158/1 skipped, history 78). Adjacent suites 811 passed (bridge transport 45, PhysicsPaintStudio 307, launch parity 1, loop clips 113, resolver 204, webp 4, timeline actions 137). Typecheck clean.
  implication: The fix keeps 43.4 defects 2/4, G-43.6-2, transport validation, and every adjacent contract green; no regressions detected in the covered graph.

- timestamp: 2026-11-01T15:10:00Z
  checked: live UAT round 2 (user rebuilt + restarted) — still rejected with a fresh signature (cursor 1 != 3 | f726efd4 != 1a7d5c46 | selectedAppFrame 1 != 3)
  found: Static analysis showed a new-code parent cannot emit this error: with the pair present it must use it, and without it the pair-validated payload fails closed to 'Invalid closed physical Roto apply payload'. A temporary '[physic-paint-ledger]' diagnostic was added at the ledger write to expose hasPair/pair/mirror/recordedBefore.
  implication: The remaining variable was whether both webviews ran the fixed bundle — the Studio is a separate native webview (WebviewWindowBuilder → /physics-paint) that only picks up new source on a fresh window load.

- timestamp: 2026-11-01T16:10:00Z
  checked: live UAT after a clean process cycle (quit app, kill tauri/vite, restart, fresh Studio) — four scenarios: 3 red of 6 strokes, 3 strokes moved repeatedly then deleted, scripted rails with loop clips, and the original multi-stroke project
  found: All four passed. Delete → Cmd+Z restored the strokes with their paint, no parent-rejection, no replay-target mismatch. The diagnostic was removed after the runs.
  implication: The root cause and fix are confirmed on the exact reported flow; the pre-restart failures were the unfixed Studio webview still holding the previous bundle.

## Eliminated

- hypothesis: The undo replay derives its target cursor/selection from post-delete live state.
  evidence: The target is `entry.before`, captured at dispatch before the edit; `replayTargetSnapshot: entry.before` (useRotoPhysicalEditHistory.ts:1193-1208).
  timestamp: 2026-11-01T03:00:00Z

## Resolution

root_cause: "Split authority for the accepted-command `before` selection. The parent bridge records the ledger `before` selection/cursor from its passively mirrored document (physicPaintBridge.ts:2041-2053) for delete-rails and every non-lifecycle physical edit, while the child captures its history/replay `entry.before` selection/cursor from `lastAcceptedSelectionRef` (useRotoPhysicalEditCoordinator.ts:1176-1249, :2354). The mirror only refreshes on accepted edits, paint-driven document syncs and launch; the child ref refreshes on accepted edits (else the live child document at first capture). A child-local navigation or paint-driven sync therefore leaves them diverged, so the Undo replay target fails the parent's strict selection/cursor equality check (physicPaintBridge.ts:1978-1998) and the undo silently no-ops with 'Roto physical replay target snapshot does not match the original accepted command [cursor ... | selectedKeyId ... | selectedAppFrame ...]'."
fix: "The child's captured pre-edit selection/cursor now rides the forward physical-edit payload as `beforeSelectedKeyId` + `beforeCursorAppFrame` (pair-validated; never on replays). The parent ledger's `before` snapshot uses that captured pair for delete-rails and every non-lifecycle kind, with the passive mirror retained only as a fallback for legacy payloads; move-group / GROUP_LIFECYCLE payload authority is unchanged. This removes the second authority instead of reconciling values, so the Undo replay target and the ledger before validate records/revision against one shared selection authority."
verification:
  target_test: { result: pass, tests: ["useRotoPhysicalEditCoordinator.test.ts — studio-undo-replay-mismatch captured pre-edit selection authority", "physicPaintBridge.test.ts — divergent parent mirror"] }
  mutation_check: { result: skipped, reason_if_skipped: "no Stryker config in repo", mutant_killed: null }
  no_op_deletion: { result: pass, deletion_justified_by_rca: true }
  adjacent_tests: { result: pass, suites_run: ["src/types/physicPaint.test.ts (61)", "src/components/physic-paint/hooks/useRotoPhysicalEditCoordinator.test.ts (91)", "src/lib/physicPaintBridge.test.ts (158, 1 skipped)", "src/components/physic-paint/hooks/useRotoPhysicalEditHistory.test.ts (78)", "physicsPaintBridgeTransport.test.ts (45)", "PhysicsPaintStudio.test.ts (307)", "physicsPaintLaunchRevisionParity.test.ts (1)", "physicsPaintRotoLoopClips.test.ts (113)", "physicsPaintRotoPhysicalResolver.test.ts (204)", "webpBytes.test.ts (4)", "useRotoTimelineActions.test.ts (137)"], tsc: "clean" }
  revert_and_reconfirm: { result: pass, bug_returned_on_revert: true, fixed_on_reapply: true, evidence: "bridge hunk revert reproduced the verbatim live replay-target error; coordinator hunk revert dropped the payload pair" }
  guardrail_verdict: accepted
  live_uat: { result: pass, date: 2026-11-01, scenarios: ["3 of 6 strokes deleted then undone — restored with paint", "3 strokes moved repeatedly, deleted, undone", "scripted rails with loop clips — delete + undo", "original multi-stroke project — delete + undo"], errors: none }
files_changed:
  - app/src/types/physicPaint.ts
  - app/src/components/physic-paint/hooks/useRotoPhysicalEditCoordinator.ts
  - app/src/lib/physicPaintBridge.ts
  - app/src/types/physicPaint.test.ts
  - app/src/components/physic-paint/hooks/useRotoPhysicalEditCoordinator.test.ts
  - app/src/lib/physicPaintBridge.test.ts
