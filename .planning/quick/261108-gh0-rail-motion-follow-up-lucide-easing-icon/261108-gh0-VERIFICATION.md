---
phase: 261108-gh0-rail-motion-follow-up-lucide-easing-icon
verified: 2026-11-08T12:10:31Z
status: passed
score: 7/7 must-haves verified
covered_files:
  - ".planning/quick/261108-gh0-rail-motion-follow-up-lucide-easing-icon/261108-gh0-PLAN.md"
  - ".planning/quick/261108-gh0-rail-motion-follow-up-lucide-easing-icon/261108-gh0-SUMMARY.md"
  - "app/src-tauri/src/services/script_library.rs"
  - "app/src/components/physic-paint/bridge/physicsPaintBridgeTransport.test.ts"
  - "app/src/components/physic-paint/hooks/physicsPaintRotoRailMotionHistory.test.ts"
  - "app/src/components/physic-paint/hooks/useRotoPhysicalEditCoordinator.test.ts"
  - "app/src/components/physic-paint/hooks/useRotoPhysicalEditCoordinator.ts"
  - "app/src/components/physic-paint/hooks/useRotoTimelineActions.test.ts"
  - "app/src/components/physic-paint/hooks/useRotoTimelineActions.ts"
  - "app/src/components/physic-paint/physicsPaintStudio.css"
  - "app/src/components/physic-paint/roto/physicsPaintRotoPhysicalModel.test.ts"
  - "app/src/components/physic-paint/roto/physicsPaintRotoPhysicalModel.ts"
  - "app/src/components/physic-paint/roto/physicsPaintRotoRailSetCopy.test.ts"
  - "app/src/components/physic-paint/roto/railMotionCommands.test.ts"
  - "app/src/components/physic-paint/roto/railMotionCommands.ts"
  - "app/src/components/physic-paint/roto/railMotionDocumentReconciler.test.ts"
  - "app/src/components/physic-paint/roto/railMotionEvaluator.test.ts"
  - "app/src/components/physic-paint/roto/railMotionEvaluator.ts"
  - "app/src/components/physic-paint/roto/railMotionIdentity.test.ts"
  - "app/src/components/physic-paint/roto/railMotionModel.test.ts"
  - "app/src/components/physic-paint/roto/railMotionModel.ts"
  - "app/src/components/physic-paint/roto/railMotionPersistence.test.ts"
  - "app/src/components/physic-paint/view/PhysicsPaintRailMotionEasingControl.test.ts"
  - "app/src/components/physic-paint/view/PhysicsPaintRailMotionEasingControl.tsx"
  - "app/src/components/physic-paint/view/PhysicsPaintRailMotionModal.test.ts"
  - "app/src/components/physic-paint/view/PhysicsPaintRailMotionModal.tsx"
  - "app/src/components/physic-paint/view/PhysicsPaintTrackRow.test.tsx"
  - "app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.test.ts"
  - "app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.tsx"
  - "app/src/components/physic-paint/view/TimelineMotionChannels.test.ts"
  - "app/src/components/physic-paint/view/TimelineMotionChannels.tsx"
  - "app/src/components/physic-paint/view/physicsPaintKeyRailPresentation.test.ts"
  - "app/src/components/physic-paint/view/physicsPaintKeyRailPresentation.ts"
  - "app/src/components/physic-paint/view/physicsPaintTrackHeaderColumn.test.ts"
  - "app/src/lib/__fixtures__/railMotionCanonical.golden.json"
  - "app/src/lib/physicPaintBridge.test.ts"
  - "app/src/lib/railMotionCanonicalParity.test.ts"
  - "app/src/lib/railMotionExportParity.test.ts"
  - "app/src/lib/railMotionGateBEdits.test.ts"
  - "app/src/lib/railMotionPackageRoundTrip.test.ts"
  - "app/src/stores/efxPaintPersistenceRailMotionRoundTrip.test.ts"
  - "app/src/stores/efxPaintStore.reveal.test.ts"
  - "app/src/stores/physicPaintStore.rotoRailMotions.test.ts"
  - "app/src/stores/trackIsolation.test.ts"
covered_digest: "v4:sha256:494a29f425d695f39496bf6128dbe7e9009a7e06126e4056c7fd01e46ac7966f"
behavior_unverified: 0
overrides_applied: 0
---

# Quick 261108-gh0 Verification Report

