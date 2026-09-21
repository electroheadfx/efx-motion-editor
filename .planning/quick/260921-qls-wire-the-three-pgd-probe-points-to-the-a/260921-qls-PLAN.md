---
phase: quick-260921-qls
plan: 260921-qls
type: execute
wave: 1
depends_on: []
files_modified:
  - app/src/components/physic-paint/performance/physicPaintGestureRefusalCapture.ts
  - app/src/components/physic-paint/performance/physicPaintGestureRefusalCapture.test.ts
  - app/src/components/physic-paint/roto/rotoLaunchHydration.ts
  - app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.tsx
  - .planning/quick/260921-qls-wire-the-three-pgd-probe-points-to-the-a/260921-qls-SUMMARY.md
autonomous: true
requirements: []
estimate:
  tokens: 45000
  raw_tokens: 45000
  tasks: 3
  confidence: low
must_haves:
  truths:
    - "A refused key-move or rail-edit gesture in a DEV build writes ONE app-written JSON capture at /tmp/efx-stall-capture-pgd-gesture.json naming which link owns the lock — the launch door, the carried document's install, or the strip gate — together with every busy term that produced it."
    - "A healthy gesture writes nothing: no capture on success, no per-frame write, no render-body write, no write triggered by a signal read."
    - "Consecutive identical refusals collapse to ONE write (dedupe), and the bounded per-realm event log keeps an earlier launch-door refusal inside a later strip refusal's payload."
    - "Every write is DEV-only and behaviour-neutral: no production gesture path changes, no Rust change, no new Tauri command, no capability change, no visible UI change."
    - "Native UAT stays pending — the deliverable is 'instrumentation installed, capture pending', never 'verified live'."
  artifacts:
    - app/src/components/physic-paint/performance/physicPaintGestureRefusalCapture.ts — the single owner of the payload shape, the DEV gate, the rolling pointerdown-arrival slot, the dedupe/bounded log, and the write (reusing write_debug_capture with name 'pgd-gesture'); imported by both call sites, no import cycle
    - app/src/components/physic-paint/performance/physicPaintGestureRefusalCapture.test.ts — the focused unit test: payload shape, written on refusal, NOT written when healthy, dedupe, bounded log, never throws into the gesture path
    - app/src/components/physic-paint/roto/rotoLaunchHydration.ts — the two door/install refusal call sites (probe points 1 and 2 of the pgd handoff)
    - app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.tsx — the arrival record plus the strip-gate refusal call site (probe point 3 of the pgd handoff)
    - .planning/quick/260921-qls-wire-the-three-pgd-probe-points-to-the-a/260921-qls-SUMMARY.md — the decision table (capture shape → owning link → follow-up), the short gesture script, the ACTUAL written path, and the gates
  key_links:
    - "physicPaintGestureRefusalCapture.ts → `invoke('write_debug_capture', { contents, name: 'pgd-gesture' })` → `/tmp/efx-stall-capture-pgd-gesture.json`. The Rust command is untouched: debug_capture.rs:10-25 fixes the prefix and suffixes the file for a name matching [a-z0-9-]+. The TS call shape is copied verbatim from physicsPaintPerformanceTrace.ts:512-527, including the try/catch around the dynamic import."
    - "DEV gate: `typeof window !== 'undefined' && import.meta.env.DEV` — the exact idiom of `profilingEnabled()` at physicsPaintPerformanceTrace.ts:99-106. No localStorage flag: the probe must be live whenever a dev build runs. In a packaged build the gate is false, so no diagnostic IO can fire; the module is imported but every entry point returns early — the same shipping shape the existing perf trace already has."
    - "rotoLaunchHydration.ts:79-80 — `const prepared = prepareRotoPhysicalLaunch(context); if (!prepared.ok) return prepared;` — the launch-door refusal, the FIRST link. The door's own `:55` guard lives INSIDE prepareRotoPhysicalLaunch and is already covered by `prepared.ok === false` plus `prepared.error`, so it needs no separate probe; the `reason` field is what tells the two identical 'Launch is missing the complete physical Roto document.' strings apart (`launch-door` = the carried context, `launch-install` = the install loop)."
    - "rotoLaunchHydration.ts:112-120 — the install loop assigns `activeDocument` only for the track whose id equals `context.document.activeTrackId`; the refusal at `:120` is the carried-document-presence link. The captured `activeTrackId` vs `carriedTrackIds`/`tracksCarryingPhysical` names the mismatch."
    - "PhysicsPaintWorkflowStrip.tsx:1935 + :1950-1951 — `keyUtilitiesDisabledByBusyState` (the five terms), `physicalDragAvailable`, `rotoDragLocked`. This ONE flag feeds the key-drag pointerdown gate (:3424), the classifier (:3304), the cell-level `dragEligible` (:3953) and the key-rail `busy` prop (:3852), so a single true term kills key move and rail edit together. The probe must print each of the five terms individually, never only the aggregate."
    - "PhysicsPaintWorkflowStrip.tsx:3824 — `onPointerDownCapture={handleLanePushPointerDownCapture}` on the ACTIVE lane is the only unconditional pointerdown observer for real gestures: the key cell's own `onPointerDown` (:1434) is attached only when `props.dragEligible` is true, which is exactly what the lock turns off. Both probe calls go at the TOP of that handler (:2793), before its `isPushToolArmed()` early return, so arrival is observed even when the gesture dies. Non-active rows are presentational (PhysicsPaintTrackRow) — all real gestures happen on the active lane, which is the layer the Studio was opened on."
    - "Single realm: PhysicsPaintStudio mounts only in the efx-physic-paint window (main.tsx:101-102) and is the only production caller of hydrateRotoPhysicalLaunchContext (usePhysicsPaintLaunchIntegration.ts:126). All three probe points therefore share one JS realm, one module log, and one file — no cross-realm clobbering."
