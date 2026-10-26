---
status: resolved
trigger: "I have a very old bug, it happen again I forgot to mention because it happen when studio stay open more than 10 minutes without working on it, the log are: 'Roto physical launch hydration failed: Launch cursor does not match the canonical physical document.' Its black canvas window with disconnected engine. Please look in history it was already reported."
created: 2026-10-26T12:17Z
updated: 2026-10-26T14:28Z
---

## Current Focus
<!-- OVERWRITE on each update - reflects NOW -->

hypothesis: "CONFIRMED. The native occlusion monitor reloads the hidden Studio every 3 minutes, so the child re-fetches the SAME stored launch envelope (same operationId, `startFrame` frozen at the original open frame) while `applySettledLaunchContext` substitutes the crash-recovery sessionStorage checkpoint document, whose active-track `cursorAppFrame` is the LIVE cursor at the last document push. Substituting only the document left the envelope stale; `prepareRotoPhysicalLaunch` refused the incoherent pair and hydration aborted before any launch context was committed — black canvas, 'Engine not ready'. The codebase's own law is that the document cursor is the authority and `startFrame` is derived from it (launch parser `physicsPaintLaunchContext.ts:84`, launch builder `physicPaintBridge.ts:3972`); the substitution alone broke that derivation."
test: "Drive the real substitution path in the hook's own suite with launch frame A and checkpoint cursor B (A !== B): the pre-fix pair is refused with the exact message; the production resolver aligns `startFrame` to B and the same checkpoint hydrates. Plus: no checkpoint is a no-op, and a checkpoint without active-track physical state still refuses loudly (never a silent bypass)."
expecting: "RED at base for the alignment cells; GREEN after `resolveLaunchHydrationContext`; no behavior change for a normal same-frame launch."
next_action: "None — native UAT approved 2026-10-26: after hours away from the app with the computer asleep, the user returned with no black screen ('All UAT Approved')."
tdd_checkpoint: "RED confirmed 2026-10-26T13:20Z (4 failed / 7 passed on the new cells, all from the missing alignment helper); GREEN 2026-10-26T13:20Z (11/11)."

## Eliminated
<!-- APPEND only - prevents re-investigating -->

- "The Studio engine itself disconnects during idle" — refuted: the 'Engine not ready' state is downstream of the launch-hydration abort; the engine never receives a launch context (`usePhysicsPaintLaunchIntegration.ts:141-150`).
- "A normal launch can produce this refusal" — refuted: the launch builder and the URL parser both derive `startFrame` from the carried active-track cursor, so only a post-launch document substitution can desynchronize them.

## Symptoms
<!-- Written during gathering, then IMMUTABLE -->

expected: A Studio left open and idle returns fully working (engine ready, canvas rendered, all session content editable).
actual: On return the Studio is a black canvas with "Engine not ready" and a disconnected engine; recovery requires restarting the whole app.
errors: "[PhysicsPaintStudio] Roto physical launch hydration failed: Launch cursor does not match the canonical physical document." (usePhysicsPaintLaunchIntegration.ts:145 -> rotoLaunchHydration.ts:59)
reproduction: Leave the Studio window open and idle while occluded by another app or with the display asleep (user-confirmed occlusion). The onset is not precisely timed ("varies"); the failure recurs on later idle periods.
started: "Very old bug" per the user; it has recurred multiple times. Prior occurrences were never root-caused.

## Evidence
<!-- APPEND only - facts discovered -->

- timestamp: 2026-10-26T12:17Z
  checked: The refusal site and its caller
  found: `prepareRotoPhysicalLaunch` refuses when `context.startFrame !== document.cursorAppFrame` (rotoLaunchHydration.ts:58-59). The caller logs and aborts before `applyPhysicsPaintLaunchContext` (usePhysicsPaintLaunchIntegration.ts:140-150), so the launch context is never committed and the engine never initializes.
  implication: The black/not-ready window is downstream of the refusal, not an engine bug.

