---
phase: 56-efx-watercolor-engine-2-paint-aquarelle-clean-room
plan: 09
subsystem: data
tags: [mce-field-contract, dual-language, rust-serde, brush-pack, paper-display, cross-engine-refusal, fail-closed, tdd]

# Dependency graph
requires:
  - phase: 56-efx-watercolor-engine-2-paint-aquarelle-clean-room
    plan: 04
    provides: BrushPackSnapshot carrier (kind 'efx-watercolor' + entries), AquarelleTip / AquarelleToolOverrides 8-field surface
  - phase: 56-efx-watercolor-engine-2-paint-aquarelle-clean-room
    plan: 05
    provides: fond paper display state (id/strength/scale) via setPaperId/setPaperStrength/setPaperScale
  - phase: 56-efx-watercolor-engine-2-paint-aquarelle-clean-room
    plan: 06
    provides: aquarelle payload codec (parse total/fail-closed, Dry event union, DIFFUSION_CAP clamp)
  - phase: 55-efx-paint-host-engine-1-host-split
    provides: owned-refusal surface + HostScriptRefusalCode (unknown-engine-id | malformed-engine-payload | engine-mismatch | unreadable-legacy-script)
provides:
  - Phase 56 .mce field set declared in BOTH app/src/types/project.ts and app/src-tauri/src/models/project.rs (DATA-04 / D-27 / F1 co-change)
  - McePaperDisplayState / MceAquarelleBrushProperties / MceEngineStrokePayload / MceBrushPackSnapshot dual-language wire contract
  - mceFieldContract Phase 56 rows (four field groups + brushPack-not-one-language pin)
  - Exact named cross-engine Apply line pinned in BOTH directions + ENGINE_DISPLAY_NAMES lock (MOD-05 / D-25)
  - codec.ts refusal classification (classifyAquarellePayloadFailure -> malformed-engine-payload, buildEngineMismatchRefusal package-id pair)
affects: [56-10, 57-efx-spectral]

# Actuals (#2632) — pairs with the plan's `estimate` to calibrate future estimates.
# estimateTokens was 45000; actual is chars/4 over the realized diff (the refusal
# surface and codec already shipped in 55-06 / 56-06, so this plan's delta is the
# dual-language declarations + pins). Do not round to look closer.
actuals:
  tokens: 6251
  tasks: 2
  commits: 3
plan_head_before: 3ba922f1b734968fac817b5606242c248c528123
plan_head_after: 1141059a279dbaa595ecc0ea06ce579d1ca17186

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Contract-declaration Mce* types: a wire shape pinned in both languages even while its parent carrier stays opaque (HashMap<String, Value>) — the field-diff pin covers it the day the carrier becomes typed"
    - "codec-side refusal door: classifyAquarellePayloadFailure (parse null -> malformed-engine-payload) + buildEngineMismatchRefusal (package-id pair in detail) — host yields codes, Studio names them (D-09/D-25)"
    - "Exact-copy named-line pins in BOTH cross-engine directions + ENGINE_DISPLAY_NAMES source-scan lock — a display-name rename cannot silently change the visible refusal"

key-files:
  created: []
  modified:
    - app/src/types/project.ts
    - app/src-tauri/src/models/project.rs
    - app/src/lib/mceFieldContract.test.ts
    - app/src/efx-paint/host-split/hostSplitFailClosedApply.test.ts
    - packages/efx-watercolor/src/payload/codec.ts
    - packages/efx-watercolor/src/payload/codec.test.ts

