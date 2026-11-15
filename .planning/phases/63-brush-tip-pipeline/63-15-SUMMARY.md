---
phase: 63-brush-tip-pipeline
plan: 15
subsystem: physic-paint/performance
tags: [aqtl-v3, snapshot-codec, texture-id, script-timeline, tdd]

requires:
  - phase: 61-05
    provides: AQTL packed binary snapshot wire (then v2) and the vector payload block
  - phase: 63-14
    provides: the payload-only `engine.textureId` axis and the mask-registry texture ids
provides:
  - AQTL v3 — every stroke engine carries `textureId` presence-prefixed after the vector block
  - A recorded texture survives record -> SNP1 encode -> decode -> restore -> the Save Script capture
  - Play routing pins for the motion, static, reveal-tail and reveal-run bake legs
affects: [63-16, verify-work, audit-milestone]

actuals:
  tokens: 9598
  tasks: 3
  commits: 5

plan_head_before: 620f7c2ac7046b0964f8c7e0c44479fa32e08e0c
plan_head_after: 6d83d5ea219eadb383596cffb76c08fc2870f9e9

tech-stack:
  added: []
  patterns:
    - "Presence-prefixed optional string appended at the END of a binary record so every pre-existing offset stays stable"
    - "Carrier-neutral codec: validates shape only; lift policy stays at the single projection (toStudioStroke)"

key-files:
  created:
    - app/src/components/physic-paint/view/aquarelleRecordState.reopenTexture.test.ts
  modified:
    - app/src/components/physic-paint/performance/scriptTimelineCodec.ts
    - app/src/components/physic-paint/performance/scriptTimelineCodec.test.ts
    - app/src/components/physic-paint/performance/studioScriptSnapshotCodec.ts
    - app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.bake.test.ts
    - app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.test.ts

key-decisions:
  - "Write the presence-prefixed textureId AFTER the whole vector block and BEFORE pointCount: minimal layout pointCount 74->75, vector layout 118->119, every other offset unchanged"
  - "Bump AQTL to v3 and refuse v1/v2 with unsupported-version; no migration reader (project no-backward-compat law) — stale v2 .snap caches refuse whole and the track starts empty"
  - "The codec resolves, canonicalises and filters nothing: an unresolvable id travels verbatim and degrades fail-closed at the brush seam"
  - "Absence stays absent on decode — the engine rebuild adds textureId only when the presence marker is 1, so textureless strokes gain no undefined residue"
  - "Deferred: the Studio texture pick remains realm-session state like aquarelleSelectedTipId; restoring it is a separate UX decision, not required for G-63-5"

patterns-established:
  - "Wire extension: presence byte + u16-length UTF-8 payload appended at the record tail, offsets pinned in both layout comments"
  - "One enforcement point: lift drops the texture at toStudioStroke:207; the codec and the container duplicate no policy"

requirements-completed: [TIP-14]

