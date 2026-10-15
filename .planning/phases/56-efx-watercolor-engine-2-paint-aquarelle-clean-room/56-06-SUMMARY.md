---
phase: 56-efx-watercolor-engine-2-paint-aquarelle-clean-room
plan: 06
subsystem: engine
tags: [watercolor, aquarelle, codec, dry-event, script-payload, tdd, determinism]

# Dependency graph
requires:
  - phase: 56-efx-watercolor-engine-2-paint-aquarelle-clean-room (56-01 / 56-03)
    provides: StudioStroke<AquarelleStrokePayload> projection, DIFFUSION_CAP, EngineAdapter seam, fluid sheet + drying fix
provides:
  - payloadCodec.serialize/parse over the one payload union (strokes + Dry), fail-closed, schemaVersion 1
  - AquarelleDryEvent + comparePayloadEvents total order on (tick, recordedOrder)
  - AQUARELLE_SCHEMA_VERSION constant and standing codec pins
  - engineAdapter.payloadCodec wired to the 56-06 codec; Dry applies forceDrySheet at its tick
affects: [56-07, 56-08, 56-09, 56-10]

# Actuals (#2632) — pairs with the plan's `estimate` to calibrate future estimates.
# commits: MEASURED via git rev-list --count plan_head_before..HEAD (includes this
# closing metadata commit; plan_head_after is the last content commit 549bc2e0).
actuals:
  tokens: 10083
  tasks: 2
  commits: 3
plan_head_before: fd91446cc0c48497622c6b036087536addee585a
plan_head_after: 549bc2e0055c59bc9262e411a34847421dd4d000

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "One payload union codec (D-16): serialize/parse handle StudioStroke<P> and AquarelleDryEvent; wire form { schemaVersion, event }"
    - "Total order on (tick, recordedOrder) via comparePayloadEvents — equal ticks keep recordedOrder"
    - "Fail-closed parse: unknown/missing schemaVersion and any malformed shape return null, never throw"

key-files:
  created:
    - packages/efx-watercolor/src/payload/codec.ts
    - packages/efx-watercolor/src/payload/dryEvent.ts
    - packages/efx-watercolor/src/payload/codec.test.ts
  modified:
    - packages/efx-watercolor/src/payload/toStudioStroke.ts
    - packages/efx-watercolor/src/adapter/engineAdapter.ts
    - packages/efx-watercolor/src/adapter/engineAdapter.test.ts
    - packages/efx-watercolor/src/engine/drying.ts
    - packages/efx-watercolor/src/payload/index.ts

key-decisions:
  - "Wire form is { schemaVersion: AQUARELLE_SCHEMA_VERSION, event } — parse(serialize(x)) deep-equals x and unknown/missing schemaVersion refuses (P5 / DATA-01, no dual-format reader)"
  - "Dry is AquarelleDryEvent { kind: 'dry', tick, recordedOrder } — no pts, no brush fields, one payload union (D-16); recordedOrder is the shared ordering key every event carries (same role as StudioStroke.recordedOrder)"
  - "comparePayloadEvents orders by (tick, recordedOrder); a stroke's ordering tick is its duration `ticks` (the script timeline tick the mixed-order pin uses)"
  - "serialize clamps cuisson AND engine.diffusionFrames to DIFFUSION_CAP 600 (D-19) so the script-visible budget matches toStudioStroke"
  - "forceDrySheet is the user-initiated Dry wet-state fix (D-15) — explicit recorded gesture, never the prohibited frame-boundary force-dry (P4 / D-28)"
  - "EngineAdapter.payloadCodec casts through unknown at the host seam — host type is stroke-shaped because the host never reads P and never sees Dry (T-56-17)"

patterns-established:
  - "Script codec wire form { schemaVersion, event } for engine payload unions — stamp at serialize, strip at parse"
  - "Dry-timeline events as distinguished union members with a (tick, recordedOrder) total-order comparator"

