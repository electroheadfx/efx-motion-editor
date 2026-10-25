---
phase: quick-261025-awl
plan: 261025-awl
type: execute
wave: 1
depends_on: []
files_modified:
  - app/src/components/physic-paint/view/aquarelleRecordState.ts
  - app/src/components/physic-paint/view/aquarelleRecordState.purge.test.ts
  - app/src/components/physic-paint/view/frameScriptOwnership.ts
  - app/src/components/physic-paint/view/frameScriptOwnership.test.ts
  - app/src/components/shared/frameModuleLock.ts
  - app/src/components/shared/frameModuleLock.test.ts
  - app/src/components/shared/ModuleSwitcher.tsx
  - app/src/components/shared/ModuleSwitcher.test.tsx
  - app/src/components/physic-paint/view/PhysicsPaintTopBar.tsx
  - app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.tsx
  - app/src/components/physic-paint/physicsPaintStudio.css
  - app/src/components/physic-paint/view/brushScriptEditionPort.ts
  - app/src/components/physic-paint/view/brushScriptEditionPort.test.ts
  - app/src/components/physic-paint/view/rasterKeyPresentation.ts
  - app/src/components/physic-paint/view/rasterKeyPresentation.test.ts
  - app/src/components/physic-paint/view/rasterKeyStripWiring.test.ts
  - app/src/components/physic-paint/PhysicsPaintStudio.tsx
  - app/src/components/physic-paint/PhysicsPaintStudio.test.ts
  - packages/efx-physic-paint/src/engine/EfxPaintEngine.attachBaseline.test.ts
autonomous: true
requirements: []
estimate:
  tokens: 70000
  raw_tokens: 70000
  tasks: 3
  confidence: low
must_haves:
  truths:
    - "An explicit frame selection (timeline key click, frame-step buttons, ruler scrub release, Studio launch settle, track switch) switches activeModule to the frame's single script owner; a frame with both scripts or no script leaves activeModule unchanged; cached playback and mid-drag scrubs never switch it (D-02)."
    - "Inside the Studio the non-owning module slot is locked (aria-disabled, muted styling, tooltip naming the owner and the Raster remedy) while the owning slot stays enabled; the main-window Toolbar switcher stays fully enabled because it never receives a locked module (D-03)."
    - "A Raster button sits immediately before the Tools button in the timeline header, shows a Lucide Stamp icon plus the label Raster, is disabled with an explanatory reason whenever the live key has no script or an operation is in flight, and opens a Cancel-first confirmation (D-04)."
    - "Confirming Raster purges both script stores for the key with the exact Memory-tab per-key semantics plus snapshot cleanup, keeps the painted pixels, clears the engine's brush ledger and reloads the retained raster, and never changes activeModule; a failed pixel pre-check changes nothing and reports an error (D-04)."
    - "After Raster, new Brush strokes capture a PARTIAL ledger of only the new strokes over the retained raster (arrival-base law: no stale pre-Raster strokes, no doubled pixels), Water color records only the new strokes, and the key is raster-only with both modules enabled; within that visit the new strokes stay live and editable, while after leaving the key the partial ledger is view-only under the existing partial-attach refusal (D-05)."
    - "Every seam that can change a frame's ownership (brush Move/Select delete, aquarelle stroke end/delete/undo, Memory purges, clear canvas, clear source) refreshes the ownership signal so the module lock and the Raster availability never go stale (D-02/D-03)."
  artifacts:
    - path: "app/src/components/physic-paint/view/frameScriptOwnership.ts"
      provides: "Pure frame script ownership resolver (brush store + aquarelle store + optional live brush ledger)."
    - path: "app/src/components/shared/frameModuleLock.ts"
      provides: "Realm-scoped ownership signal, idempotent setters, locked-module mapping and tooltip copy."
    - path: "app/src/components/physic-paint/view/rasterKeyPresentation.ts"
      provides: "Pure Raster button availability matrix (ready / playback / mutation lock / no script)."
    - path: "app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.tsx"
      provides: "RasterKeyControl leaf with Stamp icon, styled tooltip and portaled confirmation."
    - path: "app/src/components/physic-paint/PhysicsPaintStudio.tsx"
      provides: "Auto-switch funnel, ownership refresh seams and the raster handler (ledger clear + retained-raster reload + purge)."
  key_links:
    - from: "navigateToSyncedPhysicalFrame"
      to: "applyFrameModuleState"
      via: "explicit-selection gate !wasPlaying && !rotoCachedPlayback.isActive"
    - from: "frameScriptOwner signal"
      to: "ModuleSwitcher lockedModule"
      via: "PhysicsPaintTopBar (Studio only; Toolbar passes no prop)"
    - from: "RasterKeyControl confirmation"
      to: "purgeMemoryScriptFrame"
      via: "onRasterKey -> rasterKeyImplRef -> flush pixels -> verify cache -> clear+load -> purge"
    - from: "hasAquarelleScriptForFrame + brush store entry"
      to: "resolveFrameScriptOwner"
      via: "one-module-per-frame ownership rule (both -> unchanged, none -> unchanged)"
    - from: "partial brush entry + arrival base"
      to: "pixel capture"
      via: "existing partial-attach refusal and base-merge laws (no doubling)"
