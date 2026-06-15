# Quick Task 260615-iui: Phase 36.1 Consolidation
When I add brush stroke on a frame in play canvas, it add stroke from the last frame cache image, it works because re-render play canvas make the stroke inserted in the right frame and animatated after the stroke from the frame I painted.
I am except to be perfect that It paint the stroke from the frame over the actual frame cache and not on the last. - Context

**Gathered:** 2026-06-15
**Status:** Ready for planning

<domain>
## Task Boundary

Phase 36.1 Consolidation
When adding a brush stroke on a frame in play canvas, the immediate stroke composite currently uses the last frame cache image. The eventual re-render makes the stroke land on the correct frame and animate correctly afterward, but the immediate paint result should be perfect: the stroke should be painted over the actual frame cache for the frame being painted, not over the last frame cache.

</domain>

<decisions>
## Implementation Decisions

### Cache source
- Use the cache/image for the current frame being painted as the immediate paint background.

### Affected modes
- Scope this quick fix to the normal brush-stroke insertion path only.
- Avoid changing physics paint, move/deform, or broader play edit behavior unless the exact same brush path is shared.

### Verification
- User will perform the visual check in the running app.
- Do not run the dev server; project instructions say the user runs it.

</decisions>

<specifics>
## Specific Ideas

The expected behavior is that painting on a play-canvas frame immediately shows the new stroke over that frame's actual cached image, rather than briefly compositing it over the last frame's cached image until a re-render corrects it.

</specifics>

<canonical_refs>
## Canonical References

No external specs — requirements fully captured in decisions above.

</canonical_refs>