coverage:
  - id: D1
    description: "AQTL v3 encodes/decodes engine.textureId presence-prefixed; version constants and byte lengths measured (minimal 95 B, vector 119 B, fixture 3747 B, ratio 4.82)"
    requirement: TIP-14
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/performance/scriptTimelineCodec.test.ts#round-trips a textured stroke deep-equal and re-encodes byte-identically"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/performance/scriptTimelineCodec.test.ts#pins the magic/version constants"
        status: pass
    human_judgment: false
  - id: D2
    description: "A recorded texture survives record -> SNP1 encode -> decode -> restore -> the Save Script capture and lands in the serialized document"
    requirement: TIP-14
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/view/aquarelleRecordState.reopenTexture.test.ts#keeps engine.textureId through record, the SNP1 cycle and the saved document"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/view/aquarelleRecordState.reopenTexture.test.ts#reopens the texture carrier byte-identically across a second cycle"
        status: pass
    human_judgment: false
  - id: D3
    description: "Absence stays absent and a lift stroke never carries a texture in the carrier or after restore"
    requirement: TIP-14
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/view/aquarelleRecordState.reopenTexture.test.ts#adds no textureId key to a textureless stroke anywhere in the same chain"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/view/aquarelleRecordState.reopenTexture.test.ts#drops a lift stroke texture at the single projection and restores none"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/performance/scriptTimelineCodec.test.ts#writes one presence byte for a textureless lift stroke and invents no key"
        status: pass
    human_judgment: false
  - id: D4
    description: "An id the new project's registry cannot resolve travels verbatim and fails closed at the live bind"
    requirement: TIP-14
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/view/aquarelleRecordState.reopenTexture.test.ts#carries an unknown id verbatim and fails closed at the live bind"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/performance/scriptTimelineCodec.test.ts#refuses an empty or non-string textureId at encode (fail closed)"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/performance/scriptTimelineCodec.test.ts#refuses a texture presence marker that is not 0 or 1"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/performance/scriptTimelineCodec.test.ts#fails closed when the texture id length runs past the body"
        status: pass
    human_judgment: false
  - id: D5
    description: "A built-in texture id survives the same chain with no project imports and binds live"
    requirement: TIP-14
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/view/aquarelleRecordState.reopenTexture.test.ts#carries a built-in id with no imports and binds it live"
        status: pass
    human_judgment: false
  - id: D6
    description: "Motion, static and both reveal seams hand their bake ports the stroke's own textureId"
    requirement: TIP-14
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.bake.test.ts#texture carrier: the motion render hands bake.bake the snapshot textureId"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.bake.test.ts#texture carrier: the static render hands bake.bake the snapshot textureId"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.test.ts#texture carrier: the reveal tail hands its bake port the stroke textureId"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.test.ts#texture carrier: the reveal run hands its bake port the stroke textureId"
        status: pass
    human_judgment: false
  - id: D7
    description: "AQTL v3 is the one accepted version; v1 and v2 refuse whole with unsupported-version (accepted consequence, no migration)"
    requirement: TIP-14
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/performance/scriptTimelineCodec.test.ts#validates the header before allocating"
        status: pass
    human_judgment: false

duration: 9min
completed: 2026-11-15
status: complete
---

# Phase 63 Plan 15: AQTL v3 textureId Summary

**AQTL v3 carries `engine.textureId` presence-prefixed inside every stroke engine, so a Roto script saved from a textured project reopens and paints each stroke's own tip in a project that never imported it — G-63-5 closed.**

## Performance

- **Duration:** 9 min
- **Started:** 2026-11-15T22:05:30Z
- **Completed:** 2026-11-15T22:14:30Z
- **Tasks:** 3
- **Files modified:** 6 (1 created, 5 modified)

## Accomplishments

- The AQTL wire learned the texture axis: `encodeStroke` writes a `u8` presence marker plus a `u16`-length UTF-8 id AFTER the whole vector block and BEFORE `pointCount`; `decodeStroke` mirrors it and the engine rebuild adds the key only when present.
- The full G-63-5 chain is pinned against the real production seam: `recordAquarelleStroke` -> `getAquarelleEventsForFrame` -> SNP1 encode/decode -> `restoreAquarelleRecordTimeline` -> `serializeAquarelleRotoScript` document. A second cycle is byte-identical.
- Boundaries hold: absent stays absent (no invented key), a lift stroke never carries a texture (the single projection `toStudioStroke:207` drops it), an unknown id travels verbatim and fails closed at the live bind, and a built-in id resolves with no project imports.
- All four play routing legs (motion, static, reveal tail, reveal run) hand their bake port the persisted stroke's `textureId` under the shared `texture carrier` name token.

## Task Commits

Each task was committed atomically:

1. **Task 1: End-to-end — a textured stroke survives the per-track snapshot and reaches the save capture** (tracer, tdd)
   - `8ed4d2213` (test) — RED: failing textureId pins for the AQTL snapshot wire
   - `0072aa784` (feat) — GREEN: carry `engine.textureId` on the AQTL v3 wire
2. **Task 2: Boundary pins — lift, absence, unknown id, built-in tip with no imports** — `b46591ff2` (test)
3. **Task 3: Play routing pins — motion, static and both reveal seams** — `582e7b0c9` (test), refined by `6d83d5ea2` (fix: type assertions as `StudioStroke<AquarelleStrokePayload>`)

