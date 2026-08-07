# Phase 43: Hold Loop Clips + Filmstrip Capsule - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-08-06; surface correction 2026-08-07
**Phase:** 43-hold-loop-clips-filmstrip-capsule
**Areas discussed:** Surface ownership correction, Editing loops after creation, Loops vs other Roto ops, Capsule presentation details, Next-clip boundary definition, Resolver and caching ownership, Playback/preview/export parity, Persistence and backward compatibility, Infinite-loop and large-range performance

---

## Surface ownership correction — 2026-08-07

Native UAT failed at Step 1 because the Loop Clip capsule was implemented on the Motion Editor `PPaint #1` timeline row rather than inside EFX Paint/Roto where physical frames are edited. Verification stopped; this discussion reopens the host decision without patching individual visual defects.

### Motion Editor main timeline

| Option | Description | Selected |
|--------|-------------|----------|
| Remove it | Remove capsule and interactions; Loop Clips are authored only in EFX Paint/Roto | ✓ |
| Read-only summary | Keep a non-interactive secondary capsule | |
| Navigation shortcut | Keep a capsule that only opens/focuses EFX Paint | |

**User's choice:** Remove it completely.

### EFX Paint placement

| Option | Description | Selected |
|--------|-------------|----------|
| Dedicated loop lane | Frame-aligned lane above existing Roto cells; separates loop and key selection | ✓ |
| Overlay on cells | Draw capsule in the existing cell row | |
| Scripts panel list | Manage loops in Scripts with only cell badges on the timeline | |

**User's choice:** Dedicated Loop Clip lane above the physical-frame cells.

### Editing and actions

| Option | Description | Selected |
|--------|-------------|----------|
| Badge edit + local popover | Capsule selects/opens local actions; badge opens Loop Edit; Roto cells keep navigation | ✓ |
| Whole capsule opens dialog | Any click opens Loop Edit | |
| Selection + toolbar | Operations live in persistent lane toolbar | |

**User's choice:** Badge edit plus local EFX Paint popover.

### Lane detail

| Option | Description | Selected |
|--------|-------------|----------|
| Full filmstrip capsule | Preserve thumbnails, repetitions, badge, truncation, unresolved state, anchor flag | ✓ |
| Compact range capsule | Badge/range only; source detail elsewhere | |
| Minimal range blocks | Labels only; detail in popover/dialog | |

**User's choice:** Full filmstrip capsule.

### Empty state

| Option | Description | Selected |
|--------|-------------|----------|
| Hidden when empty | Existing EFX Paint geometry remains unchanged until a loop exists | ✓ |
| Always visible | Permanent empty Loop Clips row | |
| Collapsible lane | Persistent labeled row with collapse state | |

**User's choice:** Hidden when empty.

---

## Editing loops after creation

| Option | Description | Selected |
|--------|-------------|----------|
| Badge click reopens dialog | Clicking the capsule badge reopens the Play Script dialog in an edit mode targeting that loop; reuses Phase 42 dialog controls | ✓ |
| Drag capsule end + badge toggle | Drag right edge to change repeat stepwise; infinity via badge click | |
| Read-only; re-apply to change | Capsule display-only; user re-runs Play Script over the range | |

**User's choice:** Badge click reopens dialog.
**Notes:** Edit mode fields: only Repeat + Infinity + Requested/Effective readout (primary `Update loop`). User added the secondary `Edit source cycle…` action opening the full dialog in a separate source-edit mode (prefilled mode/Frames per cycle/color/Motion; states regeneration updates every linked Loop Clip; shows affected loop count when shared; confirmation `Regenerate source cycle`; existing staged commit/capacity/authority/cancellation/Undo/Redo; Cancel changes nothing; linked loops re-resolve after success).

| Option | Description | Selected |
|--------|-------------|----------|
| Delete = unlink only | Loop link removed; source cycle keys stay ordinary Roto keys | ✓ |
| Delete with two options | Unlink or remove loop + source keys | |
| No direct loop delete | Deleting source keys dissolves the loop | |

**User's choice:** Delete = unlink only.