key-decisions:
  - "The four Phase 56 field groups are declared as standalone Mce* members (McePaperDisplayState / MceAquarelleBrushProperties / MceEngineStrokePayload / MceBrushPackSnapshot) in BOTH languages. The v1.0 package carrier (efx_paint_documents) is still opaque serde_json::Value on the Rust side, so these structs are contract declarations — #[allow(dead_code)] until a typed carrier constructs them. The field-diff pin covers the key set the day that happens (DATA-04)."
  - "Paper display wire names are the plan's id / strength / scale (matching setPaperId/setPaperStrength/setPaperScale), not the document-internal background/grainStrength/grainScale. 56-05 mapped the setters onto the existing fond arm; this declaration is the .mce wire contract for the display state as a unit (PAPER-03 / D-22). No parallel runtime field set was created."
  - "Aquarelle brush property wire names are exactly tip/aspect/rotation/sizeCurve/scatter/capacity/grain/wetRound — camelCase sizeCurve and wetRound ride serde(rename) on snake_case Rust fields, matching the TS AquarelleToolOverrides surface byte-for-byte (AQUA-03 / R1.7)."
  - "brushPack is a two-language field by design (D-23) and is asserted NOT in ALLOWED_ONE_LANGUAGE. Empty entries [] still declares the key (presence, not content)."
  - "The cross-engine named line was already implemented in 55-06 buildEngineMismatchLine. 56-09 pins it byte-exactly in BOTH directions (Water color->Brush and Brush->Water color) and locks ENGINE_DISPLAY_NAMES['efx-watercolor'] === 'Water color' by source scan — no second error channel was introduced (D-25)."
  - "codec refusal wiring is two pure helpers (classifyAquarellePayloadFailure / buildEngineMismatchRefusal) that return host codes; the named English line stays on the Studio owned-refusal surface. The codec never names a user-facing sentence (55 D-09)."

patterns-established:
  - "Contract-declaration Mce* types for shapes that ride opaque carriers — pin the wire key set in both languages before the carrier is typed"
  - "Named-line exact-copy pins in both cross-engine directions + display-name source-scan lock (the MOD-05 family)"

requirements-completed: [DATA-04, MOD-04, MOD-05]

# Coverage metadata (#1602)
coverage:
  - id: D1
    description: "Every new .mce field this phase is declared in BOTH app/src/types/project.ts and app/src-tauri/src/models/project.rs (paper display state id/strength/scale, aquarelle 8-field brush properties, per-engine stroke payload engine slot, brush-pack snapshot kind/entries)"
    requirement: DATA-04
    verification:
      - kind: unit
        ref: "app/src/lib/mceFieldContract.test.ts#Phase 56 .mce field set (DATA-04 / D-27)"
        status: pass
      - kind: other
        ref: "cargo check (app/src-tauri) — four new structs compile clean"
        status: pass
    human_judgment: false
  - id: D2
    description: "Brush-pack snapshot travels in .mce as inline data (D-23 / MOD-04) and is NOT an ALLOWED_ONE_LANGUAGE entry — two-language by design, empty entries still declare the key"
    requirement: MOD-04
    verification:
      - kind: unit
        ref: "app/src/lib/mceFieldContract.test.ts#declares the brush-pack snapshot in both languages (D-23 inline .mce data)"
        status: pass
      - kind: unit
        ref: "app/src/lib/mceFieldContract.test.ts#brushPack is NOT an ALLOWED_ONE_LANGUAGE entry (D-23 two-language by design)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Cross-engine Apply refuses with the exact named line through the existing owned-refusal surface in BOTH directions: 'Apply rejected — this script is for {scriptName}, not {targetName}. Nothing changed.' Unreadable scripts refuse with a named line; a refused Apply mutates zero store state"
    requirement: MOD-05
    verification:
      - kind: unit
        ref: "app/src/efx-paint/host-split/hostSplitFailClosedApply.test.ts#Phase 56 named cross-engine Apply line (MOD-05 / D-25)"
        status: pass
      - kind: unit
        ref: "packages/efx-watercolor/src/payload/codec.test.ts#cross-engine Apply refusal + unreadable named failures (MOD-05 / D-25)"
        status: pass
    human_judgment: false

# Metrics
duration: 5min
completed: 2026-10-16
status: complete
---