**Task Goal:** six user-locked Rail Motion changes — Lucide easing icons in the one shared control and on every lane key marker, easing + wiggle removed from the tool strip, per-channel `wiggle` + `wiggleGlobal` (default `true`) with a whole-timeline global mode falling back to the per-key span law, "apply easing to all keys" scoped to the whole motion, and a visible `Reset` label on the Motion sheet.

**Verified:** 2026-11-08T12:10:31Z
**Status:** passed
**Score:** 7/7 must-have truths verified
**Re-verification:** No — initial verification (no prior VERIFICATION.md exists for this quick task)

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | The ONE shared easing control renders lucide-preact icons (linear Diamond, hold Square, ease Squircle, stop-motion Triangle) at size 12 and `aria-hidden`, keeping the four-button order, word labels, titles, `aria-pressed`, disabled/`aria-describedby` wiring and `data-rail-motion-easing`; the control stays pure (no store, signal, hook or state), lucide-preact being the only new import. | ✓ VERIFIED | `PhysicsPaintRailMotionEasingControl.tsx:18` imports `Diamond, Square, Squircle, Triangle, type LucideIcon` from `lucide-preact`; `:38-45` exports the frozen `RAIL_MOTION_EASING_ICONS` table; `:47-59` keeps the labels/titles; `:64-87` emits the four buttons with size 12 + `aria-hidden="true"`. Purity pins in `PhysicsPaintRailMotionEasingControl.test.ts:152-162` pass (store/signals/hooks/state absent, lucide import present). Control suite green. |
| 2 | Exactly ONE token-to-icon mapping, exported from the shared control module; every `data-motion-key-frame` marker renders ITS OWN easing icon from that mapping, `aria-hidden` and pointer-transparent, keeping `aria-label` "Motion key at frame N", click/drag handlers and 6 px geometry. | ✓ VERIFIED | `TimelineMotionChannels.tsx:40` imports `RAIL_MOTION_EASING_ICONS`; `:403-442` renders `RAIL_MOTION_EASING_ICONS[key.easing]` inside each key button with `aria-hidden="true"` and `style.pointerEvents = 'none'`; `:408-433` keeps the button's label, pointer-down drag and click; `:327-347` keeps left/top/width/height/borderRadius/fill/rim and adds only inline-flex centring. `TimelineMotionChannels.test.ts:606-680` asserts per-key icon identity, size 12, aria-hidden, pointer-events none, and bans a second literal table in the lane source. |
| 3 | The tool strip renders no easing buttons and no Wiggle stepper: `PhysicsPaintRotoMotionKeyControls` and its props interface are gone with every orphaned local/import and the hook's strip-only actions; the floating Motion sheet is the only editor, with its key-mode easing row ABSENT (not disabled) in property-only mode. | ✓ VERIFIED | `grep` for `PhysicsPaintRotoMotionKeyControls`, `selectedMotionKeyAvailability`, `setSelectedMotionKeyEasing/Wiggle`, `canSetSelectedMotionKey*`, `motionSelectionScope`, `contextualRotoCommands`, `motionKeyScopeActive`, `data-rail-motion-easing`, `Selected Motion key` in `PhysicsPaintWorkflowStrip.tsx` and `useRotoTimelineActions.ts` returns zero. `pnpm typecheck` (with `noUnusedLocals`/`noUnusedParameters`) is green, proving no dead local survives. `PhysicsPaintWorkflowStrip.test.ts:3136-3161` pins the negative surface. The modal gates both easing rows on `keyEasing !== null` (key mode only), so property-only mode renders neither (`PhysicsPaintRailMotionModal.tsx:381-406`, bundle `useRotoTimelineActions.ts:3353-3366,3398-3400`). |
| 4 | Wiggle has exactly two modes: Global ON adds `channel.wiggle × railMotionWiggleAt(railId, channelId, 0, sampleFrame)` at EVERY frame including before the first key (sampleFrame = snapped frame under stop-motion, evaluated frame otherwise) and ignores per-key wiggle; Global OFF reproduces the previous per-key outgoing-span law byte-identically; clamping wraps the result; the evaluator stays pure. | ✓ VERIFIED | `railMotionEvaluator.ts:249-265`: `channel.wiggleGlobal ? (wiggle===0 ? segment.value : segment.value + wiggle*wiggleAt(railId, id, 0, segment.sampleFrame)) : <unchanged pre-change expression>`; clamp at `:265`. Before the first key `resolveRailMotionSegment` returns `{value:first.value, outgoingKey:null, sampleFrame:frame}` (`:158`), so the global term applies there too. Behavioral tests `railMotionEvaluator.test.ts:428-527` assert exact equality against `railMotionWiggleAt` before/after the first key, the snapped-frame sample under stop-motion (`:465-489`), zero-amplitude exactness (`:491`), the unchanged per-key fallback (`:507-527`), and clamp-after-add (`:400-423,529`). Module header documents both modes; the file imports no store/signal/Preact/DOM/wall-clock source. |
| 5 | Both channel fields persist across the language boundary: BOTH readers tolerate an absent member (0 / true) without rewriting, reject a present wrong type, both canonical encoders always emit `id, wiggle, wiggleGlobal, keyCount, keys`, the golden fixture carries the members on every channel of the four pre-existing rail-motion documents plus a ninth document, its embedded provenance is rewritten, and a `wiggle 12 / wiggleGlobal false` channel survives save, reopen and evaluate identically. | ✓ VERIFIED | TS: allowlist `railMotionModel.ts:196`; tolerant parse `:405-417` (undefined → 0/true, present invalid throws, no write-back); canonicalizer validation/freeze `:364-382`; encoder order `physicsPaintRotoPhysicalModel.ts:1735-1758`. Rust: tolerant read `script_library.rs:1687-1713` (absent → 0.0/true, `null` present and rejected, range/type checked) and emission `:1839-1848`. Fixture: 9 documents; all 18 channels of the four rail-motion docs carry `wiggle`/`wiggleGlobal`; ninth `rail-motion-channel-wiggle` carries position-x 12/false and scale 7/true with `loopClips: []`; provenance names 261108-gh0. Round-trip: `efxPaintPersistenceRailMotionRoundTrip.test.ts:186-236` asserts the pair on both sides and byte-identical JSON + identical evaluation over frames 0..12. Gates green: parity 40 tests, round-trip 3 tests, cargo 27 lib tests. Composite check: removing every inserted `n0000000000000000;1;` from the four new `expectedSource` values reproduces the base-commit sources exactly; the four non-motion documents are byte-identical to base; all 9 stored revisions recompute from the TS authority (independent probe, then removed). |
| 6 | No edit and no committed payload resets a channel's wiggle: every channel-rebuilding edit preserves both members, `cloneRailMotions` spreads the parsed channel for launch snapshot/replay/rail-set paste, `railSetRailMotionsEqual` compares both, every creation path seeds 0/true, and stored per-key wiggle is never migrated or reinterpreted. | ✓ VERIFIED | Model rebuilds spread `...entry`: set-key addressed `railMotionModel.ts:727-733`, sibling existing `:734-744`, keyless-sibling `:750-756`, remove-key `:778-786`, move-key `:839-847`, set-channel-wiggle `:958-960`, set-easing-all-keys `:987-990`. Creation seeds 0/true: animate `:679-686`, add-channel `:879-886`. Coordinator: `useRotoPhysicalEditCoordinator.ts:761-771` spreads each parsed channel and clones keys; `:868-894` compares id, wiggle, wiggleGlobal, key count and per-key frame/value/easing/wiggle; a wiggle-only difference is a real edit. Per-key wiggle is parsed and preserved (`:458-463`), and the new edits only rewrite easing or the addressed channel pair. Tests: `railMotionModel.test.ts:1252-1395` (tolerance, canonicalize/freeze, every rebuild branch, seeds) and coordinator replay/paste rows in `useRotoPhysicalEditCoordinator.test.ts`. |
| 7 | Apply-to-all is ONE edit, ONE history entry and ONE commit through `commitRailMotionRecords`, sets the chosen easing on every key of every channel of the selected rail's motion, and the Motion sheet renders — in order — numeric fields, key-mode easing row, apply-all button, per-channel Wiggle sliders with a Global toggle, then the rejection paragraph; the Reset header button shows visible "Reset" while keeping aria-label/title/behaviour. | ✓ VERIFIED | Model `railMotionModel.ts:964-992` rewrites only easing on every key of every channel (throws on absent record/zero keys); command `railMotionCommands.ts:811-832` with the pinned rejection copy; hook `useRotoTimelineActions.ts:3299-3318` applies once and calls `commitRailMotionRecords` once with status `Motion easing applied to all keys.`; bundle rows `:3372-3401` keyed off `presentation.fields` presence with raw wiggle, sibling-preserving setters, and a key-mode-only apply-all. Modal order `PhysicsPaintRailMotionModal.tsx:354-445`: fields → easing group → apply-all (`physics-rail-motion-apply-all-easing`) → per-channel `SliderStepper` (0..1,000,000, step 1, precision 0, freeEntry, allowOutOfRangeEntry, commitOnRelease) + Global toggle (`data-motion-wiggle-global`, `aria-pressed`) → rejection alert. Reset `:328-340`: `--labelled` class, visible `<span>Reset</span>`, aria-label `Reset Motion values`, title, pointer-down stopPropagation and onClick. Tests assert one store commit and every-channel rewrite (`useRotoTimelineActions.test.ts:5980-6034`), the pinned body order (`PhysicsPaintRailMotionModal.test.ts:621-644`), the Reset text (`:384-390`) and the Global/apply-all rows. |