| Option | Description | Selected |
|--------|-------------|----------|
| Anchor to source keys | Loop anchored to source cycle; existing rigid group drag moves it | ✓ |
| Independent loop drag | Loop draggable independently of source keys | |

**User's choice:** Anchor to source keys.

| Option | Description | Selected |
|--------|-------------|----------|
| Auto-dedup identical cycles | Identical apply auto-links to existing source cycle | |
| Always own source cycle | Every application generates its own source cycle | |
| Ask at apply time | Dialog offers `Link to existing cycle` vs `Create new cycle` | ✓ |

**User's choice:** Ask at apply time.

---

## Loops vs other Roto ops

| Option | Description | Selected |
|--------|-------------|----------|
| Reject overlap, fail-closed | Writes inside loop range rejected | |
| Content wins, loop adapts | Real keys truncate/split the loop | |
| Loop shrinks to fit | Writes shorten effective duration; loop intact | ✓ |

**User's choice:** Loop shrinks to fit — later confirmed as the uniform policy for ALL content-producing operations (manual writes + Play Script apply + Roto interpolation).

| Option | Description | Selected |
|--------|-------------|----------|
| Reject while linked | Source-cycle key deletion rejected; unlink first | ✓ |
| Allow; loops dissolve | Deleting source keys dissolves loops | |
| Allow; cycle shrinks | Cycle length drops; loops re-resolve | |

**User's choice:** Reject while linked.

| Option | Description | Selected |
|--------|-------------|----------|
| Survive at zero | Loop survives at Effective 0f; re-expands when blocker moves | ✓ |
| Dissolve at zero | Loop dissolves at zero effective duration | |

**User's choice:** Survive at zero.

| Option | Description | Selected |
|--------|-------------|----------|
| Paste as ordinary keys | Clipboard never carries loop identity | ✓ |
| Paste carries the loop | Copying a full source cycle carries its loop | |

**User's choice:** Paste as ordinary keys.

| Option | Description | Selected |
|--------|-------------|----------|
| Atomic undoable ops | Update loop / Unlink each one atomic undoable operation | ✓ |
| Not undoable | Session-level, no undo | |

**User's choice:** Atomic undoable ops.

| Option | Description | Selected |
|--------|-------------|----------|
| Rigid only while linked | Single-key drag on linked source key rejected; group drag only | ✓ |
| Ripple allowed, loop re-resolves | Single-key ripple retimes all occurrences | |
| Unlink then ripple | Drag unlinks first with confirmation | |

**User's choice:** Rigid only while linked — Force Spacing also rejects selections containing linked source keys (one uniform "linked cycle = rigid" contract).

**User's choice (loop-loop overlap, free text):** Requested ranges may overlap; effective ranges never overlap. Timeline order (not creation order) sets priority: loop B begins at its canonical start; B's start bounds loop A (A effective end = min(A requested end, B start, parent end)); B is NOT pushed after A and is independently truncated; infinite earlier loop ends effectively at the later loop's start; moving/deleting the later loop re-expands the earlier; canonical Requested unchanged, Effective derived; same-start collisions rejected or explicit replace/update, never hidden creation-order priority.

| Option | Description | Selected |
|--------|-------------|----------|
| Materialize local key | Paint/erase on linked frame creates local real key (resolved pixels + stroke); loop shortens | ✓ |
| Redirect to source frame | Stroke redirected to modulo-resolved source frame; all occurrences update | |
| Reject + offer actions | Reject with `Edit source frame` / materialize actions | |

**User's choice:** Materialize local key. Canvas/playhead stay; one Undo removes the key and the loop re-expands.

**User's choice (Clear/Delete on linked frame, free text):** Clear materializes a local empty real key (source untouched, frame becomes boundary, loop shortens, atomic undoable, one Undo re-expands). Delete-key rejected (no local real key) with: `No real key exists at this linked frame. Use Clear to create an empty real key, or select the Loop Clip capsule to delete the loop.` — never touches the source key, never unlinks. A materialized empty key can later be deleted normally, re-expanding the loop. Delete loop = separate unlink-only op on the selected capsule.

