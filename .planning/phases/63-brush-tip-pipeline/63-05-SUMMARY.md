---
phase: 63-brush-tip-pipeline
plan: 05
subsystem: bridge
tags: [brush-tips, realm-boundary, tauri-events, mask-registry, webp, preact-signals, tdd]

requires:
  - phase: 63-brush-tip-pipeline
    provides: "63-01's two-branch mask derivation law and the module-level mask registry with its identity contract"
  - phase: 63-brush-tip-pipeline
    provides: "63-02's native lossless encode command (digest + WebP) and the bounded WebP dimension parser"
  - phase: 63-brush-tip-pipeline
    provides: "63-04's project catalog, remembered brush-asset bytes and the refs-only brushPack carrier"
provides:
  - "importTip(file, ports): PNG IHDR / JPEG SOF header sniffing, 64 MB and 64 MP caps before read and before decode, one high-quality 192×192 decode, deriveMask through injected decode/register ports"
  - "app/src/lib/efxPaintBrushImport.ts: applyBrushImportRequest + freshCustomId — the ONE main-realm import mutation (mask, catalog row, stored bytes, dirty flag, no undo entry)"
  - "Four brush channels with total fail-closed guards: brush-import request/result and brush-catalog push/pull, correlated by operationId with bounded waits and always-unlisten receivers"
  - "buildBrushCatalogPayload / applyBrushCatalogPayload: the single cross-realm snapshot (customs + decoded masks + stored WebP bytes + unavailable ids), replace-only in the child"
  - "usePhysicsPaintBrushCatalogBridge: the Studio receiver mounted in the launch integration, with a mount pull that repopulates a webview re-booted by a layer switch"
affects: [63-brush-tip-pipeline]

actuals:
  tokens: 33158
  tasks: 3
  commits: 4
  plan_head_before: e4418bb7ea6a75a2825967578fed851cd2517407
  plan_head_after: 7461c7212ec3fc40f4be2a989f4e79ae52b35c6c

tech-stack:
  added: []
  patterns:
    - "Request/result over the realm boundary: child mints an operationId, one-shot listener with a bounded window timeout, always unlisten in finally"
    - "Triple transport (Tauri emitTo + CustomEvent + origin-checked opener postMessage) with a mirrored receiver, as every existing cross-webview channel does"
    - "Cross-realm snapshot law: both realms derive the built-ins from compile-time constants; the wire carries CUSTOM entries only; application is replace-only and safe on a fresh module instance"
    - "Header-first import gate: both caps are enforced before the step they guard, and every refusal returns a named reason with the existing copy"

key-files:
  created:
    - app/src/lib/efxPaintBrushImport.ts
    - app/src/lib/efxPaintBrushImport.test.ts
  modified:
    - packages/efx-watercolor/src/brushes/importTip.ts
    - packages/efx-watercolor/src/brushes/importTip.test.ts
    - packages/efx-watercolor/src/brushes/pack.test.ts
    - packages/efx-watercolor/src/brushes/index.ts
    - app/src/components/physic-paint/view/BrushesDocker.tsx
    - app/src/types/physicPaint.ts
    - app/src/lib/physicPaintBridge.ts
    - app/src/lib/physicPaintBridge.test.ts
    - app/src/stores/aquarelleBrushCatalog.ts
    - app/src/stores/aquarelleBrushCatalog.test.ts
    - app/src/components/physic-paint/bridge/usePhysicsPaintParentBridge.ts
    - app/src/components/physic-paint/hooks/usePhysicsPaintLaunchIntegration.ts
    - app/src/main.tsx

key-decisions:
  - "Event NAME constants live in physicPaintBridge.ts beside the fifteen existing event names; payload types and guards live in types/physicPaint.ts. The plan's artifact list grouped them together; this split matches every sibling channel and avoids a bridge→types import direction that does not exist elsewhere."
  - "The injected publishCatalog port is awaited (`() => void | Promise<void>`) so the catalog push strictly precedes the result event across the asynchronous Tauri bus; the handler keeps owning the publish-before-answer order."
  - "Malformed import requests are dropped silently, exactly like the project-context and image-import listeners: the shared wire guards are module-private, so no correlated answer can be produced, and the Studio's bounded wait is the answer. The 'malformed-request' failure reason therefore does not exist in the result union."
  - "192×192 WebP validation is a bounded 25-byte VP8L header read (width/height packed at bytes 21-24) mirroring Rust's parse_webp_dimensions, using TIP_SIZE from the package — no dependency is added (T-63-SC). isWebpBytes already restricts the carrier to VP8L."
  - "applyBrushCatalogPayload degrades one undecodable mask to unavailable but never throws; the whole-payload fail-closed refusal lives in the wire guard, matching the acceptance 'a malformed payload is dropped by the guard without throwing'."
  - "The new bridge suite scopes its emit ledger to `physic-paint:brush-` and gives the Tauri marker an `invoke` stub, so a prior suite's in-flight project-context publish (left by projectStore.closeProject) can neither shift the brush ordering nor reject into this run."
  - "buildBrushCatalogPayload spreads each tip and the applier spreads it again: the child never shares an object identity with the parent realm's tip records."

