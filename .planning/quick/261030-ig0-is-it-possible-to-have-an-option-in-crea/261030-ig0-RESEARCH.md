# Quick 261030-ig0: Per-key script editing on Motion / Reveal / Static rails — Research

**Researched:** 2026-10-30
**Domain:** `PhysicPaintRotoLoopClip` persistence + Play Script apply/regenerate pipeline (TS + one Rust mirror)
**Confidence:** HIGH (all findings read from source at the cited lines)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- The rail keeps exactly one `scriptId` (no full script copies per key).
- Each key carries only its own overrides — its slot in the script timeline plus the settings that affect that key (motion, color, and the reveal variant inputs where applicable).
- Rationale: the script envelope is capped at 16 MB; duplicating it per frame would blow up the `.mce` package. Heavy media stays out of the package.
- Every rail key has an edit affordance that re-opens the Create Rail dialog, prefilled from that key's saved script + per-key settings, scoped to regenerate ONLY that key.
- The rail as a whole remains the unit for timing/repeat edits (existing Edit Rail behavior is unchanged).
- A checkbox inside the Create Rail dialog, persisted on the rail record, **off by default**.
- Off reproduces today's behavior byte-for-byte (no new persisted fields on the rail).
- The toggle applies to all four creation variants: Paint Motion, Paint Static, Reveal Motion, Reveal Static.
- Regenerate Rail keeps the script as the source of truth for keys that were NOT individually edited.
- Individually edited keys are protected: the existing Regenerate confirmation lists them (alongside the current "Locally painted frames" facts) and leaves them untouched unless the user explicitly confirms discarding them.

### Claude's Discretion
- The exact persisted field names/shape for the per-key overrides and the rail-level enable flag, following the existing additive-optional convention (`colorize` / `photoWiggle` precedent: written only when enabled so an untouched rail stays byte-identical).
- The edit affordance's placement and label on a rail key.
- Whether per-key overrides ride `frameOverrides` or a new optional collection on the Loop Clip record.

### Deferred Ideas (OUT OF SCOPE)
None stated.
</user_constraints>

## Summary

The feature is feasible with a small, purely additive change: one optional boolean on the Loop Clip plus one optional per-key override collection, both written only when the toggle is on. The existing `colorize` / `photoWiggle` precedent gives an exact, test-pinned recipe: allowlist entry → fail-closed validator clause → verbatim parse copy → **deliberate exclusion from the canonical fingerprint** (so every pre-existing rail keeps its exact revision and the Rust mirror in `script_library.rs` needs no change). The bake already produces a slot index (`frameIndex` = cycle position) for every key, and `buildPhysicalPublication` already reuses the existing keyId when a record exists at the destination frame — so a single-key re-bake preserves rail identity without new identity machinery.

The two real complications are (a) the progressive engines derive frame *k* from a bake of at least *k+1* frames, so a one-key re-bake costs the same as a prefix bake, and (b) Regenerate currently *clears* `frameOverrides` and deletes override pixel records unconditionally, so the new protected collection must be threaded through `proposePhysicPaintRotoRegenerateGroup` and its confirmation facts.

**Primary recommendation:** add `keyScriptEdits?: boolean` (rail flag, written only when true) plus `keyOverrides?: readonly PhysicPaintRotoKeyScriptOverride[]` (new optional collection — **not** `frameOverrides`), both excluded from the canonical encoder; capture slot→keyId at `cycleKeyIds` / `bakeResult.records`; protect them in `proposePhysicPaintRotoRegenerateGroup`.

## 1. Rail record & persistence

`PhysicPaintRotoLoopClip` is declared at `physicsPaintRotoPhysicalModel.ts:305-343`. The two precedent flags:

```
  readonly colorize?: boolean;
  readonly colorizeMix?: number;
  /**
   * 261030-ey9: the Reveal "Photo wiggle" flag. Written ONLY when true (the
   * colorize precedent), so a rail created with it off is byte-identical to a
   * pre-quick rail; absent means off (today's reveal). Deliberately EXCLUDED
   * from the canonical fingerprint — the baked key bytes already distinguish
   * the rails, exactly like the colorize pair (research A5).
   */
  readonly photoWiggle?: boolean;
```
[VERIFIED: app/src/components/physic-paint/roto/physicsPaintRotoPhysicalModel.ts:321-335]

**Exact five-step procedure to add a new optional field** (mirroring the colorize/photoWiggle seam):

