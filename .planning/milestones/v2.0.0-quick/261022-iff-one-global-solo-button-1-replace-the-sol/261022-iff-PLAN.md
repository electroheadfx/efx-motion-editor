---
phase: quick-261022-iff
plan: 261022-iff
type: execute
wave: 1
depends_on: []
files_modified:
  - app/src/efx-paint/compositor/efxPaintHideSolo.ts
  - app/src/efx-paint/compositor/efxPaintHideSolo.test.ts
  - app/src/efx-paint/compositor/efxPaintCompositeCache.ts
  - app/src/efx-paint/compositor/efxPaintCompositeCache.test.ts
  - app/src/efx-paint/compositor/efxPaintCompositor.ts
  - app/src/efx-paint/compositor/efxPaintCompositor.test.ts
  - app/src/stores/physicPaintStore.ts
  - app/src/stores/physicPaintStore.test.ts
  - app/src/components/physic-paint/view/PhysicsPaintProgramMonitor.tsx
  - app/src/components/physic-paint/view/physicsPaintProgramMonitor.test.ts
  - app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.tsx
  - app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.test.ts
  - app/src/components/physic-paint/view/PhysicsPaintTrackRow.tsx
  - app/src/components/physic-paint/view/PhysicsPaintTrackRow.test.tsx.test.ts
  - app/src/components/physic-paint/view/physicsPaintTrackHeaderColumn.tsx
  - app/src/components/physic-paint/view/physicsPaintTrackHeaderColumn.test.ts
  - app/src/components/physic-paint/view/physicsPaintSoloArm.ts
  - app/src/components/physic-paint/PhysicsPaintStudio.tsx
  - app/src/components/physic-paint/PhysicsPaintStudio.test.ts
  - app/src/components/physic-paint/hooks/useRotoNavigationCoordinator.ts
  - app/src/components/physic-paint/hooks/useRotoCachedPlayback.ts
  - app/src/components/physic-paint/hooks/useRotoCachedPlayback.test.ts
  - app/src/components/physic-paint/hooks/useRotoTimelineActions.ts
  - app/src/components/physic-paint/hooks/useRotoTimelineActions.test.ts
  - app/src/components/physic-paint/view/physicsPaintStudio.css
  - app/src/stores/efxPaintStore.ts
  - app/src/stores/efxPaintStore.test.ts
  - app/src/lib/previewRenderer.ts
  - app/src/lib/previewRenderer.test.ts
  - app/src/components/physic-paint/roto/physicsPaintRotoSoloWindow.ts
  - app/src/components/physic-paint/roto/physicsPaintRotoSoloWindow.test.ts
autonomous: true
requirements:
  - IFF-01
  - IFF-02
  - IFF-03
  - IFF-04
  - IFF-05

estimate:
  tokens: 68000
  raw_tokens: 48000
  tasks: 3
  confidence: low            # zero calibration samples for this quick-task class; three ordered seams, each independently verifiable

must_haves:
  truths:
    - "No solo armed: every Paint track with visible !== false participates in the composite; hidden tracks never do."
    - "Solo armed: only the document's active (selected) track participates; selecting another track while armed moves the focus with no button click (D-04), because the target is read from activeTrackId at composite time."
    - "Hide always wins over solo: when the solo target is hidden, the composite has no Paint track; unhiding restores it (D-04)."
    - "Clicking the Focus button again or pressing Escape exits solo; Escape exits solo before collapsing the rail selection (existing layered dispatcher, unchanged)."
    - "Track rows render no per-track S chip and carry no solo props; the persisted document solo flag is inert (no UI writes it, no participation path reads it)."
    - "The Focus button keeps the same playback-pill slot, Focus icon, nav-button classes, .active armed treatment, aria-pressed and guarded-disabled shape; only its label, tooltip, disabled law and capsule line change."
    - "Arming solo opens no playback window and changes no playback frame enumeration; the retired rail-solo playback window and content-start ports are gone."
    - "The session focus applies to the Studio program monitor only: export preflight, export rendering and the main preview keep participatingPaintTracks(document) with no solo target."
  artifacts:
    - app/src/efx-paint/compositor/efxPaintHideSolo.ts
    - app/src/efx-paint/compositor/efxPaintCompositeCache.ts
    - app/src/efx-paint/compositor/efxPaintCompositor.ts
    - app/src/stores/physicPaintStore.ts
    - app/src/components/physic-paint/view/PhysicsPaintProgramMonitor.tsx
    - app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.tsx
    - app/src/components/physic-paint/view/PhysicsPaintTrackRow.tsx
    - app/src/components/physic-paint/view/physicsPaintTrackHeaderColumn.tsx
    - app/src/components/physic-paint/view/physicsPaintSoloArm.ts
  key_links:
    - "ONE participation authority: participatingPaintTracks(document, soloTrackId) is extended in place; the compositor, the flattened cache key and the store all consume that same function — no view-side track filtering and no second truth table."
    - "The monitor passes its solo target into the store; the store threads it into the cache key and the compositor ports. The session arm never writes the document, so no save, undo, revision or cross-realm sync term changes."
    - "ONE solo state: physicsPaintSoloArm.ts stays the only arm; no second signal and no document flag. The target is never stored (selection-followed), so arm + activeTrackId fully determine participation."
    - "Export and the main preview call participatingPaintTracks(document) with no target, so the session focus cannot leak into rendered output or the main window."
    - "The document `solo` field, its parser key and its revision terms stay untouched (the parser accepts an exact member set; removing the key would reject every previously saved document). It is simply never read for participation."
