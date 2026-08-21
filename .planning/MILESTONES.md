# Milestones

## v0.9.0 PlayScript Workflow, EFX Paint Audio Preview, and macOS Identity (Shipped: 2026-08-21)

**Phases completed:** 11 phases, 100 plans, 218 tasks

**Key accomplishments:**

- Real EFX Motion Editor release identity shipped: 5 tracked icons regenerated from the approved 794x794 artwork via `pnpm tauri icon`, packaged-icon metadata proven on a fresh unsigned bundle by a D-05 check script reusing release-script logic, and user visual UAT approved across Finder/Dock/Cmd-Tab/DMG.
- Desktop chunk budget pinned at exactly 1100 with resolved-config proof (red at 500 → green at 1100), plus customLogger warning capture and the PhysicsPaintStudio chunk-separation pin in the production build seam.
- D-08 approve-all executed: 4 provably ineffective mixed imports (6 edit sites) converted to static form with preserved call order, 8 deliberate warnings preserved with reasons, and the corrections pinned non-returning by a D-13 subject-path absence assertion in the build seam.
- Locked frame-to-audio truth table with 8 worked offset/trim/slip examples, a RED vitest suite encoding every rule (schema, revision guard, mapping, path-leak), and four user-locked decisions gating the D-04 one-way asset-transport boundary
- One complete monitoring path proven end-to-end in code and tests: the main editor builds a revisioned audioPreview section into the launch payload, Rust passes it through, the child validates/stores it, fetches and decodes track bytes through the efxasset protocol, and plays them at the Paint cursor on Play — with the 41-01 RED suite fully green and the AUDIO-01/D-04 boundaries held by source assertions
- Complete AUDIO-03 sync behavior (silent scrub, loop-wrap re-seek, 40ms-threshold drift corrector, matched-fps note) and the AUDIO-04 push-on-change channel — a main-window signal effect republishes the revisioned audio section on every tracks change, and the child applies newer-only through a single funnel that restarts mid-playback at the current Paint cursor
- First-player-wins doubled-audio arbitration between the main editor and the EFX Paint window — playback-state broadcasts, claim/release events, a suppressed-status note with auto-resume at the live cursor — plus a session-local speaker toggle that silences/resumes monitoring immediately mid-playback and persists nothing
- Release-safe audio monitor lifecycle on EFX Paint close (idempotent stopAll + AudioContext close on both close paths), a D-04-proven single-token connect-src efxasset grant pinned by contract test, and a user-approved 8-step native packaged-app UAT — AUDIO-06 closed and Phase 41 complete
- Static/hold stroke schedule (buildStaticStrokeSchedule/getStaticFrameStrokes) shipped test-first as an additive sibling module in '@efxlab/efx-physic-paint/animation' — every stroke, full point count, every frame — with the progressive module provably byte-untouched.
- Two-mode Play Script generation wired end-to-end test-first: the renderer selects the static/hold schedule by mode and applies the color override post-Motion to paint strokes only, while the controller gains the full session-only option surface — dialog Motion, safe-product Repeat bound, Infinity preserve/restore, loop readout, generation-error lifecycle, and the atomically-composed applied summary that 42-03/42-04 render.
- Two-line read-only Play Script options summary in the Scripts panel (verbatim controller signals, success-only updates) plus a two-mode tooltip, closed by a user-approved native visual UAT of the full phase surface (compact dark modal, live custom color, loop intent, panel summary) on dev and packaged builds.
- Approved playscript-proposal UI adopted: D-16 card grid dialog with a two-state live brush-color control resolving through a confirm-time getBrushColor port snapshot, inline picker fully removed, cycle-only generation and the 42-02 renderer contract byte-preserved
- Loop Clip records persist byte-identically through the four-allowlist gauntlet and join the single canonical revision fingerprint and Undo/Redo snapshot — v0.8.1 documents load unchanged, loop-only edits are revision-visible and undoable
- The physical resolver now derives ONE compact interval record per Loop Clip and answers a lazy per-frame query through the single typed contract real/linked/linked-unresolved/empty — no virtual occurrence is ever materialized, and every consumer guards the union with compile-time exhaustiveness
- The canonical store seams now resolve loops: linked occurrences return the source key's raster under one shared cache identity through getRotoPhysicalRenderSource, unresolved loops surface the typed contract instead of blanking, the end-frame read is loop-aware from the interval derivation, and the bridge commit path is spec-proven to apply records + loopClips atomically under the loopClips-aware revision authority
- Wave 0 hardening specs pinning HOLD-01..04 against shipped Phase 42 machinery — complete-stroke-set materialization, byte-identical held-pose determinism, atomic single-command commits, and one-resolved-raster-per-frame compositing — all green on first run with zero production edits.
- Every existing Roto operation is now loop-safe: source-key deletion, single-key drag, and Force Spacing reject fail-closed with locked copy; rigid whole-cycle drags move original loops while duplicated loops keep their placement; Clear/paint at linked frames materialize local real keys with one-Undo/one-Redo shrink coherence; paste never carries loop identity; and the Play Script confirm path warns `This operation will shorten {N} linked loop(s), starting at frame {F}.` from the shared derivation before committing
- The Play Script dialog now opens in loop-edit mode (Repeat + Infinity + resolver-derived Requested/Effective readout, `Update loop` / `Edit source cycle…`) and source-edit mode (prefilled full form, shared-count notice, `Regenerate source cycle`), every loop operation — Update, Unlink, Duplicate, Repair, Relink, and apply-time Link/Create — rides the ONE staged atomic commit with proven Undo→Redo coherence in both directions, and the capsule badge click reaches loop-edit mode through a typed parent→child bridge message whether the Studio is open or closed
- The main-editor timeline now renders the complete Loop Clip filmstrip capsule — source-cycle thumbnails, zoom-adaptive ghost cells/hatched band, compact math badge, truncation diagonal, and zero-effective anchor flag — as a pure canvas view of the 43-02 resolver derivation, with the main-editor parent-end seam (D-25) closed for both capsule extents and the loop-aware display end frame
- Loop Clip capsules now behave as first-class timeline objects with six hit regions, keyboard focus, exact pinned tooltips, additive Studio link badges, and retry-safe mutations executed exactly once by the canonical Physics Paint Studio controller
- The D-28 split policy is live on the shared typed contract: PNG export fails fast with the locked actionable error before any frame renders when a Loop Clip cannot resolve; preview/playback paint a marked, visible 'loop-placeholder' frame that never blocks and never persists; and a valid loop exports exactly what preview resolves — proven per frame across six parity scenarios through the single canonical store seam
- The sole corrected Phase 43 native checkpoint passed in the user-run development app and unsigned packaged app, and the user explicitly approved the complete phase.
- Loop Clip ownership moved back into Physics Paint Studio through the integrated rail and contextual Scripts inspector, while the Motion Editor retained only passive interval paint.
- The final Loop Clip authoring surface is the integrated rail, styled tooltip, contextual Scripts inspector, and existing Studio-local Edit dialog; the proposed dedicated actions popover is explicitly superseded.
- The Motion Editor now retains only passive Loop Clip interval paint and contains no Loop Clip-specific input, tooltip, focus, selection, navigation, Edit, or mutation route.
- Rejected rich timeline and separate-lane code was deleted, and Physics Paint Studio no longer mounts specialized Loop Clip child listeners.
- Specialized public Loop Clip transport is gone, generic Physics Paint transport remains intact, and the final correction state passes every automated gate.
- A frozen stable-key incoming-break collection now survives strict persistence, canonical revision, parent bridge acceptance, and atomic store installation without allowing malformed or stale proposals to mutate state.
- A stable-key incoming-break projection now powers one fail-closed atomic empty-segment insert, exact lifecycle behavior across physical key edits, and immutable store cache invalidation.
- Stable-key incoming break ownership now persists, passes independent parent validation, settles or rolls back with the complete Roto document, and replays with its key through one Undo/Redo command.
- One existing Insert action now derives its context with Preact Signals, creates a truly blank stable-key segment at empty cursors, and publishes every visible result only after exact parent acceptance.
- Accepted stable break ownership now appears as an exact predecessor-aware description and a compact non-interactive segment cut inside the existing Physics Paint cell geometry.
- Complete regression evidence plus a deterministic close/reopen consumer-boundary fix culminated in stable-session native approval of intentional gaps, local interpolation segments, persistence, scripts, and atomic history.
- Complete Physics Paint sidecar generations now publish through one macOS directory exchange, preserving the prior canonical cache on every pre-publication failure and treating old-generation cleanup as non-authoritative.
- Closed ordinary Roto edit authorization with canonical JSON serialization and deterministic reuse of the sole physical mapping resolver
- Exact stable-key authorization now travels unchanged from every ordinary Roto action through the acknowledged coordinator into the strict parent apply payload
- Every ordinary Roto physical edit is now independently recomputed from parent-authoritative state and must match the complete canonical document before any mutation or replay authorization
- Physics Paint Undo/Redo now requires exact same-authority accepted-command evidence and complete live before/after snapshots while preserving bounded Preact Signals-backed history
- Integrated Plan 07-11 authority and cache-publication checks plus current repository-wide Vitest, typecheck, production build, and whitespace evidence, with native approval preserved unchanged
- Passing Group lifecycle, explicit-range, and six-field participation contracts establish the test-only authority map for the later canonical production cutover.
- Passing source-sharing, exact-frame copy-on-write, atomic rejection, and canonical lease fixtures define the complete Wave 0 safety boundary for later Group production cutover.
- Bidirectional retained-Action recovery contracts, committed-only frontend settlement ledgers, and a machine-validated 41-row frozen-session native acceptance checklist
- Frozen exact-frame Group Paint copy-on-write proposals now cross a parent-authoritative leased publication path with token-checked replacement, exact-once version/history settlement, and atomic rejection
- Lifecycle-complete finite Groups now remain strict and revisioned across canonical parsing, closed transport, sidecar persistence, save/reopen hydration, and exact-once store replacement
- Pure Group lifecycle proposals now preserve immutable cycle phase and complete-document ownership, while the parent bridge independently validates exact leased replacements and the single physical history ledger restores every lifecycle field.
- Exact-frame Group Paint now isolates repeated occurrences through leased copy-on-write, reunites deleted range gaps only after parent acceptance, and publishes one reversible cache/canvas/history outcome.
- Keyboard and visible Delete now share one Group-aware classifier and accessible choice dialog, while one-frame and whole-Group removal settle atomically through the canonical lease with exact reversible history.
- Modified attached Groups now disclose and atomically restore exact saved-Action output through under-lease stale revalidation, true ordered-cycle sharing, synchronized cleanup, and the approved floating G3a confirmation.
- Crash-recoverable Rust Action transactions with closed prepare authority, synced tombstone commits, recovery-gated scans, and cleanup-only idempotent acknowledgement
- Closed TypeScript validators and six correlation-safe Tauri wrappers now expose Rust-owned forward, Undo, Redo, recovery, acknowledge, retained-history, and protected-release states without adding a frontend publication path.
- Lease-protected referenced Action deletion now waits for durable Rust commit, settles one exact local event, and recovers incomplete transactions before Studio/library availability.
- The Actions panel now discloses exact referenced-Group consequences before deletion and remains accepted-only, mutation-gated, diagnostic-safe, and focus-stable throughout durable settlement and recovery.
- The Physics Paint workflow now projects exact Group/Action lifecycle copy onto explicit fragment rails with shared logical selection, passive synchronization dots, linked mode halos, and unchanged strip geometry.
- The Physics Paint Studio now connects stable Groups to their source Actions, paints passive linked Group halos, and provides deterministic non-wrapping linked navigation while preserving explicit operation scope and cursor authority.
- frameMap, Studio preview/playback, and export now resolve one canonical accepted Group lifecycle, including exact overrides, fragmented gaps, immutable phase, detached output, regeneration, and fail-fast unavailable-source handling.
- Phase 43.2 is approved on frozen candidate `2cd4c033`. Full automated gates exit 0 and every mandatory native UAT row carries PASS/APPROVED evidence; the ordinary-key delete guard is user-approved and not reopened.
- Store-authoritative physical-operation leases now exclude competing publication, survive accepted settlement, transfer to recovery ownership, and reactively gate the complete Physics Paint mutation surface.
- Exact retained Action bytes now survive acknowledge, drive durable Undo/Redo authority changes, and release only through owner-bound restart-safe history lifecycle receipts.
- Referenced Action deletion now occupies one immutable history entry whose Undo, Redo, and retained-artifact cleanup are durably correlated through Rust before any local pointer or visible state publication.
- Canonical Group selection now clears ordinary key authority before activation, while a same-layer regression proves stale Delete rejection remains atomic and the corrected Delete Group succeeds without restart or coordinator guard relaxation.
- Authorized Group-scoped Key Spacing now rebuilds complete Repeat 3 lifecycle authority from mapped source timing, preserving stable Group identity and placement through aligned range, rail, coordinator, and history paths.
- Supported finite pre-43.2 Groups now authenticate against their exact historical fingerprint before lifecycle hydration, while changed content retaining the old revision fails closed.
- Passive Action linkage now colors only the existing 3px Motion or Static Group Rail segment, eliminating the 12px target halo while preserving selected orange operation scope and the accepted selection lifecycle.
- Mandatory cursor-aware physical-document transport, lifecycle-complete finite Repeat updates, and direct selection-scoped Group deletion now pass the complete automated gate on frozen implementation `2418ed6c`
- move-group physical-edit intent with strict parser/serializer round-trip, source-attached rigid resolver branch, break-aware prepare/commit publication pair, and a rail drag session hook with paint-only mode-colored ghost
- Pure clamp authority against every D-08 collision boundary with clamp-and-commit, a duplicated shared-source placement-only branch, and 43.1-semantic stable-key-owned break derivation for every vacated or newly opened interval
- Clamped ghost with the red blocked-edge bar, 43.2-identical roto-fill-empty gap preview, locked rejection/acceptance status copy through a single mapper, busy gating, and D-17 post-commit stability
- Regression boundary proven (green gates + three non-modification proofs against 38cf2448), native UAT approved from a frozen-code session, rightward-ghost defect fixed in-phase (constant-width ghost), and the Infinity repeat-resolution failure documented as pre-existing transferred baseline debt with a separate debug.
- Pure Key Rail derivation plus a strict, fail-closed Scissor path from guarded Preact toolbar activation through canonical stable-key break ownership
- A node-testable Preact Key Rail drag state machine with 4px activation, pointer capture, Escape cancellation, click suppression, and injected presentation-only ghost/publication ports.
- Strict Key Rail move/delete transport plus one shared collision clamp, rigid stable-ID translation, and persistent-gap break normalization.
- Exact derived-rail Delete routing with stale-selection defense and one live Preact Signal scope label shared by the visible control's accessible name and tooltip.
- Break-aware immutable Key Rail drag publications now commit exactly once through the coordinator and emit locked moved, gap, or no-space copy.
- Derived ordinary-key segments now render as interactive gray Key Rails with immutable drag previews and mutually exclusive, fail-closed Studio selection.
- Motion Rail and Static Rail now form one coherent shared-Rail vocabulary across labels, accessibility, drag, and deletion feedback, with legacy-copy residue classified and locked Phase 43–43.3 authorities proven byte-clean.
- push-rails intent resolved end-to-end through the pure Roto physical resolver: shared directional set/straddle authority, exported pure push clamp, and 43.1-conformant complete break collection — fail-closed on straddle, boundary, and malformed input
- Non-modal ToolCase toolbox popover with the Interpolation and Key Spacing groups relocated byte-identically into a liquid-glass panel, a live Blend-state badge on the Tools button, and aria-modal-scoped keyboard routing that keeps Delete/Cmd+Z/Escape working while the popover is open
- prepareRotoPush + commitRotoPush + mapRotoPushProductReason delivered: a frozen break-aware publication pair with stale-authority fail-closed commit, the locked push copy family, and one-Undo/one-Redo push history (PUSH-06) proven through the resolver
- usePhysicsPaintPushDrag delivered: a node-testable armed push gesture session with injected ports, 4px horizontal threshold, clamp-and-prepare preview-is-the-commit pipeline, and a fully proven fail-safe matrix — sub-threshold click passthrough (D-09), all cancel vectors, rejection routing, commit-failure focus restore, and once-only click suppression — with direct-drag hooks byte-untouched (PUSH-08)
- Fully interactive Push Right / Push Left armed tools in the freed toolbar space: session-only armed lifecycle with all disarm rules (Select All, lock transition, Escape layering), hover pre-highlight + pivot tick and straddle preflight from the shared resolver derivation, clamped ghost/gap/blocked-edge drag preview paint with live readout, and a real atomic push commit through the wired resolver/coordinator/history ports — with direct Group/Key Rail drag byte-untouched (PUSH-08) and the strip geometry unchanged at 161px
- Session-only multi-rail selection SET as a new explicit selection scope: a pure fail-closed reducer with plain/toggle/range/union gestures over one canonical cross-type ordering, Studio session signals, orange set paint with the anchor tick, the single deterministic set-copy mapper, and the D-06 post-acceptance aftermath carrier
- The batch Move commit authority: exported pure set-derivation + clamp for the explicit rail set, the 'move-rails' intent branch with rigid one-unit translation, set-level clamp/reject, the generalized straddle guard (D-10), 43.3/43.4 break travel (D-11), and fail-closed validation — joined end-to-end through the transport types and the coordinator authorization switch
- The batch Move Rails gesture end-to-end: a port-injected pointer-session hook (template: usePhysicsPaintKeyRailDrag) driving per-member ghost/gap/blocked-edge preview paint, committing the retained clamped publication through the Plan 02 `move-rails` resolver intent as one atomic history command, with the locked live readout, rejection, zero-delta, and Escape-cancel discipline, and the D-06 set aftermath (stay-selected after commit; exact set restore on Undo/Redo via the Plan 01 side-channel)
- Delete Rails end-to-end: one atomic, direct (no-modal), mixed-set deletion with per-type semantics — ONE shared pure proposer composing 43.2 Group delete + Key Rail record removal + 43.4 break normalization, parent-side recompute-and-exact-match validation with distinct error strings, one activation-time classifier shared by keyboard and the visible control, and complete Undo/Redo restoration of the document AND the exact pre-delete selection set
- Key Spacing on a rail set end-to-end: a new 'spacing-on-set' resolver intent with per-rail fixed first-key anchors and hard-wall collisions (all-or-nothing, D-25), the scope-aware ToolCase popover section with one D-27 scope line (D-26), and the locked M5 copy — while the no-set path stays byte-identical to 43.5
- Solo playback end-to-end: a session-only presentation arm that filters the cached-playback frame enumeration to the selected rails' content within their effective frame range — with the strip toggle button, persistent capsule line, and layered exit discipline — while the stopped canvas, preview, export, document, and history stay byte-untouched
- Delete Rails, Move Rails, and Key Spacing on a rail set now record one undoable/redoable physical history command each — the three batch kinds join the ordinary allowlist, closing the silent-drop root cause behind G-43.6-3/4/6/8 (undo/redo part)
- Pure seedRailSetSelection bridge carrying a plain-selected rail into the rail-set anchor on the first modifier gesture, plus synchronous Loop Clip modifier-click commit closing the 250ms Delete-swallow window
- Solo strip button now renders the 43.5 armed orange tint (base-class fix), and the solo playback window is gated on the armed signal so a plain rail selection no longer restricts playback.
- Cross-type rail-set seeding and gesture-aware double-click gating close the last two 43.6 verification gaps: plain-selected rails are carried into sets across rail types, and in-window modifier clicks commit membership synchronously instead of opening the editor.
- Plain Loop Rail click now disarms an armed Solo before the single-rail selection moves, closing the last rail-selection change path that skipped the D-14 exit discipline (REVIEW-WR-01, 43.6-VERIFICATION.md score 8/9 → closed)
- Closed the G-43.6-2 PRIMARY defect: the bridge's delete-rails before snapshot now records the true pre-operation selection from the current document instead of the POST-delete proposal selection, so one Undo restores every rail/key/break AND the exact pre-delete selection set through the real applyPhysicPaintPayload.
- Wired the orphaned releasePhysicalEditRecoveryLease as a best-effort self-heal at the top of executePhysicalEdit, so a stale recovery lease from a failed deferred publication never blocks every later edit until app relaunch.
- Five-surface 0.9.0 version bump (atomic), stale v0.8.1 bundle archival, and all six REL-01 gates green in locked D-03 order with recorded per-gate exit-status evidence
- User-run credentialed v0.9.0 release (RELEASE PASS, notarization Accepted, stapler PASS) and comprehensive signed packaged-app UAT — all 17 spec steps pass in the packaged app, including the Phase 43 signed-artifact boundary, with the two spec divergences recorded, not fixed
- v0.9.0 published as GitHub Latest: draft release created with the DMG, downloaded-artifact verification PASS on a separate download (REL-03), normal install/launch confirmed without Gatekeeper bypass, all 15 stop conditions recorded NOT ACTIVE (D-07), then `gh release edit` published as Latest with the DMG attached and v0.8.1 superseded