patterns-established:
  - "Snapshot-over-events replaces store sharing: a re-booted child webview mounts, pulls once, and owns a replace-only copy — no push is required to have survived the re-boot."
  - "Fresh-instance test idiom for the cross-realm applier: vi.resetModules() then dynamic imports of catalog, package and asset cache, proving the Studio's starting state explicitly."

requirements-completed: [TIP-01, TIP-02, TIP-04, TIP-06, TIP-10]

coverage:
  - id: D1
    description: "Both import caps (64 MB file, 64 MP decoded) and PNG IHDR / JPEG SOF header sniffing refuse before read and before decode, with the existing named failure copy"
    requirement: "TIP-04"
    verification:
      - kind: unit
        ref: "packages/efx-watercolor/src/brushes/importTip.test.ts"
        status: pass
      - kind: unit
        ref: "packages/efx-watercolor/src/brushes/pack.test.ts"
        status: pass
    human_judgment: false
  - id: D2
    description: "importTip(file, ports) produces exactly one 36,864-byte mask through the injected decode port and hands it to the injected register port; no two-argument call site remains"
    requirement: "TIP-02"
    verification:
      - kind: unit
        ref: "packages/efx-watercolor/src/brushes/pack.test.ts"
        status: pass
      - kind: other
        ref: "pnpm --filter efx-motion-editor exec tsc --noEmit"
        status: pass
    human_judgment: false
  - id: D3
    description: "The main realm performs one import: validated mask, native encode, registered mask, catalog row, remembered WebP bytes and dirty flag in one batch, with no undo entry; identical imports mint distinct ids over one digest"
    requirement: "TIP-06"
    verification:
      - kind: unit
        ref: "app/src/lib/efxPaintBrushImport.test.ts"
        status: pass
    human_judgment: false
  - id: D4
    description: "Four brush channels with total fail-closed guards; the request round trip echoes the same operationId and publishes the catalog before the answer; the pull answers a fresh snapshot and always removes its listener"
    requirement: "TIP-10"
    verification:
      - kind: unit
        ref: "app/src/lib/physicPaintBridge.test.ts#63-05 brush-tip realm channels"
        status: pass
    human_judgment: false
  - id: D5
    description: "The Studio applies the snapshot into its own catalog, mask registry, unavailable set and asset cache, replace-only, proven on a fresh module instance; the receiver hook pulls on mount"
    requirement: "TIP-10"
    verification:
      - kind: unit
        ref: "app/src/stores/aquarelleBrushCatalog.test.ts#aquarelleBrushCatalog — applyBrushCatalogPayload on a FRESH module instance (63-05 / D-20)"
        status: pass
      - kind: unit
        ref: "app/src/lib/physicPaintBridge.test.ts#wires the receiver hook and both main-realm installs in their production mount points"
        status: pass
    human_judgment: false
  - id: D6
    description: "Live Studio round trip: import a PNG/JPG in the Studio, paint a visibly textured stroke, switch layers (the Studio re-boots) and paint with the same tip without re-importing"
    requirement: "TIP-01"
    verification: []
    human_judgment: true
    rationale: "Cross-webview behavior and the visible stroke footprint require a live run: the node vitest environment stubs window, so it cannot exercise the real Tauri event bus, the native encode command or the decoded-image path."

duration: 71min
completed: 2026-11-15
status: complete
---

# Phase 63 Plan 05: Brush-Tip Realm Boundary Summary

**Brush-tip import now runs only in the realm that owns the project and crosses to the Studio as one replace-only catalog snapshot, so an imported PNG/JPG becomes a registered, listed, paint-ready tip that survives the Studio's per-layer re-boot.**

## Performance

- **Duration:** 71 min
- **Started:** 2026-11-15T10:31:48Z
- **Completed:** 2026-11-15T11:42:33Z
- **Tasks:** 3
- **Files modified:** 15

## Accomplishments