**Score:** 7/7 truths verified (0 present, behavior-unverified)

### Required Artifacts

| Artifact | Expected | Status | Details |
| -------- | -------- | ------ | ------- |
| `app/src/components/physic-paint/roto/railMotionModel.ts` | channel fields, tolerant parser, allowlist, canonicalizer, two seeds, rebuild preservation, two new edits | ✓ VERIFIED | `wiggle`/`wiggleGlobal` on the type; parse `:405-417`; allowlist `:196`; canonicalize/freeze `:364-382`; seeds `:679-686,879-886`; rebuilds spread `...entry`; `set-channel-wiggle` `:932-962`; `set-easing-all-keys` `:964-992` |
| `app/src/components/physic-paint/hooks/useRotoPhysicalEditCoordinator.ts` | cloneRailMotions spread; equality compares both members | ✓ VERIFIED | `:758-772` spreads channel; `:868-894` compares wiggle/wiggleGlobal |
| `app/src/components/physic-paint/roto/physicsPaintRotoPhysicalModel.ts` | encoder emits id, wiggle, wiggleGlobal, key count, keys | ✓ VERIFIED | `:1735-1758` |
| `app/src/components/physic-paint/roto/railMotionEvaluator.ts` | two-mode wiggle law on the evaluated value; header documents both modes | ✓ VERIFIED | `:249-265`; header `:21-31` |
| `app/src/components/physic-paint/roto/railMotionCommands.ts` | `setMotionChannelWiggle` + `setMotionAllKeysEasing`, rejection copy | ✓ VERIFIED | `:781-832`; no new `RailMotionCommandId` |
| `app/src/components/physic-paint/hooks/useRotoTimelineActions.ts` | two commit helpers, bundle channels rows, apply-all, strip actions removed | ✓ VERIFIED | `:3268-3318`, `:3372-3401`; strip-only surface absent |
| `app/src/components/physic-paint/view/physicsPaintKeyRailPresentation.ts` | `RailMotionChannelWiggleRow`, `channels`, `applyEasingToAllKeys` | ✓ VERIFIED | `:296-303`, `:341-347` |
| `app/src/components/physic-paint/view/PhysicsPaintRailMotionEasingControl.tsx` | ONE exported token→lucide mapping | ✓ VERIFIED | `:38-45`; consumed by modal and lane |
| `app/src/components/physic-paint/view/TimelineMotionChannels.tsx` | per-key easing icon, pointer-events none | ✓ VERIFIED | `:40`, `:403-442` |
| `app/src/components/physic-paint/view/PhysicsPaintRailMotionModal.tsx` | apply-all, per-channel Wiggle + Global, visible Reset | ✓ VERIFIED | `:328-340`, `:354-445` |
| `app/src/lib/__fixtures__/railMotionCanonical.golden.json` | members on all five channel arrays, recomputed revisions, ninth document, rewritten provenance | ✓ VERIFIED | 9 docs; 18+5 channels carry the pair; revised provenance; revisions recomputed |
| `app/src-tauri/src/services/script_library.rs` | tolerant parse with 0/true, wrong-type rejection, emission, fixtures, nine-name pin | ✓ VERIFIED | `:1616-1854`, `:3535-3742`, `:3370-3388` |

