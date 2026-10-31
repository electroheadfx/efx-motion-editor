# Quick Task 261031-vbo: Run Script merge result becomes a Standard Rail — Context

**Gathered:** 2026-10-31
**Status:** Ready for planning

<domain>
## Task Boundary

Quick C changes what a Run Script **stack** produces. Quick A (`261031-i54`) and Quick B (`261031-qps`) made a stack keep/convert the destination rail's type and adopt the run's Mode/Motion/Color (Quick A UAT round 1) and, for Reveal, its reveal knobs (Quick B). Live UAT showed the consequence: a Motion rail + Static run became a Static rail and the first rail's motion was lost; a stacked rail also kept a single-script provenance, so Regenerate could wipe the blend.

The user-locked model: **a stack is a merge of results, not a rail type.** Any existing rail (Motion, Static, Reveal, or already Standard) can receive any incoming run type (Motion, Static, Reveal). The merge turns the destination into a **Standard Rail** — or keeps it Standard — a normal flat rail with mixed cache and/or per-key scripts, cycle/repeat options, normal key editing, a **gray line**, no Motion/Static/Reveal identity, no single-script provenance, and no Regenerate/Replay. The target's cached frames/animation are preserved; the incoming run is composited over them; the incoming run's type only decides how that run's script is baked. One undo restores the original typed rail exactly. Sequences like "3 static + 1 reveal + motion" end as one Standard Rail.

Do not re-implement Quick A/B. Their collision, extend-only, repeat-unchanged, Keep and atomic-undo laws still hold. This quick intentionally reverses their stack-result adoption law.

</domain>

<decisions>
## Implementation Decisions

### Standard Rail result
- Any destination rail + any incoming type = one Standard Rail.
- The target's cached frames/animation are preserved; the incoming run composites over them (Keep ON records the per-key blend over the durable base; Keep OFF flattens; Keep semantics unchanged).
- The incoming run's Motion/Static/Reveal type is a run setting that shapes that run's bake only; it never converts the rail.
- After the merge, drop the destination's single-script provenance and reveal identity: `scriptId`, `motion`, `overrideColor`, `railKind: 'reveal'` and reveal settings (`colorize`, `colorizeMix`, `photoWiggle`, and any reveal-only flag) are removed in the same atomic commit.
- Keep the required `mode` field internally (schema) with the target's stored value; it is never presented as a rail type.
- Keep the target's `keyScriptEdits` and Paint bake settings needed for per-key script editing; per-key scripts stay editable.
- Cycle/repeat options remain; the Quick A/B collision/extension/repeat/atomic-undo laws hold.
- One undo restores the original typed rail exactly, including provenance and reveal settings.
- Save → reopen keeps the Standard Rail and its blend.
- No persisted schema/format change: Standard = a playscript Loop Clip with no provenance; the parser already allows absent provenance. If a stored field proves unavoidable, STOP and report.

