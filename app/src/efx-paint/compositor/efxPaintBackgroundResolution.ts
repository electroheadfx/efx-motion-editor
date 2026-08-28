/**
 * Pure Background-resolution adapter (Phase 48-02, D-03).
 *
 * Maps the document's `FrameLoopClip` records into the existing Loop Clip
 * resolver's derivation input. The modulo / repeat / interruption math is
 * deliberately NEVER re-implemented here (Pitfall 10): the resolver
 * (`physicsPaintRotoPhysicalResolver.ts`) is the single effective-duration
 * authority; this module only maps `FrameLoopClip` records to
 * `PhysicPaintRotoLoopClip` records and derives ONE memoized resolution
 * context per background record identity (D-32 — never per effective-range
 * frame, Pitfall 11: infinite loops are never materialized into per-frame
 * records). The deleted filmstrip capsule projection
 * `projectBackgroundFrameLoopClipCapsule` (removed in commit 346d47bc) is NOT
 * resurrected — this is compositor-side resolution, not UI.
 *
 * Purity contract (efxPaintDocument.ts:1-9 idiom): deliberately free of Preact
 * imports, signals, and side effects. Type imports come from the document
 * model; value imports come only from the resolver and the physical model.
 *
 * Task 2 (48-02) adds the per-frame query (`resolveEfxPaintBackgroundFrame`)
 * over this context.
 */

import type { BackgroundTrack, FrameLoopClip } from '../document/efxPaintDocument';
import { derivePhysicPaintRotoLoopRanges } from '../../components/physic-paint/roto/physicsPaintRotoPhysicalResolver';
import type { PhysicPaintRotoLoopResolutionContext } from '../../components/physic-paint/roto/physicsPaintRotoPhysicalResolver';
import type {
  PhysicPaintRotoKeyIdentity,
  PhysicPaintRotoLoopClip,
} from '../../components/physic-paint/roto/physicsPaintRotoPhysicalModel';

/**
 * Identity-memoized resolver derivation context cache. Keyed by the
 * BackgroundTrack record identity (WeakMap so an abandoned document can be
 * collected); the entry stores the capacity it derived for, so the same
 * record re-derives when the parent-end bound changes. Mirrors the
 * `_rotoPhysicalStructuralCache` identity-compare idiom (physicPaintStore.ts).
 */
const _backgroundResolutionCache = new WeakMap<
  BackgroundTrack,
  { readonly capacity: number; readonly context: PhysicPaintRotoLoopResolutionContext }
>();

/**
 * Map ONE document `FrameLoopClip` to the resolver's `PhysicPaintRotoLoopClip`
 * contract (Pitfall P-48-2). Exact field correspondence:
 * loopId ← id, placementStart ← startFrame, sourceKeyIds ← sourceFrameRefs,
 * repeat ← finite count or 'infinity', mode ← 'progressive' (the resolver's
 * static/progressive distinction is a Hold/PlayScript concern, not a
 * Background one). Malformed clips (empty refs, negative start, count < 1)
 * fail the resolver's own strict validation at derivation time.
 */
function mapFrameLoopClipToResolverClip(clip: FrameLoopClip): PhysicPaintRotoLoopClip {
  return {
    loopId: clip.id,
    placementStart: clip.startFrame,
    sourceKeyIds: [...clip.sourceFrameRefs],
    repeat: clip.repeat.mode === 'infinite' ? 'infinity' : clip.repeat.count,
    mode: 'progressive',
  };
}

/**
 * Derive the memoized Background resolution context for one background record
 * identity. `capacity` is the parent sequence frame count — the spec's
 * parentEnd boundary (the 48-03 store port supplies it). Derives ONCE per
 * (background record identity, capacity) and returns the SAME frozen context
 * object on repeat calls; a changed clip revision (new record identity)
 * re-derives. Fails closed: malformed clips surface the resolver's validation
 * throw at derivation time — never silently clamped.
 */
export function deriveEfxPaintBackgroundResolution(
  background: BackgroundTrack,
  capacity: number,
): PhysicPaintRotoLoopResolutionContext {
  const cached = _backgroundResolutionCache.get(background);
  if (cached !== undefined && cached.capacity === capacity) return cached.context;

  const identities: PhysicPaintRotoKeyIdentity[] = [];
  const loopClips: PhysicPaintRotoLoopClip[] = [];
  for (const clip of background.clips) {
    // One synthetic identity per source ref: the clip's own source cycle is
    // placed at [startFrame, startFrame + refs.length), so the resolver's
    // modulo source mapping addresses exactly that cycle.
    clip.sourceFrameRefs.forEach((ref, index) => {
      identities.push({ keyId: ref, appFrame: clip.startFrame + index });
    });
    loopClips.push(mapFrameLoopClipToResolverClip(clip));
  }
  const context = derivePhysicPaintRotoLoopRanges({
    identities,
    loopClips,
    capacity,
    // Background gaps reveal the fallback — never generated frames.
    interpolationEnabled: false,
  });
  _backgroundResolutionCache.set(background, { capacity, context });
  return context;
}
