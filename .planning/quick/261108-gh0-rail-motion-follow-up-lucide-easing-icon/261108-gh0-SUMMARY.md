---
phase: 261108-gh0-rail-motion-follow-up-lucide-easing-icon
plan: 01
subsystem: rail-motion
tags: [rail-motion, easing, lucide-icons, wiggle, motion-sheet, tool-strip, canonical-fixture, quick-task]
requires:
  - phase: 59-rail-motion-channels-v7-interface
    provides: Rail-motion model/evaluator/commands/store/hook/view stack, canonical TS↔Rust encoder and golden fixture, floating Motion sheet and lane markers
  - phase: 261108-d5o-new-ease-motion-from-phase-59-rail-motio
    provides: Four easing tokens, shared four-button easing control, key-mode Motion sheet easing row, snap-frame memo threaded to the evaluator
  - phase: 261107-qgj-rail-motion-motion-sheet-and-lane
    provides: The properties-driven floating Motion sheet and lane motion-key markers
provides:
  - Channel-level `wiggle` (0..1,000,000) and `wiggleGlobal` (boolean) on PhysicPaintRotoRailMotionChannel through the TS model, both canonical encoders, the Rust validator and the golden fixture
  - Tolerant read / canonical write persistence with no migration and no write-back
  - Two-mode evaluator wiggle law (global whole-timeline vs per-key outgoing span) on a pure seeded hash sampled at the snapped frame
  - `set-channel-wiggle` and `set-easing-all-keys` model edits/commands with one commit each through commitRailMotionRecords
  - Motion sheet rows for per-channel Wiggle + Global toggle, Apply to all keys, and a labelled Reset button
  - One exported Lucide easing-icon mapping shared by the sheet buttons and every lane motion-key marker
  - Tool-strip Motion-key easing/Wiggle controls and their plumbing removed; typecheck proves the deletion
affects: [59-rail-motion-channels-v7-interface, rail-motion UAT, Motion sheet, lane markers, tool strip]
actuals:
  tokens: 62301
  tasks: 5
  commits: 6
  plan_head_before: 7224b43255e9feb76fbec97f970b42d7fd0118c0
  plan_head_after: 0d71300faa5ad66b04e9b81717f868993ebe999e
tech-stack:
  added: []
  patterns:
    - "Tolerant read, canonical write: both readers default an absent member (0 / true) and rewrite nothing; both encoders always emit the pair"
    - "One cross-language byte order: channel id, wiggle binary64, wiggleGlobal 0|1, key count, keys"
    - "Pure seeded wiggle: hash(railId|channelId|keyFrame) sampled at integer frames and smoothstepped; no wall-clock, randomness or carried state"
    - "ONE token-to-icon mapping in the shared control; the lane imports it instead of declaring its own table"
    - "Every channel rebuild spreads the parsed entry; only explicit seeds write 0 / true"
key-files:
  created: []
  modified:
    - app/src/components/physic-paint/roto/railMotionModel.ts
    - app/src/components/physic-paint/roto/railMotionEvaluator.ts
    - app/src/components/physic-paint/roto/railMotionCommands.ts
    - app/src/components/physic-paint/roto/physicsPaintRotoPhysicalModel.ts
    - app/src/components/physic-paint/hooks/useRotoPhysicalEditCoordinator.ts
    - app/src/components/physic-paint/hooks/useRotoTimelineActions.ts
    - app/src/components/physic-paint/view/physicsPaintKeyRailPresentation.ts
    - app/src/components/physic-paint/view/PhysicsPaintRailMotionEasingControl.tsx
    - app/src/components/physic-paint/view/PhysicsPaintRailMotionModal.tsx
    - app/src/components/physic-paint/view/TimelineMotionChannels.tsx
    - app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.tsx
    - app/src/components/physic-paint/physicsPaintStudio.css
    - app/src/lib/__fixtures__/railMotionCanonical.golden.json
    - app/src-tauri/src/services/script_library.rs