### Key Link Verification

| From | To | Via | Status | Details |
| ---- | -- | --- | ------ | ------- |
| TS canonical encoder | Rust `canonical_rail_motions` | same per-channel byte order (id, wiggle, wiggleGlobal, key count, keys) | WIRED | `physicsPaintRotoPhysicalModel.ts:1745-1748` and `script_library.rs:1838-1843`; canonical parity test compares Rust-computed source and hash to the TS-derived golden fixture (40 tests green) |
| TS tolerant parser / Rust validator | stored documents | absent → 0/true, present wrong type rejected, no write-back | WIRED | TS `railMotionModel.ts:405-417`; Rust `script_library.rs:1687-1713`; wrong-type/out-of-domain rows in both languages |
| Channel rebuild sites / `cloneRailMotions` | committed payloads + rail-set equality | spread `...entry`, equality compares both | WIRED | Model rebuild branches + coordinator `:761-771`; `:868-894`; model/coordinator tests green |
| `channel.wiggle` / `wiggleGlobal` | `railMotionChannelValueAt` | model record → evaluator; sampleFrame is already the snapped frame | WIRED | `railMotionEvaluator.ts:240-266` receives the channel object; global term uses `segment.sampleFrame` |
| Motion sheet controls | one write authority | bundle → hook helper → pure command → `commitRailMotionRecords` once | WIRED | `PhysicsPaintRailMotionModal.tsx:381-442` calls only bundle functions; `useRotoTimelineActions.ts:3268-3318,3372-3401`; one-commit tests |
| `TimelineMotionChannels.tsx` | `RAIL_MOTION_EASING_ICONS` | import from the shared control | WIRED | `TimelineMotionChannels.tsx:40,406`; source assertion at `TimelineMotionChannels.test.ts:670-680` bans a second table |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| -------- | ------------- | ------ | ------------------ | ------ |
| Motion sheet Wiggle rows | `row.wiggle`, `row.wiggleGlobal` | `physicPaintStore` rail-motion record → hook bundle (`useRotoTimelineActions.ts:3372-3389`) → modal `bundle.channels` | Yes — raw stored model values, setters commit through the command layer | ✓ FLOWING |
| Lane key markers | `key.easing` → `RAIL_MOTION_EASING_ICONS[key.easing]` | parsed rail-motion record projected into display lanes (`TimelineMotionChannels.tsx:403-443`) | Yes — per-key stored easing token | ✓ FLOWING |
| Apply-all button | displayed `keyEasing.easing` | selected key's stored easing → hook `keyEasing` → `applyEasingToAllKeys` | Yes — key-mode-only, commits to every key | ✓ FLOWING |
| Reset button | `bundle.reset` | presentation frame → store identity reset | Yes — existing write path | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| Full suite | `pnpm --filter efx-motion-editor exec vitest run` | 401 files passed / 2 skipped; 8191 tests passed, 1 skipped, 96 todo; exit 0 | ✓ PASS |
| Typecheck (also the strip/hook deletion proof) | `pnpm --filter efx-motion-editor run typecheck` | `tsc --noEmit`, no errors | ✓ PASS |
| Three persistence guards | `vitest run src/lib/railMotionCanonicalParity.test.ts src/lib/railMotionPackageRoundTrip.test.ts src/lib/railMotionExportParity.test.ts` | 3 files, 40 tests passed | ✓ PASS |
| Persistence round-trip (wiggle 12 / false survives reopen + evaluates identically) | `vitest run src/stores/efxPaintPersistenceRailMotionRoundTrip.test.ts` | 1 file, 3 tests passed | ✓ PASS |
| Rust validator/encoder suite | `cargo test --manifest-path app/src-tauri/Cargo.toml script_library::tests` | 27 lib tests passed, 0 failed; integration targets 0 matching | ✓ PASS |
| Golden fixture revision integrity | temporary probe recomputing `buildPhysicPaintRotoPhysicalRevision` for all 9 documents, then deleted | all 9 stored revisions equal recomputed values (incl. the four re-derived docs and the ninth) | ✓ PASS |
| Golden fixture delta scope | compare base fixture vs HEAD | four rail-motion sources = old source + one `n0000000000000000;1;` per channel; four non-motion docs byte-identical in document/source/project; only the four revisions + provenance + ninth doc moved | ✓ PASS |

