# Milestones

## v0.8.0 Standalone Physics Paint (Shipped: 2026-08-01)

**Phases completed:** 21 phases, 170 plans, 309 tasks

**Key accomplishments:**

- Package-local Vite/Preact standalone physics paint demo with public-wrapper HMR, visible standalone identity, and user-verified browser runtime behavior.
- Standalone physics paint README now matches the current package demo, public Preact wrapper props, and pnpm workflow boundaries.
- 1. [Rule 2 - Missing critical functionality] Added app package verification scripts
- 1. [Rule 3 - Blocking issue] Installed locked workspace dependencies
- 1. [Rule 3 - Blocking] Installed locked workspace dependencies before verification
- 1. [Rule 3 - Blocking] Installed existing workspace dependencies from lockfile
- UAT-facing physics paint apply feedback, app-hosted studio companion UI, and current no-issues close-out for the interactive workflow
- Physics paint UAT gap closure for native apply-result completion, editable state save feedback, and hydrated layer identity validation
- Physics paint UAT blockers closed for hydrated layer identity, compositing controls, native apply-result completion, and visible Tauri-first editable state saving.
- Pure Physics Paint Roto/Play workflow predicates with Vitest coverage for destructive actions, onion limits, play range markers, FPS fallback, and dev-export gating
- Editable Physics Paint state JSON helpers with fail-closed SerializedProject parsing and adapter-based local download orchestration.
- Dev-only physics paint PNG proof helpers transform live rendered frames into still metadata and bounded manifest.json frame-sequence metadata.
- Project-FPS launch context, validated D-26 frame-sync bridge, and callback-oriented Physics Paint studio actions for preview-only Play, Save play summaries, editable state, and debug proof output.
- EFX-style Physics Paint top bar, SVG tool rail, and lightweight right panel for the rebuilt standalone UI.
- Bottom Physics Paint workflow strip with Roto/Play mode tabs, dedicated timeline lanes, onion preview controls, and destructive confirmation surfaces
- Integrated five-region standalone Physics Paint Studio with contextual shortcuts, onion previews, workflow conversions, and final UI redlines
- Roto/Play workflow tabs now drive guarded conversion confirmations without separate bottom-strip conversion buttons
- Standalone Roto onion previews now use real local snapshots, and saved Play frames no longer remain as yellow/orange onion overlays.
- Physics Paint Save state now opens a Tauri native JSON save dialog in desktop runtime while preserving browser editable-JSON download fallback.
- Save play now persists Play canvas workflow/range/source metadata and relaunches the standalone Studio back into the saved Play canvas context.
- Validated multi-range Physics Paint Play script storage with overlap-safe apply, gap helpers, and MCE persistence
- 1. [Rule 3 - Blocking] Test dependencies were absent in the manual worktree
- Canvas-rendered saved Play script range markers nested inside physic-paint timeline bars with tested zoom/scroll geometry and renderer purity.
- Standalone Physics Paint Play scrubbing now previews locally with max-duration limits, cached saved-script lookup, dirty/remade cache switching, and Save play cache replacement semantics.
- Physics Paint Play animation now draws recorded strokes sequentially like one artist hand, with point-count weighted frame allocation and deterministic tests.
- Saved Physics Paint Play ranges now flow into live timeline layout marker data with current-frame active state and a concrete Phase 36.1 validation map.
- Explicit Roto and Play editor launch buttons now open scrubber-aware Physics Paint contexts with gap-constrained Play durations.
- Mode-specific Physics Paint standalone strip with locked Roto/Play launch labels, launch-frame Play gap cells, and text Render actions separated from Save play publishing.
- The remaining cache/delete lifecycle gap plan was closed by current human verification instead of re-executing stale gap work.
- Span-aware missing Roto frame resolution now drives preview behavior while export remains delegated through PreviewRenderer for parity.
- Explicit background-only Roto support provenance with bounded interior cache recomputation and real-key alpha separation.
- 1. [Rule 3 - Blocking] Built local workspace dependency before typecheck
- Vitest source-contract and store regressions now prove missing Roto frame preview/export parity while protecting real-key alpha caches from background-only support.
- Roto paper reopen, real-key paper compositing, and duplicate save-render gaps are automated-ready with focused regression coverage.
- Physics Paint Roto now saves dirty cached real-key repaints by merging prior cached alpha with new live alpha, without restoring prior pixels into editable strokes or baking paper/background.
- Cached real-key repaint sessions now distinguish immutable cached base from editable live overlay, preserving no-change saves/navigation and keeping Clear/Undo limited to post-reopen paint.
- Cached real-key repaint now passes automated validation and live UAT: old cached paint stays visible/non-editable, new paint previews above it, saves merge additively, paper/background stays separate, and same-session navigation reloads the latest saved cache.
- Integer-gap Roto interpolation spans now derive every strict interior frame between adjacent real keys with proportional normalized blend positions.
- Store-generated Roto interpolation now creates render-only alpha cache entries that refresh from real keys without endangering real-key edits.
- 1. [Rule 3 - Blocking] Installed existing workspace dependencies in the isolated worktree
- Generated Physics Paint Roto cache frames are now covered by preview/export parity tests that prove shared cache-backed rendering and renderer-owned paper/background composition.
- Initial Studio/workflow-strip generated interpolation wiring landed, but live UAT exposed blocker gaps in source-key preservation, mode selection, persistence, playback, and parent preview/export.
- 1. [Rule 3 - Blocking] Retry worktree lacked installed dependencies
- 1. [Rule 3 - Blocking] Retry worktree lacked installed dependencies
- Physics Paint Roto interpolation settings now survive .mce load/reopen and regenerate generated render-only cache for parent preview/export publication.
- Workflow strip count/mode controls and Studio store wiring make generated Roto interpolation visible, selectable, and render-only in the live Physics Paint UI.
- 1. [Rule 3 - Blocking] Installed worktree dependencies and built local workspace declarations
- 1. [Rule 3 - Blocking] Installed existing workspace dependencies from lockfile
- Override-aware Physics Paint Roto interpolation now persists source-endpoint segment timing and regenerates derived display cache from real source keys after toggle, close/reopen, and project save/load.
- Custom Roto interpolation spans now have test-proven real-key-only onion anchors and store-backed preview/export parity.
- Custom dynamic interpolation spacing is complete after automated verification and user-approved native UAT, including final Debug 08 onion parity corrections.
- Additive inactive canonical physical Roto model with stable keyId, direct appFrame, enabled-only interpolation, separate Script Motion, and fail-closed reconstructing validators — compile-preserving and solely authoritative alongside the unchanged live timing graph.
- Pure deterministic physical resolver with closed Insert/Delete/Move/Force-Spacing intent union, one exported seam, common complete-map finalizer, strict-interior generated cells, cut-and-insert Drag, and immutable deep-frozen proposals — compile-preserving and solely authoritative alongside the unchanged live timing graph.
- 1. [Rule 3 - Blocking issue] Deleted stale test files importing from removed `rotoSourceDisplayModel.ts`
- One operation-agnostic acknowledged physical-edit coordinator replacing the accepted move-only lifecycle, with deterministic content revision, exact-tuple settlement, complete immutable snapshot rollback, and atomic consumer cutover
- Generic accepted-only physical command ledger with coordinator-backed Undo/Redo, identity-changing replay provenance, and deleted move/apply wrappers — one stable ports/listener/coordinator settlement path
- Identity-preserving ripple Insert Frame, ripple Delete Frame with deterministic survivor selection, one stable physical timeline action bundle, toolbar/keyboard intent routing, and deleted legacy key transactions — Insert/Delete own no arithmetic, staging, publication, or history append
- 1. [Rule 1 - Bug] Removed unused helpers and imports after legacy cutover
- 1. Task 3 wrapper retirement moved to Plans 10 and 13
- Stable-key Roto ownership with revision-gated live pixels and one physical real/generated/missing render path shared by playback, preview, export, and timeline extent
- Stable-key Clear and Script workflows now target direct physical frames through the existing acknowledged coordinator, with bounded production audits complete and the stale-test-blocked compile proof explicitly deferred until Plan 13.
- Native UAT is blocked because Physics Paint reports “Engine not ready”; the first painted Roto key remains visible but is not persisted or represented correctly, preventing timeline navigation.
- Duplicate and both Paste forms now reach Plan 20's complete-record acknowledged physical authority through narrow semantic ports, with reusable copied paint and no local timing, persistence, or settlement bypass
- First-class Duplicate and Paste operations with complete immutable record proposals, three-boundary semantic validation, exact parent acknowledgement, and accepted-only history through the existing Signals coordinator
- Complete child-owned physical snapshots now replay through the sole acknowledged coordinator, with all six command kinds moving Undo/Redo history only after exact accepted provenance
- Enabled-only interpolation now uses the existing acknowledged physical-map transaction, preserves every real-key record, and updates a controlled Preact checkbox only from canonical state.
- Canonical real-key PNGs now hydrate the shared alpha-canvas registry before publication, generate only valid strict-interior PNG composites, and reach reference consumers through revision-bound fail-closed validation
- Stable-identity occupied Drag now preserves the source gap and ripples only at before/after destination boundaries, while whole-cell Drag and D-30's UAT-first recovery contract remain unchanged
- Studio-level light Play Script dialog with shared focus identity and unchanged Signal-backed generation authority
- Play Script now publishes one complete stable-identity physical record map, receives exact parent acceptance, and makes accepted alpha PNGs available to canonical physical consumers without a legacy cache dual write.
- Export completion notifications now stop at an exact main-window capability boundary before plugin loading, while successful export state remains independent from optional notification delivery
- One canonical physical Roto authority is statically reachable across interpolation, exact history, generated PNGs, persistence, Play Script publication, and guarded export notification, with D-29/D-30 aligned for the native-only handoff.
- The user approved the complete repaired native Roto surface, including interpolation, exact replay, cached playback, persistence, downstream parity, and workflow control grouping.
- All 18 baseline-failing test files triaged assertion-by-assertion to the canonical physical-frame contract (17 repaired, 1 deleted wholesale), three checkpoint-authorized minimal production fixes applied, and the deferred three-command gate is green in one pass from repo root.
- Shared styled tooltip (exact 1000ms hover / instant keyboard focus) plus the locked 7-icon guarded Roto action row — Key chip first, no native disabled, verbatim controller reasons, Discard Script removed from the row.
- Always-visible #F5A623 diamonds per real Roto key on physic-paint FX rows of the main timeline — one FxTrackLayout field, one frameMap population line, one clipped canvas draw pass, pure-function geometry tested including the nonzero-inFrame case.
- The 36.14 UI-SPEC application-level text-selection policy applied at the app shell — user-select: none on html/body/#app with an exact four-selector user-select: text exception list — locked by a permanent source-contract test including exception-target liveness and scoped-rule coexistence guardrails.
- D-01 header rebuilt as four gray pill islands in one non-wrapping 46px flex row — navigation / interpolation (borderless Blend toggle) / playback / apply-spacing (icon + text Apply) — with a flex-1 capsule slot for Plan 05 and a header Close button routed through the guarded close-flush path.
- The 9-line permanent status stack and the bottom cell-states legend collapsed into one elastic prioritized header capsule (D-15/D-18/D-19) fed by a pure unit-tested selector, with exact D-16 per-cell state copy routed through the Plan 01 styled tooltip.
- The full STRIP-GEOMETRY cutover — fixed 155px five-band strip with derived 2160px lane constant and re-banded action row — plus the user-verified follow-up scope: restructured top bar with a Tools dropdown and relocated Duplicate/layer-name, the new + Key empty-real-key tool, smaller canvas diamonds, raised tooltip z-index, enlarged action-row icons, and a responsive studio top panel.
- D-11 completed: Discard Script lives in the right-panel Scripts toolbar as a guarded `clipboard-x` action fed by a new controller-owned `canDiscard`/`discardDisabledReason` port — and the strip's Discard surface (prop, Studio workflow prop) is fully retired.
- Final presentation polish closing all four 2026-07-26 native-UAT gaps: Tools dropdown removed with controls regrouped into the user-specified top/bottom bars, the canvas-masking tooltip clipped no more, Copy/Apply Script relocated into a proper second Scripts-toolbar row with the 'Clear Script Buffer' rename, and labeled, enlarged bottom-row icons with de-prefixed tooltips.
- Final cosmetic polish closing all four 2026-07-26 second-pass native-UAT items: labeled Scripts-toolbar second-row icons, the doubled ring removed from the Set Key Space APPLY button with its label renamed 'Key spacing', the selected key cell's orange border unclipped on all four sides, and the interpolation option renamed 'Frame blending'.
- Final presentation polish closing all five 2026-07-26 third-pass native-UAT items: the bottom action row split into three top-bar-style separated groups (identity / tools / Key spacing), every short label rendered lowercase via text-transform opt-outs from the global uppercase button rule, the Key spacing submit reading 'Apply', and the Scripts second-row icons pinned at the full first-row 16px size.
- Final presentation polish closing all six 2026-07-26 fourth-pass native-UAT items: Scripts toolbar second-row labels render in full on content-sized cells with an 8px row separation, the bottom-row tools group sits on the bare band with all three groups vertically centered, Scripts is the first and default-open tab of its group, and the right sidebar is restructured into three tab groups — [Brush color], [Tool] without Save/Load state, [Scripts, Onion, Motion] — with the LOG tab and its Plan 03 selection-guard exception retired in the same commit.
- Final presentation polish closing all six 2026-07-26 fifth-pass native-UAT items: the Brush color and Tool tab header strips are gone so each sidebar section starts directly with its content, the three sidebar sections share the height in equal thirds behind two GripHorizontal grab handles that each resize only their neighbors, a 4px shared scroll offset lets the frame-0 selected cell render its full orange ring, and the bottom action row grows to a user-approved 34px band (band sum 161px) with all three 26px groups vertically centered under clear top/bottom padding.
- Final polish closing all three items of the user's 2026-07-26 final native-UAT round ("after that its perfect!"): the bottom action row gains the requested 6px bottom padding, the sidebar default proportions follow the user's spec (brush color 425 : tool 213 : scripts/onion/motion 340 as ratios of the content height behind two fixed 32px grab handles), and the ~20px dead space at the top of the chrome-less brush color section is gone.
- Cache-first Roto contracts and store helpers distinguish real keys, generated interpolation cache, and deleted frames while preserving existing rendered PNG storage.
- Standalone Roto workflow cells now distinguish empty gray, cached-only green, and editable-session pink states with save-pending copy that avoids dirty/current-frame color ambiguity.
- Cache-first Roto lifecycle with dirty-frame save boundaries, cached-only reference repainting, pending-save controls, and best-effort close flushing.
- Cached Roto PNG launch hydration and PreviewRenderer-only playback/export semantics with virtual missing-frame handling
- 1. [Rule 3 - Blocking] Worktree dependency access for tests
- Dirty Roto close now awaits the normal apply-canvas flush, cached/background-only frames keep gray/green semantics, and cached references reopen at full strength.
- Standalone Roto interpolation controls now expose generated render-only in-betweens through visible strip UI wired to existing cache regeneration.
- 1. [Rule 3 - Blocking] Planned rotoFrameDraw.test.ts path was absent
- Durable Physics Paint Roto cache core with Save current, parent preview persistence, project save/load hydration, and cached-reference reopen
- User-run UAT approved the durable Physics Paint Roto cache workflow for Save current, preview, save/load, and cached-reference reopen
- Roto close workflow now offers discard, cancel, or save-close for dirty current frames while clean frames close normally.
- Physics Paint clean close is now authorized by Tauri capability policy while the existing dirty close workflow remains unchanged.
- Typed Roto cell semantic model separating empty, cached, editable/current, generated, and background-only meanings from current/dirty/pending overlays.
- Existing Physics Paint Roto workflow strip now renders semantic cell classes, labels, a compact legend, and generated-cell guard from the Plan 01 view model.
- Physics Paint Roto workflow cells now have distinct semantic visual treatments, overlay states, compact legend styling, and an approved cached-reference navigation fix.
- Roto frame navigation now saves dirty source frames once through the existing cache path before opening the latest requested destination.
- The workflow strip now shows which dirty Roto source frame is saving while preserving existing navigation and Save current behavior.
- 1. [Rule 3 - Blocking] Installed worktree dependencies offline for verification
- 1. [Rule 3 - Blocking] Installed workspace dependencies to run Vitest
- Studio-level Roto key utilities now save dirty source keys before mutation, update cache metadata through the store, and keep Paste eligible for empty/generated/real targets.
- Contextual Physics Paint Roto key utility pill with accessible Insert, Dup, Copy, Paste, and Delete controls styled to the approved UI-SPEC.
- Focused regression tests and TypeScript typecheck are green for the completed Roto key utility slice; live user UAT remains the required blocking checkpoint.
- Controller-backed Roto key transactions now make Insert, Delete, Paste, and Duplicate cache truth deterministic while keeping the existing contextual UI unchanged.
- Signals-backed Roto session boundary with clean key transaction regressions and plain adapter effect descriptors.
- Dirty Roto save-before-navigation/action now lives in the session boundary with sticky failure retention and explicit save result transitions.
- 1. [Rule 3 - Blocking] Restored local dependencies for test execution
- 1. [Rule 3 - Blocking] Installed declared workspace dependencies in the manual worktree
- 1. Copy/Paste state did not become visibly usable after Copy
- Cached Roto timed Play/Stop preview approved as necessary, unlocking the TDD implementation plan without touching app source.
- Cached Roto playback is locked as a preview-only cached overlay controller with Stop cleanup that clears both overlay and global preview state.
- Cached Roto playback is now discoverable in the Roto navigator, supports loop/fps preview controls and Space Play/Stop, and sequences only real cached key frames.
- Group drag (move-key-group), group delete (delete-key-group), and scoped Force Spacing (scopeKeyIds) resolved through the existing finalizeProposal single authority, with both new operation kinds admitted in lockstep through the wire validator and history ordinary-kind guard and the parent bridge generic path statically proven (zero bridge edits).
- Pure keyId-only selection-reducer module plus session-local `selectedKeyIds`/`selectionAnchorKeyId` Signals at the Studio controller boundary, with launch-replacement reset, the D-17 post-acceptance aftermath rules, and Escape-collapse / strip-scoped Cmd/Ctrl+A keyboard branches — the selection model every 37-03/37-04 group operation reads.
- Group drag prepare/commit pair (one frozen move-key-group publication through the acknowledged seam, zero recomputation), group-aware deleteRotoFrame sharing one transaction across every delete route, scope-aware applyForceSpacing per D-10, Select All availability computeds with verbatim guarded reasons, and D-26 reject routing (concise capsule copy + diagnostic detail) — all single-key paths provably unchanged, typecheck green, zero test artifacts.
- Modifier-click / Shift-click / plain-click selection gestures wired from strip cells through the 37-02 reducers with no navigation steal and no drag arming on modifiers, the `.selected` secondary cell treatment with `Selected key` tooltip and aria-selected, the group drag session over the 37-03 prepare/commit pair with moved-set preview and resolver-driven blocked-target preview plus exactly-once release-time reject publication, and the guarded Select All icon at the end of the key-utilities pill — all single-key paths provably unchanged, typecheck green, zero test artifacts.
- User-approved native UAT of Phase 37 multi-select physical Roto keys: 10/10 script sections passed, 3/3 UI backstops visually confirmed, 4/4 flagged-assumption questions confirmed — plan 37-06 eligible per D-18
- Locked the UAT-approved Phase 37 group-operation contract as 33 executable regression anchors across three test files — full suite 849 passed / 0 failed, typecheck and build green, zero production edits
- Roto clipboard slot widened to a frozen single|group discriminated union with group Copy (2+ selected keys snapshot store-fresh `{payload, sourceAppFrame, sourceKeyId}` entries with `Copied {N} keys` feedback) while 1-key Copy and single-key Paste stay byte-identical
- The `paste-key-group` literal now flows through all five owners of the 36.14-20 semantic-operation seam — shared types, pure resolver (intent/factory/candidate/validator/dispatch), coordinator (equality/routing/retargeting), parent bridge (validation branch), and history (automatic via Exclude) — so a group of copied real Roto keys resolves as one atomic, thrice-validated, accepted-only transaction with anchor/offset math, all-empty-or-reject collisions, and zero ripple
- Static capsule baseline deleted and replaced with a live current-cell idle context line fed through the selector's ambient slot from a new pure helper; missing-frame wording confirmed event-driven only in useRotoCachedPlayback.
- Group paste is live end-to-end: a group clipboard routes through the new `pasteKeyGroup` port member and route into the frozen 38-02 intent and the existing runPhysicalAction/coordinator/bridge seam — one atomic acknowledged transaction with UI-SPEC locked busy/success/reject copy — and the accepted pasted group becomes the selection with the earliest pasted key current, while the single-key paste path stays byte-identical
- FIXED, pill rendered in place — no portal.
- The user explicitly approved the full 33-step native UAT script on 2026-07-29. Plans 38-01 through 38-05 are now accepted behavior, and wave-4 regression plans 38-07 and 38-08 are unblocked.
- Fifty-three focused Vitest tests now lock the UAT-approved group Copy/Paste seam across resolver semantics, selection aftermath, and the shared session clipboard without touching production code.
- Capsule idle context and viewport tooltip behavior are now regression-locked against the UAT-approved shipped contract, with the complete app suite, TypeScript check, and production build green.
- Zero changes.
- Timeline navigation no longer repaints the right color sidebar or the left vertical tool rail: both subtrees are wrapped in `preact/compat` memo and fed referentially stable props assembled behind a new pure `createIdentityMemo()` factory, so the rAF-batched `startFrame` propagation (38.1 D-04) shallow-compares equal and Preact skips both subtrees — proven by an ephemeral bundle script and the enumerated-deps contract, with zero visual and zero behavior change.
- Persistent structural/frame-split Roto timeline signal graph — a navigation frame write now costs O(find) with zero projection rebuilds (spy-proven), behind a byte-compatible model interface and identical selector values.
- Two pure, test-locked primitives for the Studio navigation pipeline — a scheduled-flag rAF scheduler capping UI flushes at one per animation frame with latest-state-at-fire-time, and monotonic latest-wins generation tokens whose only staleness criterion is supersession.
- Studio navigation pipeline rewired to the locked ordering invariants — the engine canvas paints in the same tick as every navigation intent before any Preact UI work, superseded paints are skipped via generation tokens, UI frame propagation is rAF-batched to one render per animation frame, and both per-render O(N) derivations are structurally memoized — with byte-identical observable behavior.
- The workflow strip's per-frame render is now O(changed cells): the O(N) rotoDragValidityKey string build sits behind a five-input structural memo, and a component-scoped per-cell derivation cache recomputes at most the previously-current and newly-current cells' view models on a pure frame change — with the 55-assertion source-grep contract, the capsule arbitration, and the tooltip mechanism byte-identical.
- The cached-playback per-tick surface is now signal-backed end-to-end: each tick reaches exactly three live surfaces — the playback canvas image, the pinned nav-pill current-frame indicator, and play/stop transport state — while cells, capsule, and tube/log stay frozen; missing-frame events queue during playback and flush once inside the single synchronous catch-up render on every stop path, after which the idle context line resumes.
- Native UAT APPROVED on re-verification run 2 (2026-07-28, user verdict: "work now! its fast!") — canvas-first navigation flat across key counts, instant revisits, instant dirty-frame departures, instant stop catch-up, playback freeze intact, zero behavior change — after run 1 rejected sections A/C and gap plan 38.1-07 shipped the store-memo + engine-cache + paint-before-flush fixes.
- Per-navigation physical roto store reads are now O(1) in total key count — a per-layer identity-triple memo serves the projection + content revision (spy-proven zero recomputes on navigation/selection, exactly one byte-identical recompute per structural mutation class) — plus the engine decoded-Image cache (zero-decode frame revisits), the resetBackground unchanged-input skip, and the paint-before-flush Studio navigation reorder with post-flush generated-cell repaint.
- The existing Physics Paint profiler now records the complete Studio-to-Efx navigation path, and actual native forward/reverse deltas establish the RED ownership baseline for Plans 09–11 without changing render localization.
- Dedicated Preact memo boundaries now skip frame-only TopBar, ToolRail, Play Script dialog, and complete right-panel region work while preserving plain implementations and internal Signal-driven updates.
- Mount-stable timeline observers, Signal-driven static Workflow memoization, and cached memoized cell bodies now localize adjacent navigation to no more than the cells whose observable state changes.
- Memoized CanvasStack and keyed CanvasMount boundaries now keep the persistent Efx child out of frame-only Studio work while latest-ref callbacks preserve current engine and Roto behavior.
- User-approved bidirectional render localization and all 33 Phase 38 native regressions now agree with focused tests, the exact sanctioned-red suite gate, typecheck, production build, and a clean repository.
- Cached Roto playback now preserves transparent, textured-paper, and independent grain metadata through the same canonical compositor used by preview and export.
- Last-session wet-buffer preservation with explicit completed-mode recording, version-2 serialization, and deterministic replay propagation
- Physical Roto replacement now treats capacity as a structural identity member, so capacity-only changes install, clamp, rebuild, and publish while exact triples remain notification-free.
- Physics Paint's optional render-path profiler now treats restricted browser storage as disabled, preventing localStorage capability failures from escaping or mutating deterministic profiler state.
- A reusable Node hook runtime now executes CanvasMount callback freshness, dimension-effect dependency behavior, and exactly-once observer/rAF cleanup without impersonating Preact reconciliation.
- The complete post-gap automation and user-owned native checkpoint now approve cached pixels, physics replay, capacity publication, real Preact CanvasMount/Efx lifecycle, localized render thresholds, and the corrected rigid Roto group-drag contract.