---

<objective>
Replace the pgd handoff's `console.info` probes with the project's standing app-written capture: wire the three `[pgd-probe]` points (two in rotoLaunchHydration.ts, one in PhysicsPaintWorkflowStrip.tsx) into ONE DEV-only, refusal-triggered JSON capture at `/tmp/efx-stall-capture-pgd-gesture.json` that carries every busy term plus the pointerdown arrival, so the follow-up can name which link owns the lock on physic-paint layers beyond the first.

Purpose: 260921-pgd ended STRUCTURAL with all in-process hypotheses falsified and the surviving half behind the DOM wall. Its handoff asked for a console copy; the project rule is an app writes the capture to /tmp and Claude reads it from disk. This plan delivers exactly that — instrumentation only, no fix, no behaviour change — so the next task routes the real fix off a file instead of a screenshot of a console.

Output: one capture module, its focused test, three wired probe points, and a SUMMARY carrying the decision table plus the gesture script. Diagnostic only: zero production behaviour change, zero Rust change, native UAT pending.
</objective>

<execution_context>
@/Users/lmarques/Dev/efx-motion-editor/.claude/gsd-core/workflows/execute-plan.md
@/Users/lmarques/Dev/efx-motion-editor/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/quick/260921-pgd-physic-paint-layers-beyond-the-first-are/260921-pgd-SUMMARY.md

Verified anchors (already re-verified; do not re-grep, read only what a task needs):

