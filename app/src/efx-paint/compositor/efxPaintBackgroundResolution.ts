/**
 * Pure Background-resolution adapter (Phase 48-02, D-03).
 *
 * Maps the document's `FrameLoopClip` records into the existing Loop Clip
 * resolver's derivation input and exposes a per-frame Background query that
 * returns content / gap / missing exactly per the spec's loop rules
 * (SPECS/milestone-v1.0.0-plan.md:511-552).
 *
 * The modulo / repeat / interruption math is deliberately NEVER re-implemented
 * here (Pitfall 10): `physicsPaintRotoPhysicalResolver.ts` is the single
 * effective-duration authority; this module only maps `FrameLoopClip` records
 * to `PhysicPaintRotoLoopClip` records, derives ONE memoized resolution
 * context per background record identity, and queries it per frame (D-32 —
 * never per effective-range frame, Pitfall 11: infinite loops are never
 * materialized into per-frame records). The deleted filmstrip capsule
 * projection `projectBackgroundFrameLoopClipCapsule` (removed in commit
 * 346d47bc) is NOT resurrected — this is compositor-side resolution, not UI.
 *
 * Purity contract (efxPaintDocument.ts:1-9 idiom): deliberately free of Preact
 * imports, signals, and side effects. Type imports come from the document
 * model; value imports come only from the resolver and the physical model.
 * The runtime known-source set is injected by the caller (the 48-03 store
 * port supplies the real set), so this module never touches the store.
 */

import type { BackgroundTrack, FrameLoopClip } from '../document/efxPaintDocument';
import {
  derivePhysicPaintRotoLoopRanges,
  resolvePhysicPaintRotoLoopFrame,
} from '../../components/physic-paint/roto/physicsPaintRotoPhysicalResolver';
import type {
  PhysicPaintRotoLoopRange,
  PhysicPaintRotoLoopResolutionContext,
} from '../../components/physic-paint/roto/physicsPaintRotoPhysicalResolver';
import type {
  PhysicPaintRotoKeyIdentity,
  PhysicPaintRotoLoopClip,
} from '../../components/physic-paint/roto/physicsPaintRotoPhysicalModel';

/**
 * Per-frame Background resolution (CMP-06, D-03/D-09).
 *
 * - `content`: this frame shows the named source ref of the owning clip.
 * - `gap`: no clip covers this frame — the document fallback shows. A gap
 *   deliberately carries no clipId.
 * - `missing`: the frame is covered but its source cannot be resolved — the
 *   compositor renders transparent pixels and reports the refs (D-31 → D-09),
 *   never a placeholder and never a fabricated source.
 */
export type EfxPaintBackgroundFrameResolution =
  | { readonly kind: 'content'; readonly clipId: string; readonly sourceRef: string }
  | { readonly kind: 'gap' }
  | { readonly kind: 'missing'; readonly clipId: string; readonly missingRefs: readonly string[] };

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

/**
 * The single background-frame query: content / gap / missing for one
 * application frame against a pre-derived context (D-32 — never re-derives per
 * frame). `knownSources` is the injected runtime-known source-ref set (the
 * fail-closed oracle for dangling refs); the pure module never fabricates a
 * source and never touches the store. This query is visibility-agnostic — the
 * Background visibility decision belongs to the compositor (48-04), not here.
 */
export function resolveEfxPaintBackgroundFrame(
  context: PhysicPaintRotoLoopResolutionContext,
  frame: number,
  knownSources: ReadonlySet<string>,
): EfxPaintBackgroundFrameResolution {
  const resolution = resolvePhysicPaintRotoLoopFrame(context, frame);
  switch (resolution.kind) {
    case 'empty':
      return Object.freeze({ kind: 'gap' }) as EfxPaintBackgroundFrameResolution;
    case 'real': {
      // A synthetic identity at this frame names a source ref directly.
      const range = findOwningRange(context, frame);
      if (range === null || !range.sourceKeyIds.includes(resolution.keyId)) {
        return Object.freeze({ kind: 'gap' }) as EfxPaintBackgroundFrameResolution;
      }
      return resolveContentOrMissing(range.loopId, resolution.keyId, knownSources);
    }
    case 'linked': {
      // The resolver reports the cycle position (sourceKeyId) — never
      // re-derived modulo here (Pitfall 10).
      return resolveContentOrMissing(resolution.loopId, resolution.sourceKeyId, knownSources);
    }
    case 'linked-gap':
      // A strict interior with interpolation disabled resolves 'linked-gap' —
      // the fallback shows there (spec: gaps reveal the document fallback).
      return Object.freeze({ kind: 'gap' }) as EfxPaintBackgroundFrameResolution;
    case 'linked-unresolved':
      // D-31 → D-09: dangling refs name exactly the missing list, never throw.
      return Object.freeze({
        kind: 'missing',
        clipId: resolution.loopId,
        missingRefs: Object.freeze([...resolution.missingSourceKeyIds]),
      }) as EfxPaintBackgroundFrameResolution;
    case 'linked-generated':
      // Impossible: Background derives with interpolationEnabled === false,
      // so strict interiors are 'hold'/'gap' — never 'generate'. Deliberate
      // throw (a future enablement is a compile-time review point).
      throw new Error(`Unhandled Background frame resolution kind: ${JSON.stringify(resolution)}`);
    default: {
      const exhaustive: never = resolution;
      throw new Error(`Unhandled Background frame resolution kind: ${JSON.stringify(exhaustive)}`);
    }
  }
}

function resolveContentOrMissing(
  clipId: string,
  sourceRef: string,
  knownSources: ReadonlySet<string>,
): EfxPaintBackgroundFrameResolution {
  if (!knownSources.has(sourceRef)) {
    // Fail-closed oracle: the resolved ref is not a known source — report it,
    // never fabricate a pixel and never cross-track lookup (T-48-06).
    return Object.freeze({ kind: 'missing', clipId, missingRefs: Object.freeze([sourceRef]) }) as EfxPaintBackgroundFrameResolution;
  }
  return Object.freeze({ kind: 'content', clipId, sourceRef }) as EfxPaintBackgroundFrameResolution;
}

/**
 * The unique range covering a frame (half-open [placementStart, effectiveEnd)),
 * via the same placementStart-sorted binary search the resolver's own query
 * uses. Ranges never overlap in a successfully derived document.
 */
function findOwningRange(
  context: PhysicPaintRotoLoopResolutionContext,
  frame: number,
): PhysicPaintRotoLoopRange | null {
  const ranges = context.ranges;
  let low = 0;
  let high = ranges.length - 1;
  let candidateIndex = -1;
  while (low <= high) {
    const mid = (low + high) >> 1;
    if (ranges[mid].placementStart <= frame) {
      candidateIndex = mid;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }
  if (candidateIndex < 0) return null;
  const range = ranges[candidateIndex];
  return frame < range.effectiveEnd ? range : null;
}