---

## v0.7.0 Monorepo & Paint Enhancements (Shipped: 2026-04-05)

**Phases:** 2 completed (26, 33) + 6 failed/abandoned (27-32) | **Plans:** 23 | **Tasks:** 40
**Lines of code:** 40,014 TypeScript (+40,609 / -1,950 net, 459 files changed)
**Timeline:** 3 days (2026-04-03 → 2026-04-05) | **Commits:** 138
**Git range:** `docs: start milestone v0.7.0` → `feat: v0.7.0 Monorepo & Paint Enhancements` | **Tag:** v0.7.0

**Delivered:** Converted to pnpm monorepo with app/ + packages/efx-physic-paint/, and overhauled the paint engine with a 3-mode system (flat/FX/physical-placeholder), inline 4-mode color picker with swatches, FX stroke wireframe overlay, stroke draw-reveal animation, circle cursor overlay, and brush persistence. Phases 27-32 (engine adapter approach) were abandoned — efx-physic-paint deferred to v0.8.0 as a standalone window.

**Key accomplishments:**

1. pnpm monorepo scaffold: Application/ → app/ with git history preserved, workspace root lockfile, efx-physic-paint as `packages/efx-physic-paint/` workspace package
2. Paint undo/redo overhaul: _notifyVisualChange + FX cache invalidation fixes all rendering bugs; immediate FX brush drawing without pointer movement required
3. 3-mode paint system (flat/FX/physical-placeholder) with per-frame mode exclusivity, conversion dialogs, and transparent flat background
4. Inline 4-mode color picker (Box/TSL/RVB/CMYK) with HEX input, recent colors, and favorite swatches persisted via LazyStore; canvas-adjacent 260px panel
5. FX stroke wireframe overlay: dashed path + bounding box for selected strokes with bbox-only hit testing
6. Stroke draw-reveal animation: speed-based point distribution across frame range with inverse distance weighting and atomic single-Cmd+Z undo