requirements-completed: [AQUA-05, AQUA-06]

# Coverage metadata (#1602)
coverage:
  - id: D1
    description: "serialize → parse round-trip deep-equals for strokes (including toolOverrides) and Dry events; order preserved exactly"
    requirement: AQUA-05
    verification:
      - kind: unit
        ref: "packages/efx-watercolor/src/payload/codec.test.ts#round-trips a stroke including toolOverrides and engine fields"
        status: pass
    human_judgment: false
  - id: D2
    description: "Dry is a distinguished payload union member (no pts, no brush) with total order on (tick, recordedOrder)"
    requirement: AQUA-05
    verification:
      - kind: unit
        ref: "packages/efx-watercolor/src/payload/codec.test.ts#mixed [stroke(tick=3), dry(tick=5), stroke(tick=5)] replays stroke, dry, stroke"
        status: pass
    human_judgment: false
  - id: D3
    description: "Integer host-grid ticks and diffusionFrames clamp to DIFFUSION_CAP 600 at serialize"
    requirement: AQUA-05
    verification:
      - kind: unit
        ref: "packages/efx-watercolor/src/payload/codec.test.ts#diffusionFrames > 600 clamps to 600 at serialize (engine bag + cuisson)"
        status: pass
    human_judgment: false
  - id: D4
    description: "parse is total and fail-closed — malformed shapes and unknown schemaVersion return null, never throw"
    requirement: AQUA-05
    verification:
      - kind: unit
        ref: "packages/efx-watercolor/src/payload/codec.test.ts#parse(unknown schemaVersion) returns null (no dual-format reader)"
        status: pass
    human_judgment: false
  - id: D5
    description: "record → serialize → parse → applyStroke/stepTick replays byte-identical pixels (AQUA-06)"
    requirement: AQUA-06
    verification:
      - kind: unit
        ref: "packages/efx-watercolor/src/payload/codec.test.ts#same script survives the codec and replays byte-identical pixels"
        status: pass
    human_judgment: false

# Metrics
duration: 4min
completed: 2026-10-15
status: complete
---

# Phase 56 Plan 06: Aquarelle Script Codec Summary

**Aquarelle script codec with Dry timeline events in one payload union, fail-closed schemaVersion parse, and deterministic serialize/parse/replay on the host tick grid**

## Performance

- **Duration:** 4 min
- **Started:** 2026-10-15T23:49:02Z
- **Completed:** 2026-10-15T23:53:05Z
- **Tasks:** 2
- **Files modified:** 9

## Accomplishments
- One payload union codec (D-16): `serialize`/`parse` cover `StudioStroke<AquarelleStrokePayload>` and `AquarelleDryEvent` — no second events array
- Dry timeline event `{ kind: 'dry', tick, recordedOrder }` with `comparePayloadEvents` total order on (tick, recordedOrder); replay fires Dry between strokes
- Fail-closed parse: unknown/missing schemaVersion and any malformed shape return null, never throw (P5 / DATA-01)
- `diffusionFrames` / `cuisson` clamp to `DIFFUSION_CAP` 600 at serialize; pts ticks stay integer host-grid indices
- `engineAdapter.payloadCodec` wired to the 56-06 codec; Dry events call `forceDrySheet` at their tick (D-15); frame indices never force-dry (P4)

## Task Commits

Each task was committed atomically:

1. **Task 1: RED codec round-trip, Dry ordering, tick quantisation, determinism** - `fb017076` (test)
2. **Task 2: GREEN implement codec.ts + dryEvent.ts + wire EngineAdapter.payloadCodec** - `549bc2e0` (feat)

**Plan metadata:** closing SUMMARY commit (docs)

_Note: TDD tasks have test → feat commits_