- timestamp: 2026-10-26T12:17Z
  checked: Can a fresh launch mismatch?
  found: `createPhysicPaintLaunchContext` builds the carried document's active-track physical state with `cursorAppFrame: requestedFrame` and then sets `startFrame: physical.cursorAppFrame`, i.e. the same value (physicPaintBridge.ts:3905-3972). The child's canonical parser also rejects a launch whose `startFrame` differs from the carried active-track cursor (physicsPaintLaunchContext.ts:78-79).
  implication: A normal launch cannot produce this refusal. The mismatch must be introduced after the launch is carried.

- timestamp: 2026-10-26T12:17Z
  checked: The only post-launch document substitution
  found: `applySettledLaunchContext` replaces the launch's carried document with the sessionStorage crash-recovery checkpoint when its operationId matches: `const hydrationContext = sessionDocument ? { ...context, document: sessionDocument } : context` (usePhysicsPaintLaunchIntegration.ts:138-140). The checkpoint is written on every document push with the LIVE runtime document (PhysicsPaintStudio.tsx:6840-6841; write/read in physicsPaintBridgeTransport.ts:146-168).
  implication: The checkpoint's active-track `cursorAppFrame` is the live cursor at the last push, while `context.startFrame` stays frozen at the original open frame. If the user navigated/painted on a different frame, the door refuses on the next reload.

- timestamp: 2026-10-26T12:17Z
  checked: The idle trigger
  found: The native occlusion monitor reloads the hidden paint window every 3 minutes of continuous occlusion (`OCCLUDED_RELOAD_AFTER = 3 * 60`, window_occlusion.rs:34-84), specifically to keep the WebKit GPU connection under its eviction threshold. On reload the child re-fetches the SAME stored launch context (same operationId) from the Rust state: `get_physics_paint_launch_context` (usePhysicsPaintParentBridge.ts:94-101; state stored at lib.rs:216-219).
  implication: Occluded-idle time produces repeated reloads of the same launch; each one hits the checkpoint substitution. This matches the user-confirmed occlusion trigger and the untimed/staggered onset.

- timestamp: 2026-10-26T12:17Z
  checked: `startFrame` usage after hydration
  found: `launchContext.startFrame` is the Studio's live current/play frame throughout (PhysicsPaintStudio.tsx:1025, 1753, 3720, 4238, 5191, 6361, and many more), and several gates compare it to a frame's `appFrame` (e.g. :1551, :2525, :2736).
  implication: Any fix must keep `startFrame` and the hydrated document cursor coherent; simply bypassing the door check while leaving a stale `startFrame` would corrupt the recovered session's cursor model.

- timestamp: 2026-10-26T12:17Z
  checked: History the user asked about
  found: The exact string entered the codebase in 4c008c0f (36.14-09). It was captured as a diagnostic `launch-door` probe reason in quick-260921-qls (probe-only; probes later retired in 002521b5) and was never fixed. The resolved debug `studio-reopen-empty-boot` has the same visible symptom (black Studio / Engine not ready) but a different root cause (reference-only real-key bytes throwing during the launch replacement). The checkpoint substitution itself was introduced/rebound by a6136718 (52.2-H, quick-260913-52r) without a cursor-alignment rule. Git pickaxe shows no fix for this refusal.
  implication: Not a regression of a previous fix; it is an unfixed interaction between the crash-recovery checkpoint and the launch-door cursor gate.

- timestamp: 2026-10-26T13:20Z
  checked: Is the stored launch ever refreshed on document pushes?
  found: `PhysicsPaintLaunchState` is written only by `open_physics_paint_window` (lib.rs:207-219) and read by `get_physics_paint_launch_context` (lib.rs:199-204). Document sync pushes never update it, so the reload's envelope keeps the original `startFrame` for the whole session.
  implication: The divergence persists across every occlusion reload; nothing re-derives the envelope from the main realm's fresher document.