- Reshaped `importTip` into a ports-based API: PNG IHDR / JPEG SOF header sniffing, the 64 MB / 64 MP caps enforced before read and decode, one high-quality 192×192 decode, and `deriveMask` through an injected decode/register pair. The package no longer mints ids; the two-argument form is gone everywhere and `BrushesDocker` / `pack.test.ts` moved with it.
- `app/src/lib/efxPaintBrushImport.ts` is the single main-realm import mutation: validates the exact 36,864-byte mask, encodes natively, then in one batch registers the mask, appends the catalog row, remembers the stored WebP bytes and marks the project dirty — with no undo entry and distinct ids for identical imports.
- Four brush channels now connect the realms with total, fail-closed guards; the import answers with the same operationId and the catalog push is emitted before the result, which the round-trip test pins by emit order.
- `buildBrushCatalogPayload` / `applyBrushCatalogPayload` move customs, decoded masks, stored WebP bytes and the unavailable set as one snapshot; the applier is replace-only and proven on a fresh module instance, with built-ins re-derived locally in each realm.
- `usePhysicsPaintBrushCatalogBridge` is mounted beside the project-context receiver and pulls once on mount, so the Studio webview re-booted on every layer switch repopulates without a new import; both main-window installs are wired in `main.tsx`.

## Task Commits

Each task was committed atomically:

1. **Task 1: End-to-end import — one decoded file becomes a listed, paint-ready tip** — `f54e76169` (feat, tracer)
2. **Task 2: Import caps, header sniffing and the named failure** — `0b41addc2` (test, RED) → `1afdf25e6` (feat, GREEN)
3. **Task 3: Realm boundary — producer, Studio-side receiver, mount pull** — `7461c7212` (feat)

_Note: the tracer task ran its feedback gate after its commit: the full `<verify>` was re-run (package build + the import suite) and passed before task 2 expanded into the reshape._

## Files Created/Modified

- `packages/efx-watercolor/src/brushes/importTip.ts` — `IMPORT_TIP_MAX_BYTES` / `IMPORT_TIP_MAX_PIXELS`, `readImageDimensions`, ports-based `importTip(file, ports)`; package id-minting removed
- `packages/efx-watercolor/src/brushes/importTip.test.ts` — caps, header sniffing and corrupt-header pins
- `packages/efx-watercolor/src/brushes/pack.test.ts` — all eleven call sites rewritten to the ports shape
- `packages/efx-watercolor/src/brushes/index.ts` — barrel exports for the new symbols
- `app/src/components/physic-paint/view/BrushesDocker.tsx` — migrated to `importTip(file, { decode, register })`
- `app/src/lib/efxPaintBrushImport.ts` — `applyBrushImportRequest`, `freshCustomId`; the injected `publishCatalog` port
- `app/src/lib/efxPaintBrushImport.test.ts` — handler law: single mutation, distinct ids, no undo, publish-before-answer
- `app/src/types/physicPaint.ts` — four payload types, six total guards, bounded VP8L 192×192 read
- `app/src/lib/physicPaintBridge.ts` — request/publish/pull functions and the two main-realm installers, triple transport
- `app/src/lib/physicPaintBridge.test.ts` — guard pins, round trip, malformed drop, pull, bounded timeout, wiring pin
- `app/src/stores/aquarelleBrushCatalog.ts` — `buildBrushCatalogPayload`, `applyBrushCatalogPayload`
- `app/src/stores/aquarelleBrushCatalog.test.ts` — fresh-instance application and replace-not-append
- `app/src/components/physic-paint/bridge/usePhysicsPaintParentBridge.ts` — `usePhysicsPaintBrushCatalogBridge` receiver with mount pull
- `app/src/components/physic-paint/hooks/usePhysicsPaintLaunchIntegration.ts` — hook mounted beside the project-context receiver
- `app/src/main.tsx` — both brush installers in the main-window branch

## Decisions Made

- Event-name constants stay in `physicPaintBridge.ts` with the other event names; payload types and guards live in `types/physicPaint.ts` (see Deviations).
- The `publishCatalog` port is awaited so the push strictly precedes the result across the async Tauri bus.
- Malformed requests are dropped silently, mirroring the project-context/image-import listeners; there is no `'malformed-request'` result reason.
- WebP dimension validation is a bounded VP8L header read in JS instead of a new dependency (T-63-SC).
- `applyBrushCatalogPayload` never throws; whole-payload refusal is the wire guard's job.
- The new bridge tests scope their emit ledger to `physic-paint:brush-` and stub `invoke` on the Tauri marker to neutralize a pre-existing leaked publish from an earlier suite.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical Functionality] Awaited the injected publish port**
- **Found during:** Task 3 (realm boundary)
- **Issue:** The plan's port type was synchronous (`() => void`); the real publisher awaits `emitTo`, so a fire-and-forget call could let the Studio receive the result before the snapshot and briefly show a half-populated catalog.
- **Fix:** Widened the port to `() => void | Promise<void>` and `await` it before returning the success result. Task 1's synchronous-spy test remains valid.
- **Files modified:** `app/src/lib/efxPaintBrushImport.ts`
- **Verification:** The round-trip test pins the emitted event order (REQUEST → CATALOG → RESULT); all suites green.
- **Committed in:** `7461c7212` (task 3 commit)