key-decisions:
  - "Tolerant read, canonical write: an absent wiggle defaults to 0 and an absent wiggleGlobal to true, and neither reader writes anything back; present wrong types still fail closed"
  - "The canonical channel byte order is stated once on both sides (id, wiggle, wiggleGlobal, key count, keys), so the prepare gate accepts a save from either authority"
  - "Global wiggle uses keyFrame 0 as the hash seed; per-key wiggle keeps the outgoing key's frame. Both reuse segment.sampleFrame, which is already snapped under Stop Motion"
  - "Global ON adds the channel wiggle at EVERY evaluated frame, including before the first key; Global OFF preserves the prior per-key outgoing-span law byte-identically and ignores the channel value"
  - "Apply to all keys rewrites ONLY easing on every key of every channel of the selected rail's motion record, in one edit and one commit; frame, value and per-key wiggle survive"
  - "The lane marker's Lucide icon is aria-hidden with pointer-events none so the marker keeps its click/drag gestures and 6 px geometry"
  - "The tool strip's Motion-key easing/Wiggle surface and hook actions are deleted, not hidden or disabled: the Motion sheet is the only editor"
  - "The lane suite pins marker icon identity through RAIL_MOTION_EASING_ICONS only; it does not import the Lucide easing icons, keeping one token-to-icon authority"
requirements-completed: [QUICK-261108-GH0]
coverage:
  - id: D1
    description: "Both channel members travel through the TS model: the type, the widened channel allowlist, the tolerant parser, the canonicalizer validation/freeze, the TS canonical encoder, every channel rebuild site, both creation seeds and cloneRailMotions."
    requirement: QUICK-261108-GH0
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/roto/railMotionModel.test.ts, app/src/components/physic-paint/roto/physicsPaintRotoPhysicalModel.test.ts, app/src/components/physic-paint/hooks/useRotoPhysicalEditCoordinator.test.ts"
        status: pass
      - kind: unit
        ref: "pnpm --filter efx-motion-editor run typecheck"
        status: pass
    human_judgment: false
  - id: D2
    description: "The Rust validator tolerantly accepts absent/partial members with the 0/true defaults, rejects every present-but-invalid shape, emits the same byte layout, and the deliberately re-derived golden fixture plus save/reopen round-trip prove wiggle 12 / wiggleGlobal false survives."
    requirement: QUICK-261108-GH0
    verification:
      - kind: unit
        ref: "cargo test --manifest-path app/src-tauri/Cargo.toml script_library::tests (27 lib tests passed)"
        status: pass
      - kind: unit
        ref: "app/src/lib/railMotionCanonicalParity.test.ts, app/src/lib/railMotionPackageRoundTrip.test.ts, app/src/lib/railMotionExportParity.test.ts (40 tests)"
        status: pass
      - kind: unit
        ref: "app/src/stores/efxPaintPersistenceRailMotionRoundTrip.test.ts (3 tests)"
        status: pass
    human_judgment: false
  - id: D3
    description: "The evaluator implements exactly two wiggle modes: Global ON shakes every frame from a keyFrame-0 seed at the snapped sample frame (including before the first key); Global OFF reproduces the per-key outgoing-span wiggle unchanged. The module stays pure and every snapFrames argument keeps flowing."
    requirement: QUICK-261108-GH0
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/roto/railMotionEvaluator.test.ts (261108-gh0 two-mode wiggle rows)"
        status: pass
      - kind: unit
        ref: "grep purity tripwire: railMotionEvaluator.ts has no store/signal/Preact reference"
        status: pass
    human_judgment: false
  - id: D4
    description: "set-channel-wiggle and set-easing-all-keys are pure model edits with commands; the hook exposes one commit path each through commitRailMotionRecords; the dialog bundle carries per-channel wiggle rows and a key-mode-only apply-all."
    requirement: QUICK-261108-GH0
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/roto/railMotionCommands.test.ts, app/src/components/physic-paint/hooks/useRotoTimelineActions.test.ts, app/src/components/physic-paint/view/physicsPaintKeyRailPresentation.test.ts"
        status: pass
    human_judgment: false
  - id: D5
    description: "The sheet shows Diamond/Square/Squircle/Triangle buttons, one Wiggle + Global row per present channel, Apply to all keys and a visible Reset label; every lane key marker shows its own easing icon; the tool strip no longer shows easing or Wiggle; property-only mode renders no easing row."
    requirement: QUICK-261108-GH0
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/view/PhysicsPaintRailMotionEasingControl.test.ts, PhysicsPaintRailMotionModal.test.ts, TimelineMotionChannels.test.ts, PhysicsPaintWorkflowStrip.test.ts"
        status: pass
    human_judgment: true
    rationale: "Icon legibility, marker centring, row rhythm and the visible absence of the strip controls are visual judgments in the running Studio; automated green is not done."
  - id: D6
    description: "A project authored before this quick still opens with its stored keys behaving exactly as before, and a project saved after it reopens with per-channel wiggle and the Global flag intact."
    requirement: QUICK-261108-GH0
    verification: []
    human_judgment: true
    rationale: "Live open/save/reopen of a pre-quick project in the native app is the only proof of the tolerant-read promise; the golden fixture and round-trip guard cover bytes, not the document the user has on disk."