- `app/src-tauri/src/commands/debug_capture.rs:10-25` — `write_debug_capture(contents, name)`; fixed prefix `/tmp/efx-stall-capture.json`; a `name` matching `[a-z0-9-]+` writes `/tmp/efx-stall-capture-{name}.json`. Registered app-wide at `app/src-tauri/src/lib.rs:912`. The Physics Paint window's capability carries `core:default` (`app/src-tauri/capabilities/physics-paint.json`). DO NOT modify any Rust file, and do not add a command.
- `app/src/components/physic-paint/performance/physicsPaintPerformanceTrace.ts:99-106` (the DEV gate), `:512-527` (the invoke + try/catch + fire-and-forget shape), `:529-543` + `:545-559` (the DEV-only `window.__EFX_PHYSICS_PAINT_PROFILE__` hook and its `declare global` block).
- `app/src/components/physic-paint/roto/rotoLaunchHydration.ts:79-80` (door), `:112-120` (install loop + carried-document refusal), `:51-72` (prepareRotoPhysicalLaunch, including its `:55` guard).
- `app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.tsx:1905-1906` (`sessionKeyAvailability`, `physicalActions`), `:1505` (`rotoDragPreview`), `:1935` (the five busy terms), `:1950-1951` (`physicalDragAvailable`, `rotoDragLocked`), `:2793-2861` (`handleLanePushPointerDownCapture`, deps at `:2861`), `:3824` (its binding), `:3833-3852` (PhysicsPaintKeyRail props incl. `busy`), `:1434` (the key cell's conditional `onPointerDown`), `:3953` (`dragEligible`), `:3304` and `:3424` (the two refusal returns).
- Import direction: `roto/rotoCanvasFrames.ts:10` already imports `../performance/physicsPaintPerformanceTrace`, and `view/PhysicsPaintWorkflowStrip.tsx:119` already imports it too — so `../performance/physicPaintGestureRefusalCapture` from both call sites creates no cycle. Put the new module in `performance/`, beside the existing capture transport.
- Test conventions: `app/vitest.config.ts` includes `src/**/*.test.ts` only; the app is `@tauri-apps/api/core`-mocked with `vi.mock('@tauri-apps/api/core', () => ({ invoke }))` (see `app/src/components/physic-paint/bridge/physicsPaintBridgeTransport.test.ts:11`); `window` is stubbed with `vi.stubGlobal` and `import.meta.env.DEV` is true under vitest (see `physicsPaintPerformanceTrace.test.ts:58-70`). Run tests with `pnpm --filter efx-motion-editor exec vitest run <path>` — never watch mode, no new config.
- Preact reactivity rules apply to every component edit: read the `efx-preact-reactivity` skill before touching `PhysicsPaintWorkflowStrip.tsx`. No new signals, no new `useState`, no effect is added by this plan; the module keeps a plain module-level slot.
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: The refusal-capture module + its focused test</name>
  <files>app/src/components/physic-paint/performance/physicPaintGestureRefusalCapture.ts, app/src/components/physic-paint/performance/physicPaintGestureRefusalCapture.test.ts</files>
  <behavior>
    - Shape: `reportGestureRefusal('strip-gate', { strip: {...} })` calls `invoke('write_debug_capture', { contents, name: 'pgd-gesture' })` exactly once; the parsed `contents` carries `capturedAt` as an ISO string, `captureName`, `eventCount`, `events[0].reason`, and `events[0].terms` with the four groups `door`, `install`, `strip`, `pointerdown` present (absent groups serialised as `null`), plus a top-level `arrivalSlot`.
    - Written on refusal: with `window` stubbed and `invoke` mocked to resolve a path, one strip refusal produces one invoke whose `name` is `'pgd-gesture'` and whose `contents` carries the printed term names and values verbatim (the five busy terms individually, plus `physicalDragAvailable`, `canDragKey`, `dragDisabledReason`, `rotoDragLocked`, `hasPhysicalActions`).
    - NOT written when healthy: with `window` undefined (the node default) a refusal produces no invoke; with `window` present, `recordGesturePointerArrival(...)` alone produces no invoke and leaves `arrivalSlot` populated — arrival is in-memory only.
    - Dedupe: two identical refusals inside the debounce window produce ONE invoke; an identical refusal after the window (advance the fake clock past it) produces a second; a refusal with different terms always produces a new invoke.
    - Bounded log: ten distinct refusals leave `events.length` at the cap (8), newest LAST, and an earlier `launch-door` event is still present in the payload written by a later `strip-gate` refusal.
    - Never throws: an `invoke` that rejects, and an `invoke` whose dynamic import rejects, both leave `reportGestureRefusal` returning without throwing.
  </behavior>
  <action>
Create the module at `app/src/components/physic-paint/performance/physicPaintGestureRefusalCapture.ts`, then the test at `physicPaintGestureRefusalCapture.test.ts` in the same folder. Write the failing test first.

Module surface (export exactly these; the call sites in Task 2 depend on them):
- `GESTURE_REFUSAL_CAPTURE_NAME = 'pgd-gesture'` — the `name` argument, producing `/tmp/efx-stall-capture-pgd-gesture.json`.
- `type PhysicPaintGestureRefusalReason = 'launch-door' | 'launch-install' | 'strip-gate'`.
- `type PhysicPaintGestureSurfaceKind = 'key-cell' | 'key-rail' | 'loop-rail' | 'lane' | 'other'`.
- `interface PhysicPaintGesturePointerArrival { surface; keyId: string | null; appFrame: number | null; railFirstFrame: number | null; pointerId: number; button: number; isPrimary: boolean; metaKey: boolean; ctrlKey: boolean; shiftKey: boolean; arrivedAt: string }`.
- `interface PhysicPaintGestureDoorTerms { ok: boolean; error: string | null; layerId: string | null; startFrame: number | null; activeTrackId: string | null; carriedCursorAppFrame: number | null; carriedRecordCount: number }`.
- `interface PhysicPaintGestureInstallTerms { activeTrackId: string | null; carriedTrackIds: string[]; tracksCarryingPhysical: string[]; activeDocumentInstalled: boolean }`.
- `interface PhysicPaintGestureStripTerms { ready: boolean; mutationLocked: boolean; keyActionInFlight: boolean; sessionBusy: boolean; dragPreviewPending: boolean; hasPhysicalActions: boolean; physicalDragAvailable: boolean; canDragKey: boolean | null; dragDisabledReason: string | null; rotoDragLocked: boolean }`.
- `interface PhysicPaintGestureRefusalEvent { capturedAt: string; reason: PhysicPaintGestureRefusalReason; terms: { door: PhysicPaintGestureDoorTerms | null; install: PhysicPaintGestureInstallTerms | null; strip: PhysicPaintGestureStripTerms | null; pointerdown: (PhysicPaintGesturePointerArrival & { arrived: boolean }) | { arrived: false } } }`.
- `interface PhysicPaintGestureRefusalCapture { capturedAt: string; captureName: string; eventCount: number; events: PhysicPaintGestureRefusalEvent[]; arrivalSlot: PhysicPaintGesturePointerArrival | null }`.
- `gestureRefusalCaptureEnabled(): boolean` — `typeof window !== 'undefined' && import.meta.env.DEV`, the `profilingEnabled()` idiom verbatim. No localStorage flag.
- `describeGestureSurface(target: unknown): { surface; keyId; appFrame; railFirstFrame }` — duck-typed, no `Element`/`instanceof` (the node test has no DOM): reach the target through an optional `closest(selector)` method and an optional `getAttribute(name)` method, guarding every call with `typeof ... === 'function'`. Order: `.physics-paint-key-rail-target` → `key-rail` (read `data-rail-first-frame`); `.physics-paint-loop-clip-rail-target` → `loop-rail`; `[data-roto-app-frame]` → `key-cell` (read `data-roto-app-frame` and `data-roto-key-id`); otherwise `lane` when the target is an object, `other` for a null target.
- `recordGesturePointerArrival(arrival: Omit<PhysicPaintGesturePointerArrival, 'arrivedAt'>): void` — writes the module slot only; never writes to disk, never throws.
- `reportGestureRefusal(reason, terms: { door?: PhysicPaintGestureDoorTerms; install?: PhysicPaintGestureInstallTerms; strip?: PhysicPaintGestureStripTerms }): void` — appends `{ capturedAt: new Date().toISOString(), reason, terms: { door: terms.door ?? null, install: terms.install ?? null, strip: terms.strip ?? null, pointerdown: arrivalSlot ? { ...arrivalSlot, arrived: true } : { arrived: false } } }`, caps the log at 8 (drop the oldest), then writes unless deduped. Fire-and-forget: the invoke is not awaited by the caller.
- `dumpGestureRefusalCapture(): Promise<string | null>` — the manual DEV dump of the current state (same payload, same path), returning the written path or null.
- `resetGestureRefusalCaptureForTesting(): void` — clears the log, the arrival slot, the dedupe signature and the last-write time.

Rules the implementation must honour: the DEV gate is checked at the TOP of both `recordGesturePointerArrival` and `reportGestureRefusal`; the whole body of each is wrapped so it can never throw into the caller (this runs inside a pointerdown handler and inside launch hydration); the write is `const { invoke } = await import('@tauri-apps/api/core'); await invoke<string>('write_debug_capture', { contents: JSON.stringify(capture), name: GESTURE_REFUSAL_CAPTURE_NAME })` inside a try/catch that returns null on failure — copy the `dumpPhysicsPaintStallDiagnostics` shape (physicsPaintPerformanceTrace.ts:512-527) exactly, including its failure `console.warn`. Dedupe key: `JSON.stringify({ reason, terms })` with the pointerdown group's `arrivedAt` and the event `capturedAt` excluded, so only term changes count as a new event; suppress the write when the key matches the previous one and less than 1500 ms have elapsed since the last write. Expose the dedupe window as a module constant so the test can advance past it. If the module installs the DEV-only `window.__EFX_PGD_GESTURE__` hook, follow the `__EFX_PHYSICS_PAINT_PROFILE__` precedent (`:529-543` plus its `declare global` block) and expose `{ dump, reset, snapshot }` — justified because it is the only way the live run can positively show "the pointerdown never arrived" (H-7's undecidable half) when nothing is refused; note that justification in a one-line comment.