**Known Gaps (requirements not completed):**

- MONO-05: `pnpm tauri build` not verified post-monorepo (dev server confirmed working)
- ENGN-01 through ENGN-06: Engine headless API — deferred to v0.8.0
- ECUR-01, 05, 06, 08, 11, 12: Minor UX improvements — deferred to v0.8.0
- PAINT-01 through PAINT-12: Physics paint tools — deferred to v0.8.0
- NCAP-01 through NCAP-03: New paint capabilities — deferred to v0.8.0
- PERS-01 through PERS-03: Persistence/compatibility for new engine — deferred to v0.8.0

**Technical debt carried forward:**

- S key shortcut lacks isPaintEditMode() guard (low severity, flagged since v0.6.0)
- Coalescing API still partially wired (carried from v0.1.0)
- canUndo/canRedo signals unused for button state (carried from v0.1.0)
- 2 medium-severity export edge cases (carried from v0.2.0)

**Archives:** `milestones/v0.7.0-ROADMAP.md`, `milestones/v0.7.0-REQUIREMENTS.md`

---

## v0.6.0 Various Enhancements (Shipped: 2026-04-03)

**Phases:** 4 (Phases 22-25) | **Plans:** 14 | **Tasks:** 28
**Lines of code:** 40,688 TypeScript (+15,167 / -827 net)
**Timeline:** 8 days (2026-03-26 → 2026-04-03) | **Commits:** 107
**Git range:** `feat(22-01)` → `feat(25-03)` | **Tag:** v0.6.0

