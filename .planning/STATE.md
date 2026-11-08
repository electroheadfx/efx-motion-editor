---
gsd_state_version: "1.0"
milestone: v2.1.0
milestone_name: Rail Motion, Timeline Zoom, Vector Painting & Curve Editing (MINOR)
current_phase: 60
current_phase_name: Studio Timeline Horizontal Zoom
status: planning
stopped_at: Phase 59 complete, ready to plan Phase 60
last_updated: "2026-11-08T18:52:12.582Z"
last_activity: 2026-11-08
last_activity_desc: Phase 59 complete, transitioned to Phase 60
state_head: 5a3063542bb03d720b6a758591404610631c1dcc
progress:
  total_phases: 4
  completed_phases: 1
  total_plans: 25
  completed_plans: 25
  percent: 25
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-11-06 at v2.1.0 open)

**Core value:** Users can import key photographs, arrange them into timed sequences with FX layers, preview in real-time, and export as PNG image sequences — the complete stop-motion-to-cinema pipeline must work end-to-end.
**Current focus:** Phase 60 — Studio Timeline Horizontal Zoom

## Current Position

Phase: 60 — Studio Timeline Horizontal Zoom
Plan: Not started
Status: Ready to plan
Last activity: 2026-11-08 — Phase 59 complete, transitioned to Phase 60

Progress: [███░░░░░░░] 25%

## Performance Metrics

**Velocity:**
- Baseline from the last two milestones: v2.0.1 shipped 10 plans / 248 commits / 3 days; v2.0.0 shipped 26 plans / 1,054 commits / 20 days.
- Full per-plan history lives in `.planning/MILESTONES.md`, the milestone archives, and git.

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 59. Rail Motion Channels & v7 Interface | TBD | - | - |
| 60. Studio Timeline Horizontal Zoom | TBD | - | - |
| 61. Vector Painting Tool | TBD | - | - |
| 62. Painted-Stroke Curve Editing | TBD | - | - |
| 59 | 25 | - | - |

*Updated after each plan completion*
**Per-Plan Metrics:**

| Plan | Duration | Tasks | Files |
|------|----------|-------|-------|
| Phase 59 P01 | 7min | 2 tasks | 4 files |
| Phase 59 P02 | 12min | 3 tasks | 2 files |
| Phase 59 P03 | 55min | 3 tasks | 9 files |
| Phase 59 P05 | 8min | 3 tasks | 8 files |
| Phase 59 P06 | ~10min | 3 tasks | 2 files |
| Phase 59 P04 | ~6min | 2 tasks | 5 files |
| Phase 59 P07 | 21m | 3 tasks | 15 files |
| Phase 59 P10 | 7min | 2 tasks | 8 files |
| Phase 59 P08 | 3h 50m | 3 tasks | 10 files |
| Phase 59 P11 | 28min | 3 tasks | 8 files |
| Phase 59 P09 | 14 | 2 tasks | 7 files |
| Phase 59 P12 | 33min | 4 tasks | 11 files |
| Phase 59 P13 | 7min | 1 tasks | 10 files |
| Phase 59 P15 | 37min | 4 tasks | 17 files |
| Phase 59 P16 | 17 | 2 tasks | 8 files |
| Phase 59 P14 | 22min | 3 tasks | 6 files |
| Phase 59 P17 | 30min | 2 tasks | 11 files |
| Phase 59 P18 | 2min | 2 tasks | 3 files |
| Phase 59 P21 | 3min | 2 tasks | 4 files |
| Phase 59 P19 | 6min | 3 tasks | 8 files |
| Phase 59 P20 | 13min | 3 tasks | 11 files |
| Phase 59 P22 | 58 | 3 tasks | 9 files |
| Phase 59 P23 | 6 | 2 tasks | 7 files |
| Phase 59 P24 | 6min | 2 tasks | 6 files |
| Phase 59 P25 | 12min | 2 tasks | 4 files |

## Accumulated Context

### Decisions

