# Quick C (261031-vbo): Run Script merge result becomes a Standard Rail — Research

**Researched:** 2026-10-31
**Domain:** Physic Paint Roto — Loop Clip (rail) stacking, presentation, Preact signals
**Confidence:** HIGH

## Summary

QUICK C reverses the Quick A/B *stack-result adoption* law without touching their stacking, collision, lifecycle or atomic-undo laws. Three findings shape the plan:

1. **No persisted schema/format change is required.** Standard = an ordinary playscript Loop Clip with no provenance. The parser already accepts all-provenance-absent and `railKind`-absent records verbatim (`isPhysicPaintRotoLoopClip`, physicalModel:874-885), `mode` is the only required non-lifecycle field and stays, and the canonical fingerprint only joins `railKind`/provenance terms *when present* (physicalModel:1479-1544). **This is not a blocker.** If a stored sentinel ever looks unavoidable, stop and report per CONTEXT.
2. **The merge is one projection change.** `confirmStack` currently spreads `currentTarget` and then overwrites `mode`/`motion`/`overrideColor`/reveal knobs (controller:2512-2525). Standard result = replace that spread with an explicit whitelist and stop re-writing `mode` from the run.
3. **The reveal reference seam is already document-level.** `renderRevealTailFrames` reads `document.photoReference` (store:2187-2232) and `hasPhotoReference` reads the same document field (Studio:4342-4346). "The rail's own reference" and "the document's reference" are the *same* object — so Quick C needs **no new port and no store change**, only wider gating.

**Primary recommendation:** Do the merge once, at `controller:2512-2525`, as an explicit whitelist; add a `standard` presentation classification that wins *before* the "no scriptId → unavailable" branch; keep the incoming run type in one new dialog signal and render it through the existing cards. Split C1/C2 per the estimate below.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|--------------|----------------|-----------|
| Standard-result field projection | Roto controller (`confirmStack`) | — | Sole owner of the rail metadata write and the single atomic commit |
| Schema legality / round-trip | Physical model + store parser | Bridge comparator | Parser is the authority; nothing to add |
| Standard classification + labels/colors | View presentation (`physicsPaintLoopClipPresentation.ts`) | TrackRow / LoopClipRail CSS | Both rail hosts already consume one presentation object |
| Incoming-type surface | Controller signal + dialog composition | Card views | Cards stay dumb; composition is the dialog's job |
| Reveal render routing | Controller gate → Studio port → store | — | Document reference lives in the store |
| Per-key scripts / compositing | Existing bake ports | — | Untouched by Quick C |

## Standard Merge Mechanics (focus 1)

### The exact change site

`app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.ts:2512-2525` — current body [VERIFIED: app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.ts:2512-2525]:

```ts
const updatedTarget: PhysicPaintRotoLoopClip = {
  ...(isRevealTarget ? omitStoredRevealKnobs(currentTarget) : currentTarget),
  sourceKeyIds: Object.freeze([...mergedSourceKeyIds]),
  mode: renderMode,
  motion: compactPhysicPaintRotoMotion(motion),
  overrideColor: renderOverrideColor,
  ...(isRevealTarget && colorize.peek() ? { colorize: true as const, colorizeMix: colorizeMix.peek() } : {}),
  ...(isRevealTarget && photoWiggle.peek() ? { photoWiggle: true as const } : {}),
  ...(isRevealTarget && paintSeedVariation.peek() ? { paintSeedVariation: true as const } : {}),
  ...(lifecycle ?? {}),
};
```

Replace the `...currentTarget` spread with a whitelist (the spread is what carries `scriptId`):

```ts
const updatedTarget: PhysicPaintRotoLoopClip = {
  loopId: currentTarget.loopId,
  placementStart: currentTarget.placementStart,
  repeat: currentTarget.repeat,
  sourceKeyIds: Object.freeze([...mergedSourceKeyIds]),
  mode: currentTarget.mode,                                  // CONTEXT: keep the target's stored value
  ...(currentTarget.keyScriptEdits === true ? { keyScriptEdits: true as const } : {}),
  ...(currentTarget.paintSeedVariation === true ? { paintSeedVariation: true as const } : {}),
  ...(lifecycle ?? {}),
};
```

