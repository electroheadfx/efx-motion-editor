---
phase: quick-260729-taj-close-milestone-audit-gap-edit-02-b-01-i
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - app/src/main.tsx
  - app/src/main.test.ts
autonomous: true
requirements:
  - QUICK-260729-TAJ
must_haves:
  truths:
    - "EDIT-02/B-01: At editor app startup, main.tsx installs the physic-paint:seek-frame frame-sync listener alongside the five existing Physics Paint listeners, so standalone-window navigation seeks the editor timeline."
    - "EDIT-02/B-01: A valid { type: 'physic-paint:seek-frame', frame: N } message event received by the startup-installed listener routes to timelineStore.seek(N) and timelineStore.ensureFrameVisible(N)."
    - "Startup behavior is otherwise unchanged: the five existing async listener installs, menu listeners, close guard, and /physics-paint branch are untouched."
  artifacts:
    - path: "app/src/main.tsx"
      provides: "Editor startup installs installPhysicPaintFrameSyncListener (physicPaintBridge.ts:963) in the same initTempProjectDir().then block as the five sibling installs"
      contains: "installPhysicPaintFrameSyncListener"
    - path: "app/src/main.test.ts"
      provides: "Startup regression coverage proving the frame-sync listener is installed by main.tsx and routes a valid seek event to the editor timeline"
      contains: "physic-paint:seek-frame"
  key_links:
    - from: "app/src/main.tsx"
      to: "app/src/lib/physicPaintBridge.ts"
      via: "installPhysicPaintFrameSyncListener() called once in the editor startup branch; synchronous, no await, app-lifetime registration matching the existing pattern of discarded cleanup handles"
      pattern: "installPhysicPaintFrameSyncListener"
    - from: "app/src/lib/physicPaintBridge.ts"
      to: "app/src/stores/timelineStore.ts"
      via: "window 'message' listener -> handlePhysicPaintFrameSyncMessage -> isPhysicPaintFrameSyncMessage guard -> timelineStore.seek + timelineStore.ensureFrameVisible"
      pattern: "handlePhysicPaintFrameSyncMessage"
---

<objective>
Close the v0.8.0 milestone audit gap EDIT-02/B-01: `installPhysicPaintFrameSyncListener` (app/src/lib/physicPaintBridge.ts:963) is defined and unit-tested but has zero production callers, so the standalone Physics Paint window's `physic-paint:seek-frame` navigation messages never seek the editor timeline. Install it in `app/src/main.tsx` alongside the five existing Physics Paint listener installs, and add startup-level regression coverage proving installation and routing.

Purpose: Restore the standalone-navigation-to-editor-timeline seek sub-flow, taking EDIT-02 from partial to satisfied and clearing the B-01 integration blocker without touching any other behavior.
Output: A two-line production change in main.tsx (import + one install call), a new startup regression test file, green targeted vitest, typecheck, and build gates using existing configuration only.
</objective>

<execution_context>
@/Users/lmarques/Dev/efx-motion-editor/.claude/gsd-core/workflows/execute-plan.md
@/Users/lmarques/Dev/efx-motion-editor/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/v0.8.0-MILESTONE-AUDIT.md
@app/src/main.tsx
@app/src/lib/physicPaintBridge.ts
@app/src/lib/physicPaintBridge.test.ts
</context>

<tasks>