- timestamp: 2026-10-26T13:20Z
  checked: Which side is the declared cursor authority?
  found: Both canonical derivations put the document cursor in charge: the launch URL parser emits `startFrame: cursorAppFrame ?? value.startFrame` (physicsPaintLaunchContext.ts:84) and the launch builder emits `startFrame: physical.cursorAppFrame` (physicPaintBridge.ts:3972). The physical parser also refuses a `selectedKeyId` whose frame disagrees with `cursorAppFrame` (physicsPaintRotoPhysicalModel.ts:1508-1516).
  implication: Re-deriving `startFrame` from the substituted checkpoint is the same law applied one step later, not an exception. Overriding the checkpoint cursor instead would roll the user back to the launch frame and force a second mutation of `selectedKeyId`.

- timestamp: 2026-10-26T13:20Z
  checked: Does the checkpoint cursor actually move during a session?
  found: Navigation sets the envelope's `startFrame` and the store cursor together (`setLaunchContext(... startFrame: frame)` at PhysicsPaintStudio.tsx:863/2217; `setRotoPhysicalSelection(..., startFrame)` at :818). `_buildRotoPhysicalDocumentForLayer` projects the next push's `cursorAppFrame` from the selection/live cursor (physicPaintStore.ts:2694-2710), and the checkpoint writes that serialized document (PhysicsPaintStudio.tsx:6840-6841).
  implication: After any document-pushing edit on a frame other than the launch frame, the checkpoint cursor (B) and the stored envelope (A) diverge. This is the exact precondition the user reports.

- timestamp: 2026-10-26T13:20Z
  checked: RED/GREEN of the deterministic pin
  found: New cells in usePhysicsPaintLaunchIntegration.test.ts: the stale pair `{ ...context, document: checkpoint }` is refused with the exact message; `resolveLaunchHydrationContext(context, checkpoint)` yields `startFrame === 9` and hydrates; no checkpoint returns the identical envelope; a checkpoint without active-track physical state keeps the envelope and still refuses. RED 4 failed / 7 passed before the helper existed; GREEN 11/11 after.
  implication: The mechanism and the single-authority remedy are both pinned without a live app.

- timestamp: 2026-10-26T14:28Z
  checked: Native idle/occlusion UAT (the row requested at resolution)
  found: The user left the app unfocused for hours with the computer asleep (veille ordinateur) and returned to a working Studio — no black screen, no "Engine not ready". User verdict: "no black screen more. All UAT Approved."
  implication: The live path that previously reproduced the refusal (occlusion reload + checkpoint substitution) now recovers; the fix is UAT-confirmed and the session is closed.

## Resolution

- root_cause: >
  An interaction between two correct-in-isolation mechanisms. (1) The native
  occlusion monitor (`window_occlusion.rs`) reloads the hidden Studio every
  3 minutes of continuous occlusion to reset the WebKit GPU connection. The
  reload re-boots the child from the SAME stored launch envelope — Rust's
  `PhysicsPaintLaunchState` is written only by `open_physics_paint_window`, so
  the envelope keeps its original `operationId` AND its original `startFrame`
  for the whole session. (2) For crash recovery, `applySettledLaunchContext`
  substitutes the sessionStorage checkpoint document (written on every
  document push with the LIVE runtime document) when its `operationId`
  matches. The checkpoint's active-track `cursorAppFrame` is the user's live
  cursor at the last push; the envelope's `startFrame` is the frame the
  Studio was opened on. The substitution swapped only `document`, so
  `prepareRotoPhysicalLaunch` — whose door law is `startFrame ===
  document.cursorAppFrame` — refused with 'Launch cursor does not match the
  canonical physical document.' The caller logs and returns before
  `applyPhysicsPaintLaunchContext`, so no launch context is ever committed:
  the engine never initializes and the canvas stays black. Any edit (a
  document-pushing mutation) performed after navigating away from the open
  frame creates the divergence; returning to the open frame once more makes
  the next checkpoint agree, which is why the failure is intermittent and its
  onset 'varies'. The refusal string dates from 36.14-09 (4c008c0f) and was
  only ever instrumented as a diagnostic probe (quick-260921-qls), never fixed.
