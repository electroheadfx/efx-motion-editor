---
phase: 52-shared-mask-compositor-and-reveal
finding: CR-01 (52-REVIEW / 52-VERIFICATION)
fixed: 2026-09-02
status: fixed
commit: de8ce3a9 (code + tests)
---

# CR-01 Fix Summary: Reveal rail undo leaves the runtime store out of sync

## What was wrong

The four reveal mutations in `app/src/stores/efxPaintStore.ts`
(`createRevealRail`, `replayRevealRail`, `deleteRevealRail`,
`resizeRevealRail`) write BOTH the document AND the `physicPaintStore`
runtime — baked records through `commitRevealBake` / `replaceRotoPhysicalRecords`,
the rail clip through `replaceRotoPhysicalLoopClips`. Their undo/redo is
handled by the shared `'background'` branch of the undo path in
`useRotoPhysicalEditHistory.ts` (~lines 772-786), which called
`registerDocument(entry.descriptor.before)` and nothing else — it never rolled
back the runtime.

Consequences:
1. The strip kept rendering the rail after undo (the Studio reads the rail list
   from `physicPaintStore.getRotoPhysicalLoopClips`, PhysicsPaintStudio.tsx ~622).
2. The next `serializeRuntimeIntoDocument` (efxPaintStore.ts ~1598) re-projected
   the orphaned baked keys back into the document — effectively undoing the undo.
3. The RVL-06 tests only asserted the document object, never the runtime, so the
   divergence was untested.

## What was changed

### `app/src/stores/efxPaintStore.ts` — new `resyncRuntimeForBackgroundEdit`

The track-scoped counterpart of `hydrateRuntimeFromDocument`: given a
`BackgroundEditDescriptor` and a direction (`'undo'` | `'redo'`), it locates the
affected track (the single track whose object identity differs between
`before` and `after` — the reveal mutations replace exactly one track's
rotoPhysical projection while every other track keeps reference identity) and
installs that track's rotoPhysical (records + rail clips) from the target
document into the runtime via the existing
`physicPaintStore.installRuntimeStateFromDocument`.

**Frames argument decision: empty per track.** The reveal baked keys are
RECORD-level content: their pixels ride the record `payload.dataUrl` (an inline
PNG validated by `isRenderedPngDataUrl`) and the structural compositor path
(`getRotoPhysicalRenderSource` → decode dataUrl on demand) resolves them without
the derived frame-byte cache. `installRuntimeStateFromDocument` deletes the
track's frame cache and re-installs only `payload.frames`; passing empty frames
restores the exact pre-edit runtime state and drops any orphaned/derived raster
bytes for the affected track. The frame cache recomputes through the normal
repaint pipeline — it is never the source of truth.

**Scope decision: apply only to track-divergent background entries.** Only the
reveal mutations write the runtime; the other background kinds (Phase 49
background clip edits, photo reference set/clear, background fallback) are
document-only and their documents never diverge on a track's rotoPhysical, so
`resyncRuntimeForBackgroundEdit` no-ops and returns `true` for them. This leaves
the verified Phase 49 BKG-08/D-08 background-track delete undo byte-for-byte
untouched. Track-scoped installation (never the whole document) also preserves
other tracks' runtime records that may be ahead of the document (in-flight
edits not yet serialized), mirroring how the physical undo/redo path restores
only the affected track.

### `useRotoPhysicalEditHistory.ts` — wire the resync into both branches

- **Undo** (background branch): after the live-document authority guard, call
  `resyncRuntimeForBackgroundEdit(descriptor, 'undo')` BEFORE `registerDocument`
  and the stack move. A failed install returns `false` and fails the undo closed
  (document not yet restored, stacks untouched) — fail-closed like the authority
  guard.
- **Redo** (background branch): symmetric
  `resyncRuntimeForBackgroundEdit(descriptor, 'redo')` after its authority guard.
  (Redo had the identical divergence — without this, redo restored the document
  `after` but left the runtime at the post-undo state.)

### `app/src/stores/efxPaintStore.reveal.test.ts` — runtime assertions

The RVL-06 tests now mirror the exact seam the fix uses: each undo/redo calls
`resyncRuntimeForBackgroundEdit(descriptor, direction)` before
`registerDocument(...)`, and asserts the RUNTIME state
(`physicPaintStore.getRotoPhysicalLoopClips` / `getRotoRealKeyRecords`) as well
as the document object:

- **create** — undo: runtime rail clip gone, baked records gone; redo: runtime
  rail + records restored.
- **replay** — undo: the replayed (overwritten) PNG records are gone from the
  runtime; the pre-replay PNG keys are back (previously the runtime kept the
  overwritten keys and the next serialize re-projected them).
- **delete** — undo: runtime rail clip + baked records restored as one unit.
- **span shrink** — undo: runtime gains frame 12's key again, and the rail clip
  source cycle grows back to the pre-shrink length.

This is exactly the divergence guard the verifier asked for: a regression that
leaves the runtime out of sync now fails these tests.

## How it was verified

1. `vitest run src/stores/efxPaintStore.reveal.test.ts` — 9 tests pass (CR-01
   runtime assertions included).
2. `vitest run src/components/physic-paint/hooks/useRotoPhysicalEditHistory.test.ts
   src/components/physic-paint/hooks/useRotoPhysicalEditCoordinator.test.ts
   src/stores/efxPaintStore.test.ts` — 155 tests pass, including the Phase 49
   Bg clip delete undo/redo through the changed background branch (BKG-08/D-08).
3. Full suite `vitest run` — 3366 passed (baseline unchanged), 0 failures.
4. `tsc --noEmit` — clean.
5. Post-commit check: no unintended file deletions, no untracked artifacts.

## Files

| File | Change |
| ---- | ------ |
| `app/src/stores/efxPaintStore.ts` | added `resyncRuntimeForBackgroundEdit` (exported) |
| `app/src/components/physic-paint/hooks/useRotoPhysicalEditHistory.ts` | call the resync in both background undo and redo branches (fail-close on failure) |
| `app/src/stores/efxPaintStore.reveal.test.ts` | RVL-06 tests mirror the real seam and assert runtime state |

Commit: `de8ce3a9` — `fix(52): re-sync the runtime store on reveal undo/redo (CR-01)`