Dropped by omission: `scriptId`, `motion`, `overrideColor`, `railKind`, `colorize`, `colorizeMix`, `photoWiggle`. Dropping `railKind: 'reveal'` on a reveal destination is exactly the "no reveal identity" law and is schema-legal (physicalModel:874-877 quoted below). All six lifecycle members arrive via `...lifecycle` (controller:2504-2511), so a finite Standard rail still parses.

`omitStoredRevealKnobs` and the three conditional reveal-knob spreads become dead at this site — delete them rather than leaving them behind.

### Why this is schema-legal (no format change)

- `mode` is required and retained: `readonly mode: 'progressive' | 'static';` [VERIFIED: app/src/components/physic-paint/roto/physicsPaintRotoPhysicalModel.ts:310]
- `railKind` absent means playscript; all provenance absent is legal: [VERIFIED: app/src/components/physic-paint/roto/physicsPaintRotoPhysicalModel.ts:874-885]
  ```ts
  if (value.mode !== 'progressive' && value.mode !== 'static') return false;
  if (value.railKind !== undefined && value.railKind !== 'playscript' && value.railKind !== 'reveal') return false;
  const hasProvenance = value.scriptId !== undefined || value.motion !== undefined || value.overrideColor !== undefined;
  if (hasProvenance) {
  ```
  (all-or-nothing: absent-all passes untouched; no `else` branch requires them.)
- `colorize`/`colorizeMix` both-absent is legal: `if (hasColorize !== hasColorizeMix) return false;` [VERIFIED: physicalModel.ts:889-895] — absence of both skips the check.
- Fingerprint: `encodeCanonicalLoopClips` joins `railKind`/provenance only when present, lifecycle always [VERIFIED: physicalModel.ts:1479-1544] (read this session; the conditional terms are `clip.railKind === 'reveal' ? …` and `clip.scriptId !== undefined ? …`). ⇒ merged rail fingerprints cleanly; Rust mirror `script_library.rs:1431` is gated on `scriptId` and needs no change.

### Round-trip, ack, undo

- `sameLoopClipCollections` compares every optional field with nullish defaults (`clip.scriptId === candidate.scriptId` → `undefined === undefined`) [VERIFIED: controller:3799-3830]. Absent-forever round-trips.
- Store/bridge clone paths round-trip present members and leave absent absent (`cloneLoopClips` coordinator:681-730; `stableSerialize` bridge:1004-1020 key-sorted).
- Play-script delta validation does not diff loop clips against the current collection (bridge:1190-1228), so dropping fields cannot be rejected as a "removal".
- Undo restores the pre-commit collection wholesale ⇒ one undo restores the typed rail exactly. **Add a pin** asserting `scriptId`/`motion`/`overrideColor`/`railKind` return after undo.

### Required rename in `confirmStack`

`isRevealTarget` (controller:2396) currently means "destination is reveal". Under Quick C it must mean "**this run renders through the reveal tail**" = `incomingKind === 'reveal' || currentTarget.railKind === 'reveal'`. It gates: the reference refusal (2397-2409), `recordMode` (2425-2427), the CR-01 zero-anchor fail (`!isRevealTarget`, 2544), and the reveal bake branch (2547+). Rename it `revealRender` so the intent is unmistakable; the CR-01 fail only applies to a paint incoming run.

## Standard Rail Presentation (focus 2)

### Classification — insert *before* the unavailable branch

`resolveGroupLifecycle` maps no-`scriptId` to `'unavailable'` [VERIFIED: app/src/components/physic-paint/view/physicsPaintLoopClipPresentation.ts:296-308]:

```ts
  if (range.unresolved) return 'unresolved';
  if (clip?.provenanceState === 'detached') return 'detached';
  if (!clip?.scriptId) return 'unavailable';
  return clip?.syncState === 'modified' ? 'modified' : 'synchronized';
```