### Standard Rail presentation
- Label: "Standard Rail"; the group type label and tooltip say Standard, never Motion/Static/Reveal.
- Line color: a neutral GRAY (the user's UAT screenshot shows the gray line). Typed colors stay unchanged: Motion `#8b5cf6`, Static `#06b6d4`, Reveal `#69BBC8`, selected `#f59e0b`, unresolved `#ff6b6b`. Exact gray token at Claude's discretion.
- Regenerate and Replay are unavailable with a clear "merged rail — multiple scripts cannot be regenerated/replayed" reason; the typed identity is not reconstructible from the remaining record.
- Normal key editing and cycle/repeat editing remain.

### Incoming type on a stack
- The stack dialog offers Motion / Static / Reveal for every destination (default seeded from the destination's current type, changeable).
- Motion/Static shows the Paint cards (Motion wiggle, Color, etc.); Reveal shows the Reveal cards (Colorize, Photo wiggle, Paint seed) and a reference notice.
- The dialog is a shell over `PhysicsPaintPlayScriptCards.tsx`; a new variant is a composition of the same cards.

### Reveal reference source (user decision)
- A Reveal incoming run on a non-Reveal or Standard destination uses the **document's placed photo reference** — the same document-level reference as Reveal creation.
- If none is placed, refuse with a clear reason and offer the existing "Place a reference…" path; zero writes.
- A Reveal destination uses its own placed reference (Quick B law).
- The render-only reveal tail path must accept both sources; no persisted change.

### Carried Quick A/B laws (do not revisit)
- Playhead membership only selects the destination; outside every rail is the unchanged create path.
- `runStart = phaseOrigin + cycleOffset`; extend-only; repeat unchanged; infinity lifecycle-less.
- Truncate caps growth but never shrinks an existing lifecycle; Overwrite removes the victim Loop Clip in the same commit with one undo.
- The open stack surface is pinned; confirm revalidates the live rail.
- Keep ON/OFF, the durable-base authority, no-doubling, and the no-plain-paper-on-reveal-frame law are unchanged.

### Scope / budget (split approved 2026-10-31)
- The user approved C1/C2. **This quick (261031-vbo) plans and ships C1 only**: Standard merge result + gray presentation + Motion/Static incoming type.
- **C2 is a follow-up quick, not planned here**: Reveal incoming on any destination + the document-reference routing/refusal.
- C1 estimate target ~55-60k; if the planner's estimate exceeds ~100k, STOP and report instead of improvising.

### Claude's Discretion
- Exact standard gray token and any CSS class naming.
- Exact refusal/regenerate/replay copy.
- Internal controller state for the incoming type (a new signal vs reusing `mode`).
- How the reveal tail port is generalized to the document reference.
- Card ordering/copy for the new incoming-type surface.
- Test harness details.

</decisions>

<specifics>
## Specific Ideas

- Current adoption site: `confirmStack` builds `updatedTarget` at `physicsPaintRotoPlayScriptController.ts:2512-2524` (`mode: renderMode`, `motion`, `overrideColor`, reveal knobs); the spread keeps `scriptId`.
- Regenerate requires provenance (`clip.scriptId` + `clip.motion`): `controller:1585-1616`.
- Rail presentation: `physicsPaintLoopClipPresentation.ts` — `modeLabel`, `groupTypeLabel`, `railKind`, `overrideColor`, `regenerateDisabledReason`, `freshnessLine`, `replayDisabledReason`.
- Rail classes/colors: `PhysicsPaintTrackRow.tsx:671` (`mode-${line.mode}`, `rail-kind-reveal`), CSS `physicsPaintStudio.css:4296-4375`.
- Loop Clip type/parser: `physicsPaintRotoPhysicalModel.ts:305-330` (provenance all-or-nothing; `railKind` allowlist).
- Dialog/cards: `PhysicsPaintPlayScriptDialog.tsx` stack composition ~298-400, `PhysicsPaintPlayScriptCards.tsx` RailTypeCard/MotionWiggleCard/ColorizeCard/PhotoWiggleCard/PaintSeedCard.
- Reveal reference: `hasPhotoReference`/`photoReferenceRevision` (Studio ~4032), `renderRevealTailFrames`/`physicPaintStore.ts` reference walk, `commitRevealBake`.
- The target's cached frames are preserved by the existing composite/union paths; the standard merge must not rewrite the rail's playback type.
- Tests that intentionally change: Quick A round-1 adoption pins, Quick B reveal-adoption pins, presentation/color/regenerate pins.

</specifics>

<canonical_refs>
## Canonical References

- `.planning/quick/261031-i54-run-script-stack-a-script-onto-an-existi/261031-i54-CONTEXT.md`
- `.planning/quick/261031-i54-run-script-stack-a-script-onto-an-existi/261031-i54-SUMMARY.md`
- `.planning/quick/261031-qps-task-quick-b-follow-up-to-quick-261031-i/261031-qps-CONTEXT.md`
- `.planning/quick/261031-qps-task-quick-b-follow-up-to-quick-261031-i/261031-qps-SUMMARY.md`
- `app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.ts`
- `app/src/components/physic-paint/roto/physicsPaintRotoRunScriptStacking.ts`
- `app/src/components/physic-paint/roto/physicsPaintRotoPhysicalModel.ts`
- `app/src/components/physic-paint/view/physicsPaintLoopClipPresentation.ts`
- `app/src/components/physic-paint/view/PhysicsPaintTrackRow.tsx`
- `app/src/components/physic-paint/view/PhysicsPaintPlayScriptDialog.tsx`
- `app/src/components/physic-paint/view/PhysicsPaintPlayScriptCards.tsx`
- `app/src/components/physic-paint/PhysicsPaintStudio.tsx`
- `app/src/stores/physicPaintStore.ts`
- `app/src/components/physic-paint/physicsPaintStudio.css`
- Project skills: `efx-preact-reactivity`, `developing-preact`

</canonical_refs>