Full log: PROJECT.md Key Decisions. Locked for v2.1.0:
- Motion attaches to ANY rail — Standard, Motion, Static, Reveal, and bare Key Rails — with no cycle value, no conversion, no gating; the durable identity mechanism is Phase 59 planning work.
- Channels: Position (grouped or split X/Y), Scale, Rotation, Opacity — Scale ships despite its absence from the v7 mockup.
- One evaluator; user-facing curves are Hold plus an eased/smoothed interpolation. No B-spline on motion channels.
- The new persisted field is not named `motion`; `PhysicPaintRotoScriptMotionSettings` is a different system and stays unmerged.
- Phase order is fixed: 59 motion → 60 zoom (same pitch expressions) → 61 vector (spike-gated) → 62 painted-stroke curves.
- [Phase 59]: railKind term mirrored in Rust at the TS ordinal; shared frozen golden fixture is the cross-language authority
- [Phase 59]: canonical_physical_source extracted (pure) so a term-order regression names the term, not an opaque hash
- [Phase 59]: rail-motions ordinal reserved between loops and incoming-breaks; not emitted until Phase 59's motion encoder
- [Phase 59]: Rail motion model lives in railMotionModel.ts with module-local guards (no import of physicsPaintRotoPhysicalModel.ts) so 59-03 can import it without a cycle
- [Phase 59]: set-key carries an optional pairedValue for grouped Position inserts; absent, the sibling axis step-holds its outgoing value (D-12)
- [Phase 59]: Grouped Position edits always address both axes: add/remove applies to the pair, and removing a Position key removes that frame from both axes
- [Phase 59]: railMotions is optional on the physical document (16 legacy fixtures omit it); the parser always emits the frozen empty collection at runtime
- [Phase 59]: All seven store revision sites now route through _buildRotoPhysicalRevisionFor (grep count 7 -> 1); the rail-motions canonical term is conditional, so untouched documents keep revision physical-404-c22673ae
- [Phase 59]: Carrier tests share ONE EFX_BASE document because createEfxPaintDocument mints random ids per call; the save/reopen pin uses registerDocument + hydrateRuntimeFromDocument
- [Phase 59]: Rail-motion evaluator is the ONE interpolation authority: every consumer imports evaluateRailMotionChannel and the lane builder samples through it; wiggle is a stateless FNV-1a seeded function of (railId, channel, key frame, evaluated frame).
- [Phase 59]: The evaluator imports the pure TIMELINE_GEOMETRY design-token data module for the 18px pitch (Task 3 single-source rule) instead of a literal; the plan's 'no view imports' wording is superseded and recorded as a deviation.
- [Phase 59]: Rail identity is durable railId only: Loop Clips bind by loopId (no mint), bare Key Rails mint a UUID, anchorKeyId is a recovery hint; the single anchor-based first-bind lookup is confined to assignRailMotionRailViews and orphans are retained, never rebound.
- [Phase 59]: Gate B transitions are pure collection transforms: delete-first-key re-stamps the anchor without rewriting frames, delete-only-key removes the record, split keeps the head railId, merge reports adoptedRailId/droppedRailId, and copy re-key validates the whole plan before cloning and fails closed with null.
- [Phase 59]: Rust canonical_rail_motions mirrors the TypeScript byte format at the reserved ordinal; a present non-array railMotions fails closed instead of being silently skipped
- [Phase 59]: The rail-motion fixture entries were appended from the TypeScript authority after the Rust encoder landed; the three 59-01 expected literals did not move and rail-motion-empty is byte-identical to untouched
- [Phase 59]: The rail-motions ordinal is asserted on the Rust-computed source, so a wrong-branch insertion fails even if the fixture were regenerated
- [Phase 59]: Render-source contentRevision field carries the raster revision; the structural entry and getRotoPhysicalContentRevision stay canonical
- [Phase 59]: Coordinator stages rail motion like loop clips (replay target else launch read) and hashes it into stagedRevision, the deferred document and the payload
- [Phase 59]: Requirements MOTN-01/02/12/REL-03 left pending per the 59-01/02/03/06 precedent; 59-08/59-12 and live UAT close them
- [Phase 59]: Motion lanes fold five model channels into four fixed display lanes; grouped Position exposes the first present axis's shared frames as ONE key set (three shared frames -> three dots and a 3-key header, never six)
- [Phase 59]: Key dots are centred on the frame column (left = frame x cellPitch + (cellWidth - keySize)/2 = +5) per SPECS §2; the plan's 'at frame x cellPitch' is the column anchor, not the literal left edge
- [Phase 59]: TIMELINE_MOTION is a separate token block (motion cell 16x18x3 vs drawing 16x22x3); TIMELINE_GEOMETRY stays untouched so the 59-05 evaluator defaults keep their contract
- [Phase 59]: resolveMotionBlockOutlineRect keeps the documented (rowTop,rowHeight,laneCount) signature: width '100%', height = row + lanes x 18 + 2px postBlockGap, null at laneCount 0; the outline component accepts an optional lineColor for the 59-11 host
- [Phase 59]: The keyless add-channel menu derives from the same display projection and emits position-x for Position so the 59-02 reducer seeds both axes atomically; MOTN-04/MUI-02/MUI-03 stay pending until 59-11 hosts the lanes and live UAT closes them
- [Phase 59]: Rail transform is applied once at the compositor through one shared draw helper used by both draw sites; a second application path is forbidden.
- [Phase 59]: Pivot memo keys on the raster (pixel-identity) revision, so a motion-only edit never re-measures key ink bounds.
- [Phase 59]: The flattened key motion: term carries the collection revision only, emitted when non-empty, so motion-free keys stay byte-identical.
- [Phase 59]: Pixel-array canvas APIs stay out of the store (P4(c)); the bounded alpha scan lives in railMotionInkScan.ts and the store resolves and delegates.
- [Phase 59]: Chevron lives in the header cell; only the ACTIVE track's rail is selectable, so only its header receives the selected rail identity
- [Phase 59]: One measured layout (31px rail row + 18px per display lane + 2px gap) is consumed by content height, header spacers and the reorder index; the active lane hosts the extracted TimelineMotionBlock
- [Phase 59]: 59-09 REL-04: fractional flattened frames compose content at Math.floor(frame) while the rail transform samples the unfloored frame; fractional deliveries bypass the flattened memo and share the integer per-track raster memo
- [Phase 59]: 59-09 MOTN-08: transform parity is asserted against evaluateRailMotion's own output through the test-only getLastAppliedTrackTransforms seam (set after the memo read, cleared with the layer and the store reset)
- [Phase 59]: Motion-key selection lives in a module-scope Preact signal in the timeline-actions hook; no store field was added.
- [Phase 59]: The three selection scopes and their clearing rules live with the rail-set authority; the command layer re-exports them as the one import site.
- [Phase 59]: Hold/Ease/Wiggle are gated by the per-scope command table, so other scopes render no controls rather than disabled ones.
- [Phase 59]: The merge notice is validated in its factory and published through exactly two named writers; the strip reads it only in a leaf component.
- [Phase 59]: Motion-key stepping moves the playhead through the existing synced-frame navigation seam via a deferred ref, not a second navigation path.
- [Phase 59]: Rail-motion Position commits as ONE grouped call via an explicit pairedValue, so the derived sibling can never include outgoing wiggle and overwrite the gesture sample.
- [Phase 59]: The gizmo payload is a computed with a primitive signature used as the canvas-stack memo key, keeping identity-stable deps while re-resolving on motion revisions.
- [Phase 59]: 59-15: reconcile rail motion once in the bridge before stagedRevision and inside store-direct helpers, so motion and undo share one commit
- [Phase 59]: 59-15: paste re-keys from the frozen payload collection via rekeyRailMotionsForCopy with copied source ids, then merges the destination sorted by railId
- [Phase 59]: 59-15: parent paste recompute starts from the pre-edit collection to avoid the child's copies reading as destination collisions
- [Phase 59]: 59-15: merge-drop notice is optional scalar settlement metadata, validated, absent on failure/replay, published after acceptance and dismissed otherwise
- [Phase 59]: 59-15: every accepted edit without a drop dismisses the session slot, so the restoring undo clears the row
- [Phase 59]: 59-16: numeric Motion edits write at the selected key's rail-local frame; the panel stays props-driven with only a ref-held rejection signal.
- [Phase 59]: 59-16: freeEntry + rejection-sequence remount surfaces domain rejections visibly instead of clamping; field and gizmo share writeRailMotionChannelValueAtCursor -> setMotionKeyAtCursor.
- [Phase 59]: 59-16: rotation passes through unwrapped; grouped Position edited one axis at a time with the untouched axis seeded from stored key or evaluator.
- [Phase 59]: 59-14: REL-01 freezes the full app/package.json dependency map at the phase-start commit; resolvability alone would let a transitive or dev package through.
- [Phase 59]: 59-14: REL-02 mocks only the IPC/fs boundary so the real parser recomputes the canonical revision; that is what exposed the projectLayerDocument omission (railMotions is now a revision term).
- [Phase 59]: 59-14: Rust acceptance of a motion-bearing revision is proven by the cargo services::script_library gate and the frozen-source parity pin, not by a TS-side bridge mock.
- [Phase 59]: 59-14: the v7 surface contract asserts both token presence and literal absence because a value-only pin cannot see an inlined copy.
- [Phase 59]: 59-14: live rows stay pending; MOTN-06, MOTN-07 and MUI-01..MUI-05 remain Pending in REQUIREMENTS.md until human evidence.
- [Phase 59]: The 59-02 reducer stays the only seed authority: addMotionChannel validates and delegates, and Scale/Opacity seed at 1 (factor/fraction, 1 = 100%) rather than the plan's display-unit 100.
- [Phase 59]: The keyless menu is session state in one signal with exactly two named writers; the expansion toggle calls dismiss instead of assigning, and the menu paints in an absolute channelMenuZIndex-20 overlay so its open height never enters resolveTrackRowLayout.
- [Phase 59]: Rail-set copy builders feed the parser and the revision from the SAME motion collection; the fail-closed parse is the structural proof they agree.
- [Phase 59]: getRotoRailMotions stays optional with the shared empty constant default, so a hook host without the port keeps the exact motion-free payload.
- [Phase 59]: The Studio motion closure mirrors getRotoLoopClips (launch context in scope, studioActiveTrackId() at call time), never a captured id or memo.
- [Phase 59]: 59-21: present means channel existence on record.channels, never key presence at the read frame.
- [Phase 59]: 59-21: an absent channel keeps its projected identity value and unit; only the affordance changes.
- [Phase 59]: 59-21: the panel owns the refusal copy and one section-level note id shared through ariaDescribedBy; the projection stays copy-free.
- [Phase 59]: 59-21: the field onChange returns before commitMotionValue when present is false, so the zero-commit law holds under direct invocation.
- [Phase 59]: Inject the infinite-rail span as a structural resolver: railMotionIdentity.ts gains no import and its no-resolver default stays byte-identical.
- [Phase 59]: Consult the resolver only for repeat === 'infinity' and Math.max it against the fallback, so a wrong answer cannot shorten a view and a missing injection degrades to current behaviour (T-59-55).
- [Phase 59]: Store, row and hook each build the resolver from the store's own memoized resolution context, so the compositor, lane and gizmo share one end.
- [Phase 59]: physicsPaintRotoRailSetCopy.ts keeps the no-resolver default: copy binds a bare Key Rail's railId by anchor and frames a Loop Clip's motion by loopId.
- [Phase 59]: Removal doors return mergedDrop only when a two-sided merge dropped a record, so a clean removal stays deep-equal to { ok: true }.
- [Phase 59]: Undoability is a session companion signal (railMotionMergeNoticeUndoable), not a fourth notice member: PhysicPaintRailMotionMergeNotice is bridge-validated with a closed key set.
- [Phase 59]: A resize that prunes every clip-owned key omits the emptied clip so its loop-bound motion record is dropped in the same transaction.
- [Phase 59]: The reveal bake substitutes the post-replay clip ownership (old span key -> baked key at the same frame) into its next snapshot so adjacent Key Rail motion is never merged away.
- [Phase 59]: Option B: Loop Clip copy members carry their own sourceEntries (cross-track allocation + same-track frame law) instead of a synthetic key-rail carrier; preserves cross-track paste/duplicate/cut/move.
- [Phase 59]: collectRailMotionGroupOwnedKeyIds is the single group-ownership authority consumed by the reconciler, the copy payload builder, copyTrackSelection and the resolver projection.
- [Phase 59]: The add-channel row's disabled state and reason are the availability authority's only: TimelineMotionBlock calls resolveMotionCommandAvailability once and the view renders the sentence verbatim (no local gate, no copied reason).
- [Phase 59]: A disabled add row has no click handler and forces aria-expanded false, and its menu overlay is gated on the authority's enabled, so a stale session identity cannot open an empty menu.
- [Phase 59]: The strip measures the add row from activeMotionLaneCount > 0 alone, matching the block's render predicate; the second keyless derivation in the strip is deleted.
- [Phase 59]: One code-unit comparator (compareCanonicalIds) now owns every canonical sort in the model; it matches Rust's str::cmp for the ASCII id charset, so TS and Rust cannot produce two revisions for one document.
- [Phase 59]: Golden fixture Loop Clips must carry the explicit six-member persisted lifecycle block: the TS encoder resolves it unconditionally while Rust emits it only under syncState, so a lifecycle-less shared entry would diverge on the loops term.
- [Phase 59-rail-motion-channels-v7-interface]: Grouped Position easing/Wiggle fan out through one per-axis helper: the submitted axis gates the command and is edited first, every follower is re-resolved from the previous edit, and no pairedValue is passed so a keyless sibling is seeded by D-12 from its own stepped value (WR-04).
- [Phase 59-rail-motion-channels-v7-interface]: Every rendered motion-lane curve is built with the lane's own { railId } so the drawn wiggle seed is the compositor's seed; the test asserts the two seeds differ before asserting which one rendered (WR-03).

