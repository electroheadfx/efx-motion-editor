# Quick Task 261123-pee: Hold paint wet until Dry — no auto-dry, wet one-frame Re-render/Apply - Context

**Gathered:** 2026-11-23
**Status:** Ready for planning

<domain>
## Task Boundary

Implement "no drying until Dry" as the DEFAULT live Studio behavior, plus wet replay for the one-frame Re-render and Apply tools. Milestone v2.2.0 (Brush Tips & Medium Engine).

LOCKED ARTIST BEHAVIOR
- No user-facing toggle. The live Studio sheet never auto-dries.
- Retire the settle cap from the live sheet (AquarelleCanvasLayer.tsx:1195-1200) and never decay wetness or fix mobile->fixed while the artist works.
- Watercolor keeps blending with acrylic indefinitely until Dry.
- Dry (F, top bar): same trigger, one recorded/undoable step. It dries everything AND clears the last-touch field so acrylic pickup reads dry immediately (today fix() does not; Engine.ts:2014-2026 vs clear() 2053-2055). The last-touch layer must be covered by the same undo step.
- Leaving a still-wet key: force the normal fix first, then capture. The committed image and the bake stay the settled/dry look; the wet state is never committed.
- Capture moments: explicit Dry and key leave (AquarelleCanvasLayer.tsx:1157-1166, 1202-1219). Skip the settle capture of a wet sheet; any flush/save path that commits the live sheet uses the same dry-first rule.

WET REPLAY (only these two tools)
- Re-render (Shift+R, handleRebakeScript, PhysicsPaintStudio.tsx:6261-6291) and Apply one frame (handleApplyScript:2651-2667 -> applyScript) MUST end wet.
- Everything else on the shared Apply path stays DRY: undo/redo (runAquarelleScriptReplay / ports.rebake at 6228, 9022, 10844), script edits (9318-9943), lift-erase base-recovery bakes (8208, 8550), and PlayScript's multi-frame settle.
- Add settle: 'dry' | 'wet' (default 'dry') to bakeAquarelleEventsToFrame (physicsPaintRotoPlayScriptController.ts:4244+), forwarded through applyAquarelleEventsToKey (:4350-4385) and the dispatch path. In 'wet': skip applySettle (aquarelleBake.ts:886-903), keep the same timeline cook window, export the sheet with mobile pigment, and ignore recorded Dry events during the replay.
- Pass the hold flag into the bake's engine adapter (same seam as light/paper, createDefaultAquarelleAdapter :4388-4405) so the replay does not dry between strokes. Without it only the tail strokes stay wet.
- The adopted sheet must blend on the next stroke AND read wet to the Water gate (isSheetWet). SheetSnapshot carries wet pixels and last-touch ages but not wetPeak/lastWet (Engine.ts:1109-1111, 1123-1133) - align the summary.

ENGINE SEAMS
- Engine.ts:3842-3850 (dryTau/wetDecay/wetUntil), engine/drying.ts (fixDrying), awake checks Engine.ts:1226/1538/4173, wetState.ts.
- Live sheet: skip wetness decay and mobile->fixed, keep transport. The sim may still sleep after its normal activity window; the wetness must remain in the sheet and re-engage on the next stroke. No infinite wake loop.
- No new recorded event type. If parity requires recording the mode, STOP and report instead of inventing a script event.

NON-GOALS / GUARDRAILS
- Do not touch PlayScript's per-frame dry settle.
- Do not make base-recovery comparison bakes wet.
- Never replay strokes into the live engine (KEY = CACHE); adoption goes through restoreSheet/adoptSheet only.
- No medium-record changes (no new 0..100 row; Body/emboss untouched).
- No new UI control for this feature. Preact signals only if a UI seam is touched (read Skill("efx-preact-reactivity")).
- Do not run the dev server; vitest run only, never watch; never push. Change ONE law, prove it in the probe, then the next.

VERIFICATION
- Gates: pnpm --dir packages/efx-watercolor exec vitest run; pnpm --dir app exec vitest run; pnpm --dir app exec tsc --noEmit.
- Probe (packages/efx-watercolor/probe/): paint watercolor then acrylic; assert the wet layer/mobile pigment survives a long idle and the next acrylic stroke still picks up; bake the same script with settle 'wet' and 'dry' and assert the wet sheet keeps mobile pigment while the dry sheet does not.
- Source pins: fix() clears last-touch; the live sheet has no settle cap; settle defaults to dry; only the two tool call sites pass wet; undo/redo, script edits and recovery call sites pass dry.
- Live UAT rows (exact surface named):
  1. Watercolor, switch to acrylic, pause >10 s, paint: still blends/picks up (no auto-dry).
  2. Shift+R re-render: the frame is wet and blendable again.
  3. Apply one frame: applied paint is wet and blendable.
  4. Dry (F): everything dries; acrylic afterwards paints on dry; one undo restores the wet state; the result keeps the dense settled look (not the washed-out full settle).
  5. PlayScript: unchanged, still settles/dries per frame.
  6. Leave a wet key: commits the dry look; returning shows the dry committed image (as today).
- Report automated-ready first; do not claim done before live UAT.

</domain>

<decisions>
## Implementation Decisions

### Live hold seam
- Engine-level `holdWet` flag (constructor/option), one source of truth.
- While held: `fixDrying`/settle and mobile->fixed are no-ops; transport and awake behavior unchanged.
- The hold suppresses AUTOMATIC drying ONLY. Explicit Dry (`fix(false)`) and dry-on-leave override it and LIFT the hold.
- The wet bake reuses the same hold flag in its engine adapter.

### isSheetWet summary
- Extend `SheetSnapshot` to carry `wetPeak` and `lastWet` alongside the existing wet pixels/last-touch ages.
- Carry `lastWet` as a wetAgo age (same clock-age convention as the other sheet age fields).
- `isSheetWet` reads the real fields, and stays OPEN (wet) while the sheet is held wet.

### Dry undo scope
- Dry captures the sheet BEFORE `fix()`.
- One undo restores that exact pre-dry sheet: mobile pigment, last-touch ages, wetPeak.
- Redo must land the post-dry state WITHOUT re-running `fix()`.

### Claude's Discretion
- Probe placement and scene layout under `packages/efx-watercolor/probe/`.
- Exact option names/types for the hold flag and settle mode.
- Where the dry-first rule is enforced for flush/save paths.
- Remaining wiring details, within the source-pin and guardrail constraints.

</decisions>

<specifics>
## Specific Ideas

- The user's source references (file:line) are the starting map; verify each against the live tree during research/planning, line numbers may have drifted.
- Load `Skill("efx-studio-paint")` before touching the paint laws; the compositing/parity laws are mandatory context.
- KEY = CACHE: adoption goes through `restoreSheet`/`adoptSheet` only; never replay strokes into the live engine.
- No new recorded event type. If parity requires recording the wet mode, STOP and report instead of inventing a script event.

</specifics>

<canonical_refs>
## Canonical References

- `Skill("efx-studio-paint")` — compositing laws, live/committed parity, sheet cache clocks, debugging discipline.
- `Skill("spike-findings-efx-motion-editor")` — measured spike laws and probe harness patterns.
- `.planning/STATE.md` — project state.
- `.planning/PROJECT.md` — project context.

</canonical_refs>
