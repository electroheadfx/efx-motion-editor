---
phase: 61-vector-painting-tool
plan: 06
subsystem: persistence
tags: [mce, field-contract, dual-language, vector-path, aqtl-v2, envelope, serde-rename, rel-02]

# Dependency graph
requires:
  - phase: 61-03
    provides: "vectorPath.ts — the one persisted vector-path shape (anchors + renderMode) that these declarations mirror"
  - phase: 61-05
    provides: "AQTL v2 field names (anchor x/y/kind/in/out/width, renderMode) that the wire key sets pin"
provides:
  - "MceAquarelleAnchor / MceAquarelleVectorPath declared in TypeScript (app/src/types/project.ts)"
  - "The matching Rust structs plus Vec2Wire, with `in_` renamed to the wire key `in` and `render_mode` to `renderMode`"
  - "expectMemberKeys rows for both new members, so a one-language drift is a red test rather than a review note"
  - "A lossless envelope round trip (deep-equal + byte-identical re-serialise) and an ALLOWED_ONE_LANGUAGE literal snapshot"
affects: [61-07, 61-09, model regeneration, script replay]

# Actuals (#2632) — measured on the plan's own scale (chars/4 over the realized diff)
actuals:
  tokens: 2841
  tasks: 2
  commits: 2
plan_head_before: fa948bb4176e9b125be27e404fe9825a4042e34e
plan_head_after: b34c7506bf5f840dc7415aa7690a343fa031d41b

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Declaration-only wire structs: a Rust struct with #[allow(dead_code)] documents a wire shape the opaque carrier never constructs, so serde cannot drop the key and the field-diff parser can see it"
    - "Keyword-safe wire keys: `in` is a Rust keyword, so the field is `in_` with a serde rename; the contract parser reads `pub <ident>:` and a raw identifier would be invisible to it"
    - "One parsed view per contract file: rust/ts surfaces and the expectMemberKeys helper live at module scope, so every phase block asserts against the same live source"
    - "Exception-list snapshot as a test literal: adding an ALLOWED_ONE_LANGUAGE entry is now a deliberate edit to a test, never a silent allowlist growth"

key-files:
  created: []
  modified:
    - app/src/types/project.ts
    - app/src-tauri/src/models/project.rs
    - app/src/lib/mceFieldContract.test.ts

key-decisions:
  - "The anchor handles are declared inline on the TS side (`in?: { x: number; y: number }`) and as a named `Vec2Wire` struct on the Rust side: the contract parser only enumerates Mce* members, so a named non-Mce TS helper would add ceremony without adding a pin"
  - "Rust anchor scalars are f32, matching the AQTL v2 wire, even though the neighbouring declaration-only structs use f64 — the declaration mirrors the codec, not the JSON parser"
  - "The contract helper was hoisted: rust/ts parsing and expectMemberKeys moved to module scope so the new Phase 61 block reuses them instead of becoming a third copy of the same code"
  - "The opaque-slot proof carries a key no declaration names (`futureEngineKey`), because the risk this row covers is a strict schema sneaking in beside the declarations, not corruption of a known key"
  - "No field was added to MceEngineStrokePayload: the engine slot stays `Record<string, unknown> | null` on the TS side and `Option<Value>` on the Rust side, so the vector keys ride the opaque carrier as 61-03/61-05 shipped them"

patterns-established:
  - "A new .mce member is declared twice before it is called done: the expectMemberKeys row is the definition of finished, not a follow-up"
  - "Every new declaration gets a no-new-exception assertion beside it, so the dual-language law cannot be satisfied by allowlisting the field"

requirements-completed: [VEC-06, REL-02]