**Delivered:** Stroke management with drag-reorder, visibility toggles, and multi-select; bezier path editing with fit-curve conversion and interactive anchor/handle manipulation; Alt+drag duplicate and non-uniform scale transforms; paint panel reorganization and UX polish across paint and motion workflows.

**Key accomplishments:**

1. Paint store stabilization: fixed moveElements* bugs, added _notifyVisualChange helper, snapshot-based undo/redo for all transform gestures (move, rotate, scale)
2. Alt+drag duplicate for all paint element types and non-uniform edge-handle scale with 4 circular midpoint handles — both with single-entry undo/redo
3. StrokeList panel with SortableJS drag reorder, visibility toggles, delete, multi-select (Cmd+click/Shift+click), and bidirectional canvas-list selection sync
4. Bezier path editing: fit-curve freehand-to-bezier conversion, interactive anchor/handle dragging, add/delete control points, pen tool overlay with progressive simplification
5. Paint properties panel reorganized with 2-col grid layouts, auto-flatten on exit paint mode, and isolation-scoped layer creation
6. Motion path sub-frame dot density fix (4x denser dots for short sequences)

**Technical debt carried forward:**

- S key shortcut lacks isPaintEditMode() guard (low severity)
- Coalescing API still partially wired (carried from v0.1.0)
- canUndo/canRedo signals unused for button state (carried from v0.1.0)
- 2 medium-severity export edge cases (carried from v0.2.0)