---

<objective>
Implement the five locked quick items as ONE global Solo (IFF-01..05):

1. **Replace the rail-solo button's meaning (IFF-01)** — the Focus-icon nav-button in the playback pill becomes the global track Solo. Same slot, same icon, same `.active` armed treatment; new label, tooltip and disabled law (a track, not a rail selection, is required).
2. **Armed = only the selected track is visible (IFF-02, D-04)** — while armed, only the document's active track participates in the Studio composite. Click again or Escape exits.
3. **Solo follows selection while armed (IFF-03)** — the arm stores no target; the active track id is read at composite time, so selecting B while armed moves the focus to B without touching the button.
4. **Remove the per-track S chip (IFF-04)** — the row chip, its props, its controller route and its store setter go; the persisted document `solo` field stays parseable but inert.
5. **Hide wins over solo (IFF-05)** — a hidden track never participates; a hidden solo target produces no Paint track in the composite.

Purpose: one solo concept. Today two unrelated mechanisms share the word: a session rail-playback window on the pill button and a persisted per-track document flag behind each row's S chip. This quick retires both meanings and leaves one session-only visibility focus keyed on the selected track.

Output: an extended pure truth table plus cache/compositor/store threading, the monitor supplying the target, a repurposed pill button and capsule line, row and controller solo removal, and the rail-solo playback window deleted end-to-end. Three live UAT rows pin the user-visible law.

**Scope fences:** no new dependencies; no dev-server runs; no pushes; atomic local commits; Preact + @preact/signals only (no useState); vitest `run` only (never watch); `pnpm --dir app typecheck` is a comparative gate against a baseline recorded before editing. The session focus is monitor-only by design: export and the main preview must keep rendering every visible track.
</objective>

<execution_context>
@/Users/lmarques/Dev/efx-motion-editor/.claude/gsd-core/workflows/execute-plan.md
@/Users/lmarques/Dev/efx-motion-editor/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@./CLAUDE.md

Read before editing (verified in the live tree on 2026-10-22):
- `app/src/efx-paint/compositor/efxPaintHideSolo.ts` (30-43) — the pure hide/solo truth table, today reading `track.solo`.
- `app/src/efx-paint/compositor/efxPaintCompositeCache.ts` (104-135) — flattened key derivation; `participatingPaintTracks(document)` at 118; the `excl:` term precedent at 132-135.
- `app/src/efx-paint/compositor/efxPaintCompositor.ts` (143-231, 276) — `EfxPaintCompositorPorts`, `compositeFrame`, `participatingPaintTracks(document)`; `excludeTrackIds` on ports is the precedent for a new optional port.
- `app/src/stores/physicPaintStore.ts` (2733-2841 `_resolveFlattenedFrame`; 2992-3011 the two public methods; 1831-1849 `prefetchNeighborFrames`).
- `app/src/components/physic-paint/view/PhysicsPaintProgramMonitor.tsx` (139-215 draw effect; 229-263 missing-source effect; props 71-108).
- `app/src/components/physic-paint/view/physicsPaintSoloArm.ts` (1-46) — the session-only arm; `isSoloArmed`, `toggleSolo`, `disarmSolo`; the doc still describes a rail playback window.
- `app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.tsx` (1177-1207 the pill button; 2345-2365 the arm/disabled derivation; 3528-3585 the capsule line; 469-470 and 1901-1908 the row S route).
- `app/src/components/physic-paint/view/PhysicsPaintTrackRow.tsx` (773-794 props; 984-1000 the S chip JSX).
- `app/src/components/physic-paint/view/physicsPaintTrackHeaderColumn.tsx` (58-59, 188-199).
- `app/src/components/physic-paint/PhysicsPaintStudio.tsx` (2347-2470 `resolveSessionSoloWindow` + `getSoloWindow` + `getSoloContentStart`; 5098-5107 `handleToggleSolo`; 5135-5195 the row bundle; 4915-4960 the program-monitor memo incl. `engineSurfaceHidden`).
- `app/src/components/physic-paint/hooks/useRotoNavigationCoordinator.ts` (86-105 the solo window branch).
- `app/src/components/physic-paint/hooks/useRotoCachedPlayback.ts` (195-212 the solo content start and start index).
- `app/src/components/physic-paint/roto/physicsPaintRotoSoloWindow.ts` — the rail-window derivation to delete.
- `app/src/components/physic-paint/view/physicsPaintStudioKeyboard.ts` (256-262) — the Escape disarm layer; NO change required.
- `app/src/lib/previewRenderer.ts` (95-118) — the legacy active-track visibility predicate reading `track.solo`.
- `app/src/stores/efxPaintStore.ts` (193, 286, 374-381) — factory, source copy, `setTrackSolo`.
- `app/src/efx-paint/document/efxPaintDocumentParsers.ts` (69, 238-288) — exact-key parsing; do NOT change the accepted key set.
- `app/src/components/physic-paint/physicsPaintStudio.css` (2625-2633 pill armed; 5491-5533 and 5607-5634 row S rules; 6611 stale comment).
- Test collection: `app/vitest.config.ts` collects only `src/**/*.test.ts` (plus the efx-paint-host package). `.test.tsx` files are not collected; the collected sibling for the row is `PhysicsPaintTrackRow.test.tsx.test.ts`.
</context>

