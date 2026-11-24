---
phase: quick/261124-tje
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - packages/efx-watercolor/src/playground/brushes.ts
  - packages/efx-watercolor/src/playground/brushes.test.ts
  - app/src/components/physic-paint/view/aquarelleRecordState.ts
  - app/src/components/physic-paint/view/aquarellePaintControls.ts
  - app/src/components/physic-paint/view/aquarelleBrushDefaults.test.ts
  - app/src/components/physic-paint/PhysicsPaintStudio.tsx
  - app/src/components/physic-paint/view/brushGroupMedium.test.ts
  - app/src/components/physic-paint/view/aquarellePaintControls.test.ts
  - app/src/components/physic-paint/view/aquarelleToolFamily.test.ts
  - app/src/components/physic-paint/view/AquarelleGlobalsPanel.test.ts
  - app/src/components/physic-paint/view/aquarellePresetSelection.test.ts
  - app/src/components/physic-paint/view/brushGroups.test.ts
  - app/src/components/physic-paint/view/PhysicsPaintBrushMenu.test.ts
autonomous: true
requirements: []
estimate:
  # Three focused slices. Per-task projection (chars/4 over the set the executor
  # actually touches — targeted grep + offset reads, not full reads — plus
  # verification output):
  #   Task 1  package table + predicate + package pins + build        ~40000
  #   Task 2  store function + sink + 3 seams + 7 test retargets       ~55000
  #   Task 3  Studio sink + landing + new test file + full gates       ~30000
  # Total ~125000. The largest cost is the source-scan/seam-audit retarget
  # sweep in Task 2; Task 2 MUST edit from one grep sweep (only
  # brushGroupMedium.test.ts and aquarelleToolFamily.test.ts are worth full
  # reads; the rest are targeted offset reads around the named anchors).
  # Package dist MUST be rebuilt after Task 1: app vitest aliases the package
  # to source, but app tsc resolves the built dist/*.d.ts.
  # estimate-calibration: factor 1, applied false, sample_count 0, confidence low.
  tokens: 125000
  raw_tokens: 125000
  tasks: 3
  confidence: low
must_haves:
  truths:
    - "Picking Gouache (the existing `bristle-round`) from ANY brush-pick surface — library card, top-bar popover, Brushes docker, or the Medium dropdown's landing — lands Brush size 40 px, Pigment 100, Pickup 100, Dry speed 0 and Feather 100, overwriting whatever sliders were live; the values are LIVE LANDING VALUES only, with no serializer, no `.mce` field, no Rust mirror and no migration (a stroke still persists only its response id)."
    - "Picking the new Pen response lands Brush size 10 px, the live pigment #373633, Pigment 100, Pickup 0, Dry speed 0 and Feather 85; Pen lists in the Gouache (acrylic) section directly after Gouache, and the Brush family's landing brush is STILL Gouache (`firstBrushPresetForTool('brush')` is `bristle-round`)."
    - "A fresh Studio opens on Gouache's bag, not on the acrylic medium record: after the first real working-height report the live values are size 40 px, Pigment 100, Pickup 100, Dry speed 0, Feather 100, with the session colour untouched (Gouache's bag names no colour)."
    - "The medium record lands FIRST and the brush bag LAST at every seam that lands a bag-carrying brush: a cross-group pick, a Brush-tool crossing/repair and a Medium-dropdown pick all end on the bag's values (never the record's dry 70 / feather 85), while a pick of a preset with no bag writes no params at all."
    - "Pen runs the per-bristle engine (`isBristleResponse` is true for `pen`), because Pickup and Feather are bristle-only bindings; its tip is procedural and crisp, so it composes with the gather exactly like an untextured Gouache stroke."
    - "A staying Brush-tool press whose medium label already agrees still writes nothing (MED-13): the bag reload is gated by the SAME condition as the medium repair, and every setter stays compare-then-write."
    - "`applyAquarelleBrushDefaults` never writes `lift` and never adds a key: the live bag keeps exactly its sixteen canonical keys (fourteen medium keys plus size and lift)."
  artifacts:
    - packages/efx-watercolor/src/playground/brushes.ts
    - packages/efx-watercolor/src/playground/brushes.test.ts
    - app/src/components/physic-paint/view/aquarelleRecordState.ts
    - app/src/components/physic-paint/view/aquarellePaintControls.ts
    - app/src/components/physic-paint/view/aquarelleBrushDefaults.test.ts
    - app/src/components/physic-paint/PhysicsPaintStudio.tsx
  key_links:
    - from: packages/efx-watercolor/src/playground/brushes.ts
      to: app/src/components/physic-paint/view/aquarelleRecordState.ts
      via: "BrushPreset.defaults — the preset table is the ONLY authority for the five/six landing values; the store holds no hardcoded brush numbers"
    - from: app/src/components/physic-paint/view/aquarelleRecordState.ts
      to: app/src/components/physic-paint/view/aquarellePaintControls.ts
      via: "applyAquarelleBrushDefaults(presetId) is called LAST — after applyAquarelleMedium — at pickAquarelleBrush, selectAquarellePaintTool's brush branch and pickAquarelleMedium, so the bag always wins"
    - from: app/src/components/physic-paint/view/aquarelleRecordState.ts
      to: app/src/components/physic-paint/PhysicsPaintStudio.tsx
      via: "registerAquarelleBrushDefaultsColorSink(handleActiveColorChanged) — the Pen colour lands through the Studio's ONE compare-then-write colour setter (settings.color), inside a useEffect that returns the unregister"
    - from: app/src/components/physic-paint/view/aquarelleRecordState.ts
      to: app/src/components/physic-paint/PhysicsPaintStudio.tsx
      via: "aquarellePaintCanonicalFromPx(sizePx) reads the working height set by the Studio's existing working-height effect — the one-shot landing runs after that height is real"
    - from: packages/efx-watercolor/src/playground/brushes.ts
      to: packages/efx-watercolor/src/playground/Engine.ts
      via: "isBristleResponse(this.brush) — the Engine already asks the predicate; accepting `pen` needs NO Engine edit, and the engine-source negative pin (`'bristle-round'` absent) stays green"