**Plan metadata:** docs commit follows this SUMMARY (not counted in the 5 measured task commits).

_Measured from the plan ledger: `git rev-list --count 620f7c2a..HEAD` = 5._

## Files Created/Modified

- `app/src/components/physic-paint/performance/scriptTimelineCodec.ts` — AQTL v3: presence-prefixed `textureId` in encode/decode, version constant, header docs and version law.
- `app/src/components/physic-paint/performance/scriptTimelineCodec.test.ts` — v3 pins: byte layouts (95/119/3747, ratio 4.82), textured round-trips (custom + builtin), fail-closed cases (empty, bad marker, truncated), lift absence, v1/v2 refusal.
- `app/src/components/physic-paint/performance/studioScriptSnapshotCodec.ts` — header sentence only: the watercolor body is the AQTL v3 buffer; container stays v5.
- `app/src/components/physic-paint/view/aquarelleRecordState.reopenTexture.test.ts` — NEW: the real record/snapshot/restore/save chain through SNP1.
- `app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.bake.test.ts` — motion and static `bake.bake` texture-carrier pins.
- `app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.test.ts` — reveal tail and reveal run `scriptEvents` texture-carrier pins.

## Decisions Made

- Append the optional field at the record tail (after the vector block, before `pointCount`): the minimal layout moves `pointCount` 74->75 and the vector layout 118->119, while every other pre-existing offset stays put. Pinned in both layout comments.
- Bump the binary version to 3 and refuse 1 and 2 with `unsupported-version` rather than tolerating an older reader — the project's clean-break law. Consequence accepted: an existing AQTL v2 `.snap` refuses whole on first open and the affected track starts empty; the project document and JSON scripts remain the durable records.
- The codec is a carrier, not a policy point: it validates presence, non-empty string, UTF-8 and declared length, and resolves/filters nothing. Lift enforcement stays solely at `toStudioStroke:207`.
- Unknown ids are not stripped at capture; the brush seam degrades fail-closed (`resolveMask(textureId) === null` → `textureId: null`), which is what lets a script paint the right tip once its texture is imported.
- Studio texture selection lifetime: left as realm-session state (same lifecycle as `aquarelleSelectedTipId` returning to `filbert`). Restoring the pick after a realm reset is a separate UX decision; the saved script does not depend on it because each recorded stroke carries its own id.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Task 2 byte-cost assertion was off by one**
- **Found during:** Task 2 (Boundary pins)
- **Issue:** `expect(bytes.byteLength).toBe(plain.byteLength + 1 + 2 + utf8)` expected 114, received 113. The 95-byte `plain` fixture ALREADY contains the texture presence byte (marker 0); a present id adds only the `u16` length plus UTF-8 bytes.
- **Fix:** Derive from `plain.byteLength + 2 + utf8`, with a comment explaining that `plain` already carries the presence byte.
- **Files modified:** `scriptTimelineCodec.test.ts`
- **Verification:** Full codec suite green (54 tests) at commit.
- **Committed in:** `b46591ff2` (Task 2 commit)

**2. [Rule 1 - Bug] Texture-carrier assertions used the wrong type**
- **Found during:** Plan-level verification (typecheck)
- **Issue:** `AquarelleStrokePayload` is the ENGINE payload; `engine` lives on `StudioStroke<AquarelleStrokePayload>` (efx-paint-host). Four assertions failed `tsc` with TS2339.
- **Fix:** Cast through `StudioStroke<AquarelleStrokePayload>`; added the `StudioStroke` type import to the main controller test.
- **Files modified:** `physicsPaintRotoPlayScriptController.bake.test.ts`, `physicsPaintRotoPlayScriptController.test.ts`
- **Verification:** `typecheck` clean; the four `texture carrier` pins re-run green (4 passed).
- **Committed in:** `6d83d5ea2`