Test file: `vi.mock('@tauri-apps/api/core', () => ({ invoke }))` with a spy `invoke`; `vi.stubGlobal('window', {})` for the enabled legs and `vi.unstubAllGlobals()` for the disabled leg; `resetGestureRefusalCaptureForTesting()` in `beforeEach`; `vi.useFakeTimers()` + `vi.setSystemTime` for the dedupe window (or an injectable clock kept module-private); `await` a microtask flush before asserting the invoke call count (the write is fire-and-forget). One `it` per behavior bullet above, named for the behaviour it pins.

Keep the file lean: no imports from the storage layer, no store, no signals.
  </action>
  <verify>
    <automated>pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint/performance/physicPaintGestureRefusalCapture.test.ts</automated>
  </verify>
  <done>All behaviour bullets above are pinned by a green test; the module exports the surface Task 2 imports; the gate, the dedupe and the never-throw wrappers are implemented as specified. No other file is touched by this task.</done>
</task>

<task type="auto">
  <name>Task 2: Wire the three probe points to the capture</name>
  <files>app/src/components/physic-paint/roto/rotoLaunchHydration.ts, app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.tsx</files>
  <action>
Wire the three pgd probe points into the module from Task 1. Diagnostic only: no control flow, no return value, no rendered output, no signal, and no existing guard changes anywhere in this task.

