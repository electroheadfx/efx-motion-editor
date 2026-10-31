# Quick Task 261031-qps: Run Script stacking, part B — Research

**Researched:** 2026-10-31
**Domain:** Physic Paint roto — aquarelle durable-base authority, pixel-only Keep script, Reveal rail stacking
**Confidence:** HIGH (every claim below is read from the current tree; no external library is involved)

## Summary

Quick B has four code-shaped problems, none of them a library problem: (1) replace the payload-only `durableBaseKeyId` shortcut with one `aquarelleScriptBaseAuthority.ts` that resolves a **key-scoped** pre-script base for every script path, (2) let a pixel-only Paint rail turn Keep script ON without flipping `keyScriptEdits`, (3) allow Run Script to target a Reveal rail and bake the new tail through the placed photo reference, and (4) retire the four test groups that pin today's laws where Quick B intentionally changes them.

Two findings drive the design:

- The current "does this key have a script?" probe is frame-scoped and **Dry-inclusive**: `getAquarelleEventsForFrame` returns every Dry event for every frame (`if (isAquarelleDryEvent(event)) return true;` — `aquarelleRecordState.ts:1692`). The authority's "no recorded events → payload IS the pre-script cache" step must use the strokes-only predicate `hasAquarelleScriptForFrame` (`aquarelleRecordState.ts:1705-1712`), and must resolve the **resolution key's own appFrame**, not the occurrence/override frame.
- A Reveal key's picture is wash-alpha × reference, not pigment over a base. The existing `railScriptOwnsKey → durableBaseBytes: null` known-empty rule (`PhysicsPaintStudio.tsx:3363-3366`, branches at `3435-3436` and `3442-3443`) would erase the photo if a Reveal key ever reached the raw bake. Recording per-key scripts on Reveal rails therefore needs a reveal-aware replay kind in the authority — this is the one place the current model cannot express the requirement, and it is a **design decision, not a schema change**.

**Primary recommendation:** build the authority as a pure `resolve(key-scoped inputs) → base | known-empty | refused | reveal-replay` core plus a thin effectful pin adapter in the Studio; rewrite `prepareRotoScriptTarget` and both stack bake ports onto it in the same wave; then add the Reveal destination + a render-only reveal tail port that feeds the controller's existing single publication.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### Durable-base authority (user decision: every script path)
- The new `app/src/components/physic-paint/roto/aquarelleScriptBaseAuthority.ts` governs **every** script-target path: creation Apply, raster-key edits, Run Script stacking, source occurrences, frame overrides, reopened rails, flag-on and flag-off rails.
- `prepareRotoScriptTarget` in `PhysicsPaintStudio.tsx` is rewritten to consume the authority; the current `durableBaseKeyId` payload-only path is removed.
- Resolution order, fail-closed:
  1. Persisted SNAP v5 durable base of the **resolution key** (`null` = known-empty).
  2. Session durable-base map.
  3. Resolution key has no recorded aquarelle events → its current payload IS the pre-script cache; pin it.
  4. Otherwise fail closed with `durable-base-unknown`, zero writes.
- Source occurrences and frame overrides resolve to the **source key**, never the occurrence/override composite.
- Never use a payload as a base when that key has recorded events.
- Freshly pinned bases persist; recovered bases stay session-only.

#### Pixel-only Keep switch (user decisions)
- On a pixel-only (`keyScriptEdits !== true`) Paint rail the Keep script switch becomes available and defaults **ON**.
- **ON:** append this run's strokes to the touched keys' recorded scripts; the rail's existing picture is pinned as the durable base; re-bake composites base + recorded events. The rail's persisted `keyScriptEdits` flag is never implicitly flipped.
- **OFF:** flatten — composite the run over the key's current picture and record nothing (the Quick A behavior the UAT accepted). Non-destructive; no purge, no replace.
- The flag-on Keep OFF path (purge then replace) is unchanged from Quick A.

#### Frame-override bases
- A frame override inside the written span is now supported.
- The override key's base authority is the **source key's** authority; the override composite is never used as a base.
- If the source key's base cannot be proven, fail closed with zero writes.