# Phase 56 Plan 09: .mce Field Contract + Brush-Pack Carrier + Fail-Closed Cross-Engine Apply Summary

**One-liner:** Every new Phase 56 `.mce` field is dual-language declared (paper display state, aquarelle brush properties, per-engine stroke payload, brush-pack snapshot) under the field-diff pin; the brush-pack snapshot rides `.mce` inline by design; cross-engine and unreadable Apply refuse with the exact named line in both directions and write nothing.

## What Shipped

### Task 1 — RED: field-diff + cross-engine refusal cases (`39c8316a`)

- **`app/src/lib/mceFieldContract.test.ts`** — a new `Phase 56 .mce field set (DATA-04 / D-27)` describe with one row per field group (paper display state, aquarelle brush properties, per-engine stroke payload, brush-pack snapshot) plus the `brushPack is NOT an ALLOWED_ONE_LANGUAGE` pin. At commit time the four member rows were **RED** (4 failed / 17 passed) because neither language declared the members — exactly the planned failing state.
- **`app/src/efx-paint/host-split/hostSplitFailClosedApply.test.ts`** — `Phase 56 named cross-engine Apply line (MOD-05 / D-25)` pins the byte-exact named line in BOTH directions (`Water color → Brush` and `Brush → Water color`), the generic fallback, the `ENGINE_DISPLAY_NAMES` source-scan lock (`'efx-watercolor': 'Water color'`), the unreadable/legacy named lines, the zero-mutation / version-signal pin, and idempotency. These were **PINS_GREEN_AT_BIRTH** — the 55-06 mapper already produced the copy; this plan locks it.
- **`packages/efx-watercolor/src/payload/codec.test.ts`** — `cross-engine Apply refusal + unreadable named failures (MOD-05 / D-25)` covers unreadable wire (unknown schemaVersion / bad shape) → parse null, foreign-engine payload rejected by the aquarelle codec, unknown engine id → `unknown-engine-id`, legacy pre-envelope kind → `unreadable-legacy-script`, and a side-effect-free parse pin. Also green-at-birth against the 56-06 codec.

### Task 2 — GREEN: declare fields in TS + Rust, wire codec refusals (`1141059a`)

**Four Mce\* members, declared in BOTH languages in one change set (F1 co-change / DATA-04):**

| Member | Wire keys | Notes |
|--------|-----------|-------|
| `McePaperDisplayState` | `id`, `strength`, `scale` | Fond paper display state (PAPER-03 / D-22). Display-class: rotates the change token, never rebakes pixels (D-21). |
| `MceAquarelleBrushProperties` | `tip`, `aspect`, `rotation`, `sizeCurve`, `scatter`, `capacity`, `grain`, `wetRound` | The 8-field per-brush surface (AQUA-03 / R1.7 / D-08). Rust uses `#[serde(rename)]` so `sizeCurve` / `wetRound` ride camelCase on the wire. |
| `MceEngineStrokePayload` | `engine` | Opaque per-engine slot (HOST-02 / D-19). Rust `Option<Value>` — the physic_paint_outputs presence-carrier style. |
| `MceBrushPackSnapshot` | `kind`, `entries` | Inline `.mce` data (D-23 / MOD-04). Two-language by design — NOT in `ALLOWED_ONE_LANGUAGE`. |

Rust structs carry `#[allow(dead_code)]` with a header comment: they are contract declarations while the v1.0 package carrier stays opaque (`HashMap<String, Value>`). `cargo check` is clean.

**Codec refusal door (`packages/efx-watercolor/src/payload/codec.ts`):**
- `classifyAquarellePayloadFailure(raw)` → `malformed-engine-payload` when `parse` returns null, `null` when it parses. Unreadable scripts therefore surface the named "could not be read" line — never a silent drop (DATA-02 / 53.1 law).
- `buildEngineMismatchRefusal(scriptEngineId, targetEngineId)` → `{ code: 'engine-mismatch', detail: '<script>:<target>' }` so the Studio mapper can name both engines via `ENGINE_DISPLAY_NAMES` (D-15).