### Probe Execution

No probes are declared for this quick task and `find scripts -path '*/tests/probe-*.sh'` returns none relevant. Step 7c: N/A.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| ----------- | ----------- | ----------- | ------ | -------- |
| QUICK-261108-GH0 | `261108-gh0-PLAN.md` | Six locked Rail Motion changes (Lucide icons on both surfaces, strip consolidation, per-channel whole-timeline wiggle + Global toggle, apply-to-all easing, visible Reset, deliberate cross-language persistence) | ✓ SATISFIED | All 7 must-have truths VERIFIED above; every automated gate green |

No orphaned requirements: the quick task declares a single requirement label and no REQUIREMENTS.md row exists for it (quick tasks are tracked by their own directory, not the milestone requirement list).

### Test Quality Audit

| Test File | Linked Req | Active | Skipped | Circular | Assertion Level | Verdict |
|-----------|-----------|--------|---------|----------|-----------------|---------|
| `PhysicsPaintRailMotionEasingControl.test.ts` | QUICK-261108-GH0 | 9 | 0 | No | Value/behavioral (component identity, size, aria, purity source pins) | PASS |
| `TimelineMotionChannels.test.ts` | QUICK-261108-GH0 | 55 | 0 | No | Value/behavioral (raw-vnode icon identity, style, source tripwire) | PASS |
| `PhysicsPaintWorkflowStrip.test.ts` | QUICK-261108-GH0 | — | 0 | No | Negative source + rendered tree | PASS |
| `PhysicsPaintRailMotionModal.test.ts` | QUICK-261108-GH0 | — | 0 | No | Value/behavioral (row order, apply-all, Global, Reset text) | PASS |
| `railMotionEvaluator.test.ts` | QUICK-261108-GH0 | — | 0 | No | Behavioral (exact equality against the production noise authority) | PASS |
| `railMotionModel.test.ts` | QUICK-261108-GH0 | — | 0 | No | Behavioral (tolerant read, every rebuild branch, seeds) | PASS |
| `useRotoTimelineActions.test.ts` | QUICK-261108-GH0 | 207 | 0 | No | Behavioral (one store commit, rejection, gating) | PASS |
| `railMotionCanonicalParity.test.ts` | QUICK-261108-GH0 | — | 0 | No (deliberate TS→Rust oracle with frozen provenance) | Value (frozen source/hash + nine-name pin) | PASS |
| `efxPaintPersistenceRailMotionRoundTrip.test.ts` | QUICK-261108-GH0 | 3 | 0 | No | Behavioral (save→reopen→evaluate equality) | PASS |