**Archives:** `milestones/v0.6.0-ROADMAP.md`, `milestones/v0.6.0-REQUIREMENTS.md`, `milestones/v0.6.0-MILESTONE-AUDIT.md`

---

## v0.5.0 Motion Blur & Paint Styles (Shipped: 2026-03-26)

**Phases completed:** 2 phases, 8 plans, 15 tasks

**Key accomplishments:**

- Extended PaintStroke with fxState field, added per-frame FX cache to paintStore, and renderFrameFx() to brushP5Adapter for Kubelka-Munk spectral batch rendering
- renderPaintFrameWithBg() with solid background fill, frame-level FX cache compositing via drawImage, and PAINT BACKGROUND color picker in PaintProperties
- Select tool with hit testing, per-frame FX application via renderFrameFx for spectral mixing, sequence overlay toggle, and previewRenderer wired to renderPaintFrameWithBg
- flattenFrame/unflattenFrame methods with per-frame cache rendering via renderFrameFx, persistence fxState round-trip with cache regeneration on load, and Flatten Frame button in select mode
- MotionBlurSettings type, reactive store with peek() accessors, WebGL2 GLSL directional blur shader, and velocity computation engine with 17 unit tests
- Per-layer GLSL motion blur wired into PreviewRenderer with VelocityCache seek invalidation, plus toolbar toggle button with shutter angle slider and quality tier popover
- Combined GLSL velocity blur + sub-frame accumulation export pipeline with Motion Blur dialog section and .mce v15 persistence
- Keyboard shortcut 'M' toggles motion blur with paint-mode guard; 27 unit tests pass covering store signals, shutter angle clamping, VelocityCache seek invalidation, and isStationary boundary cases