<tasks>

<!-- Literals named by implementation instructions and negative gates appear below; allow them. -->
<!-- planner-discipline-allow: LIT -->

<task type="tracer">
  <name>Task 1: Session solo target end-to-end — truth table, cache, compositor, store, monitor</name>
  <files>
    app/src/efx-paint/compositor/efxPaintHideSolo.ts
    app/src/efx-paint/compositor/efxPaintHideSolo.test.ts
    app/src/efx-paint/compositor/efxPaintCompositeCache.ts
    app/src/efx-paint/compositor/efxPaintCompositeCache.test.ts
    app/src/efx-paint/compositor/efxPaintCompositor.ts
    app/src/efx-paint/compositor/efxPaintCompositor.test.ts
    app/src/stores/physicPaintStore.ts
    app/src/stores/physicPaintStore.test.ts
    app/src/components/physic-paint/view/PhysicsPaintProgramMonitor.tsx
    app/src/components/physic-paint/view/physicsPaintProgramMonitor.test.ts
  </files>
  <behavior>
    Step 0: record the typecheck baseline before editing:
    `pnpm --dir app typecheck > /tmp/iff-typecheck-baseline.txt 2>&1; grep -c 'error TS' /tmp/iff-typecheck-baseline.txt`

    RED first — `efxPaintHideSolo.test.ts`, new truth-table cases (write these before touching the source):
    - `participatingPaintTracks(doc, 'track-a')` with visible a and b returns exactly `['track-a']`.
    - `participatingPaintTracks(doc, 'track-b')` where b has `visible: false` returns `[]` — a hidden solo target means nothing participates (hide wins, D-04).
    - `participatingPaintTracks(doc, 'track-a')` where an unrelated track carries `solo: true` returns exactly `['track-a']` — the persisted flag is inert.
    - `participatingPaintTracks(doc, 'not-a-track')` returns `[]` (fail closed).
    - `participatingPaintTracks(doc)` and `participatingPaintTracks(doc, null)` return every visible track in order (byte-identical to the pre-change result).
    - Background participation is still governed only by `background.visible` and is unaffected by the target.
    - Order ties still break by track.id localeCompare.

    RED first — `efxPaintCompositeCache.test.ts`:
    - The same document with `soloTrackId: 'track-a'` and without produces different flattened keys.
    - With `soloTrackId: 'track-a'`, a content-revision change on track b does NOT rotate the key (b is not participating), while a change on a DOES.
    - Omitted and explicit-null `soloTrackId` produce byte-identical keys to the pre-change derivation (disarmed regression).

    RED first — `efxPaintCompositor.test.ts`:
    - With `ports.soloTrackId` set to track b's id, `resolveTrackContent` is requested only for b and the drawn result contains only b's contribution; with the port absent the untouched behavior is unchanged.

    RED first — `physicsPaintProgramMonitor.test.ts`:
    - After arming the session arm and rendering with `activeTrackId: 'track-a'`, the playback path calls `getFlattenedFrame(FLAT_LAYER, frame, false, 'track-a')`.
    - With `excludeActive: true`, it calls `getFlattenedFrameExcluding(FLAT_LAYER, frame, Set{'track-a'}, false, liveOverlayOrNull, 'track-a')`.
    - Disarmed, both calls carry a final `null` target and the existing behavior is unchanged.
    - The arm is module-global: call `disarmSolo()` in beforeEach/afterEach so each case starts disarmed.

    The existing store flattened tests must stay green; extend them with one case proving `getFlattenedFrame(layer, frame, true, 'track-b')` differs in `cacheKey` from the un-targeted call and that `getFlattenedFrameExcluding(..., 'track-b')` with the target excluded yields an empty-track composite.
  </behavior>
  <action>
    1. `efxPaintHideSolo.ts` — extend the one participation authority (key link): `participatingPaintTracks(document, soloTrackId: string | null = null)`. Keep the existing sort. Filter rule: a track with `visible === false` never participates; when `soloTrackId` is non-null, participate only when `track.id === soloTrackId`; otherwise every visible track participates. Delete the `track.solo` arming and filtering entirely. Update the module doc to state that the arm is session-only and selection-followed (the target is the active track), that hide wins, and that the persisted `track.solo` flag is retained in the wire schema but never read here. `backgroundParticipates` is unchanged.

    2. `efxPaintCompositeCache.ts` — add `readonly soloTrackId?: string | null` to `EfxPaintFlattenedCacheKeyInput`. Pass it to `participatingPaintTracks(document, input.soloTrackId ?? null)` at the participating-ids computation. Add a canonical `solo:` term to the source list ONLY when the target is non-null (use `encodeCanonicalString`; follow the `excl:` only-when-present precedent) so disarmed keys stay byte-identical. Extend the header comment: the session target is a key term because the document config hash cannot see it.

    3. `efxPaintCompositor.ts` — add `readonly soloTrackId?: string | null` to `EfxPaintCompositorPorts` with a short doc. Pass `soloTrackId: ports.soloTrackId ?? null` into the `deriveEfxPaintFlattenedCacheKey` call inside `compositeFrame`, and change the draw participation to `participatingPaintTracks(document, ports.soloTrackId ?? null)`.

    4. `physicPaintStore.ts` — `_resolveFlattenedFrame` gains a final `soloTrackId: string | null = null` parameter. Use it at the participating computation (line ~2751), in the `deriveEfxPaintFlattenedCacheKey` input, and in the compositor ports object. Public API: `getFlattenedFrame(layerId, frame, includeFond = true, soloTrackId: string | null = null)` passes it through; `getFlattenedFrameExcluding(..., liveOverlay?, soloTrackId: string | null = null)` passes it through as the sixth argument. Update both doc blocks: the target is a session focus supplied by the caller, never a document write. Do not touch `prefetchNeighborFrames` (prefetching extra tracks stays harmless).

    5. `PhysicsPaintProgramMonitor.tsx` — import `isSoloArmed` from `./physicsPaintSoloArm`. In the component render body compute `const soloTrackId = isSoloArmed() ? (props.activeTrackId ?? null) : null;` (a narrow subscribing read; no render-body writes). Pass it as the fourth argument in every `getFlattenedFrame` call and the sixth in every `getFlattenedFrameExcluding` call — BOTH the draw effect (139-215) and the missing-source effect (229-263), so the capsule report covers only the focused track. Add `soloTrackId` to both effect dep arrays. Update the header comment: solo is the session track focus, applied by the store, never by this component.

    6. Keep the rail playback behavior untouched in this task. Do not touch the button copy, the S chip, or the Studio solo-window ports yet.

    Preact rules: signal `.value` reads live in the leaf render body / dep arrays (the established `physicPaintVersion.value` pattern); no effect writes to signals; no new useState.
  </action>
  <verify>
    <automated>pnpm --dir app exec vitest run src/efx-paint/compositor/efxPaintHideSolo.test.ts src/efx-paint/compositor/efxPaintCompositeCache.test.ts src/efx-paint/compositor/efxPaintCompositor.test.ts src/stores/physicPaintStore.test.ts src/components/physic-paint/view/physicsPaintProgramMonitor.test.ts</automated>
    <automated>grep -q 'soloTrackId' app/src/efx-paint/compositor/efxPaintHideSolo.ts && grep -q 'soloTrackId' app/src/efx-paint/compositor/efxPaintCompositeCache.ts && grep -q 'soloTrackId' app/src/efx-paint/compositor/efxPaintCompositor.ts && grep -q 'soloTrackId' app/src/stores/physicPaintStore.ts && grep -q 'soloTrackId' app/src/components/physic-paint/view/PhysicsPaintProgramMonitor.tsx</automated>
    <automated>test "$(grep -v '^[[:space:]]*\*' app/src/efx-paint/compositor/efxPaintHideSolo.ts | grep -c 'track\.solo')" -eq 0</automated>
    <automated>pnpm --dir app typecheck > /tmp/iff-typecheck-task1.txt 2>&1; test "$(grep -c 'error TS' /tmp/iff-typecheck-task1.txt)" -le "$(grep -c 'error TS' /tmp/iff-typecheck-baseline.txt)"</automated>
  </verify>
  <done>
    The pure truth table takes an optional session target, ignores the persisted `solo` flag, fails closed on an unknown target and lets hide win. The flattened cache key carries the target term only when armed and drops non-participating content terms. The compositor draws only the target through an optional port. The store exposes the target on both flattened APIs and threads it to the key and the compositor. The monitor reads the arm and supplies the active track in both the draw and missing-source paths. All listed suites are green; typecheck shows no new errors versus the recorded baseline.
  </done>