1. `rotoLaunchHydration.ts` — add `import { reportGestureRefusal } from '../performance/physicPaintGestureRefusalCapture';` at the top with the sibling imports. (`roto/` → `../performance/` already exists at `rotoCanvasFrames.ts:10`, so this adds no cycle.)

2. `rotoLaunchHydration.ts:79-80` — the launch door. The body is currently `const prepared = prepareRotoPhysicalLaunch(context); if (!prepared.ok) return prepared;`. Inside that branch, before the return, report `'launch-door'` with the door terms: `ok: prepared.ok`, `error: prepared.error`, `layerId: context.layerId`, `startFrame: context.startFrame`, `activeTrackId: context.document?.activeTrackId ?? null`, `carriedCursorAppFrame: getCarriedRotoPhysical(context)?.cursorAppFrame ?? null`, `carriedRecordCount: getCarriedRotoPhysical(context)?.realKeyRecords.length ?? -1`. Do NOT add a probe inside `prepareRotoPhysicalLaunch` — its `:55` guard already surfaces through `prepared.ok === false` and `prepared.error`, and the `reason` field is what distinguishes it from the install-arm refusal below.

3. `rotoLaunchHydration.ts:120` — the carried-document install. The body is currently a single-line `if (!activeDocument) return { ok: false, error: '...' };`. Expand it to a braced block and report `'launch-install'` before the return with the install terms: `activeTrackId`, `carriedTrackIds: (context.document?.tracks ?? []).map((track) => track.id)`, `tracksCarryingPhysical: (context.document?.tracks ?? []).filter((track) => track.rotoPhysical).map((track) => track.id)`, `activeDocumentInstalled: activeDocument !== null`. This is the same error string as the door's `:55` arm — the reason field is the only thing that tells them apart, which is the point.

4. `PhysicsPaintWorkflowStrip.tsx` — add `import { describeGestureSurface, recordGesturePointerArrival, reportGestureRefusal } from '../performance/physicPaintGestureRefusalCapture';` beside the existing `../performance/physicsPaintPerformanceTrace` import at `:119`. Read the `efx-preact-reactivity` skill before editing this file.