---

## v0.8.0 Standalone Physics Paint (Shipped: 2026-08-01)

**Phases completed:** 21 phases (34, 35, 36, 36.1-36.15, 37, 38, 38.1), 170 plans
**Closeout type:** override_closeout — Known verification overrides: 103 open artifacts acknowledged (see STATE.md Deferred Items); 8 phases verified via Phase 36 parent rollup / supersession instead of individual VERIFICATION.md
**Timeline:** 2026-06-08 → 2026-08-01 (54 days) | **Commits:** 1,347 (git range 05944dac → 02fcac7b) | **Files changed:** 2,094 (+363,768 / -152,899)
**Requirements:** 56/56 satisfied | **Audit:** tech_debt (9/9 integration, 6/6 E2E flows, zero blockers)

**Delivered:** `packages/efx-physic-paint` is proven as a standalone interactive physics paint app/window with a deterministic physical-frame Roto timeline, multi-select group operations, Roto Script Play fusion, a durable script library, and render-path performance — with Tauri-native frame sync to the editor timeline.

**Key accomplishments:**

1. Standalone `efx-physic-paint` package proven as an interactive physics paint app/window — independent of editor integration, with a standalone demo shell and full interactive controls
2. Complete Physics Paint Roto system: durable cache core, cell semantics, explicit close behavior, automatic live pixel caching, cached real-key repaint, and cached playback
3. Deterministic physical-frame Roto timeline: canonical model with stable keyIds, integer-gap interpolation, dynamic spacing, and final Pencil-spec UI integration (guarded action row, styled tooltips)
4. Roto Script Play fusion — Play Paint algorithm moved into Roto SCRIPTS, retiring the separate Play workflow; durable script library with JSON presets and WebP thumbnails
5. Multi-select and group operations: group drag, group delete, scoped Force Spacing, group Copy/Paste/Cut — resolved through a single finalizeProposal authority
6. Studio render-path performance: structural/frame-split signal graph making navigation-frame writes O(find) with zero projection rebuilds, plus automatic live pixel caching
7. Tauri-native frame sync (G-01 closure): `physic-paint:seek-frame` listen branch with regression coverage and approved native Tauri UAT