</task>

<task type="auto">
  <name>Task 2: Rebrand the pill button, remove the row S chip and retire doc-solo from runtime reads</name>
  <files>
    app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.tsx
    app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.test.ts
    app/src/components/physic-paint/view/PhysicsPaintTrackRow.tsx
    app/src/components/physic-paint/view/PhysicsPaintTrackRow.test.tsx.test.ts
    app/src/components/physic-paint/view/physicsPaintTrackHeaderColumn.tsx
    app/src/components/physic-paint/view/physicsPaintTrackHeaderColumn.test.ts
    app/src/components/physic-paint/view/physicsPaintSoloArm.ts
    app/src/components/physic-paint/PhysicsPaintStudio.tsx
    app/src/components/physic-paint/PhysicsPaintStudio.test.ts
    app/src/stores/efxPaintStore.ts
    app/src/stores/efxPaintStore.test.ts
    app/src/lib/previewRenderer.ts
    app/src/lib/previewRenderer.test.ts
    app/src/components/physic-paint/physicsPaintStudio.css
  </files>
  <behavior>
    - The pill button keeps its position after the Loop toggle and before the audio-preview toggle, keeps the Focus icon, `physics-paint-nav-button physics-paint-roto-solo-toggle` plus `${props.soloArmedClass}`, `aria-pressed`, `aria-disabled`, the `toggleSolo()` call and the unconditional `disarmPushTool()`.
    - Its aria-label is exactly `Solo selected track`; the disarmed tooltip is `Solo the selected track - show only its content. Click again or press Escape to exit.`; the armed tooltip is `Exit solo.`
    - Its disabled law is `keyUtilitiesDisabledByBusyState || !props.activeTrackId`; the only guard reason is `Select a Track to solo.`; `hasAnyRailSelection` is deleted.
    - The armed capsule line reads `Solo - {active track name}.` and derives only from the arm + `props.activeTrackId` + `props.tracks`; no rail-set members, no frame ranges.
    - Track rows render grip, eye, blend, name and trash — no S chip, no `physics-paint-track-row-solo` class, no solo props.
    - The persisted document `solo` field still parses and serializes (exact-key parser untouched); no production path reads it for participation or visibility, and no production code calls `setTrackSolo`.
    - `resolvePhysicPaintTrackVisibility(layerId, trackId)` is hide-only: true exactly when the track exists and `visible !== false`. A lingering document `solo: true` neither hides nor shows anything.
  </behavior>
  <action>
    1. `PhysicsPaintWorkflowStrip.tsx` — update the pill button (1177-1207): aria-label, both tooltip branches and the disabled reason to the exact strings above. Change the disabled derivation (2345-2365) to `keyUtilitiesDisabledByBusyState || !props.activeTrackId`, delete `hasAnyRailSelection`, and keep `ROTO_KEY_BUSY_STATUS_TEMPLATE` for the busy case. Keep the Focus icon, classes, aria-pressed, aria-disabled/aria-describedby plumbing, `disarmPushTool()` and `toggleSolo()`. Update the surrounding comments: the arm is the global track focus; it never opens a playback window.

    2. `PhysicsPaintWorkflowStrip.tsx` — rewrite `soloCapsuleLine` (3528-3585): when `soloArmed` is false return null; otherwise find the track whose id equals `props.activeTrackId` in `props.tracks` and return the string `Solo - ${track.name}.`; return null when the track is absent. Delete the rail-set member derivation and the `buildRailSetSoloCopy` import from this file. Keep the `soloLine` argument to `getRotoStatusCapsuleViewModel` (the presentation precedence law is unchanged).

    3. `PhysicsPaintWorkflowStrip.tsx` — delete the `onToggleSolo` prop (469-470) and the `handleToggleSolo` route (1901-1908); stop passing `onToggleSolo`/`solo` to the header column.

    4. `PhysicsPaintTrackRow.tsx` — delete the S chip JSX (984-1000), the `solo` and `onToggleSolo` props and their destructured defaults, and the comments that describe the chip. Leave grip, eye, blend, name, trash and the reorder gesture untouched.

    5. `physicsPaintTrackHeaderColumn.tsx` — delete the `onToggleSolo` prop and its doc, stop passing `solo={track.solo}`, and update the header comment that lists the row controls.

    6. `PhysicsPaintStudio.tsx` — delete `handleToggleSolo` (5098-5107), the `setTrackSolo` import, and every `onToggleSolo` entry in the three `multiTrackRowBundle` return shapes. Do not change any other row-bundle key.

    7. `efxPaintStore.ts` — delete `setTrackSolo` (374-381). Leave the `solo` field in the document type, factory init, source-copy mapping, parsers and revision terms untouched: the parser accepts an exact key set, so dropping the key would reject every previously saved document. Add a one-line comment where the field is declared: retained for wire compatibility, inert (the global Solo is session-only).

    8. `previewRenderer.ts` — rewrite `resolvePhysicPaintTrackVisibility` (95-118) to the hide-only law described in the behavior block and update its doc: it is the ACTIVE-track predicate; the session Solo target is the active track, so solo can never hide it, and stale document solo flags are inert. Both Studio call sites (3278 and 4934) keep their current arguments.

    9. `physicsPaintSoloArm.ts` — rewrite the module doc: one session-only global track focus, selection-followed, never persisted, never opens a playback window, and Escape/re-click disarm. No behavior change; keep `isSoloArmed`, `toggleSolo`, `disarmSolo` and their return contracts.

    10. `physicsPaintStudio.css` — delete the `.physics-paint-track-row-solo` rules and the active-header solo compound rules (5491-5533, 5607-5634); update the stale `non-soloed under solo` comments (6611 and the view header comment in `PhysicsPaintStudioView.tsx` line ~59) to "hidden".

    11. Tests — update `PhysicsPaintWorkflowStrip.test.ts`: the new label and tooltips, the new disabled reason, and the capsule derivation; assert the retired copy is absent using a split literal so the old phrase is never written contiguously. Update `physicsPaintTrackHeaderColumn.test.ts` and `PhysicsPaintTrackRow.test.tsx.test.ts`: control order becomes grip, eye, blend, name, trash; assert no `physics-paint-track-row-solo` node and no solo click route. Update `PhysicsPaintStudio.test.ts`: the row bundle has no solo route and `setTrackSolo` no longer appears. Remove the `setTrackSolo` cases from `efxPaintStore.test.ts` (import, armed/disarmed case, unknown-track case). Update `previewRenderer.test.ts`: hide-only cases plus an explicit assertion that `solo: true` on a visible track leaves it visible and an unknown track is hidden. Keep `physicsPaintStudioKeyboard.test.ts` green unchanged — the Escape disarm layer must still run before selection collapse.

    Do not touch the rail-solo playback window in this task; Task 3 removes it.
  </action>
  <verify>
    <automated>pnpm --dir app exec vitest run src/components/physic-paint/view/PhysicsPaintWorkflowStrip.test.ts src/components/physic-paint/view/physicsPaintTrackHeaderColumn.test.ts src/components/physic-paint/view/PhysicsPaintTrackRow.test.tsx.test.ts src/components/physic-paint/PhysicsPaintStudio.test.ts src/components/physic-paint/view/physicsPaintStudioKeyboard.test.ts src/stores/efxPaintStore.test.ts src/lib/previewRenderer.test.ts</automated>
    <automated>test "$(grep -rn 'onToggleSolo' app/src --include='*.ts' --include='*.tsx' | grep -v '\.test\.' | wc -l | tr -d ' ')" -eq 0</automated>
    <automated>test "$(grep -rn 'physics-paint-track-row-solo' app/src/components/physic-paint/view/PhysicsPaintTrackRow.tsx app/src/components/physic-paint/view/physicsPaintTrackHeaderColumn.tsx app/src/components/physic-paint/physicsPaintStudio.css | wc -l | tr -d ' ')" -eq 0</automated>
    <automated>test "$(grep -rn 'setTrackSolo' app/src --include='*.ts' --include='*.tsx' | grep -v '\.test\.' | wc -l | tr -d ' ')" -eq 0</automated>
    <automated>grep -q 'Solo selected track' app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.tsx && grep -q 'Solo - ' app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.tsx</automated>
    <automated>pnpm --dir app typecheck > /tmp/iff-typecheck-task2.txt 2>&1; test "$(grep -c 'error TS' /tmp/iff-typecheck-task2.txt)" -le "$(grep -c 'error TS' /tmp/iff-typecheck-baseline.txt)"</automated>
  </verify>
  <done>
    The pill button is the global Solo (same slot, Focus icon, new label/tooltips, track-based disabled law), the capsule reports the focused track, and no track row renders an S chip or carries solo wiring. The persisted solo field still parses but is read nowhere for runtime behavior, `setTrackSolo` is gone, and the Escape layer still disarms solo before collapsing the selection. All listed suites green; no new typecheck errors.
  </done>
