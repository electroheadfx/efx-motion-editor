# Quick Task 261101-1pc: Quick C2 — Reveal incoming on any destination — Research

**Researched:** 2026-11-01
**Code baseline:** `dev` @ `7c36385b2` (working tree clean apart from this task folder)
**Domain:** Physic Paint Roto — Run Script stacking, Reveal bake, stack dialog, presentation
**Confidence:** HIGH (all findings read from source this session; no external libraries involved)

## Summary

C1 (`261031-vbo`, closed on UAT 2026-11-01) shipped ONE Standard Rail for Motion/Static incoming runs on every destination. It left two structural gaps C2 must close: the stack dialog's incoming "Rail Type" is still the two-value `RotoPlayScriptMode` (`progressive | static`), and `confirmStack`'s picture path is split on **destination** kind (`isRevealTarget`), never on **run** kind. A Reveal incoming run therefore has no representation today: the dialog cannot select it, the confirm does not render it, and the reveal-render seam (`renderRevealTailFrames`) is reachable only through `bakeRevealStackTail`, whose two inner paths are both destination-reveal-shaped.

The document's placed photo reference is already the one data source every reveal path reads. There is no per-rail reference field anywhere in the Loop Clip schema, so Quick B's "rail's own placed photo reference" resolves to `document.photoReference` — the same object `hasPhotoReference` (Studio) and `renderRevealTailFrames` (store) read. C2's refusal predicate and "Place a reference…" action can reuse those two existing ports unchanged.

**Primary recommendation (factual, not a plan):** treat "incoming Reveal" as a run-level axis separate from the destination's `railKind`, render the run through the existing render-only reveal seam to obtain straight-alpha sheets, then reuse C1's existing sheet-over-current-picture composite (`bakeStackedRailKey` / `composeStackedRailKey`) so the destination's baked animation survives. Do not reuse `bakeRevealStackTail`'s slow path for a non-reveal destination: it unions the destination's recorded events, which is precisely the UAT bug C1's `28411564c` removed.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- The Reveal incoming run renders against the **document's placed photo reference**.
- When no document photo reference is placed, the stack **refuses with a clear reason**, performs **zero writes**, and offers the existing **"Place a reference…"** entry point.
- The refusal must be visible before commit (dialog) and re-validated at confirm time; a refusal never stages pins, records scripts, or commits.
- Every destination + Reveal incoming run = **ONE Standard Rail**, exactly like C1's Motion/Static merge (whitelist projection; `scriptId`/`motion`/`overrideColor`/`railKind`/`colorize`/`colorizeMix`/`photoWiggle` absent; stored `mode` internal only).
- The Reveal run's own settings (mode/motion, colorize, photo wiggle, paint seed) shape **only that run's bake**, never the stored rail.
- Each touched key's published bytes = the destination key's **CURRENT cached picture** with the **run's own baked sheet** composited over it (C1 post-UAT law). Keep ON appends the run's slices and stages pre-run base pins; Keep OFF records nothing and never purges the destination.
- Incoming Rail Type gains **Reveal** for a stack.
- Selecting Reveal shows the Reveal cards and the read-only reference row (reuse the existing cards module; no fork of the dialog shell).
- The "result is one Standard Rail" helper stays accurate for every incoming type.
- **No persisted schema/format change.**
- Quick A/B collision, extend-only, repeat-unchanged, Keep, and atomic-undo laws still hold.