**Owned-refusal surface:** unchanged and single-channel (D-25). `buildRotoScriptApplyRefusalMessage` already produced the UI-SPEC copy from 55-06; this plan pins it byte-exactly and proves a refused Apply writes nothing (write-probe + version-signal source scan). No second error channel was introduced.

## Verification

| Gate | Result |
|------|--------|
| `vitest run src/lib/mceFieldContract.test.ts` | **9/9 pass** (4 original + 5 Phase 56 rows) |
| `vitest run src/efx-paint/host-split/hostSplitFailClosedApply.test.ts` | **12/12 pass** |
| `vitest run src/payload/codec.test.ts` (efx-watercolor) | **27/27 pass** |
| `pnpm --filter efx-motion-editor run typecheck` | **green** |
| `cargo check` (app/src-tauri) | **clean** (4 expected dead_code warnings silenced on the contract declarations) |
| `vitest run src/efx-paint/efxPaintCleanBreakContract.test.ts` | **1 pre-existing failure** — see Deferred Issues (56-05 `PaperPicker.tsx` `toDataURL`, not introduced here) |

RED evidence: task commit `39c8316a` ran the four Phase 56 field rows at 4 failed / 17 passed before the declarations landed (`1141059a` flipped them green).

## Deviations from Plan

None in the plan's own deliverables — the four field groups, the brush-pack inline carrier, and the named cross-engine refusal line all landed as written.

## Known Stubs

None — no hardcoded empty values, placeholder text, or unwired data sources in the shipped surface.

## Deferred Issues

**1. Pre-existing 52.1 frame-transport violation — `PaperPicker.tsx` uses `toDataURL` (56-05)**
- **Found during:** Task 2 GREEN, `efxPaintCleanBreakContract.test.ts` "forbids the frame-transport tokens outside the allowlist (D-19)"
- **Issue:** `app/src/components/physic-paint/view/PaperPicker.tsx:78` calls `canvas.toDataURL()` for a 64×64 paper-relief thumbnail. `toDataURL` is on the 52.1 (D-19) `FRAME_TRANSPORT_FORBIDDEN_TOKENS` list.
- **Not fixed here (scope boundary):** introduced by 56-05 (`dd58a8cd`); the token ban landed in 52.1 (`0e76ff3f`). 56-09 adds zero frame-transport tokens.
- **Logged to:** `.planning/phases/56-efx-watercolor-engine-2-paint-aquarelle-clean-room/deferred-items.md`
- **Must clear before `/gsd-ship`.** Two resolutions: drop `toDataURL` (per-cell `<canvas>` or blob URL), or allowlist `PaperPicker.tsx` with a "UI relief thumbnail, not frame transport" comment.

## Threat Flags

None — no new network endpoints, auth paths, file-access patterns, or trust-boundary schema changes beyond the planned dual-language declarations (T-56-27 mitigated by the field-diff pin; T-56-28 mitigated by the single owned-refusal channel; T-56-29 mitigated by the brush-pack staying data-only inline).

## Self-Check: PASSED

- `app/src/types/project.ts` — FOUND
- `app/src-tauri/src/models/project.rs` — FOUND
- `app/src/lib/mceFieldContract.test.ts` — FOUND
- `app/src/efx-paint/host-split/hostSplitFailClosedApply.test.ts` — FOUND
- `packages/efx-watercolor/src/payload/codec.ts` — FOUND
- `packages/efx-watercolor/src/payload/codec.test.ts` — FOUND
- Commit `39c8316a` — FOUND (ancestor of HEAD)
- Commit `1141059a` — FOUND (ancestor of HEAD)

---
*Phase: 56-efx-watercolor-engine-2-paint-aquarelle-clean-room*
*Completed: 2026-10-16*