Add `'standard'` to `PhysicsPaintGroupLifecycle` (line 4-9) and test **before** the detached check (a merged rail inherits the destination's `provenanceState`, which must never surface as "Script detached"):

```ts
if (range.unresolved) return 'unresolved';
if ((clip?.railKind ?? 'playscript') !== 'reveal' && !clip?.scriptId) return 'standard';
if (clip?.provenanceState === 'detached') return 'detached';
```

Consequence to flag: legacy pre-43-06 rails (no `scriptId`) now classify Standard instead of `unavailable` — a *correct* relabelling, but it changes the `'no source action'` pin (see tests).

New copy (Claude's discretion, aligned to CONTEXT):

| Field | Standard value |
|---|---|
| `statusLabel` | `'Merged rail — multiple scripts.'` |
| `synchronizationDot` | `null` |
| `regenerateDisabledReason` | `'Regenerate unavailable — this rail merges multiple scripts.'` |
| `replayDisabledReason` | `'Replay unavailable — this rail merges multiple scripts.'` |
| `freshnessLine` | `null` |

`statusLabelFor` (310-318) and `regenerateDisabledReasonFor` (320-328) are exhaustive switches — adding the member forces both, which is the safety net you want.

### Labels and the view `railKind`

Today `modeLabel`/`groupTypeLabel` derive purely from `mode` [VERIFIED: presentation.ts:130-132]:

```ts
const mode = clip?.mode ?? 'progressive';
const modeLabel = mode === 'static' ? 'Static' : 'Motion';
const groupTypeLabel = `${modeLabel} Rail` as const;
```

Widen the view types (view-only; persisted `PhysicPaintRotoLoopClip['railKind']` stays `'playscript' | 'reveal'`):
- `modeLabel: 'Motion' | 'Static' | 'Standard'`; `groupTypeLabel: 'Motion Rail' | 'Static Rail' | 'Standard Rail'`.
- `presentation.railKind`: derive `standard ? 'standard' : (clip?.railKind ?? 'playscript')` and extend the **view** `RotoRailKind` in `physicsPaintWorkflowPresentation.ts:24` (`'playscript' | 'reveal'`) with `'standard'`, plus `getRotoRailKindLabel` (:37) → `'Standard Rail'`. This is what feeds the TrackRow aria label.
- Tooltip `Type: ${modeLabel}` then reads `Type: Standard`; `displayName` fallback becomes `Standard Rail at F{n}`.

### Colors

Existing rail palette [VERIFIED: app/src/components/physic-paint/physicsPaintStudio.css:4296-4375]: base `#8b5cf6` (4301), `.mode-static` `#06b6d4` (4306), hover `#c4b5fd`/`#67e8f9` (4311/4316), `.selected` `#f59e0b` (4320), `.unresolved` `#ff6b6b` (4324), reveal family `var(--rail-color, #69BBC8)` + hover `#8FCFD9` (4342-4356), shared selected/unresolved restated for reveal (4360/4364).

Proposal (Claude's discretion): `STANDARD_RAIL_COLOR = '#9CA3AF'`, `STANDARD_RAIL_HOVER_COLOR = '#D1D5DB'`. Add `.rail-kind-standard` rules *after* the reveal block, winning by specificity over `.mode-*` — mirror the reveal pattern exactly (two mode variants each, because the retained `mode` still emits `mode-progressive`/`mode-static`):

```css
.physics-paint-loop-clip-rail-target.rail-kind-standard.mode-progressive .physics-paint-loop-clip-rail-segment,
.physics-paint-loop-clip-rail-target.rail-kind-standard.mode-static .physics-paint-loop-clip-rail-segment { background: #9CA3AF; }
/* + hover (#D1D5DB) and action-linked variants; selected/unresolved stay shared */
```

Class emission sites: `PhysicsPaintTrackRow.tsx:671` and `PhysicsPaintLoopClipRail.tsx:338`. Both already interpolate `rail-kind-reveal` conditionally; add `${presentation.railKind === 'standard' ? ' rail-kind-standard' : ''}` (TrackRow uses `line.railKind`; extend `TrackRowLoopLine`'s union at :211-225). Keep `mode-${...}` on the element — the presentation *label* hides the type; the CSS class is internal.

### Regenerate / Replay gating

- Row menu: `groupRegenerateReason` must return the merged copy before its `!group.scriptId` branch (controller:1581-1606; the offending line is 1585 `if (group.provenanceState !== 'attached' || !group.scriptId) return 'Regenerate unavailable — Script detached.';` — note it would say "detached" for a Standard rail, so add the standard check above it).
- `openGroupRegenerate` already fails closed on `!group.scriptId || !group.motion` (controller:1616) — no change needed.
- Dialog footer's Regenerate button is gated on `regenerateDisabledReason` (PhysicsPaintPlayScriptDialog:431) — picks up the new copy automatically.
- Replay: `replayDisabledReasonFor` (presentation:338-352) — return the merged copy when lifecycle is `standard`.

## Incoming-Type Surface (focus 3)

### Current derivation

[VERIFIED: controller:1408-1447 and view/PhysicsPaintPlayScriptDialog.tsx:58-72]

```ts
mode.value = destination.rail.mode;                       // controller:1417
overrideEnabled.value = destination.rail.overrideColor !== null;  // 1421
if (destination.rail.railKind === 'reveal') { … }          // 1427-1432
if (railTab.peek() !== 'paint') railTab.value = 'paint';   // 1436
```
```ts
const stacking = !loopEdit && !sourceEdit && playScript.runDestination.value.kind === 'stack';  // dialog:62
const stackReveal = stacking && playScript.stackRailKind.value === 'reveal';                    // dialog:68
```

`stackRailKind` is the **destination's** kind (controller:1089-1092) — under Quick C it stays (it decides the rail's own reference and the D-16 notice), but it must **stop** choosing the card set.

### Minimal new state

Add one signal in the controller:

```ts
type StackIncomingKind = 'motion' | 'static' | 'reveal';
const stackIncomingKind = signal<StackIncomingKind>('motion');
```

Seed at stack open (controller:1408 block), compare-then-write only while the dialog is open, keyed the same way `seedKeepScript` is (controller:1121-1139): `destination.rail.railKind === 'reveal' ? 'reveal' : destination.rail.mode`. Keep the existing `mode` signal as the Motion/Static sub-choice (RailTypeCard already binds it); `stackIncomingKind` is `'reveal'` when the Reveal option is picked. Expose derived: `stackIncomingReveal = stackIncomingKind === 'reveal'`.

Bake routing: `renderMode = stackIncomingKind === 'reveal' ? currentTarget.mode : mode.peek()` — a reveal run has no Rail Type card today (dialog:304-312 hides it for `stackReveal`), so it bakes with the destination's mode. Paint incoming keeps today's `mode.peek()`. The **merged rail's** `mode` is always `currentTarget.mode` (whitelist above), so the run-type never converts the rail.

Avoid per-playhead-tick reads: seed from `pinnedStackDestination` / the open-time destination only (the `seedKeepScript` comment at controller:1122-1129 documents the exact trap that made playback sluggish).

### Dialog composition

Keep the shell; the switch is `stackIncomingReveal` where `stackReveal` sits today:
- RailTypeCard (`PhysicsPaintPlayScriptCards.tsx:135-161`): show for incoming Motion/Static; **hide** for incoming Reveal (the three-way choice needs its own surface — a new `IncomingTypeCard` composing the same `DialogRadioGroup` with `Motion / Static / Reveal`; recommended over overloading `PLAY_SCRIPT_MODES` at :19-22, since `mode` is `RotoPlayScriptMode`, not a kind).
- Incoming Reveal ⇒ Colorize (`:285`), PhotoWiggle (`:315`), PaintSeed (`:332`) + reference notice (dialog:356-369 / 393-403 pattern). Incoming Motion/Static ⇒ Color (`:163`), MotionWiggle (`:213`), PaintSeed when appropriate.
- Update the stacking helper at Cards:154-158: `"This run updates the rail's Rail Type, Motion wiggle and Color."` is now false — replace with the Standard-result copy.
- Honour the **D-16 direct-children constraint** documented at dialog:373-377 — no wrapping Fragment around the stack's cards; the grid pins read rendered children in order.

### Reveal reference (the key simplification)

The reference seam is *already* document-level [VERIFIED: app/src/stores/physicPaintStore.ts:2187-2204]:

```ts
export async function renderRevealTailFrames(input: RevealTailRenderInput): Promise<RevealTailRenderResult> {
  const document = getEfxPaintDocument(input.layerId);
  if (!document) return { ok: false, error: 'no efx paint document' };
  const track = document.photoReference;
  if (track === null) return { ok: false, error: 'no photo reference' };
```
…then `_resolveReferenceSourceImage(document, appFrame)` per frame with `'missing reference source'` fail-closed (2203-2205).

And the guard [VERIFIED: PhysicsPaintStudio.tsx:4342-4346]:
```ts
hasPhotoReference: () => {
  const document = launchContext ? getEfxPaintDocument(launchContext.layerId) : undefined;
  const reference = document?.photoReference;
  return Boolean(reference && reference.sourceFrameRefs.length > 0);
},
```

⇒ **No store, port or render change.** The plan only widens `revealRender` (see above) so a Reveal incoming run on **any** destination routes through `bakeRevealStackTail` (Studio:4154-4173, which already takes `colorize`/`photoWiggle` from the run) and uses the existing refusal string at controller:2401 (`'This Reveal rail has no photo reference. Place a reference, then run again. Nothing changed.'` → reword to `'This run needs a placed photo reference. Place one, then run again. Nothing changed.'` since the rail is no longer necessarily Reveal). The "Place a reference…" path is `playScript.requestPhotoReference()` (dialog:364).

## Merge Compositing and Per-Key Scripts (focus 4)

Untouched by Quick C — verify, don't rebuild:

- Keep 2x2 / `recordMode`: controller:2411-2427. `keyScriptEdits` is **read, never written** (`const flagOn = currentTarget.keyScriptEdits === true;`, 2420) and survives via the whitelist.
- Union re-bake (`bakeStackedRailKey`), pixel composite (`composeStackedRailKey`, 2600-2616), reveal tail (2547+) all key off `currentTarget`'s pixels — none read `scriptId`/`motion`/`overrideColor`. The target's cached frames are preserved by construction.
- `sliceRailKeyScripts({ anchors, frames, mode: renderMode })` (2537) keeps per-key editing meaningful; `recordRailKeyScripts` (2632-2640) must still run for a Standard result.
- `mode` still governs generated interiors downstream: `clip.mode === 'static' || !input.interpolationEnabled ? 'hold' : 'generate'` [VERIFIED: app/src/components/physic-paint/roto/physicsPaintRotoPhysicalResolver.ts:5623]. Retaining the destination's `mode` therefore preserves playback behaviour — intended, and never presented.

## Tests That Intentionally Change

| File:line | Pin today | Quick C expectation |
|---|---|---|
| `roto/physicsPaintRotoPlayScriptController.test.ts:4901` | Quick B reveal adopt (knobs + railKind) | Standard result: knobs gone, `scriptId` gone |
| `…Controller.test.ts:5027` | Keep OFF on Reveal records nothing | same, plus Standard result |
| `…Controller.test.ts:5109` | never stacks reveal without tail port | copy updated; gating now keyed on incoming kind |
| `…Controller.test.ts:5369` | Quick A seeds/bakes/adopts `mode`/`motion`/color | rail keeps `mode`, drops `motion`/`overrideColor`/`scriptId` |
| `view/physicsPaintLoopClipPresentation.test.ts:129-136` | `'no source action'` → `unavailable` / `'Source Script unavailable.'` / dot `unavailable` | `standard` / `'Merged rail — multiple scripts.'` / dot `null` / merged regenerate copy |
| `view/PhysicsPaintTrackRow.test.tsx:236-252` | mode classes | unchanged; add a `rail-kind-standard` pin |
| `view/PhysicsPaintLoopClipRail.test.tsx:555-556,1280-1293,1689-1699` | typed rails' classes + colors | unchanged (typed rails untouched); add standard color pin |
| `view/physicsPaintWorkflowPresentation.test.ts:761-763` | rail-kind labels | extend with `'Standard Rail'` |

## Preact / Signals Traps (project rules)

- Compare-then-write every new seed (rule 3) — the `seedKeepScript` block (controller:1121-1139) is the template; it also documents why the effect must read the destination **only while the dialog is open**.
- Do not read the live `runDestination` inside a render body or an always-on effect (one subscription per playhead tick).
- Derive `stackIncomingReveal` with `computed`, not a render-body expression over a mutable signal.
- Dialog-gated seeding only: seed `stackIncomingKind` inside the stack open block, not an effect watching rails.

## Gates

```bash
pnpm --filter efx-motion-editor exec vitest run <paths>   # never watch
pnpm --filter efx-motion-editor run typecheck
pnpm vitest run                                            # full gate
```
Baseline to hold: **363 files (361 passed, 2 skipped), 6,783 passed, 1 skipped, 96 todo, 0 failed** [CITED: .planning/quick/261031-qps-…/261031-qps-SUMMARY.md:265].

## Token Estimate and C1/C2 Split

| Part | Scope | Estimate |
|---|---|---|
| Merge whitelist + `revealRender` rename + gating | controller ~120 lines | ~15k |
| Standard presentation (lifecycle member, labels, copy, gray CSS) | presentation + 2 view files + CSS ~150 lines | ~18k |
| Incoming-type signal + dialog composition + card copy | controller + dialog + cards ~180 lines | ~22k |
| Test pins + new pins (merge, undo, presentation, color) | ~350 lines | ~25k |
| Reveal incoming on any destination + refusal copy + routing tests | ~150 lines | ~20k |
| **Full scope** | | **~100k — at the ceiling** |

**Recommendation: pre-authorize C1/C2 as CONTEXT allows.**
- **C1 (~55-60k):** Standard result + gray presentation + Motion/Static incoming (all rows above except the last).
- **C2 (~20-25k):** Reveal incoming on any destination + document-reference routing + refusal.

## Sources

### Primary (HIGH confidence)
- `app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.ts` — 1089-1092, 1121-1139, 1408-1447, 1581-1616, 2392-2451, 2512-2545, 2600-2665, 3799-3830
- `app/src/components/physic-paint/roto/physicsPaintRotoPhysicalModel.ts` — 305-360, 861-903, 1479-1544
- `app/src/components/physic-paint/view/physicsPaintLoopClipPresentation.ts` — 1-104, 111-233, 296-352
- `app/src/components/physic-paint/view/PhysicsPaintTrackRow.tsx:211-225,671`; `view/PhysicsPaintLoopClipRail.tsx:338`
- `app/src/components/physic-paint/view/PhysicsPaintPlayScriptDialog.tsx:50-83,290-406,417-471`
- `app/src/components/physic-paint/view/PhysicsPaintPlayScriptCards.tsx:19-27,135-161`
- `app/src/components/physic-paint/physicsPaintStudio.css:4296-4375`
- `app/src/components/physic-paint/PhysicsPaintStudio.tsx:4154-4173,4342-4346`
- `app/src/stores/physicPaintStore.ts:2187-2232`
- `app/src/components/physic-paint/roto/physicsPaintRotoRunScriptStacking.ts:176-265`
- `app/src/components/physic-paint/view/physicsPaintWorkflowPresentation.ts:24,37`

### Secondary (MEDIUM confidence)
- `.planning/quick/261031-qps-…/261031-qps-SUMMARY.md:265` (baseline counts)

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Gray token `#9CA3AF` / hover `#D1D5DB` suits the existing palette | Presentation | Cosmetic; user may pick another token |
| A2 | A separate `IncomingTypeCard` is better than overloading `RailTypeCard` | Incoming-type | More files touched in C1 |
| A3 | Legacy rails without `scriptId` should relabel as Standard | Presentation | One pin change or a guard for pre-43-06 records |

## Open Questions

1. **Should the merged rail keep `syncState`/`provenanceState`?** **RESOLVED:** they ride `...lifecycle` and are parser-required for finite groups, so the whitelist preserves them (the target's lifecycle is the fallback when the plan is null); classification ignores them. No action.
2. **Incoming Reveal on a Motion/Static destination: what `mode` bakes?** **RESOLVED (C2):** incoming Reveal on any destination is C2 and is not implemented in C1; C1 keeps the existing Reveal-destination path and Motion/Static incoming only.