5. `PhysicsPaintWorkflowStrip.tsx` — define ONE new callback, placed after the `rotoDragLocked` derivation (`:1951`) and before `handleLanePushPointerDownCapture` (`:2793`), e.g. `probeLaneGestureRefusal`, a `useCallback((event: PointerEvent) => {...}, [...])` whose body is: a guard `if (!gestureRefusalCaptureEnabled()) return;`-equivalent (the module already self-gates, so calling unconditionally is acceptable and preferable — do not add a second gate in the component); `const arrival = describeGestureSurface(event.target);` then `recordGesturePointerArrival({ ...arrival, pointerId: event.pointerId, button: event.button, isPrimary: event.isPrimary, metaKey: event.metaKey, ctrlKey: event.ctrlKey, shiftKey: event.shiftKey });` then `if (!rotoDragLocked) return;` then `if (arrival.surface !== 'key-cell' && arrival.surface !== 'key-rail' && arrival.surface !== 'loop-rail') return;` then `reportGestureRefusal('strip-gate', { strip: { ready: props.ready !== false, mutationLocked: Boolean(props.mutationLocked), keyActionInFlight: Boolean(props.keyActionInFlight), sessionBusy: Boolean(sessionKeyAvailability?.busy), dragPreviewPending: Boolean(rotoDragPreview?.pending), hasPhysicalActions: Boolean(physicalActions), physicalDragAvailable, canDragKey: physicalActions?.canDragKey.value ?? null, dragDisabledReason: physicalActions?.dragDisabledReason.value ?? null, rotoDragLocked } });`. The dep array must carry every value the body reads: `rotoDragLocked`, `physicalActions`, `physicalDragAvailable`, `sessionKeyAvailability`, `rotoDragPreview`, `props.ready`, `props.mutationLocked`, `props.keyActionInFlight`. Reading `canDragKey.value` / `dragDisabledReason.value` inside an event handler is correct; never read a signal in a render body for this probe.

6. `PhysicsPaintWorkflowStrip.tsx:2793` — make `probeLaneGestureRefusal(event)` the FIRST statement of `handleLanePushPointerDownCapture`, before its `if (!isPushToolArmed()) return;`, so arrival is recorded even when the push tool is off and the gesture dies silently. Add `probeLaneGestureRefusal` to that callback's dep array at `:2861`. Leave every existing guard, `stopPropagation` and return in that handler exactly as it is.

Why those anchors: `:3824` binds the capture handler on the ACTIVE lane, which is the layer the Studio is opened on — the reported case; the key cell's own pointerdown (`:1434`) is attached only when `dragEligible` is true, i.e. it disappears exactly when the gate locks, so it cannot be the arrival observer. Non-active rows are presentational rows, so no second binding is needed.

Hard constraints: no Rust file, no new Tauri command, no capability change, no new IPC path, no new signal or state, no visual change, no fix. The capture writes only on a refusal; if the three edits change any observed behaviour the edit is wrong — revert and re-read the anchor.
  </action>
  <verify>
    <automated>pnpm --filter efx-motion-editor exec tsc --noEmit && test -z "$(git diff --name-only HEAD -- app/src-tauri)" && grep -n "reportGestureRefusal\|recordGesturePointerArrival" app/src/components/physic-paint/roto/rotoLaunchHydration.ts app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.tsx</automated>
  </verify>
  <done>`tsc --noEmit` is clean; `app/src-tauri` is untouched; the grep lists the door report, the install report, the arrival record and the strip report at their specified anchors; no guard, return, prop, style or rendered element in either file changed besides the three probe call sites and the import; the full suite stays green (checked in Task 3).</done>
</task>

<task type="auto">
  <name>Task 3: Gates, decision table and the handoff script</name>
  <files>.planning/quick/260921-qls-wire-the-three-pgd-probe-points-to-the-a/260921-qls-SUMMARY.md</files>
  <action>
Run the gates, then write the SUMMARY sections the follow-up task depends on. Do NOT start the app: the live run belongs to the user (project rule), and the claim must stay "instrumentation installed, capture pending".

Gates, in order, with their exact commands and raw results recorded in the SUMMARY:
1. `pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint/performance/physicPaintGestureRefusalCapture.test.ts`
2. `pnpm --filter efx-motion-editor exec tsc --noEmit`
3. `pnpm --filter efx-motion-editor exec vitest run` (the full suite — record the file/test counts and any pre-existing-failure delta against STATE.md; report the delta only)
4. `test -z "$(git diff --name-only HEAD -- app/src-tauri)"` and a capability check (`git status --porcelain -- app/src-tauri`)

