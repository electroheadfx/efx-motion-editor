---
phase: 261031-qps-task-quick-b-follow-up-to-quick-261031-i
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - app/src/components/physic-paint/roto/aquarelleScriptBaseAuthority.ts
  - app/src/components/physic-paint/roto/aquarelleScriptBaseAuthority.test.ts
  - app/src/components/physic-paint/roto/physicsPaintRotoScriptClipboard.ts
  - app/src/components/physic-paint/roto/physicsPaintRotoScriptClipboard.test.ts
  - app/src/components/physic-paint/roto/physicsPaintRotoRunScriptStacking.ts
  - app/src/components/physic-paint/roto/physicsPaintRotoRunScriptStacking.test.ts
  - app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.ts
  - app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.test.ts
  - app/src/components/physic-paint/PhysicsPaintStudio.tsx
  - app/src/components/physic-paint/PhysicsPaintStudio.test.ts
  - app/src/components/physic-paint/hooks/useRotoPlayScriptController.ts
  - app/src/components/physic-paint/hooks/useRotoPlayScriptController.test.ts
  - app/src/components/physic-paint/view/PhysicsPaintPlayScriptCards.tsx
  - app/src/components/physic-paint/view/PhysicsPaintPlayScriptDialog.tsx
  - app/src/components/physic-paint/view/PhysicsPaintPlayScriptDialog.test.ts
  - app/src/components/physic-paint/view/PhysicsPaintScriptsPanel.test.ts
  - app/src/stores/physicPaintStore.ts
  - app/src/stores/physicPaintStore.test.ts
autonomous: true
requirements: [QUICK-261031-QPS]
user_setup: []

estimate:
  tokens: 82000
  raw_tokens: 68000
  tasks: 3
  confidence: low

must_haves:
  truths:
    - "A pixel-only Paint rail (keyScriptEdits !== true) shows the Keep script switch, defaults it ON, and ON appends this run's strokes to each touched key's recorded script and re-bakes base + recorded events so the original picture survives re-bake, save/reopen and repeat with no doubling; the persisted keyScriptEdits flag is never written."
    - "Keep OFF on a pixel-only Paint rail flattens: the run is composited over each touched key's current picture and nothing is recorded or purged; the rail is never silently replaced or erased."
    - "Every script-target path (create Apply, raster-key edits, Run Script stacking, source occurrences, frame overrides) resolves its durable base through one authority in this order: persisted SNAP v5 durable base of the resolution key (null = known-empty), then the session durable-base map, then - only when that key has no recorded strokes - pin the key's current payload as the pre-script cache, otherwise fail closed with durable-base-unknown and zero writes; freshly pinned bases persist and recovered bases stay session-only."
    - "Source occurrences and frame overrides resolve to the SOURCE key's base, never the occurrence/override composite, and a frame override inside the written span is now legal instead of refused."
    - "A Reveal rail stacks like a Paint rail (playhead membership, extend-only growth, repeat unchanged, collision Cancel/Truncate/Overwrite, one atomic undo); Keep ON records the new strokes, Keep OFF flattens, and any extension is baked through the rail's currently placed photo reference (same photo, new wash); with no placed reference the run refuses with a clear reason and zero writes; plain-paper bytes never land on a reveal frame."
    - "A Reveal stack run exposes Colorize, Photo wiggle and Paint seed as editable cards, hides Rail Type, and adopts the run's values on the rail in the same commit; the placed photo reference itself is never replaced."
    - "No persisted schema or format changes: durable bases, rail metadata and every field Quick B needs already exist; an unprovable base yields a clear refusal and no erase on ordinary/raster, occurrence, override, reopened, flag-on, flag-off and reveal keys."
  artifacts:
    - path: "app/src/components/physic-paint/roto/aquarelleScriptBaseAuthority.ts"
      min_lines: 110
      provides: "Pure durable-base resolution over injected lookups, fail-closed"
    - path: "app/src/components/physic-paint/roto/aquarelleScriptBaseAuthority.test.ts"
      min_lines: 150
      provides: "Full resolution matrix incl. walk order, Dry insensitivity, source-key mapping, reveal kind"
    - path: "app/src/components/physic-paint/PhysicsPaintStudio.tsx"
      provides: "prepareRotoScriptTarget + publish closure consume the authority; raster-key edit path delegates to it; authority-backed stacking port; render-only reveal tail port"
    - path: "app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.ts"
      provides: "Keep 2x2 for pixel-only/reveal, override-in-span legality, reveal stack destination + card seeding + confirm branch"
    - path: "app/src/components/physic-paint/view/PhysicsPaintPlayScriptDialog.tsx"
      provides: "Reveal stack composition (no Rail Type, Colorize/Photo wiggle/Paint seed shown)"
    - path: "app/src/stores/physicPaintStore.ts"
      provides: "Render-only reveal tail bake (no record/break writes)"
  key_links:
    - from: "PhysicsPaintStudio.prepareRotoScriptTargetRef"
      to: "aquarelleScriptBaseAuthority.resolveScriptBase"
      via: "persisted snapshot + session map + payload pin lookups"
    - from: "PhysicsPaintStudio.ensureAquarelleDurableBaseRef"
      to: "aquarelleScriptBaseAuthority.resolveScriptBase"
      via: "strokes-only probe + payload pin, recoverAquarelleDurableBase as the fallback recovery step"
    - from: "PhysicsPaintStudio publish closure"
      to: "durable base dispatch"
      via: "known-empty raw bake / bytes compose / reveal render / durable-base-unknown refusal"
    - from: "controller confirmStack (Keep ON)"
      to: "ports.bakeStackedRailKey"
      via: "authority-resolved base pinned BEFORE the single ports.commit"
    - from: "controller confirmStack (reveal branch)"
      to: "ports.bakeRevealStackTail -> withRecordBytes -> ports.commit"
      via: "full-coverage assertion over the touched reveal frames"
    - from: "controller stackRailKind"
      to: "PhysicsPaintPlayScriptDialog card composition"
      via: "rail kind gating of Rail Type / Color / Key Script vs Colorize / Photo wiggle / Paint seed"