coverage:
  - id: D1
    description: "The vector anchor and vector-path shapes exist as Mce* members in both languages with identical wire keys, including the `in` handle and the camelCase `renderMode`"
    requirement: VEC-06
    verification:
      - kind: unit
        ref: "app/src/lib/mceFieldContract.test.ts#Phase 61 vector field set (VEC-06 / REL-02) > declares the vector anchor shape in both languages"
        status: pass
      - kind: unit
        ref: "app/src/lib/mceFieldContract.test.ts#Phase 61 vector field set (VEC-06 / REL-02) > declares the vector path shape in both languages"
        status: pass
    human_judgment: false
  - id: D2
    description: "The Rust in-handle is declared as `in_` with `#[serde(rename = \"in\")]`, so the wire key `in` is visible to the contract parser and a raw identifier can never silently drop the field"
    requirement: REL-02
    verification:
      - kind: unit
        ref: "app/src/lib/mceFieldContract.test.ts#Phase 61 vector field set (VEC-06 / REL-02) > the in-handle wire key is the rename target of a named field, never a raw identifier"
        status: pass
    human_judgment: false
  - id: D3
    description: "An engine payload carrying a two-anchor vector path (one auto, one bezier with stored handles, one sparse 1.8 width factor, renderMode simple-ribbon) survives a JSON save/load deep-equal and byte-identical, and an unknown engine key survives untouched"
    requirement: REL-02
    verification:
      - kind: unit
        ref: "app/src/lib/mceFieldContract.test.ts#Phase 61 envelope round trip (REL-02) > carries a vector engine block through save/load deep-equal and byte-identical"
        status: pass
      - kind: unit
        ref: "app/src/lib/mceFieldContract.test.ts#Phase 61 envelope round trip (REL-02) > keeps the engine slot opaque: an unknown engine key round-trips untouched"
        status: pass
    human_judgment: false
  - id: D4
    description: "ALLOWED_ONE_LANGUAGE is unchanged and snapshotted literally, and no vector field claimed an exception entry"
    requirement: REL-02
    verification:
      - kind: unit
        ref: "app/src/lib/mceFieldContract.test.ts#Phase 61 envelope round trip (REL-02) > the one-language exception list is unchanged by this plan (literal snapshot)"
        status: pass
      - kind: unit
        ref: "app/src/lib/mceFieldContract.test.ts#Phase 61 vector field set (VEC-06 / REL-02) > did not claim a one-language exception for any vector field"
        status: pass
    human_judgment: false

metrics:
  duration: 3min
  completed: 2026-11-10
status: complete
---

# Phase 61 Plan 06: Vector Fields Under the Dual-Language Contract Summary

**The vector anchor and path shapes are now declared in TypeScript and Rust with identical wire keys, and the contract test proves it — a lossless envelope round trip, an unchanged exception list, and a still-opaque engine slot.**

## Performance