| Option | Description | Selected |
|--------|-------------|----------|
| Explicit duplicate action | Capsule `Duplicate linked loop` action sharing the source cycle | ✓ |
| Only via Apply + Link | No capsule duplication | |
| No duplication in Phase 43 | No duplication path at all | |

**User's choice:** Explicit duplicate action (validated for same-start collision and overlap; no regeneration).

---

## Capsule presentation details

| Option | Description | Selected |
|--------|-------------|----------|
| Real thumbnails | Source-cycle cells show downscaled cached PNGs | ✓ |
| Abstract numbered cells | Frame index chips, no imagery | |
| First-frame thumb + cells | Hybrid | |

**User's choice:** Real thumbnails.

| Option | Description | Selected |
|--------|-------------|----------|
| Zoom-adaptive, ghost cells | Default hatched band; high zoom expands to lighter ghost cells; low zoom band + badge | ✓ |
| Always hatched band | Same render at all zooms | |
| Expand with full thumbnails | High zoom repeats full thumbnails | |

**User's choice:** Zoom-adaptive, ghost cells.

| Option | Description | Selected |
|--------|-------------|----------|
| Tooltip reveal | Click shows repeat instance + source-frame index | |
| Seek to source frame | Click seeks playhead to source frame | |
| Tooltip + separate seek action | Both, as distinct interactions | ✓ |

**User's choice:** Tooltip + separate seek action.

| Option | Description | Selected |
|--------|-------------|----------|
| Main editor timeline only | Studio strip unchanged | |
| Studio strip shows loop markers too | Strip also marks linked frames | ✓ |

**User's choice:** Studio strip shows loop markers too — as an additive link badge/border preserving cell-state semantics, geometry, real-key diamonds, and the Phase 36.15 legend (no new cell state).

| Option | Description | Selected |
|--------|-------------|----------|
| Compact math badge + tooltip | `Cycle 5f × 5 = 25f` / `× ∞` / `× 1 = 5f`; details in tooltip | ✓ |
| Badge with inline effective | `Cycle 5f × 5 = 25f → 18f` | |
| Mode-prefixed badge | `Hold · Cycle 5f × 5 = 25f` | |

**User's choice:** Compact math badge + tooltip. Requested/Effective, truncation status, and mode live in the tooltip; truncation never changes the badge.

| Option | Description | Selected |
|--------|-------------|----------|
| English only | `Loop shortened by next clip`; HOLD-06 French phrase superseded | ✓ |
| French only per HOLD-06 | Ship `Boucle raccourcie par le clip suivant` | |
| English now, i18n-ready | English behind a string table | |

**User's choice:** English only. `clip bloquant` remains prohibited in every language.

| Option | Description | Selected |
|--------|-------------|----------|
| Diagonal cut, position encodes partial/complete | Diagonal trailing-corner cut; mid-cell (partial) vs cycle boundary (complete); amber stroke | ✓ |
| Uniform diagonal + tooltip distinction | Same diagonal; distinction only in tooltip | |
| No diagonal, tooltip only | Rejected by spec language | |

**User's choice:** Diagonal cut, position encodes partial/complete; low zoom keeps the diagonal on the band end.

| Option | Description | Selected |
|--------|-------------|----------|
| Anchor flag at start | Greyed ~6px pill + `0f` marker at canonical start; full access | ✓ |
| Hidden, edit via source keys | No marker at zero | |
| Dashed requested-range outline | Dashed outline over requested range | |

**User's choice:** Anchor flag at start — clickable/selectable/keyboard-focusable, badge-edit/unlink/delete-loop access, never invisible, re-expands into full capsule.

| Option | Description | Selected |
|--------|-------------|----------|
| Timeline-idiom states | Hover raise + tooltip; accent-outline selection of the loop object; focus ring; reduced-opacity stale; red-outline error | ✓ |
| Custom capsule state system | Richer capsule-specific states | |

**User's choice:** Timeline-idiom states; ghost cells never key-selectable; capsule never silently disappears.

---

## Next-clip boundary definition

| Option | Description | Selected |
|--------|-------------|----------|
| Real keys + loop starts + parent end | Key-based boundary model; render-only frames never truncate | ✓ |
| Any resolved content truncates | Interpolated frames also truncate | |

