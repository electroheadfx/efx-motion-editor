---
phase: "59"
slug: "rail-motion-channels-v7-interface"
status: verified
# threats_open = count of OPEN threats at or above workflow.security_block_on severity (the blocking gate)
threats_open: 0
asvs_level: 1
created: "2026-11-07"
---

# Phase 59 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| Renderer document store ↔ persistence carriers | The per-track rail-motion collection is written by one store setter and read back through the fail-closed parser | Rail motion records (bounded ids, channel values) |
| TypeScript canonical encoder ↔ Rust canonical encoder | Both compute the same document revision; a divergence silently forks persistence identity | Canonical document bytes / revision digest |
| Renderer ↔ Tauri bridge apply payload | Parent applies group-lifecycle edits across the bridge | Apply payload including `railMotions` |
| Session UI state ↔ persisted document | Menus, drafts and merge notices must never enter the document, revision or fingerprint | Session-only signals, selection identity |
| Rail-set clipboard ↔ destination track | Cross-track paste re-points loop sources onto freshly allocated keys | Copy payload members and their source keys |

---

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-59-01 | Tampering | TS/Rust canonical loop-clip encoder | high | mitigate | Shared golden fixture asserts the full canonical source in both languages; railKind term repaired at the identical ordinal; fail-closed guard unchanged | closed |
| T-59-02 | Tampering | `railMotionCanonical.golden.json` | medium | mitigate | Expected values are frozen literals, not recomputed; the fixture is written once from TS authority and any later change requires a deliberate diff with a named cause | closed |
| T-59-03 | Elevation of privilege | `app/package.json` / `app/src-tauri/Cargo.toml` | high | mitigate | No-install plan; REL-01 gate asserts dependency blocks are unchanged; any future install must pass the package-legitimacy gate | closed |
| T-59-04 | Tampering | `parsePhysicPaintRotoRailMotions` | high | mitigate | Exact key allowlists, plain-prototype `isRecord`, bounded ids, channel/frame/count caps, per-channel value domains, duplicate rejection, frozen output | closed |
| T-59-05 | Denial of service | collection and frame caps | medium | mitigate | 512 records, 5 channels per record, 4096 keys per channel, frame ≤ 1,000,000 enforced before allocation-heavy work | closed |
| T-59-06 | Repudiation | invalid persisted data | medium | mitigate | Fail-closed with a field-naming error; no silent clamp, drop or repair; tests assert each throw | closed |
| T-59-07 | Tampering | four persistence carriers | high | mitigate | One revision authority in the store; six carrier assertions that move on addition and return on removal; save→reopen byte-identical pin | closed |
| T-59-08 | Tampering | `_buildRotoPhysicalRevisionFor` bypass | medium | mitigate | Source-string gate: exactly one direct revision call in the store (baseline 7) | closed |
| T-59-09 | Information disclosure | motion values in cache keys | medium | mitigate | Only the canonical document term exists; sampled values never enter a key (asserted again in 59-07/59-08) | closed |
| T-59-10 | Tampering | `canonical_rail_motions` | high | mitigate | Shared five-document golden fixture asserts source and project in both languages; ordinal index assertion | closed |
| T-59-11 | Denial of service | Rust collection parse | medium | mitigate | 512/5/4096 caps and bounded ids checked before building the output string | closed |
| T-59-12 | Repudiation | malformed motion input | medium | mitigate | Closed Err naming the field; no skip, no panic; dedicated rejection test | closed |
| T-59-13 | Denial of service | evaluator scan / curve sampling | low | mitigate | 4096-key cap from the parser; curve sampling capped; linear scan bounded and documented | closed |
| T-59-14 | Repudiation | wiggle determinism | high | mitigate | Stable hash seed, `Random` PRNG, per-call construction, smooth integer-frame interpolation, repeated-call equality tests | closed |
| T-59-15 | Tampering | transform values | medium | mitigate | Opacity clamped 0..1, scale floored at 0, all other values finite-checked by the parser | closed |
| T-59-16 | Spoofing | rail identity resolution | high | mitigate | Exact railId match only; anchor is a hint; first-bind lookup isolated and documented; no heuristic rebind test | closed |
| T-59-17 | Tampering | merge/split transitions | high | mitigate | Pure transition functions with a reported `droppedRailId`; truth-table integration over the real derivation; unchanged frames asserted | closed |
| T-59-18 | Repudiation | session identity leakage | medium | mitigate | `RailSetIdentity` import count 0; record shape test proves no session fields | closed |
| T-59-19 | Tampering | apply payload `railMotions` | high | mitigate | Closed `hasOnlyKeys` allowlist; 59-02 fail-closed parse before any map write; transactional setter that returns before mutating on every failure path | closed |
| T-59-20 | Repudiation | undo/redo of motion edits | high | mitigate | `railMotions` is a required snapshot member; both comparators cover it; replay emits it; dedicated before/after restore test | closed |
| T-59-21 | Denial of service | motion collection in the payload / revision churn | medium | mitigate | 512/5/4096 caps enforced by the 59-02 parser; motion-only edits cannot rotate raster tokens, so repeated key drags do not accumulate cache entries | closed |
| T-59-22 | Tampering | compositor transform | high | mitigate | Finite-checked values from the 59-02 parser; opacity clamped by 59-05; scale floored at 0; single application site with both sites sharing one helper; identity fast path proven by a zero-op assertion | closed |
| T-59-23 | Information disclosure | cache-key staleness | medium | mitigate | `motion:` term carries the collection revision only; a test asserts no sampled value appears in any key and that a motion-only edit leaves `tracks:` unchanged | closed |
| T-59-24 | Denial of service | pivot scan | medium | mitigate | Bounded 256px scan grid, one measure per `railId + contentRevision`, memo-hit assertion, measured Gate D numbers recorded | closed |
| T-59-25 | Tampering | content/transform frame split | high | mitigate | Content frame is a single floor; transform frame is passed unfetched; parity asserted against the evaluator's own output rather than a literal | closed |
| T-59-26 | Denial of service | per-sub-frame composite | medium | mitigate | Per-track raster memo keeps the integer key so each sub-frame reuses one content raster; the flattened memo is bypassed (bounded, expected work) rather than continuously invalidated | closed |
| T-59-27 | Repudiation | fractional cache poisoning | medium | mitigate | Fractional deliveries are never read from or written to the flattened memo; an explicit test asserts an integer retrieval after a fractional call is a fresh compute | closed |
| T-59-28 | Denial of service | lane key rendering | medium | mitigate | Key counts are capped at 4096 by the 59-02 parser before they reach this surface; keys outside the rail band are not rendered; the curve is a single path string, not one element per sample | closed |
| T-59-29 | Spoofing | disabled controls | low | mitigate | Disabled state is always paired with a visible reason (title + aria-description); asserted per control | closed |
| T-59-30 | Tampering | token drift | low | mitigate | Geometry read from one token block; no numeric literals in the component; existing token tests must stay green | closed |
| T-59-31 | Tampering | reorder insertion index | high | mitigate | Measured offsets, clamping, block-aware resolution, and a no-lane equivalence table proving the old behaviour is preserved exactly | closed |
| T-59-32 | Denial of service | layout recomputation | medium | mitigate | One `useMemo`-derived layout for the whole strip; no per-row measurement in a loop over frames; per-row heights come from lane counts, not DOM reads | closed |
| T-59-33 | Repudiation | header/lane misalignment | medium | mitigate | One layout array consumed by both panes; identical-offset test | closed |
| T-59-34 | Tampering | motion commands | high | mitigate | All commands are pure and return a typed result; the only writer is `replaceRotoPhysicalRailMotions`; a test asserts drawing keys, loop clips and breaks are untouched | closed |
| T-59-35 | Spoofing | command availability | high | mitigate | Availability and reason are computed in one pure function and rendered verbatim; a table asserts a non-empty reason for every unavailable case; no local disabled logic in the view | closed |
| T-59-36 | Repudiation | selection scope | medium | mitigate | One `resolveSelectionScope` authority; each command belongs to exactly one scope list; an explicit test that a motion-key selection does not collapse the rail block | closed |
| T-59-37 | Tampering | gizmo write path | high | mitigate | One write endpoint per target; the rail-motion branch calls only the motion command; the reveal-leak contract proves the legacy targets stay raster-free and the new one writes only the motion collection | closed |
| T-59-38 | Repudiation | D-08 auto-key | high | mitigate | The gate lives in the pure command (not the gesture); a keyless channel returns a reason and the document is asserted byte-identical | closed |
| T-59-39 | Tampering | unit conversion | medium | mitigate | One conversion authority (the 59-02 `railMotionValueToUi` pair); parity test between the numeric field and the gizmo; input validation before commit | closed |
| T-59-40 | Repudiation | verification claims | high | mitigate | 22-row traceability table with a concrete evidence pointer per row; REL rows require a test path; live rows require user evidence recorded verbatim | closed |
| T-59-41 | Tampering | dependency surface | high | mitigate | Static import scan plus a frozen dependency baseline with a readable diff | closed |
| T-59-42 | Denial of service | flattened memo growth | high | mitigate | Pointer moves write only the session draft (`mergeRailMotionDraft` imports no store); exactly one commit per gesture; a memo-delta test asserts +1 entry per commit and 0 on an identical overwrite | closed |
| T-59-43 | Repudiation | inspector data path | medium | mitigate | One projection (`projectRailMotionInspector`); the panel reads the prop only (`physicPaintStore` import count 0); the Studio memo dependency array names the record and selected key so a stale view is impossible | closed |
| T-59-44 | Tampering | commit-point reconciliation | high | mitigate | One reconciler call site before `stagedRevision`; transitions are the only identity authority; collection is part of the same document write and the accepted-command snapshot | closed |
| T-59-45 | Repudiation | orphan handling | high | mitigate | Only records active in the previous document are transitioned; an already-orphaned record is returned byte-identically; an explicit orphan test | closed |
| T-59-46 | Tampering | copy re-key | high | mitigate | Whole-plan validation before cloning; null on missing/duplicate/occupied destination; source collection frozen and returned untouched; paste fails closed | closed |
| T-59-47 | Spoofing | parent recompute | high | mitigate | `fingerprintApplyPayload` and `validateCanonicalGroupLifecycleEdit` include the collection; a collection-only mutation is rejected and a fingerprint-change test pins it | closed |
| T-59-48 | Denial of service | reconciler on every edit | low | mitigate | Segment derivation is per-edit only (never per frame); unchanged edits return the input reference and skip re-parsing | closed |
| T-59-49 | Tampering | grouped Position write | high | mitigate | The two axes share frames but not values; the write goes through the 59-12 atomic grouped command; a test captures the stored `position-y` before an X edit and asserts it is deep-equal after, and the create-new case seeds the untouched axis from the evaluator rather than a default | closed |
| T-59-50 | Repudiation | merge-drop confirmation row | medium | mitigate | The reconciler-reported drop is published into a session-only signal with a named Dismiss; `buildRailMotionMergeNoticeCopy` names the dropped frame range; a source pin proves the row renders the built copy; the notice cannot enter the document allowlist, the revision or the fingerprint | closed |
| T-59-51 | Repudiation | merge-drop settlement echo | medium | mitigate | The drop is reported by the same classification that performs the merge (`droppedRailId` + prior key span); the result carries only three bounded scalars, is validator-gated (allowlisted member, mandatory arm, absent on failure and on replay), and is published in the child realm at settlement so a two-sided merge can never be silent; a real-transport test pins the notice on the merge and its absence on the undo, and the member is absent from the document, revision, fingerprint and accepted-command snapshot | closed |
| T-59-52 | Tampering | add-channel command (`railMotionCommands.ts`) | high | mitigate | One command validates rail identity, record presence and channel presence before the reducer runs; the reducer's grouped-Position seeding is the only seed authority; refusals return the input collection reference so a refused add cannot mutate the document | closed |
| T-59-53 | Tampering | session menu state / layout | medium | mitigate | Exactly two named writers for `railMotionChannelMenuRailId`, source-asserted; the expansion toggle nulls the menu on collapse and switch; the add-channel row is the only new layout term and is asserted to leave the absent case byte-identical; the menu renders in an absolute wrapper with a bounded `channelMenuZIndex`, so its rows paint above the following rows and its open height never enters `resolveTrackRowLayout` | closed |
| T-59-54 | Tampering | `buildRailSetCopyDocument` | high | mitigate | The motion collection is read from the same active track as the records and loop clips, passed through the parser (fail-closed validation) and into the 6-argument revision, so the copied document's revision always describes the content it carries; the paste half keeps re-keying through `proposeRails` | closed |
| T-59-55 | Tampering | `railMotionIdentity.ts` span resolver | high | mitigate | The resolver is injected as a structural type; only the infinite branch consults it; a `Math.max` against the fallback makes a wrong answer unable to shorten a view; with no resolver the module returns today's single-occurrence span, so a missing injection degrades to current behaviour rather than to an unbounded transform | closed |
| T-59-56 | Tampering | `_applyRotoTrackSelectionRemoval` drop report | medium | mitigate | The report is built from the same reconciliation whose collection is written, and only returned on the ok branch after every port accepted; failed writes report only the closed failure reason | closed |
| T-59-57 | Tampering | reveal/bake motion write | high | mitigate | Each door derives previous/next snapshots from its own pre-write reads, writes the reconciled collection through the fail-closed port in the same acknowledged transaction, and fails the whole mutation closed when that write fails; the bake substitutes the post-replay clip ownership so no neighbouring rail is merged away | closed |
| T-59-58 | Tampering | Motion value inspector (`projectRailMotionInspector` / `motionValuesSection`) | medium | mitigate | `present` is derived from channel existence only and drives `disabled` + `aria-disabled` + a described note with the command layer's own refusal sentence; the panel's onChange guard makes the zero-commit law hold even under direct invocation, so the inspector can never issue a write the command layer is guaranteed to refuse | closed |
| T-59-59 | Tampering | `commitRevealBake` reconciliation snapshot | high | mitigate | A pre-bake pending clip template carries the creation's loopId and every non-record field; the next snapshot appends it with the baked `sourceKeyIds` before `reconcileRailMotionsForDocumentEdit`; a duplicate loopId fails closed before rendering; the regression asserts the neighbour survives re-anchored and a flattened build still applies its transform | closed |
| T-59-60 | Tampering | `buildRotoRailSetCopyPayload` / `copyTrackSelection` segment ownership | medium | mitigate | One exported `collectRailMotionGroupOwnedKeyIds` (sourceKeyIds + frameOverrides keyId) feeds the reconciler, the payload builder and the store copy, so identity and frozen motion bind to the same segment; the clip-following success row and the clip-owned-member stale-member control pin both sides | closed |
| T-59-61 | Tampering | `TimelineMotionBlock` add-channel availability | medium | mitigate | The block calls `resolveMotionCommandAvailability` once and passes `disabled`/`reason` straight to the row; the row renders the reason verbatim, carries no handler when disabled and forces `aria-expanded` false; tests assert the authority-derived reason, the absent handler and the gated overlay under a stale session signal | closed |
| T-59-62 | Tampering | strip layout flag vs rendered row | medium | mitigate | `activeMotionAddChannelRow` reduces to `activeMotionLaneCount > 0`, the same predicate the block uses to render; the block passes `addChannelRow` for the row it always renders; layout pins cover lane counts 1-4 with a net +18 and the four-lane pin asserts the outline height equals the measured row height; the source contract forbids the second keyless derivation | closed |
| T-59-63 | Tampering | `cutTrackSelection` / `clearTrackFrames` result contracts | low | mitigate | The unreachable optional members are removed, tests assert the exact returned keys, and the merge still provably removes the tail record; the move path's consumer and its strip pins stay untouched | closed |
| T-59-64 | Tampering | canonical ordering parity (TS `localeCompare` vs Rust `str::cmp`) | high | mitigate | One code-unit comparator replaces every canonical sort; the new fixture puts mixed-case and punctuation ids in all four sorted collections so either implementation's order is observable; both parity tests recompute from the same frozen bytes; prior literals must not move | closed |
| T-59-65 | Repudiation | golden fixture provenance | medium | mitigate | The provenance line names the language that moved and why; the fixture is regenerated once from the post-fix TypeScript encoder with a temporary generator that is deleted; the structural `git show HEAD` gate proves no prior document or expected value was rewritten | closed |
| T-59-66 | Tampering | grouped Position easing/wiggle fan-out | medium | mitigate | The command layer is the single owner of the grouping rule; the addressed axis gates the command and each axis is edited with its own resolved value through a pure reducer; a keyless paired axis is seeded at the edit frame by the model's D-12 rule from its own stepped value and then carries the requested property; tests assert both-axis edits, seeded key frames, preserved sibling values elsewhere and the exact missing-key failure | closed |
| T-59-67 | Repudiation | motion lane curve seed | medium | mitigate | The lane passes its own `railId` into the evaluator probe; a wiggle-bearing row proves the rendered path matches the rail-seeded path and differs from the preview-seeded one, so a preview-seeded lane can no longer hide behind a flat curve | closed |
| T-59-68 | Tampering | fixture Loop Clip lifecycle shape feeding two encoders | high | mitigate | Both new clips carry the complete explicit persisted lifecycle block; a structural test walks every fixture document and fails if any Loop Clip omits a lifecycle member; the Rust parity test recomputes the same bytes from the raw fixture, so an implicit block fails at the encoder rather than passing silently | closed |
| T-59-SC | Tampering | npm/pip/cargo installs | high | mitigate | No dependency install occurs in any of the 25 plans; the package-legitimacy gate remains the only install path, and `railMotionDependencySurface.test.ts` pins the frozen dependency set and versions. | closed |

*Status: open · closed · open — below high threshold (non-blocking)*
*Severity: critical > high > medium > low — only open threats at or above workflow.security_block_on (high) count toward threats_open*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

No accepted risks.

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-11-07 | 69 | 69 | 0 | gsd-security-auditor |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-11-07

## Security Audit 2026-11-09

| Metric | Count |
|---|---|
| Threats found | 69 |
| Closed | 69 |
| Open | 0 |