**Disabled tests on requirements:** 0 → no blocker. The single suite-wide skip is a pre-existing `it.skip` in `physicPaintBridge.test.ts:4026` (present at base `a3c059880`), unrelated to this quick's requirement; that file changed only for channel-literal defaults.
**Circular patterns detected:** 0 → no blocker. The golden fixture is intentionally TS-derived with a written provenance; independence is provided by the Rust encoder re-computing the source and hash, and by the base-commit source comparison above.
**Insufficient assertions:** 0.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| — | — | None. No `TBD`/`FIXME`/`XXX` in any file added or modified by the commits; no stub returns, placeholder handlers, hardcoded empty data or console-only implementations in the new/changed motion surfaces. | — | — |

### Human Verification Required

None required by this verification. Per the task directive, live visible UAT (icon legibility, marker centring, row rhythm, real-app save/reopen of a pre-quick project) remains the user's separate gate and is not a verification item here.

### Gaps Summary

No gaps. Every must-have truth holds against the actual code, all six key links are wired, both canonical encoders agree with the frozen golden fixture, and every required gate is green:

- Full suite: 401 files / 8191 tests passed, exit 0 (1 pre-existing skip, unrelated).
- Typecheck: no errors.
- Persistence guards: 40 tests passed; persistence round-trip: 3 tests passed.
- Rust: 27 lib tests passed, 0 failed.
- Golden fixture: nine documents, four deliberately re-derived with recomputed revisions, ninth non-default document, rewritten provenance; the four non-motion documents and `rail-motion-empty` did not move; the source delta is exactly one injected wiggle pair per channel.
- Scope: the diff touches only files declared in the plan's `files_modified`; `app/src/lib/railMotionDependencySurface.test.ts` and `app/src/components/physic-paint/roto/railMotionPivot.ts` are absent from the diff.

---

_Verified: 2026-11-08T12:10:31Z_
_Verifier: Claude (gsd-verifier)_