---

<objective>
Add a one-module-per-frame ownership rule to the Physics Paint Studio: detect which module (Brush or Water color) owns the selected key's script, auto-switch the active module on explicit frame selection, lock the non-owning slot in the Studio module switcher, and add a Raster button before Tools that converts a scripted key to raster-only while keeping its painted pixels.

Purpose: the Studio currently keeps whatever module the user last picked, so clicking a Brush-scripted key while Water color is active paints into the wrong store, and there is no way to turn a scripted key back into a raster key without leaving the Studio. This quick makes the module follow the key and gives the artist a one-click conversion back to a paintable raster key.

Output: a pure ownership resolver, a Studio-scoped lock surface, auto-switch wiring on every explicit selection path, and a confirmed Raster action that purges both script stores, clears the engine's brush ledger while reloading the retained raster, and leaves the key ready to be painted (and re-scripted) with either module.

Known boundary (investigated, no engine change needed): the post-Raster brush script is captured under the existing arrival-base law, so it is PARTIAL. Within the Raster visit the new strokes are live and fully editable; after leaving and returning the key renders from cached pixels and the partial ledger is not attached (the existing partial-attach refusal). No pre-Raster stroke is resurrected and no pixel is doubled. Making that partial ledger attachable again would need a persistent raster-base model in the engine/cache and is out of this quick's scope.
</objective>

<execution_context>
@/Users/lmarques/Dev/efx-motion-editor/.claude/gsd-core/workflows/execute-plan.md
@/Users/lmarques/Dev/efx-motion-editor/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@.claude/skills/efx-preact-reactivity/SKILL.md
@app/src/components/shared/activeModule.ts
@app/src/components/shared/ModuleSwitcher.tsx
@app/src/components/physic-paint/view/PhysicsPaintTopBar.tsx
@app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.tsx
@app/src/components/physic-paint/PhysicsPaintStudio.tsx
@app/src/components/physic-paint/view/aquarelleRecordState.ts
@app/src/components/physic-paint/view/brushScriptRecordState.ts
@app/src/components/physic-paint/view/brushScriptHydration.ts
@app/src/components/physic-paint/view/brushScriptEditionPort.ts
@app/src/components/physic-paint/view/RightPanelMemoryTab.tsx
@app/src/components/physic-paint/physicsPaintStudio.css
@packages/efx-physic-paint/src/engine/EfxPaintEngine.ts

Locked scope (never revisit):

