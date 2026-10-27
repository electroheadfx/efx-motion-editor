# Quick Task 261027-klx: Remove engine-1 Brush mode - Context

**Gathered:** 2026-10-27
**Status:** Ready for planning

<domain>
## Task Boundary

Remove `@efxlab/efx-physic-paint` (engine-1, the Brush module) and every runtime path that touches it, so `@efxlab/efx-watercolor` (engine-2) is the only paint engine.

Plan of record: `SPECS/engine-1-removal/REMOVAL-INVENTORY.md` (measured 2026-10-27, 7 waves, ~40,200 lines deleted). Execute waves 0-6 exactly; do not re-scope, merge, or reorder waves without user approval.

Worktree isolation is disabled (`workflow.use_worktrees=false`), so the gitignored `SPECS/` inventory is directly readable by every agent. Sequential execution on `dev`.

Milestone: this quick targets v2.1.0. Current v2.0.0 milestone is complete pending close.

</domain>

<decisions>
## Implementation Decisions

### Mutation ledger (blocking prerequisite)
- New app-owned mutation ledger module: `allocateMutationId()`, `reserveNextMutationId(n)`, and an ordered acceptance record providing the `getAcceptedTarget` equivalent.
- Monotonic IDs seeded from restored max + 1. No rasterization, no finalization, no hidden rendering.
- Roto script port reads the ledger; it must not call engine-1 for stroke identity or acceptance.
- **Semantic parity approved (2026-10-27).** Numeric mutation-ID identity with engine-1 is impossible by construction (three disappearing ID sources: interactive strokes `EfxPaintEngine.ts:4687`, implicit `++` for clear/physics `:3690`, fresh IDs on load `:5100`). Numeric identity is explicitly waived; record why in the SUMMARY.
- Permanent tests must pin: monotonic/never-reused IDs, seeded from restored max + 1, acceptance order == stroke-end order, SNAP v5 save -> restore -> save stable, `getAcceptedTarget` returns the same target then consumes it, and the ledger itself emits the mutation completion event (no rasterization dependency).
- No temporary audit log. The invariants live as permanent tests.

### Roto engine surface
- **Option A approved (2026-10-27).** Expose a minimal typed `AquarelleEnginePort` (snapshot/restore, exportCanvas, undo/redo/clear, flush) from `AquarelleCanvasLayer`; never expose `WatercolorEngine` internals.
- Re-home `resetBackground`, `clearPreviewBaseImage`, `getPreviewBasePaintSource`, and `loadReferenceFrame` to existing app state (roto reference cache / Aquarelle cached base).
- Add a Roto truth table first, then re-point `shouldPersistRotoFrame` at the ledger / aquarelle recorded-stroke truth source before removing engine-1 document strokes.
- Option B (app-owned state provider) is deferred to a later cleanup after the single-engine world is stable.

### Inventory corrections (research-proven, no re-scope)
- `physicsPaintTemporaryErase.ts` -> **KEEP/SPLIT, not DELETE**: keep `temporaryMove` (used by Aquarelle) and the render gate; remove the engine-1 erase arm only after proving no watercolor path arms it.
- `stackOrder.ts` -> do not delete: copy all three functions (`clampStackPosition`, `reorderForStackPosition`, `targetIndexForStackPosition`) app-side with a parity test before the package is deleted.
- `recordedStrokeGroups.ts`, `aquarelleStrokeBridge.ts`, `physicsPaintRotoScriptClipboard.ts` -> retype/port, not delete. The clipboard must move from engine-1's `toStudioStroke`/`fromStudioStroke` to the watercolor version (already imported as `aquarelleToStudioStroke`). Verified: `efx-watercolor` exports only `toStudioStroke` (`packages/efx-watercolor/src/payload/toStudioStroke.ts:96`), no `fromStudioStroke` — port the inverse locally or refactor the held-pose transform.
- `app/src/lib/paperPass.frameGuard.test.ts` P4(e) -> retarget before the package is deleted, otherwise the whole suite file breaks (it reads the package source at module load).
- Baselines kept: Studio chunk **951,043 bytes**, re-pinned at HEAD `fadbbb3d` after k6j added 202 Studio lines (original 943,411 measured at 12:04; not 924 KB); census G1=91, G2=1,146, G3=12, G4=5, G5=132. The 2,000 kB build budget is unchanged.

### SNAP v4 clean break
- SNAP bumps 4 -> 5 with no brush body.
- A v4 snapshot is unsupported: show one clean-break notice per project binding (not the generic "unsupported SNAP version" error wording). Watercolor script frames from v4 are not seeded.
- Pin the exact message and the no-silent-resurrection behavior in a test.

### Plan shape (user-locked)
- ONE master `PLAN.md` with seven wave tasks (Wave 0 through Wave 6). Each task carries files, action, verify, done.
- Each executor dispatch runs EXACTLY ONE wave, commits code atomically with pathspec-scoped adds, writes the per-wave summary, then STOPS.
- Orchestrator waits for an explicit user "go" before dispatching the next wave. No auto-advance.
- Plan-checker scope sanity must treat the seven-wave structure as user-authorized.

### Do not delete (hard gate 2)
`efx-watercolor`, `efx-paint-host`, `efx-spectral`, Aquarelle layers, `ScriptStrokeOverlay`, `recordedStrokeGroups`, `BrushesDocker`, `BrushResponsePanel`, `WatercolorBrushLibrary`, `aquarelleRecordState`, p5.brush inline FX (`brushP5Adapter` / `brushFxDefaults` / `p5brush.d.ts`), and the Tauri window label + capability `"efx-physic-paint"`.

### Clean break (hard gate 3)
- No `.mce` migration code and no SNAP v4 compatibility.
- Script `engineId` becomes `efx-watercolor` only.
- Keep the legacy script refusal rows (`unreadable-legacy-script`) and the watercolor `brushPack` validation.

### Claude's Discretion
- Exact ledger file location and API surface (within the app-owned constraint).
- How `frameScriptOwner` runtime derivation collapses to `'watercolor' | null`.
- Per-wave documentation commit structure (code commit by executor; docs commit by orchestrator).

</decisions>

<specifics>
## Specific Ideas

- Wave 0 order: ledger + tests, `conditionHeightMap` port with byte-parity test, local `BgMode` / `ToolType` / `StackReorderResult` types, negative test proving watercolor stroke recording no longer calls engine-1.
- `conditionHeightMap` is 21 lines today; it drives the paper pass and must be byte-identical before the package is deleted.
- Studio chunk baseline: 951,043 bytes (re-pinned at HEAD `fadbbb3d`); expected 650-700 KB after removal; 2,000 kB build budget unchanged. Stop if the chunk grows above 951,043 bytes.
- `getAcceptedTarget` risk: verify the ledger can supply accepted targets for Roto move/delete/duplicate; the live port is engine-1 today.
- Module switcher: Brush slot removed; Water color active; Krita stays inert. `activeModule` collapses to `'watercolor'`; `WATERCOLOR_ONLY` seam deleted.
- Krita script engine placeholder is NOT kept: script `engineId` is `efx-watercolor` only.

</specifics>

<canonical_refs>
## Canonical References

- `SPECS/engine-1-removal/REMOVAL-INVENTORY.md` - wave plan, file census, gates, native UAT rows.
- `CLAUDE.md` - project instructions (pnpm, vitest run only, no dev server, Preact signals rules).
- `.claude/skills/efx-preact-reactivity` and `.claude/skills/efx-async-orchestration` - mandatory project skills.

</canonical_refs>