- **Duration:** 3 min
- **Started:** 2026-11-10T13:32:39Z
- **Completed:** 2026-11-10T13:35:12Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- `MceAquarelleAnchor` (`x`, `y`, `kind`, optional `in` / `out` / `width`) and `MceAquarelleVectorPath` (`anchors`, optional `renderMode`) join the TypeScript `.mce` surface; the matching Rust structs — plus a named `Vec2Wire` — join the Rust surface with the same wire key set.
- The Rust in-handle is `in_` with `#[serde(rename = "in")]`, because the contract parser reads `pub <ident>:` and a raw identifier would be invisible to it. The row asserts the rename target directly, plus the absence of `pub r#in` from the source.
- Two `expectMemberKeys` rows put both members under the same pin as every other `.mce` member; `diffMember` then rejects a partial declaration on either side.
- A two-anchor engine payload (one `auto`, one `bezier` with stored handles, one sparse 1.8 width factor, `renderMode: 'simple-ribbon'`) round-trips through `JSON.stringify` → `JSON.parse` deep-equal and byte-identical on re-serialisation, with exactly one `width` key surviving (D-10's uniform-stores-nothing law visible at the envelope layer).
- The opaque slot is proven still opaque: an engine key no declaration names (`futureEngineKey`) survives the same round trip, so the new declarations did not smuggle in a strict schema.
- `ALLOWED_ONE_LANGUAGE` is snapshotted literally (`['MceSequence.fps']`, size 1), so a future addition is a deliberate edit to the test rather than a silent allowlist entry.
- `MceEngineStrokePayload` is untouched on both sides — exactly `['engine']`, with the engine slot still typed `Record<string, unknown> | null` in TS and `Option<Value>` in Rust.

## Task Commits

Each task was committed atomically:

1. **Task 1: Declare the vector field set in both languages (tracer)** - `837473dbe` (feat)
2. **Task 2: Prove the envelope is lossless and the exception list did not grow** - `b34c7506b` (test)

**Plan metadata:** see the docs commit that follows this SUMMARY.

## Files Created/Modified

- `app/src/types/project.ts` - `MceAquarelleAnchor` and `MceAquarelleVectorPath`, each with a doc comment naming the AQTL v2 block it mirrors and restating the opaque-slot law
- `app/src-tauri/src/models/project.rs` - `Vec2Wire`, `MceAquarelleAnchor` (`in_` + serde rename) and `MceAquarelleVectorPath` (`render_mode` + serde rename), all `#[allow(dead_code)]` declaration-only structs
- `app/src/lib/mceFieldContract.test.ts` - parsed surfaces and `expectMemberKeys` hoisted to module scope; a Phase 61 vector-field block (two member rows, the rename row, the no-new-exception row) and a Phase 61 envelope-round-trip block (lossless round trip, unknown-key opacity, exception-list snapshot)

## Decisions Made

- **Inline handle type on the TS side, named struct on the Rust side.** The contract parser only enumerates `Mce*` members, so a named non-`Mce` TS helper would add ceremony without adding a pin; Rust needs a named struct anyway so the field-diff parser sees `x` / `y` rather than an unparsable tuple.
- **Rust anchor scalars are `f32`.** The neighbouring declaration-only structs (`McePaperDisplayState`, `MceAquarelleBrushProperties`) use `f64`, but these declarations mirror the AQTL v2 wire format (61-05), which is `f32`. The declaration follows the codec, not the JSON parser.
- **One parsed view for the whole contract file.** Hoisting `rust`, `ts` and `expectMemberKeys` to module scope let the Phase 61 block reuse them; a local copy would have been the third duplicate of the same six lines.
- **The opacity proof uses a key nothing declares.** `futureEngineKey` is deliberately not a plausible engine key — the threat this row covers (T-61-19) is a strict schema appearing beside the declarations, not corruption of a known field.
- **No host field was invented.** The two shapes are declarations of what rides inside `MceEngineStrokePayload.engine`; adding a typed member to the envelope would have contradicted D-11's one-engine opaque-slot law that 61-03 and 61-05 both preserved.

## TDD Gate Compliance

No task in this plan carried `tdd="true"` and the plan frontmatter is `type: execute`, so the RED/GREEN gate sequence does not apply. Task 1 is a `tracer` task executed like `auto`; Task 2 is test-only. The Tracer feedback gate was nevertheless run after Task 1 — the `<verify>` was re-run end-to-end on the committed tree and passed (`12/12`), so execution continued without a checkpoint (interactive mode, `human_verify_mode: end-of-phase`, automated-only verify).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] The contract helper and both parsed surfaces were hoisted to module scope**
- **Found during:** Task 1 (`End-to-end: declare the vector field set in both languages and make the contract test prove it`)
- **Issue:** The plan asks for two `expectMemberKeys` rows, but the helper and the `rust` / `ts` parses were declared inside the `Phase 56` describe block. A new Phase 61 describe could neither see them nor reuse them without a third copy of the helper plus two more `parse*` calls.
- **Fix:** `const rust` / `const ts` and `expectMemberKeys` moved to module scope (they are pure functions over the same two source strings); both existing describe blocks now read the module-level values, and the Phase 56 local copies were removed. Behaviour is unchanged — the Phase 56 rows still pass.
- **Files modified:** `app/src/lib/mceFieldContract.test.ts`
- **Verification:** the pre-existing nine contract tests still pass, and the file now reports 16 tests after both tasks.
- **Committed in:** `837473dbe` (Task 1)