**3. [Rule 3 - Blocking] pnpm footer polluted the TAP RED evidence**
- **Found during:** Task 1 RED step
- **Issue:** `pnpm --filter ... exec vitest run --reporter=tap-flat` appends pnpm error banners after the TAP plan; `gsd_run check tdd-red-evidence` returned `INVALID_RED` (Non-TAP data / Malformed TAP) despite a nonzero exit.
- **Fix:** Re-ran from `app/` with `./node_modules/.bin/vitest run ... --reporter=tap-flat` so the captured report is reporter-only. Verdict `RED_EVIDENCE_OK`, reason `target_test_failed`.
- **Files modified:** none (evidence process only)
- **Verification:** RED evidence accepted by the gate; RED commit `8ed4d2213` precedes GREEN `0072aa784`.
- **Committed in:** n/a

---

**Total deviations:** 2 auto-fixed bugs, 1 auto-fixed blocking issue
**Impact on plan:** No scope creep. All three were corrections to the plan's own test/setup mechanics; production scope stayed exactly the two codec files plus tests.

## TDD Gate Compliance

Task 1 ran as `type="tracer" tdd="true"`:

| Gate | Commit | Evidence |
|------|--------|----------|
| RED | `8ed4d2213` (test) | `gsd_run check tdd-red-evidence` → `RED_EVIDENCE_OK` (`target_test_failed`). 9 failing assertions, all format-caused: reopened chain lost `textureId` at the restore seam (2/3 in `reopenTexture`), codec expected v3 and refused v2 (7/42: version constant, 3747/95/119 sizes, hand-painted cost, v2 refusal, textured round-trip). No import or syntax errors. |
| GREEN | `0072aa784` (feat) | Same suites green after the codec change; version bump blast radius verified across 9 adjacent suites (538 tests at the time). |
| REFACTOR | none | Not needed — the encoder/decoder shape mirrors the adjacent colour-presence pattern already in the file. |

GREEN descends from RED (`git merge-base --is-ancestor 8ed4d2213 0072aa784` holds).

## Verification Evidence

- 11-suite block at HEAD: **11 files, 596 tests passed** (`scriptTimelineCodec`, `studioScriptSnapshotCodec`, `studioScriptSnapshotController`, `aquarelleRecordState` + reopenCurveMode/reopenAnchorColor/reopenTexture, clipboard, library, play bake, play main).
- Payload/brush laws: `@efxlab/efx-watercolor` payload `codec.test.ts` + `brushBridge.test.ts` — **2 files, 59 tests passed**.
- `pnpm --filter efx-motion-editor run typecheck` — clean.
- Grep pins: version-3 constant 1, version-2 constant 0, `engine.textureId` 6 (>=4), codec test `textureId` 13 (>=8), reopenTexture test 21 (>=6), play routing 5 + 5 (>=2 each).
- Scope: only the 6 declared files changed; no manifest, Rust, `.mce` model, serializer or brushPack file touched.

## Threat Surface Scan

No new surface beyond the plan's register. T-63-33 mitigations are implemented and pinned: presence marker validated as exactly 0/1, declared length checked via `need()` before allocation, empty value refused, UTF-8 validated on decode, and the id is used only as a mask-registry map key. T-63-34 accepted as designed (whole-buffer refusal). T-63-SC: no dependency added.

## Known Stubs

None — no stub patterns in any created or modified file; every new field is wired end to end and pinned.

## Issues Encountered

- The v2 `.snap` cache consequence is real but accepted by design: the first open after this change reports one restore failure and the track starts empty. The project document and JSON scripts are unaffected.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- G-63-5 is closed at the carrier level; the UAT artifact for 63-16 can save a script from a textured project and paint it in a clean project, expecting each stroke's own tip.
- Deferred follow-up (not a blocker): decide whether the Studio texture pick should survive a realm reset like the brush tip selection; today both reset.
- Accepted consequence to surface in release notes: pre-existing AQTL v2 `.snap` caches are refused whole on first open by design.

---

*Phase: 63-brush-tip-pipeline*
*Completed: 2026-11-15*

## Self-Check: PASSED

- All 6 changed/created files exist at HEAD.
- All 5 plan commits are ancestors of HEAD: 8ed4d2213, 0072aa784, b46591ff2, 582e7b0c9, 6d83d5ea2.
- Measured commits: 5 (`git rev-list --count 620f7c2a..HEAD`).