The SUMMARY must contain, verbatim and complete:

(a) The decision table — capture shape → which link owns the lock → follow-up:

| capture shape | owning link | follow-up |
|---|---|---|
| `reason:'launch-door'` + `door.error:'Launch is missing the complete physical Roto document.'` | the carried context has no physical document on its active track (`rotoLaunchHydration.ts:55`) | fix the launch payload so the active track carries `rotoPhysical` |
| `reason:'launch-door'` + `door.error:'Launch cursor does not match the canonical physical document.'` | the door's frame alignment (`context.startFrame !== document.cursorAppFrame`) | align the launch frame with the document cursor |
| `reason:'launch-door'` + any other `door.error` | the physical projection or parse (`:61-70`) | the error text names the failing term |
| `reason:'launch-install'` + `install.activeDocumentInstalled:false` | the install loop (`:112-120`) found no track whose id equals `activeTrackId` with a `rotoPhysical` | compare `install.activeTrackId` against `carriedTrackIds` / `tracksCarryingPhysical`; the mismatch names the owner |
| `reason:'strip-gate'` with one of the five busy terms true | the strip gate — the printed true term names the owner (`ready` / `mutationLocked` / `keyActionInFlight` / `sessionBusy` / `dragPreviewPending`) | fix at that term's producer; `dragDisabledReason` names the controller reason when `canDragKey` is false |
| `reason:'strip-gate'` with the five terms false and `hasPhysicalActions:false` | `props.rotoPhysicalActions` never reached the strip | wire the physical action bundle for the launched track |
| `reason:'strip-gate'` with the five terms false, `hasPhysicalActions:true`, `physicalDragAvailable:false` | `canDragKey` false — read `dragDisabledReason` | fix in the named `computeDragAvailability` term |
| no file at all; `__EFX_PGD_GESTURE__.dump()` shows `arrivalSlot:null` | the pointerdown never reached the active lane (H-7's upstream half) | instrument above the strip: scroll container, overlay, row z-order |
| no file at all; the dump shows an `arrivalSlot` with `surface:'key-cell'` and no refusal event | the pointerdown arrived, nothing refused, nothing moved — the refusal is downstream of the gate (`dragEligible` false for a non-busy reason, or `frameInteraction?.dragEligible === false` at `:3953`) | inspect the clicked cell's `data-roto-kind` / `data-roto-key-id` and the `dragEligible` inputs |

(b) The gesture script, exactly:

```
0. rm -f /tmp/efx-stall-capture-pgd-gesture.json
1. pnpm tauri dev        (from the repo root — the DEV gate is off in packaged builds)
2. CONTROL on layer 1: open the Studio, select a key, move it once, then move or stretch a rail once
   → the file at /tmp/efx-stall-capture-pgd-gesture.json must NOT exist.
3. DEFECT on layer 2: open the Studio on a second Physic Paint layer with >= 2 keys, perform the
   SAME two gestures once each → the file must exist.
4. Read /tmp/efx-stall-capture-pgd-gesture.json and return its contents verbatim.
   If it does not exist after step 3, run __EFX_PGD_GESTURE__.dump() once in the Studio window's
   devtools console and read the file again — a dumped arrivalSlot with no refusal event is itself
   the answer (the pointerdown never arrived, or nothing refused).
```

(c) The ACTUAL written path, stated verbatim, and the fact that it comes from `name: 'pgd-gesture'` through the untouched `write_debug_capture` command (zero Rust changes).

(d) The precondition: the run requires a DEV build (`pnpm tauri dev`); a packaged build gates the probe off by design, so a packaged run produces no file.

(e) The claim discipline: "instrumentation installed, capture pending" — never "verified live", never "fix verified". Native UAT is PENDING.

(f) The evidence that this plan changes no production behaviour: the three call sites are refusal-only and event-driven (never per-frame, never render-body, never a signal read); the DEV gate is the `profilingEnabled()` idiom; the writes are deduped and the log is bounded. Link the test file as the pin for the healthy-path no-write and the dedupe.

Also record in the SUMMARY: the deliberate deviation of committing DEV-gated instrumentation to production files (unlike the pgd handoff, which asked for revert-after-capture) and why removal is a follow-up decision after the diagnosis closes; plus the limitation that only the ACTIVE lane is instrumented (non-active rows are presentational, so a pointerdown there is not observed).
  </action>
  <verify>
    <automated>pnpm --filter efx-motion-editor exec vitest run</automated>
  </verify>
  <done>All four gates recorded with raw results; the SUMMARY carries the decision table, the gesture script, the verbatim path `/tmp/efx-stall-capture-pgd-gesture.json`, the dev-build precondition, the pending-UAT claim discipline, and the deviation and limitation notes; `app/src-tauri` untouched.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| renderer (Studio window) → Rust `write_debug_capture` | the probe sends a JSON payload across the IPC boundary to be written to a fixed /tmp path |
| macOS /tmp filesystem | the capture lands in a world-readable temp path; it is a DEV-only diagnostic artefact |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-qls-01 | Information Disclosure | the capture payload written to /tmp | low | mitigate | The payload interface carries only ids (layer/track/key), booleans, numbers, ISO timestamps, app-owned reason strings, and a DOM surface kind derived from CSS class names. No frame bytes, data URLs, canvas pixels, package paths, file names or user content. Tauri's `name` validator (`[a-z0-9-]+`) is the only caller-controlled path fragment and is a module constant. |
| T-qls-02 | Tampering | packaged builds | low | mitigate | `gestureRefusalCaptureEnabled()` requires `import.meta.env.DEV`, so a production bundle never performs the write; no Rust, capability or permission change is made. |
| T-qls-03 | Denial of Service | write amplification from a gesture loop | low | mitigate | Refusal-triggered only (never render, never per frame, never per signal read), one write per refusal event, consecutive identical payloads deduped with a 1500 ms window, event log capped at 8. Pinned by the dedupe test leg. |
| T-qls-04 | Elevation of Privilege | the probe could widen a gesture gate | low | mitigate | The probe is inserted strictly before existing guards and returns; it changes no term, no prop and no return value. Pinned by "no guard changed" in Task 2's `<done>` and by the healthy-path no-write test. |
| T-qls-05 | Repudiation | a misread capture blamed on the wrong link | medium | mitigate | The capture always carries the pointerdown arrival alongside the refusal terms, and the SUMMARY's decision table maps each capture shape to one owning link, so a refusal can never be read without its arrival context. |
| T-qls-SC | Tampering | npm/pip/cargo installs | low | accept | This plan performs no package-manager install and adds no dependency; the supply-chain gate is not triggered. |
</threat_model>

<verification>
1. `pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint/performance/physicPaintGestureRefusalCapture.test.ts` — the focused legs pass (shape, written-on-refusal, healthy-no-write, dedupe, bounded log, never-throws).
2. `pnpm --filter efx-motion-editor exec tsc --noEmit` — clean.
3. `pnpm --filter efx-motion-editor exec vitest run` — the full suite with a recorded pre-existing-failure delta only.
4. `test -z "$(git diff --name-only HEAD -- app/src-tauri)"` — zero Rust changes.
5. The three probe call sites exist at their specified anchors (grep from Task 2).
6. No capture is claimed as produced: the live run is the user's; the SUMMARY states "instrumentation installed, capture pending".
</verification>

<success_criteria>
- One DEV-only capture module owns the payload, the gate, the arrival slot, the dedupe and the write; both call sites import it with no cycle.
- The three pgd probe points are wired: launch door, carried-document install, strip gate + pointerdown arrival — a strict superset of the pgd handoff's printed terms.
- Writes happen only on a refusal, are deduped, and can never throw into the gesture path.
- The written file is `/tmp/efx-stall-capture-pgd-gesture.json` (via `name: 'pgd-gesture'`), stated verbatim in the SUMMARY; zero Rust change, zero new transport, zero capability change.
- No behaviour change: no guard, return, prop, signal, style or rendered element is modified; no visible UI change.
- The SUMMARY carries the decision table and the gesture script; native UAT and the capture itself stay explicitly PENDING.
</success_criteria>

<output>
Create `.planning/quick/260921-qls-wire-the-three-pgd-probe-points-to-the-a/260921-qls-SUMMARY.md` when done.
</output>