metrics:
  duration: 25min (first→last task commit)
  completed: 2026-11-08
status: complete
---

# Quick 261108-gh0: Rail Motion Follow-up — Lucide Easing Icons and the Motion Sheet's Easing/Wiggle Consolidation — Summary

**The rail-motion channel gained a whole-timeline wiggle pair (`wiggle` + `wiggleGlobal`, tolerant-read / canonical-write in TS and Rust), the evaluator now has exactly two wiggle modes, and the Motion sheet became the sole easing/wiggle editor with Lucide Diamond/Square/Squircle/Triangle buttons, per-channel Wiggle + Global rows, Apply to all keys and a labelled Reset — while every lane key marker now carries its own easing icon from the one shared mapping.**

## Performance

- **Duration:** 25 min measured between the first and last task commit (execution also included read/audit work before the first commit)
- **Started:** 2026-11-08T11:37:23Z (first task commit)
- **Completed:** 2026-11-08T12:02:02Z (final test commit)
- **Tasks:** 5 (plus one verification follow-up commit)
- **Files changed:** 42 unique files (0 production files created; all modifications)
- **Commits:** 6 measured from the plan ledger

## Accomplishments

### Task 1 — Channel members through the model, TS canonical bytes and the committed edit path (`e6728eb07`)

- `PhysicPaintRotoRailMotionChannel` carries `wiggle: number` (0..`RAIL_MOTION_WIGGLE_LIMIT` = 1,000,000) and `wiggleGlobal: boolean`.
- The parser is TOLERANT and non-migrating: `RAIL_MOTION_CHANNEL_KEYS` (`railMotionModel.ts:196`) now allows both members; an absent `wiggle` becomes `0` and an absent `wiggleGlobal` becomes `true` in the returned parsed channel, while a present wrong type still throws. The unknown-member sentence (`railMotionModel.ts:397`) names exactly `id, keys, wiggle, wiggleGlobal`. Nothing is written back to the stored document.
- `canonicalizeRailMotionChannels` validates both members (`isRailMotionWiggle`, strict boolean) and freezes the pair onto every channel.
- The TS canonical encoder (`physicsPaintRotoPhysicalModel.ts:1741-1753`) emits one byte order: channel id, wiggle as binary64, wiggleGlobal as `0|1`, key count, keys.
- `cloneRailMotions` (`useRotoPhysicalEditCoordinator.ts:758-772`) spreads the parsed channel instead of hand-copying `{ id, keys }`, so the launch snapshot, replay and rail-set paste carry both members; `railSetRailMotionsEqual` compares both (`:878-882`), making a wiggle-only difference a real edit.

### Task 2 — Rust validator/encoder, deliberate golden re-derivation, save/reopen round-trip (`ff52038ab`)

- Rust mirrors the TS parse: absent `wiggle` -> `0.0`, absent `wiggleGlobal` -> `true` (`script_library.rs:1698-1713`); present non-number / non-boolean is rejected with a field-naming sentence; out-of-range wiggle is rejected.
- The canonical Rust encoder emits the same `n<16 hex>;<0|1>;` pair between each channel id and its key count. The byte literal test expects `s5:scale;n0000000000000000;1;1:` and the partial/absent table expects `s5:scale;n4028000000000000;1;1:` / `s5:scale;n0000000000000000;0;1:`.
- The golden fixture was re-derived ONLY through the TypeScript authority and records why: the four rail-motion entries were re-derived with explicit default members on 18 channels, their revision strings recomputed, and the only source delta is one injected pair per channel. `rail-motion-channel-wiggle` was appended as the ninth document: no Loop Clips, position-x at `wiggle: 12` / `wiggleGlobal: false`, scale at `wiggle: 7` / `wiggleGlobal: true`. The four non-motion entries (`rail-kind`, `untouched`, `rail-kind-script`, `rail-motion-empty`) were not regenerated and their expected values did not move; the inspected Loop Clip population stays seven.
- The persistence round-trip suite pins a `wiggle 12 / wiggleGlobal false` channel across save, reopen and evaluate.
- Old-vs-new source delta on the four re-derived entries: `...s10:position-x;2:n<hex>;...` became `...s10:position-x;n0000000000000000;1;2:n<hex>;...` — the wiggle pair inserted, keys untouched.