- fix: >
  `resolveLaunchHydrationContext(context, sessionDocument)` added to
  `usePhysicsPaintLaunchIntegration.ts` and used by `applySettledLaunchContext`
  in place of the raw spread. When a checkpoint document is substituted, the
  envelope's `startFrame` is re-derived from the checkpoint's active-track
  `cursorAppFrame`; the returned envelope is a copy (the stored launch is
  never mutated). No checkpoint returns the original envelope unchanged.
  A checkpoint whose active track carries no physical state keeps the
  envelope's own frame and still goes through the strict door, so the failure
  stays loud instead of becoming a silent fallback.
  AUTHORITY DECISION (recorded per the session brief): the checkpoint
  document's cursor is the single authority, not the launch `startFrame`.
  Rationale: (a) the codebase already declares that law — the URL parser
  derives `startFrame` from the cursor (`physicsPaintLaunchContext.ts:84`) and
  the launch builder does the same (`physicPaintBridge.ts:3972`); (b) the
  checkpoint is the freshest snapshot of both content and cursor, so
  aligning forward restores the user where they actually were; (c) the
  opposite fix (override the checkpoint cursor to the launch frame) would
  roll the session back, and because the physical parser requires
  `selectedKeyId` to sit on the cursor frame
  (`physicsPaintRotoPhysicalModel.ts:1514`) it would also force a second
  silent mutation of the freshest snapshot. The launch door itself is
  untouched and still refuses any genuinely incoherent pair.
- verification: >
  TDD: RED first in
  `app/src/components/physic-paint/hooks/usePhysicsPaintLaunchIntegration.test.ts`
  (4 failed / 7 passed — the three alignment cells failed on the missing
  helper, the source-contract cell failed because the production line still
  used the raw spread); GREEN after the fix (11/11). Gates: `npx tsc --noEmit`
  clean; related suites green — rotoLaunchHydration, refusal safety,
  physicsPaintLaunchContext, physicsPaintBridgeTransport,
  PhysicsPaintStudio contract (338 tests), and `src/lib/physicPaintBridge.test.ts`
  (155 passed / 1 skipped). Full app suite run to confirm no wider
  regression. Live UAT APPROVED 2026-10-26 — hours unfocused with the computer
  asleep, no black screen ("All UAT Approved"). The pending row was:
  open the Studio, navigate to another frame and make a document-pushing edit,
  leave the Studio occluded (display asleep or covered by another app) for
  more than 3 minutes, then return — the Studio must come back with the
  engine ready, the canvas rendered, and the cursor on the last edited frame.
- residual: >
  The stored Rust launch envelope intentionally stays stale across the
  session; each occlusion reload re-derives the cursor from the latest
  checkpoint instead. Consequence: if the sessionStorage checkpoint is
  unavailable (quota exceeded, storage cleared), the recovery falls back to
  the original launch frame — coherent and working, but post-open edits made
  after the last successful checkpoint are not restored (pre-existing
  bounded-recovery behavior). The checkpoint's own freshness remains bounded
  by the document-push debounce; a navigation-only change that pushes no
  document is not captured until the next push.
- prevention:
  why_not_caught: "No gate existed for this class. The substitution (hook-side) and the cursor door (hydration-side) were each individually correct and individually tested; nothing exercised their composition. The live path is only reachable by booting the Tauri child webview and letting the native occlusion monitor reload it, which the vitest harness cannot do, and tsc cannot help because `startFrame` is a plain number whose coupling to the document cursor is convention-only."
  recurrence_guard: "Regression cells in app/src/components/physic-paint/hooks/usePhysicsPaintLaunchIntegration.test.ts ('reproduces the refusal when the checkpoint document is substituted without aligning startFrame', 'aligns startFrame to the checkpoint active-track cursor so the same checkpoint hydrates', plus the no-checkpoint and no-physical-state cells) and a source-contract cell pinning the production substitution to `resolveLaunchHydrationContext(context, sessionDocument)` so the raw spread cannot return. Live UAT row: edit on another frame, leave the Studio occluded >3 min, return — engine ready, canvas rendered, cursor on the last edited frame."
- files_changed:
  - app/src/components/physic-paint/hooks/usePhysicsPaintLaunchIntegration.ts
  - app/src/components/physic-paint/hooks/usePhysicsPaintLaunchIntegration.test.ts