---

## v0.4.0 Canvas & Paint (Shipped: 2026-03-25)

**Phases:** 2 (Phases 18-19) | **Plans:** 9 | **Tasks:** 19
**Lines of code:** 34,067 (31,814 TypeScript + 2,253 Rust)
**Timeline:** 2 days (2026-03-24 → 2026-03-25) | **Commits:** 75
**Quick tasks:** 1 inline fix (tablet pen support)

**Delivered:** After Effects-style canvas motion path with interactive keyframe markers, and a complete frame-by-frame paint/rotopaint layer with perfect-freehand brush engine, 7 drawing tools, onion skinning, flood fill, and sidecar JSON persistence.

**Key accomplishments:**

1. After Effects-style canvas motion path with dotted trail, keyframe circle markers, drag-to-reposition interaction, auto-seek, and undo-coalesced position editing
2. Unified keyframe upsert routing for sidebar and canvas drag edits, closing the real-time preview gap for keyframed layers
3. Frame-by-frame paint/rotopaint layer with perfect-freehand brush engine, eraser, line, rect, ellipse, eyedropper, and flood fill tools
4. Paint layer rendering integrated into PreviewRenderer compositing loop with blend modes, opacity, and export pipeline passthrough
5. Onion skinning overlay for rotoscoping workflow with configurable frame range and opacity falloff via offscreen canvas compositing
6. Sidecar JSON persistence for paint frames with project format v14, Tauri FS read/write, and Rust paint/ directory creation
7. Tablet pen support with pressure sensitivity, tilt modulation, coalesced pointer events, and backward-compatible stroke defaults

