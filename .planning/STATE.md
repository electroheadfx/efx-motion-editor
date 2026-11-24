---
gsd_state_version: "1.0"
milestone: v2.2.0
current_phase: 64
status: completed
stopped_at: Phase 64 complete — all phases complete
last_updated: "2026-11-24T13:22:40.459Z"
last_activity: 2026-11-24
last_activity_desc: Quick 261124-iq9 UAT approved (two-media brush convention)
state_head: f5da7c094bb8cc3ed59f7bdef633ed98961fc6c2
progress:
  total_phases: 2
  completed_phases: 2
  total_plans: 48
  completed_plans: 48
  percent: 100
milestone_name: Brush Tips & Medium Engine (Planned)
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-11-22 after Phase 64)

**Core value:** Users can import key photographs, arrange them into timed sequences with FX layers, preview in real-time, and export as PNG image sequences — the complete stop-motion-to-cinema pipeline must work end-to-end.
**Current focus:** Milestone v2.2.0 complete — ready for `/gsd-complete-milestone`

## Current Position

Phase: 64
Plan: Not started
Status: All phases complete
Last activity: 2026-11-24 — Quick task 261124-iq9: the Studio brush convention is now two media and twelve responses. `MediumId` is exactly `watercolor | acrylic`; the acrylic record keeps its id and every parameter and is displayed as **Gouache** (the old gouache/pastel/graphite media are deleted). `BRUSH_PRESETS` is exactly the eleven watercolor responses plus `bristle-round`, renamed **Gouache**; Gouache Round/Flat, Bristle Flat and every Chalk/Graphite response are deleted. Viscosity and Water are hidden for the Gouache (acrylic) paint context on BOTH the Paint panel and the Studio top bar through one shared `isAquarelleParamRowVisible` selector; the Water tool keeps Viscosity and the Eraser keeps Lift. Removed recorded response ids resolve through `presetFor`'s shipped unknown-id fallback to `round` — no migration, no back-compat, no hidden registration. Gates: package targeted + full suite, package check + build, full app suite (466 files / 9861 passed, 2 pre-existing skips), app tsc, structural counts 12 presets / 2 medium records. UAT-APPROVED (artist-confirmed 2026-11-24) — six UAT rows passed: the Medium dropdown lists exactly Watercolor and Gouache with the Gouache deposit, Brush + Gouache hides Viscosity and Water on both the Paint panel and the top bar, Brush + Watercolor restores both, the Water tool keeps Viscosity, the brush library shows only Watercolor (11) and Gouache (1), and an older project renders through the round fallback. Previous: 261124-gfy (UAT-APPROVED) — Roto clipboard actions grouped behind a Raster|Script toggle; key identity block pinned.


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
| 60 | 6 | - | - |
| 61 | 31 | - | - |
| 62 | 5 | - | - |
| 63 | 17 | - | - |
| 64 | 31 | - | - |

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
| Phase 60 P01 | 11min | 3 tasks | 9 files |
| Phase 60 P02 | 6 | 3 tasks | 3 files |
| Phase 60 P03 | 4min | 3 tasks | 9 files |
| Phase 60 P04 | 12min | 3 tasks | 12 files |
| Phase 60 P05 | 9min | 3 tasks | 6 files |
| Phase 60 P06 | 3 | 3 tasks | 1 files |
| Phase 61 P01 | 19min | 3 tasks | 4 files |
| Phase 61 P02 | 3min | 3 tasks | 3 files |
| Phase 61 P08 | 9min | 3 tasks | 11 files |
| Phase 61 P03 | 6min | 3 tasks | 7 files |
| Phase 61 P04 | 14 | 3 tasks | 6 files |
| Phase 61 P05 | 7min | 3 tasks | 4 files |
| Phase 61 P06 | 3min | 2 tasks | 3 files |
| Phase 61 P07 | 23 | 3 tasks | 28 files |
| Phase 61 P09 | 10min | 3 tasks | 6 files |
| Phase 61 P10 | 16min | 3 tasks | 12 files |
| Phase 61 P13 | 15 | 3 tasks | 13 files |
| Phase 61 P11 | 13 | 3 tasks | 6 files |
| Phase 61 P12 | 17min | 3 tasks | 10 files |
| Phase 61 P14 | 7min | 3 tasks | 2 files |
| Phase 61 P15 | 6min | 2 tasks | 5 files |
| Phase 61 P16 | 7min | 2 tasks | 4 files |
| Phase 61 P17 | 5min | 2 tasks | 8 files |
| Phase 61 P18 | 6min | 2 tasks | 6 files |
| Phase 61 P19 | 9min | 2 tasks | 6 files |
| Phase 61 P20 | 5 | 2 tasks | 2 files |
| Phase 61 P21 | 6 | 2 tasks | 6 files |
| Phase 61 P23 | 3 min | 2 tasks | 2 files |
| Phase 61 P24 | 8 min | 2 tasks | 8 files |
| Phase 61 P22 | 4min | 2 tasks | 4 files |
| Phase 61 P26 | 7 min | 3 tasks | 2 files |
| Phase 61 P25 | 9 min | 3 tasks | 7 files |
| Phase 61 P27 | 7 min | 3 tasks | 8 files |
| Phase 61 P28 | 3 min | 2 tasks | 2 files |
| Phase 61 P29 | 7 min | 3 tasks | 3 files |
| Phase 61 P30 | 10 | 2 tasks | 15 files |
| Phase 61 P31 | 11min | 3 tasks | 10 files |
| Phase 62 P01 | 22min | 3 tasks | 10 files |
| Phase 62 P02 | 16min | 3 tasks | 13 files |
| Phase 62 P03 | 10min | 3 tasks | 6 files |
| Phase 62 P05 | 6min | 3 tasks | 8 files |
| Phase 62 P04 | 9 | 3 tasks | 9 files |
| Phase 63 P01 | 5 min | 3 tasks | 7 files |
| Phase 63 P02 | 8min | 3 tasks | 7 files |
| Phase 63 P03 | 4min | 2 tasks | 7 files |
| Phase 63 P09 | 3min | 2 tasks | 2 files |
| Phase 63 P04 | 11min | 2 tasks | 16 files |
| Phase 63 P05 | 71min | 3 tasks | 15 files |
| Phase 63 P06 | 49 | 3 tasks | 8 files |
| Phase 63 P07 | 18 | 3 tasks | 9 files |
| Phase 63 P08 | 8 | 2 tasks | 6 files |
| Phase 63 P10 | 6min | 3 tasks | 5 files |
| Phase 63 P13 | 3 min | 2 tasks | 3 files |
| Phase 63 P14 | 3 min | 2 tasks | 1 files |
| Phase 63 P11 | 29min | 2 tasks | 4 files |
| Phase 63 P12 | 8min | 2 tasks | 4 files |
| Phase 63 P15 | 9min | 3 tasks | 6 files |
| Phase 63 P63-16 | 11 | 2 tasks | 4 files |
| Phase 63 P17 | 4min | 2 tasks | 4 files |
| Phase 64 P01 | 7min | 3 tasks | 11 files |
| Phase 64 P02 | 14min | 3 tasks | 10 files |
| Phase 64 P03 | 11 | 3 tasks | 6 files |
| Phase 64 P11 | 9 | 2 tasks | 8 files |
| Phase 64 P04 | ~1h 12m | 3 tasks | 10 files |
| Phase 64 P06 | ~11m | 3 tasks | 11 files |
| Phase 64 P12 | 7 | 2 tasks | 2 files |
| Phase 64 P05 | 6 | 3 tasks | 8 files |
| Phase 64 P08 | 7m | 2 tasks | 9 files |
| Phase 64 P07 | ~2h10m | 2 tasks | 13 files |
| Phase 64 P10 | 6min14s | 3 tasks | 9 files |
| Phase 64 P09 | 1h 49m | 2 tasks | 7 files |
| Phase 64 P13 | 6min21s | 2 tasks | 8 files |
| Phase 64 P17 | 32min | 3 tasks | 10 files |
| Phase 64 P14 | 12min51s | 3 tasks | 13 files |
| Phase 64 P15 | 10min | 3 tasks | 14 files |
| Phase 64 P16 | 16 | 3 tasks | 9 files |
| Phase 64 P18 | 48min | 2 tasks | 9 files |
| Phase 64 P20 | 41min | 3 tasks | 17 files |
| Phase 64 P64-19 | 12min | 2 tasks | 10 files |
| Phase 64 P21 | 13min | 3 tasks | 20 files |
| Phase 64 P22 | 13min | 3 tasks | 18 files |
| Phase 64 P23 | 26min | 3 tasks | 13 files |
| Phase 64 P24 | 14min | 3 tasks | 22 files |
| Phase 64 P25 | 8min | 2 tasks | 2 files |
| Phase 64 P26 | 6 | 3 tasks | 9 files |
| Phase 64 P27 | 3 min | 2 tasks | 4 files |
| Phase 64 P28 | 5min | 2 tasks | 6 files |
| Phase 64 P29 | 24min | 3 tasks | 4 files |
| Phase 64 P30 | 3 min | 2 tasks | 5 files |

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
- [Phase 64]: The shipped alpha law: committed and exported storage alpha is OPAQUE; the display alpha is the DARKNESS of the visible pigment; coverage lives only in the coverage raster (a probe-only instrument, never an export channel). Probe coverage claims read the coverage raster; the paper-white census reads the engine-cleared pigment alpha (review CR-02).
- [Phase 64]: Body is bag-only (no UI row) and the acrylic law plans 64-32..64-38 are deferred by the 2026-11-22 artist ruling — their only mandate was UAT rows 11-14, which were never authoritative. Do not change the acrylic render/Feather/Pickup/Body/anti-aliasing against those rows.
- [Phase 64]: Authoritative UAT 14/14 pass (2026-11-22); security 136/136 threats closed; verification 206/206 must-haves (31 plans). The deferred plans live in `phases/64-medium-engine/deferred/`.
- [Phase 59]: Rust canonical_rail_motions mirrors the TypeScript byte format at the reserved ordinal; a present non-array railMotions fails closed instead of being silently skipped
- [Phase 59]: The rail-motion fixture entries were appended from the TypeScript authority after the Rust encoder landed; the three 59-01 expected literals did not move and rail-motion-empty is byte-identical to untouched
- [Phase 59]: The rail-motions ordinal is asserted on the Rust-computed source, so a wrong-branch insertion fails even if the fixture were regenerated
- [Phase 59]: Render-source contentRevision field carries the raster revision; the structural entry and getRotoPhysicalContentRevision stay canonical
- [Phase 59]: Coordinator stages rail motion like loop clips (replay target else launch read) and hashes it into stagedRevision, the deferred document and the payload
- [Phase 60]: One session pitch authority (`physicsPaintTimelineZoom.ts`) owns pitch/cellWidth/cellGap/ruler step/anchoring; every consumer reads it, and a fail-closed source audit forbids a local `x 18`
- [Phase 60]: The anchored scroll write is deferred one frame — the browser clamps `scrollLeft` against the pre-render width, so a same-task write loses the anchor near the right edge
- [Phase 60]: Cell widths ride the `--timeline-cell-width` custom property (scroller publishes it) so cells, ruler offsets, the in-between dash and the current-frame marker all scale from one value
- [Phase 60]: Zoom density is a UI preference remembered per paint layer in localStorage (the Studio webview is destroyed on close), LRU-capped at 64 layers; it never enters the document
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
- [Phase 60]: D-12: one render-body metrics read in the strip; lane extent, cells grid, ruler step/tick basis, both rails and playhead derive from the live pitch
- [Phase 60]: D-05/D-08: continuous exponential wheel zoom with one-frame rAF coalescing and epsilon no-op writes; wheel anchors on the cursor, pill/Fit on the playhead centre
- [Phase 60]: D-01/D-04: the zoom pill lives in the always-visible static chrome; percent is display-only and Fit is a one-shot action with no aria-pressed
- [Phase 60]: The registered viewport getter divides by peeked live pitch (60-03's intended end state landed early); the legacy strip constant stays as the 1x drag scaffold until 60-02/60-03 convert
- [Phase 60]: D-12 interaction consumers: pointer handlers peek the 60-01 pitch authority at event time; only the render body subscribes; ghosts use live-pitch one-cell floors
- [Phase 60]: Cross-track drag port receives the pre-scaled framePitch with zoom undefined (Pitfall 6), so the pitch applies exactly once
- [Phase 60]: ZOOM-05 stays open after 60-02: sound stains, open/reveal scroll, rail geometry and the motion-lane insertion line remain for 60-03/04/05
- [Phase 60]: Sound leaves subscribe to the metrics in their own bodies while the live band preview peeks at event time; the strip body gains no zoom read for them
- [Phase 60]: Open-frame and reveal positioning peek the live pitch inside their effect bodies and keep dependency arrays byte-identical to HEAD (Pitfall 13)
- [Phase 60]: frameGap is an optional parameter defaulting to TIMELINE_GEOMETRY.cellGap at every new seam; the strip always passes timelineMetrics.cellGap to both rails
- [Phase 60]: ROTO_CELL_WIDTH_PX is retired from the strip; RULER_STEP remains the ruler's no-subdivide floor
- [Phase 60]: framePitch/frameGap stay required with no default in the lane, drag leaf, block and row so TypeScript enumerates every consumer
- [Phase 60]: The outline resolver keeps optional cellPitch/cellGap defaulting to the base tokens, preserving existing callers while the block forwards live values
- [Phase 60]: The key-drag leaf reads laneProps.framePitch through the existing latestRef and adds no hook or subscription
- [Phase 60]: Pre-existing exact-count source pins were repointed to >= 2 when three legitimate pitch consumers joined, not deleted
- [Phase 60]: ZOOM-05 is executable: timelineZoomAuthorityAudit scans view/ and hooks/, permits exactly two owners, and fails on a third allowlist entry
- [Phase 60]: The audit runs every rule on comment-stripped code and proves each against a seeded positive plus a comment-only negative
- [Phase 60]: Every named consumer has a presence block with exact counts where enumerable (five strip pitch/gap sites); the wave-4 >= 2 pins returned to toBe(5)
- [Phase 60]: The ruler-scrub cellWidthPx is required with no fallback; the strip passes timelineZoom.metrics.peek().pitch at event time
- [Phase 60]: Expected values live only in the frozen five-level table; helpers produce actual values only, so the implementation is never its own oracle
- [Phase 60]: toBe for exactly-pinned values; toBeCloseTo(...,10) only on the documented non-exact audio range; wheel factors compare against Math.exp
- [Phase 60]: Scroll-to-frame has no helper: the matrix restates the centring law and (frame+1)x pitch guard as a literal local predicate, cross-linked to 60-03's source pin
- [Phase 60]: Store block resets scale in beforeEach and unregisters the port before and after every test
- [Phase 60]: Selection/paste compare frame indices; their pixel surface is the rail/ghost geometry already pinned by 60-02 task 3, recorded in the header instead of a fabricated row
- [Phase 60]: 13-row edge-probe table is literal data with exact-length, exact-id and non-empty-owner assertions, both unclassified rows owned
- [Phase 61]: Seam strategy is payload-extension with replay density 4x: measured seam step 0px at 4x vs 4.141px for segment runs, settling at the 0.5px improvement law.
- [Phase 61]: Reference stroke count is 10 at 1920x1080: 50 strokes cost 4035.6ms against the 33ms responsiveness budget.
- [Phase 61]: Width channel is scriptFactor on sizeMult, measured 1.75x (12px->21px radius) against the 1.7x gate; the scriptBegin scriptScale clamp measures 1.0x and is C-03 evidence only.
- [Phase 61]: Vector auto handles are (n·P ∓ Δ)/n with n = 6 interior and n = 3 at the endpoints — one rounding per handle pins the golden rationals (4/6, 8/6) and keeps hydrate re-derivation bit-identical
- [Phase 61]: anchorWidthAt reads an absent factor as the default 1 at that anchor's own station, so interpolation, the hold-at-ends law and D-10's sparse storage are one definition
- [Phase 61]: The determinism contract scans src/vector with a zero-file guard naming spine.ts; spine.ts imports nothing, so REL-01 and the engine-1 direction pins are untouched
- [Phase 61]: The vector pen is a host tool: vectorPathSession signals live outside AquarelleTool, paint tool presses clear the pen at the two input seams (rail onClick, Studio handleSelectAquarelleTool) to avoid an aquarelleRecordState -> vectorPathSession -> aquarelleStrokeSelection import cycle.
- [Phase 61]: WatercolorRail is exported for the plain .test.ts vnode walk because vitest collects only src/**/*.test.ts; the pen also joins the one-active-surface law (!penActive) in the paint row.
- [Phase 61]: 61-03: the vector path rides the existing opaque engine block (anchors + renderMode), so the host generic contract is untouched and the host still never reads P.
- [Phase 61]: 61-03: conditional spreads in toStudioStroke keep the nine pre-vector engine keys literally identical and add exactly one key for a mode-only stroke (D-14 independence).
- [Phase 61]: 61-03: anchorsEqual treats a difference of exactly 1e-9 as unequal (|a-b| < 1e-9 means equal); vectorPathsEqual resolves an absent mode to watercolour.
- [Phase 61]: 61-03: projectVectorPath drops a width key equal to ANCHOR_WIDTH_DEFAULT and never clamps a non-default factor (1.8 and 0.3 pass through), order-preserving and non-mutating (D-10).
- [Phase 61]: 61-03: codec validation lives in isStrokeShape and canonicalisation in cloneStrokeForWire; AQUARELLE_SCHEMA_VERSION stays 1 because the two fields are optional additions whose absence is the documented state.
- [Phase 61]: The per-sample width factor rides the queued sample (Sample.w + Stroke.widthFrom/widthTo); the plan's artifacts-table row 'private scriptWidth' is deliberately not implemented because a mutable engine field would stamp late samples with a later neighbour's width (T-61-13 pin asserts the identifier never appears).
- [Phase 61]: sizeMult(widthFactor) multiplies the existing footprint beside the unchanged 'this.scripting ? this.scriptScale : 1' term; the scriptScale clamp assignment stays character-for-character and appears exactly once (Engine.ts:866).
- [Phase 61]: resolveStrokeWidthFactors derives one Float32Array per active stroke at activation (applyStroke/renderAllStrokes/renderPartialStrokes) and feeds it by active.index; null means the feed passes the literal 1 and the uniform path deposits byte-identically.
- [Phase 61]: The width probe paints at canonical size 32 (engine scale 1.0): at 12px the widest-row radius is paper-grain-limited (observed 1.6-1.75) and cannot discriminate the 1.7 gate; 32px measures 35px->60px = 1.714 deterministically, while the committed phase-evidence digests stay 2058d0c6.
- [Phase 61]: AQTL v2 costs a hand-painted stroke one u8 vector-flags byte (version keeps its u16 width); the plan's '+2' prose double-counted the version bump, the layout table fixes 1
- [Phase 61]: Anchor scalars are f32: fixtures use Math.fround(1.8) with exact deep equality plus a 1e-6 tolerance check; absent optional keys are never materialised on decode
- [Phase 61]: Restore seeds anchors/renderMode only when the payload carried them; a malformed anchor list omits the path for its event instead of aborting the restore
- [Phase 61]: 61-06: the vector anchor/path shapes are declared in both languages, and the field contract test is the definition of done — not a follow-up review step
- [Phase 61]: 61-06: the Rust in-handle is in_ + #[serde(rename = "in")] because the contract parser reads pub <ident>: and a raw identifier would be silently invisible
- [Phase 61]: 61-06: ALLOWED_ONE_LANGUAGE is snapshotted literally in the test, so allowlisting a new field is a deliberate edit rather than silent growth
- [Phase 61]: 61-06: Rust anchor scalars are f32 to mirror the AQTL v2 wire, while the neighbouring declaration-only structs stay f64
- [Phase 61]: 61-07: the render mode is explicit stroke data (Stroke.renderMode; scriptBegin argument wins, interactive seeds from the brush) and is never inferred from a parameter value.
- [Phase 61]: 61-07: the ribbon branch sits inside the existing stamp path with the seven wet globals as independent weights; the preset keeps neutral brush-side multipliers so a raised global still reaches the deposit (D-13).
- [Phase 61]: 61-07: the record-time stamp writes renderMode only when non-default, so a plain hand-painted stroke keeps its pre-phase key set; the eraser popover filters render-mode presets through one pure helper.
- [Phase 61]: 61-09: The width envelope draws only for a non-uniform profile (D-10), with VECTOR_ENVELOPE_BASE_UV = 0.02 x sheet height as display-only base half-width; baked thickness stays the brush radius.
- [Phase 61]: 61-09: renderMode resolves from resolveRenderModeForBrushId(aquarelleBrushForActiveTool().brushId) at finish time so the commit can never disagree with the recorded brush.
- [Phase 61]: 61-09: Stroke assembly is the pure buildVectorStroke(commit, source); AquarelleCanvasLayer supplies live values and forwards once to the existing onStrokeEnd seam (one revision bump).
- [Phase 61]: 61-09: Recorded vector paths stay visible with root pointerEvents none while the pen is released; the window key listener binds only while the pen is active.
- [Phase 61]: 61-09: Preact onDblClick (real dblclick) finishes the path; a real double-click's second pointerdown is absorbed by the adjacency refusal, so no duplicate anchor is appended.
- [Phase 61]: 61-10: Alt is read per pointermove so the handle-coupling break applies mid-drag; each move recomputes from anchorsAtStart.
- [Phase 61]: 61-10: A spine click is a completed insert gesture at pointerdown (insert, select, ONE onPathEdit), not a drag state.
- [Phase 61]: 61-10: mapAnchorList returns undefined for an absent list and maps only stored handles, so hand-painted strokes gain no anchors key and auto anchors no invented handles.
- [Phase 61]: 61-10: Translate/transform rebuild the payload entry's engine.anchors from the same mapped list, so the payload never carries a stale path (T-61-34).
- [Phase 61]: 61-10: The Studio path-edit handler publishes the fixed rejection line only for a missing/unreadable path; a readable-path null (in-flight or unchanged) publishes nothing.
- [Phase 61]: 61-10: Geometry edits never re-roll the paint seed — beginAquarellePathEdit omits bumpAquarellePaintSeedSalts.
- [Phase 61]: Wireframe generalises Draft: ON forces Draft on before the latch flips; OFF clears only the latch and joins the ONE settleDraftScript promise, single-flight (61-13).
- [Phase 61]: Wireframe construction geometry is read-only: VectorPathOverlay draws envelope/spine/rungs/anchors/handles, ScriptStrokeOverlay draws hand-painted bands via buildStrokeBand and skips recorded vector strokes (61-13).
- [Phase 61]: Gated controls state their reason in title; the Draft switch stays ON and inert because the latch owns the only exit; E7 overflow remains a flagged assumption at the Wave 0 count (61-13).
- [Phase 61]: The path-edit gate reads vector-ness through ONE bundle member (readVectorAnchors): the dialog never touches the record store, and the same read feeds the gate, the width reading and the px readout.
- [Phase 61]: A closed gate or a close both request exitPathEdit through the shipped lifecycle effect; the render body only sets a plain module marker, so no signal is written during render and the sheet keeps exactly two effects.
- [Phase 61]: The Anchor width factor is a per-anchor multiplier, not an appearance param: the block mounts as the Size row's sibling and never enters WATERCOLOR_SETTINGS_FIELDS or readNumericField/buildAppearancePatch.
- [Phase 61]: Render mode is a stroke property: the batch mutator reads no anchors, so a malformed anchor list never refuses a mode change and no write creates, drops, copies or normalises an anchor list (D-12/D-14).
- [Phase 61]: An unknown render mode refuses the whole batch through strict isAquarelleRenderMode membership instead of coercing to the watercolor default; an absent mode still counts as already-watercolor so no pre-phase stroke gains a key.
- [Phase 61]: The ribbon preset pick runs its wet-globals law BEFORE selectAquarelleTip's identity early-return: snapshot the seven values only when the memory is empty, zero them in ONE aquarelleParams write, and restore plus clear on any later non-ribbon pick.
- [Phase 61]: The Advanced wet-globals disclosure is a ref-held local dialog signal written only from its click handler (no third useEffect) and mounts only for a simple-ribbon selection, so watercolor mode keeps today's Paint tab.
- [Phase 61]: 61-14 test-only close-out: task.is-behavior-adding=false, so the behavioural TDD gate does not apply and no feat commit was fabricated.
- [Phase 61]: 61-14 reopen parity runs through restoreAquarelleRecordTimeline, and the cache case reuses ONE document because createEfxPaintDocument mints fresh ids per call.
- [Phase 61]: The vector re-bake sequence clears its in-flight latch before the terminal callbacks, so a failed path edit can restore its pre-edit snapshot without being refused by its own latch.
- [Phase 61]: commitAquarelleVectorPathEdit reads draftMode/wireframeMode only after ensureAquarelleDurableBaseRef resolves and only via .peek(); Draft or wireframe defers the engine re-render and marks the pixels dirty.
- [Phase 61]: A Script-Off vector draw is refused before the ledger allocates and without a sheet reset; an accepted draw tails exactly one bakeAquarelleVectorCommit() after the record and the lift erase.
- [Phase 61]: The pointer capture releases AFTER the commit decision, never in a finally: a capture release must not be able to swallow an edit
- [Phase 61]: isTextEntryTarget is a new DOM-free leaf rather than a refactor of the Studio's isPhysicsPaintShortcutTarget, so the overlay stays callable from a node-environment test
- [Phase 61]: The two false history-entry titles are renamed, not deleted: the assertions keep proving one edit snapshot per gesture and one undo
- [Phase 61]: 61-17: the pen, path-edit and anchor-selection latches moved to the dependency-free vectorPathLatches leaf and are re-exported by vectorPathSession (signal identity pinned), so the Select and picker choke points import the leaf without an evaluation cycle.
- [Phase 61]: 61-17: Select and picker entry release the vector pen and close any path edit (entry edge only, never the exit edge); Select entry is refused outright while the wireframe view is on (D-16).
- [Phase 61]: Wireframe refusal mirrors the dirty-pixel refusal in the one setDraftMode guard; the ON edge is untouched
- [Phase 61]: The settle guard publishes only the message and error status, never setLastError nor an owned refusal: a refusal is not a failed apply
- [Phase 61]: WIREFRAME_SETTLE_REFUSED_MESSAGE is owned by the edition leaf and imported at the end of the Studio block to keep the shipped 61-13 exact import pin byte-unchanged
- [Phase 61]: 61-19: resolveAnchorWidthTarget fails closed on a selection/edit mismatch, an absent edit, an empty session id or a non-integer id, so the width commit refuses with no write, re-bake or ledger entry
- [Phase 61]: 61-19: the dialog shadows its reading to ANCHOR_WIDTH_EMPTY_READING on a null target instead of adding a second availability boolean, keeping disabled and caption one branch
- [Phase 61]: 61-19: one caption span serves both inert reasons, branching only the child so the testid-before-style ordering and the shipped no-style pin stay true
- [Phase 61]: 61-19: the Studio's width commit routes through the shared commitAquarelleVectorPathEdit, keeping exactly one beginAquarellePathEdit in the file
- [Phase 61]: 61-20: Both ledger record sites live inside commitAquarelleVectorPathEdit (the one writer) — the defer branch records before setDraftPixelsDirty(true), the re-bake onSuccess tail records before setLastError(null) — so delegating vector routes can never double-count; a draw records nothing
- [Phase 61]: 61-20: The commit depends on the stable rotoMoveHistory.recordAquarelleScriptEdit useCallback, never the per-render wrapper (efx-preact-reactivity §4); the failure route restores the snapshot and records nothing
- [Phase 61]: The draw cursor writer is the session's one preview write: compare-then-write, anchors carried by reference, returns whether anything changed — a pointer move can never place or commit an anchor (D-06)
- [Phase 61]: The provisional rubber band reuses sampleVectorPath with the draft anchors plus an auto cursor anchor and renders before the committed spine; the test expects the sampler's own output, never a hand-drawn chord
- [Phase 61]: The capture-phase yield is renamed isKeyboardOwnedTarget over ONE duck-typed ten-token selector; the five shipped text-entry pins were retargeted with unchanged expectations and plain div/canvas targets keep today's keys
- [Phase 61]: The picker guard lives in the ONE computed verdict, not in each consumer — the visor, rail chip and brush-ring gate need no change
- [Phase 61]: isAquarellePickerArmed reads the three signals directly instead of a computed peek, so the dispatch-time probe is never stale (T-61-71)
- [Phase 61]: An Alt arming write is refused during an open path edit; a release always lands so no hold leaks past the edit
- [Phase 61]: The vector terms ride conditional spreads exactly like toStudioStroke, so a hand-painted event keeps its pre-vector key set and an absent vector field stays absent (no anchors: undefined)
- [Phase 61]: +Key copies the script RECORD-ONLY inside the addEmptyKey success continuation: the cloned bytes already equal base-script, so applying would double-paint, and a copy rejection can never reach the shipped add-failure message
- [Phase 61]: One recordAquarelleScriptCopyForFrames seam serves both Duplicate and +Key; the Studio pin asserts exactly one copyAquarelleScriptToFrame call site
- [Phase 61]: G-11: the Anchor width block is extracted into ONE AnchorWidthControl declared after the sheet component; the list view and the Paint tab mount the same stepper, clamp and commit seam
- [Phase 61]: G-11: the list-view mount gate is anchorWidthAvailable && a Size reading of the same ids (anchorWidthListVisible); a multi-selection or anchorless stroke mounts nothing
- [Phase 61]: G-11: the selected-anchor ring is a pure render output of a sixth renderPath parameter fed drawn.selected ? selection : []; only the open edit path wears rings and the palette gains no colour
- [Phase 61]: Shift+A refuses up front on wireframeMode before any read or write, then re-checks aquarelleSelectMode after the entry attempt — the entry choke point stays authoritative rather than being duplicated
- [Phase 61]: The WR-02 failure tail re-anchors the attempted side before the revision-authoritative restore, so the routine bumped-revision failure rolls back for real while a foreign mutation still fails closed
- [Phase 61]: The path-edit failure capsule ternaries on the consumed restore result (restoreAquarelleEditSnapshot !== null), keeping the apply error ahead of it — a refused rollback can no longer claim a restore
- [Phase 61]: The WR-03 draw site consumes the bake boolean through .then((baked) => { if (!baked) setDraftPixelsDirty(true); }): a refused in-flight bake arms the ONE stale-sheet invariant and publishes no capsule
- [Phase 61]: Four shipped Studio pins were repointed, never deleted, at the mandated consuming forms (three restore markers + the stroke-end TAIL), preserving every ordering assertion and strengthening the TAIL with the vector-guard and stale-arm pins
- [Phase 61]: The pen tooltip is the Copywriting Contract string verbatim in a module-scope VECTOR_PEN_TOOLTIP constant — the phase's only draw-law teaching surface cannot drift inline again
- [Phase 61]: Under wireframe the Picker is disarmed, not disabled: the wireframe term left disabled={railDisabled}, the shipped title stays, and every depositing control keeps its deactivation reason
- [Phase 61]: Both envelope branches share one band law (color ?? SELECTED_SPINE_COLOR at 0.14/0.07 fill, 3.5/1.5 edge, no strokeOpacity); ENVELOPE_FILL_OPACITY was deleted and handle dots are solid with only the connector translucent
- [Phase 61]: The wireframe-only chrome suppression was deleted outright — bounds box and serial badge render for every non-lift entry, the wireframeOnly binding is gone, and comments cite §6 item 6
- [Phase 61]: The width readout is a declared span with exactly the four BrushResponsePanel properties; both explanation strings are 600 and the italic red Mixed stays the only 400
- [Phase 61]: 61-27: shouldExitPathEdit compares pathEditMutationId !== String(selectedMutationId) — the same string forms resolvePathEditGate.pressed uses — rather than coercing either id
- [Phase 61]: 61-27: the lifecycle effect dependency is the render-body pathEditTargetMismatch boolean, so the effect stays marker-driven and no signal write enters a render body
- [Phase 61]: 61-27: resolvePathEditGate was left target-blind — target awareness on the gate would permanently disable the Edit path button when no edit is open
- [Phase 61]: 61-27: the settle and Anchor width refusals publish through setApplyMessage/setApplyStatus('error')/setLastError but never claim scriptApplyRefusalOwnedRef, so no surface swallows another's message
- [Phase 61]: 61-27: publishRefusal is optional on StrokeSettingsDialogBundle, keeping the shipped silent fallback and the dialog engine-free
- [Phase 61]: 61-27: three shipped pins were repointed, never deleted — the 61-13 Studio import marker and two dialog commit-call literals — preserving every behavioral assertion
- [Phase 61]: The edit-lifetime effect keys on the primitive editMutationId and compares String(drag.mutationId) === editMutationId, covering edit close and retarget with one law; the live-drag early return precedes every clearing step
- [Phase 61]: A start-of-gesture reset runs before the target check in startEditDrag, so a press that hits nothing still ends the previous gesture and the CR-01 phantom-commit path is closed
- [Phase 61]: Target guards in continueEditDrag/finishEditDrag perform no cleanup — the effect owns it — and sit before every preview write and onPathEdit, leaving the T-61-30 clear-before-commit order untouched
- [Phase 61]: G-17 root cause confirmed at the path write: updateAquarellePathInScript carried the stale points through the spread while toStudioStroke projects points into the replay's pts; the write now re-derives the spine from the projected anchors after the idempotency return
- [Phase 61]: Re-derived vector points carry buildVectorStroke's exact six-field stamp (p 1, tx 0, ty 0, tw 0); the overlay points assertion was retargeted to the sampled law, never deleted
- [Phase 61]: 61-30 (G-20): spline is an EVALUATION MODE over the same anchor list, never a third anchor kind and never a rewrite of authored data; an absent curveMode reads bezier so every pre-existing document stays byte-identical, and switching back drops the key
- [Phase 61]: 61-30 scope (user decision at the plan checkpoint): per-stroke curveMode mirroring the shipped per-stroke renderMode in every layer; the document-level variant was rejected and the one-way persistence consequence accepted for projects that use the switch
- [Phase 61]: 61-31: per-stroke curveMode behind an explicit Paint-tab row (never document-level); availability reads vector === true so hand-painted-only selections show no row and mixed selections convert only vector strokes
- [Phase 61]: 61-31: the Studio hydrates curveMode/vector in a SECOND .map() pass so the shipped 61-12 render-mode source pins stay byte-identical
- [Phase 61]: 61-31: the draft always draws DEFAULT_AQUARELLE_CURVE_MODE and the recorded loop draws each stroke's own mode — a spline path never inherits the edit target's mode
- [Phase 61]: 61-31: under Spline wasPromoted is false (promotion returns the list untouched) so a grab-and-release commits nothing; chrome shape follows ownership per 61-UI-SPEC §340-341, including the 61-22 selection ring
- [Phase 61]: Quick 261111-ucf: every brush pick and paint-control release now commits onto the selected paint strokes through one aquarellePaintControls seam (filter 'paint'); the patch carries the POST-pick bag, Reset is one seven-key batch, and lift strokes are never addressed
- [Phase 61]: Quick 261111-wd6: per-vertex colour is a sparse anchor `color?` — absent means the stroke colour, and a colour equal to the stroke colour is stored only when the user set it; RGB is lerped between neighbouring anchors so the wash never steps at a sample boundary
- [Phase 61]: Quick 261111-wd6: per-vertex SIZE stays the shipped anchor width factor relabelled "Vertex size" — no second size channel was introduced, and VEC-04's former "width is the only per-vertex property" law is superseded by explicit user direction
- [Phase 61]: Quick 261111-vg4: Stroke Settings is Geometry | Stack only; the Curve row and the Vertex size control both mount in Geometry while the list view keeps its own Vertex size mount
- [Phase 61]: The simple-ribbon engine and the `renderMode` field were deleted rather than migrated (payload, engine branch, shaders, preset, adapter, probe, AQTL byte, Rust model); the decoder still skips the legacy byte so older scripts load
- [Phase 61]: Vector strokes replay as a mouse stroke with speed owning the pressure at a hand's cadence — a flat synthetic pressure read as a dead stroke beside hand-painted work
- [Phase 261112-lq4-ui-stroke-vector-modal-redesign]: Quick 261112-lq4: Stroke settings is one always-visible List | Geometry | Stack | Curve tab row; List is the watercolor default, Stack stays gated on reorderStroke, Curve on one selected vector stroke, and the active tab is a pure derivation with no write-back (a requested Curve returns after a dip); the list/settings view gate, its ref, marker and model helpers are deleted; the single Vertex size mount, Curve row and Corner row live in Curve; Edit path and Preview stroke size moved to the Draft strip
- [Phase 62]: Painted-stroke conversion reuses the existing updateAquarellePathInScript seam through a new options argument: anchors, absent-key default curveMode and re-derived points land in ONE write, ONE revision bump and ONE ledger entry.
- [Phase 62]: The fit is interpolating, never approximating: Douglas-Peucker on the original samples with tolerance equal to PATH_SAMPLE_STEP_UV, a pi/4 cumulative-turn pass, then a deterministic 40-anchor cap (bounded tolerance doubling, index decimation last).
- [Phase 62]: Every edit seam preserves the recorded sample count (the count IS ticks) and remaps recorded pressure by source arc length with both ends pinned; the draw-time mint is untouched and all-sentinel strokes stay sentinel.
- [Phase 62]: Eligibility resolves the vector arm first via normaliseAquarelleAnchors; anchors present but unreadable fail closed.
- [Phase 62]: Admission reuses the eligibility verdict, so the gate and the ONE writer seam can never disagree.
- [Phase 62]: Entry arms the durable base through the shipped armDraftBase before fitting; a refused arm publishes the fixed refusal and opens nothing.
- [Phase 62]: The dirty exit branch settles once when the user had no wireframe, or keeps the deferred render behind the user's own wireframe (D-14).
- [Phase 62]: resetForStudioOpen closes path edit through exitPathEdit so the reset route reaches the one exit hook.
- [Phase 62]: 62-03: record anchors outrank the armed held fit (recordAnchors ?? heldFitAnchors), so a committed gesture's write is instantly the edit target
- [Phase 62]: 62-03: the held fit draws in resolveAquarelleCurveMode(stroke.curveMode) for BOTH anchor sources; DEFAULT_VECTOR_PATH_CURVE_MODE stays the draw-time mint only
- [Phase 62]: 62-03: the original spine ghost is display chrome over the immutable session snapshot and vanishes with the session (T-62-11 fails closed on non-finite samples)
- [Phase 62]: 62-03: D-09 discriminates on recorded samples (any finite p >= 0), never a persisted flag; the all-sentinel mouse profile keeps the shipped anchor-width envelope as the documented exception
- [Phase 62]: 62-03: renderPath draws ONE envelope ring from drawn.envelopePx ?? projection.envelope, fed by the shipped revision|width|height-keyed buildStrokeBandCached
- [Phase 62]: 62-03: the shipped 61-25 uniform-profile fixture moved to the all-sentinel profile — the ONE profile D-09's exception leaves under D-10's law
- [Phase 62]: D-11: buildRotoRealCacheRevision is the ONE production statement of the real-source identity; all store/remap/persistence sites route through it byte-identically.
- [Phase 62]: The paper cache term stays a verbatim suffix (no separator, no normalization), preserving every shipped persistence key.
- [Phase 62]: CRV-03 edge probes and the D-11 source-only pin are test-only over shipped seams and landed GREEN by construction; no RED was fabricated.
- [Phase 62]: Cancellation is a synchronous predicate re-read at the produce and commit turns (the isStillCurrent precedent): the commit-turn read wins over a successful or rejected apply, and the latch is released in finally before any terminal
- [Phase 62]: Undo during an immediate path-edit bake cancels the token, awaits that exact bake and replays its exact editId with one reanchor retry — never a stack pop, because the cancelled run wrote no ledger entry
- [Phase 62]: The ONE production registerPathEditExitHook registration lives in a dedicated [settleDraftScript] effect beside the mount reset, with a detaching cleanup; the deferred route arms no epoch
- [Phase 62]: UAT: the Studio registers its ONE painted entrance in a latch slot (registerPaintedCurveEntrance); the canvas double-click route fails closed when no host is mounted and never writes a selection it cannot honour
- [Phase 62]: UAT: a pre-conversion fit previews AND stores DEFAULT_VECTOR_PATH_CURVE_MODE (Spline), so what the user sees on entry is the mode the first commit persists
- [Phase 62]: UAT: select-then-move — a press that changes vertex selection is a completed selection gesture (no drag state, no capture, no document write); the drag starts on the next press of an already-selected vertex
- [Phase 62]: UAT: vectorDrawn is stored provenance, not derivable state — codec flag bit 4 carries no payload byte, the `.mce` declares it in both languages, and the Duplicate/+Key copy seam carries it so a copy cannot reclassify a drawn path
- [Phase 62]: UAT: the stroke list filters by category (Vector, Brush/Water/Pen-Vector, plus the four tools) and the Curve tab shows the selected vertices' effective colour read-only — the sidebar picker stays the ONE colour writer
- [Phase 62]: Review round 2 (incremental, base c27dea58b) fixed CR-01 the copy seam dropping vectorDrawn, WR-01 the unguarded entrance promise, WR-02 the AQTL header still documenting only bits 0-3, WR-03 the undeclared `vectorDrawn` in the MCE mirror; 4b26cc5eb
- [Phase 63]: deriveMask fails closed on any length other than 36,864 before allocating; the alpha branch scans first and never consults RGB
- [Phase 63]: normalizeMaskContrast is exported but never called from deriveMask (bake-only by law), pinned by a source-level test
- [Phase 63]: replaceMaskRegistry clears then installs valid entries individually (D-18); resolveMask returns the exact registered array (identity contract)
- [Phase 63]: buildBrushForStroke resolves the registry before the preset lookup; D-08 multipliers apply identically to masked and preset bases (D-21/D-22)
- [Phase 63]: Brush asset stem hashes the stored WebP bytes, not the source mask, so a copy is verifiable without decoding (63-02)
- [Phase 63]: decode_mask_webp gates declared dimensions from the header before decode_rgba; WrongSize and Undecodable are separate rejection labels (63-02)
- [Phase 63]: Batch brush reads degrade per entry to five fixed reasons and never reject the call; save copies the stored WebP bytes without re-encoding (63-02)
- [Phase 63]: brushes/ is a sibling bound-guard branch with its own parser; the frames MEDIA lock is provably not widened (63-02)
- [Phase 63]: Built-in bake is an env-gated vitest authoring step: BAKE_BUILTIN_TIPS=1 runs sips -> BMP parse -> deriveMask -> normalizeMaskContrast and writes builtinTipMasks.generated.ts; the gate unset leaves exactly one named skipped test and performs no IO
- [Phase 63]: builtinTips.ts owns one private D-07 definition list; BUILTIN_TIPS (catalog surface) and BUILTIN_TIP_MASKS (registry surface) derive from it, so ids and labels cannot drift
- [Phase 63]: maskRegistry seeds from BUILTIN_TIP_MASKS at module load and resetMaskRegistry() is replaceMaskRegistry(BUILTIN_TIP_MASKS), so reset restores exactly the three built-ins with the same allocations (D-20)
- [Phase 63]: 63-09: the fresh-profile copy is fs::copy-only (one encode at setup) and the copy is re-validated through read_brush_asset, never trusted because it copied
- [Phase 63]: 63-09: create_project_dir never provisions brushes/ (D-20); pinned by an assertion plus a recorded reason, green-by-construction with no fabricated RED
- [Phase 63]: Engine-boundary mirror: packages/efx-watercolor is built standalone by tsup and cannot import app/src, so pack.ts owns a local brushes/<64 hex>.webp predicate; the app parser at intake and the Rust bound guard remain independent re-validations (T-63-15)
- [Phase 63]: aquarelleBrushCatalog lives in app/src/stores/ rather than PATTERNS.md's component path because both realms import it; recorded as a deliberate relocation in the module header
- [Phase 63]: Brush change token is brush:<relativePath> with the digest as value, so an import always forces its own change entry while a second identical save is an empty change set
- [Phase 63]: 63-05: the cross-realm brush catalog travels as ONE replace-only snapshot (customs + decoded masks + stored WebP + unavailable ids); the Studio receiver pulls on mount so a webview re-booted by a layer switch repopulates without a new import
- [Phase 63]: 63-05: brush imports run only in the main realm; the injected catalog publisher is awaited so the catalog push strictly precedes the correlated result across the Tauri event bus
- [Phase 63]: 63-06: unavailable project tips are the catalog store's one replace-only set; the library renders greyed disabled cards plus exactly one aggregate warning line (D-19).
- [Phase 63]: 63-06: every preview cache (footprint signature, stroke thumb, tipImage tinted canvas) keys on maskGeneration(), so a mask replaced under an unchanged id is never served stale.
- [Phase 63]: 63-06: the import toolbar row decodes in the Studio realm and registers through requestPhysicPaintBrushImport; the library never appends to the catalog itself.
- [Phase 63]: Unavailable brush tips stay LISTED with null digest/mask so the library greys them; only invalid-entry records are unlisted, and invalid-asset-ref records are recovered by dropping the asset member (63-07 / D-18).
- [Phase 63]: The catalog publisher is a store hook (_setBrushCatalogPublisher) installed by the main-realm bridge installer, because physicPaintBridge imports projectStore and a direct import would cycle; every applied open and every reset publishes through it (63-07 / TIP-17).
- [Phase 63]: closeProject bumps the open-request token so an in-flight open cannot apply, hydrate or publish over the closed project (63-07 / T-63-21).
- [Phase 63]: 63-08: the script save leg refuses by name when a custom tip's stored mask bytes are missing from the Studio realm instead of dropping the mask.
- [Phase 63]: 63-08: structurally malformed script carriers (cap, dimensions, base64, mask/asset members) refuse the whole document at parse time; native-decode and registry failures degrade one entry with a named log.
- [Phase 63]: One project-tip admission law: normalizeProjectBrushTip lives in efxPaintBrushSet.ts and is called by both the open loader and the catalog payload producer; isCustomTipWire and its member-key list stay byte-for-byte unchanged, so the senders conform instead of the guard being relaxed.
- [Phase 63]: The built-in-id refusal reads the RAW id before record validation, so a malformed record still logs invalid-entry while a well-formed entry naming one of the three shipped tips logs the named reason builtin-id.
- [Phase 63]: WR-01's stated root cause is refuted on the current tree: physicPaint.ts's decodeBase64OrNull already resolves to its own total base64ToBytes, not webpBytes.ts's throwing converter; the totality pins landed green by construction (63-03 / CRV-03 precedent, no fabricated RED) and the guard-boundary try/catch was applied as defence-in-depth.
- [Phase 63]: buildProjectBrushPack keeps the whole-list fast path; the per-entry walk runs only on refusal, the first entry of a duplicate id wins, each dropped tip is logged by id and class, and null is returned only when nothing survives.
- [Phase 63]: builtinMasksById (id -> exact BUILTIN_TIP_MASKS allocation) is built once at module load and is the single authority for both mask-registry write laws; the reserved set derives from BUILTIN_TIP_MASKS alone and is never widened (WR-05).
- [Phase 63]: replaceMaskRegistry admits a built-in id on IDENTITY, not bytes: an equal-byte copy under wc/builtin-* is logged and skipped, because a copy is not the shipped allocation (T-63-31).
- [Phase 63]: registerMask refuses a reserved id BEFORE the writable check and before any mutation, so a refused registration bumps no generation and the log names the real reason; a refused built-in entry in replace installs nothing and the appliers' built-ins-first prefix preserves the shipped allocations.
- [Phase 63]: 63-14: BRUSH_ASSET_MAX_READ_BYTES (16 MiB) is checked from fs::metadata on the canonicalized leaf after the extension check and strictly before fs::read, so an over-cap asset is refused without its bytes ever being allocated (WR-06 / T-63-32).
- [Phase 63]: 63-14: the cap refusal stays EfxPaintMediaError::Io so read_one_brush_asset maps it to the existing BRUSH_READ_UNREADABLE per-entry reason — no sixth wire string, no whole-batch failure; the boundary is strict greater-than and both ends are pinned with sparse-file fixtures.
- [Phase 63]: brushCatalogSynced flips true inside applyBrushCatalogPayload's existing batch behind a compare guard and resetAquarelleBrushCatalog deliberately leaves it true: a post-close catalog is empty-but-known, not un-delivered
- [Phase 63]: Only an id the open marked in unavailableTipIds may skip per entry with a log; an unmarked missing body still refuses with the established no-stored-mask-bytes reason
- [Phase 63]: referencedCustomBrushIds reads engine.brushId (the tip id), never the top-level brushId the serializer stamps with the engine id; dry events carry none
- [Phase 63]: The save-law refusal splits on brushCatalogSynced: an unsynced realm names the missing project catalog, a synced-but-uncarried id is named with both causes; both refusals precede serialization so no save request is written
- [Phase 63]: 63-12: the publish is a notification, not part of the answer — the bridge injects a caught port (returned, not voided, to keep request→catalog→result order) and the handler logs a rejecting or throwing publish while still answering {ok:true, entry} (D-15, WR-04)
- [Phase 63]: 63-12: one total producer plus one total emitter make all three brush-import registrations rejection-free — a handler throw answers {ok:false, reason:'encode-failed'} through both the Tauri listener and the window CustomEvent path (WR-04)
- [Phase 63]: 63-12: TIP-01's 36,864-byte mask boundary is pinned at both seams — the wire guard refuses 36,863/36,865 and the handler refuses 36,865 before any IPC or publish
- [Phase 63]: 63-15: AQTL v3 appends engine.textureId presence-prefixed after the vector block and before pointCount (minimal pointCount 74->75, vector 118->119)
- [Phase 63]: 63-15: AQTL bumped to v3, v1/v2 refused with unsupported-version (no migration reader); stale v2 .snap caches refuse whole, track starts empty - accepted
- [Phase 63]: 63-15: codec carries ids verbatim (shape validation only); lift policy stays at the single projection toStudioStroke:207
- [Phase 63]: 63-15: absence stays absent on decode - engine rebuild adds textureId only when presence marker is 1
- [Phase 63]: 63-15: Studio texture pick remains realm-session state; restoring it after a realm reset is a separate UX decision, deferred
- [Phase 63]: CR-02 closed with a binding-scoped refusedRestore latch read in prepareSave before deps.write, not a backup artifact.
- [Phase 63]: Latch set by both refusal arms and never by missing; cleared only by bind/reset, a successful restore, or a successful sessionOnly purge commit.
- [Phase 63]: WR-12: inner unsupported-version AQTL becomes container code aqtl-retired with a pinned named notice; no migration reader (no-backward-compat law).
- [Phase 63]: CR-03: the close refusal is keyed on a controller latch episode (bind-incremented withheldEpisode + pure admitsWithheldClose gate) instead of a per-window boolean; the Studio compares closeWithheldAcknowledgedEpisodeRef and the refusal states that closing again discards the unsaved script.
- [Phase 63]: WR-15: hasWithheldContent()'s durable-base arm is scoped to live key ids plus session anchor VALUES; an unknown (null/absent) live key map stays conservative so no base this track owns is under-counted.
- [Phase 63]: Kept the 52.2-15 close-order source pin meaningful by widening its fixed slice 3600→4200 after the planned close-step expansion pushed the last pinned step out of range.
- [Phase 64]: viscosity law applied as two exact literals in Engine.step() with the constants (12.0 dissipation gain, 0.012 spread floor) recorded in a module comment, not as unused code constants
- [Phase 64]: the probe captures the adapter's private engine via a prototype tap on setManual so the gate can digest paper, transparent and white exports without widening the adapter API
- [Phase 64]: the spread boundary at viscosity 1 is pinned with 12-decimal closeness — 0.12*(1-0.9) is 0.011999999999999997 in binary64; 0 and 0.5 boundaries are decimal-exact and pinned with toBe
- [Phase 64]: 64-01 task 2 landed test-only with no RED (63-09 precedent — the tracer already shipped every behavior bullet; no RED was fabricated). Pre-milestone pixel baseline committed from d1fd7ea3c before the first source edit
- [Phase 64]: Medium popover state lives in the existing store (aquarelleMediumMenuOpen / aquarelleMediumMenuAnchor) because the app's vnode test harness mocks preact/hooks, making component-local signals unobservable; mirrors aquarelleBrushMenuOpen and aquarelleTextureMenuOpen.
- [Phase 64]: The watercolor medium record derives from DEFAULT_CANONICAL_PARAMS for all ten keys, so the neutral medium can never drift from the canonical defaults.
- [Phase 64]: pastel displays as Chalk per D-18: the id stays the serialized identity queryable by mediumById; the name is the user-facing label.
- [Phase 64]: MED-19 deferred to 64-06: 64-02 lands Body's canonical-set membership (all four bags, default 0) but the Body globals row ships in 64-06.
- [Phase 64]: Thickness is one document-resolution HALF_FLOAT_R target, not a ping-pong pair: nothing advects it, and History.swap reads fbs[0] and writes every framebuffer, so travel() pairs it as a one-element entry.
- [Phase 64]: bindFootprint is shared by drawStamp and drawRelief so the relief footprint cannot drift; drawRelief takes an optional brush/rect/rough/jitter so Lift reuses the lift brush and rect with grain zeroed for liftFS mask parity.
- [Phase 64]: The deposit is structurally guarded at emboss 0 (no GL call at all), and resizeDocument forward-copies the thickness so a resized sheet keeps its relief (Rule 2 completion of the plan's must_have).
- [Phase 64]: The brush group tag is compile-time only: no serializer, no .mce field, no Rust mirror; an absent tag reads the default medium and the response id stays the only persisted brush reference.
- [Phase 64]: Acrylic bristle striation is a shared procedural tip built on the existing hair-segment helper (16.0/15.8 ms vs the 15.1 ms fan baseline), not a machine-scoped texture.
- [Phase 64]: brushSections is a pure package export mapped by the library, so the empty-group omission is tested directly instead of being a component branch.
- [Phase 64]: The chalk dry-media stamp law was rescoped to an explicit dry list plus a complement smooth-path assertion because seven of the eight new responses carry non-zero roughness per the spec table.
- [Phase 64]: The pastel group keeps the pastel id but displays as Chalk (D-18) in both the section header and the medium dropdown.
- [Phase 64]: 64-04: the emboss shades via dot(n, L) - L.z, so a zero gradient and a zero intensity both yield exactly 1.0; mode 4 derives alpha from the unshaded reconstruction and scales only the premultiplied pigment
- [Phase 64]: 64-04: DEFAULT_LIGHT stores degrees (129.8/38.45/1) reconstructing normalize(vec3(-0.5, 0.6, 0.62)); drawDisplay is the only degrees-to-radians boundary and the relief sampler binds at unit 7
- [Phase 64]: 64-04: compare.mjs --differs-from prefers the committed baseline, then the same-session /tmp capture, then a named error; all three digest must differ and dimensions must agree
- [Phase 64]: Body curve: bodyCurve(body) = clamp01(body)^6 in scattering.ts (0.5 -> 0.015625 glaze, 1 -> true cover); D-14 supersedes spec 06 section 3's inline clamp and 64-08 extends the same module
- [Phase 64]: Cover pass: Engine.coverPass reuses the Lift program through the shared footprint binding (uRound 0) and draws fixed then relief only; 7-arg signature carries the dab's grain values
- [Phase 64]: Undo safety: both history pools are protected once per stamp before the first cover draw — touch(coverRect) for pool 0, history.protect(1, coverRect + PROTECT_MARGIN) for pool 1
- [Phase 64]: Body row is the ninth of ten globals between Viscosity and Emboss; probe gained --body, --scenario cover and bakeMs (median 33 -> 38 ms on 256x256)
- [Phase 64]: The pick seam reads the outgoing group before selectAquarelleTip (peek) and applies the incoming group's medium only on a real change; a non-preset id has no group and writes no medium.
- [Phase 64]: The committed selection patch stays { brushId, toolOverrides } with no params key; the medium moves the live bag only, so a card pick never rewrites a recorded stroke.
- [Phase 64]: 64-05: PaintDocumentLight IS the engine's LightSettings; absent resolves to DEFAULT_LIGHT from the package barrel, never retyped
- [Phase 64]: 64-05: the light is optional-additive — absent contributes no revision term and the parser never manufactures a default, so untouched projects save byte-identically
- [Phase 64]: 64-05: setDocumentLight is the sole writer — patch over current light, engine clamp bands, canonical-revision no-op, one bump and one ledger descriptor
- [Phase 64]: 64-05: launch envelope unchanged — the light rides the opaque document member end to end; no launch key/field added to TS or Rust
- [Phase 64]: scatteringDeposit guards the amount before multiplying (zero, negative or non-finite -> exactly 0), so 0 x Infinity can never become NaN; the body side is finite through bodyCurve (T-64-22)
- [Phase 64]: S = SCATTERING_MAX x bodyCurve(body) x amount is written into the pre-existing inkB.a at the three deposit sites and carried by settleFS into fixedB.a; no render target, texture or pass is added
- [Phase 64]: The white-gouache channel is retired outright (Pigment.white, WHITE_GOUACHE, bleachFS, settle keep, composite coverage), never flag-hidden; MED-37 audit is pinned as a test and recorded in 64-08-SUMMARY
- [Phase 64]: 64-07: lightSignature lives exported in engine/physicsPaintStudioSettings.ts (not a Studio local) so the behavioral signature row can import it — the Studio is source-pinned text only in the node vitest env
- [Phase 64]: 64-07: absent light and explicit DEFAULT_LIGHT both canonicalize to the 'default' signature token, so identical pixels never alternate between two signatures
- [Phase 64]: 64-07: handleDocumentLightChange is declared with a temporary void marker until 64-09 threads it into rightPanelProps (plan forbids the early panel key; noUnusedLocals would fail)
- [Phase 64]: Each display band reconstructs through the two-constant Kubelka-Munk layer-over-white form calibrated by half the absorption exponent, so the S=0 limit is the exact legacy exponential rather than an approximation (MED-34 / MED-35)
- [Phase 64]: The raw sinh/cosh KM denominator is replaced by its exp(-arg)-normalized twin and the reflectance complement is emitted in closed form, so every band stays finite and inside [0,1] for any deposit a stroke can reach (overflow at arg ~ 88 -> NaN)
- [Phase 64]: The display shader reads one broadband scattering scalar (iB.a + fB.a), scales it by the same granulation factor as the coefficients (D-16), and keeps the paper term as the final multiply (D-15); the epsilon branch emits the 16 legacy band line-pairs character for character
- [Phase 64]: The probe's high-definition sheet is 1024 square (no phase constant exists) and reports bakeMs + renderMs; durations are printed by the comparator and never compared, so cost cannot fail a byte-identity gate
- [Phase 64]: 64-09: the light rows fall back to props.light ?? DEFAULT_LIGHT from the package — the triple is never retyped in the app
- [Phase 64]: 64-09: row geometry mirrors the store bands (Azimuth 0..360 step 1, Elevation 0..90 step 1, Intensity 0..4 step 0.1); setDocumentLight stays the only wrap/clamp authority
- [Phase 64]: 64-09: label change scoped to TOP_PANE_TAB_LABELS.paper = 'Paper & Light'; tab id, order and aria-label untouched, label pins repointed never deleted
- [Phase 64]: 64-09: no new memo dep — efxPaintVersion.value already refreshes rightPanelProps on every document edit, setDocumentLight included
- [Phase 64]: 64-09: Task 2 behavioural row drives the deps surface against the real store (node env cannot import the Studio); the Studio wiring is source-pinned (64-07 precedent)
- [Phase 64]: 64-13: the coverage composite replaces the rev-4 erase seam wholesale (three scissored draws on one footprint, pigment-independent K = 8); Body 0 stays byte-identical and the app-side onCoverDab carry belongs to 64-15
- [Phase 64]: 64-13: the coverage sheet is a DoubleTarget pair from the start; drawDisplay binds cover.read and 64-14 owns the advection swap
- [Phase 64]: 64-17: both erase-era cover-over-wet directional claims retired (user decision) — the coverage crossing reads 49.66 vs the 34.05 prefix and 30.74 subtract references, above both, because the covering stroke now deposits its own near-opaque body (own-pigment 3.47 -> 14.54)
- [Phase 64]: 64-17: coverCrossPigment >= coverOwnPigment — the composite can leave the crossing within rounding of the covering stroke alone, never blanker
- [Phase 64]: 64-17: the cover-over-wet digest moved with 64-13's coverage model, not the drive cadence — removing the trailing rapid-entry fix is byte-identical (covering stroke already fixes after itself)
- [Phase 64]: advectCoverFS declares no keep uniform — the settle that reduces mobile pigment must not reduce coverage, so the cover advect keeps factor 1 by construction and a dried white film keeps its opacity.
- [Phase 64]: Coverage is the fifth and last positional entry in allocateHistory() pool 0, snapshotLayers() and travel()'s pool-0 map; relief.test.ts re-anchors the single-framebuffer assertion on pool0[length − 2].
- [Phase 64]: The lifecycle alpha box sits on the covering film's plateau (max 5x5 mean 0.90 at document (0.6465, 0.3652)) because the grain-scale union plateau is ~0.89-0.91 and the 0.90 pre-lift bar is only measurable there.
- [Phase 64]: Lift erodes coverage with the fixed draw's rect, last-written uAmount and ZERO/ONE_MINUS_SRC_COLOR pair — no new program, no new uniform — ordered after fixed and before the relief erode.
- [Phase 64]: The cover-lift probe is one plan-faithful traversal of the covering diagonal at pressure 0.8 (0.90 -> 0.53, 59%; a there-and-back scrub was measured and rejected).
- [Phase 64]: The merge slot keeps the field name liveAlphaCanvas while receiving the coverage canvas; the stored sheet stays the transparent export (ink gate, save path, clipboard, Lift).
- [Phase 64]: LiftFootprintShape's deposit-only optional fields (tipRotation, roughness, stampJitter) were deleted with coverShapeForBrush, their only producer.
- [Phase 64]: The punch call-site pin is five, all inside runAquarelleLiftErase — the transaction, not the call count, is the one-caller invariant.
- [Phase 64]: MED-38 is claimed at the source level only (one pigment export, one merge conversion, none in the Studio); live visual parity stays UAT row 9.
- [Phase 64]: The textured-tip P90 floor is calibrated from measurement (0, not the provisional 0.5): the chalk core occupies ~8% of the mandated box, below the 10% a top-decile bar needs; discrimination lives in the covered-fraction window, P10 crumb check, blue excess, absolute paper-white zero and the every-digest twin difference.
- [Phase 64]: The round twin gets no committed baseline: resolveReference prefers a committed baseline in --differs-from, so a committed twin would make the chalk gate pass vacuously against itself.
- [Phase 64]: Spike 001 criterion 2 is measured on the PIGMENT export through the spike's own rgbToHsv (lumaRatio 1.07, deltaHue -0.04 deg); the VERDICT's 0.982 transparent-export reading is recorded for traceability, and no latency pin is added.
- [Phase 64]: UAT rows 2/7/8 are re-specified, never answered: the diff-line-class gate pins three expected: lines plus updated:, ten pending rows, status testing, number 1, awaiting user response.
- [Phase 64]: 64-18: the light coalescer delegates equality to lightSignature and mints only the operationId; the Studio parks the gesture's first descriptor (a descriptor ref, never a light mirror) and records exactly one coalesced span at release, keeping the single setDocumentLight call site via writeDocumentLight
- [Phase 64]: 64-20: the deposit stays UNGATED — the plan's law is the transport gate, and the census is closed at the capture boundary where the FINAL film is known; a deposit gate read the dab's transient film and zeroed the Body-60 partial cover.
- [Phase 64]: 64-20: the capture-time clearance is an explicit user-authorized amendment to the must-have truth — frozen transport remains true, and the EXPORTED coverage may additionally be cleared where the final film reads paper-white (64-20 decision checkpoint).
- [Phase 64]: 64-20: the clearance is binary and scoped to cov > 0 — a cleared texel exports exactly zero coverage alpha and its pigment RGB passes through verbatim, so no surviving texel moves and Body-0 exports stay byte-identical.
- [Phase 64]: 64-20: the gate quantizes to RGBA8 (round to nearest) before the luma mean, so its line is the scan's line; no bar, threshold, comparator or invariant was widened.
- [Phase 64]: 64-19: the emboss light keys every real-frame cache revision (lightCacheTerm via the canonical lightSignature; required projection parameter so a forgotten site is a compile error)
- [Phase 64]: 64-19: one bounded re-bake per light change through applyAquarelleTimeline (one in flight, one queued follow-up, one busy-false follow-up, rejections swallowed); the last-seen light is a signature string ref, never a light mirror; draw-time re-lighting stays REJECTED (the thickness field is not persisted)
- [Phase 64]: Paper seed rides the optional-additive precedent: paperSeed?: number, absent reads as derivePaperSeed(layerId) (FNV-1a/2^32), one adapter option before the first stroke; resetSheet/setPaper keep the seed
- [Phase 64]: Rust mirror is declaration-class MceDocumentPaperSeed: paint document is opaque in Rust, so the cross-language pin is declaration-level with a documented no-validation asymmetry
- [Phase 64]: Bristle set consumes this.rng (the stroke traceSeed) at first dab; seeded stroke tracked by object identity, so a new stroke always re-seeds
- [Phase 64]: Carrier ships proxy wetness only (wet * coverage): uWetMode and the last-touch sampler are 64-24's, so the pass binds ten textures, not eleven
- [Phase 64]: Reservoir pair and shape target stay in docTargets() deliberately: membership buys disposal/wipe reach; shape re-upload at every stroke start makes a zeroed or replaced target unobservable
- [Phase 64]: No deposit change, no second engine, no document-sized target: D-29 delivery law honoured exactly; no committed baseline edited
- [Phase 64]: 64-22: the gather deposit averages the five nearest bristles' carried absorbance coefficients (never RGB), writes coverage exactly once, and erodes Body through the same gather — Body 0 byte-identical, all nine identity gates reproduce.
- [Phase 64]: 64-22: the Body mask's switch is uShapeLaw because the gather binds uShape as its shape-texture sampler; fixed/relief keep the shipped alpha-shaped and LINEAR laws unchanged.
- [Phase 64]: 64-22: Feather, Pickup and Refill are canonical, recorded and shown as Paint-tab rows; wetSeconds rides the record with no row because the panel's x100 reset would corrupt a seconds value.
- [Phase 64]: The bristle-edge census measures the transparent export's deposited darkness (1 - min(rgb) = the engine's darkAlpha), not the mode-4 pigment alpha: the coverage channel is the source-over union of 100+ dabs and saturates, so the alpha edge is a 0.8 px silhouette at every Feather (measured 0.8 px at Feather 0 and 100) while the film edge responds to D-22's feather band (measured 20.25 px -> 25.11 px at 1080²)
- [Phase 64]: A dash-gap station (the 4.3 dryness breakup) is recorded in edgeSkippedStations, never in edgeFailures: a dash is the trace law working, not a degenerate capture; a blank film and a station with fewer than three crossings stay named failures
- [Phase 64]: The plan's 0.2 plateau guard was calibrated for the saturated alpha field; on the film's darkness a real light-wash stroke reads 0.13-0.16, so the blank-film guard is EDGE_MIN_PLATEAU = 0.02 (a blank render is 0)
- [Phase 64]: D-24: the last-touch field is a document-sized exact-float R32F pair cleared to -604800 s (one week old) and carried through the whole-document lifecycle as the sixth pool-0 layer; the §3.4 gate exp(-age/wetSeconds)*coverage multiplies PICKUP only on the virtual clock
- [Phase 64]: D-25: the acrylic retune (water 26, bleed 22, flow 60, wetSeconds 12) is numbers in one record; D-22's Feather half is discharged by composition through the existing uSoftness band, no feather expression added
- [Phase 64]: The bristle-wet acceptance measures band darkness on the transparent export: fresh 50.64 vs agedWet 250.16 luma, and the uncommitted --wet-mode 0 proxy differs on all three digests (paper e083b0e3 vs 9eaef5be); the sheet pair records 9,331,200 B at 1080² and 33,554,432 B at 2K, frame cache 0 B
- [Phase 64]: 64-25 (CR-04): the coverage raster is read from its own 2D context (or a transparent scratch), never a white fill; the committed payload's alpha law is stated as OPAQUE TRANSMITTANCE (alpha 255 storage, coverage only in the 1 - cover exponent, display derivation 1 - min(rgb)), superseding 64-15 truth 4
- [Phase 64]: The last-touch carry is one rect-sized blit per dab: after a stamp-and-swap the halves differ only inside the just-stamped rect, so carrying that rect read-to-write restores the invariant without a document-sized copy (D-29).
- [Phase 64]: WholeDoc.layers.lastTouch travels as AGES: captureWhole converts with stampsToAges, uploadWhole re-stamps with agesToStamps into a NEW array (never mutating the cached record), and captureSheet/restoreSheet are pass-through so the law lives at one boundary.
- [Phase 64]: timeBaseMs is per-engine and monotonic: clearLastTouch writes the sentinel but never re-anchors; only setClock, which installs a different clock, starts a new base, so resizeDocument's raw-stamp copy keeps its meaning.
- [Phase 64]: The dead uAmount uniform was deleted (IN-04): the 261119-pod measurement made the bare coverage channel the weight, superseding 64-24 truth 3's 'bounded by the dab amount' clause; the supersession is recorded in the shader comment and the suite header.
- [Phase 64]: A refusal is the scheduler's knowledge, not a busy result: setBlocked parks ONE request while playback/Draft/wireframe holds and the blocked-to-idle edge drains it through the shipped single-run-in-flight path, spending no follow-up budget (64-27, WR-04)
- [Phase 64]: The unblock edge never starts beside a live run — the parked request becomes the queued follow-up (maxActive stays 1) — and both resolveIdleWaiters and settle()'s early return treat a parked request as non-idle (64-27)
- [Phase 64]: Sheet-cache identity is a canonical whole-event FNV-1a digest (sorted keys, typed length-framed encoding, total on malformed payloads); the count-only seedSignature walk is deleted — KEY = CACHE now restores only under the exact script. IN-05.
- [Phase 64]: The bristle-wet pickup floor is derived in source at half the committed baseline's recorded gap (199.52 to 99.76 luma); re-authoring the baseline requires re-deriving the floor, and a 49/50 collapsed response is now a named failure. IN-07.
- [Phase 64]: 64-29: the bristle-line gate is judged against a same-session twin, never a committed baseline (none exists until 64-36)
- [Phase 64]: 64-29: tipMix is resolved through buildBrushForStroke (the engine's own fallback law); the tip band bar is reference-aware (masked actual + plain reference only)
- [Phase 64]: 64-29: at HEAD the texture-tip mask registers (tipMix 1) but adds no separated bands (1 vs 1 at row 64/256 and column 64) — recorded for 64-35, no engine code touched
- [Phase 64]: 64-29: the bristle-line gate fails its own bars at HEAD (halo peakRel 0.4628/0.4493 vs 0.4, runs 3/4 vs 2) on all three surfaces — the recorded defect for 64-32/64-33/64-34
- [Phase 64]: Sheet-cache presence lives beside the digest: hasCacheableScript is the one predicate both remember sites and restoreCachedSheet ask, so the cache can no longer park a script it would refuse to restore (IN-02).
- [Phase 64]: IN-06 stays as shipped; the deferral records the dead seed function, the adapter's injected engine/clock seam and the 8 ms yield constant, the test-only caller, and the reopen trigger.

### Pending Todos

None yet.

### Blockers/Concerns

- [Phase 60] Two zoom findings remain open advisory after the 2026-11-09 re-verification: WR-01 (mandatory `scroll-snap` may quantize the anchored fractional scroll write) and WR-02 (the 6px content gutter is omitted from three pointer-to-frame projections). Both are non-blocking; live UAT passed 5/5 and the full suite is green.
- [post-Phase 60] Code review of the interleaved quick/debug commits raised WR-05 (cursor seat re-applies the rail transform to already-transformed coordinates — ring renders `s²` when rail scale ≠ 1) and WR-06 (roto settle can force-reload the base mid-playback). Not phase-60 scope; unverified by UAT.
- `.mce` paint-field enforcement does not exist yet — `mceFieldContract.test.ts` covers `Mce*` interfaces only while the paint document rides as `HashMap<String, Value>`; motion persistence needs a dedicated load → save byte-identical round-trip pin.
- Four persistence carriers must move as one change or motion silently fails: `serializeRuntimeIntoDocument`, `encodeValidatedEfxPaintTrackContent`, `buildEfxPaintDocumentSyncFingerprint`, and the layer change token (this defect class already cost PKG-06 and BKG-09).
- [Phase 61] CR-01 (false "not applied" banner on an unchanged per-vertex colour commit) was FIXED by quick 261112-hfk (`749d79dec`); WR-01 (the paint-control seam discards its `Promise<boolean>` so a refused patch leaves the live control diverged with no message) and WR-02 (the orphan-focus window key route has no floating-dialog guard) remain open advisories from `61-REVIEW-DISPOSITION.md`.
- [Phase 61] Quick 261111-wd6 revised VEC-04 mid-phase; the Phase 61 verification records three accepted overrides (61-03 colour prohibition, 61-10 per-vertex-paint-properties prohibition, and truth 11's simple-ribbon render-mode clause). Anyone re-reading older plans should treat those clauses as superseded rather than violated.
- [Phase 62] Six review findings are recorded and deliberately deferred in `62-REVIEW-DISPOSITION.md` (0 open): WR-02 conversion drops recorded stylus tilt (`tx`/`ty` stamped 0), WR-03 busy gates are not re-read after the durable-base await (fails closed), WR-04 both cancelled-bake undo replays refused (silent return), IN-01 unreachable `'lift-vector': 'Eraser-Vector'` label, IN-02 the Vertex colour reading omits the `anchorWidthTarget` guard, IN-03 the `requestAquarellePathEdit` doc over-claims that no refusal leaves a selection. All are non-blocking; UAT 10/10 and verification 49/49 passed.
- [Phase 62] The UI audit dropped from 18/24 to 15/24 after the UAT changes (`62-UI-REVIEW.md`): curve entry has no pending/failure signal, the Vertex colour row shows the first anchor's swatch beside a "Mixed" caption, and the curve-editing / vector-category vocabulary has no help entries. Advisory only — no blocker; candidate for a follow-up quick.
- v2.0.1 debt carried in PROJECT.md Context: VIS-02/04 token drift, mixed rail-set header accent, the one-shot prompt's pending window, and the unconfirmed 261105-p9i live native UAT rows.
- [v2.2.0] Phase 63 closed the tip-mask registration and project-open scoping work (TIP-12/TIP-17): masks register inside the open await before the first stroke replay, and opening a project replaces the catalog and the registry. Phase 64's Viscosity must reach live pass, bake and replay identically (MED-05/06); replay determinism is its acceptance bar.
- [Phase 63] AQTL is now v3 — a presence-prefixed `engine.textureId` sits after the vector block and before `pointCount`. v1/v2 bodies refuse with `unsupported-version` and no migration reader exists: stale v2 `.snap` caches refuse whole on first open and that track starts empty. Accepted by design; reintroducing an older AQTL reader would reopen the no-backward-compat law.
- [Phase 64] The 17 committed probe baselines are expected-red by design: 64-31 added five alpha-law report fields and the re-capture authority (64-36) is deferred. Same-session gates and scenario invariants are green (neutral-256, white-over-blue 1080/100, cover-lift, cover-advect, cover-textured, red-over-blue-50). Do not lower a bar or hand-edit a baseline to make them green.
- [Phase 64] Deferred, not gaps: the Play-Script dialog bake renders with the engine default light (64-07) and IN-06's dead seed path remains to be retired. Review IN-01 (lazy coverage export) and IN-02 (unreachable guard) remain open infos.

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
| quick_tasks | 261107-sg3-move-hand-tool-to-canvas-tool-for-zoom-p | unknown — completed, commit `5973f30e5`; scanner sees no UAT status file | 2026-11-14 (v2.1.0) |
| quick_tasks | 261107-tfp-ui-boundaries-from-phase-59-rail-motion- | unknown — completed, commit `68d7d1cc2`, UAT approved; scanner sees no UAT status file | 2026-11-14 (v2.1.0) |
| quick_tasks | 261108-gh0-rail-motion-follow-up-lucide-easing-icon | unknown — completed, commit `94b246ed7`, UAT approved 2026-11-08; scanner sees no UAT status file | 2026-11-14 (v2.1.0) |
| quick_tasks | 261113-fkm-vector-paint-global-colour-apply-replace | unknown — completed, commit `8adfa44ce`, UAT approved 2026-11-13; scanner sees no UAT status file | 2026-11-14 (v2.1.0) |
| uat_gaps | 61/61-UAT-QUICKS.md | unknown — 0 open scenarios; follow-up instruction doc, not a UAT file (61-UAT.md is complete, verification passed) | 2026-11-14 (v2.1.0) |

### Quick Tasks Completed

| # | Description | Date | Commit | Directory |
|---|-------------|------|--------|-----------|
| 261107-mkn | Fix Phase 59 UI: channel header rows in the pinned left header column, Animate channel menu, Motion boundaries tool and animate mode (UAT approved) | 2026-11-07 | b5cb501e1 | [261107-mkn-fix-ui-from-phase-59-rail-motion-channel](./milestones/v2.1.0-quick/261107-mkn-fix-ui-from-phase-59-rail-motion-channel/) |
| 261107-pd8 | Motion channel keys draggable through time on the Phase 59 rail (reuses the shared key-rail drag session); selected-rail lane inset line removed (UAT approved) | 2026-11-07 | bc92429ef | [261107-pd8-draggable-motion-key-from-phase-59-rail-](./milestones/v2.1.0-quick/261107-pd8-draggable-motion-key-from-phase-59-rail-/) |
| 3 | Studio: end-justify the Animate channel-menu button on the bottom action row; grey it out (aria-disabled) until a rail is selected | 2026-11-07 | 904743666 | — |
| 261107-qgj | Move the Motion values out of the sidebar Scripts tab into a floating Motion sheet; present channels only, Stroke settings slider rows, header Reset pins the identity pose, one close path restores the previous paint tool (UAT approved) | 2026-11-07 | 615f38acd | [261107-qgj-move-all-the-motion-values-from-sidebar-](./milestones/v2.1.0-quick/261107-qgj-move-all-the-motion-values-from-sidebar-/) |
| 261107-rrp | Cycle + Motion on Studio rails: a cycle conversion preserves the rail's motion; the Motion span auto-fits the resolved rail extent (extends with keys/cycles, shrinks with them); out-of-band keys are preserved-but-inactive (UAT approved) | 2026-11-07 | ff6d6714d | [261107-rrp-cycle-with-motion-in-studio-adding-a-cyc](./milestones/v2.1.0-quick/261107-rrp-cycle-with-motion-in-studio-adding-a-cyc/) |
| 261107-sg3 | Move the Hand tool out of the Studio tool rail into the floating canvas zoom pill — press-and-hold: hold the Hand button and move the mouse or pen to pan like middle-mouse drag, release stops | 2026-11-07 | 5973f30e5 | [261107-sg3-move-hand-tool-to-canvas-tool-for-zoom-p](./milestones/v2.1.0-quick/261107-sg3-move-hand-tool-to-canvas-tool-for-zoom-p/) |
| 7 | Allow Studio canvas zoom to go below the Fit value (fit 40% can view 20% or less) | 2026-11-07 | 2ff2692a2 | — |
| 8 | Set Studio canvas region (.physics-paint-canvas-region) background to #222529 | 2026-11-07 | 093f16f76 | — |
| 261107-tfp | Size the Studio rail-motion canvas boundary box to the displayed drawing key's alpha ink (per key; generated keys use the flanking union), with the full-raster fallback for empty or unmeasurable keys (UAT approved; ink measured on opaque transmittance sheets) | 2026-11-07 | 68d7d1cc2 | [261107-tfp-ui-boundaries-from-phase-59-rail-motion-](./milestones/v2.1.0-quick/261107-tfp-ui-boundaries-from-phase-59-rail-motion-/) |
| 261107-ux2 | Rail motion first span never interpolated: add-channel seeded its opening key with easing hold, so frames between the first two paint keys held while later spans eased; the opening seed now eases (regression tests pin frame 2 = the exact midpoint) | 2026-11-07 | 3138361ad | [261107-ux2-rail-motion-first-span-never-interpolate](./milestones/v2.1.0-quick/261107-ux2-rail-motion-first-span-never-interpolate/) |
| 261108-d5o | Rail Motion: add stop-motion and linear easings, make stop-motion the default for new lanes and keys, expose per-key easing in the floating Motion sheet, and glyph all four easing buttons (supersedes 261107-ux2 ease seed; UAT approved 2026-11-08) | 2026-11-08 | 86cea6ebd | [261108-d5o-new-ease-motion-from-phase-59-rail-motio](./milestones/v2.1.0-quick/261108-d5o-new-ease-motion-from-phase-59-rail-motio/) |
| 261108-gh0 | Rail Motion: lucide easing icons on the sheet and every lane key, tool-strip easing/wiggle removed, per-channel whole-timeline wiggle with a persisted Global flag, Keys table with [Key N]/[All] targets, project-scaled wiggle sliders, sectioned auto-height sheet (UAT approved 2026-11-08) | 2026-11-08 | 94b246ed7 | [261108-gh0-rail-motion-follow-up-lucide-easing-icon](./milestones/v2.1.0-quick/261108-gh0-rail-motion-follow-up-lucide-easing-icon/) |
| 261108-kvw | Canvas motion-path overlay for rail Position: read-only dashed authored route, key dots and cursor marker in animate mode (UAT approved) | 2026-11-08 | 4893ee9ee | [261108-kvw-canvas-motion-path-overlay-for-rail-posi](./milestones/v2.1.0-quick/261108-kvw-canvas-motion-path-overlay-for-rail-posi/) |
| 14 | Deps bump: preact 11.2.0, xstate 6.0.0-beta.1; removed Matt Pocock skills and .efx-planning | 2026-11-08 | 4128c27e6 | — |
| 261108-nq0 | Phase 59 cycle rail bug: + Key / paint inside a cycled one-key rail now dissolves the Loop Clip and lands the key joined to the rail (one continuous rail, no stale-document errors, no split; UAT approved 2026-11-08) | 2026-11-08 | 7de46add1 | [261108-nq0-phase-59-cycle-rail-bug-adding-a-key-ins](./milestones/v2.1.0-quick/261108-nq0-phase-59-cycle-rail-bug-adding-a-key-ins/) |
| 261108-o9d | Cycle create is serialized behind a still-settling physical edit instead of dropping with 'Group update was not dispatched.'; clamp and validators unchanged (UAT approved 2026-11-08) | 2026-11-08 | bf4d80e28 | [261108-o9d-creating-a-cycle-with-10-frames-fails-wi](./milestones/v2.1.0-quick/261108-o9d-creating-a-cycle-with-10-frames-fails-wi/) |
| 261108-pmc | Rail cycle delete: Delete on a cycle (repeat) cell is refused; deleting a real key on a cycled rail dissolves the Loop Clip in the same atomic edit instead of leaving a suppressed key; the parent bounds canonical clips like the child, closing the `(loop-clips)` parent rejection (UAT approved 2026-11-08) | 2026-11-08 | ae54c7502 | [261108-pmc-cycle-delete-on-rail-does-not-update-cyc](./milestones/v2.1.0-quick/261108-pmc-cycle-delete-on-rail-does-not-update-cyc/) |
| 18 | Onion tab sliders use the shared SliderStepper (native ranges overflowed the right sidebar) | 2026-11-08 | e066b97b9 | — |
| 261109-pwt | Phase 60 cached-key paint: first return to a key that already had cached paint now shows paint added since the last cache commit (settle the pending destination capture once the destination is displayed; faint wet washes no longer dropped by the capture ink gate; UAT approved 2026-11-09) | 2026-11-09 | 8b1508db8 | [261109-pwt-phase-60-issue-with-paint-on-cached-key-](./milestones/v2.1.0-quick/261109-pwt-phase-60-issue-with-paint-on-cached-key-/) |
| 261109-uj0 | Phase 60 cached-key paint, compiled-build regression: localized capture gate FAILED packaged UAT (near-blank snapshots overwrote fresh paint, including keyboard-arrow navigation); acceptance reverted to the global-only 0.3 mean in 0c0520917, with the localized 12x12 measurement and a non-DEV console.warn kept as rejection diagnostics; quick CLOSED as rollback+diagnostic (22:21 rebuild verified, keyboard repro gone). Follow-up 9e0bd2597 makes the gate color-aware (paper-relative per-channel pigment path, floor 0.5) because luminance rejected yellow/orange washes while red/blue passed; packaged UAT PASSED 2026-11-09 (user-confirmed) | 2026-11-09 | 9e0bd2597 | [261109-uj0-phase-60-issue-the-faint-wet-wash-captur](./milestones/v2.1.0-quick/261109-uj0-phase-60-issue-the-faint-wet-wash-captur/) |
| 261111-t74 | Selection edit port + brush patch — selected strokes accept a brush id and per-brush multipliers as one undoable edit (automated-ready; no UI consumer yet) | 2026-11-11 | be4118871 | [261111-t74-selection-edit-port-brush-patch](./milestones/v2.1.0-quick/261111-t74-selection-edit-port-brush-patch/) |
| 261111-tul | SliderStepper commit boundary: optional onCommit fires once per gesture at the release boundaries (track pointerup/cancel, typed Enter/blur, ± press end, keyboard activation) with the gesture's own value, Enter+blur deduped, equal-value commits allowed, absent prop byte-identical (automated-ready; no consumer wired) | 2026-11-11 | 1ce179f3c | [261111-tul-sliderstepper-commit-boundary-milestone-](./milestones/v2.1.0-quick/261111-tul-sliderstepper-commit-boundary-milestone-/) |
| 261111-ucf | Brush picks and paint-control releases edit the SELECTED paint strokes through one aquarellePaintControls seam (pickAquarelleBrush, param/params/multiplier commits with filter 'paint'); all four pick surfaces and every slider release wired, Globals Reset is ONE seven-key batch, lift strokes never addressed, live brush/slider behaviour unchanged (UAT approved 2026-11-11) | 2026-11-11 | 73d704c1d | [261111-ucf-brush-picks-and-paint-controls-edit-the-](./milestones/v2.1.0-quick/261111-ucf-brush-picks-and-paint-controls-edit-the-/) |
| 261111-vg4 | Remove the Stroke Settings Paint tab — dialog is Geometry \| Stack only; Curve row and Anchor width mount moved into Geometry; per-stroke paint editing lives in the sidebar/top bar (UAT approved 2026-11-11) | 2026-11-11 | 828b58f48 | [261111-vg4-remove-the-stroke-settings-paint-tab](./milestones/v2.1.0-quick/261111-vg4-remove-the-stroke-settings-paint-tab/) |
| 261111-wd6 | Per-vertex colour on vector anchors (sparse, explicit); per-vertex size stays the Anchor width factor, relabelled Vertex size; engine per-sample pigment + AQTL bit 3 (UAT approved 2026-11-12) | 2026-11-12 | 0dbd47e96 | [261111-wd6-per-vertex-color-and-size](./milestones/v2.1.0-quick/261111-wd6-per-vertex-color-and-size/) |
| 261112-hfk | Fix CR-01 (Phase 61 review): an unchanged per-vertex colour commit publishes a false refused banner; a no-op now returns before the path-edit commit and publishes nothing, genuine refusals still publish (pure predicate + wiring pins) (UAT approved 2026-11-12) | 2026-11-12 | 749d79dec | [261112-hfk-fix-cr-01-from-planning-phases-61-vector](./milestones/v2.1.0-quick/261112-hfk-fix-cr-01-from-planning-phases-61-vector/) |
| 261112-i6d | Vector edit enhancements: double-click a vector stroke enters the path edit; Alt+click a vertex toggles it to a straight corner and back in vector and spline modes; Geometry Round/Straight Corner row over the selected anchors; Vertex size track to x10 with free entry to x20; orange glow/halo selected-vertex chrome; path-edit re-bake canvas veil (blocking, composited wheel, stroke counter) as the ONE indicator — the apply pill stands down (UAT approved 2026-11-12) | 2026-11-12 | 34728c5e4 | [261112-i6d-vector-enhancement-double-click-stroke-t](./milestones/v2.1.0-quick/261112-i6d-vector-enhancement-double-click-stroke-t/) |
| 261112-lq4 | Stroke settings sheet redesign: four tabs (List default \| Geometry \| Stack \| Curve), Paint \| Eraser \| All row merged into the tool dropdown, Edit path and Preview stroke size moved into the Draft strip, cache caption removed, Vertex size / Curve / Corner moved to the Curve tab (UAT approved 2026-11-12) | 2026-11-12 | 82f9ae5cd | [261112-lq4-ui-stroke-vector-modal-redesign](./milestones/v2.1.0-quick/261112-lq4-ui-stroke-vector-modal-redesign/) |
| 29 | Hide Vertex size and Corner blocks in the Curve tab unless a vertex is selected (UAT approved 2026-11-12) | 2026-11-12 | 72a69dc94 | — |
| 261112-n3f | Unify the stroke-size preview into one toggle (vertex-aware, off by default) and remove the vector envelope self-intersection lines (UAT approved, including follow-up 39007da12 restoring the committed sheet on leaving the surface) | 2026-11-12 | 8f5ae4c82 | [261112-n3f-unify-the-stroke-size-preview-into-one-t](./milestones/v2.1.0-quick/261112-n3f-unify-the-stroke-size-preview-into-one-t/) |
| 31 | Studio UI polish: EFX mark in the old Engine-ready seat (Engine fail pill on failure), Re-render + Undo + Redo + Flash-dry in the top-bar action cluster (43px, centered inside the flexible settings cluster between the brush dropdown and the right settings; Water stays in the rail), "Script mode" checkbox inside the brush pill (checked by default, label at right, 2px gap), cache-load notice published as info, right-sidebar tab scrollbars use the blue thumb, orange active-track left bar (UAT approved 2026-11-12) | 2026-11-12 | aa03d4139 | — |
| 261113-fkm | Vector paint: a whole-stroke colour apply replaces explicit per-vertex colours in the same edit (one undo), so the global colour survives path-edit re-entry; Size keeps per-vertex width factors (UAT approved 2026-11-13) | 2026-11-13 | 8adfa44ce | [261113-fkm-vector-paint-global-colour-apply-replace](./milestones/v2.1.0-quick/261113-fkm-vector-paint-global-colour-apply-replace/) |
| 261113-o26 | Free canvas pan on both surfaces (Studio Hand / Shift+Space, main editor Space- and middle-drag push past any edge at Fit or 1:1; Fit restores) + a hover-revealed liquid-glass zoom pill seated bottom-right on both canvases, with Hand, FIT and 1:1 in the editor row (UAT approved 2026-11-13) | 2026-11-13 | b655ba3bb | [261113-o26-allow-to-move-canvas-out-with-hand-same-](./milestones/v2.1.0-quick/261113-o26-allow-to-move-canvas-out-with-hand-same-/) |
| 261113-qjd | Context-aware Shift+? help: the overlay opens on the Paint Mode tab in stroke editing, Timeline/Canvas on hover, Sections elsewhere, with a Detected label; all 9 groups reachable via number keys 1-9; documented keys verified against real bindings; the editor and Studio share one shortcuts modal (Studio global button styles isolated, stacked key symbols spaced) (UAT approved 2026-11-13) | 2026-11-13 | f8b265b32 | [261113-qjd-i-want-a-shift-shortcut-for-show-all-key](./milestones/v2.1.0-quick/261113-qjd-i-want-a-shift-shortcut-for-show-all-key/) |
| 261115-oh9 | Texture is a setting of the brush response (response owns physics, texture replaces the footprint; Default = no texture); real-mask chips, both UI surfaces, payload carrier | 2026-11-15 | 314209671 | [261115-oh9-fix-texture-becomes-a-setting-of-the-bru](./quick/261115-oh9-fix-texture-becomes-a-setting-of-the-bru/) |
| 261116-gcn | Studio Textures axis: a 2nd trigger inside the brush pill opens a Textures popover (Open modal first, then the relocated compact strip); Open modal raises a floating Textures sheet with Import tip leading the list, 72px chips and the shared brush Size (fifth seat at z 54 / top 76px) (UAT approved 2026-11-16) | 2026-11-16 | dd37f5e48 | [261116-gcn-in-studio-head-top-bar-add-a-2nd-dropdow](./quick/261116-gcn-in-studio-head-top-bar-add-a-2nd-dropdow/) |
| 37 | Studio Script/Pixel control: pulse dot + state label replaces the checkbox; sentence case; hover drops the blue fill, turns the text white and previews the next mode (Script ⇄ Pixel); bare S toggles recording (UAT approved 2026-11-16) | 2026-11-16 | c2123898e | — |
| 261116-inu | Imported-only brush textures from a machine-level user library: 512 mask edge, px-true 1..512 size with the engine floor retired, per-stroke texture rotation through AQTL v4; built-ins, the .mce brush carrier and script mask bytes all removed; standing "unavailable" warning line dropped on request (UAT approved 2026-11-16) | 2026-11-16 | 50e745a65 | [261116-inu-imported-only-brush-textures-from-a-user](./quick/261116-inu-imported-only-brush-textures-from-a-user/) |
| 261116-qhm | Painted-stroke path edit is a plain vector session from entry: the conversion commits at entry through the ONE writer (fitVectorPathAnchors -> commitAquarelleVectorPathEdit), and the path-edit latch opens only on a resolved edit id; the held fit, entry wireframe/Draft bracket, exit settle hook and original-spine ghost are deleted (UAT approved 2026-11-16) | 2026-11-16 | 8686ef88c | [261116-qhm-painted-stroke-path-edit-is-a-plain-vect](./quick/261116-qhm-painted-stroke-path-edit-is-a-plain-vect/) |
| 261116-r9k | Studio: a converted painted stroke's paint is now tessellated at RENDER time from its anchors (paint cadence via resampleVectorPaintPoints), so the document keeps its spline; the conversion also simplifies anchors while the evaluated curve stays within 0.006 uv of every recorded sample (18 -> 11 on a hand stroke); D-08 unamended, the stored-station approach was reverted (UAT approved 2026-11-16) | 2026-11-16 | 72a8d6cdf | [261116-r9k-in-the-studio-canvas-make-a-painted-stro](./quick/261116-r9k-in-the-studio-canvas-make-a-painted-stro/) |
| 261116-u63 | Studio Stroke Settings list: Duplicate button on each stroke/vector row beside the trash and in the header — clones the recorded stroke (anchors, curve mode, vector flag, texture, key anchors) directly above its source as one undoable edit (UAT approved 2026-11-16) | 2026-11-16 | 4c021d178 | [261116-u63-in-studio-when-i-select-vector-or-stroke](./quick/261116-u63-in-studio-when-i-select-vector-or-stroke/) |
| 261117-e6j | Studio rail delete no longer wedges the window: a drifted post-publication settlement releases its lease instead of transferring it to recovery ownership (the recovery lease gated physicalMutationAvailable, so every later Add key/rail was refused); the diagnostic now names the failing drift sub-check; pinned by a store-level delete-settlement test (UAT approved 2026-11-17) | 2026-11-17 | 9caf1a116 | [261117-e6j-regression-with-studio-on-deleting-after](./quick/261117-e6j-regression-with-studio-on-deleting-after/) |
| 261117-tq7 | Cover pass erases pre-stroke wet ink and the cached base: a Body>0 Brush stamp subtracts the stroke-start ink snapshot under its solid core (bounded share law) and punches a cooked frame's cached base through the Lift preview/punch seam with a new core profile; Body 0 stays byte-identical 6/6 | 2026-11-17 | 4dbe9f6d7 | [261117-tq7-cover-pass-erases-pre-stroke-wet-ink-and](./quick/261117-tq7-cover-pass-erases-pre-stroke-wet-ink-and/) |
| 261121-mtu | Refill hidden for acrylic and watercolor (acrylic fixed 0), acrylic preset Feather 85 / Emboss 3, Watercolor paint tool (A; Move/Edit to M), tool x medium Paint panel (decision B; gouache/chalk/graphite Refill deferred) | 2026-11-21 | c068a0139 | [261121-mtu-refill-acrylic-only-three-paint-tool-cat](./quick/261121-mtu-refill-acrylic-only-three-paint-tool-cat/) |
| 261121-umu | Decouple the acrylic bristle deposit from authored pressure (pressureLink 0 on bristle-flat/round; width still pressure-owned; follow-up speedLink 0e41c0d6a made hand speed inert and Dry 0 zero-depletion — UAT approved 2026-11-21) | 2026-11-21 | 106074578 | [261121-umu-task-decouple-the-acrylic-bristle-deposi](./quick/261121-umu-task-decouple-the-acrylic-bristle-deposi/) |
| 261121-w5n | Floor acrylic bristle dab spacing at one device pixel + mirror the ink ratio (small-brush slowdown; inert sizes byte-identical; UAT approved 2026-11-21 — "amazing speed improvement") | 2026-11-21 | 94c863894 | [261121-w5n-in-v2-2-0-phase-64-fix-the-acrylic-small](./quick/261121-w5n-in-v2-2-0-phase-64-fix-the-acrylic-small/) |
| 261122-gys | Studio paint identity: Brush lands on the family's last brush and applies its medium record; Reset restores the active medium record (wetSeconds included) in one undo batch; UAT approved 2026-11-22 | 2026-11-22 | afc3120b5 | [261122-gys-v2-2-0-studio-paint-identity-switching-a](./quick/261122-gys-v2-2-0-studio-paint-identity-switching-a/) |
| 261123-hr5 | Studio paint: signed Emboss -15..15 — negative half erodes relief with the brush while keeping paint (calibrated RELIEF_ERODE_NEGATIVE=20, probe + byte-identity gates pass; UAT automated-ready, artist UAT pending) | 2026-11-23 | e82aa2b71 | [261123-hr5-v2-3-0-studio-paint-signed-emboss-subtra](./quick/261123-hr5-v2-3-0-studio-paint-signed-emboss-subtra/) |
| 261123-jak | Studio paint: Shift paints relief — Shift at stroke start with the brush and a non-zero Emboss latches a per-stroke reliefOnly (inverted signed Emboss, no ink/water/cover/carrier, own ink-rect undo); the marker rides the bag, JSON codec, AQTL bit 5, Roto schema/duplicate and adapter replay; probe control-twin proves zero paint on both arms, +15/Emboss-0 byte-identical (closed as superseded: a pressure-driven modifier quick replaces the Shift semantics with Shift erode / Cmd deposit; persistence layer kept) | 2026-11-23 | 665771878 | [261123-jak-v2-3-0-studio-paint-shift-paints-relief-](./quick/261123-jak-v2-3-0-studio-paint-shift-paints-relief-/) |
| 261123-kpy | Studio paint: pressure-driven modifier relief — Shift at stroke start erodes relief / Cmd deposits it (Shift wins, latched once, no Emboss gate), magnitude from pen pressure only via reliefModifier.ts (gains 15/15 calibrated; Emboss 0 works; p<0 sentinel = full 1.0); the polarity rides the bag, JSON codec, AQTL bits 5-6 (both-set refused), Roto schema/duplicate and adapter replay; probe emboss-relief-modifier proves erode halving + deposit raise, byte-identical no-paint controls on both polarities, a/b replay parity, pressure ordering (p03 0.7917, none 0.9167) and neutral/+15 identity vs pre-change HEAD; the polarity also survives the restore, duplicate and Play Script fallback rebuild seams (UAT automated-ready, artist UAT pending) | 2026-11-23 | 44ba44cc1 | [261123-kpy-validate-v2-3-0-studio-paint-modifier-re](./quick/261123-kpy-validate-v2-3-0-studio-paint-modifier-re/) |
| 261123-pee | Hold paint wet until Dry — no auto-dry, wet one-frame Re-render/Apply | 2026-11-23 | 36f16d74c | [261123-pee-hold-paint-wet-until-dry-no-auto-dry-wet](./quick/261123-pee-hold-paint-wet-until-dry-no-auto-dry-wet/) |
| 261123-vkb | Freeze the held wet look at the visible settle cap — while held, the sim sleeps at round(30+270x(1-dry)) ticks after the last wet input (Dry 50 = 165 ticks); no fix, no decay; Water gate stays open and wetPeak survives; ONE shared settleCap module consumed by engine, bake and layer; probe proves the frozen sheet, cap window and hold-off control | 2026-11-23 | cecd10021 | [261123-vkb-freeze-the-held-wet-look-at-the-visible-](./quick/261123-vkb-freeze-the-held-wet-look-at-the-visible-/) |
| 261124-0l5 | Living Script Apply pastes the copied script onto the key (recorded timeline under fresh ids bound to the destination keyId, then baked; one undo; replaces an existing script) | 2026-11-24 | b5c6c387c | [261124-0l5-paste-script-doesn-t-paste-strokes-scrip](./quick/261124-0l5-paste-script-doesn-t-paste-strokes-scrip/) |
| 261124-1d7 | Fix AQTL v4 snapshots written during the reverted 261123-jak/kpy window | 2026-11-24 | 576ade2dd | [261124-1d7-fix-aqtl-v4-snapshots-written-during-the](./quick/261124-1d7-fix-aqtl-v4-snapshots-written-during-the/) |
| 261124-gfy | Roto key actions: group Duplicate/Copy/Paste/Cut in a tonal sub-section with a Raster\|Script toggle after Cut, and pin the "Layer N Key N" identity block width (UAT approved) | 2026-11-24 | b11368da7 | [261124-gfy-roto-key-actions-group-duplicate-copy-pa](./quick/261124-gfy-roto-key-actions-group-duplicate-copy-pa/) |
| 56 | Studio Roto: white glow on multi-selected keys (Cmd / All); the marker survives the startFrame reseed and paints without a CSS filter (WebKit clipped the glow) (UAT approved 2026-11-24) | 2026-11-24 | e7c78249f | — |
| 261124-iq9 | New brushes convention: Watercolor + Gouache only; remove Gouache Round/Flat, all Chalk and Graphite brushes, and Bristle Flat; rename Bristle Round and the Acrylic medium to Gouache; hide Viscosity/Water for Gouache (UAT approved) | 2026-11-24 | f5da7c094 | [261124-iq9-new-brushes-convention-and-parameters-in](./quick/261124-iq9-new-brushes-convention-and-parameters-in/) |

## Roadmap Evolution

- Phase 59: Rail motion channels + v7 interface (v2.1.0, first free global number; Phase 57 retired and never reused)
- Phase 60: Studio timeline horizontal zoom (inserted after 59 — shares the frame→pixel pitch expressions)
- Phase 61: Vector painting tool (spike-gated on per-vertex watercolour feasibility)
- Phase 62: Painted-stroke curve editing (depends on Phase 61's editing surface)
- Phase 63: Brush Tip Pipeline (v2.2.0, plan-backed from specs 01-02 — real tip mask, embedded `brushPack`, three built-in tips)
- Phase 64: Medium Engine (v2.2.0, plan-backed from specs 03-08 — Viscosity, five Medium profiles, thickness/emboss, Body order, brush groups, scattering)

## Session Continuity

Last session: 2026-11-23T17:15:00.000Z
Stopped at: Shift/Cmd modifier removed and the display emboss gated off (RELIEF_BUMP 0, Emboss row hidden). Nothing emboss-related renders in the app right now; the thickness field is still recorded. Next is an emboss spike — new display shading (smoothed gradient, ambient floor, specular) and whatever stroke-scale structure the height field needs — before any new emboss phase
Resume file: None

## Operator Next Steps

- 261124-iq9 UAT approved 2026-11-24 (6/6 rows): the Studio offers two media (Watercolor, Gouache) and two brush groups; Viscosity and Water are hidden for Gouache on both the Paint panel and the top bar; the Water tool keeps Viscosity; old recorded responses render through the round fallback.
- 261124-gfy UAT approved 2026-11-24 (7/7 rows): the Roto clipboard actions sit in one recessed well that the Raster|Script toggle visibly frames — Raster is the default every Studio open (byte-identical Duplicate/Copy/Paste/Cut), Script routes the same four buttons AND Cmd+C/X/V at the shipped Living Script seams with a fail-closed Cut that restores the previous script clipboard when the delete fails. The "Layer N Key N" identity block no longer resizes across 1→2→3 digits or layer changes.
- 261124-1d7 UAT approved 2026-11-24 (1/1 row): AQTL v4 accepts the legacy relief marker bits 5/6 — snapshots written during the reverted 261123-jak/kpy window (2026-11-23 15:36-17:08) restore again, the CR-02 withheld-save latch clears, and the next save rewrites the file without the bits.
- 261124-0l5 UAT approved 2026-11-24 (5/5 rows): Living Script Apply pastes — the destination key records the copied strokes (fresh ids, destination keyId anchor, one undo, replaces an existing script) and bakes that recorded timeline; Load + Apply and the Scripts-section Apply still never paste.
- 261123-vkb UAT approved 2026-11-24 (7/7 rows). Residuals to decide when convenient (task REVIEW.md): WR-01 (probe exact tick equality rides float phase) and WR-02 (stamp floor reads live Dry Speed while the bake's settle cap uses the recorded stroke dry — a mid-window Dry change can reopen the washed fallback).
- Close milestone v2.2.0 with /gsd-complete-milestone (both phases complete: 63 Tip Pipeline, 64 Medium Engine).