### Task 3 — Two-mode wiggle law in the pure evaluator (`7a9daac69`)

- `railMotionChannelValueAt` (`railMotionEvaluator.ts:240-266`) branches on `channel.wiggleGlobal`:
  - **Global ON:** `segment.value + channel.wiggle * railMotionWiggleAt(railId, channel.id, 0, segment.sampleFrame)`, applied at EVERY frame, including before the first key; per-key wiggle is ignored.
  - **Global OFF:** `segment.value + outgoing.wiggle * railMotionWiggleAt(railId, channel.id, outgoing.frame, segment.sampleFrame)`; byte-identical to the pre-quick law; the channel value is ignored.
- `railMotionWiggleAt` (`:508-524`) is a stable hash of `railId|channelId|keyFrame`, sampled at the two neighbouring integer frames and smoothstepped. It reads no store, signal, DOM, raster or wall clock.
- `segment.sampleFrame` is already the snapped frame under Stop Motion and the evaluated frame otherwise, so the global term inherits the snap law without extra threading; every `snapFrames` argument still flows.

### Task 4 — Commands, hook helpers and the dialog bundle (`73931266b`)

- `set-channel-wiggle`: validates the rail, channel, wiggle range and boolean flag; rewrites only the addressed channel's pair (`{ ...entry, wiggle, wiggleGlobal }`), leaving keys and siblings untouched.
- `set-easing-all-keys` (`railMotionModel.ts:966-992`, command `railMotionCommands.ts:811-837`): rewrites ONLY `easing` on every key of every channel of the selected rail's motion record; frame, value and per-key wiggle survive, and the grouped Position pair keeps identical frame sets. One model edit -> one history entry.
- Hook: `commitSelectedMotionChannelWiggle` and `commitMotionAllKeysEasing` both re-read live motion state, apply the pure command and commit exactly once through `commitRailMotionRecords`; rejection sentences flow back verbatim.
- `RailMotionDialogBundle` gains `channels: readonly RailMotionChannelWiggleRow[]` (channelId, label, wiggle, wiggleGlobal, setWiggle, setWiggleGlobal) and `applyEasingToAllKeys: ((easing) => string | null) | null` (key-mode only). The sheet's apply-all reuses the DISPLAYED easing token.

### Task 5 — Motion sheet consolidation, Lucide icons and tool-strip removal (`c22bda2fd`)

- `PhysicsPaintRailMotionEasingControl.tsx` exports the ONE frozen `RAIL_MOTION_EASING_ICONS` mapping: `linear -> Diamond`, `hold -> Square`, `ease -> Squircle`, `stop-motion -> Triangle`, each rendered at `size={12}` with `aria-hidden`. Accessible names, aria-pressed, disabled/describedby wiring, titles and `data-rail-motion-easing` are unchanged.
- `TimelineMotionChannels.tsx` imports that mapping and renders each marker's own icon at `max(4, keySize - 2)` with `strokeWidth={3}`, `aria-hidden` and `pointerEvents: 'none'`; the button keeps its 6 px geometry, inline-flex centring, click and drag. The ghost preview stays icon-free.
- The Motion sheet (`PhysicsPaintRailMotionModal.tsx:381-442`) renders, in order: per-key easing row (key mode only, absent in property mode), Apply to all keys, then one Wiggle + Global row per present channel using `SliderStepper` (0..1,000,000, step 1, precision 0). Global reflects `wiggleGlobal` through `aria-pressed`. The header Reset button gains the `--labelled` class and a visible `Reset` label while its aria-label and title stay.
- `PhysicsPaintWorkflowStrip.tsx`: `PhysicsPaintRotoMotionKeyControls` and its props interface are deleted together with the call site, the four availability locals, `motionSelectionScope`, `contextualRotoCommands`, `motionKeyScopeActive` and the now-unused imports. `useRotoTimelineActions.ts` drops the six strip-only public members (`setSelectedMotionKeyEasing` / `setSelectedMotionKeyWiggle` and their `canSet`/`DisabledReason` companions) and keeps `commitSelectedMotionKeyEasing` for the sheet.
- CSS: `.physics-paint-motion-apply-all`, `.physics-paint-motion-wiggle-row`, `.physics-paint-motion-wiggle-global` (incl. pressed tint) and `.physics-paint-stroke-settings-header-button--labelled` added using the existing sidebar palette; the sheet's 15 px body rhythm is untouched.