**Technical debt carried forward:**

- Coalescing API partially resolved (motion path drag uses it) but still unwired in most UI (carried from v0.1.0)
- canUndo/canRedo signals unused for button state (carried from v0.1.0)
- 2 medium-severity export edge cases (content-overlay preload, FX generator frame offset) (carried from v0.2.0)
- 3 pre-existing audioWaveform test failures (unrelated to v0.4.0 work)

**Archives:** `milestones/v0.4.0-ROADMAP.md`

---

## v0.3.0 Audio & Polish (Shipped: 2026-03-24)

**Phases:** 8 (Phases 15-17, 15.1-15.4, 17.1) | **Plans:** 29 | **Tasks:** 63
**Lines of code:** 31,522 (29,037 TypeScript + 2,157 Rust + 328 CSS)
**Timeline:** 5 days (2026-03-20 → 2026-03-24) | **Commits:** ~327
**Quick tasks:** 7 inline fixes

**Delivered:** Audio import with waveform visualization and synced playback, media in-use tracking with cascade removal, solid/transparent key entries with gradient fills, GLSL shader effects (17 Shadertoy + 18 GL transitions), audio export with BPM beat sync, and a streamlined 2-panel adaptive sidebar.

**Key accomplishments:**

1. Audio import with waveform visualization, synced playback, volume/fade controls, timeline interactions (click, drag, trim, slip, reorder, resize), and .mce v8-v9 persistence
2. Media in-use tracking with color-coded badges, portal-based usage popovers, and cascade asset removal with composite undo across sequenceStore/audioStore/imageStore
3. Solid/transparent key entries with split add button, inline color picker, timeline/canvas/export rendering, cross-dissolve blending, and .mce v10 persistence
4. GLSL shader system: WebGL2 runtime with 17 Shadertoy-ported effects, ShaderBrowser with animated previews, parameter controls, and keyframe animation support
5. GL transitions: 18 curated gl-transitions.com shaders, dual-texture WebGL2 pipeline, TransitionProperties sidebar, teal timeline overlays, and .mce v11 persistence
6. Audio export with OfflineAudioContext pre-render, FFmpeg muxing, BPM detection via onset autocorrelation, beat markers, snap-to-beat, auto-arrange strategies, and .mce v12 persistence
7. Sidebar enhancements: collapsible key photos, global solo mode (S key), gradient fills (linear/radial/conic) with draggable stops, and .mce v13 persistence
8. Adaptive 2-panel sidebar with sequence/layer view switching, Layers icon with green count badge, back navigation, and 3-to-2 panel flex migration