## Files Created/Modified
- `packages/efx-watercolor/src/payload/codec.ts` - payloadCodec.serialize/parse, AQUARELLE_SCHEMA_VERSION, diffusion clamp
- `packages/efx-watercolor/src/payload/dryEvent.ts` - AquarelleDryEvent, AquarellePayloadEvent union, comparePayloadEvents
- `packages/efx-watercolor/src/payload/codec.test.ts` - standing pins (round-trip, ordering, cap, fail-closed, determinism)
- `packages/efx-watercolor/src/payload/toStudioStroke.ts` - re-exports the payload union; field-mapping header kept
- `packages/efx-watercolor/src/adapter/engineAdapter.ts` - payloadCodec points at the codec; Dry → forceDrySheet
- `packages/efx-watercolor/src/adapter/engineAdapter.test.ts` - round-trip via serialize→parse (wire form)
- `packages/efx-watercolor/src/engine/drying.ts` - forceDrySheet for user-initiated Dry (D-15)

## Decisions Made
- Wire form is `{ schemaVersion, event }` so `parse(serialize(x))` deep-equals x and unknown schemaVersion refuses
- Dry carries `recordedOrder` alongside `tick` (shared ordering key); stroke ordering tick is `ticks`
- Host EngineAdapter payloadCodec type is stroke-shaped — cast through unknown at the seam (host never reads P)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] forceDrySheet for Dry wet-state fix**
- **Found during:** Task 2 (GREEN wiring)
- **Issue:** Plan requires Dry events to call the engine's wet-state fix at their tick; drying.ts had only incremental fixDrying and no flash-dry
- **Fix:** Added `forceDrySheet` locking all mobile pigment into fixed buffers and zeroing wetness (explicit gesture, not P4 frame-boundary force-dry)
- **Files modified:** packages/efx-watercolor/src/engine/drying.ts
- **Verification:** package suite 89/89 green
- **Committed in:** 549bc2e0 (Task 2 commit)

**2. [Rule 3 - Blocking] engineAdapter.test.ts parse call sites moved to wire form**
- **Found during:** Task 2 (GREEN wiring)
- **Issue:** Existing test parsed an in-memory StudioStroke; the codec's parse requires `{ schemaVersion, event }` and refuses missing schemaVersion
- **Fix:** Updated the round-trip case to `parse(serialize(projected))` (one line)
- **Files modified:** packages/efx-watercolor/src/adapter/engineAdapter.test.ts
- **Verification:** engineAdapter.test.ts 6/6 green
- **Committed in:** 549bc2e0 (Task 2 commit)

**3. [Rule 3 - Blocking] payloadCodec cast at the host EngineAdapter seam**
- **Found during:** Task 2 (build/dts)
- **Issue:** Host `EngineAdapter.payloadCodec` is typed `StudioStroke<P>` only; the aquarelle codec returns the union/wire form
- **Fix:** Cast through `unknown` at the adapter seam with a T-56-17 comment (host never reads P)
- **Files modified:** packages/efx-watercolor/src/adapter/engineAdapter.ts
- **Verification:** tsup dts + `tsc --noEmit` clean; app typecheck clean
- **Committed in:** 549bc2e0 (Task 2 commit)

---

**Total deviations:** 3 auto-fixed (1 missing critical, 2 blocking)
**Impact on plan:** All three were required to wire the codec the plan describes. No scope creep.

## Issues Encountered
- RED evidence needed a compact TAP capture (`-t` target filter) because full-suite TAP with large object dumps failed `check tdd-red-evidence` as non-TAP data
- Payload source scan rejects the literal `Math.random` token even in prose comments — wording changed to "unseeded RNG" so the standing pin stays green

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- AQUA-05 / AQUA-06 codec + Dry ordering laws are pinned; 56-07+ can persist scripts through `payloadCodec`
- Play path feeds the union in recorded order; the fluid sheet still rides the 56-01 tracer deposit until bake/script plans wire it (56-03 decision)

---
*Phase: 56-efx-watercolor-engine-2-paint-aquarelle-clean-room*
*Completed: 2026-10-15*