### Pending Todos

None yet.

### Blockers/Concerns

- Phase 59 planning must answer Gates A-D before 59.1: rail identity for motion-bearing bare Key Rails, rail-local time + repeat, quality at scale (measured), and the sub-frame law for motion-blur export.
- `.mce` paint-field enforcement does not exist yet — `mceFieldContract.test.ts` covers `Mce*` interfaces only while the paint document rides as `HashMap<String, Value>`; motion persistence needs a dedicated load → save byte-identical round-trip pin.
- Four persistence carriers must move as one change or motion silently fails: `serializeRuntimeIntoDocument`, `encodeValidatedEfxPaintTrackContent`, `buildEfxPaintDocumentSyncFingerprint`, and the layer change token (this defect class already cost PKG-06 and BKG-09).
- Phase 61 is spike-gated: per-vertex watercolour feasibility (segment runs vs payload extension) before the data model is locked.
- v2.0.1 debt carried in PROJECT.md Context: VIS-02/04 token drift, mixed rail-set header accent, the one-shot prompt's pending window, and the unconfirmed 261105-p9i live native UAT rows.

## Deferred Items

Items acknowledged and carried forward from previous milestone close:

| Category | Item | Status | Deferred At |
|----------|------|--------|-------------|
| Persistence | DF-01: `.mce` save and fixed-path Physics Paint cache publication are not one cross-resource transaction | Non-blocking `NEW_SCOPE_FROM_VERIFIER` | Phase 43.1 closure, 2026-08-10 |
| Persistence | DF-02: native cache publication does not sync the containing directory after rename/exchange | Non-blocking `NEW_SCOPE_FROM_VERIFIER` | Phase 43.1 closure, 2026-08-10 |
| Loop Clips | DF-03: provenance-only Loop Clip replacement can be treated as a no-op | Non-blocking `NEW_SCOPE_FROM_VERIFIER` | Phase 43.1 closure, 2026-08-10 |
| Security | DF-04: browser frame-sync does not authenticate `postMessage` origin, source window, or launch identity | Non-blocking for Phase 43.1 | Phase 43.1 closure, 2026-08-10 |
| macOS distribution | Developer ID signing, notarization, stapling, and Gatekeeper validation | Preparation complete in quick 260730-mn0; credentialed release scheduled for v1.0.0 Phase 53 | v0.8.0 closure |
| Architecture | Headless batch adapter replay / editor-driven renderFromStrokes / forceDryAll path | Excluded | v0.7.0 failure post-mortem |
| debug_sessions | studio-blend-off-corruption | awaiting_human_verify | 2026-10-12 (v1.0.0) |
| debug_sessions | studio-track-physical-edits | fix-applied | 2026-10-12 (v1.0.0) |
| todos | 261003-d08-tier-parity-harness-rescope.md | (presence-only) | 2026-10-12 (v1.0.0) |
| quick_tasks | 260905-ibd-perf-stop-per-frame-workflowstrip-action | unknown | 2026-10-12 (v1.0.0) |
| quick_tasks | 260911-sli-surface-armed-solo-on-the-track-row | unknown | 2026-10-12 (v1.0.0) |
| quick_tasks | 260913-52r-52-2-cutover-regressions-f-e-c-d | missing | 2026-10-12 (v1.0.0) |
| quick_tasks | 260920-j5r-wr-01-52-3-guard-scrub-gap-entries-must- | unknown | 2026-10-12 (v1.0.0) |
| quick_tasks | 260920-k34-fond-preload-gate-export-must-read-the-a | unknown | 2026-10-12 (v1.0.0) |
| quick_tasks | 260924-m7w-quick-8b-physics-stroke-settles-bolder-t | incomplete | 2026-10-12 (v1.0.0) |
| quick_tasks | 260924-nqe-quick-8c-redo-bound-the-physics-settled- | incomplete | 2026-10-12 (v1.0.0) |
| quick_tasks | 260924-ort-water-coupled-deposit-cutoff-in-transfer | incomplete | 2026-10-12 (v1.0.0) |
| quick_tasks | 260924-pyp-measure-production-s-continuous-aa-raste | incomplete | 2026-10-12 (v1.0.0) |
| quick_tasks | 260928-dh1-paint-deposit-debug-kill-the-pixel-speck | unknown | 2026-10-12 (v1.0.0) |
| quick_tasks | 260930-wm6-sans-cuisson-kill-the-post-stroke-cookin | automated-ready | 2026-10-12 (v1.0.0) |
| quick_tasks | 261009-6ee-audio-modal-grouped-field-layout-shared- | unknown | 2026-10-12 (v1.0.0) |
| quick_tasks | 261009-v0s-audio-properties-panel-re-flow-timeline- | unknown | 2026-10-12 (v1.0.0) |
| uat_gaps | 46/46-UAT.md | testing | 2026-10-12 (v1.0.0) |
| uat_gaps | 47/47-UAT.md | passed | 2026-10-12 (v1.0.0) |
| uat_gaps | 50/50-UAT.md | passed | 2026-10-12 (v1.0.0) |
| uat_gaps | 53/53-UAT.md | unknown | 2026-10-12 (v1.0.0) |
| verification_gaps | 46/46-VERIFICATION.md | human_needed | 2026-10-12 (v1.0.0) |
| verification_gaps | 47/47-VERIFICATION.md | human_needed | 2026-10-12 (v1.0.0) |
| verification_gaps | 52.1/52.1-VERIFICATION.md | human_needed | 2026-10-12 (v1.0.0) |
| verification_gaps | 36.2/36.2-VERIFICATION.md | gaps_found | 2026-10-12 (v1.0.0) |
| deferred_items | 52.2/deferred-items.md: Deferred Items — Phase 52.2  Out-of-scope discoveries found during execution (not caused by this phase's plans; do not fix here).  - **WINDOWS.md ledger coun... | acknowledged | 2026-10-12 (v1.0.0) |
| deferred_items | 52.5/deferred-items.md: 1. Pre-existing typecheck errors — `ToolType '"move"'` (3 errors)  - **Found during:** 52.5-01a Task 1 GREEN (full `pnpm --filter efx-motion-editor run typec... | acknowledged | 2026-10-12 (v1.0.0) |
| deferred_items | 52.5/deferred-items.md: 2. Pre-existing test suite failure — `PhysicsPaintStudioView.test.ts` (collection error)  - **Found during:** 52.5-01a Task 1 GREEN (full `vitest run`: 4443 ... | acknowledged | 2026-10-12 (v1.0.0) |
| debug_sessions | roto-unknown-physic-layer | awaiting_human_verify | 2026-11-02 (v2.0.0) |
| debug_sessions | script-playback-draws-nothing | awaiting_human_verify | 2026-11-02 (v2.0.0) |
| todos | 261024-frame-fade-compositing.md | (presence-only) | 2026-11-02 (v2.0.0) |
| quick_tasks | 261105-p9i-extend-rail-with-key-or-paint-inside-mot | unknown — code landed (`8bf0ab4ed`, `715c9c155`) and audit-verified; live native UAT rows unconfirmed | 2026-11-05 (v2.0.1) |

### Quick Tasks Completed

| # | Description | Date | Commit | Directory |
|---|-------------|------|--------|-----------|
| 261107-mkn | Fix Phase 59 UI: channel header rows in the pinned left header column, Animate channel menu, Motion boundaries tool and animate mode (UAT approved) | 2026-11-07 | b5cb501e1 | [261107-mkn-fix-ui-from-phase-59-rail-motion-channel](./quick/261107-mkn-fix-ui-from-phase-59-rail-motion-channel/) |
| 261107-pd8 | Motion channel keys draggable through time on the Phase 59 rail (reuses the shared key-rail drag session); selected-rail lane inset line removed (UAT approved) | 2026-11-07 | bc92429ef | [261107-pd8-draggable-motion-key-from-phase-59-rail-](./quick/261107-pd8-draggable-motion-key-from-phase-59-rail-/) |
| 3 | Studio: end-justify the Animate channel-menu button on the bottom action row; grey it out (aria-disabled) until a rail is selected | 2026-11-07 | 904743666 | — |
| 261107-qgj | Move the Motion values out of the sidebar Scripts tab into a floating Motion sheet; present channels only, Stroke settings slider rows, header Reset pins the identity pose, one close path restores the previous paint tool (UAT approved) | 2026-11-07 | 615f38acd | [261107-qgj-move-all-the-motion-values-from-sidebar-](./quick/261107-qgj-move-all-the-motion-values-from-sidebar-/) |
| 261107-rrp | Cycle + Motion on Studio rails: a cycle conversion preserves the rail's motion; the Motion span auto-fits the resolved rail extent (extends with keys/cycles, shrinks with them); out-of-band keys are preserved-but-inactive (UAT approved) | 2026-11-07 | ff6d6714d | [261107-rrp-cycle-with-motion-in-studio-adding-a-cyc](./quick/261107-rrp-cycle-with-motion-in-studio-adding-a-cyc/) |
| 261107-sg3 | Move the Hand tool out of the Studio tool rail into the floating canvas zoom pill — press-and-hold: hold the Hand button and move the mouse or pen to pan like middle-mouse drag, release stops | 2026-11-07 | 5973f30e5 | [261107-sg3-move-hand-tool-to-canvas-tool-for-zoom-p](./quick/261107-sg3-move-hand-tool-to-canvas-tool-for-zoom-p/) |
| 7 | Allow Studio canvas zoom to go below the Fit value (fit 40% can view 20% or less) | 2026-11-07 | 2ff2692a2 | — |
| 8 | Set Studio canvas region (.physics-paint-canvas-region) background to #222529 | 2026-11-07 | 093f16f76 | — |
| 261107-tfp | Size the Studio rail-motion canvas boundary box to the displayed drawing key's alpha ink (per key; generated keys use the flanking union), with the full-raster fallback for empty or unmeasurable keys (UAT approved; ink measured on opaque transmittance sheets) | 2026-11-07 | 68d7d1cc2 | [261107-tfp-ui-boundaries-from-phase-59-rail-motion-](./quick/261107-tfp-ui-boundaries-from-phase-59-rail-motion-/) |
| 261107-ux2 | Rail motion first span never interpolated: add-channel seeded its opening key with easing hold, so frames between the first two paint keys held while later spans eased; the opening seed now eases (regression tests pin frame 2 = the exact midpoint) | 2026-11-07 | 3138361ad | [261107-ux2-rail-motion-first-span-never-interpolate](./quick/261107-ux2-rail-motion-first-span-never-interpolate/) |
| 261108-d5o | Rail Motion: add stop-motion and linear easings, make stop-motion the default for new lanes and keys, expose per-key easing in the floating Motion sheet, and glyph all four easing buttons (supersedes 261107-ux2 ease seed; UAT approved 2026-11-08) | 2026-11-08 | 86cea6ebd | [261108-d5o-new-ease-motion-from-phase-59-rail-motio](./quick/261108-d5o-new-ease-motion-from-phase-59-rail-motio/) |
| 261108-gh0 | Rail Motion: lucide easing icons on the sheet and every lane key, tool-strip easing/wiggle removed, per-channel whole-timeline wiggle with a persisted Global flag, Keys table with [Key N]/[All] targets, project-scaled wiggle sliders, sectioned auto-height sheet (UAT approved 2026-11-08) | 2026-11-08 | 94b246ed7 | [261108-gh0-rail-motion-follow-up-lucide-easing-icon](./quick/261108-gh0-rail-motion-follow-up-lucide-easing-icon/) |
| 261108-kvw | Canvas motion-path overlay for rail Position: read-only dashed authored route, key dots and cursor marker in animate mode (UAT approved) | 2026-11-08 | 4893ee9ee | [261108-kvw-canvas-motion-path-overlay-for-rail-posi](./quick/261108-kvw-canvas-motion-path-overlay-for-rail-posi/) |
| 14 | Deps bump: preact 11.2.0, xstate 6.0.0-beta.1; removed Matt Pocock skills and .efx-planning | 2026-11-08 | 4128c27e6 | — |
| 261108-nq0 | Phase 59 cycle rail bug: + Key / paint inside a cycled one-key rail now dissolves the Loop Clip and lands the key joined to the rail (one continuous rail, no stale-document errors, no split; UAT approved 2026-11-08) | 2026-11-08 | 7de46add1 | [261108-nq0-phase-59-cycle-rail-bug-adding-a-key-ins](./quick/261108-nq0-phase-59-cycle-rail-bug-adding-a-key-ins/) |
| 261108-o9d | Cycle create is serialized behind a still-settling physical edit instead of dropping with 'Group update was not dispatched.'; clamp and validators unchanged (UAT approved 2026-11-08) | 2026-11-08 | bf4d80e28 | [261108-o9d-creating-a-cycle-with-10-frames-fails-wi](./quick/261108-o9d-creating-a-cycle-with-10-frames-fails-wi/) |
| 261108-pmc | Rail cycle delete: Delete on a cycle (repeat) cell is refused; deleting a real key on a cycled rail dissolves the Loop Clip in the same atomic edit instead of leaving a suppressed key; the parent bounds canonical clips like the child, closing the `(loop-clips)` parent rejection (UAT approved 2026-11-08) | 2026-11-08 | ae54c7502 | [261108-pmc-cycle-delete-on-rail-does-not-update-cyc](./quick/261108-pmc-cycle-delete-on-rail-does-not-update-cyc/) |
| 18 | Onion tab sliders use the shared SliderStepper (native ranges overflowed the right sidebar) | 2026-11-08 | e066b97b9 | — |

## Roadmap Evolution

- Phase 59: Rail motion channels + v7 interface (v2.1.0, first free global number; Phase 57 retired and never reused)
- Phase 60: Studio timeline horizontal zoom (inserted after 59 — shares the frame→pixel pitch expressions)
- Phase 61: Vector painting tool (spike-gated on per-vertex watercolour feasibility)
- Phase 62: Painted-stroke curve editing (depends on Phase 61's editing surface)

## Session Continuity

Last session: 2026-11-08T18:55:00.000Z
Stopped at: Phase 59 complete, ready to plan Phase 60
Resume file: None

## Operator Next Steps

- Phase 59 is complete (25/25 plans, live UAT 15/15, verification 21/21). Next: `/gsd-discuss-phase 60`, then `/gsd-plan-phase 60` — Studio timeline horizontal zoom (frame density only, session-only, no document/schema/export change).
- Phase 59 was the only phase in this milestone that changes `.mce`; Phase 60 must not touch the schema.