1. **Interface member** — `physicsPaintRotoPhysicalModel.ts:305-343`.
2. **Allowlist entry** — `PHYSIC_PAINT_ROTO_LOOP_CLIP_KEYS` (`:474-491`) already lists `'colorize', 'colorizeMix', 'photoWiggle', 'frameOverrides'`; a new member MUST be added or `hasOnlyAllowedKeys` rejects the whole record.
3. **Validator clause** — `isPhysicPaintRotoLoopClip` (`:840-876`). Precedent clauses:
```
  const hasColorize = value.colorize !== undefined;
  const hasColorizeMix = value.colorizeMix !== undefined;
  if (hasColorize !== hasColorizeMix) return false;
  ...
  if (value.photoWiggle !== undefined && typeof value.photoWiggle !== 'boolean') return false;
```
[VERIFIED: physicsPaintRotoPhysicalModel.ts:865-874]
4. **Parse copy** — `parsePhysicPaintRotoLoopClips` (`:982-1045`) reconstructs a frozen record from allowlisted fields only; absent members must stay absent:
```
      // 261029-vbp: the reveal colorize pair copies verbatim (both-or-neither,
      // already validated above) — never derived from any other member.
      ...(entry.colorize !== undefined ? { colorize: entry.colorize, colorizeMix: entry.colorizeMix! } : {}),
      // 261030-ey9: the Photo wiggle flag copies verbatim (written only when
      // true) — never derived from any other member.
      ...(entry.photoWiggle !== undefined ? { photoWiggle: entry.photoWiggle } : {}),
```
[VERIFIED: physicsPaintRotoPhysicalModel.ts:1020-1025]
5. **Canonical encoder — deliberately skip.** `encodeCanonicalLoopClips` (`:1446-1500`) emits `railKind` when present, and the 43-06 provenance block, but:
```
      // 261030-ey9: photoWiggle is deliberately NOT a canonical term (colorize
      // precedent) — the baked key bytes already distinguish the rails, and the
      // flag is creation-only. A future toggle-on-existing-rail edit must add
      // the term here AND at the identical ordinal in the Rust encoder.
```
[VERIFIED: physicsPaintRotoPhysicalModel.ts:1479-1482]

**This is the exclusion site.** `colorize`/`colorizeMix`/`photoWiggle` appear in `PHYSIC_PAINT_ROTO_LOOP_CLIP_KEYS` and the validator but nowhere in `encodeCanonicalLoopClips`. Because the baked key bytes are the only fingerprint term, an override that always re-bakes its key stays revision-visible through the payload content token (`encodeCanonicalRecordPayloadTerm`, `:1352-1368`). A metadata-only change is invisible to the revision — acceptable here because per-key overrides are only ever written together with a re-bake (exactly the photoWiggle/colorize argument).

**Rust mirror:** the physical document travels opaque (`app/src-tauri/src/lib.rs:118-121`, `document: Option<Value>`), and the only Rust reader of Loop Clip fields is `canonical_loop_clips` in `app/src-tauri/src/services/script_library.rs:1382-1517`, whose comment at `:1252-1255` states it mirrors `buildPhysicPaintRotoProjectEquality` byte-for-byte. Encoding `scriptId/motion/rotation/scale/overrideColor/syncState/...` but **no** `railKind`, `colorize`, `colorizeMix`, or `photoWiggle` (verified by reading `:1430-1514`). A non-canonical new member therefore needs **no** Rust change. The `Mce*` field-diff contract (`app/src/lib/mceFieldContract.test.ts:144-177`) only diffs `Mce*` structs in `models/project.rs` against `types/project.ts`/`types/audio.ts` — it does not cover Loop Clips.

**Propagation sites that will silently drop a new member** (each enumerates optional fields):
- `app/src/components/physic-paint/hooks/useRotoPhysicalEditCoordinator.ts:681-719` (`cloneLoopClips`) — comment at `:703-705`: "the bridge compares whole-clip stableSerialize (physicPaintBridge.ts:453), so a dropped optional member rejects every physical edit on the track (the G-52-4 failure family)".
- `app/src/components/physic-paint/roto/physicsPaintRotoRailSetCopy.ts:452-501` (rail duplicate/paste; `colorize` at `:470-472`, `photoWiggle` at `:475`).
- `app/src/components/physic-paint/hooks/useRotoPhysicalEditHistory.ts:418-450` and `:554-580` (two loop-clip equality comparators — a new field absent from both makes an override-only edit register as a no-op and skip the undo entry).

## 2. Apply / bake flow

`confirm()` → `confirmReveal()` for the reveal tab, else `confirmGeneration()` (`physicsPaintRotoPlayScriptController.ts:1282-1286`).