#### Reveal rail stacking (user decisions)
- Reveal rails stack like Paint rails: playhead membership, extend-only growth, repeat unchanged and virtual, collision Cancel/Truncate(default)/Overwrite, one atomic undo.
- Keep script records the new strokes on Reveal rails (this intentionally changes today's "Reveal keys are script-incapable" contract).
- A Reveal stack run exposes **Colorize**, **Photo wiggle** and **Paint seed** as editable cards; the rail adopts the run's values in the same commit. Rail Type is hidden for Reveal destinations — the placed photo reference defines the kind.
- The placed photo reference stays the rail's own; extension bakes the new tail through it (same photo, new wash).
- No photo reference placed → refuse with a clear reason, zero writes.
- Plain-paper keys must never be mixed into a Reveal rail.

#### Carried Quick A laws (re-affirm; do not revisit)
- Playhead membership only selects the destination; outside every rail = unchanged create path.
- `runStart = phaseOrigin + cycleOffset`; extend-only; repeat unchanged; infinity lifecycle-less.
- Truncate caps growth but never shrinks an existing lifecycle.
- Overwrite removes the victim Loop Clip; its keys survive as ordinary keys; one undo restores it.
- The open stack surface is pinned; confirm revalidates the live rail.
- The dialog is a shell over `PhysicsPaintPlayScriptCards.tsx`; a new variant is a new composition of the same cards.

### Claude's Discretion
- Internal module/API shape of `aquarelleScriptBaseAuthority.ts`.
- Exact refusal copy and the Reveal card copy/ordering.
- How the Reveal tail bake is composed (single bake vs per-key compositing) as long as it uses the placed photo reference and the same photo.
- Whether `prepareRotoScriptTarget` keeps its signature or becomes a thin adapter.
- Test harness details.

### Deferred Ideas (OUT OF SCOPE)
None recorded in QPS CONTEXT.md. Quick B *is* the deferred half of Quick A; Quick A must not be re-implemented.
</user_constraints>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Durable-base resolution (pure) | Roto domain module (`roto/aquarelleScriptBaseAuthority.ts`) | — | Decision logic over injected lookups; node-testable, no signals, no DOM |
| Pin / persist / snapshot-mark | Studio effectful layer (`PhysicsPaintStudio.tsx`) | SNAP v5 controller | The Studio owns the session maps and the snapshot dirty channel |
| Stack run orchestration | Controller (`physicsPaintRotoPlayScriptController.ts`) | Pure stacking module | The controller owns the pinned surface, collision choice, one publication |
| Stack bake pixels (Paint) | Studio ports (`bakeStackedRailKey` / future union-over-base) | `composeRotoScriptRebakeFrame` | Pixel law and paper/canvas live in the Studio realm |
| Reveal tail bake (pixels) | Store domain (`physicPaintStore` expose/render) | Renderer (`renderRotoRevealFrames`) | Reference registry is module-private to the store; the renderer owns the mask law |
| Rail metadata adoption | Controller (builds `updatedTarget`) | — | Lifecycle + settings must land in the same atomic `ports.commit` |

## Focus 1 — Durable-base authority

### Current path (all anchors verified this session)

| Path | Location | Behavior today |
|------|----------|----------------|
| Target preparation (Apply/Copy only) | `PhysicsPaintStudio.tsx:3346` `prepareRotoScriptTargetRef.current = async (source) => {` | Recovers a base, then returns `RotoScriptPhysicalTarget` |
| Ordinary key | `3384-3431` | Session map hit → bytes/null; else if `!isAquarelleScriptEditInFlight() && getAquarelleEventsForFrame(source.appFrame).length === 0` → pin payload (`3414-3423`); else `undefined` |
| Source occurrence | `3433-3438` | `durableBaseKeyId: target.sourceKeyId` — **payload-only shortcut** |
| Frame override | `3439-3445` | `durableBaseKeyId: sourceKeyId` — same shortcut |
| Empty/generated promotion | `3450-3469` | `durableBaseBytes: promotedBase` |
| Rail-key known-empty | `3363-3366` `.some((clip) => clip.keyScriptEdits === true && clip.sourceKeyIds.includes(keyId));` | Picture is ENTIRELY script → raw bake |
| Publish closure | `1969-2077` | `if (target.durableBaseKeyId) {` group-source-key payload compose; `} else if (target.durableBaseBytes !== undefined) {` null → raw (`2023-2026`), bytes → compose (`2029-2063`); `} else` → `reason: 'durable-base-unknown'`, return false (`2065-2077`) |
| Base recovery (edits) | `ensureAquarelleDurableBaseRef.current` `6654-6773` | No record/no events → true; no payload → known-empty `null` (`6671`); else pre-edit bake + `recoverAquarelleDurableBase` (`6717-6722`) |
| Recovery result | `aquarelleBaseRecovery.ts:95-124` | `reason: 'decode' \| 'recombine' \| 'validation' \| 'structure' \| 'encode'` |
| Session map | `PhysicsPaintStudio.tsx:1530` `useRef<Map<string, Uint8Array \| null>>(new Map())` | null = known-empty |
| Persist filter | `1266-1274` `if (!recovered.has(keyId)) persistable.set(keyId, bytes);` | Recovered bases never leave the session |
| Recovered marker | `6747-6749` `if (recovery.kind === 'empty') ...delete(record.keyId); else ...add(record.keyId);` | Only first-stroke pins persist |
| SNAP v5 container | `studioScriptSnapshotCodec.ts:59` `export const STUDIO_SCRIPT_SNAPSHOT_VERSION = 5;` | — |
| Durable base entry | `studioScriptSnapshotCodec.ts:103` `...DURABLE_BASE_VERSION = 2;` and `112-115` `{ readonly keyId: string; readonly bytes: Uint8Array \| null; }` | Already persisted; no format change needed |

### Target module shape (Claude's discretion, recommendation)

```
resolveScriptBase(input: {
  resolutionKeyId: string;
  resolutionAppFrame: number;      // the SOURCE key's own canonical frame
  persistedBase: Uint8Array | null | undefined;  // from SNAP v5 seed
  sessionBase: Uint8Array | null | undefined;    // session map
  hasRecordedStrokes: boolean;                   // hasAquarelleScriptForFrame(resolutionAppFrame)
  railOwnsKeyAsKnownEmpty: boolean;              // keyScriptEdits rail, Paint only
  unreadablePayload: boolean;
}) => { kind: 'base'; bytes } | { kind: 'known-empty' } | { kind: 'refused'; reason: 'durable-base-unknown' }
```

plus an effectful wrapper `resolveAndPin` that (a) writes a freshly pinned payload into `aquarelleDurableBaseByKeyRef`, (b) deletes the recovered marker for a fresh pin (`3416` precedent), (c) leaves recovered bases session-only (`6748-6749`), and (d) marks the snapshot dirty (`studioScriptSnapshot.markDirty()` precedent at `6674`).

### Resolution-order mapping (locked)

1. **Persisted SNAP v5 base** — seeded by `seedDurableBases` (`1275-1283`; session wins per key). `null` = known-empty.
2. **Session map** — `aquarelleDurableBaseByKeyRef.current.get(resolutionKeyId)`; `has()` distinguishes absent from `null`.
3. **No recorded strokes** — payload is the pre-script cache → pin it and persist it. Use `hasAquarelleScriptForFrame(resolutionAppFrame)`, **not** `getAquarelleEventsForFrame` (Dry events are global, `aquarelleRecordState.ts:1692`).
4. **Else** — `durable-base-unknown`, zero writes.

### Call sites to rewire

1. Apply/Copy preparation — `prepareRotoScriptTargetRef` (`3346-3470`) and the publish closure (`1969-2077`); delete the `durableBaseKeyId` branch and the field from `RotoScriptPhysicalTarget` (`physicsPaintRotoScriptClipboard.ts:57`).
2. Raster-key / live edits — `ensureAquarelleDurableBaseRef` (`6654-6773`) delegates its lookup to the authority and keeps `recoverAquarelleDurableBase` as the recovery step (validated, not proven — `aquarelleBaseRecovery.ts:18-29`).
3. Run Script stacking — `bakeStackedRailKey` (`3896-3912`, currently raw union, never composites) and `composeStackedRailKey` (`3917-3947`, currently payload-as-base) both become authority consumers (see Focus 2).
4. Source occurrences — resolution key = `sourceKeyId`; **resolution appFrame = the source key's canonical frame**, not the occurrence frame (event lookup is `event.playFrame !== playFrame`, `aquarelleRecordState.ts:1693`). Precedent for key→frame: `getRotoRealKeyRecords(...)` / `requirePhysicPaintRotoInlineBytes` usage at `1974-1979`.
5. Frame overrides — resolution key = source key (`3440` `resolvePhysicPaintRotoGroupSourceKeyIdAtOffset`); the override composite is never read as a base. Also remove the boundary refusal (`physicsPaintRotoRunScriptStacking.ts:378-392`, `overrideInSpan` / `frameOverrideRefusal: 'frame-override'`) and its controller surfaces (`physicsPaintRotoPlayScriptController.ts:622-624`, `968`, `1006`, `2231`, `2279`) where the decision makes overrides legal.
6. Reopened rails — persisted base path (`seedDurableBases`); if absent and strokes exist → fail closed (today's `3391-3392` law).

### Test pins that must be rewritten in this step

`PhysicsPaintStudio.test.ts:4452-4453, 4472` (prepare/publish source text contains `durableBaseKeyId: sourceKeyId`), `4889-4903` (override/source branches), `5071` (`countOccurrences(prep, 'durableBaseKeyId: null, durableBaseBytes: null')` = 2). These are source-text pins on the exact code being replaced; replacement pins should assert the authority contract instead.

## Focus 2 — Pixel-only Keep script ON + flatten OFF

### Today's gate and branches

- `keepScriptEffective` requires `destination.rail.keyScriptEdits === true` (`controller:1047-1050`); `keepScriptDisabledReason` returns `'This rail stores pixels, not per-key scripts. The run is composited over its existing pixels.'` (`1051-1055`); the seed effect forces OFF for pixel-only (`1070-1072`). Default constant is ON: `RUN_SCRIPT_KEEP_SCRIPT_DEFAULT = true` (`physicsPaintRotoRunScriptStacking.ts:137`).
- `const recordScripts = currentTarget.keyScriptEdits === true;` (`2339`) selects: union branch `2436-2447`, pixel-only composite branch `2448-2465`, recording `2474-2482` with `recordMode: useUnion ? 'append' : 'replace'`.
- `recordRailKeyScripts` (`3952-3978`): `'replace'` purges + pins `null` (`3962-3969`); `'append'` records only — **it never pins**.
- `composeStackedRailKey` (`3917-3947`) reads the record payload as the base and composites; missing record → sheet is complete content.

### Required change (2×2 truth table)

| Rail | Keep | Pixels | Records |
|------|------|--------|---------|
| flag-on | ON | raw union bake (known-empty base) | append |
| flag-on | OFF | replace publication | purge + replace (unchanged Quick A) |
| pixel-only | ON | union bake over the **pinned base** (bytes → compose) | append; never flip `keyScriptEdits` |
| pixel-only | OFF | composite over current payload | none, no pin |

Implementation consequences:

- `recordScripts` stops being a single boolean gate; branch on `{railScriptOwnsKeys, keepScriptEffective}`.
- One union port can serve both ON cases if the authority supplies the base: `base === null` → raw bake; `bytes` → `bakeAquarelleEventsToFrame` then `composeRotoScriptRebakeFrame` (existing law, `physicsPaintRotoScriptRebake.ts`).
- **Ordering trap:** for pixel-only ON, pin the PRE-run picture **before** the publication overwrites the key payload; the union bake over that pinned base reproduces exactly what the flatten path would have composited (steps 3 of the authority guarantee the key had no recorded strokes).
- **No doubling:** a second run resolves base from the map (no re-pin) and unions existing recorded events + new strokes. Reopen: base persists via SNAP v5, events persist — same result.
- `keepScriptDisabledReason` becomes null for stack destinations; the dialog renders the reason node only when present (`PhysicsPaintPlayScriptDialog.tsx` cards wiring at `326`).
- Never write `keyScriptEdits` in `updatedTarget` (`2416-2423` sets only `mode`, `motion`, `overrideColor`).

### Tests pinning today's OFF+disabled (intentional updates)

- `physicsPaintRotoPlayScriptController.test.ts:4377-4402` — `flagOff.controller.keepScriptVisible.value` true, `keepScriptEffective` false, reason contains `'composited over its existing pixels'`; `4387-4390` flag-on expectations stay.
- `PhysicsPaintPlayScriptDialog.test.ts:1612` (no Keep on create), `1667-1688` (reason text), `1813`.
- `PhysicsPaintStudio.test.ts:5001-5029` — recordRailKeyScripts replace/append pins and the `railScriptOwnsKey` known-empty pin.

## Focus 3 — Reveal rail stacking

### Today's model and the exact seams

- Refusal: `resolveRunScriptDestination` returns `{ kind: 'refuse', reason: 'reveal-target' }` (`physicsPaintRotoRunScriptStacking.ts:240-242`); copy at `controller:1279-1281`; test `physicsPaintRotoRunScriptStacking.test.ts:222-226`.
- Rail creation: `createRevealRail` (`efxPaintStore.ts:1524-1704`) — guards (`1563-1573`), settings resolved once (`1578-1591`), bake via `commitRevealBake` (`1594-1611`), clip built with `railKind: 'reveal'` (`1638`), `scriptId` (`1639`), `mode: input.variant` (`1637`), compacted `motion` (`1643`), and optional `colorize/colorizeMix` (`1647`), `photoWiggle` (`1649`), `paintSeedVariation` (`1652`), `keyScriptEdits` (`1655`).
- Bake: `commitRevealBake` (`physicPaintStore.ts:2020-2144`) — per-frame reference `_resolveReferenceSourceImage` (`1960-1968`, `2051-2057`), fail-closed `'missing reference source'` (`2055`), render `renderRotoRevealFrames` (`2061-2077`), then it **writes records itself** (`2131`) plus the leading interpolation break (`2134-2141`).
- Renderer: `renderRotoRevealFrames` (`physicsPaintRotoPlayScriptRenderer.ts:101-113`) requires an aquarelle wash timeline; refuses a script without one (`108-111`).
- Replay: `replayRevealRail` (`efxPaintStore.ts:1733-1810`) re-bakes the whole span from `rail.clip.scriptId` — hand edits are replaced.
- Reference availability port: `hasPhotoReference` (`PhysicsPaintStudio.tsx:4032-4036`), plus `photoReferenceRevision`.

### Constraint that decides the design

`commitRevealBake` cannot be called from `confirmStack`: it commits records (and the break) outside the controller's single `ports.commit` publication, so the run would lose atomic undo and could diverge from the lifecycle write. Quick B needs a **render-only** reveal path that returns staged frame bytes for the run's destination frames; the controller then applies `withRecordBytes` and commits lifecycle + settings in the same publication (precedent: `2427-2465`).

Recommended port shape (Studio):

```
bakeRevealStackTail({
  appFrames,            // NEW destination frames only (extend-only)
  scriptSnapshot,       // the same library snapshot bakeAquarelleScript just used
  motion, colorize, colorizeMix, photoWiggle, paintSeedVariation, mode,
}) => Promise<{ kind: 'baked'; bytesByAppFrame } | { kind: 'refused'; reason }>
```

It must resolve the reference for those frames with the rail's own placed reference (same photo: `document.photoReference` + `track.transform` + working-size zoom, `2041-2057`). `_resolveReferenceSourceImage` and `_referenceSourceImages` are module-private; expose a narrow resolver or a store-level render helper — no persisted change. `mode` comes from `rail.mode` (the placed reference defines the kind; Rail Type stays hidden).

### Reveal-specific decisions the planner must lock

1. **Keep script on Reveal has no replay consumer today.** A recorded reveal key's script is wash-only; the only current replay is the ordinary Paint path, and `railScriptOwnsKey` would mark it known-empty → raw wash bake over blank paper → the photo disappears. The authority therefore needs an explicit `kind: 'reveal'` resolution (or a reveal-owned re-bake that re-masks the reference from the recorded events). Do **not** let a Reveal key reach the known-empty raw bake.
2. **Keep OFF on Reveal** = flatten: bake the tail through the photo, record nothing, never purge/pin (the key IS the picture).
3. **No mixing:** every destination frame on a reveal destination must receive reveal-rendered bytes; assert full coverage and refuse the run otherwise. Plain aquarelle publication bytes must never land on a reveal frame.
4. **Creation contract change:** `confirmReveal` hard-codes `keyScriptEdits: false` (`controller:2152`) and `setRailTab` clears the opt-in (`1236-1239`, `1335`) — the decision to record on Reveal changes these intentionally, along with the controller test at `physicsPaintRotoPlayScriptController.test.ts:3834-3842` and the "Reveal has no Key Script card" pins (`PhysicsPaintPlayScriptDialog.test.ts:1419-1497`).

### Dialog composition

`PhysicsPaintPlayScriptDialog.tsx`: `stacking` at `62`, tabs hidden `65`, `revealTab` excludes stacking `66`, stack cards at `298-344`. For a reveal destination, add a stack composition that (a) hides `RailTypeCard` (`148-160`, `stacking` prop at `303`), (b) renders `ColorizeCard` (`285`), `PhotoWiggleCard` (`315`), `PaintSeedCard` (`332`) — all reusable from Quick A's `PhysicsPaintPlayScriptCards.tsx`, (c) keeps `StackReadoutCard` + `KeepScriptCard` + `CollisionCard`. Controller state must seed those four settings from the destination rail exactly like `stackOverrideColor` does (`1252-1268`) and only while the dialog is open (see traps).

## Focus 4 — Shared seams, traps, gates

### Ordering (dependencies between the parts)

1. Authority module + `prepareRotoScriptTarget` rewrite + removal of `durableBaseKeyId` (foundation; touches Apply/Copy and edit publishes).
2. Override-in-span support in the stacking boundary + controller gates.
3. Keep-script 2×2 truth table + authority-backed stack bake ports (pixel-only ON).
4. Reveal destination resolution + reveal tail port + dialog composition + recording/replay kind.

Parts 3 and 4 both consume the authority; 4 depends on 1 only for the reveal-key exemption and the source-key resolution.

### Preact / @preact/signals traps (from `efx-preact-reactivity`)

- Seed effects must stay dialog-gated: Quick A already burned a UAT round because an unconditional `runDestination` read in `seedKeepScript` (`1057-1074`) re-derived every rail per playhead tick. New reveal-setting seeds must read the destination only while `confirmationOpen && dialogMode === 'apply'`.
- Compare-then-write only (`1077-1080`, `1208-1210`); never write a signal in a render body; `computed` for readouts.
- Identity-stable effect deps: use `.peek()` writes and stable callbacks (the hook wraps ports through `portsRef`, `useRotoPlayScriptController.ts:73-86`).

### Test/gate anchors

- Targeted: `pnpm --filter efx-motion-editor exec vitest run <app-relative path>` — the root/`test` script is `vitest` (watch); never use it (`app/package.json` scripts).
- Full suite: `pnpm --filter efx-motion-editor exec vitest run` — Quick A baseline 360 files / 6,736 passed / 1 skipped / 96 todo (`261031-i54-SUMMARY.md:131`).
- Typecheck: `pnpm --filter efx-motion-editor run typecheck`.
- Vitest collects only `.test.ts`; a `.test.tsx` target silently runs nothing.
- Do not start the server; `pnpm vitest run` only.

### Schema statement (explicit)

**No schema change is required, and none should be improvised.** SNAP v5 already carries `StudioScriptSnapshotDurableBase { keyId, bytes | null }` (`studioScriptSnapshotCodec.ts:112-115`) and the rail metadata already expresses every Reveal setting the decision needs (`railKind`, `scriptId`, `mode`, `motion`, `colorize`, `colorizeMix`, `photoWiggle`, `paintSeedVariation`, `keyScriptEdits` — `efxPaintStore.ts:1632-1662`). The only thing the current model cannot express is a **reveal key's pre-script base as a pixel buffer** (the reveal picture is wash-alpha × reference, not pigment over a base). That is a runtime resolution kind, not a stored value — handle it with a reveal replay path. If planning concludes a stored field is unavoidable, STOP and report.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest (workspace `app` package; `app/vitest.config.ts`) |
| Config file | `app/vitest.config.ts` |
| Quick run command | `pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint/...` |
| Full suite command | `pnpm --filter efx-motion-editor exec vitest run` |

### Phase Requirements → Test Map
| Behavior | Test Type | Automated Command | File Exists? |
|----------|-----------|-------------------|-------------|
| Authority resolves persisted → session → pin → refuse, and source-key mapping | unit | `vitest run src/components/physic-paint/roto/aquarelleScriptBaseAuthority.test.ts` (new) | ❌ Wave 0 |
| Prepare/publish consume the authority (no `durableBaseKeyId`) | unit (source pins + behavior) | `vitest run src/components/physic-paint/PhysicsPaintStudio.test.ts` | ✅ rewrite pins |
| Pixel-only Keep ON appends + pins + unions; OFF flattens | unit | `vitest run src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.test.ts` | ✅ rewrite expectations |
| Override inside span stacks; unprovable source base refuses | unit | `vitest run src/components/physic-paint/roto/physicsPaintRotoRunScriptStacking.test.ts` | ✅ extend |
| Reveal destination stacks; no reference refuses with zero writes | unit | controller + stacking tests | ✅ rewrite refusal test |
| Reveal tail bake through the same photo; settings adopted once | unit | Studio/efxPaintStore reveal tests + new port test | ❌ Wave 0 (port) |
| Dialog shows Colorize/Photo wiggle/Paint seed and hides Rail Type for Reveal stack | unit | `vitest run src/components/physic-paint/view/PhysicsPaintPlayScriptDialog.test.ts` | ✅ extend |

### Sampling Rate
- Per task commit: targeted file(s) above.
- Per wave merge: full suite + `typecheck`.
- Phase gate: full suite green; live UAT rows (raster-key edit, reopen+repeat no doubling, reveal tail through photo, no-reference refusal) before "done".

### Wave 0 Gaps
- [ ] `app/src/components/physic-paint/roto/aquarelleScriptBaseAuthority.test.ts` — pure resolution matrix including Dry-event insensitivity and source-key frame mapping.
- [ ] Reveal tail port test (render-only, no records written; reference fail-closed).
- [ ] No framework install needed.

## Security Domain

`security_enforcement` is not disabled in `.planning/config.json`, so the baseline applies. This phase touches no auth, session, network, or cryptography surface — it is a local pixel/state pipeline.

| ASVS Category | Applies | Standard Control |
|---------------|---------|------------------|
| V2 Authentication | no | — |
| V3 Session Management | no | — |
| V4 Access Control | no | — |
| V5 Input Validation | yes | Existing fail-closed unions (`durable-base-unknown`, `missing reference source`, `frame-override`) — never write on unknown state |
| V6 Cryptography | no | — |

Threat pattern for this stack: **destructive fail-open** (a bake over an unknown base erases user paint). Mitigation is the locked resolution order with an explicit refusal, plus the one-publication atomic commit.

## Sources

### Primary (HIGH confidence — read this session)
- `app/src/components/physic-paint/PhysicsPaintStudio.tsx` (3346-3470, 1969-2090, 1266-1283, 3860-3990, 6654-6773, 4020-4070)
- `app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.ts` (290-360, 1040-1090, 1225-1300, 2110-2510)
- `app/src/components/physic-paint/roto/physicsPaintRotoRunScriptStacking.ts` (160-260, 366-405)
- `app/src/components/physic-paint/roto/aquarelleBaseRecovery.ts` (95-124, 668-796)
- `app/src/components/physic-paint/view/aquarelleRecordState.ts` (1194-1294, 1688-1712)
- `app/src/components/physic-paint/performance/studioScriptSnapshotCodec.ts` (59, 103-115)
- `app/src/stores/efxPaintStore.ts` (1484-1704, 1733-1810, 1877-1984)
- `app/src/stores/physicPaintStore.ts` (1953-2144)
- `app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptRenderer.ts` (90-113)
- `app/src/components/physic-paint/view/PhysicsPaintPlayScriptCards.tsx` (135-350, 527-557) and `PhysicsPaintPlayScriptDialog.tsx` (58-70, 290-345)

### Secondary (MEDIUM confidence)
- Quick A artifacts: `261031-i54-CONTEXT.md`, `-PLAN.md`, `-SUMMARY.md` (baseline counts, UAT laws, deferred scope).

### Tertiary (LOW confidence)
- None.

## Metadata

**Confidence breakdown:**
- Durable-base authority: HIGH — every branch and persistence rule read from source.
- Pixel-only Keep: HIGH — gate and both branches read; only the new truth table is design.
- Reveal stacking: MEDIUM-HIGH — creation/replay/bake paths are certain; the render-only seam and the reveal-key replay kind are design decisions the planner must lock.
- Pitfalls/traps: HIGH — the Dry-event probe and the `railScriptOwnsKey` clash are read from source.

**Research date:** 2026-10-31
**Valid until:** 2026-11-30 (fast-moving area; re-verify if Quick A code changes)
