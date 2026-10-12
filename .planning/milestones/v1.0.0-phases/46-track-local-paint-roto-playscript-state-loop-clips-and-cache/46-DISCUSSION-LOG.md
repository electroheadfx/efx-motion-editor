# Phase 46: Track-local Paint/Roto/PlayScript State, Loop Clips, and Caches - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-08-23
**Phase:** 46-track-local-paint-roto-playscript-state-loop-clips-and-cache
**Areas discussed:** Undo/Redo scope & depth, Cross-track paste semantics, Cross-track drag, Hold linked-source model, Track deletion + assets, Async work on track switch, Track deletion edge laws

---

## Undo/Redo scope & depth

| Option | Description | Selected |
|--------|-------------|----------|
| Unified stack, track-tagged | One document-wide stack; each entry tagged with the trackId it mutated; undo targets the exact track | ✓ |
| Per-track stacks | Each track keeps its own independent undo stack | |
| Hybrid (track + document) | Per-track for content, separate document stack for structure ops | |

**User's choice:** Unified document-wide stack, track-tagged.

| Option | Description | Selected |
|--------|-------------|----------|
| Keep 10-level cap | Fixed operation-count cap per accepted Roto Undo | ✓ |
| Raise the cap | 25-50, more room now that Paint/PlayScript feed undo | |
| Unlimited, revision-based | Unbounded via cheap deterministic revisions | |

**User's choice:** Keep 10-level cap.

| Option | Description | Selected |
|--------|-------------|----------|
| Refs + revision, recompute caches | Store refs + prior deterministic revision hash; recompute caches from real keys on restore | ✓ |
| Snapshot cache refs | Restore exact previously-accepted cache state without recompute | |

**User's choice:** Refs + revision, recompute caches (no raster bytes).

| Option | Description | Selected |
|--------|-------------|----------|
| Auto-activate target track | Undo auto-selects the track it targets | ✓ |
| Keep active track fixed | Undo re-targets content but does not switch active track | |

**User's choice:** Auto-activate target track.
**Notes:** (via "Other") Added two new discussion areas before wrapping up: cross-track copy/paste semantics and cross-track rail/frame drag.

---

## Cross-track paste semantics

| Option | Description | Selected |
|--------|-------------|----------|
| Always fresh identities | Paste is a deep self-contained copy, never links back to source | ✓ |
| Same-track keeps / cross-track fresh | Divergent rules per path | |
| Re-target refs | Keep identity but re-point references | |

**User's choice:** Always fresh identities (v0.9 rail-set rule).

| Option | Description | Selected |
|--------|-------------|----------|
| Re-point to dest frames | Hold clips pasted across tracks reference the dest track's own copied frames | ✓ |
| Keep source refs | Pasted Hold clips keep referencing the source track | |
| Reject if unpointable | Fail-closed when a Hold can't be re-pointed | ✓ |

**User's choice:** Re-point to dest frames, fail-closed when unpointable. Never a dangling or foreign-track reference. No cross-track asset sharing.

| Option | Description | Selected |
|--------|-------------|----------|
| Deep-copy source frames | Dest track fully self-contained, independent of source | ✓ |
| Re-point refs at paste | Shallow re-point at paste time | |
| Strip Loop, copy geometry | Only key/rail geometry copied; Hold clips excluded | |

**User's choice:** Deep-copy source frames on cross-track paste. "No durable asset duplication" applies only to linked repeats INSIDE one Loop Clip; a paste is new independent content.

---

## Cross-track drag

| Option | Description | Selected |
|--------|-------------|----------|
| Data op now, gesture later | Store-level move op in Phase 46; drag gesture in Phase 47 | ✓ |
| Defer to Phase 47 | Phase 46 only in-track primitives | |
| Reject; use copy/paste | No cross-track drag by design | |

**User's choice:** Data op now, gesture later.

| Option | Description | Selected |
|--------|-------------|----------|
| Treat as copy-paste-delete | Fresh identities, source removed, refs re-pointed | ✓ |
| Re-tag + preserve timing (move) | Move semantics, absolute timing preserved | |
| Only whole self-contained rails | Refuse items with Hold/Loop refs | |