- **Paint bake** — `bakeAquarelleScript` (`:1294-1430`). Progressive: `frameCount: count`, one frame per output frame with stroke growth; static: one settled wash posed per output frame. Staged frames carry `frameIndex: j, appFrame: start + j` (`:1378-1420`).
- **Slot→key identity** — after commit, `cycleAppFrames` (either `destinationAppFrames` or `start+index`) is joined to the committed records:
```
      const cycleKeyIds = cycleAppFrames.map((appFrame) => {
        const record = recordByAppFrame.get(appFrame);
        if (!record) throw new Error(`Committed source cycle is missing frame ${appFrame}.`);
        return record.keyId;
      });
```
[VERIFIED: physicsPaintRotoPlayScriptController.ts:1685-1689]
- The new Loop Clip is built at `:1763-1774` with `scriptId`, `compactPhysicPaintRotoMotion(motion)`, `overrideColor`, `buildNewLoopLifecycle(...)`. This is where the rail-level flag must be written (`...(enablePerKey ? { keyScriptEdits: true } : {})`).
- **Re-bake preserving identity** — `buildPhysicalPublication` (`:2308-2400`) looks up the existing record **by destination appFrame** and reuses its keyId:
```
    const existing = currentByFrame.get(appFrame);
    const keyId = existing?.keyId ?? createPhysicPaintRotoKeyId();
```
[VERIFIED: physicsPaintRotoPlayScriptController.ts:2359-2360]
  A one-key re-bake published with `targetAppFrames = [keyFrame]`, `count = 1`, `staged = [renderedFrame]` therefore keeps the rail's `sourceKeyIds` valid. `count`/`targetAppFrames`/`staged.length` must be equal or it throws at `:2321-2328`.

**Cleanest capture point for a per-key record:** immediately after `cycleKeyIds` is computed (`:1689`) — index `i` is the script slot, `cycleKeyIds[i]` the keyId, `motion` (and reveal inputs) the settings. Store `{ keyId, slot: i, motion, overrideColor, colorize?, colorizeMix?, photoWiggle? }`.

## 3. Regenerate path

- `openSourceEdit` (`:979-1006`) delegates to `openGroupRegenerate` when the clip has the full lifecycle shape (`:830-840`).
- `openGroupRegenerate` (`:900-977`) freezes `RotoPlayScriptRegenerateImpact` at `:941-965`, whose current divergence fact is only `locallyPaintedFrameCount: group.frameOverrides.length` (`:950`). The dialog renders it as `<dt>Locally painted frames</dt>` (`PhysicsPaintPlayScriptDialog.tsx:420`). A second fact ("Individually edited keys: N") plus a list plugs in here.
- The actual regenerate proposal, `proposePhysicPaintRotoRegenerateGroup` (`physicsPaintRotoGroupLifecycle.ts:698-741`), **unconditionally clears** the divergence:
```
  const nextGroup = {
    ...group,
    placementStart: group.phaseOrigin,
    syncState: 'synchronized' as const,
    ...
    frameOverrides: Object.freeze([]),
  };
  ...
  const removedOverrideIds = group.frameOverrides.map((override) => override.keyId);
```
[VERIFIED: physicsPaintRotoGroupLifecycle.ts:709-723]
  A protected per-key collection must be preserved here (or cleared only on explicit confirm) or the CONTEXT protection rule is silently violated. `syncState: 'modified'` is set only by group paint (`:149`) and delete-group-frame (`:630`); a per-key edit must also mark the rail modified or the Regenerate entry stays "Already synchronized with Script." (`groupRegenerateReason`, `:876`).
- **Do not ride `frameOverrides`.** That collection is coupled to `groupOverrideRecords` pixel records: `proposePhysicPaintRotoGroupFramePaint` validates override identity by phase modulo and rejects `override-identity-mismatch` / `cleanup-reference-mismatch` (`:107-126`), and `buildLifecycleProposal`'s `referencedKeyIds` derives from it. A script-metadata override has no pixel record and no phase-offset identity; mixing would trip those guards.

## 4. Per-key edit entry point

- The rail is one contiguous `<button>` target (`PhysicsPaintLoopClipRail.tsx:336-356`); a plain double-click or Enter opens **Edit Rail**: `void props.onOpenLoopEdit(range.loopId)` (`:283-289`, `:319-326`). Single click selects the rail (`onSelectLoopClip`).
- Individual keys are rendered by `RotoTimelineCellButton` in the active lane (`PhysicsPaintWorkflowStrip.tsx:1857-1895`) — a `<button>` with `onClick → onCellClick(frame, vm, event)` (`:1882-1885`) that drives real-key selection.
- **Key selection and rail selection are mutually exclusive** — `handleSelectRotoLoopClip` nulls `selectedKeyId` (`PhysicsPaintStudio.tsx:4163-4167`), and key selection clears the loop selection.
- Rail-level actions live in `PhysicsPaintScriptsPanel.tsx:133-145`: the `Edit Rail` `IconButton` bound to `onOpenLoopEdit`, plus Previous/Next Rail and Close. `handleOpenRotoLoopEdit` (`PhysicsPaintStudio.tsx:4185-4191`) is the wiring seam.