- D-01: ONE MODULE PER FRAME. No mixed Brush + Water color scripts, no unified third edit layer.
- D-02: auto-switch only on EXPLICIT frame selection — timeline key click, frame-step nav, ruler seek/release, Studio launch settle (and track switch, which rebuilds the frame's stores). Never during cached playback or mid-drag scrub. Exactly one owner -> that module; both or none -> leave the current module unchanged.
- D-03: in the Studio, ModuleSwitcher locks the non-owning module (grayed, tooltip explains the owner and the Raster remedy); the owning module stays enabled; both/none/raster-only leave both enabled. The lock is Studio-scoped because ModuleSwitcher also mounts in the main-window Toolbar.
- D-04: Raster button immediately BEFORE Tools, label "Raster", Lucide icon reading as raster/bake (Stamp, not a trash can). Disabled when the live key has no script. Confirmation required. Confirm purges BOTH stores for that key with the Memory-tab per-key semantics, keeps painted pixels, persists snapshot cleanup, does NOT change activeModule.
- D-05: after Raster the key is a raster key; both modules may paint on it and the new paint becomes the frame's script again. Water color records only new strokes. Brush must record only the new strokes over the retained raster (no stale full-ledger capture, no edit rebake that doubles retained pixels). The engine ledger clear is available through the existing clear+load path; no engine API change is needed.
- D-06: out of scope — module-per-track, project-format changes, legacy migration, dev-server runs.

Reactivity laws (project-mandatory): signals only (no useState), compare-then-write setters, no render-body signal writes, narrow leaf subscriptions, ref-held signals where a harness breaks, never re-read large files. Vitest runs only (`vitest run`, never watch).
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Frame script ownership resolver + Studio-scoped module lock</name>
  <files>app/src/components/physic-paint/view/aquarelleRecordState.ts, app/src/components/physic-paint/view/aquarelleRecordState.purge.test.ts, app/src/components/physic-paint/view/frameScriptOwnership.ts, app/src/components/physic-paint/view/frameScriptOwnership.test.ts, app/src/components/shared/frameModuleLock.ts, app/src/components/shared/frameModuleLock.test.ts, app/src/components/shared/ModuleSwitcher.tsx, app/src/components/shared/ModuleSwitcher.test.tsx, app/src/components/physic-paint/view/PhysicsPaintTopBar.tsx, app/src/components/physic-paint/physicsPaintStudio.css</files>
  <behavior>
    - resolveFrameScriptOwner(frame) returns 'brush' for a captured brush entry, 'watercolor' for a live aquarelle frame event, 'both' when both stores hold a script, and null when neither does.
    - Aquarelle Dry events, other-frame events and deleted-stroke tombstones never count as a script.
    - A live brush sample counts only when active is true, strokeCount is above zero, and the frame is not held purged; a purged frame with a stale live sample resolves to null.
    - lockedModuleForOwner maps brush -> watercolor, watercolor -> brush, both/null -> null; lockedModuleTooltip names the owning module, the locked module, and the Raster remedy.
    - setFrameScriptOwner writes only on change (compare-then-write); clearFrameScriptOwner restores null.
    - ModuleSwitcher with lockedModule renders that slot with aria-disabled="true", the locked class, the lock tooltip, and a click that leaves activeModule unchanged; the owning slot still switches; without the prop every slot behaves exactly as today; Krita stays inert.
  </behavior>
  <action>
    Add a read-only hasAquarelleScriptForFrame(frame: number): boolean next to getAquarelleEventsForFrame in aquarelleRecordState.ts. Walk payloadTimeline; skip isAquarelleDryEvent entries, skip events whose playFrame differs, skip a stroke whose mutationId is in deletedAquarelleStrokeIds, and return true on the first remaining event. It never bumps aquarelleStrokesRevision and never mutates state. Extend aquarelleRecordState.purge.test.ts with this accessor's matrix (recorded stroke true, Dry-only false, deleted-tombstone false, other frame false, after purgeAquarelleFrameScript false).

    Create app/src/components/physic-paint/view/frameScriptOwnership.ts exporting FrameScriptOwner ('brush' | 'watercolor' | 'both' | null), LiveBrushScriptSample ({ active: boolean; strokeCount: number }) and resolveFrameScriptOwner(frame: number, liveBrush?: LiveBrushScriptSample | null): FrameScriptOwner. The stored brush leg is getBrushScriptForFrame(frame).length > 0; the live brush leg is liveBrush.active === true && liveBrush.strokeCount > 0 && !purgedBrushScriptFrame(frame); the aquarelle leg is hasAquarelleScriptForFrame(frame). Both -> 'both', one -> that module, none -> null. No signal reads, no writes. Test it against the REAL stores (resetBrushScriptStore / resetAquarelleRecordState in beforeEach, captureBrushScriptForFrame / purgeBrushScriptFrame / recordAquarelleStroke / emitAquarelleDry / markAquarelleStrokeDeleted / purgeAquarelleFrameScript as seams).

    Create app/src/components/shared/frameModuleLock.ts: export type FrameScriptOwner (import it into frameScriptOwnership.ts so there is ONE declaration), export const frameScriptOwner = signal<FrameScriptOwner>(null), setFrameScriptOwner(owner) with a peek comparison before the write, clearFrameScriptOwner(), lockedModuleForOwner(owner): ActiveModule | null, and lockedModuleTooltip(locked): string. The lock tooltip copy: for the watercolor slot locked, state that the key has a Brush script, that Water color is unavailable, and that Raster in the timeline header removes the script so either module can paint; mirror it for the brush slot locked. Test the mapping, the idempotent writer (subscribe and count writes) and both tooltip copies.

    Give ModuleSwitcher an optional prop lockedModule?: ActiveModule | null (default null). Compute isLocked = !isInert && slot.id === lockedModule. Add the module-switcher-slot-locked class, set aria-disabled to 'true' on a locked slot, keep the native disabled attribute reserved for Krita, set title to lockedModuleTooltip(lockedModule) when locked (inert and label titles otherwise), make onClick a no-op while locked, and preventDefault Enter/Space via onKeyDown while locked. The owning slot stays fully enabled and clickable. Extend ModuleSwitcher.test.tsx: locked slot has aria-disabled, the locked class and the lock tooltip; clicking it leaves activeModule unchanged; the owner still switches; no prop keeps today's behavior; the Toolbar mount remains a bare self-closing ModuleSwitcher while the TopBar mount passes the lock (update the existing source assertion that currently expects a bare TopBar mount).

    In PhysicsPaintTopBar.tsx read frameScriptOwner.value in the render body and pass lockedModule={lockedModuleForOwner(frameScriptOwner.value)} to ModuleSwitcher. Add a .module-switcher-slot-locked rule in physicsPaintStudio.css immediately after .module-switcher-slot-inert, reusing its muted color/background/border, cursor default, opacity 0.55 and box-shadow none, and neutralizing hover and .active exactly like the inert rule.

    Do not gate the lock anywhere else: the Toolbar mount has no prop and the main window is a different realm, so it stays fully enabled by construction.
  </action>
  <verify>
    <automated>pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint/view/frameScriptOwnership.test.ts src/components/shared/frameModuleLock.test.ts src/components/shared/ModuleSwitcher.test.tsx.test.ts src/components/physic-paint/view/aquarelleRecordState.purge.test.ts</automated>
  </verify>
  <done>Ownership resolves correctly for brush-only, watercolor-only, both, none, Dry-only, deleted and purged frames; the shared lock signal/writers/tooltips are tested; ModuleSwitcher can lock one slot in the Studio while the Toolbar variant is unchanged; the TopBar passes the lock from the ownership signal; the suite passes.</done>
</task>

<task type="auto">
  <name>Task 2: Auto-switch on explicit frame selection + ownership refresh seams</name>
  <files>app/src/components/physic-paint/PhysicsPaintStudio.tsx, app/src/components/physic-paint/PhysicsPaintStudio.test.ts, app/src/components/physic-paint/view/brushScriptEditionPort.ts, app/src/components/physic-paint/view/brushScriptEditionPort.test.ts</files>
  <action>
    Declare ONE stable callback near the top of the Studio component body (immediately before the brushScriptEditionDepsRef block, around line 1718) so every later seam can reference it without a temporal-dead-zone dependency: applyFrameModuleState = useCallback((frame: number, liveBrush?: LiveBrushScriptSample | null) => { const owner = resolveFrameScriptOwner(frame, liveBrush ?? null); if (owner === 'brush' || owner === 'watercolor') { if (activeModule.peek() !== owner) activeModule.value = owner; } setFrameScriptOwner(owner); }, []). It writes activeModule only for a single owner (both/none leave it untouched) and always publishes the ownership signal. Import the resolver and the lock signal from their new modules.

    Navigation funnel: inside navigateToSyncedPhysicalFrame, after the outgoing brush flush block (the activeModule.peek() !== 'watercolor' branch that calls flushBrushScriptFrame(currentFrame, ...)) and BEFORE rotoPersistence.snapshotLivePixels(currentFrame), add the exact gated call: if (!wasPlaying && !rotoCachedPlayback.isActive) applyFrameModuleState(frame);. This runs before planBrushScriptHydration reads activeModule, so the destination module governs the hydration decision. Add applyFrameModuleState to the funnel dependency array. Never call it during playback or a mid-drag scrub.

    Launch settle: inside restoreStudioScriptSnapshot, call applyFrameModuleState(context.startFrame) on BOTH exits (the no-identity early return and after the restore/reserve block). Track switch: inside the studioScriptSnapshot.restore().then at the cross-track seam, call applyFrameModuleState(launchContextRef.current?.startFrame ?? currentFrame) BEFORE the maxRestoredMutationId <= 0 early return, so switching to a script-less track unlocks.

    Brush completion: inside canvasCompletedMutationImplRef.current, in the existing activeModule.peek() !== 'watercolor' block, immediately after applyCompletedBrushMutation(kind, scriptFrame, mutationEngine), add a refresh guarded by kind !== 'clear' that passes the live sample { active: true, strokeCount: mutationEngine.getStrokeCount() }. The 'clear' exclusion is load-bearing: engine.clear() fires on every navigation after the outgoing frame was flushed, and refreshing there would overwrite the destination owner with the outgoing frame's owner.

    Other refresh seams: after clearActiveSource's clearBrushScriptFrame(currentFrame) (keep the refresh outside the module if-block), after clearCanvas's clearBrushScriptFrame(frame), at the end of handleAquarelleStrokeEnd's try block, in the aquarelleScriptHistory.replay success path after notifySourceRevision (refresh the captured playFrame), and in handleAquarelleDeleteStrokes' success branch before its return. In purgeMemoryScriptFrame / purgeMemoryRailScripts / clearMemoryRailScripts, refresh the CURRENT frame when the purge touches it (use launchContextRef.current?.startFrame as the live frame; for the rail/clear variants refresh when the live frame is in the purged set). Purges of other frames must never move activeModule. Add a teardown useEffect(() => () => { clearFrameScriptOwner(); }, []) so a closed Studio cannot leave a stale lock.

    Add an optional onScriptChanged?: (frame: number) => void to BrushScriptEditionContext and call it in brushScriptEditionPort.ts after the successful flush in deleteBrushScriptStrokes (the one edit path that can remove the last stroke and therefore change ownership). Wire it in brushScriptEditionDepsRef.current to applyFrameModuleState. Do not notify from move/transform/appearance/step/place paths. Extend brushScriptEditionPort.test.ts with a spy asserting the callback fires with the deleted frame and only on an accepted delete.

    Extend PhysicsPaintStudio.test.ts with source pins: the exact gated funnel line exists and its index sits between the navigation flushBrushScriptFrame call and rotoPersistence.snapshotLivePixels(currentFrame); the launch-restore call exists after studioScriptSnapshot.restore(); the completion refresh exists inside the module block with the kind !== 'clear' guard; the aquarelle stroke-end, aquarelle history, clearActiveSource, clearCanvas, delete and purge refreshes exist; the teardown clears the lock.
  </action>
  <verify>
    <automated>pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint/PhysicsPaintStudio.test.ts src/components/physic-paint/view/brushScriptEditionPort.test.ts src/components/physic-paint/view/frameScriptOwnership.test.ts src/components/shared/ModuleSwitcher.test.tsx.test.ts && pnpm --filter efx-motion-editor run typecheck</automated>
  </verify>
  <done>Explicit navigation, launch restore, track switch, brush completion (paints/erases/undo/redo, not 'clear'), aquarelle stroke end/delete/undo, clear canvas/source, brush Move/Select deletes and Memory purges all republish the frame's owner; the destination module governs hydration; playback never switches; the Studio clears the lock on unmount; the pins and typecheck pass.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 3: Raster button + confirmed purge and ledger clear</name>
  <files>app/src/components/physic-paint/view/rasterKeyPresentation.ts, app/src/components/physic-paint/view/rasterKeyPresentation.test.ts, app/src/components/physic-paint/view/rasterKeyStripWiring.test.ts, app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.tsx, app/src/components/physic-paint/physicsPaintStudio.css, app/src/components/physic-paint/PhysicsPaintStudio.tsx, app/src/components/physic-paint/PhysicsPaintStudio.test.ts, app/src/components/physic-paint/view/aquarelleRecordState.purge.test.ts, packages/efx-physic-paint/src/engine/EfxPaintEngine.attachBaseline.test.ts</files>
  <behavior>
    - resolveRasterKeyPresentation applies the priority ready -> playbackActive -> mutationLocked -> missing script; every disabled branch returns a specific reason string and the enabled branch returns disabled false with a null reason.
    - The strip renders the Raster control immediately before the Tools anchor, uses the Lucide Stamp icon at size 18 and the visible label Raster, exposes aria-label "Raster the key", opens a Cancel-first dialog labelled for the current key, and calls onRasterKey(currentFrame) only from the confirm button.
    - The Studio raster handler refuses on an engine-less/locked/busy/playing/mismatched-frame/no-owner call, captures pixels, re-checks the frame, verifies the retained raster, clears the engine and reloads the retained raster, then purges both stores; it never writes activeModule.
    - A failed pixel verification purges nothing and reports an error; a failed raster reload purges nothing.
    - EfxPaintEngine.clear() empties the stroke ledger (getStrokes length 0 and getStrokeCount 0) so a post-Raster paint cannot recapture pre-Raster strokes.
  </behavior>
  <action>
    Create app/src/components/physic-paint/view/rasterKeyPresentation.ts exporting RasterKeyPresentation ({ disabled: boolean; reason: string | null }) and resolveRasterKeyPresentation({ hasScript, ready, playbackActive, mutationLocked }). Priority order: not ready -> "The engine is not ready yet."; playback active -> "Stop cached playback before rastering a key."; mutation locked -> "A timeline edit is in progress."; no script -> "This key has no script to raster."; otherwise enabled with a null reason. Test every branch and the priority order.

    In PhysicsPaintWorkflowStrip.tsx add Stamp to the lucide-preact import and create a PhysicsPaintRasterKeyControl leaf rendered between PhysicsPaintLiveStatus and the Tools anchor span. The trigger mirrors the add-key/Tools icon-action pattern: span.physics-paint-roto-key-icon-action + button.physics-paint-roto-key-icon-button, a Stamp icon at size 18 inside the physics-paint-toolbox-badge-anchor span, the visible label Raster, aria-label "Raster the key", aria-disabled when presentation.disabled, a guarded onClick, Enter/Space preventDefault while disabled, and a useStyledTooltip copy built with buildGuardedActionTooltipCopy("Raster the key — remove its script and keep the painted pixels.", presentation.reason). The leaf reads props.ownerSignal.value (the shared frameScriptOwner signal reference) so only it subscribes, and computes hasScript = owner !== null.

    The confirmation is a small dialog opened by the trigger and rendered through createPortal to document.body (the strip has overflow-y hidden), positioned with the existing computeToolboxPopoverPlacement helper in a useLayoutEffect against the trigger span and the closest .physics-paint-workflow-strip (start hidden, then set left/top and visibility like PhysicsPaintToolboxPopover). Reuse the Memory confirmation classes (physics-paint-memory-confirmation, physics-paint-memory-confirm-copy, physics-paint-memory-confirm-actions, physics-paint-memory-confirm-cancel, physics-paint-memory-confirm-ok destructive) plus a physics-paint-raster-confirmation class; copy the Memory tab's focus/Escape/Tab behavior (ref-held confirmation signal, cancelRef focused synchronously on open, Escape closes, Tab cycles the two buttons). Copy: strong "Raster key {frame}?", paragraph "This removes the key's Brush and Water color script and keeps the painted pixels. Move, Select and replay are lost for this key.", buttons Cancel and "Raster key". Confirm closes the dialog and calls props.onRasterKey?.(props.currentFrame.peek()). Confirmation state is a ref-held signal or useSignal — never useState.

    Thread the props: add onRasterKey?: (frame: number) => void and frameScriptOwner?: ReadonlySignal<FrameScriptOwner> to PhysicsPaintWorkflowStripProps and to PhysicsPaintWorkflowStaticChromeProps; pass both from the strip root to the memoized static chrome (signal reference and stable callback keep the memo intact) and render the leaf from the static chrome. Add CSS: .physics-paint-raster-confirmation after the Memory confirmation rule with position fixed, inset auto, z-index 60, width 300px and box-sizing border-box.

    In PhysicsPaintStudio.tsx add a stable handleRasterKeyRequest for the strip: rasterKeyImplRef = useRef<(frame: number) => Promise<void>>(async () => {}); assign the implementation every render (the canvasCompletedMutationImplRef precedent); expose const handleRasterKeyRequest = useCallback((frame: number) => { void rasterKeyImplRef.current(frame); }, []) and pass onRasterKey: handleRasterKeyRequest plus frameScriptOwner (the signal reference) in the workflow prop object near the nav handlers.

    The implementation, in this exact order: read engineRef.current; refuse when there is no engine, isPhysicalMutationLocked(), rotoScript.applying.peek() || rotoScript.mutationLocked.peek(), rotoCachedPlayback.isActive, !readyToApply, frame !== (launchContextRef.current?.startFrame ?? -1), or resolveFrameScriptOwner(frame, { active: activeModule.peek() === 'brush', strokeCount: engine.getStrokeCount() }) is null. Then flushPendingStrokeFinalizations(); when the owner is not watercolor, forceDry() and rotoPersistenceRef.current.snapshotLivePixels(frame); await flushAquarellePixels(frame); re-check the frame identity. Verify findCachedRotoDisplayFrameRef.current(frame) is non-null; on null set an error that the key's painted pixels are not available and nothing changed, then return without touching any store. Then clearPreviewBaseImage(true), resetBackground(true), engine.clear(), and loadCachedRotoReferenceFrame(frame, engine as PreviewBackgroundEngine); if that returns false, report that the key's pixels could not be reloaded and return without purging. Only then call purgeMemoryScriptFrame(frame) (do not gate on its boolean) and applyFrameModuleState(frame). Wrap the flush/verify/load half in try/catch with the nothing-changed error copy; purge and owner refresh happen outside that try. The handler must contain no activeModule assignment — after Raster the owner is null, so applyFrameModuleState leaves the active module exactly as it was (D-04).

    Extend aquarelleRecordState.purge.test.ts with the conversion cell: purge one stroke frame, record a new stroke on the same frame, and assert only the new event remains (the old strokes never return). Extend EfxPaintEngine.attachBaseline.test.ts where clear() is already asserted to return the visit to live replay mode: after attaching a baseline, clear(), then assert getStrokes() has length 0 and getStrokeCount() is 0.

    Extend PhysicsPaintStudio.test.ts with source pins for the raster handler: the guard list, the flush/snapshot/await sequence, the findCachedRotoDisplayFrame check occurring before purgeMemoryScriptFrame, clearPreviewBaseImage/resetBackground/engine.clear/loadCachedRotoReferenceFrame occurring before purgeMemoryScriptFrame, purgeMemoryScriptFrame before applyFrameModuleState(frame), and no activeModule.value assignment inside the handler slice. Add rasterKeyStripWiring.test.ts source pins: Stamp is imported and used at size 18, the raster control index sits after PhysicsPaintLiveStatus and before physics-paint-toolbox-button-anchor, the label and aria-label are exact, onRasterKey is threaded from the strip props to the static chrome, the confirmation uses the Memory classes and Cancel appears before the confirm button, and the CSS .physics-paint-raster-confirmation is fixed-positioned.
  </action>
  <verify>
    <automated>pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint/view/rasterKeyPresentation.test.ts src/components/physic-paint/view/rasterKeyStripWiring.test.ts src/components/physic-paint/PhysicsPaintStudio.test.ts src/components/physic-paint/view/aquarelleRecordState.purge.test.ts && pnpm --filter efx-motion-editor exec vitest run --root ../packages/efx-physic-paint src/engine/EfxPaintEngine.attachBaseline.test.ts && pnpm --filter efx-motion-editor run typecheck</automated>
  </verify>
  <done>The Raster control sits immediately before Tools with a Stamp icon and the Raster label; it disables with a specific reason when there is no script or an operation is in flight and asks for confirmation; confirming purges both stores, keeps pixels, clears the brush ledger, reloads the retained raster, persists snapshot cleanup, leaves activeModule unchanged and unlocks both modules; a failed pixel check changes nothing; post-Raster painting records only the new strokes with no doubling; all suites and typecheck pass.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Artist click -> local script stores | A confirmed Raster irreversibly deletes script data for one key (pixels stay). Local UI only, no network, no untrusted input. |
| npm/pip/cargo installs | No new dependency is planned; any new package would cross the supply-chain boundary. |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-quick-261025-awl-01 | Tampering | purgeMemoryScriptFrame via the Raster confirmation | low | mitigate | Cancel-first confirmation dialog with explicit copy, Escape/Tab handling, and a fail-closed pre-check that verifies the retained raster before any store purge; the ledger is cleared only after a successful retained-raster reload. |
| T-quick-261025-awl-02 | Denial of Service | auto-switch / ownership refresh on navigation | low | mitigate | Ownership is O(1) for brush and one timeline scan for aquarelle, runs only on explicit selection/edit seams (never per playback tick), and writes signals only when the value changes. |
| T-quick-261025-awl-SC | Tampering | npm/pip/cargo installs | high | mitigate | No package is added by this quick. If one becomes necessary, run the Package Legitimacy Gate and insert a blocking human-verification checkpoint for any [ASSUMED]/[SUS] package; never install [SLOP]. |
</threat_model>

<verification>
## Automated

- `pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint/view/frameScriptOwnership.test.ts src/components/shared/frameModuleLock.test.ts src/components/shared/ModuleSwitcher.test.tsx.test.ts src/components/physic-paint/view/aquarelleRecordState.purge.test.ts src/components/physic-paint/view/brushScriptEditionPort.test.ts src/components/physic-paint/view/rasterKeyPresentation.test.ts src/components/physic-paint/view/rasterKeyStripWiring.test.ts src/components/physic-paint/PhysicsPaintStudio.test.ts`
- `pnpm --filter efx-motion-editor exec vitest run --root ../packages/efx-physic-paint src/engine/EfxPaintEngine.attachBaseline.test.ts`
- `pnpm --filter efx-motion-editor run typecheck`

## Native UAT (live Studio, user-driven)

| # | Action | Expected |
|---|--------|----------|
| 1 | From Water color, click a Brush-scripted timeline key | Active module becomes Brush; Water color slot greys out with a tooltip naming the Brush script and the Raster remedy; Brush stays clickable |
| 2 | From Brush, click a Water-color-scripted key | Water color becomes active; Brush slot locks with the mirrored tooltip |
| 3 | Select a key that has both scripts, then a raster-only/empty key | Active module unchanged in both cases; both slots stay enabled |
| 4 | Step frames with the nav buttons and release a ruler scrub on a scripted key | Same auto-switch as a click; a rapid mid-drag scrub and cached playback never switch modules |
| 5 | Open the Studio on a scripted start frame | The owner module is already active when the Studio settles |
| 6 | Switch tracks (scripted -> script-less) with the Studio open | The lock clears on the incoming track |
| 7 | Look at the main-window Toolbar module switcher while the Studio lock is active | All slots fully enabled (Studio-scoped lock only) |
| 8 | Inspect the Raster control placement | Immediately left of Tools, Stamp icon, label "Raster"; disabled with a reason on an unscripted key; enabled on a scripted key |
| 9 | Click Raster, then Cancel | Nothing changes: script, pixels, lock and active module all untouched |
| 10 | Confirm Raster on a Brush key | Pixels unchanged; Move/Select outlines gone; Memory tab shows no script for the key; active module unchanged; both modules enabled; leave and return shows the same pixels once |
| 11 | Confirm Raster on a Water color key | Sheet pixels unchanged; recorded stroke count drops to zero; both modules enabled |
| 12 | After Raster, paint one Brush stroke | Move/Select work on the new stroke in this visit; the retained raster is not doubled; leaving and returning shows the retained raster plus the new stroke exactly once (partial ledger stays view-only after return — existing partial-attach law) |
| 13 | After Raster, paint one Water color stroke | Exactly one recorded stroke for the key; retained pixels intact; leave and return shows it once |
| 14 | Try Raster during cached playback or while a timeline edit is in flight | Disabled with the playback/mutation-lock reason |
| 15 | Delete the last stroke of a key via the Brush Move/Select overlay | The lock clears and Raster disables without needing a frame change |
</verification>

<success_criteria>
- One pure ownership resolver decides brush / watercolor / both / none from the two stores plus an optional live brush ledger.
- Explicit frame selection (click, frame-step, ruler release, launch settle, track switch) switches the module only for a single owner; playback and mid-drag scrub never switch; both/none never switch.
- The Studio ModuleSwitcher locks only the non-owning slot, with a tooltip that explains the owner and the Raster remedy; the Toolbar mount remains fully enabled.
- The Raster button is placed immediately before Tools, uses a Stamp icon and the Raster label, disables with a specific reason, and requires confirmation.
- Confirming Raster purges both script stores with Memory-tab semantics, persists snapshot cleanup, keeps pixels, clears the brush ledger, reloads the retained raster, leaves activeModule unchanged and unlocks both modules; failures before the purge change nothing.
- Post-Raster painting records only new strokes over the retained raster with no stale recapture and no pixel doubling.
- Every ownership-changing seam refreshes the lock and Raster availability; the Studio clears the lock on unmount.
- All automated suites and the app typecheck pass; the native UAT rows are ready for the user's live run.
</success_criteria>

<output>
Create `.planning/quick/261025-awl-auto-mode-switch-on-frame-is-detect-that/261025-awl-SUMMARY.md` when done
</output>