---

<objective>
Give the two acrylic (displayed Gouache) responses their own landing values, and add the new Pen response.

A. **Gouache (`bristle-round`, id unchanged):** every pick lands Brush size 40 px, Pigment 100, Pickup 100, Dry speed 0, Feather 100.

B. **Pen (NEW response, id `pen`, displayed "Pen"):** every pick lands Brush size 10 px, live pigment #373633, Pigment 100, Pickup 0, Dry speed 0, Feather 85. Pen joins the acrylic group so it lists in the Gouache section directly after Gouache.

C. **Per-brush defaults are applied on EVERY pick** (the locked user decision): each brush owns its settings bag, picking it overwrites whatever sliders were live, and the two brushes stay distinct. The bag lives on the preset table as a compile-time-only `defaults` field (the `group` / `pressureLink` / `speedLink` precedent): no serializer, no `.mce` field, no Rust mirror, no migration — these are UI landing values only.

D. **Ordering law:** the medium record is applied first, the brush bag last, at every seam that lands a bag-carrying brush (`pickAquarelleBrush`, `selectAquarellePaintTool`'s brush branch, `pickAquarelleMedium`), plus one fresh-session landing after the first real working-height report so the px conversion is exact.

E. **Pen runs the bristle engine:** Pickup (bristle carrier rate + gather smear) and Feather (gather coverage band) are bristle-only bindings; a non-bristle Pen would render two specified rows dead. `isBristleResponse` accepts `pen`; the Engine needs no change.

Purpose: the default brush the Studio opens on must actually carry the values the artist specified, and the new Pen must be a distinct, first-class response in the Gouache family rather than a watercolor preset wearing acrylic labels.

Output: the extended package preset table with pinned bags, the store's `applyAquarelleBrushDefaults` + colour sink, the bag-last ordering at all three seams, the Studio registration and one-shot landing, retargeted pins that keep their intent, the new `aquarelleBrushDefaults.test.ts`, and green package (suite + check + build) and app (targeted suites + full suite + tsc) gates.

Explicit decisions:
- **Reset is unchanged.** Reset still restores the ACTIVE MEDIUM RECORD through `AquarelleGlobalsPanel`'s existing active-record law (it never writes `size` or `lift`). It does not reload a brush bag; the next brush pick or a Studio (re)mount does. Do not extend Reset.
- **No schema push.** No serializer, `.mce` field, SQL/Rust mirror or migration is added, so there is no schema-push checkpoint.
- **No Engine, mediums.ts, brushBridge.ts, TIP_TO_PRESET or maskRegistry edit.** The acrylic medium record keeps its exact numbers (water 26, load 100, flow 60, bleed 22, dry 70, edge 65, granulation 25, viscosity 90, body 100, emboss 3, feather 85, pickup 100, refill 0, wetSeconds 12); Pen inherits it for every key its bag does not name.
</objective>

<execution_context>
@/Users/lmarques/Dev/efx-motion-editor/.claude/gsd-core/workflows/execute-plan.md
@/Users/lmarques/Dev/efx-motion-editor/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@CLAUDE.md

Skills to load before implementing: `efx-studio-paint` (the paint laws — this quick changes only the preset table, the live landing values and the pick ordering; no compositing law, no stroke replay, no capture merge) and `efx-preact-reactivity` (the store, the seams and the Studio are Preact + signals: compare-then-write setters, `.peek()` reads in handlers, narrow signal reads, no render-body signal writes) and `spike-findings-efx-motion-editor` (engine determinism contracts).

Sources of truth:
- `packages/efx-watercolor/src/playground/brushes.ts` — `BrushPreset` (compile-time fields at lines 63-91), `isBristleResponse` (264-282), the table (342-456, `bristle-round` last at 448-455), the `soft` helper (213).
- `packages/efx-watercolor/src/playground/mediums.ts` — the acrylic record (114-142) and `DEFAULT_MEDIUM_ID = 'watercolor'` (60).
- `app/src/components/physic-paint/view/aquarelleRecordState.ts` — `applyAquarelleMedium` (234-248), `selectAquarellePaintTool` (615-652), `pickAquarelleMedium` (664-672), `selectAquarelleTip` (699-742), `aquarelleWorkingHeight` (380-386), `aquarellePaintFullPressureSize` (834-837), `aquarellePaintCanonicalFromPx` (855-861), the sink precedent in `app/src/components/physic-paint/roto/aquarelleLiftPreview.ts` (56-62).
- `app/src/components/physic-paint/view/aquarellePaintControls.ts` — `pickAquarelleBrush` (82-95): select the tip, apply the medium only when the SELECTED MEDIUM differs from the incoming group, then commit the selection patch.
- `app/src/components/physic-paint/PhysicsPaintStudio.tsx` — the working-height effect (1852-1859), `handleActiveColorChanged` (2728-2730, `useCallback`, compare-then-write `setSettings`), the store import block (247-272).

Anchor discrepancies found while planning (account for them; do not "fix" adjacent code):

- **The visible Brush size is PX, so the bag stores `sizePx`.** The top bar renders `PAINT_SIZE_MIN_PX`..`PAINT_SIZE_MAX_PX` (1..512) and converts with `aquarellePaintCanonicalFromPx`. `aquarelleParams.size` is canonical (32 = engine scale 1) and the 32..80 band is non-injective: storing a canonical 40 would display ~259 px. The bag therefore carries `sizePx: 40` / `sizePx: 10` and converts at application time with `aquarellePaintCanonicalFromPx` (reading the ACTIVE response, so the landed px matches the visible slider by construction). Do not round the canonical.
- **The bag must be applied at the TERMINAL seams, never inside `selectAquarelleTip`.** `selectAquarelleTip` has no view callers outside the store and `pickAquarelleBrush` (verified), and the seams apply the medium AFTER calling it, so a bag applied inside the tip pick would be clobbered by the record on a cross-group pick and would force a second write. `selectAquarelleTip` resolves a re-pick through an early return (`currentId === nextId`), but a re-pick of a brush always travels through `pickAquarelleBrush`, which applies the bag unconditionally — so "a pick is a pick" still holds.
- **`DEFAULT_MEDIUM_ID` (package) is `watercolor`; the store's `INITIAL_MEDIUM_ID` is `acrylic`.** Test resets differ accordingly (see `brushGroupMedium.test.ts`'s `resetState`), so a pick of `bristle-round` in a freshly reset test CROSSES groups.
- **The acrylic group gains a second member.** `pickAquarelleMedium('acrylic')` and a crossing Brush press land the group's FIRST preset, which stays `bristle-round` because Pen APPENDS after it; `firstBrushPresetForTool('brush')` sorts stably by group order only, so it stays `bristle-round`. Keep the append order.
- **`'pen'` collides with nothing (verified).** `'pen'` is an existing TOOL id (`AquarelleTool`), but preset ids and tool ids are separate namespaces: `findTip('pen')` is undefined (every TIPS id is `wc/*`), `TIP_TO_PRESET` has no `pen` key, `maskRegistry` holds texture ids only, and `selectAquarelleTip('pen')` sets the tool to `brush` through `paintToolForTip`. No code path compares a preset id to a tool id. The UI therefore shows a Pen TOOL (rail) and a Pen RESPONSE (Gouache section) side by side — intended, and the display name stays "Pen".
- **Pen must be a bristle response.** `Engine.ts` gates the per-bristle path on `isBristleResponse(this.brush)` and the engine-source test negatively pins the literal `'bristle-round'` inside `Engine.ts` (it must stay centralized) — so extend the predicate in `brushes.ts` and leave `Engine.ts` untouched.
- **`buildBrush` spreads `...rest`, so `defaults` rides into the built `Brush` object like `group`/`pressureLink`/`speedLink` today.** That is the accepted compile-time-only precedent: nothing serializes it, and stroke payloads carry only the response id and the multiplier bag.
- **The Studio effect order matters.** The sink-registration effect must be declared AFTER `handleActiveColorChanged` (its deps array evaluates the const; earlier would throw a TDZ error). The one-shot landing effect must be declared AFTER the sink effect, so the colour path is registered before any default-brush colour is applied (Gouache has none today; the ordering is for robustness).
- **Which pins legitimately move** (the executor must retarget ONLY these): the cross-group pick's params-write count becomes 2 (record + bag); the four bag keys no longer equal the acrylic record after a Gouache landing (dry 0 vs 70, feather 100 vs 85; load/pickup stay 100); a bag-carrying pick owns `size` (the MEDIUM still never resizes — re-prove that with a medium-only call); the acrylic dropdown click becomes 2 params writes and feather 100; `PRESET_IDS` gains `pen`; the acrylic section count becomes 2; the popover's Brush list becomes `['bristle-round', 'pen']`; the package's pressureLink/speedLink "only the one" pins become two. Everything else (the watercolor same-group "writes nothing" case, the unknown-id refusal, the texture orthogonality, the staying-press MED-13 case, the Reset rows, `mediumSelection.test.ts`, `dryMedia.test.ts`) stays green untouched.