</task>

<task type="auto">
  <name>Task 3: Delete the retired rail-solo playback window and content-start ports</name>
  <files>
    app/src/components/physic-paint/PhysicsPaintStudio.tsx
    app/src/components/physic-paint/PhysicsPaintStudio.test.ts
    app/src/components/physic-paint/hooks/useRotoNavigationCoordinator.ts
    app/src/components/physic-paint/hooks/useRotoCachedPlayback.ts
    app/src/components/physic-paint/hooks/useRotoCachedPlayback.test.ts
    app/src/components/physic-paint/hooks/useRotoTimelineActions.ts
    app/src/components/physic-paint/hooks/useRotoTimelineActions.test.ts
    app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.tsx
    app/src/components/physic-paint/roto/physicsPaintRotoSoloWindow.ts
    app/src/components/physic-paint/roto/physicsPaintRotoSoloWindow.test.ts
  </files>
  <behavior>
    - Arming the global Solo changes no playback behavior: the playback frame list is the full composite range, Play still re-anchors at the current cursor, and loop wrap returns to the cursor start.
    - The Studio no longer supplies a solo window or solo content start to the playback ports; no production source mentions the removed window derivation.
    - The rail-set solo copy helper is gone; the capsule's persistent solo line remains the track-focus line from Task 2.
    - The deleted module and its test no longer exist; no import of `physicsPaintRotoSoloWindow` remains anywhere under `app/src`.
  </behavior>
  <action>
    1. `PhysicsPaintStudio.tsx` — delete `resolveSessionSoloWindow` (2347-2373) and its comment, the `getSoloWindow` port (2439-2441), and the `getSoloContentStart` port (2442-2470). Delete the `deriveSoloContentStart`/`deriveSoloPlaybackWindow`/`SoloPlaybackWindow` import (line 90) and any import or local that becomes unused. Keep `getEndFrame`, `getFrame` and `getCurrentAppFrame` exactly as they are.

    2. `useRotoNavigationCoordinator.ts` — delete the optional `getSoloWindow` and `getSoloContentStart` fields from the playback input and the solo branch inside the `getFrames` callback (86-105). The callback becomes the plain array build over `playbackEndFrame` (one entry per appFrame with `frame: input.playback.getFrame(appFrame)`). Delete the `SoloPlaybackWindow` type import and the pass-through at 116.

    3. `useRotoCachedPlayback.ts` — delete the optional `getSoloContentStart` field (49-52), the `resolvePlaybackStartIndex` import, and the solo start block (198-207). Preserve the play-from-cursor law byte-for-byte: `startIndex` is the index of `cursorAppFrame` in `cachedFrames`, falling back to 0; assign it to both `frameIndexRef.current` and `loopStartIndexRef.current`. Update the surrounding comments to describe the single start law.

    4. Delete `app/src/components/physic-paint/roto/physicsPaintRotoSoloWindow.ts` and `physicsPaintRotoSoloWindow.test.ts`.

    5. `useRotoTimelineActions.ts` — delete `buildRailSetSoloCopy` (1060) and any local it alone used. Remove the `buildRailSetSoloCopy` import from `PhysicsPaintWorkflowStrip.tsx` if Task 2 did not already remove it, and drop imports that become unused. Do not remove `RailSetCopyMember` or other rail-set copy helpers that remain used.

    6. Tests — `PhysicsPaintStudio.test.ts`: delete the solo-window source pins (751-791) and add one pin that the Studio source contains no solo window/content-start port. `useRotoCachedPlayback.test.ts`: delete the solo harness factory and the solo-window/solo-content-start cases; keep and re-run the play-from-cursor and loop-wrap cases. `useRotoTimelineActions.test.ts`: delete the `buildRailSetSoloCopy` import and its four cases. `physicsPaintWorkflowPresentation.test.ts`: keep the generic `soloLine` precedence cases unchanged (they assert string projection, not the retired helper).

    Commit as one atomic change; do not reformat unrelated code.
  </action>
  <verify>
    <automated>test ! -e app/src/components/physic-paint/roto/physicsPaintRotoSoloWindow.ts && test ! -e app/src/components/physic-paint/roto/physicsPaintRotoSoloWindow.test.ts</automated>
    <automated>test "$(grep -rn 'physicsPaintRotoSoloWindow\|getSoloWindow\|getSoloContentStart\|buildRailSetSoloCopy' app/src --include='*.ts' --include='*.tsx' | grep -v '\.test\.' | wc -l | tr -d ' ')" -eq 0</automated>
    <automated>pnpm --dir app exec vitest run src/components/physic-paint/PhysicsPaintStudio.test.ts src/components/physic-paint/hooks/useRotoCachedPlayback.test.ts src/components/physic-paint/hooks/useRotoTimelineActions.test.ts src/components/physic-paint/view/physicsPaintWorkflowPresentation.test.ts src/components/physic-paint/view/PhysicsPaintWorkflowStrip.test.ts</automated>
    <automated>pnpm --dir app typecheck > /tmp/iff-typecheck-task3.txt 2>&1; test "$(grep -c 'error TS' /tmp/iff-typecheck-task3.txt)" -le "$(grep -c 'error TS' /tmp/iff-typecheck-baseline.txt)"</automated>
  </verify>
  <done>
    The rail-solo playback window is deleted end-to-end: no Studio port, no navigation-coordinator branch, no cached-playback content start, no derivation module or test, no rail-set solo copy helper. Arming the global Solo cannot alter the playback frame list or start index. All listed suites green; no new typecheck errors.
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| document wire / package load → parser | Previously saved documents carry the persisted `solo` flag; the exact-key parser is the boundary that must keep accepting them. |
| session arm → composite path | The arm is local UI state; it must not reach persisted state, export, or the main preview (no data crosses a trust boundary in either direction). |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-iff-01 | Tampering | `efxPaintDocumentParsers.ts` exact key set | high | mitigate | Do not remove `solo` from `TRACK_KEYS`, the track type or the revision terms; Task 2 keeps the field parseable and inert so no existing `.mce` document is rejected. |
| T-iff-02 | Denial of service | stale `track.solo: true` in a reopened document | medium | mitigate | The truth table and the active-track predicate stop reading `track.solo` entirely (Tasks 1-2), so a lingering flag cannot blank the composite or hide the active track. |
| T-iff-03 | Information disclosure / scope leak | session focus reaching export or the main preview | medium | mitigate | Only the program monitor supplies `soloTrackId`; export preflight and the main preview call `participatingPaintTracks(document)` with no target (pinned by the Task 1 key-link and existing call sites left untouched). |
| T-iff-SC | Tampering | npm/pnpm installs | high | mitigate | No package installs in this quick; if an install is ever added, the package-legitimacy gate and a blocking human checkpoint apply. |
</threat_model>