### Claude's Discretion
- Exact refusal copy wording (must name the missing document reference and point at "Place a reference…").
- Whether a Reveal incoming run on a Reveal destination also uses the document reference (C1 drops the destination's reveal identity, so the run should be self-contained): default decision — **yes, the document's placed reference is the reference for the incoming run on every destination**, for one consistent law.
- How the dialog surfaces the reference (read-only preview row vs. status line), matching Quick B's reveal reference presentation where possible.
- Whether Reveal-incoming lifecycle growth inherits C1's run-plan lifecycle exactly (extend-only, repeat unchanged): default — **yes, unchanged**.

### Deferred Ideas (OUT OF SCOPE)
- Changing C1's Motion/Static merge law; Load+Apply; Save/Delete script; the script library format; any new persisted field.
</user_constraints>

## 1. Reveal creation, Reveal tail bake, and the per-frame renderer

Three distinct paths exist. Only (b) is render-only; (a) writes keys.

### (a) Reveal rail creation IS the first bake (writes key records)

- `createRevealRail` guards before any bake: `if (document.photoReference === null) return { ok: false, reason: 'no-photo-reference' };` `[VERIFIED: app/src/stores/efxPaintStore.ts:1565]`. It then calls `commitRevealBake({...})` (lines 1594-1611) and builds the `railKind: 'reveal'` Loop Clip with full lifecycle `[VERIFIED: app/src/stores/efxPaintStore.ts:1524-1704]`.
- `commitRevealBake` walks the whole span frame-aligned and fails closed **before rendering**: `if (verdict === null) return { ok: false, error: 'missing reference source' };` `[VERIFIED: app/src/stores/physicPaintStore.ts:2056-2062]`. It renders at the **working** size with `const referenceZoom = size.width / projectSize.width;` and passes `reference: { bytesByAppFrame, transform: track.transform, zoom: referenceZoom }` `[VERIFIED: app/src/stores/physicPaintStore.ts:2046-2048,2066-2082]`.
- The Studio supplies `projectSize` from carried launch dims because the child realm's projectStore is not hydrated: `// The Studio child has no hydrated projectStore — carry the launch dims` `[VERIFIED: app/src/components/physic-paint/PhysicsPaintStudio.tsx:4351-4352]`.

### (b) Quick B's render-only tail bake (writes nothing)

- Store seam `renderRevealTailFrames` reads the document reference itself: `const track = document.photoReference; if (track === null) return { ok: false, error: 'no photo reference' };` and rejects a missing frame's bytes with `'missing reference source'` `[VERIFIED: app/src/stores/physicPaintStore.ts:2187-2206]`. It writes no key records and no interpolation break (header contract, lines 2179-2185).
- Studio wrapper `renderRevealTail` builds a synthetic `RotoPaintScript` with `provenance.sessionId: reveal-tail-${canonicalStart}` and calls `renderRevealTailFrames` with carried `projectSize: { width: launch.width ?? ..., height: launch.height ?? ... }` and `aquarellePaper` `[VERIFIED: app/src/components/physic-paint/PhysicsPaintStudio.tsx:3964-4014]`.
- Port `bakeRevealStackTail` wraps it for the controller `[VERIFIED: app/src/components/physic-paint/PhysicsPaintStudio.tsx:4155-4242]`. Its two paths are keyed on the **destination**, not the run:
  - fast path when no touched destination key owns recorded strokes: `const ownsRecordedStrokes = input.slices.some((slice) => hasAquarelleScriptForFrame(slice.frame)); if (!ownsRecordedStrokes) { ... renderRevealTail(...) }` `[VERIFIED: app/src/components/physic-paint/PhysicsPaintStudio.tsx:4181-4195]`;
  - slow path unions the **destination's recorded events** with the run's slice: `events: [...getAquarelleEventsForFrame(slice.frame), ...slice.strokes.map((stroke) => toStudioStroke(stroke))]` `[VERIFIED: app/src/components/physic-paint/PhysicsPaintStudio.tsx:4214-4219]`.
- The slow path is the same "replay destination events" shape C1's post-UAT fix removed for non-reveal destinations: `The destination's recorded events are never replayed — a motion rail's animation lives in its pixels, not in untransformed strokes` `[VERIFIED: app/src/components/physic-paint/PhysicsPaintStudio.tsx:4084-4087]`. Using `bakeRevealStackTail` unchanged for a Motion/Static destination would contradict the C1 law whenever the destination has recorded scripts.

### (c) The per-frame reveal renderer is reusable for an incoming run

- `renderRotoRevealFrames` produces `straight-alpha keys that carry reference pixels where the script coverage is and transparency elsewhere (D-17, RVL-02 generation-time). The reference is drawn AS PLACED at FULL source opacity (D-18)` `[VERIFIED: app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptRenderer.ts:93-100]`.
- It refuses a script with no wash timeline: `if (aquarelleEvents === undefined || aquarelleEvents.length === 0) throw new Error('Reveal needs a Water color script — this script has no recorded wash timeline.');` `[VERIFIED: app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptRenderer.ts:108-111]`.
- Reference input shape: `reference: Readonly<{ bytesByAppFrame: ReadonlyMap<number, Uint8Array>; transform: ...; zoom: number; }>` `[VERIFIED: app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptRenderer.ts:74-79]`.
- Straight-alpha output is compatible with C1's composite: the composite stores `t' = a*C + (1-a)*t_base` `[VERIFIED: app/src/components/physic-paint/roto/physicsPaintRotoScriptRebake.ts:14-23]`, so transparent sheet pixels leave the destination picture and covered pixels paint the reference.

## 2. "The document's placed photo reference"

- Document field: `readonly photoReference: PhotoReferenceTrack | null;` `[VERIFIED: app/src/efx-paint/document/efxPaintDocument.ts:245]`.
- Track shape: `id`, `sourceFrameRefs: readonly string[]`, `revision`, `visibleInStudio`, `opacity`, `transform`, `transformLocked` `[VERIFIED: app/src/efx-paint/document/efxPaintDocument.ts:162-170]`.
- "Placed" predicate used today: `const reference = document?.photoReference; return Boolean(reference && reference.sourceFrameRefs.length > 0);` `[VERIFIED: app/src/components/physic-paint/PhysicsPaintStudio.tsx:4343-4347]`.
- Bytes are a runtime registry, not document data: `const _referenceSourceImages = new Map<string, Uint8Array>();` `[VERIFIED: app/src/stores/physicPaintStore.ts:690]`; resolution is frame-aligned and fail-closed: `if (track === null || track.sourceFrameRefs.length === 0) return null; ... const bytes = _referenceSourceImages.get(ref); if (bytes === undefined) return null;` `[VERIFIED: app/src/stores/physicPaintStore.ts:1965-1973]`.
- There is **no per-rail reference field**. `PhysicPaintRotoLoopClip` carries `railKind?: 'playscript' | 'reveal'` and the reveal knobs, nothing photo-related `[VERIFIED: app/src/components/physic-paint/roto/physicsPaintRotoPhysicalModel.ts:305-360]`. Therefore Quick B's "rail's own placed photo reference" (dialog copy at `PhysicsPaintPlayScriptDialog.tsx:407`) is the **document-level** reference; the two lookups are the same data source.
- Predicate nuance: `hasPhotoReference` only checks that `sourceFrameRefs` is non-empty; a registered source may still be missing bytes, in which case the render seam refuses with `'missing reference source'` `[VERIFIED: app/src/stores/physicPaintStore.ts:2203-2205]`.
- Existing refusal primitive: `const revealReferencePlaced = computed(() => { ports.photoReferenceRevision?.value; return ports.hasPhotoReference?.() ?? false; });` `[VERIFIED: app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.ts:697-700]` — it subscribes to the document revision so it re-resolves live.

## 3. Stack dialog incoming Rail Type

- `const stacking = !loopEdit && !sourceEdit && playScript.runDestination.value.kind === 'stack';` `[VERIFIED: app/src/components/physic-paint/view/PhysicsPaintPlayScriptDialog.tsx:70]`; `const stackReveal = stacking && playScript.stackRailKind.value === 'reveal';` `[VERIFIED: .../PhysicsPaintPlayScriptDialog.tsx:76]`; `const tabsVisible = ... && !stacking;` and `const revealTab = playScript.railTab.value === 'reveal' && ... && !stacking;` `[VERIFIED: .../PhysicsPaintPlayScriptDialog.tsx:79-80]`.
- `stackRailKind` is the pinned destination's kind: `return destination.kind === 'stack' ? destination.rail.railKind : null;` `[VERIFIED: app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.ts:1110-1113]`.
- Rail Type options are a two-value union today:
  - `const PLAY_SCRIPT_MODES = [{ value: 'progressive', label: 'Motion' }, { value: 'static', label: 'Static' }];` `[VERIFIED: app/src/components/physic-paint/view/PhysicsPaintPlayScriptCards.tsx:19-22]`
  - `const options = props.revealTab ? REVEAL_RAIL_TYPES : PLAY_SCRIPT_MODES;` and the radio writes `props.playScript.mode.value = value;` `[VERIFIED: .../PhysicsPaintPlayScriptCards.tsx:145,158]`
  - `export type RotoPlayScriptMode = 'progressive' | 'static';` `[VERIFIED: app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.ts:70]`
- The Rail Type card is **hidden** entirely for a reveal destination: `{stackReveal ? null : (<RailTypeCard ... standard={standardEditTarget} />)}` `[VERIFIED: app/src/components/physic-paint/view/PhysicsPaintPlayScriptDialog.tsx:312-321]`.
- Reveal destination composition (Quick B): side stack renders `ColorizeCard` instead of `ColorCard`, no `MotionWiggleCard` `[VERIFIED: .../PhysicsPaintPlayScriptDialog.tsx:382-401]`; then a read-only notice with two exact copies, **no** "Place a reference…" action `[VERIFIED: .../PhysicsPaintPlayScriptDialog.tsx:402-409]`.
- Card visibility rules on a stack: `PaintTimingCard` for every non-reveal-tab stack `[VERIFIED: .../PhysicsPaintPlayScriptDialog.tsx:329-341]`; `KeepScriptCard` when `keepScriptVisible` `[VERIFIED: .../PhysicsPaintPlayScriptDialog.tsx:343]`; `PaintSeedCard` when `stackReveal || (apply && !stacking)` and `PhotoWiggleCard` when `revealTab || stackReveal` `[VERIFIED: .../PhysicsPaintPlayScriptDialog.tsx:345-346]`; `KeyScriptCard` hidden on stacks `[VERIFIED: .../PhysicsPaintPlayScriptDialog.tsx:344]`.
- Existing "Place a reference…" path: button calls `playScript.requestPhotoReference()` `[VERIFIED: .../PhysicsPaintPlayScriptDialog.tsx:366-378]` → `function requestPhotoReference(): void { ports.openPhotoReference?.(); }` `[VERIFIED: app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.ts:1331-1333]` → Studio `openPhotoReference: () => { referenceDialogOpen.value = true; }` `[VERIFIED: app/src/components/physic-paint/PhysicsPaintStudio.tsx:4349]`. The create tab runs the same guard proactively on tab entry `[VERIFIED: .../physicsPaintRotoPlayScriptController.ts:1319-1329]`.
- WR-06 invariant: stack open forces `railTab` to paint (`if (railTab.peek() !== 'paint') railTab.value = 'paint';` `[VERIFIED: .../physicsPaintRotoPlayScriptController.ts:1454-1457]`), and `confirm()` routes a stack before the tab (`if (runDestination.peek().kind === 'stack') return confirmStack();` `[VERIFIED: .../physicsPaintRotoPlayScriptController.ts:2026-2033]`), pinned by `never routes a stack confirm to the Reveal tab (WR-06)` `[VERIFIED: app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.test.ts:5605]`. A C2 "Reveal" therefore belongs in the Rail Type option set, not the tab.

## 4. `confirmStack` branch structure and ports

Order inside `confirmStack` (`app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.ts:2299-2707`):

1. Target still present (2415-2421).
2. **Reference refusal** — destination-reveal only today: `const isRevealTarget = currentTarget.railKind === 'reveal' || target.railKind === 'reveal';` then `!revealTailPortPresent() ? 'This build cannot render a Reveal rail. Nothing changed.' : !(ports.hasPhotoReference?.() ?? false) ? 'This Reveal rail has no photo reference. Place a reference, then run again. Nothing changed.' : null` `[VERIFIED: .../physicsPaintRotoPlayScriptController.ts:2427-2440]`. This block returns before `abortController`, `requestAuthority`, any bake or any commit → zero writes by construction.
3. Keep law: `const canRecordKeepOn = !isRevealTarget && unionBake !== undefined && keepOn;` and `const recordMode: 'append' | 'none' = isRevealTarget ? (keepOn ? 'append' : 'none') : canRecordKeepOn ? 'append' : 'none';` `[VERIFIED: .../physicsPaintRotoPlayScriptController.ts:2451-2459]`.
4. Render inputs: `const renderMode = isRevealTarget ? currentTarget.mode : mode.peek();` plus `renderOverrideColor`, `renderPaintSeedVariation` `[VERIFIED: .../physicsPaintRotoPlayScriptController.ts:2476-2483]`; bake via `bakeAquarelleScript({ snapshot, count, start, size, acceptedGeneration, motion, mode: renderMode, paintSeedVariation })` `[VERIFIED: .../physicsPaintRotoPlayScriptController.ts:2489-2492]`.
5. Publication prep + single commit authority re-check (2496-2524).
6. Standard projection: `buildStandardStackedLoopClip({ target: currentTarget, mergedSourceKeyIds, lifecycle })` `[VERIFIED: .../physicsPaintRotoPlayScriptController.ts:2551-2555]`; the projection literal keeps `mode: target.mode` (the destination's stored value) and drops the rest `[VERIFIED: app/src/components/physic-paint/roto/physicsPaintRotoRunScriptStacking.ts:566-582]`. Because `mode` is the **destination's**, a reveal run's variant never persists.
7. Sheets come from the run's own staged bake: `const sheets = destinationAppFrames.map((appFrame, index) => { const frame = staged[index]; ... return { appFrame, bytes: frame.bytes }; });` `[VERIFIED: .../physicsPaintRotoPlayScriptController.ts:2571-2575]`.
8. CR-01 no-slice refusal for non-reveal targets (2582-2584).
9. **Destination-reveal branch**: `if (isRevealTarget) { ... await revealTailBake({ slices, frames, scriptEvents, mode, motion, colorize, colorizeMix, photoWiggle, paintSeedVariation, signal, onProgress }) ...}` and full-coverage assertion over exactly the touched frames before `withRecordBytes` `[VERIFIED: .../physicsPaintRotoPlayScriptController.ts:2585-2626]`.
10. Keep ON union: `await unionBake({ keyIds: touchedKeyIds, sheets })` `[VERIFIED: .../physicsPaintRotoPlayScriptController.ts:2627-2638]`.
11. Keep OFF compose: `await compose({ keyId, appFrame: sheet.appFrame, sheetBytes: sheet.bytes })` per sheet `[VERIFIED: .../physicsPaintRotoPlayScriptController.ts:2639-2657]`.
12. WR-02 record-port guard, `phase='committing'`, `await ports.commit(publication)` (2661-2668), then `recordRailKeyScripts!({ keyIds: touchedKeyIds, slices, recordMode })` (2674-2682).

Port signatures wired today:

- `bakeStackedRailKey?: (input: { keyIds: readonly string[]; sheets: readonly PhysicPaintRotoStackSheet[] }) => Promise<{ kind: 'baked'; frames: ... } | { kind: 'refused'; reason: string }>` `[VERIFIED: app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.ts:359-365]`; `PhysicPaintRotoStackSheet` is `{ readonly appFrame: number; readonly bytes: Uint8Array }` `[VERIFIED: .../physicsPaintRotoPlayScriptController.ts:280-283]`.
- `composeStackedRailKey?: (input: { keyId; appFrame; sheetBytes }) => Promise<...>` `[VERIFIED: .../physicsPaintRotoPlayScriptController.ts:373-377]`.
- `bakeRevealStackTail?: (input: { slices; frames; scriptEvents; mode; motion; colorize; colorizeMix; photoWiggle; paintSeedVariation; signal; onProgress? }) => Promise<{ kind: 'baked'; frames; anchors } | { kind: 'refused'; reason }>` `[VERIFIED: .../physicsPaintRotoPlayScriptController.ts:386-411]`.
- `hasPhotoReference?`, `photoReferenceRevision?`, `openPhotoReference?` `[VERIFIED: .../physicsPaintRotoPlayScriptController.ts:315-321]`.
- Studio implementations: `bakeStackedRailKey` clears staged pins then composites each sheet over the key's current payload `[VERIFIED: app/src/components/physic-paint/PhysicsPaintStudio.tsx:4032-4117]`; `composeStackedRailKey` same without pins `[VERIFIED: .../PhysicsPaintStudio.tsx:4123-4147]`; wired at `[VERIFIED: .../PhysicsPaintStudio.tsx:4382-4388]`.
- `recordRailKeyScripts` is the only consumer of staged pins and runs strictly after the commit `[VERIFIED: .../PhysicsPaintStudio.tsx:4248-4289]`.

**Factual gap C2 must close:** `isRevealTarget` is derived from the **destination**, and both render branches are selected by it. There is no run-kind input to `confirmStack`; the only run-shaping signals are `mode`, `dialogMotion`, `overrideEnabled`/`stackOverrideColor`, and the four reveal knobs. On a non-reveal destination those reveal knobs are not seeded at dialog open (seeding is gated by `if (destination.rail.railKind === 'reveal')` `[VERIFIED: .../physicsPaintRotoPlayScriptController.ts:1444-1453]`) and default to off.

**Port-compatibility finding:** the existing `unionBake`/`compose` ports accept exactly `{ appFrame, bytes }` sheets and composite over the destination's current picture, so a reveal-rendered straight-alpha sheet can feed them; `bakeRevealStackTail` as currently written cannot supply a run-only sheet for a non-reveal destination without its destination-event slow path (see 1(b)).

## 5. Pitfalls and test seams

### Reactivity (project-mandated: `efx-preact-reactivity` skill)

- Store/signal setters must be compare-then-write, e.g. `function setKeepScript(enabled: boolean): void { if (keepScript.peek() === enabled) return; keepScript.value = enabled; }` `[VERIFIED: app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.ts:1162-1166]`; skill rule 3 `[CITED: .claude/skills/efx-preact-reactivity/SKILL.md:29]`.
- Seeds read live state only while the dialog is open: `const destination = confirmationOpen.value && dialogMode.value === 'apply' ? runDestination.value : null;` `[VERIFIED: .../physicsPaintRotoPlayScriptController.ts:1143-1160]` — the comment records that an unconditional read caused one subscription per playhead tick.
- Every new Reveal-selection seed must use the same dialog-gated, compare-then-write shape; render-body signal writes are forbidden (skill rule 6) `[CITED: .claude/skills/efx-preact-reactivity/SKILL.md:45]`; every loop (e.g. per-sheet compose) needs a termination condition (rule 7) `[CITED: .claude/skills/efx-preact-reactivity/SKILL.md:47]`.

### Widening `mode` is a cross-cutting type change

`RotoPlayScriptMode` is used by the dialog signal, `bakeAquarelleScript`, the persisted `PhysicPaintRotoLoopClip.mode`, and the `stopStaticDefaults` effect (`if (mode.value === 'static' && !staticDefaultsApplied)` resets count/repeat/max/infinity) `[VERIFIED: app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.ts:1236-1247]`. A third value in that union would flow into persistence types and every mode consumer; the whitelist projection persists `target.mode` unchanged, so the run-kind axis has a narrower surface than `mode`.

### Zero-write refusal law

- The refusal happens before the generation counter, abort controller, authority request and bake `[VERIFIED: .../physicsPaintRotoPlayScriptController.ts:2427-2466]`.
- Staged pins are cleared at each bake start (`stagedPins.clear();` `[VERIFIED: .../PhysicsPaintStudio.tsx:4041-4044]`; `pendingStackedScriptBasePinsRef.current.clear();` `[VERIFIED: .../PhysicsPaintStudio.tsx:4175-4177]`) and land only from `recordRailKeyScripts` after commit `[VERIFIED: .../PhysicsPaintStudio.tsx:4260,4283-4288]`.
- Controller test pins this for reveal destinations: `expect(test.commit).not.toHaveBeenCalled(); expect(test.bakeOptions).toHaveLength(0); expect(test.bakeRevealStackTail).not.toHaveBeenCalled(); expect(recorder).not.toHaveBeenCalled();` `[VERIFIED: app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.test.ts:4942-4957]`.

### Realm/bridge constraints for reference bytes

- The Studio child realm has no hydrated projectStore; `projectSize` must come from carried launch dims `[VERIFIED: app/src/components/physic-paint/PhysicsPaintStudio.tsx:4351-4352]`, and the render must use `getPhysicsPaintWorkingSize` plus `referenceZoom = size.width / projectSize.width` `[VERIFIED: app/src/stores/physicPaintStore.ts:2196-2198]`.
- Reference bytes are main-realm registry entries (`_referenceSourceImages`) hydrated on reopen; a missing entry is a hard fail, never transparency `[VERIFIED: app/src/stores/physicPaintStore.ts:690-695,1965-1973]`.
- `hasPhotoReference` is existence-only; confirm-time rendering can still refuse with `'missing reference source'`. Both the dialog notice and the confirm path already re-read `photoReferenceRevision` `[VERIFIED: app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.ts:697-700]`.

### Test seams to mirror

- Controller stack harness: `stackHarness(loopClips, authorityOverrides, portOverrides, selection)` with `requestAuthority`, `commit`, `getRotoLoopClips`, anchor-reporting bake defaults `[VERIFIED: app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.test.ts:4196-4294]`; reveal-stacking describes and knobs `[VERIFIED: .../physicsPaintRotoPlayScriptController.test.ts:4909-4957]`.
- Dialog fake-controller seed tree; reveal stacking describe pins the exact read-only notice copy and the absence of a Place-a-reference action for a reveal destination `[VERIFIED: app/src/components/physic-paint/view/PhysicsPaintPlayScriptDialog.test.ts:1939-2001]`.
- Studio source-scan pins over raw source via `slice()`: bake/compose port blocks `[VERIFIED: app/src/components/physic-paint/PhysicsPaintStudio.test.ts:5080-5167]`, `bakeRevealStackTail` block and `renderRevealTailFrames` wiring `[VERIFIED: .../PhysicsPaintStudio.test.ts:5179-5216]`.

## Validation Architecture

| Property | Value |
|----------|-------|
| Framework | Vitest (`vitest run` only; never watch — CLAUDE.md) |
| Config | inherited monorepo setup; run command `pnpm --filter efx-motion-editor exec vitest run` (`.planning/config.json` `workflow.test_command`) |
| Quick run | one suite path per touched module (`app/src/components/physic-paint/.../*.test.ts`) |
| Full suite | `pnpm --filter efx-motion-editor exec vitest run` |
| Typecheck | `tsc --noEmit` in `app/` |

Behavior→test targets C2 needs to cover: refusal with zero writes (controller), Reveal option presence/absence by destination kind (dialog), sheet-over-current-picture composite (Studio source pins + store/controller), Standard projection unchanged (stacking suite), save/reopen unchanged (controller reload pins). Wave 0 gaps: none known — the existing suites above already host the equivalent C1/Quick B pins.

## Security Domain

No new network endpoint, auth path, or trust-boundary schema. The change reads locally registered image bytes and compositing only; the relevant control is the existing fail-closed reference resolution (`'missing reference source'`) plus the refuse-before-write ordering. ASVS V5 (input validation) applies only in the existing sense: the dialog's integer parsing and the reference predicate. No cryptography, session, or access-control surface is touched. `[VERIFIED: app/src/stores/physicPaintStore.ts:2056-2062,2187-2206]` and diff scope confirmed against C1's schema statement (`261031-vbo-SUMMARY.md:183-187`).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | A reveal-rendered straight-alpha sheet composited through `composeRotoScriptRebakeFrame`/`bakeStackedRailKey` yields the intended "reference where coverage, destination picture elsewhere" result | 1(c), 4 | Composite may need a reveal-specific alpha law; verify with a pixel-level pin before locking the approach |
| A2 | Reusing `bakeRevealStackTail` unchanged on a non-reveal destination is unacceptable because of its destination-event slow path | 1(b) | If the planner instead extends that port, the C1 post-UAT animation law may regress |
| A3 | A third Rail Type value cannot ride `RotoPlayScriptMode` without touching persistence typing | 5 | If widened, every `mode` consumer (dialog, bake, summary, model) needs review |

All other claims above were read from the cited files this session.

## Open Questions (RESOLVED)

Resolved by the plan: (1) a separate non-persisted run-kind axis (`stackRunKind`), never a widened `RotoPlayScriptMode`; (2) a new run-only `bakeRevealStackRun` port built on the `renderRevealTail` fast path, never `bakeRevealStackTail`'s destination-event slow path; (3) reuse `revealReferencePlaced` + `requestPhotoReference` for the actionable reference row.

1. **Run-kind expression.** Where should "incoming Reveal" live: a widened Rail Type signal, a separate `incomingRailKind` signal, or a derived dialog/controller flag? What we know: `mode` is typed two-valued and persisted via `target.mode`; `stackRailKind` is destination-only; the reveal knobs already exist and are seeded only for reveal destinations. Recommendation: keep `mode` as the bake variant and add a separate run-kind axis; do not widen the persisted type.
2. **Sheet production for an incoming Reveal.** The existing render-only seam needs a run-only sheet (no destination event union) plus the document reference bytes. What is unclear: whether to expose a new port shape or to parameterize `bakeRevealStackTail`'s fast path. Recommendation: research confirms a run-only render is the safe shape; the planner decides the port boundary.
3. **Reference row on a non-reveal destination.** Quick B shows a read-only notice with no action; CONTEXT requires an actionable "Place a reference…" when none is placed. What we know: `revealReferencePlaced` + `requestPhotoReference` already provide both. Recommendation: reuse them for the incoming-Reveal case.

## Sources

### Primary (HIGH confidence — read this session)
- `app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.ts` — ports, stack seed, confirm dispatch, `confirmStack`, refusal, Standard projection.
- `app/src/components/physic-paint/PhysicsPaintStudio.tsx` — `renderRevealTail`, `bakeStackedRailKey`, `composeStackedRailKey`, `bakeRevealStackTail`, `recordRailKeyScripts`, port wiring.
- `app/src/stores/physicPaintStore.ts` — `commitRevealBake`, `renderRevealTailFrames`, `_resolveReferenceSourceImage`, reference registry.
- `app/src/stores/efxPaintStore.ts` — `createRevealRail` guards and first bake.
- `app/src/efx-paint/document/efxPaintDocument.ts` — `PhotoReferenceTrack`, document field.
- `app/src/components/physic-paint/roto/physicsPaintRotoRunScriptStacking.ts` — destination view, `isStandardMergedLoopClip`, `buildStandardStackedLoopClip`.
- `app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptRenderer.ts` — `RotoRevealRenderInput`, `renderRotoRevealFrames`.
- `app/src/components/physic-paint/roto/physicsPaintRotoScriptRebake.ts` — pigment-alpha composite law.
- `app/src/components/physic-paint/view/PhysicsPaintPlayScriptDialog.tsx` and `PhysicsPaintPlayScriptCards.tsx` — stack composition and card rules.
- Tests: `physicsPaintRotoPlayScriptController.test.ts`, `PhysicsPaintPlayScriptDialog.test.ts`, `PhysicsPaintStudio.test.ts`.

### Secondary (MEDIUM confidence)
- `.planning/quick/261031-vbo-.../261031-vbo-SUMMARY.md` — C1 merge law, post-UAT picture fix, schema statement.
- `.planning/quick/261031-qps-.../261031-qps-SUMMARY.md` — Quick B tail bake and dialog laws.
- `.planning/quick/261031-i54-.../261031-i54-CONTEXT.md` — Quick A stack laws.

## Metadata

**Confidence breakdown:** Standard stack HIGH (no external packages); Architecture HIGH (all paths read in source); Pitfalls MEDIUM-HIGH (recurring project rules + C1 regression evidence).
**Research date:** 2026-11-01
**Valid until:** until the next Physic Paint Roto stacking change; this file is source-pinned at `7c36385b2`.