Assumption deltas:
- "Size 40 / 10" is PX on the visible Brush size control (1..512), not canonical engine units (canonical 40 would display ~259 px).
- Pigment / Pickup / Dry speed / Feather use the medium-record 0..100 scale (the params bag's own scale), not 0..1.
- "Default colour #373633" targets the Studio's live pigment (`settings.color`, written only by `handleActiveColorChanged`), not `paintStore.brushColor` (a different, unwired app-level writer).
- Per-brush defaults are LIVE LANDING VALUES only: no document-format change and no persisted preference.

Non-goals: Reset behavior (unchanged, medium-record-driven); any Engine/mediums/brushBridge/maskRegistry edit; any new dependency; any serializer or migration; any change to recorded strokes (a pick never edits an already-recorded stroke's params).
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Package preset table — the `defaults` bag, the new Pen response, the bristle predicate</name>
  <files>
    packages/efx-watercolor/src/playground/brushes.ts,
    packages/efx-watercolor/src/playground/brushes.test.ts
  </files>
  <behavior>
    RED first: rewrite `brushes.test.ts` to the truth below and confirm it fails against the current table before any production edit. Then land the changes and re-run to GREEN.

    `brushes.test.ts` — per-block dispositions (line numbers are the CURRENT anchors):
    - line 71-84 `CLASSIFICATION`: add `pen: 'acrylic'` after `'bristle-round'`.
    - line 200: `expect(seen.size).toBe(12)` becomes `13`.
    - line 103 `NEW_IDS` becomes `['bristle-round', 'pen']`; retitle the block "appends the two new ids after the legacy table" (line 209).
    - line 136-151 `NEW_PRESETS`: ADD a `pen` entry — name `'Pen'`, group `'acrylic'`, overrides `{ water: 0.06, spacing: 0.12 }` (every other BASE field inherited). The existing per-field loop then checks Pen against BASE.
    - line 219-222 section members: the acrylic list becomes `['bristle-round', 'pen']`.
    - line 264-273 "builds a byte-identical tip for the one bristle preset": loop over `['bristle-round', 'pen']`; retitle "the bristle-engine presets". Both must build deterministically and carry a non-empty tip.
    - line 286-295: the accept loop becomes `['bristle-round', 'pen']` (with/without `textureId`); retitle "accepts exactly the bristle-engine ids". The refusal block (297-307) stays verbatim.
    - line 319-323 and 351-355: the pressureLink/speedLink "only the one acrylic response" filters become `['bristle-round', 'pen']`; assert `pen` carries `0` for both; retitle to "only the acrylic responses".
    - line 325-328 and 357-363: add the pen-carries-the-link rows; the non-acrylic `'round'` rows stay.
    - ADD one describe "the per-brush defaults bags (quick 261124-tje)" pinning, literally: `bristle-round.defaults` equals `{ sizePx: 40, load: 100, pickup: 100, dry: 0, feather: 100 }` with NO `color` key; `pen.defaults` equals `{ sizePx: 10, color: '#373633', load: 100, pickup: 0, dry: 0, feather: 85 }`; every other preset has `defaults` undefined; `buildBrush(preset)` carries the same `defaults` reference (the `group` precedent — compile-time-only, no serializer).
  </behavior>
  <action>
    In `packages/efx-watercolor/src/playground/brushes.ts`:

    1. Add an exported `BrushDefaults` interface before `BrushPreset`: optional `sizePx` (the visible Brush size diameter in px, 1..512), `load`, `pickup`, `dry`, `feather` (the medium-scale 0..100 landing values) and `color` (`'#rrggbb'`). Its doc comment must state: COMPILE-TIME ONLY like `group` / `pressureLink` / `speedLink` — UI landing values applied by the app store on a pick; no serializer, no `.mce` field, no Rust mirror; a stroke persists the response id.
    2. Add `defaults?: BrushDefaults` to `BrushPreset` right after `speedLink` and before `custom`, with the same compile-time-only doc contract.
    3. On the existing `bristle-round` entry (name `'Gouache'`): add `defaults: { sizePx: 40, load: 100, pickup: 100, dry: 0, feather: 100 }`. Change NOTHING else on the entry (aspect, rotation, water, load, capacity, grain, roughness, spacing, group, pressureLink, speedLink, tip all stay byte-identical).
    4. APPEND a new entry immediately AFTER `bristle-round` (first acrylic preset must stay `bristle-round`): `id: 'pen'`, `name: 'Pen'`, a one-line hint in the shipped grammar (no trailing period, e.g. "Fine springy round: crisp edge, no pickup"), `group: 'acrylic'`, `pressureLink: 0`, `speedLink: 0`, `water: 0.06`, `spacing: 0.12`, `defaults: { sizePx: 10, color: '#373633', load: 100, pickup: 0, dry: 0, feather: 85 }`, and a procedural crisp round tip: `n => tip((_u, _v, r) => soft(r, 0.85))(n)`. Leave every other field inheriting `BASE` (aspect 1, rotation fixed, size band, pressureSize 1, grain 0, roughness 0, wetRound 0.6, stampJitter 0). Do NOT state `custom`.
    5. Extend `isBristleResponse` to `return b.id === 'bristle-round' || b.id === 'pen';` and update its doc comment: quick 261124-tje — Pen runs the per-bristle engine because Pickup and Feather are bristle-only bindings (its procedural tip composes with the gather through `tipMask`, exactly like an untextured Gouache stroke). Keep the history note about the retired flat sibling and the D-27 revision.

    Do NOT edit `mediums.ts`, `brushBridge.ts`, `Engine.ts`, `maskRegistry.ts` or any other package source. Do NOT edit `dryMedia.test.ts`, `brushBridge.test.ts`, `maskRegistry.test.ts`, `engineTraceSpacing.test.ts` or `engineStartDwell.test.ts` — Pen inherits roughness 0 and stampJitter 0, its id has no TIP_TO_PRESET/maskRegistry entry, and the engine literally calls the predicate, so all four stay green untouched.
  </action>
  <verify>
    <automated>pnpm --dir packages/efx-watercolor exec vitest run src/playground/brushes.test.ts</automated>
    <automated>pnpm --dir packages/efx-watercolor exec vitest run</automated>
    <automated>pnpm --dir packages/efx-watercolor run check</automated>
    <automated>pnpm --dir packages/efx-watercolor run build</automated>
  </verify>
  <done>
    `brushes.ts` exports `BrushDefaults`, `BRUSH_PRESETS` has exactly 13 entries in shipped order with `bristle-round` then `pen` last, both bags are pinned literally in `brushes.test.ts`, `isBristleResponse` accepts `pen` (and still refuses round/flat/chalk/bristle-flat), the full package suite and `run check` are green, and the package `dist` is freshly built so the app typecheck will see the new field.
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Store landing function + colour sink + the bag-last ordering, with the app pins retargeted</name>
  <files>
    app/src/components/physic-paint/view/aquarelleRecordState.ts,
    app/src/components/physic-paint/view/aquarellePaintControls.ts,
    app/src/components/physic-paint/view/brushGroupMedium.test.ts,
    app/src/components/physic-paint/view/aquarellePaintControls.test.ts,
    app/src/components/physic-paint/view/aquarelleToolFamily.test.ts,
    app/src/components/physic-paint/view/AquarelleGlobalsPanel.test.ts,
    app/src/components/physic-paint/view/aquarellePresetSelection.test.ts,
    app/src/components/physic-paint/view/brushGroups.test.ts,
    app/src/components/physic-paint/view/PhysicsPaintBrushMenu.test.ts
  </files>
  <behavior>
    RED first for the new behavior where feasible: add the new assertions below, run the seven suites, and confirm the expected failures (missing export / record-equals-bag pins / count pins). The pure retargets (counts and literals that only move) can land with the production change, but every retargeted pin must fail against the OLD behavior or be a documented literal move (size/count/id-list), never an untested relaxation.

    `brushGroupMedium.test.ts` — per-block dispositions:
    - line 186-207 cross-group pick of `bristle-round`: params-write count becomes `2` with the comment "the record is one spread assignment, the brush bag a second". Keep `ids.count() === 1`, the medium id, and the one selection patch. Replace the "all fourteen keys equal the record" loop with: the four bag keys (`load`, `pickup`, `dry`, `feather`) equal the brush bag (100/100/0/100) and the other ten medium keys equal the record.
    - line 231-246 "restores the watercolor record when the pick returns to its group": `dry` after the Gouache pick is `0`. Replace the `size === 77` expectation with: `size` equals the Gouache bag's px conversion (capture it as `const bagSize = aquarelleParams.value.size`), then prove the MEDIUM law separately by calling `applyAquarelleMedium('watercolor')` and asserting `size` is unchanged (`bagSize`) and `lift` stays 33.
    - line 248-263 "writes nothing when the dropdown already selected the pick group": bag count becomes `1`; retitle "lands only the brush bag when the record is already applied"; the reference-untouched assertion becomes: the ten non-bag medium keys equal the record, `dry` is 0, `feather` is 100, and the medium id does not move.
    - line 265-286: unchanged (the committed patch is still exactly `{ brushId, toolOverrides }` and the stroke is untouched).
    - line 288-299 "keeps size and lift": lift stays 31; `size` becomes the Gouache bag value (pin it via the px conversion), and add one medium-only call to prove `applyAquarelleMedium('acrylic')` alone leaves `size` untouched. Retitle "the medium never resizes or moves lift; the brush bag owns size".
    - line 329-355 "moves the selected medium id and the fourteen globals": the ten non-bag keys equal the record; the four bag keys equal the bag; `size` equals the bag conversion; `lift` stays 27; the sixteen-key shape assertion stays.
    - ADD one row: a cross-group pick of `pen` (from the watercolor reset state) lands medium `acrylic`, exactly one selection patch, one record write plus one bag write, and the pen bag values — size via `aquarellePaintCanonicalFromPx(10)`, load 100, pickup 0, dry 0, feather 85.
    - Unchanged: the same-group watercolor "writes nothing" row (neither round nor flat carries a bag), the unknown-id row, the invariant rows, the texture row, and the whole seam audit.

    `aquarellePaintControls.test.ts` — line 246-257: retitle "a same-group acrylic pick lands the brush bag, never the record"; keep medium id unchanged and `refill === 0`; assert the params reference CHANGED and the bag landed (`dry` 0, `feather` 100); state in the comment that a same-group pick writes no record.

    `aquarelleToolFamily.test.ts` — add a helper `expectBrushBagApplied()` (the four bag keys against the `bristle-round` bag) and change the four `expectRecordApplied('acrylic')` call sites that follow a Brush medium apply/repair/cross (after lines 159, 206, 231, 241) to a record-minus-bag check (ten keys) plus the bag check. Line 162 `feather` becomes `100` (bag), and add `dry === 0`; body/viscosity/water/wetSeconds stay 100/90/26/12. The line 209-219 staying-press MED-13 row must stay green untouched. ADD one row: a second Brush press on the already-active Brush tool with `bristle-round` selected and `acrylic` applied writes no signal at all (extend the "writes no signal" test to a Brush press).

    `AquarelleGlobalsPanel.test.ts` — line 530-545 acrylic dropdown click: the params-write count becomes `2` ("the record is one spread assignment, the brush bag a second"); water 26 / body 100 stay. Line 561-574: `feather` becomes `100` (the bag wins); add `dry === 0`; body/viscosity/water/wetSeconds stay. Do NOT touch any Reset row (696-782): Reset stays medium-record-driven and its write count is unchanged.

    `aquarellePresetSelection.test.ts` — header comment "twelve" becomes "thirteen"; line 60-74 `PRESET_IDS` gains `'pen'` after `'bristle-round'`; in the tool-flip row (108-121) add `selectAquarelleTip('pen')` lands the `brush` family.

    `brushGroups.test.ts` — line 173 `EXPECTED_COUNTS` becomes `[11, 2]`; update the file header's "twelve" if it claims a count. Nothing else (the member lists come from `brushSections(BRUSH_PRESETS)`).

    `PhysicsPaintBrushMenu.test.ts` — line 48-49: the Brush branch becomes `['bristle-round', 'pen']`; update the comment (the Gouache group now has two members). The utility-tools loop stays (it reads the shipped table).
  </behavior>
  <action>
    Production changes:
    - `aquarelleRecordState.ts`: add `applyAquarelleBrushDefaults(presetId: string | null): void`. Resolve the preset in `BRUSH_PRESETS`; no preset or no `defaults` is a TOTAL no-op (no signal write, no sink call). Build a partial: `size` from `aquarellePaintCanonicalFromPx(defaults.sizePx)` when `sizePx` is defined; `load`, `pickup`, `dry`, `feather` when defined. Compare-then-write ONE spread on `aquarelleParams` only if a key differs. Never write `lift`; never add a key. If `defaults.color` is defined, call the registered colour sink. Doc comment: the medium record lands first, the bag last; the bag is a UI landing value set (compile-time table, no serializer).
    - `aquarelleRecordState.ts`: add the sink — `AquarelleBrushDefaultsColorSink` type, a module-level nullable sink, and `registerAquarelleBrushDefaultsColorSink(sink)` mirroring `registerAquarelleLiftPreviewSink` exactly (last registration wins; the returned unregister clears only if it is still the registered sink).
    - `aquarelleRecordState.ts` `selectAquarellePaintTool` brush branch: inside the SAME `if` that calls `applyAquarelleMedium(group)` (the crossing-or-disagreeing condition), call `applyAquarelleBrushDefaults(aquarelleSelectedTipId.value)` AFTER the medium. A staying press whose label agrees must still write nothing.
    - `aquarelleRecordState.ts` `pickAquarelleMedium`: after `applyAquarelleMedium(record.id)`, call `applyAquarelleBrushDefaults(aquarelleSelectedTipId.value)`.
    - `aquarellePaintControls.ts` `pickAquarelleBrush`: after the conditional `applyAquarelleMedium(incomingGroup)` and BEFORE the selection commit, call `applyAquarelleBrushDefaults(presetId)` unconditionally (a pick of a bagless preset is a no-op). Update the ordering doc comment: tip → record → bag → commit.
  </action>
  <verify>
    <automated>pnpm --dir app exec vitest run src/components/physic-paint/view/brushGroupMedium.test.ts src/components/physic-paint/view/aquarelleToolFamily.test.ts src/components/physic-paint/view/aquarellePaintControls.test.ts src/components/physic-paint/view/AquarelleGlobalsPanel.test.ts src/components/physic-paint/view/aquarellePresetSelection.test.ts src/components/physic-paint/view/brushGroups.test.ts src/components/physic-paint/view/PhysicsPaintBrushMenu.test.ts src/components/physic-paint/view/brushToolFamily.test.ts src/components/physic-paint/view/mediumSelection.test.ts</automated>
    <automated>pnpm --dir app exec tsc --noEmit</automated>
  </verify>
  <done>
    `applyAquarelleBrushDefaults` exists and is a no-op for bagless/unknown ids; it writes only `size`, `load`, `pickup`, `dry`, `feather` in ONE compare-then-write spread and calls the registered colour sink only when the bag names a colour. The bag lands LAST at `pickAquarelleBrush`, the Brush-tool crossing/repair branch and `pickAquarelleMedium`. The nine targeted suites and the app typecheck are green; `brushToolFamily.test.ts` needed no edit and still pins `bristle-round` as the Brush landing.
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 3: Studio sink registration + fresh-session landing, and the new pin suite</name>
  <files>
    app/src/components/physic-paint/PhysicsPaintStudio.tsx,
    app/src/components/physic-paint/view/aquarelleBrushDefaults.test.ts
  </files>
  <behavior>
    RED first: create `aquarelleBrushDefaults.test.ts` (a `.test.ts` — Vitest collects nothing else here) with the rows below; confirm it fails (the store export exists after Task 2, so the RED evidence is the Studio source-scan rows and the colour-sink rows).

    New suite `app/src/components/physic-paint/view/aquarelleBrushDefaults.test.ts` (node env, no DOM), reset helper mirroring `brushGroupMedium.test.ts`'s: `resetAquarelleRecordState()`, `aquarelleParams.value = { ...DEFAULT_AQUARELLE_PARAMS }`, `aquarelleSelectedMediumId.value = 'acrylic'`, `aquarelleSelectedTipId.value = 'bristle-round'`, `aquarelleToolOverrides.value = { ...NEUTRAL_TOOL_OVERRIDES }`, `aquarelleWorkingHeight.value = 1080`, unregister any fake sink in `afterEach`.
    - `applyAquarelleBrushDefaults('bristle-round')` lands exactly one `aquarelleParams` write; `size` equals `aquarellePaintCanonicalFromPx(40)`; load 100, pickup 100, dry 0, feather 100; `lift` untouched; every other medium key untouched; a second call writes nothing (subset comparison, not reference equality).
    - `applyAquarelleBrushDefaults('pen')` lands size `aquarellePaintCanonicalFromPx(10)`, load 100, pickup 0, dry 0, feather 85; with a registered fake sink it receives exactly `'#373633'` once; a Gouache application calls the sink zero times.
    - Sink lifecycle: the returned unregister stops delivery; a second registration replaces the first and the first unregister does not clear the second (the lift-preview contract).
    - `applyAquarelleBrushDefaults('round')` and an unknown id are total no-ops (zero writes, no sink call).
    - Order law: `applyAquarelleMedium('acrylic')` then `applyAquarelleBrushDefaults('bristle-round')` ends on the bag's four keys; `applyAquarelleMedium('acrylic')` alone still ends on the record's dry 70 / feather 85.
    - Contract: `snapshotAquarelleRecord()` and `buildAquarelleStrokePayload()` expose no `defaults` property (compile-time-only bag).
    - Source scans over `PhysicsPaintStudio.tsx` (strip comments first): contains `registerAquarelleBrushDefaultsColorSink(handleActiveColorChanged)`; the containing `useEffect` deps array includes `handleActiveColorChanged`; contains `applyAquarelleBrushDefaults(` exactly once, inside the working-height effect region, guarded by a ref named `brushDefaultsLandedRef` and a `canvasHeight` positive guard. Seam audit (stripped sources, `filesMatching`): `applyAquarelleBrushDefaults(` appears in exactly `aquarelleRecordState.ts`, `aquarellePaintControls.ts` and `PhysicsPaintStudio.tsx`; `countOf` is 3 / 1 / 1.
  </behavior>
  <action>
    In `app/src/components/physic-paint/PhysicsPaintStudio.tsx`:
    1. Extend the store import block (247-272) with `applyAquarelleBrushDefaults`, `aquarelleSelectedTipId` and `registerAquarelleBrushDefaultsColorSink`.
    2. Declare a `const brushDefaultsLandedRef = useRef(false);` near the other refs (never a `useState` — Preact signals only).
    3. Immediately AFTER the `handleActiveColorChanged` declaration (2728-2730), add the sink registration: `useEffect(() => registerAquarelleBrushDefaultsColorSink(handleActiveColorChanged), [handleActiveColorChanged]);` — returning the unregister as the cleanup, exactly like `AquarelleCachedBaseLayer`'s lift-preview effect.
    4. Immediately after that effect, add the one-shot landing effect: deps `[canvasHeight]`; return early when the ref is already true or `canvasHeight <= 0`; set the ref true; call `applyAquarelleBrushDefaults(aquarelleSelectedTipId.value)`. Comment: a fresh Studio opens on the default brush's bag; the working height is real here, so the px conversion matches the visible Brush size control; the ref makes it one-shot across canvas resizes; the bag is a landing value set, never persisted.
    Do NOT reorder the existing working-height effect (1857-1859) and do NOT write any signal from a render body. Never modify `handleActiveColorChanged` (it is already compare-then-write and remains the ONLY colour setter).

    Create the new suite as described in `<behavior>`. Do not weaken or delete any existing `PhysicsPaintStudio.test.ts` row; run it as a regression gate.
  </action>
  <verify>
    <automated>pnpm --dir app exec vitest run src/components/physic-paint/view/aquarelleBrushDefaults.test.ts</automated>
    <automated>pnpm --dir app exec vitest run src/components/physic-paint/PhysicsPaintStudio.test.ts</automated>
    <automated>pnpm --dir packages/efx-watercolor run build</automated>
    <automated>pnpm --dir app exec vitest run</automated>
    <automated>pnpm --dir app exec tsc --noEmit</automated>
  </verify>
  <done>
    The Studio registers `handleActiveColorChanged` as the brush-defaults colour sink inside an effect that returns the unregister, and lands the active brush's bag once, after the first positive working-height report. The new suite pins the bag values, the sink lifecycle, the no-op paths, the order law, the no-`defaults`-in-payload contract and the Studio source shape. The full app suite, the Studio suite and the app typecheck are green on a freshly built package.
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| none | This quick edits a local, offline preset table plus client-side live landing values. No network, credential, IPC, filesystem (other than the package build output), document-format or user-input boundary is crossed, and no new dependency is added (no package-legitimacy checkpoint). |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-tje-01 | Tampering | `applyAquarelleBrushDefaults` size/key writes into `aquarelleParams` | medium | mitigate | The preset is resolved from the compile-time `BRUSH_PRESETS` table; an unknown id or a preset without `defaults` is a total no-op, and only finite numeric literals from the table can reach `size`/`load`/`pickup`/`dry`/`feather`. No user- or document-supplied value enters this path, and `lift`/unknown keys are never written (pinned in the new suite). |
| T-tje-02 | Denial of service | Studio one-shot landing effect | low | mitigate | A `useRef` one-shot plus a `canvasHeight > 0` guard; the effect deps are `[canvasHeight]` only and the effect writes signals the effect does not depend on, so it cannot loop. Every store setter is compare-then-write. |
| T-tje-03 | Information disclosure | Colour sink → `settings.color` | low | accept | The value is a hex literal in the preset table; the sink only forwards to the Studio's existing compare-then-write colour setter. No user, credential or document data is read or written. |
| T-tje-04 | Tampering | `isBristleResponse` now accepts `pen` | low | mitigate | The predicate is compile-time and the Engine only changes behavior for the exact id `pen`; the engine-source test that pins the absence of a `'bristle-round'` literal in `Engine.ts` stays green (no Engine edit). |
| T-tje-SC | Tampering | npm/pip/cargo installs | high | mitigate | No new or changed dependency; no install task, so the package-legitimacy gate is not triggered. |
</threat_model>

<verification>
- **Per-task gates** are the commands above. Never start the dev server or the app; never run Vitest in watch mode (`exec vitest run` only). Vitest collects only `.test.ts` — the new suite must use that extension.
- **Full gates (checkout root, all green before handover, in this order):**
  `pnpm --dir packages/efx-watercolor exec vitest run` (Task 1),
  `pnpm --dir packages/efx-watercolor run check` (Task 1),
  `pnpm --dir packages/efx-watercolor run build` (Task 1, and again before the final app typecheck),
  `pnpm --dir app exec vitest run` (Task 3),
  `pnpm --dir app exec tsc --noEmit` (Task 3).
  The build MUST precede the app typecheck: app tsc resolves the package through `dist/*.d.ts`, while app vitest aliases the package to source.
- **Structural gates (location-specific, never tree-wide; count the exact literal, not lines):**
  `grep -o '^  define({' packages/efx-watercolor/src/playground/brushes.ts | wc -l` — record the baseline and expect 13 (12 at HEAD + the Pen);
  `grep -o 'defaults: {' packages/efx-watercolor/src/playground/brushes.ts | wc -l` — expect 2. Keep the doc comments free of the exact literal `defaults: {` so this gate stays honest; the package pins are the real authority.
- **Untouched-surface audit:**
  `git diff --exit-code -- packages/efx-watercolor/src/playground/mediums.ts packages/efx-watercolor/src/playground/Engine.ts packages/efx-watercolor/src/playground/brushBridge.ts packages/efx-watercolor/src/brushes/maskRegistry.ts` (none of these may change);
  no edit under `.planning/spikes/` or a prior `.planning/quick/` task; do not commit `.planning` artifacts.
- **Live UAT rows (artist-run in the Studio; stay pending — report AUTOMATED-READY only):**
  1. Open the Studio fresh: the default brush is Gouache with Brush size 40, Pigment 100, Pickup 100, Dry speed 0, Feather 100 — and painting shows the same feel a Gouache pick gives.
  2. Pick Pen from the Gouache section: Brush size 10, the pigment swatch/colour shows #373633, Pigment 100, Pickup 0, Dry speed 0, Feather 85; a test stroke draws a crisp fine line with no pickup from the sheet.
  3. Pick Gouache back: all five Gouache values return (Pen's colour is NOT reverted by Gouache — Gouache's bag names no colour — but size/Pigment/Pickup/Dry/Feather are Gouache's).
  4. Twiddle the sliders, then re-pick the same brush: its values reload (a pick is a pick).
  5. Switch Brush → Watercolor → Brush: Gouache lands with its bag (Dry speed 0, Feather 100, size 40 px), not the acrylic record's dry 70 / feather 85.
  6. Pick Pen, then choose Gouache from the Medium dropdown: the landing brush is Gouache with Gouache's bag.
  7. Press Reset in the Gouache context: the acrylic record is restored (dry 70, feather 85); the next Gouache pick reloads the bag. This is the documented behavior, not a bug.
  8. Save and reopen the project: no error, and old strokes render unchanged (no migration, no format change).
</verification>

<success_criteria>
- `bristle-round` (displayed Gouache) carries `defaults` sizePx 40, load 100, pickup 100, dry 0, feather 100; the new `pen` preset is appended after it with sizePx 10, color #373633, load 100, pickup 0, dry 0, feather 85; every other preset has no bag.
- Pen lists in the Gouache (acrylic) section after Gouache; the Brush family's landing brush is still `bristle-round`; the popover, library and docker show both.
- `isBristleResponse` is true for exactly `bristle-round` and `pen`; the Engine, the mediums record, `brushBridge`, `TIP_TO_PRESET` and `maskRegistry` are untouched.
- `applyAquarelleBrushDefaults` applies one compare-then-write spread of at most `size`/`load`/`pickup`/`dry`/`feather` (plus the colour sink), is a total no-op for bagless/unknown ids, never touches `lift`, and lands LAST at `pickAquarelleBrush`, the Brush-tool crossing/repair branch and `pickAquarelleMedium`.
- A fresh Studio mounts and lands Gouache's bag once the working height is real; the session colour is untouched by that landing.
- Every retargeted pin keeps its intent: record-vs-bag separation is asserted explicitly, the medium's "never resizes / never moves lift" law is re-proved with a medium-only call, and the staying-press MED-13 row is unchanged and green.
- The new `aquarelleBrushDefaults.test.ts` pins the bag values, the sink lifecycle, the no-op paths, the order law, the no-`defaults`-in-payload contract and the Studio source shape.
- The full package suite, `run check`, `run build`, the full app suite and the app typecheck are green; Reset behavior, the recorded-stroke contract and the document format are unchanged. The eight UAT rows are handed over as automated-ready and stay pending.
</success_criteria>

<output>
Create `.planning/quick/261124-tje-new-default-brush-and-new-brush-pen-brus/261124-tje-SUMMARY.md` when done (English, per project convention). Do not commit `.planning` artifacts.
</output>
