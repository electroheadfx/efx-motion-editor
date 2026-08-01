---
phase: quick-260801-azb-close-g-01-tauri-frame-sync-listen
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - app/src/lib/physicPaintBridge.ts
  - app/src/main.tsx
  - app/src/main.test.ts
  - app/src/lib/physicPaintBridge.test.ts
autonomous: true
requirements:
  - EDIT-02
  - G-01
  - G-02

estimate:
  tokens: 40000
  raw_tokens: 25000
  tasks: 2
  confidence: low

must_haves:
  truths:
    - "In the native Tauri app, a physic-paint:seek-frame event emitted by the standalone Physics Paint window reaches the editor timeline (seek + ensureFrameVisible)"
    - "The browser-fallback DOM message path keeps working unchanged for development mode"
    - "The startup regression suite (main.test.ts) models the Tauri emit path, so a future removal of the Tauri listen branch fails CI (G-02)"
  artifacts:
    - "app/src/lib/physicPaintBridge.ts — installPhysicPaintFrameSyncListener has an isTauriRuntime() + eventApi.listen('physic-paint:seek-frame', ...) branch mirroring the sibling listeners"
    - "app/src/main.tsx — awaited install call site (signature becomes async)"
    - "app/src/main.test.ts — Tauri-path startup regression coverage"
    - "app/src/lib/physicPaintBridge.test.ts — Tauri-branch unit coverage for the frame-sync listener"
  key_links:
    - "physicsPaintBridgeTransport.ts sendPhysicPaintFrameSyncMessage (Tauri emit/emitTo of literal 'physic-paint:seek-frame') -> eventApi.listen branch in installPhysicPaintFrameSyncListener -> handlePhysicPaintFrameSyncMessage -> timelineStore.seek/ensureFrameVisible"
---

<objective>
Close milestone audit gap G-01 (EDIT-02 partial): the production publisher
`sendPhysicPaintFrameSyncMessage` (app/src/components/physic-paint/bridge/physicsPaintBridgeTransport.ts:7-21)
emits `physic-paint:seek-frame` via Tauri events in native mode and returns early, but the
installed subscriber `installPhysicPaintFrameSyncListener` (app/src/lib/physicPaintBridge.ts:963-970,
installed at app/src/main.tsx:39) only listens for DOM `message` events. Standalone Physics Paint
navigation therefore never seeks the editor timeline in the native app. All five sibling listeners
in the same file already have `isTauriRuntime()` + `eventApi.listen` branches; frame-sync is the
odd one out. G-02: main.test.ts:86-90 only dispatches a DOM MessageEvent, so the defect is
invisible to CI.

Purpose: Restore native-mode frame sync (B-01 reopened in Tauri mode) and lock it with
Tauri-path regression coverage.
Output: Tauri listen branch on the frame-sync listener plus startup-suite and unit-level
Tauri-path tests.
</objective>

<execution_context>
@/Users/lmarques/Dev/efx-motion-editor/.claude/gsd-core/workflows/execute-plan.md
@/Users/lmarques/Dev/efx-motion-editor/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/v0.8.0-MILESTONE-AUDIT.md
@app/src/lib/physicPaintBridge.ts
@app/src/main.tsx
@app/src/main.test.ts
@app/src/lib/physicPaintBridge.test.ts
@app/src/components/physic-paint/bridge/physicsPaintBridgeTransport.ts
@app/src/types/physicPaint.ts
</context>

<tasks>