## Full channel-constructor audit

Every site that constructs or copies a channel was inspected; only explicit seeds write defaults, and every rebuild preserves stored fields.

| Site | Location | Behaviour |
|---|---|---|
| Tolerant parse | `railMotionModel.ts:405-425` | absent -> 0 / true; present wrong type throws; returns `{ id, keys, wiggle, wiggleGlobal }` without write-back |
| Canonicalizer freeze | `railMotionModel.ts:319-380` | validates wiggle/boolean, freezes stored pair |
| Animate seed | `railMotionModel.ts:684` | `wiggle: 0`, `wiggleGlobal: true` |
| Add-channel seeds | `railMotionModel.ts:879-886` | `wiggle: 0`, `wiggleGlobal: true` |
| Set-key addressed channel | `railMotionModel.ts:729-733` | `{ ...entry, keys: upsertRailMotionKey(...) }` — pair preserved |
| Set-key sibling rewrite | `railMotionModel.ts:734-762` | `{ ...entry, keys }` — pair preserved; new sibling key seeds per-key wiggle 0 |
| Remove-key | `railMotionModel.ts:779-800` | `{ ...entry, keys }` — pair preserved |
| Move-key | `railMotionModel.ts:842` | `{ ...entry, keys }` — pair preserved |
| Set-channel-wiggle | `railMotionModel.ts:~940` | `{ ...entry, wiggle, wiggleGlobal }` — only the addressed pair moves |
| Set-easing-all-keys | `railMotionModel.ts:966-992` | `{ ...entry, keys: keys.map(...) }` — pair preserved per channel |
| TS canonical encoder | `physicsPaintRotoPhysicalModel.ts:1741-1753` | emits id, wiggle, wiggleGlobal, key count, keys |
| Rust canonical encoder | `script_library.rs:1698-1713` + emitter | same order; tolerant read, strict present types |
| Launch/replay/paste clone | `useRotoPhysicalEditCoordinator.ts:758-772` | spreads the parsed channel |
| Rail-set equality | `useRotoPhysicalEditCoordinator.ts:868-890` | compares `wiggle` and `wiggleGlobal` |
| Test channel literals | all `channels: [` hits | typecheck-complete: any literal missing either member fails TS strict typecheck |

Rebuild-audit grep (`channels: \[ | channels: record.channels.map | channels: RAIL_A.channels.map`) shows production hits only at `railMotionEvaluator.ts:461` (probe wrapper), `railMotionModel.ts:693/905` (seeds) and `useRotoPhysicalEditCoordinator.ts:767` (clone); every test hit flows through a typed factory or carries both members (typecheck green).

## Literal sweeps and tripwires