**Plus 20 completed quick tasks**, including automatic live pixel caching (260714-ail), per-brush 10-level Undo/Redo (260715-j3q), Copy/Apply Script (260715-kgf), durable script library (260716-dby), Play fusion (260717-m9k), single-key drag (260718-m2f), Cut tool (260731-9l0), Apple signing preparation (260730-mn0), and the G-01 Tauri frame-sync closure (260801-azb).

**Known gaps / tech debt (audit-accepted):**

- Phase 36.2 intentionally FAILED/SUPERSEDED; Phase 36.6 superseded by quick 260714-ail (automatic live pixel caching)
- Deterministic physical-resolver regression coverage authorized as follow-up test plan (36.14)
- Advisory code-review findings CR-01/CR-02, WR-01..04 routed to follow-up quick (36.14)
- Legacy source/display model still feeds useRotoTimelineActions.getModel (inert dual-model seam); legacy optional fallbacks in rotoOnionPreview/applyCanvas/deleteRotoFrame
- Integration advisories: I-01 dead playScriptMarkers field, I-02 misleading physicPaintPlayScriptBridge.test.ts filename, I-03 dev-only `*` targetOrigin fallback
- Roto cache footprint measurement/compression deferred (PNG alpha encoding exists)
- macOS Developer ID credentialed signed release intentionally deferred post-close (prep complete; docs/macos-signed-release.md)
- 10 phases carry draft Nyquist VALIDATION.md status (coverage TODO, not compliance failure); 11 compliant

Full summary: `.planning/reports/MILESTONE_SUMMARY-v0.8.0.md` | Audit: `.planning/milestones/v0.8.0-MILESTONE-AUDIT.md`

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