<verification>
Automated (run from the repo root, after all three tasks):
- `pnpm --dir app exec vitest run src/efx-paint/compositor src/stores/physicPaintStore.test.ts src/stores/efxPaintStore.test.ts src/lib/previewRenderer.test.ts src/components/physic-paint/view src/components/physic-paint/hooks`
- `pnpm --dir app typecheck` compared against `/tmp/iff-typecheck-baseline.txt` (no new errors).
- Source gates: no `onToggleSolo`, `setTrackSolo`, `physics-paint-track-row-solo`, `getSoloWindow`, `getSoloContentStart`, `buildRailSetSoloCopy` or `physicsPaintRotoSoloWindow` in production sources; the deleted module files are absent.

Live UAT (the user runs these; the work is automated-ready, not done, until they pass):
1. Two Paint tracks with content, no solo armed — both tracks' paint appears in the Studio program monitor.
2. Arm Solo on track A (Focus button) — only A is visible. Click track B's row (or one of B's rails) — only B is visible, with the button untouched and still armed. Click the Focus button again, or press Escape, with a rail selected — solo disarms first and both tracks return.
3. Hide the currently soloed track (eye) while solo is armed — nothing from it appears; show it again and it returns. Confirm a hidden non-selected track never appears.

Regression checks folded into the rows: the main preview after closing the Studio and an export of the same window still contain every visible track.
</verification>

<success_criteria>
- Exactly one solo concept: the session arm in `physicsPaintSoloArm.ts`, selection-followed, monitor-scoped, escaped/re-clicked off.
- `participatingPaintTracks(document, soloTrackId)` is the single participation authority; hide wins; unknown target fails closed; the persisted flag is inert.
- No per-track S chip and no `setTrackSolo`; the document field remains parseable for wire compatibility.
- No rail-solo playback window, navigation clamp or content-start anchor remains.
- All targeted suites green; no new typecheck errors; three live UAT rows pass before "done" is claimed.
</success_criteria>

<output>
Create `.planning/quick/261022-iff-one-global-solo-button-1-replace-the-sol/261022-iff-SUMMARY.md` when done.
</output>