<task type="tracer" tdd="true">
  <name>Task 1: Add failing startup regression test for the frame-sync listener installation (RED)</name>
  <files>app/src/main.test.ts</files>
  <behavior>
    - Test A (sanity, must pass immediately): importing app/src/main.tsx with a stubbed non-/physics-paint window completes the editor startup branch without throwing and registers at least one window 'message' event listener.
    - Test B (gap regression, must FAIL before Task 2 and PASS after): after startup, invoking every captured 'message' listener with a MessageEvent carrying { type: 'physic-paint:seek-frame', frame: 7 } calls timelineStore.seek(7) and timelineStore.ensureFrameVisible(7) exactly once each.
  </behavior>
  <action>
    Create app/src/main.test.ts following the existing Node-environment conventions of app/src/lib/physicPaintBridge.test.ts (manual globalThis.window stub via Object.defineProperty, vi.restoreAllMocks/vi.unstubAllGlobals in teardown, restore the original window afterward). Do NOT add a vitest environment directive, jsdom, or any config change.

    Setup requirements, in this order before importing main.tsx:
    1. Stub globalThis.window with an object whose addEventListener CAPTURES (type, listener) pairs into a local structure keyed by type (multiple 'message' listeners will register — keep all of them), plus removeEventListener: vi.fn(), dispatchEvent: vi.fn(), and location: { pathname: '/', origin: 'http://localhost:1420' } (pathname must NOT be '/physics-paint' so the editor branch runs).
    2. Stub globalThis.document with { getElementById: vi.fn(() => ({})) } because main.tsx line 16 calls document.getElementById('app') at module scope.
    3. vi.mock the side-effectful imports of main.tsx, using specifiers relative to app/src (the test file sits beside main.tsx, so './lib/...', './app', './stores/...' match): 'preact' -> { render: vi.fn() }; '@tauri-apps/api/window' -> { getCurrentWindow: () => ({ onCloseRequested: vi.fn() }) }; '@tauri-apps/api/event' -> { listen: vi.fn(() => Promise.resolve(() => {})) }; './lib/projectDir' -> { initTempProjectDir: vi.fn(() => Promise.resolve()) }; './lib/themeManager' -> { initTheme: vi.fn(() => Promise.resolve()) }; './lib/autoSave' -> { startAutoSave: vi.fn() }; './lib/shortcuts' -> { mountShortcuts: vi.fn(), handleSave: vi.fn(), handleNewProject: vi.fn(), handleOpenProject: vi.fn(), handleCloseProject: vi.fn() }; './lib/history' -> { undo: vi.fn(), redo: vi.fn() }; './app' -> { App: () => null }; './stores/paintStore' -> { paintStore: { initFromPreferences: vi.fn(() => Promise.resolve()) } }; './stores/canvasStore' and './stores/uiStore' -> minimal surfaces used by main.tsx menu callbacks only (zoomIn/zoomOut/fitToWindow; mouseRegion.peek, setEditorMode).
    4. Do NOT mock './lib/physicPaintBridge' or './stores/timelineStore' — the real install functions and the real store are the subjects under test. With the stubbed window, isTauriRuntime() is false, so all five sibling installs take their browser fallback paths and register listeners on the stubbed window (this is exactly how physicPaintBridge.test.ts exercises them today).
    5. Import main.tsx once via dynamic import (await import('./main')), then flush the startup promise chain: await vi.dynamicImportSettled() plus a macrotask tick, because the editor branch runs inside initTempProjectDir().then(...) and awaits a dynamic themeManager import.
    6. Test A: assert startup completed and the captured listener map has at least one 'message' entry.
    7. Test B: vi.spyOn(timelineStore, 'seek') and vi.spyOn(timelineStore, 'ensureFrameVisible'); invoke EVERY captured 'message' listener with new MessageEvent('message', { data: { type: 'physic-paint:seek-frame', frame: 7 } }); assert seek and ensureFrameVisible were each called with 7. (The sibling listeners' message handlers bail on origin/type mismatch — MessageEvent.origin is '' in Node, which differs from the stubbed origin — so only the frame-sync listener routes this payload.)

    Run the test and confirm the expected RED state: Test A passes, Test B fails specifically on the timelineStore.seek spy never being called (proving the listener is not installed at startup). Commit this failing test as its own atomic commit (test commit; the fix lands in Task 2).
  </action>
  <verify>
    <automated>cd /Users/lmarques/Dev/efx-motion-editor/app && pnpm exec vitest run src/main.test.ts 2>&1; echo "exit=$?" — expect exit != 0 with Test A (startup sanity) passing and Test B failing on the timelineStore.seek spy assertion; any other failure mode (import errors, mock shape errors) means the scaffold is wrong and must be fixed before proceeding</automated>
  </verify>
  <done>app/src/main.test.ts exists, runs under existing vitest configuration, and demonstrates the documented RED state (sanity green, frame-sync routing red on the missing startup install); committed as a test-only atomic commit.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Install installPhysicPaintFrameSyncListener in main.tsx editor startup (GREEN)</name>
  <files>app/src/main.tsx</files>
  <behavior>
    - Test B from Task 1 now passes: the startup-installed listener routes { type: 'physic-paint:seek-frame', frame: 7 } to timelineStore.seek(7) and timelineStore.ensureFrameVisible(7).
    - Existing bridge coverage (app/src/lib/physicPaintBridge.test.ts, including the D-26 frame-sync block at lines 795-836) remains green and untouched.
  </behavior>
  <action>
    Edit app/src/main.tsx with exactly two changes (EDIT-02/B-01 fix; audit-prescribed remedy):
    1. Line 14: add installPhysicPaintFrameSyncListener to the existing named import from './lib/physicPaintBridge', keeping the current alphabetical order (insert after installPhysicPaintApplyListener, before installPhysicPaintRotoAuthorityListener).
    2. Immediately after line 35 (await installPhysicPaintThumbnailEncodeListener();), add a call to installPhysicPaintFrameSyncListener() — it is SYNCHRONOUS (returns the cleanup function directly, not a Promise; see physicPaintBridge.ts:963), so no await. Discard the returned cleanup exactly like the five sibling installs above it: main.tsx holds no cleanup handles today and all six listeners are app-lifetime registrations; this is the existing lifecycle pattern and must not be changed. Add one short comment noting the listener routes physic-paint:seek-frame messages from the standalone window to the editor timeline (consistent with the file's existing comment style).

    Do NOT touch the /physics-paint branch, the menu listeners, the close guard, physicPaintBridge.ts, or any test file. Do NOT start the dev server. Then run the closing gates and commit the fix as a second atomic commit referencing EDIT-02/B-01.
  </action>
  <verify>
    <automated>cd /Users/lmarques/Dev/efx-motion-editor/app && pnpm exec vitest run src/main.test.ts src/lib/physicPaintBridge.test.ts && pnpm run typecheck && pnpm run build</automated>
  </verify>
  <done>Both test files pass under vitest run (Test B green), tsc --noEmit reports zero errors, and pnpm build (tsc + vite build) completes successfully — all with existing configuration only; fix committed atomically on main.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| standalone Physics Paint window -> editor main window | `physic-paint:seek-frame` arrives as a window 'message' event; payload is untrusted cross-window input |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-260729-taj-01 | Tampering/Spoofing | installPhysicPaintFrameSyncListener message handler | medium | mitigate | Existing fail-closed guard: handlePhysicPaintFrameSyncMessage rejects anything failing isPhysicPaintFrameSyncMessage (exact event type plus strict finite non-negative integer frame), so malformed or spoofed payloads never reach timelineStore.seek. This plan only wires the already-tested guard into startup; no validation change. |
| T-260729-taj-02 | Elevation of Privilege | double install causing duplicate seeks | low | accept | Startup installs run exactly once in the initTempProjectDir().then branch; a duplicate seek to the same frame is idempotent in effect. |
</threat_model>

<verification>
- RED proof: Task 1 test run fails only on the missing startup routing assertion.
- GREEN proof: `cd app && pnpm exec vitest run src/main.test.ts src/lib/physicPaintBridge.test.ts` passes.
- `cd app && pnpm run typecheck` passes (tsc --noEmit, zero errors).
- `cd app && pnpm run build` passes (tsc --noEmit && vite build).
- No test configuration changes, no new dependencies, no dev server started, no unrelated files modified (diff limited to app/src/main.tsx and app/src/main.test.ts).
</verification>

<success_criteria>
- main.tsx installs installPhysicPaintFrameSyncListener in the editor startup branch (gap B-01 closed at the exact point the audit identified: main.tsx:31-35 install block).
- Startup regression test proves installation and valid seek-event routing to timelineStore.seek/ensureFrameVisible.
- Targeted vitest, typecheck, and build all green using existing configuration.
- Two atomic commits on main: test (RED) then fix (GREEN).
</success_criteria>

<output>
Create `.planning/quick/260729-taj-close-milestone-audit-gap-edit-02-b-01-i/260729-taj-SUMMARY.md` when done.
</output>