**2. [Rule 1 - Bug] New bridge suite polluted by a prior suite's leaked publish**
- **Found during:** Task 3 verification (full-file run)
- **Issue:** A preceding suite's `projectStore.closeProject()` leaves an async script-library publish in flight; landing inside the new tests it (a) emitted a project-context event into the shared ledger, shifting `emits[0]` off the brush request, and (b) rejected on a Tauri marker stub with no `invoke`.
- **Fix:** Assertions now scope to `physic-paint:brush-` events, and the marker is installed through `markTauriRuntime()` with a minimal `invoke` stub. Test-only change; no production behavior altered.
- **Files modified:** `app/src/lib/physicPaintBridge.test.ts`
- **Verification:** Full bridge file and the four-suite verification are green with no unhandled errors.
- **Committed in:** `7461c7212` (task 3 commit)

### Plan Adjustments

- **Constants placement:** The plan asked for "four event constants and their payload types and guards in `types/physicPaint.ts`". The constants live in `physicPaintBridge.ts` beside the existing event-name block; the types and guards are in `types/physicPaint.ts`. Behavior and exports match the artifact list.
- **Malformed import requests:** The result union has no `'malformed-request'` reason because the shared wire guards are module-private; the listener drops a malformed request without emitting or mutating, exactly like the sibling listeners, and the Studio's 15 s bounded wait answers.

---

**Total deviations:** 2 auto-fixed (1 missing critical, 1 bug)
**Impact on plan:** Both were required for correct cross-realm ordering and a stable verification run; no scope creep.

## Issues Encountered

- Task 3's verify initially failed on the emit-order assertion because of the pre-existing leaked publish described above; fixed in the new test file only.
- `tsc --noEmit` flagged a duplicate `bytesToBase64` in the bridge test (a local helper already existed); the new import was dropped in favor of the file's helper.

## TDD Gate Compliance

Plan frontmatter carries `type: execute`, so the plan-level RED→GREEN gate does not apply as a hard machine gate; Task 2 nevertheless executed a genuine RED→GREEN cycle with recorded evidence:

- **RED** — `0b41addc2` (`test(63-05)`): `packages/efx-watercolor/src/brushes/importTip.test.ts` + `pack.test.ts` with a signatures-only scaffold. The TAP run exited 1: target test "reads PNG IHDR width and height" failed on its planned assertion (`readImageDimensions is not implemented yet (63-05 RED)`), 23 failing / 25 passing across the two files, no collection fault. The record lives at `.planning/phases/63-brush-tip-pipeline/63-05-red-evidence-task2.json` and `gsd_run check tdd-red-evidence` returned `RED_EVIDENCE_OK`.
- **GREEN** — `1afdf25e6` (`feat(63-05)`): the caps, header sniffing, ports reshape and consumer migration. `pnpm --filter @efxlab/efx-watercolor exec vitest run src/brushes/importTip.test.ts src/brushes/pack.test.ts` reported 48 passed; the package build and `tsc --noEmit` were clean.
- Task 1 is a `type="tracer"` task: its feedback gate re-ran the task `<verify>` (package build + `efxPaintBrushImport.test.ts`) after the fixes and before task 2 expanded.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plan verification is green end to end: four app suites (207 passed, 1 pre-existing skip), both package suites (48 passed), package build, `tsc --noEmit`, and `efxPaintPackage.test.ts` (98 passed). `grep ... efxPaintBrushImport.ts | grep -c maskDataUrl` prints 0.
- Ready for plan 63-06 onward: the Studio can now request imports and re-pull the catalog after a re-boot; the live Studio round trip (D6) is the phase-level UAT surface.
- TIP-01 stays unchecked in REQUIREMENTS.md by the shared-ID gate: plan 63-06 also owns it (its import surface and tip selection), and only TIP-02, TIP-04, TIP-06 and TIP-10 were marked complete here.
- No blockers.

---
*Phase: 63-brush-tip-pipeline*
*Completed: 2026-11-15*

## Self-Check: PASSED

All created files exist on disk and all five commits (4 task commits + 1 metadata commit) are ancestors of HEAD.