**Technical debt carried forward:**

- Coalescing API still unwired in UI (carried from v0.1.0)
- canUndo/canRedo signals unused for button state (carried from v0.1.0)
- 2 medium-severity export edge cases (content-overlay preload, FX generator frame offset) (carried from v0.2.0)
- GLSL/GLT requirements not formally tracked in REQUIREMENTS.md (phases inserted urgently)

**Archives:** `milestones/v0.3.0-ROADMAP.md`, `milestones/v0.3.0-REQUIREMENTS.md`

---

## v0.2.0 Pipeline Complete (Shipped: 2026-03-21)

**Phases:** 23 (Phases 8-14, 12.1-12.15) | **Plans:** 66 | **Tasks:** 128
**Lines of code:** 20,428 (18,110 TypeScript + 2,020 Rust + 298 CSS)
**Timeline:** 18 days (2026-03-03 → 2026-03-21) | **Commits:** 847
**Quick tasks:** 44 inline fixes

**Delivered:** Complete stop-motion-to-cinema pipeline with keyframe animation, GPU blur, content overlay layers, fade/cross-dissolve transitions, PNG sequence + video export (ProRes/H.264/AV1), and a full sidebar redesign with 14 UX refinement sub-phases.

**Key accomplishments:**

1. Per-layer keyframe animation with polynomial cubic easing, timeline diamond markers, interpolation-aware icons, and 14 decimal sub-phases of UX refinement (sidebar redesign, auto-seek, quick keys, shortcuts overlay, vertical scroll, auto-selection, GPU blur, fullscreen, content overlays, linear timeline, buttons, sequence isolation)
2. PNG sequence + video export (ProRes/H.264/AV1) with FFmpeg auto-provisioning, resolution multipliers, progress tracking, metadata sidecars, and native notifications
3. GPU-accelerated WebGL2 two-pass separable Gaussian blur replacing dual CPU algorithms with constant-cost rendering
4. Content overlay layers (static image, image sequence, video) as timeline-level sequences with full property controls and keyframe support
5. Fade/cross-dissolve transitions with opacity/solid-color modes, DaVinci Resolve-style timeline overlays, and configurable interpolation
6. Complete sidebar redesign: 3 resizable sub-windows, inline key photos, keyframe navigation bar, inline interpolation controls, and 21 CSS variables across 3 theme variants
7. 3-level UI theme system (dark/medium/light) with CSS variable architecture and persistent preference
8. Full-speed playback mode (Shift+Space) and fullscreen canvas (Cmd+Shift+F) with letterboxed preview

**Technical debt carried forward:**

- 4 phases missing VERIFICATION.md (10, 12.1, 12.1.1, 12.4) — all features functional
- 2 medium-severity export edge cases (content-overlay preload, FX generator frame offset)
- 5 phases missing Nyquist VALIDATION.md (8, 12, 12.8, 12.14, 13)
- Coalescing API still unwired in UI (carried from v0.1.0)

**Archives:** `milestones/v0.2.0-ROADMAP.md`, `milestones/v0.2.0-MILESTONE-AUDIT.md`
**Phases:** `milestones/v0.2.0-phases/` (Phases 8-14, 12.1-12.15)

---

## v0.1.0 (Shipped: 2026-03-11)

**Phases:** 8 (Phases 1-4, 3.1, 5-7) | **Plans:** 36 | **Requirements:** 76
**Lines of code:** 10,159 (8,753 TypeScript + 1,352 Rust + 54 CSS)
**Timeline:** 10 days (2026-03-02 → 2026-03-11) | **Commits:** 284
**Git range:** `feat(01-01)` → `feat(quick-11)` | **Tag:** v0.1.0

**Delivered:** Complete stop-motion editor with multi-layer compositing, cinematic FX effects, undo/redo, keyboard shortcuts, and project management — from Tauri scaffold through production-ready editing.

**Key accomplishments:**

1. Tauri 2.0 + Preact + Motion Canvas + Tailwind CSS v4 foundation with 6 reactive signal stores and dark theme editor UI
2. Rust image pipeline with drag-and-drop import, thumbnail generation, and LRU memory management
3. Project management (.mce format v4) with auto-save, recent projects, unsaved-changes guard
4. Canvas-based timeline with virtualized rendering, playhead scrubbing, zoom, and real-time preview playback
5. Undo/redo command pattern engine (100+ levels) with keyboard shortcuts (JKL shuttle, Space, Cmd+Z/S/N/O)
6. Multi-layer compositing: static image, image sequence, and video layers with blend modes, opacity, transforms, drag-reorder
7. Cinematic FX effects: film grain, vignette, color grade, dirt/scratches, light leaks as FX sequences with timeline range bars
8. 11 quick-task bug fixes and UI polish iterations

**Technical debt carried forward:**

- Coalescing API (startCoalescing/stopCoalescing) unwired in UI
- canUndo/canRedo signals unused for button state
- 07-11 (Add FX button to timeline) listed but never needed

**Archives:** `milestones/v0.1.0-ROADMAP.md`, `milestones/v0.1.0-REQUIREMENTS.md`, `milestones/v0.1.0-MILESTONE-AUDIT.md`
**Phases:** `milestones/v0.1.0-phases/` (Phases 1-4, 3.1, 5-7)

---