**Smallest correct affordance:** a sibling control in that inspector row — "Edit Key" — enabled when the rail's per-key option is on and a key of that rail is addressable from the playhead/cursor frame (or from the rail's current phase). Rationale, from the evidence: the cell is already a `<button>` so a nested per-key button is invalid HTML; double-click on the rail is taken by Edit Rail; and rail selection cannot coexist with key selection. The inspector keeps rail context and reuses the existing `openLoopEdit`-style port.

## 5. Reveal bake

`createRevealRail` (`app/src/stores/efxPaintStore.ts:1522-1659`):
- Resolves `revealColorize`/`revealColorizeMix`/`revealPhotoWiggle` **once** (`:1566-1570`) so bake and persisted clip cannot disagree.
- Bakes through `commitRevealBake` (`physicPaintStore.ts:2016-2075+`), which resolves the reference **per destination frame** (`:2047-2053`) and calls `renderRotoRevealFrames` (`:2055-2071`).
- The persisted clip carries only provenance + the optional flags (`:1607-1631`); `frameOverrides: []`.

`renderRotoRevealFrames` (`physicsPaintRotoPlayScriptRenderer.ts:144-231`): `frameCount: isStatic ? 1 : input.frameCount` (`:162`); each output frame `destination = canonicalStart + frameIndex` uses `washFrame = isStatic ? frames[0] : frames[frameIndex]` (`:188-191`), the reference bytes for **that** destination (`:207`), then `poseRevealCoverage(coverage, destination, motion)` and `compositeRevealMask(...colorizeMix)` (`:219-225`).

**A per-key override needs to seed:** `scriptId` (rail-level), `slot` (cycle index), `motion` (deformation/position/rotation/scale), `colorize`+`colorizeMix`, `photoWiggle`, and nothing else — the reference, paper, size and project transform are resolved at bake time from the live document. **Progressive cost pitfall:** frame *k* exists only if the bake ran at least `k+1` frames, so a single-key progressive re-bake must run a prefix bake (or a new renderer entry point that bakes to slot *k* and returns only frame *k*). Static re-bake is cheap: `frameCount: 1` + the target destination's pose.

## 6. Constraints & pitfalls

**Tests that pin these files (will need new cases / will break on shape changes):**

| File | Pin |
|---|---|
| `physicsPaintRotoLoopClips.test.ts:507-619` | The exact additive-optional pattern to copy: round-trip, `'photoWiggle' in parsed[0]).toBe(false)`, fail-closed rejects, `:490-498` provenance-joins-fingerprint |
| `physicsPaintRotoLoopClips.test.ts:638-643` | `expect(parsed).toEqual(record)` deep-equality on lifecycle fixtures — any new member added to a fixture without parse support fails |
| `physicsPaintRotoPhysicalModel.test.ts` | guard/allowlist round-trips |
| `efxPaintStore.reveal.test.ts:149-161, 189-198, 201-237` | reveal clip members and `'colorize' in clip` / `'photoWiggle' in clip` absence assertions |
| `PhysicsPaintPlayScriptDialog.test.ts:302-371` | content child order `[0]=tabs, [1]=modeCard`, `indexOf(timing) < indexOf(sideStack)`, and "NO scroll region" CSS (`:361-371`) — a new card placed between mode and timing keeps the indices; a scroll region fails |
| `physicsPaintRotoRailSetCopy.test.ts` (23 tests) | duplicate/paste member round-trip |
| `useRotoPhysicalEditHistory.test.ts` (75 tests) | no-op suppression equality |
| `physicsPaintRotoPlayScriptController.test.ts` (164), `.bake.test.ts`, `...ApplyBake.test.ts` | apply/regenerate flows |
| `app/src-tauri/src/services/script_library.rs:2929-2941` | Rust canonical parity — only touched if a **canonical** term is added |

**Project constraints (from CLAUDE.md):** use `vitest run`, never watch mode; never start the dev server (the user runs it); Preact + `@preact/signals` only — consult `efx-preact-reactivity` for any signal/store/effect change; pnpm, not npm.