- **`wiggle` sweep:** 908 hits across the expected model/evaluator/commands/hook/view/store/fixture/Rust files plus pre-existing non-motion brush/audio/aquarelle usages that this quick did not touch (none of those files are in the 42-file diff). No strip or header-column hit remains.
- **Easing-token sweep:** inside the rail-motion surface, hits are confined to the type/order/validator/default authority (`railMotionModel.ts`), the evaluator policy and switch arms, the shared control's icon map/labels/titles, the lane header comment and the golden fixture source. Other `linear`/`ease` hits in `app/src/lib` are pre-existing fade/audio/keyframe domains, unchanged.
- **Both-members audit:** `RAIL_MOTION_CHANNEL_KEYS` (`:196`), the unknown-member sentence (`:397`), `canonicalizeRailMotionChannels`, the TS encoder, the Rust validator and emitter, the golden fixture (23 channel objects: 18 re-derived + 5 in the ninth document; 24 grep hits including the provenance line), the four Rust unit fixtures (`scale_rotation_record`, `rail_motion_channel_with_members`, the tolerant table and the malformed tables), the byte literal (`...;n0000000000000000;1;1:...`) and the malformed tests (`canonical_rail_motions_rejects_present_invalid_channel_wiggle_members`, `canonical_rail_motions_rejects_each_malformed_case`) all name or exercise both members.
- **Purity:** `grep -n "physicPaintStore\|@preact/signals\|preact" railMotionEvaluator.ts` returns nothing; the same grep plus hook/state patterns on `PhysicsPaintRailMotionEasingControl.tsx` returns nothing while its `lucide-preact` import is present at line 18.
- **Single-source icon tripwire:** `Squircle` appears in exactly one production module (`PhysicsPaintRailMotionEasingControl.tsx`, lines 14/18/43), its own test, and the lane suite's negative assertions (`not.toContain('Squircle')` and the token->icon-table regex). `TimelineMotionChannels.tsx` imports `RAIL_MOTION_EASING_ICONS` (`:40`) and reads it at `:406`; the lane suite does not import the Lucide easing icons.
- **No-migration:** the `railMotionModel.ts` diff shows the defaults only in parse return values (`rawWiggle === undefined ? 0`, `rawWiggleGlobal === undefined ? true`) and creation seeds; no load-time channel rewrite, no stored per-key wiggle coercion, no default written back.
- **Scope:** all 42 changed files are declared in the plan's `files_modified` (including the three review-added files `useRotoPhysicalEditCoordinator.ts`, `useRotoPhysicalEditCoordinator.test.ts`, `PhysicsPaintTrackRow.test.tsx`); `app/src/lib/railMotionDependencySurface.test.ts` and `app/src/components/physic-paint/roto/railMotionPivot.ts` are absent from the diff. `PhysicsPaintTrackRow.test.tsx` is typecheck-only, as planned (vitest collects `src/**/*.test.ts`).

## Gate results

| Gate | Result |
|---|---|
| Typecheck (`tsc --noEmit`) | pass, no errors |
| Full vitest suite (post-trim) | 401 files passed, 2 skipped; 8191 tests passed, 1 skipped, 96 todo; exit 0 |
| Persistence guards (canonical / package / export parity) | 3 files, 40 tests passed |
| Persistence round-trip | 1 file, 3 tests passed |
| Rust `script_library::tests` | 27 lib tests passed, 0 failed; integration targets filtered, 0 failed |
| Lane suite after the single-source trim | 55 tests passed |
| Task 5 targeted suites | 284 tests passed (control, modal, lane, strip); hook suite 207 passed; typecheck clean |

## Fixture provenance delta

Recorded in the fixture itself (line 3). Old sources for the four rail-motion documents carried each channel as `s<id>;<key count>:<keys>`; the new sources carry `s<id>;n<16-hex>;<0|1>;<key count>:<keys>`, i.e. one injected wiggle pair per channel. The four re-derived documents' revisions and expected project equality were recomputed from the TypeScript authority. The ninth document `rail-motion-channel-wiggle` (position-x 12/false, scale 7/true) was appended. Deleted golden lines are exactly the provenance line plus the four re-derived entries' `revision`, `expectedSource` and `expectedProject` lines — no non-motion entry moved.

## Task Commits

Measured via the plan ledger: base `7224b43255e9feb76fbec97f970b42d7fd0118c0`, HEAD `0d71300faa5ad66b04e9b81717f868993ebe999e`, `git rev-list --count` = **6**.

1. `e6728eb07` — **Task 1:** carry the channel wiggle pair through the model, canonical bytes and the committed edit path.
2. `ff52038ab` — **Task 2:** emit the channel wiggle pair in the canonical source and re-derive the golden fixture.
3. `7a9daac69` — **Task 3:** evaluate the two-mode channel wiggle law.
4. `73931266b` — **Task 4:** add channel wiggle and apply-all commands with bundle rows.
5. `c22bda2fd` — **Task 5:** lucide easing icons, lane easing markers, and the Motion sheet's easing/wiggle rows.
6. `0d71300fa` — **Verification follow-up:** pin the lane icon mapping without a second icon import.

No docs commit was created by the executor: SUMMARY/STATE/PLAN artifacts are left to the orchestrator, and ROADMAP.md was not updated.

## Files Created/Modified