<task type="tracer">
  <name>Task 1: Add isTauriRuntime() + eventApi.listen branch to installPhysicPaintFrameSyncListener</name>
  <files>app/src/lib/physicPaintBridge.ts, app/src/main.tsx, app/src/lib/physicPaintBridge.test.ts</files>
  <action>
    Mirror the sibling listeners exactly (installPhysicPaintRotoAuthorityListener at
    app/src/lib/physicPaintBridge.ts:933-954 is the closest analog — simple listen + handle,
    no try/catch; do NOT copy the apply listener's try/catch fallback, which is unique to apply).

    1. In app/src/lib/physicPaintBridge.ts, convert `installPhysicPaintFrameSyncListener`
       (currently lines 963-970) to `async`, returning `Promise<() => void>`. Keep the existing
       `target: Window = window` parameter and the entire DOM `message` fallback body unchanged.
    2. As the FIRST statement of the function body, add the Tauri branch:
       `if (isTauriRuntime())`, then `const eventApi = await import('@tauri-apps/api/event');`,
       then `const unlisten = await eventApi.listen?.('physic-paint:seek-frame', (event) => handlePhysicPaintFrameSyncMessage(event.payload));`,
       then `if (unlisten) return unlisten;`.
       Use the literal event name `'physic-paint:seek-frame'` — the publisher
       (physicsPaintBridgeTransport.ts:12-13) emits the literal string and there is no shared
       constant for it; do not introduce a new exported constant and do not touch the publisher.
       `handlePhysicPaintFrameSyncMessage` (lines 956-961) already validates the payload via
       `isPhysicPaintFrameSyncMessage` before calling `timelineStore.seek` /
       `timelineStore.ensureFrameVisible`, so the Tauri payload flows through the exact same
       guard as the DOM path.
    3. In app/src/main.tsx line 39, change `installPhysicPaintFrameSyncListener();` to
       `await installPhysicPaintFrameSyncListener();` (the enclosing callback is already async).
       Reword the stale comment at lines 36-38: it currently claims "Synchronous install" — the
       install is now async like the five sibling installs above it; the discarded cleanup
       handle still matches the app-lifetime pattern.
    4. In app/src/lib/physicPaintBridge.test.ts, the existing browser-path test at line 819
       ('installs a browser message listener for D-26 frame sync and removes it on cleanup')
       calls the installer synchronously at line 828; make the test `async` and `await` the
       call. No other assertion in that test changes.

    Do not refactor any sibling listener, the publisher, or the DOM fallback. Tests run with
    `vitest run` only (never watch mode), from the `app/` directory via pnpm.
  </action>
  <verify>
    <automated>pnpm --dir app exec vitest run src/lib/physicPaintBridge.test.ts src/main.test.ts</automated>
  </verify>
  <done>
    The two focused suites pass: existing browser-path frame-sync tests still green against the
    new async signature, and the frame-sync listener source contains an isTauriRuntime() branch
    calling eventApi.listen with 'physic-paint:seek-frame' before the DOM fallback. main.tsx
    awaits the install.
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Tauri-path regression coverage in the startup suite and bridge unit tests (G-02)</name>
  <files>app/src/main.test.ts, app/src/lib/physicPaintBridge.test.ts</files>
  <behavior>
    - main.test.ts: with `__TAURI_INTERNALS__` present on the stubbed window, startup registers
      a Tauri `listen` handler for the literal event 'physic-paint:seek-frame'; invoking that
      handler with `{ payload: { type: 'physic-paint:seek-frame', frame: 7 } }` calls
      timelineStore.seek exactly once with 7 and ensureFrameVisible exactly once with 7.
    - main.test.ts: in Tauri mode no DOM 'message' listeners are installed by the bridge, so the
      old "at least one window message listener" assertion is replaced by an assertion on the
      captured Tauri registry.
    - physicPaintBridge.test.ts: with `__TAURI_INTERNALS__` defined and a mocked
      '@tauri-apps/api/event' listen, `await installPhysicPaintFrameSyncListener(window)`
      registers the Tauri handler, routes a payload of frame 9 to seek/ensureFrameVisible,
      registers NO DOM 'message' listener, and its cleanup invokes the Tauri unlisten.
    - Both new tests fail if the Task 1 Tauri branch is removed (regression-proof for G-01).
  </behavior>
  <action>
    1. app/src/main.test.ts — model the Tauri emit path in the startup suite:
       a. Add a hoisted registry before the mocks:
          `const tauriListeners = vi.hoisted(() => new Map<string, Array<(event: { payload: unknown }) => unknown>>());`
          (`vi.mock` factories are hoisted; the map must come from `vi.hoisted` to be referenceable.)
       b. Replace the existing `vi.mock('@tauri-apps/api/event', ...)` factory (line 10) so its
          `listen` mock records `(eventName, handler)` pairs into `tauriListeners` and still
          resolves a noop unlisten. This also captures main.tsx's own menu-event listen calls —
          that is fine and expected.
       c. Add `__TAURI_INTERNALS__: {}` to the stubbed window object in `beforeAll` (lines
          35-48). This makes startup exercise the production native path: every sibling bridge
          listener early-returns its Tauri unlisten and installs no DOM listener.
       d. Startup timing: the awaited installs now each perform a dynamic
          `import('@tauri-apps/api/event')`. Keep the existing
          `await vi.dynamicImportSettled(); await new Promise((r) => setTimeout(r, 0));` flush,
          and repeat that pair once more if the seek-frame handler is not yet registered.
       e. Rewrite test 1 (lines 82-84): assert the captured registry contains at least one
          handler for 'physic-paint:seek-frame' (rename the test to describe Tauri listener
          registration). The old messageListeners capture may be removed or left unused-free —
          do not keep a dead assertion.
       f. Rewrite test 2 (lines 86-97) as 'routes a Tauri physic-paint:seek-frame event to the
          editor timeline': fetch handlers from the registry, expect at least one, invoke each
          with `{ payload: { type: 'physic-paint:seek-frame', frame: 7 } }`, then assert seek
          and ensureFrameVisible each called exactly once with 7 (keep frame 7). The browser
          DOM-message startup path is already unit-covered in physicPaintBridge.test.ts (line
          819 test), so replacing — not duplicating — the DOM dispatch is correct here.
    2. app/src/lib/physicPaintBridge.test.ts — add a Tauri-branch unit test after the existing
       browser-path frame-sync test (after line 836), named 'installs a Tauri listen branch for
       D-26 frame sync in native runtime':
       a. Inside the test, capture the listen handler via
          `vi.doMock('@tauri-apps/api/event', ...)` whose `listen` mock stores the handler when
          the event name is 'physic-paint:seek-frame' and returns an `unlisten` spy (precedent
          for this doMock + defineProperty pattern exists at lines 685-714; the bridge imports
          the event API lazily, so in-test doMock is sufficient).
       b. `Object.defineProperty(window, '__TAURI_INTERNALS__', { value: {}, configurable: true })`.
       c. Spy on `window.addEventListener`, `timelineStore.seek`, and
          `timelineStore.ensureFrameVisible`.
       d. `const cleanup = await installPhysicPaintFrameSyncListener(window);` then invoke the
          captured handler with `{ payload: { type: 'physic-paint:seek-frame', frame: 9 } }`.
       e. Assert seek/ensureFrameVisible called with 9; assert addEventListener was NOT called
          with 'message'; call `cleanup()` and assert the unlisten spy ran.
       f. In a `finally`, delete `window.__TAURI_INTERNALS__` and
          `vi.doUnmock('@tauri-apps/api/event')` so sibling tests are unaffected.
    3. Run the focused suites, then the full app suite (vitest run only, never watch).
  </action>
  <verify>
    <automated>pnpm --dir app exec vitest run src/lib/physicPaintBridge.test.ts src/main.test.ts</automated>
  </verify>
  <done>
    Both focused suites pass with the new Tauri-path assertions; the new tests fail if the
    Task 1 listen branch is reverted; the full app suite
    (`pnpm --dir app exec vitest run`) and `pnpm --dir app run typecheck` are green.
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| standalone window -> main window | `physic-paint:seek-frame` Tauri event payload crosses from the Physics Paint child window into the editor main window |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-260801-azb-01 | Tampering | installPhysicPaintFrameSyncListener Tauri payload | low | mitigate | Existing `isPhysicPaintFrameSyncMessage` guard inside `handlePhysicPaintFrameSyncMessage` (physicPaintBridge.ts:956-961) validates the literal type tag and a finite nonnegative integer frame before any timeline mutation; the new Tauri branch routes through the same guard — no new unvalidated surface is introduced. |
| T-260801-azb-02 | Spoofing | cross-window event origin | low | accept | Tauri events are confined to the app's own webviews; the publisher emits only from the Studio window created by the same app. The event seeks the timeline read-only within the already-valid frame range (`timelineStore.seek` clamps), so a forged payload cannot reach outside the editor's own state. |
</threat_model>

<verification>
- Focused: `pnpm --dir app exec vitest run src/lib/physicPaintBridge.test.ts src/main.test.ts`
- Full app suite: `pnpm --dir app exec vitest run`
- Typecheck: `pnpm --dir app run typecheck`
- Regression proof: the new Tauri-path tests fail when the `isTauriRuntime()` listen branch in
  `installPhysicPaintFrameSyncListener` is removed (G-01/G-02 closure).
</verification>

<success_criteria>
- `installPhysicPaintFrameSyncListener` mirrors the sibling listeners: Tauri listen branch first,
  DOM message fallback unchanged, async signature awaited at main.tsx:39.
- Native-mode frame sync is CI-visible: main.test.ts models the Tauri emit path (G-02) and the
  bridge unit suite covers the Tauri branch directly.
- All app tests and typecheck pass; no publisher, sibling listener, or DOM fallback code is
  modified beyond the items listed.
</success_criteria>

<output>
Create `.planning/quick/260801-azb-close-g-01-add-tauri-listen-branch-to-in/260801-azb-SUMMARY.md` when done
</output>