---

<objective>
Complete Run Script stacking, part B: give pixel-only Paint rails a working Keep script switch backed by one durable-base authority, legalize frame overrides inside the written span, and let Reveal rails stack with per-key script recording and photo-reference tail baking.

Purpose: Quick A (`261031-i54`, closed at `f7b0767b7`) shipped stacking for flag-on Paint rails only and refused the rest. Quick B closes the three deferred laws so every rail kind behaves predictably: a script stacked onto an unscripted rail must preserve the original paint forever (re-bake, reopen, repeat), an override in the written span must resolve to its source key instead of being refused, and a Reveal rail must extend through the photo the user placed - not through a re-invented wash.

Output: one new pure authority module plus its test, a rewritten `prepareRotoScriptTarget`/publish base dispatch, the pixel-only Keep 2x2, override-in-span legality, Reveal stacking end to end (destination, cards, render-only tail bake, recording), and updated tests only where Quick B intentionally changes the law.
</objective>

<execution_context>
@/Users/lmarques/Dev/efx-motion-editor/.claude/gsd-core/workflows/execute-plan.md
@/Users/lmarques/Dev/efx-motion-editor/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/quick/261031-qps-task-quick-b-follow-up-to-quick-261031-i/261031-qps-CONTEXT.md
@.planning/quick/261031-qps-task-quick-b-follow-up-to-quick-261031-i/261031-qps-RESEARCH.md
@.planning/quick/261031-i54-run-script-stack-a-script-onto-an-existi/261031-i54-CONTEXT.md
@.planning/quick/261031-i54-run-script-stack-a-script-onto-an-existi/261031-i54-SUMMARY.md
@.claude/skills/efx-preact-reactivity/SKILL.md

Key source anchors (read once, do not re-read):
- `app/src/components/physic-paint/PhysicsPaintStudio.tsx` - publish closure base branches ~1950-2109; `getDurableBases`/`seedDurableBases` ~1266-1283; `prepareRotoScriptTargetRef` ~3346-3470; `railScriptOwnsKey` ~3435-3442; `bakeStackedRailKey`/`composeStackedRailKey`/`recordRailKeyScripts` ~3891-3978; `hasPhotoReference`/photo port ~4032-4036; `ensureAquarelleDurableBaseRef` ~6654-6773.
- `app/src/components/physic-paint/roto/physicsPaintRotoRunScriptStacking.ts` - `RunScriptRailView`, `resolveRunScriptDestination`, `resolveRunScriptStackBoundary` (override refusal ~106-107, ~378-392, ~485-488).
- `app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.ts` - ports ~272-381; validation ~587-633; Keep script ~1041-1080; dialog motion/seed ~1220-1377; confirm dispatch ~1921-1928; `bakeAquarelleScript` ~1936-2025; `confirmReveal` ~2116-2184; `confirmStack` ~2194-2507.
- `app/src/components/physic-paint/roto/physicsPaintRotoScriptClipboard.ts` - `RotoScriptPhysicalTarget` ~40-72 (base-key field to delete), `dispatchApply` ~377.
- `app/src/components/physic-paint/view/aquarelleRecordState.ts` ~1688-1734 - `hasAquarelleScriptForFrame` (strokes only) vs Dry-inclusive `getAquarelleEventsForFrame`.
- `app/src/components/physic-paint/roto/physicsPaintRotoRailKeyScripts.ts` ~55-89 - cumulative progressive slices.
- `app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptRenderer.ts` ~90-269 - exported `renderRotoRevealFrames` (line 101; mask composite + anchors) and its module-private aquarelle helper (line 129). Import the exported entry only; build its `script` from aquarelle events.
- `app/src/stores/physicPaintStore.ts` ~1946-2144 - `_resolveReferenceSourceImage`, `commitRevealBake` reference walk.
- `app/src/stores/efxPaintStore.ts` ~1520-1810 - `createRevealRail`, `replayRevealRail`.
- `app/src/components/physic-paint/view/PhysicsPaintPlayScriptCards.tsx` ~135-362 and `PhysicsPaintPlayScriptDialog.tsx` ~58-168, ~270-450 - card composition.