**User's choice:** Treat as copy-paste-delete (same rules as paste, fail-closed for Hold).

---

## Hold linked-source model

| Option | Description | Selected |
|--------|-------------|----------|
| Live single source-of-truth | One real frame on owning track; occurrences render by reference | ✓ |
| Cached copy + source invalidation | Per-occurrence cached raster, invalidated on source change | |

**User's choice:** Live single source-of-truth.

| Option | Description | Selected |
|--------|-------------|----------|
| Strict live reference | No per-occurrence override; editing a Hold edits the source | ✓ |
| Allow explicit unlink | Occurrence may break the reference | |
| Local transform override | Occurrence carries local transform | |

**User's choice:** Strict live reference.

| Option | Description | Selected |
|--------|-------------|----------|
| Atomic invalidation + recompute | One revision bump invalidates source + all linked occurrences | ✓ |
| Lazy refresh | Linked occurrences refresh on next playback | |

**User's choice:** Atomic invalidation + recompute.

| Option | Description | Selected |
|--------|-------------|----------|
| Fail-closed placeholder | Source-missing flag renders placeholder until restored | ✓ |
| Keep last raster | Frozen copy of last accepted raster | |

**User's choice:** Fail-closed placeholder.

---

## Track deletion + assets

| Option | Description | Selected |
|--------|-------------|----------|
| Acknowledge-and-delete | Explicit dialog; confirm removes track + cached sidecars | ✓ |
| Refuse until cleared | Two-step: Clear, then delete | |
| Soft-delete with recovery | Hidden/trashed state | |

**User's choice:** Acknowledge-and-delete. Fail-closed = explicit, not blocked.

| Option | Description | Selected |
|--------|-------------|----------|
| Delete sidecars with track | Sidecars removed in same transaction | ✓ |
| Leave sidecars on disk | Only document ref removed | |
| Recycle (recoverable) | Move + sidecars to recoverable state | |

**User's choice:** Delete sidecars with track.

| Option | Description | Selected |
|--------|-------------|----------|
| Refuse if referenced | Block deletion while another track references it | |
| Sever refs, then delete | Re-point or flag source-missing, then delete | ✓ |

**User's choice:** Sever refs, then delete.

---

## Async work on track switch

| Option | Description | Selected |
|--------|-------------|----------|
| Complete on original track | Captures target at start; commits to it even if active changes | ✓ |
| Reject/cancel on switch | Discard stale work at commit | |
| Queue rather than cancel | Queue behind current track ops | |

**User's choice:** Complete on original track.

| Option | Description | Selected |
|--------|-------------|----------|
| Revalidate all, fail-closed | parent + document + track revision; discard on mismatch | ✓ |
| Revalidate active-track too | Also rejects any active-track switch | |

**User's choice:** Revalidate all, fail-closed.

| Option | Description | Selected |
|--------|-------------|----------|
| Capture target at start | Target decided when operation begins | ✓ |
| Route to active at commit | Commit to where the user is now | |

**User's choice:** Capture target at start.

---

## Track deletion edge laws

| Option | Description | Selected |
|--------|-------------|----------|
| Refuse — always 1 Paint track | Document must always have at least one Paint track | ✓ |
| Allow zero Paint tracks | Delete last track, keep only Background | |

**User's choice:** Refuse — always 1 Paint track.

| Option | Description | Selected |
|--------|-------------|----------|
| Nearest adjacent track | Closest by order/row becomes active | ✓ |
| First track in order | Deterministic top-of-list | |
| No-active until picked | Temporary no-active state | |

**User's choice:** Nearest adjacent track.

---

## Claude's Discretion

- Exact store/function shape for track-local addressing and per-track revision/paintVersion split.
- Location of new state in `app/src/efx-paint/` vs. existing stores.
- Acknowledge-delete dialog copy.
- Undo entry serialization detail within the 10-level cap.

## Deferred Ideas

- Multi-row timeline + drag gesture UI — Phase 47.
- Per-track opacity/blend/hide/solo controls — Phase 47 (timeline), compositor Phase 48.
- Independent per-track transforms / effects stacks — future milestone (research "Defer v2+").
