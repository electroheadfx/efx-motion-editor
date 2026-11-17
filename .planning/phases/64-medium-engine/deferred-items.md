# Phase 64 — Deferred Items

Out-of-scope discoveries logged during plan execution. Not fixed in phase 64.

## 64-07 — `bakeAquarelleScript` still renders with the engine default light

- **Found during:** 64-07 Task 2 (render-path wiring), verified at GREEN
- **File:** `app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.ts`
- **Location:** `bakeAquarelleScript` at line ~2677; adapter creation at ~2700-2702 (`ports.createAquarelleAdapter(size, bakePaper)` / `createDefaultAquarelleAdapter(size, bakePaper)`); call sites at ~3154, ~3530, ~3815
- **Issue:** The Play-Script consume branch (56-08, `createAquarelleBake` with `flush-survives-navigation`) builds its adapter through the optional `ports.createAquarelleAdapter` port, whose signature carries only `(size, paper)`. The per-document `light` added by 64-05 never reaches this bake, so it renders with the engine default (`DEFAULT_LIGHT`) while the live sheet, reveal Play bake and Apply bake use the document light.
- **Why not fixed here:** Threading it requires (a) changing the `createAquarelleAdapter` port signature (a cross-module interface change with its own test implementers) and (b) a cache-key decision — the staged bake cache must include the light, or a light change would serve stale pixels. That is Rule 4 architecture, and no 64 plan covers this path (64-07's scope is the reveal Play bake and the Apply / stroke-edit bake).
- **Impact:** only this bake path; the must-have "every bake path resolves the light" is met for the paths the plan enumerates but not for `bakeAquarelleScript`.
- **Suggested follow-up:** a quick task or a later phase: add `light?: LightSettings` to the port and pass it through both factory calls, decide the staged-cache key term with `lightSignature`, and extend `physicsPaintRotoPlayScriptController.bake.test.ts`.
- **Ledger:** recorded in `.planning/WINDOWS.md` as `unmet-truth`.