Test pins that Quick B intentionally changes (update only these): `physicsPaintRotoPlayScriptController.test.ts` ~4377-4402 (pixel-only Keep OFF+disabled), ~4662/~5260/~5263 (override refusal), ~3834-3842 (reveal creation `keyScriptEdits: false`); `physicsPaintRotoRunScriptStacking.test.ts` ~137/~222-226/~506/~783-790 (reveal + override refusals); `PhysicsPaintPlayScriptDialog.test.ts` ~1612/~1667-1688/~1735/~1813 (keep reason, override refusal), ~1419-1497 (Reveal has no Key Script card); `physicsPaintRotoScriptClipboard.test.ts` ~1619-1660 and `PhysicsPaintStudio.test.ts` ~4453/~4461/~4472/~4889/~4896/~4901/~4903/~5071 (base-key source pins).
</context>

<tasks>

<!-- planner-discipline-allow: durableBaseKeyId -->
<task type="tdd">
  <name>Task 1: Durable-base authority module + script-path rewiring (prepare/publish, raster-key edits) + frame-override legality</name>
  <files>app/src/components/physic-paint/roto/aquarelleScriptBaseAuthority.ts, app/src/components/physic-paint/roto/aquarelleScriptBaseAuthority.test.ts, app/src/components/physic-paint/PhysicsPaintStudio.tsx, app/src/components/physic-paint/roto/physicsPaintRotoScriptClipboard.ts, app/src/components/physic-paint/roto/physicsPaintRotoRunScriptStacking.ts, app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.ts, app/src/components/physic-paint/PhysicsPaintStudio.test.ts, app/src/components/physic-paint/roto/physicsPaintRotoScriptClipboard.test.ts, app/src/components/physic-paint/roto/physicsPaintRotoRunScriptStacking.test.ts, app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.test.ts, app/src/components/physic-paint/view/PhysicsPaintPlayScriptDialog.test.ts</files>
  <behavior>
    - resolveScriptBase returns persisted base when the SNAP v5 durable base for the resolution key is present: null payload yields kind 'known-empty', bytes yield kind 'bytes', and neither consults the session map or the payload.
    - Session durable base is used when no persisted entry exists for the key (recovered bases stay session-only and never claim a persist pin).
    - When neither store has an entry and the resolution key has NO recorded strokes (hasAquarelleScriptForFrame is false on that key's own canonical frame), the current payload becomes the base with persistPin true; an absent payload yields known-empty with persistPin true.
    - When neither store has an entry and the key HAS recorded strokes, the result is { ok: false, reason: 'durable-base-unknown' } - the payload is never used.
    - The probe is Dry-insensitive: a frame whose only aquarelle event is a global Dry event still counts as "no recorded strokes" and takes the pin path.
    - An occurrence or override target passes the SOURCE key id; the authority never receives the composite id, so a composite payload can never become a base.
    - The raster-key edit path resolves through the same authority: a key with no recorded strokes (a Dry-only timeline still counts as no strokes) adopts its payload as the pre-script base and persists it without a recovery bake; a key with recorded strokes and no proven base still runs recoverAquarelleDurableBase as the recovery step; a failed recovery leaves the base unknown so the publish refuses.
    - A reveal-owned resolution key returns kind 'reveal' regardless of stores - never a pixel base, never known-empty, never a refusal - and reports persistPin false.
    - An unknown/undefined key id returns { ok: false, reason: 'durable-base-unknown' }.
    - Callers that receive ok:false perform zero writes (no frame staging, no recording, no commit).
  </behavior>
  <action>
Create `app/src/components/physic-paint/roto/aquarelleScriptBaseAuthority.ts` as a pure, dependency-free module (no Preact, no signals, no store imports) so it is trivially unit-testable. Export a `ScriptBaseLookup` interface with four callbacks: `persistedDurableBase(keyId)` returning `{ bytes: ArrayBuffer | null } | undefined`, `sessionDurableBase(keyId)` with the same shape, `hasRecordedStrokes(keyId)` and `currentPayload(keyId)` returning `ArrayBuffer | null | undefined`; plus `isRevealKey(keyId)`. Export `resolveScriptBase(resolutionKeyId, lookup)` returning a discriminated union: `{ ok: true; kind: 'known-empty'; persistPin: boolean }`, `{ ok: true; kind: 'bytes'; bytes: ArrayBuffer; persistPin: boolean }`, `{ ok: true; kind: 'reveal'; persistPin: false }`, or `{ ok: false; reason: 'durable-base-unknown' }`. Evaluate the reveal axis first (per D-04 the reveal picture is never a pixel base), then walk persisted -> session -> pin-if-no-strokes -> fail closed, exactly as the module's doc comment states. The `hasRecordedStrokes` callback is the caller's responsibility to wire to the strokes-only predicate `hasAquarelleScriptForFrame`; document that the frame-global, Dry-inclusive events probe the render paths use must never drive this decision.

Write `aquarelleScriptBaseAuthority.test.ts` first (RED), covering every behavior bullet, including a case where `hasRecordedStrokes` returns true while `currentPayload` returns bytes (must fail closed), and a case where a persisted null beats a session bytes entry.

Rewrite `prepareRotoScriptTargetRef` in `app/src/components/physic-paint/PhysicsPaintStudio.tsx` (~3346-3470) to consume the authority: resolve the resolution key as the source key for source-occurrence and frame-override targets and as the target key otherwise, build the lookup from `seedDurableBases`-fed persisted/session maps and the strokes-only probe, and return the resolved base instead of the payload-only base-key plumbing. Preserve the current known-empty special case for `railScriptOwnsKey` (a flag-on rail's base is known-empty), but express it as an authority result rather than a special branch. Delete the `durableBaseKeyId` field from `RotoScriptPhysicalTarget` in `app/src/components/physic-paint/roto/physicsPaintRotoScriptClipboard.ts` (~40-72) and every producer/consumer, adding instead an optional runtime `durableBaseKind: 'pixels' | 'reveal'` so the publish closure can dispatch without a stored field. Update the publish closure (~1950-2109) to dispatch on the resolved kind: known-empty bakes raw, bytes composes over the base, reveal fails closed with `reveal-base-unsupported` until Task 3 wires the render-only port, and ok:false returns the `durable-base-unknown` refusal with zero writes. Keep the group-source-key publish behavior intact.

Rewire the raster-key edit path in the same file: `ensureAquarelleDurableBaseRef.current` (~6654-6773) must call `resolveScriptBase` for its base lookup instead of its own map hit plus Dry-inclusive event-length probe. Build the same lookup over the persisted/session base maps, `hasAquarelleScriptForFrame(record.appFrame)` for recorded strokes and `aquarelleCompositeRef.current(appFrame)` for the current payload. When the authority resolves bytes or known-empty and pins, seed `aquarelleDurableBaseByKeyRef`, delete the recovered marker, bump `bumpAquarelleStrokesRevision()`, call `studioScriptSnapshot.markDirty()` and return true; when it resolves reveal, return true (no pixel base is needed on the edit path). When it refuses, keep the 261028-k03e no-payload known-empty adoption and otherwise keep the existing pre-edit bake plus `recoverAquarelleDurableBase` inversion as the recovery step, returning false on a failed recovery so the publish still refuses. Preserve every `recordAquarelleRenderSplitEvent('lift-erase', …)` diagnostic, including the no-bake `diagnostics: null` arm. The new Studio pin extracts this function body, so keep any comment that mentions the removed probe outside that body.

Legalize frame overrides inside the written span: in `physicsPaintRotoRunScriptStacking.ts` remove the `overrideInSpan` refusal from `resolveRunScriptStackDestination`/`resolveRunScriptStackBoundary` (~106-107, ~378-392, ~485-488) and delete the `frameOverrideRefusal` readout, while keeping `frameOverrideAppFrames` on the rail view for the readout. In the controller (~2228-2231, ~2453) drop the `frameOverrideRefusal` gate and let the override target flow through the normal authority path (base = source key). Keep a fail-closed refusal when the resolved source key cannot be proven.

Update the intentional-law pins listed in the context section: the override-refusal expectations in `physicsPaintRotoRunScriptStacking.test.ts`, `physicsPaintRotoPlayScriptController.test.ts` and `PhysicsPaintPlayScriptDialog.test.ts`, and the `durableBaseKeyId` source pins in `physicsPaintRotoScriptClipboard.test.ts` and `PhysicsPaintStudio.test.ts` (including the `countOccurrences` pins that counted the deleted branch). Do not change tests that pin laws Quick B keeps. Add a Studio pin in `PhysicsPaintStudio.test.ts`: extract the `ensureAquarelleDurableBaseRef.current` body with the existing `between(studio, 'ensureAquarelleDurableBaseRef.current = async (appFrame) => {', 'const runAquarelleLiftErase = useCallback(')` boundary and assert it calls `resolveScriptBase(`, `hasAquarelleScriptForFrame(` and `recoverAquarelleDurableBase(`, and that the extracted body contains no call to the Dry-inclusive events probe.
  </action>
  <verify>
    <automated>pnpm --filter efx-motion-editor exec vitest run app/src/components/physic-paint/roto/aquarelleScriptBaseAuthority.test.ts app/src/components/physic-paint/roto/physicsPaintRotoScriptClipboard.test.ts app/src/components/physic-paint/roto/physicsPaintRotoRunScriptStacking.test.ts app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.test.ts</automated>
    <automated>pnpm --filter efx-motion-editor exec vitest run app/src/components/physic-paint/PhysicsPaintStudio.test.ts app/src/components/physic-paint/view/PhysicsPaintPlayScriptDialog.test.ts</automated>
    <automated>bash -lc "test \$(grep -rn 'durableBaseKeyId' app/src --include='*.ts' --include='*.tsx' | wc -l | tr -d ' ') -eq 0"</automated>
  </verify>
  <done>The authority module and its matrix test exist and pass; every base decision in `prepareRotoScriptTarget`, the publish closure and `ensureAquarelleDurableBaseRef` flows through `resolveScriptBase`; the payload-only base-key plumbing is gone from `app/src`; a frame override inside the written span no longer refuses; the six targeted suites are green.</done>
  <reversibility rating="costly">Replacing the base-resolution seam touches every script path; the authority module itself is cheap to revert but the call-site rewiring is broad.</reversibility>
</task>

<task type="execute" tdd="true">
  <name>Task 2: Pixel-only Keep script 2x2 with an authority-backed stacking bake</name>
  <files>app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.ts, app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.test.ts, app/src/components/physic-paint/PhysicsPaintStudio.tsx, app/src/components/physic-paint/PhysicsPaintStudio.test.ts, app/src/components/physic-paint/hooks/useRotoPlayScriptController.ts, app/src/components/physic-paint/hooks/useRotoPlayScriptController.test.ts, app/src/components/physic-paint/view/PhysicsPaintPlayScriptDialog.tsx, app/src/components/physic-paint/view/PhysicsPaintPlayScriptCards.tsx, app/src/components/physic-paint/view/PhysicsPaintPlayScriptDialog.test.ts, app/src/components/physic-paint/view/PhysicsPaintScriptsPanel.test.ts</files>
  <behavior>
    - On a pixel-only Paint destination (keyScriptEdits !== true) the Keep script card is visible, enabled and seeded ON when the dialog opens; the reason copy that said "stores pixels" is gone for this destination.
    - On a flag-on Paint destination the switch stays visible, enabled and seeded ON (Quick A behavior unchanged).
    - Keep ON on a pixel-only rail: the union bake resolves each touched key's base through the authority, pins the pre-run picture before the single commit, bakes base + recorded events + this run, and records the run's slices with append mode; a second identical run does not double.
    - Keep OFF on a pixel-only rail: the run is composited over each touched key's current picture, nothing is recorded, nothing is purged, and the durable base is not pinned to null.
    - Keep OFF on a flag-on rail keeps Quick A's purge-then-replace behavior.
    - No stack path adds or flips the persisted keyScriptEdits flag: a pixel-only publication's updated rail carries no own keyScriptEdits property, a flag-on rail keeps its existing true value, and the rail's other updated metadata carries only mode, motion, overrideColor and (Reveal) the reveal knobs.
    - When the authority refuses a base, the controller aborts before ports.commit with a clear refusal and zero writes.
    - A freshly pinned base persists; a recovered base stays session-only.
    - A checked-ON control never runs the destructive replace path.
  </behavior>
  <action>
Update the Keep gate in `physicsPaintRotoPlayScriptController.ts` (~1041-1080): make `keepScriptVisible` true for every existing-rail destination, drop the `keyScriptEdits === true` requirement from `keepScriptEffective`, and remove the pixel-only disabled reason while keeping the reason string only for the never-a-stack case. Keep `seedKeepScript` dialog-gated and compare-then-write exactly as today (no unconditional destination reads per playhead tick), but seed ON for pixel-only and reveal destinations.

Rework `confirmStack` (~2194-2507) recording selection: compute `recordScripts` from `{ railOwnsScripts, keepScriptEffective }` so pixel-only and reveal rails reach the recording path, choose 'append' when Keep is ON, 'none' when Keep is OFF on a pixel-only/reveal rail, and keep 'replace' only for a flag-on rail with Keep OFF. Remove the `currentTarget.keyScriptEdits === true` gate that currently short-circuits every pixel-only rail. Never add `keyScriptEdits` to `updatedTarget`.

Make `bakeStackedRailKey` in `PhysicsPaintStudio.tsx` (~3891-3978) authority-backed: accept the touched key ids plus this run's slices, resolve each key's base via `resolveScriptBase`, dispatch known-empty to the raw union bake and bytes to the compose-over-base bake, return a refusal result when the authority fails, and eagerly pin fresh bases (persisting them, marking the document dirty) before returning the frames. Keep `composeStackedRailKey` as the Keep-OFF flatten port over the current picture. Set the append/replace/none recording mode in `recordRailKeyScripts`; do not pin a null base on the flatten path. Forward any new port result shape through `useRotoPlayScriptController.ts` and the controller's abort handling so a refusal prevents `ports.commit` entirely.

Update the dialog/cards copy for the pixel-only Keep card (remove the "stores pixels" reason, keep the ON/OFF labels and the flatten explanation for OFF) and refresh `PhysicsPaintScriptsPanel.test.ts` only if it pins the changed copy. Rewrite the pixel-only pins in `physicsPaintRotoPlayScriptController.test.ts` (~4377-4402) into the 2x2 truth table (visible/enabled, seeded ON, ON appends, OFF flattens with no record and no pin, flag-on unchanged). Extend the existing 'never flips keyScriptEdits' stack test (~4344) with its pixel-only counterpart: after a Keep ON run on a pixel-only rail, the committed rail metadata has no own keyScriptEdits property (`Object.prototype.hasOwnProperty.call(target, 'keyScriptEdits')` is false), while the flag-on assertion that the value stays true is unchanged. Leave the two creation-path opt-in writes (the Link-to-existing-cycle branch and the new Loop Clip branch) untouched - they are legitimate Quick A law, outside the stack path. Keep the new stack tests and any explanatory comment inside `confirmStack` free of the flag's property/assignment form: the scoped gate matches that form anywhere in the function body and is already green at HEAD, so it guards the new recording branch rather than a behavior change. Add Studio source pins in `PhysicsPaintStudio.test.ts` for the authority-backed stacking port: a known-empty dispatch, a bytes compose dispatch, a refused-base return, the pin-before-commit ordering, and the persist-vs-session pin split.
  </action>
  <verify>
    <automated>pnpm --filter efx-motion-editor exec vitest run app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.test.ts app/src/components/physic-paint/PhysicsPaintStudio.test.ts</automated>
    <automated>pnpm --filter efx-motion-editor exec vitest run app/src/components/physic-paint/view/PhysicsPaintPlayScriptDialog.test.ts app/src/components/physic-paint/view/PhysicsPaintScriptsPanel.test.ts app/src/components/physic-paint/hooks/useRotoPlayScriptController.test.ts</automated>
    <automated>node -e "const s=require('fs').readFileSync('app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.ts','utf8');const i=s.indexOf('async function confirmStack(');const j=s.indexOf('\n  async function ',i+10);if(i<0||j<0)process.exit(2);process.exit(/keyScriptEdits\s*:|keyScriptEdits\s*=(?!=)/.test(s.slice(i,j))?1:0)"</automated>
  </verify>
  <done>A pixel-only Paint rail exposes an enabled Keep script switch that defaults ON; ON records the run over the pinned pre-run picture, OFF flattens with no record and no pin, flag-on Keep OFF still replaces; every refusal happens before the single commit; the committed rail metadata of a pixel-only stack run carries no own keyScriptEdits property and a flag-on rail keeps its true value; the targeted suites and the confirmStack-scoped gate pass.</done>
  <reversibility rating="reversible">Keep-script branching is confined to the controller and the stacking ports; restoring the Quick A gate is a small, isolated edit.</reversibility>
</task>

<task type="execute" tdd="true">
  <name>Task 3: Reveal rail stacking with a render-only photo-reference tail bake</name>
  <files>app/src/components/physic-paint/roto/physicsPaintRotoRunScriptStacking.ts, app/src/components/physic-paint/roto/physicsPaintRotoRunScriptStacking.test.ts, app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.ts, app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.test.ts, app/src/components/physic-paint/PhysicsPaintStudio.tsx, app/src/components/physic-paint/PhysicsPaintStudio.test.ts, app/src/components/physic-paint/hooks/useRotoPlayScriptController.ts, app/src/components/physic-paint/hooks/useRotoPlayScriptController.test.ts, app/src/components/physic-paint/view/PhysicsPaintPlayScriptDialog.tsx, app/src/components/physic-paint/view/PhysicsPaintPlayScriptCards.tsx, app/src/components/physic-paint/view/PhysicsPaintPlayScriptDialog.test.ts, app/src/stores/physicPaintStore.ts, app/src/stores/physicPaintStore.test.ts</files>
  <behavior>
    - A playhead inside a Reveal rail resolves that rail as the stack destination at its source-cycle offset instead of refusing with the reveal-target reason; overlapping or ambiguous Reveal membership still fails closed.
    - The Reveal run card set exposes Colorize, Photo wiggle and Paint seed, hides Rail Type (mode stays the rail's own) and Color, and shows the stack readout, Keep and Collision cards; the placed photo reference is displayed as the rail's own and is not editable.
    - Confirm with no placed photo reference refuses with a clear reason and zero writes.
    - Confirm with a placed reference renders every touched frame through that same reference (same photo, new wash), including appended tail frames, and asserts full coverage before the single commit; any frame missing from the reveal render aborts with zero writes.
    - Plain-paper bytes never land on a reveal frame: the publication's changed frames equal the touched reveal frames exactly.
    - Keep ON records the run's slices with append mode over the revealed union; Keep OFF renders the union and records nothing (no purge, no null pin).
    - A stack run on a reveal-owned key from any other script path (create Apply / paste) resolves to the reveal kind and renders through the reference rather than baking the raw wash.
    - The run's colorize, colorizeMix, photoWiggle and paintSeedVariation are adopted on the Loop Clip in the same commit as the frames; the extension still obeys extend-only growth, repeat unchanged, and the existing collision choices with one atomic undo.
  </behavior>
  <action>
Remove the reveal refusal from `resolveRunScriptDestination` and extend `RunScriptRailView` in `physicsPaintRotoRunScriptStacking.ts` with `colorize`, `colorizeMix`, `photoWiggle` and `paintSeedVariation` so the dialog can seed and adopt them; keep the `railKind` discriminator the controller already carries.

In `physicsPaintRotoPlayScriptController.ts` add a `stackRailKind` surface derived from the pinned destination and use it for: (a) seeding the reveal knobs on open (dialog-gated, compare-then-write, no per-tick reads), (b) hiding Rail Type and Color for reveal destinations while leaving mode untouched, (c) gating confirm on `hasPhotoReference` with a clear refusal, and (d) a reveal branch in `confirmStack` that builds the publication from reveal-rendered frames instead of Paint bake frames. In that branch call the new port, assemble the frames with `withRecordBytes`, assert the changed-frame set equals the touched reveal frames (fail closed otherwise), then perform the single `ports.commit`. Set the recording mode from Keep: append for ON, none for OFF.

Add the render-only tail port in `app/src/stores/physicPaintStore.ts`: mirror `commitRevealBake`'s reference walk (`_resolveReferenceSourceImage` per span frame, fail closed with the same reason) and call the exported `renderRotoRevealFrames` from `physicsPaintRotoPlayScriptRenderer.ts` (line 101) exactly as `commitRevealBake` does, filling `RotoRevealRenderInput.script` with the key's recorded events unioned with this run's slice so its aquarelle-timeline guard is satisfied and passing `size`, reference transform/zoom and the four reveal knobs. Never import the module-private aquarelle helper (line 129). The port writes no key records and no leading interpolation break - it returns the rendered frames plus anchors for the caller's publication. Fast path: when no destination key has recorded strokes, render the whole span once; otherwise render each touched key from its recorded events unioned with this run's slice at a single output frame so picture equals script and a repeat cannot double. Fail closed with `missing reference source` when any span frame has no reference. Expose it through `PhysicsPaintStudio.tsx` as `bakeRevealStackTail` and forward it through `useRotoPlayScriptController.ts`.

Replace Task 1's temporary `reveal-base-unsupported` refusal in the publish closure with the reveal dispatch: when the authority returns the reveal kind, route the publication bytes through the same render-only port before commit, so a create/paste onto a reveal-owned key renders through the photo instead of baking the raw wash.

Compose the dialog for a reveal stack: keep the timing, stack readout, keep and collision cards; show Motion wiggle, Colorize, Photo wiggle and Paint seed; hide Rail Type, Color and Key Script. Update the reveal-law pins that Quick B intentionally changes (the `reveal-target` refusal in the stacking test, the override/reveal dialog pins, the "Reveal has no Key Script card" expectation), and add controller/store tests for the no-reference refusal, full-coverage abort, Keep ON append vs OFF none, adoption of the four reveal knobs, and the tail-frame photo walk.
  </action>
  <verify>
    <automated>pnpm --filter efx-motion-editor exec vitest run app/src/components/physic-paint/roto/physicsPaintRotoRunScriptStacking.test.ts app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.test.ts</automated>
    <automated>pnpm --filter efx-motion-editor exec vitest run app/src/stores/physicPaintStore.test.ts app/src/components/physic-paint/PhysicsPaintStudio.test.ts</automated>
    <automated>pnpm --filter efx-motion-editor exec vitest run app/src/components/physic-paint/view/PhysicsPaintPlayScriptDialog.test.ts app/src/components/physic-paint/hooks/useRotoPlayScriptController.test.ts app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptRenderer.test.ts</automated>
  </verify>
  <done>A playhead inside a Reveal rail stacks the run there; the tail is baked through the placed photo reference with full frame coverage asserted before the single commit; no reference refuses with zero writes; Colorize, Photo wiggle and Paint seed are editable and adopted while Rail Type is hidden; Keep ON records and Keep OFF flattens; the targeted suites pass.</done>
  <reversibility rating="costly">The render-only reveal path and the reveal dispatch touch the store, the Studio ports and the publication assembly; reverting means re-introducing the reveal refusal in three places.</reversibility>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| studio script snapshot -> base resolution | Persisted/session durable-base bytes and per-key recorded scripts are trusted only after the authority walk; a stale or composite payload crossing this boundary would silently overwrite user paint. |
| run-script dialog -> publication commit | User-chosen Keep/collision/reveal values cross into the single atomic publication; any value that skips validation becomes a destructive write. |
| reveal rail -> placed photo reference | The reference image is external user media; the tail bake must fail closed when a frame has no resolvable reference instead of rendering a plain-paper wash. |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-261031-QPS-01 | Tampering | `resolveScriptBase` / publish base dispatch / raster-key edit path | critical | mitigate | Fail-closed authority walk; a key with recorded strokes can never supply a payload base; the edit path calls the same authority and keeps `recoverAquarelleDurableBase` only as the recovery step; `ok:false` returns before any frame staging or commit; unit matrix pins each branch. |
| T-261031-QPS-02 | Tampering | occurrence/override base resolution (`prepareRotoScriptTarget`) | high | mitigate | Resolve to the source key id before any lookup; composite payloads are unreachable by construction and covered by a source-key mapping test. |
| T-261031-QPS-03 | Tampering | reveal tail bake / plain-paper mixing | high | mitigate | Assert the publication's changed-frame set equals the touched reveal frames; any extra or missing frame aborts with zero writes before `ports.commit`. |
| T-261031-QPS-04 | Tampering | pixel-only Keep ON re-bake ordering | high | mitigate | Pin the pre-run payload as the durable base before the single commit; regression tests cover re-bake, save/reopen and repeat with a no-doubling assertion. |
| T-261031-QPS-05 | Repudiation | `keyScriptEdits` flag | high | mitigate | Never write `keyScriptEdits` in `updatedTarget`; the stack test asserts the committed rail metadata is unchanged (pixel-only: no own flag property; flag-on: still true), backed by a confirmStack-scoped source gate that leaves the legitimate creation-path opt-ins outside its region. |
| T-261031-QPS-06 | Denial of Service | large reveal span render | medium | accept | The reveal render is bounded by the rail span and already used by `replayRevealRail`; the dialog is modal to one run, so the cost is the same as an existing replay. |
| T-261031-QPS-SC | Tampering | pnpm dependency installs | high | accept | No dependency is added or upgraded by this plan; no package-manager install task exists, so the supply-chain surface is unchanged. |
</threat_model>

<verification>
1. Task 1 authority/clipboard/stacking/controller: `pnpm --filter efx-motion-editor exec vitest run app/src/components/physic-paint/roto/aquarelleScriptBaseAuthority.test.ts app/src/components/physic-paint/roto/physicsPaintRotoScriptClipboard.test.ts app/src/components/physic-paint/roto/physicsPaintRotoRunScriptStacking.test.ts app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.test.ts`
2. Task 1 Studio/dialog: `pnpm --filter efx-motion-editor exec vitest run app/src/components/physic-paint/PhysicsPaintStudio.test.ts app/src/components/physic-paint/view/PhysicsPaintPlayScriptDialog.test.ts`
3. Task 1 plumbing gate: `bash -lc "test \$(grep -rn 'durableBaseKeyId' app/src --include='*.ts' --include='*.tsx' | wc -l | tr -d ' ') -eq 0"` - baseline at HEAD is 29 occurrences across the Studio, clipboard and their tests, so the gate is red until the field and every producer/consumer are deleted.
4. Task 2 controller/Studio: `pnpm --filter efx-motion-editor exec vitest run app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.test.ts app/src/components/physic-paint/PhysicsPaintStudio.test.ts`
5. Task 2 dialog/hook/panel: `pnpm --filter efx-motion-editor exec vitest run app/src/components/physic-paint/view/PhysicsPaintPlayScriptDialog.test.ts app/src/components/physic-paint/view/PhysicsPaintScriptsPanel.test.ts app/src/components/physic-paint/hooks/useRotoPlayScriptController.test.ts`
6. Task 2 stack-flag gate: the `node -e` command in Task 2's `<verify>` extracts `confirmStack` (start marker to the next top-level `async function`) and fails only if that body writes the flag in property or assignment form. Baseline at HEAD is green - the stack path never wrote it - so this is a regression guard for the new recording branch, deliberately region-scoped so the two creation-path opt-ins stay legal.
7. Task 3 stacking/controller: `pnpm --filter efx-motion-editor exec vitest run app/src/components/physic-paint/roto/physicsPaintRotoRunScriptStacking.test.ts app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.test.ts`
8. Task 3 store/Studio/renderer: `pnpm --filter efx-motion-editor exec vitest run app/src/stores/physicPaintStore.test.ts app/src/stores/efxPaintStore.reveal.test.ts app/src/components/physic-paint/PhysicsPaintStudio.test.ts app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptRenderer.test.ts`
9. Full suite: `pnpm --filter efx-motion-editor exec vitest run` - baseline is 360 files / 6,736 passed / 1 skipped / 96 todo; new test files raise the file and pass counts, and the run must end with 0 failed. Never run the root `vitest` script (watch mode) and never start the server.
10. Typecheck: `pnpm --filter efx-motion-editor run typecheck` reports no errors.
11. Schema tripwire: confirm no persisted snapshot/format module changed - `git diff --stat` must not touch the SNAP v5 serializer/validator, the Loop Clip record type, or any persisted rail field. If an implementation proves a stored field is unavoidable, STOP and report; do not improvise a schema.

UAT rows the user will run after execution:
- Pixel-only Paint rail: place the playhead inside it, Run Script, Keep ON (default) - the original picture stays under the new strokes after re-bake, after save/reopen, and after repeating the run; nothing doubles.
- Same rail, Keep OFF - the run lands over the current picture, no per-key script is recorded, and a later run does not replay the flattened strokes.
- Stack on an unscripted raster key, then edit the new strokes; the original raster must remain under them after re-bake, save/reopen and repeat; an unprovable base shows a clear refusal and erases nothing.
- Frame override inside the written span: the run applies, the override keys keep the source key's base, and the override composite never becomes the base.
- Reveal rail: place the playhead inside it and Run Script - Colorize, Photo wiggle and Paint seed are editable and adopted, Rail Type is hidden, the extended tail renders through the very same placed photo, and repeating does not double.
- Reveal rail with no photo reference placed - a clear refusal, zero writes.
- Plain-paper keys are never mixed into a Reveal rail.
- Regression: Quick A UAT rows 1-9 still pass, plus row 8 (Reveal) and the Reveal part of row 9.
</verification>

<success_criteria>
- One new pure authority module resolves every durable base with the locked order and fails closed; the raster-key edit path delegates to it and keeps recovery as its fallback; no `durableBaseKeyId` plumbing remains in `app/src`.
- A pixel-only Paint rail's Keep script switch is visible, enabled and defaults ON; ON records and preserves the original picture across re-bake, reopen and repeat; OFF flattens without recording, purging or pinning; flag-on Keep OFF still replaces.
- A frame override inside the written span applies and resolves to its source key's base.
- Reveal rails stack end to end; the tail is baked through the placed photo reference with full coverage asserted; no reference refuses with zero writes; Colorize, Photo wiggle and Paint seed are editable and adopted while Rail Type is hidden; plain-paper bytes never land on a reveal frame.
- `keyScriptEdits` is never implicitly flipped by any stack path: a pixel-only stack publication carries no own flag property and a flag-on rail keeps its true value; the creation-path opt-ins stay untouched.
- Every targeted suite and the full suite pass with 0 failures; typecheck is clean; no persisted schema or format change.
- Three atomic commits, one per task, each green before the next begins.
</success_criteria>

<output>
Create `.planning/quick/261031-qps-task-quick-b-follow-up-to-quick-261031-i/261031-qps-SUMMARY.md` when done. Record the three task commits, the new authority module and its matrix, the prepare/publish and raster-key-edit rewiring, the pixel-only Keep truth table, the override-in-span law, the reveal stack path (through the exported `renderRotoRevealFrames`), the UAT rows handed to the user, and an explicit statement that no persisted schema changed.
</output>