**User's choice:** Real keys (including empty real keys) + loop starts + parent end.

| Option | Description | Selected |
|--------|-------------|----------|
| Dynamic parent-end tracking | Infinite loop grows/shrinks with the parent sequence | ✓ |
| Snapshot parent end at apply | Parent end captured at apply time | |

**User's choice:** Dynamic parent-end tracking; finite loops never grow past requested duration.

---

## Resolver and caching ownership

| Option | Description | Selected |
|--------|-------------|----------|
| Extend physical resolver | Virtual-resolution rule in `physicsPaintRotoPhysicalResolver.ts`; real keys win; one source cache serves all occurrences | ✓ |
| New standalone resolver module | Separate package-level resolver | |
| Compositor-level resolution | Resolution at render time | |

**User's choice:** Extend physical resolver. Linked occurrences never get raster/cache entries; source edits invalidate the single source entry; missing/stale refs fail visibly; cache weight scales with source cycles only.

---

## Playback, preview, and export parity

| Option | Description | Selected |
|--------|-------------|----------|
| One canonical resolver everywhere | Preview, playback, Studio, filmstrip, export, reopen all read the same output | ✓ |
| Canonical resolver + cached adapters | Adapters allowed with contract tests | |

**User's choice:** One canonical resolver everywhere. Same project frame → same Paint raster; export never differs from preview; Infinity bounded by current parent end at export time.

| Option | Description | Selected |
|--------|-------------|----------|
| Preview placeholder, export blocked | Marked placeholder in preview; export blocked with clear error | ✓ |
| Placeholder everywhere, warn on export | Export completes with warning | |
| Block both | Loop preview disabled and export blocked | |

**User's choice:** Preview placeholder, export blocked — a deliverable never silently contains placeholder frames.

---

## Persistence and backward compatibility

| Option | Description | Selected |
|--------|-------------|----------|
| Additive in-document records | Optional `loopClips` in the physical document; v0.8.1 loads empty; no migration | ✓ (amended) |
| Separate loop sidecar | Second persistence channel | |
| Lock semantics only, schema to research | Defer schema entirely | |

**User's choice (free text, amended):** Additive in-document records, but stale/missing source references are NEVER silently dropped. Physical document is the single persistence authority; no sidecar. Locked minimum record: stable Loop Clip id; canonical start frame; ordered stable source-cycle keyId refs; finite Repeat or explicit Infinity; source-cycle provenance incl. Progressive vs Static/Hold if not derivable. Requested derived; Effective/boundaries/truncation/instance mappings/resolved frames never persisted — always recomputed. No persisted source revision as invalidation authority (source edits stay valid and propagate). Stale refs preserved verbatim: loop marked unresolved/error, capsule/error marker retained, tooltip lists missing refs, preview placeholders, exports blocked, explicit repair/relink/unlink/delete-loop actions; save/reopen preserves the unresolved record exactly; Save As copies records atomically. Exact TS field names are implementation research; semantics, additive/no-migration, Effective-derived, and no-silent-data-loss are locked.

---

## Infinite-loop and large-range performance

| Option | Description | Selected |
|--------|-------------|----------|
| Virtual resolution invariant | O(1) modulo; no materialized frame lists; visible-cell rendering; incremental export; no per-repetition rasters | ✓ |
| Invariant + explicit caps | Add max loops / cycle length caps | |
| Lock invariant only | Mechanisms to researcher/planner | |

**User's choice:** Virtual resolution invariant. Canvas timeline = zero DOM nodes for ghost cells; boundary move/remove re-resolves O(keys+loops in range) with no cache rebuild; no artificial caps beyond existing limits.

---

## Claude's Discretion

- Exact TypeScript field names and document-schema seam for `loopClips`.
- HOLD-02 determinism hardening test strategy.
- Exact ghost-cell/hatch/diagonal/anchor-flag drawing code within locked presentation semantics.
- Thumbnail downscale dimensions for source-cycle cells.
- Exact tooltip copy phrasing within locked content requirements.

## Deferred Ideas

None — discussion stayed within phase scope.