Modified (production): `railMotionModel.ts` (type, allowlist, tolerant parse, canonicalizer, seeds, rebuild preservation, two new edits), `physicsPaintRotoPhysicalModel.ts` (canonical bytes), `railMotionEvaluator.ts` (two-mode law + wiggle hash), `railMotionCommands.ts` (two commands), `useRotoPhysicalEditCoordinator.ts` (clone spread + equality), `useRotoTimelineActions.ts` (wiggle/apply-all helpers, bundle rows, strip actions removed), `physicsPaintKeyRailPresentation.ts` (channel rows + apply-all contract), `PhysicsPaintRailMotionEasingControl.tsx` (Lucide mapping), `TimelineMotionChannels.tsx` (marker icons), `PhysicsPaintRailMotionModal.tsx` (easing/apply-all/wiggle rows + labelled Reset), `PhysicsPaintWorkflowStrip.tsx` (strip controls removed), `physicsPaintStudio.css` (button/row rules), `railMotionCanonical.golden.json` (four re-derived + one appended document), `script_library.rs` (tolerant validator, encoder, unit fixtures).

Modified (tests): `railMotionModel.test.ts`, `railMotionEvaluator.test.ts`, `railMotionCommands.test.ts`, `physicsPaintRotoPhysicalModel.test.ts`, `useRotoPhysicalEditCoordinator.test.ts`, `useRotoTimelineActions.test.ts`, `physicsPaintKeyRailPresentation.test.ts`, `PhysicsPaintRailMotionEasingControl.test.ts`, `PhysicsPaintRailMotionModal.test.ts`, `TimelineMotionChannels.test.ts`, `PhysicsPaintWorkflowStrip.test.ts`, `PhysicsPaintTrackRow.test.tsx`, `physicsPaintTrackHeaderColumn.test.ts`, `railMotionCanonicalParity.test.ts`, `railMotionPackageRoundTrip.test.ts`, `railMotionExportParity.test.ts`, `railMotionGateBEdits.test.ts`, `efxPaintPersistenceRailMotionRoundTrip.test.ts`, `railMotionPersistence.test.ts`, `railMotionDocumentReconciler.test.ts`, `railMotionIdentity.test.ts`, `physicsPaintRotoRailSetCopy.test.ts`, `physicsPaintRotoRailMotionHistory.test.ts`, `physicsPaintBridgeTransport.test.ts`, `physicPaintBridge.test.ts`, `efxPaintStore.reveal.test.ts`, `physicPaintStore.rotoRailMotions.test.ts`, `trackIsolation.test.ts`.

## Decisions Made

- **Tolerant read / canonical write, no migration.** Absent members default on read in both languages and are never written back; both encoders always emit the pair.
- **One byte order on both sides.** id, wiggle binary64, wiggleGlobal `0|1`, key count, keys; the golden fixture is re-derived from the TypeScript authority only.
- **Global wiggle seed = keyFrame 0, per-key seed = outgoing frame.** Both sample at `segment.sampleFrame`, which already encodes the Stop Motion snap.
- **Apply-all only rewrites easing.** Frames, values and per-key wiggle survive; one edit, one commit, one undo step.
- **One icon authority.** The shared control exports the mapping; the lane imports it; the lane suite verifies marker identity through the mapping without a second Lucide import.
- **Delete, do not hide, the strip surface.** Typecheck plus module-surface assertions prove the strip easing/Wiggle plumbing is gone.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Lane icon identity assertion compared against the wrong component**
- **Found during:** Task 5 (lane marker icons)
- **Issue:** `materialize()` invokes the outer Lucide component and returns Lucide's inner `Icon`, so `expected [Function Component] to be [Function Icon]` failed even though the vnode carried the right component.
- **Fix:** Assert component identity/size/strokeWidth/style on the RAW vnode tree; keep geometry and gesture assertions on the materialized tree.
- **Files modified:** `app/src/components/physic-paint/view/TimelineMotionChannels.test.ts`
- **Verification:** lane suite green (55 tests).
- **Committed in:** `c22bda2fd` (Task 5 commit)

**2. [Rule 1 - Bug] Hook delegation-count pin described the removed strip action**
- **Found during:** Task 5 (tool-strip removal)
- **Issue:** the old test expected two `commitSelectedMotionKeyEasing(` delegations; after the strip action was deleted only the bundle's `keyEasing.set` delegate remains.
- **Fix:** retitled the test and asserted the strip action is absent with exactly one remaining delegation.
- **Files modified:** `app/src/components/physic-paint/hooks/useRotoTimelineActions.test.ts`
- **Verification:** hook suite green (207 tests).
- **Committed in:** `c22bda2fd` (Task 5 commit)