---

**Total deviations:** 1 auto-fixed (1 Rule 3 blocking)
**Impact on plan:** Test-file structure only; no product surface, no change to what is asserted, and no new file. Every planned acceptance criterion is still asserted exactly as written.

## Issues Encountered

- None. `cargo check` is not part of this plan's gates, but the models file was still parse-checked with `rustfmt --emit stdout --edition 2021` (exit 0) so a syntax slip in the new structs could not ship unnoticed.

## Known Stubs

None — no stub, skipped test, TODO or unrun verify was left behind. The declarations are intentional declaration-only surfaces (`#[allow(dead_code)]`), which is the project's established `Mce*` pattern, not a stub: the `.mce` carrier is opaque by design (D-11) and 61-03/61-05 prove the data in both languages.

## Threat Surface

- **T-61-18 (one-language field drift, high):** mitigated — `expectMemberKeys('MceAquarelleAnchor', ['x','y','kind','in','out','width'])` and `expectMemberKeys('MceAquarelleVectorPath', ['anchors','renderMode'])` assert both sides, `diffMember` rejects a partial declaration, and the exception-list snapshot plus the per-field `not.toContain` loop make a new allowlist entry a two-row failure.
- **T-61-19 (strict engine schema, medium):** mitigated — `MceEngineStrokePayload` is untouched (still exactly `['engine']`), and the unknown-key round trip proves the slot accepts a key no declaration names.
- **T-61-20 (declaration diverging from the binary codec, medium):** mitigated — both doc comments name the AQTL v2 block from 61-05, and the round-trip fixture uses the same key names the restore path reads (`engine.anchors`, `engine.renderMode`).
- **T-61-SC (package installs, high):** none — no dependency was added.
- No new network endpoint, auth path, file access pattern or schema change at a trust boundary was introduced. No `## Threat Flags` entry is warranted.

## Verification

- `pnpm --filter efx-motion-editor exec vitest run src/lib/mceFieldContract.test.ts` — 16/16 green (was 9 before this plan; +7).
- `pnpm --filter efx-motion-editor exec vitest run` — full app suite green: 412 passed | 2 skipped files; 8486 passed | 1 skipped | 96 todo (was 8479 passed at 61-05, +7).
- `grep -n "pub r#in" app/src-tauri/src/models/project.rs` — no match.
- `grep -c 'serde(rename = "in")' app/src-tauri/src/models/project.rs` — exactly 1.
- `rustfmt --emit stdout --edition 2021 app/src-tauri/src/models/project.rs` — exit 0 (parse check only; `cargo check` is not a gate for this plan).
- `git show --first-parent --diff-filter=D --name-only` on both commits — no tracked file deleted.

## Next Phase Readiness

- 61-07 (replay by render mode) and 61-09 (path-edit overlay) can rely on the vector fields being contract-pinned: a rename in either language now fails the suite before it can reach a document.
- Any future per-stroke vector extension should be added to BOTH `MceAquarelleAnchor` / `MceAquarelleVectorPath` and their Rust twins in the same change, with a new `expectMemberKeys` row — the exception list is now snapshotted, so allowlisting is a visible edit.
- The `.mce` paint-document carrier is still `HashMap<String, Value>` on the Rust side (STATE.md blocker). These declarations pin the shape but not the transport; a dedicated load → save byte-identical pin for the paint document remains outstanding and is not this plan's scope.

## Self-Check: PASSED

- All 3 planned files exist on disk.
- Both task commits (`837473dbe`, `b34c7506b`) are ancestors of HEAD.
- Measured from the persisted ledger base `fa948bb41`: `commits: 2`, `plan_head_after: b34c7506bf5f840dc7415aa7690a343fa031d41b`.

---
*Phase: 61-vector-painting-tool*
*Completed: 2026-11-10*