**`.mce` package rules:** references-only package (PROJECT.md:347); images/heavy media never inlined. A per-key override carries only small scalars — safe. The physical document JSON (`loopClips`) is serialized as-is from the store (`physicPaintStore.ts:4323`), and the document builder re-validates through `parsePhysicPaintRotoPhysicalDocument` (`:2748-2776`) — so a member that is not in the allowlist makes the whole layer fail to save.

**No backward compatibility:** PROJECT.md:230 — `.mce` v1.0 clean break, pre-v1.0 rejected; PROJECT.md:349 — dual-language law. For this feature the law reduces to: additive optional + off = byte-identical (no migration, no version bump).

### Anti-patterns to avoid
- **Do not duplicate the script envelope per key.** CONTEXT locks one `scriptId`; 16 MB cap.
- **Do not reuse `frameOverrides`.** Coupled to groupOverrideRecords pixel identity and the phase-modulo guards.
- **Do not add a canonical term.** It forces an identical-ordinal Rust mirror and moves every existing rail's revision.
- **Do not route the toggle through a render-body signal write.** Apply-mode creation flags reset in `openConfirmation` (`physicsPaintRotoPlayScriptController.ts:730-734`).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The per-key override collection can be excluded from the canonical fingerprint because every write accompanies a re-bake | 1 | If a future metadata-only edit exists, revision/save-cache stays stale |
| A2 | `railKind` is present in the TS encoder (`:1465`) but absent from the Rust mirror (`script_library.rs:1382-1517`), so the stated byte-for-byte parity may already diverge for documents containing a reveal rail | 1 | If true, the parity gap is pre-existing; if the planner adds canonical terms without a mirror it widens |
| A3 | The inspector row (`PhysicsPaintScriptsPanel.tsx:133-145`) is the intended home for the affordance | 4 | A different placement is still allowed (Claude's discretion) |

## Open Questions (RESOLVED)

1. **Progressive single-key re-bake cost.** Prefix bake to slot *k* is O(k) frames; a 40-frame rail re-baking frame 39 is nearly a full rail bake. RESOLVED: accepted for the quick — the plan bakes the prefix and takes `staged[slot]` (planning decision 1), adding no renderer entry point; latency stays a follow-up only if visible.
2. **Static per-key overrides on a Paint rail.** Static bakes one settled wash and poses per frame; a per-key motion override means re-posing that one frame — cheap and supported by `bakeAquarelleScript`'s static branch (`:1360-1409`). RESOLVED: static rails accept a motion-only per-key override; colorize / `photoWiggle` are reveal-only members of the override shape, and the plan's renderer slice handles both variants.
3. **Regenerate with protected keys.** Should the protected keys be re-baked (keeping their overrides) or left as pixels while the rest of the rail is regenerated? RESOLVED: "untouched" means the pixels stay — the plan substitutes the protected keys' accepted records back into the regenerate publication, and their overrides are cleared only when the user ticks the explicit discard.

## Sources

All findings are in-repo, read this session with `Read` (line ranges cited inline). No external/Context7 sources were needed — this is a closed internal contract.
- `app/src/components/physic-paint/roto/physicsPaintRotoPhysicalModel.ts`
- `app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.ts`
- `app/src/components/physic-paint/roto/physicsPaintRotoGroupLifecycle.ts`
- `app/src/components/physic-paint/roto/physicsPaintRotoRailSetCopy.ts`
- `app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptRenderer.ts`
- `app/src/components/physic-paint/hooks/useRotoPhysicalEditCoordinator.ts`, `useRotoPhysicalEditHistory.ts`
- `app/src/components/physic-paint/view/PhysicsPaintPlayScriptDialog.tsx`, `PhysicsPaintLoopClipRail.tsx`, `PhysicsPaintScriptsPanel.tsx`, `PhysicsPaintWorkflowStrip.tsx`
- `app/src/components/physic-paint/PhysicsPaintStudio.tsx`
- `app/src/stores/efxPaintStore.ts`, `app/src/stores/physicPaintStore.ts`
- `app/src-tauri/src/services/script_library.rs`, `app/src-tauri/src/lib.rs`
- `.planning/PROJECT.md`

## Metadata

**Confidence breakdown:**
- Persistence/validator recipe: HIGH — read at the exact lines, with the colorize/photoWiggle precedent test-pinned.
- Apply/regenerate flow: HIGH — controller read end-to-end for both paths.
- Entry point: MEDIUM — the selection-exclusivity and button structure are verified; placement remains discretion.
- Pitfalls: HIGH — enumerated by reading every propagation site.

**Research date:** 2026-10-30
**Valid until:** until the Loop Clip record or Play Script controller changes (fast-moving; re-read if > 30 days)