**3. [Rule 1 - Verification tripwire] Removed a second easing-icon import from the lane suite**
- **Found during:** final single-source icon tripwire (verification item 8)
- **Issue:** the lane suite imported `Diamond, Square, Squircle, Triangle` from `lucide-preact` and re-pinned the mapping identities, which made it a second easing-icon consumer; the tripwire requires exactly one production module (the shared control) plus its test.
- **Fix:** dropped the Lucide import and the redundant identity-pin test; the lane suite still asserts each marker's icon identity through `RAIL_MOTION_EASING_ICONS[key.easing]` and pins raw-tree size/stroke/aria-hidden/style.
- **Files modified:** `app/src/components/physic-paint/view/TimelineMotionChannels.test.ts`
- **Verification:** lane suite 55 passed; full suite 8191 passed; typecheck clean.
- **Committed in:** `0d71300fa` (verification follow-up; kept as its own commit rather than amending the recorded Task 5 commit)

---

**Total deviations:** 3 auto-fixed (3 Rule 1)
**Impact on plan:** All three were assertion-shape corrections required for the plan's own verification tripwires; no product behaviour changed, no new scope.

## Issues Encountered

- Lucide components are context consumers; they cannot be invoked directly outside Preact's dispatcher and are not identity-preserved through `materialize()`. Tests that need component identity must inspect the raw vnode tree.
- The full suite lost exactly one test (8192 -> 8191) because the redundant lane identity-pin test was removed; nothing was skipped or disabled.

## User Setup Required

None — no dependency added, upgraded or installed; `lucide-preact@1.57.0` was already present and imports verified before use.

## Known Stubs

None. No TODO/FIXME/placeholder or empty-data wiring was introduced.

## Next Phase Readiness

Automated-ready; live visible UAT is the remaining gate:

- Four easing buttons show Diamond / Square / Squircle / Triangle; every lane marker shows its own easing icon; hovering still names the mode; dragging a key still works and the icon never steals the click.
- The tool strip no longer shows easing or Wiggle; the Motion sheet does; property-only mode renders no easing row.
- Global ON shakes the whole rail including before the first key; Global OFF falls back to the per-key span wiggle.
- Apply to all keys with Linear selected makes every key of every channel Linear in one undo step.
- Reset is labelled and still resets; per-channel wiggle and the Global flag survive save/reopen; a pre-quick project still opens and behaves exactly as stored.

---

*Phase: 261108-gh0-rail-motion-follow-up-lucide-easing-icon*
*Completed: 2026-11-08*

## Self-Check: PASSED

- SUMMARY exists at the expected path.
- All six commits are ancestors of HEAD: `e6728eb07`, `ff52038ab`, `7a9daac69`, `73931266b`, `c22bda2fd`, `0d71300fa`.
- The plan ledger measures 6 commits from `7224b43255e9feb76fbec97f970b42d7fd0118c0` to `0d71300faa5ad66b04e9b81717f868993ebe999e`.
- Working tree contains only the pre-existing unstaged PLAN.md amendment and the new SUMMARY.md; the executor committed neither.

---

## UAT APPROVED — 2026-11-08

The user ran the live UAT and approved. Four follow-up rounds landed after the
initial verification, all driven by that UAT:

| Commit | Change |
|--------|--------|
| `96730a069` | Icon-only lane keys (no filled box), motion-wide easing row reachable in property mode, title-case Reset, Global toggle aligned to the slider bar |
| `b0aadda23` | The Keys TABLE — four rows, each with `[Key N]` and `[All]` targets; Position / Keys / Wiggle bordered sections; Reset at body-label metrics; filled lane glyphs |
| `4d8d021d6` | Property mode targets the key under the PLAYHEAD, so `[Key N]` is live without a lane selection first |
| `94b246ed7` | Wiggle sliders span the project width/height (Position) or the channel's display span (Scale/Opacity = 1, Rotation = 180°) instead of the stored 0..1,000,000 cap; sheet auto-heights its sections on first open; section margin bottom-only; selected easing uses the orange selection language |

Superseded by those rounds: the single four-glyph button strip, the separate
"Apply to all keys" button (now the per-row `[All]`), and the blue pressed tint.
The locked laws from the plan are unchanged: stop-motion default, the sampled
linear ramp at displayed real paint-key frames, per-channel `wiggle` +
`wiggleGlobal`, and one easing write authority.
