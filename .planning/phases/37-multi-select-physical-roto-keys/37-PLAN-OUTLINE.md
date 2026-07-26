# Phase 37: Multi-Select Physical Roto Keys — Plan Outline

**Generated:** 2026-07-26 (chunked mode, outline only)
**Granularity:** fine · **TRACER_MODE:** true · **TDD:** post-UAT only (D-18) · **MVP user story:** "As a stop-motion animator, I want to select multiple real Physics Paint Roto keys — including Select All — and drag/drop, delete, and Force-Space them as one group, so that retiming and reorganizing many keys is fast and safe."

## Advisory Checkpoints

- **API coverage:** detector `detected: false` — skipped; no external API integration in this phase.
- **Assumption delta (pluralization, advisory):** primary noun = session-local multi-selection identity (ordered stable keyId set + anchor + current). Decision: **add-alongside** — the multi-selection set is a session-local Studio-owned overlay; the persisted/parent-visible selection identity remains the single `selectedKeyId` (D-02, D-05; RESEARCH Pattern 5; `PHYSIC_PAINT_ROTO_PHYSICAL_DOCUMENT_KEYS` unchanged).

## D-18 Sequencing Constraint

Plans 37-01 through 37-04 are **production-only, pre-UAT**: bounded static checks on Phase-37-touched files (tsc scoped to touched files, grep/source assertions). No test creation, modification, deletion, renaming, or execution. Plan 37-05 is the **blocking native UAT checkpoint** (autonomous: false). Plan 37-06 is **post-UAT only** and holds all regression tests (TDD structure permitted there), then typecheck, then build.

## Plan Table

| Plan ID | Objective | Wave | Depends On | Requirements |
|---------|-----------|------|------------|--------------|
| 37-01 | Resolver group operations: extend the closed intent union in `physicsPaintRotoPhysicalResolver.ts` with `move-key-group`, `delete-key-group`, and scoped `force-spacing` (`scopeKeyIds`) candidate builders implementing locked mappings GD-1..GD-3 / GDel-1..GDel-2 / GFS-1..GFS-3; extend `PhysicPaintRotoPhysicalEditFailure` with structured `conflictingAppFrames`; generalize drag metadata (`movedKeyIds` + `grabbedKeyId`) and removed-key set; extend operation-kind allowlists in `types/physicPaint.ts`, `useRotoPhysicalEditHistory` ordinary-kind guard, and `physicPaintBridge` parent validation. Tracer task: one `move-key-group` intent resolved end-to-end through `finalizeProposal` (GD-1) proven by static source assertions. | 1 | [] | 37-GROUP-DRAG, 37-GROUP-DELETE, 37-GROUP-FORCE-SPACING, 37-ATOMIC-TRANSACTIONS |
| 37-02 | Multi-selection state at the Studio controller boundary: `selectedKeyIds` / `selectionAnchorKeyId` Signals (keyId-only, never across the bridge), pure collapse/extend/toggle/select-all reducers, post-acceptance selection rules per D-17 (group drag → set kept, grabbed current; scoped spacing → set kept; group delete → survivor; all other accepted ops → collapse), launch-replacement reset, Escape-collapse and Cmd/Ctrl+A dispatcher branches in `physicsPaintStudioKeyboard.ts` (strip-focus scoped, paint-edit-mode guarded). Tracer task: select-all reducer over the real key identity set wired into the Studio signal boundary. | 1 | [] | 37-MULTI-SELECT-IDENTITY, 37-SELECT-ALL |
| 37-03 | Group action wiring in `useRotoTimelineActions.ts`: `prepareRotoKeyGroupDrag`/`commitRotoKeyGroupDrag` reusing the publication/opaque-retention/target-signature commit contract, group delete routing (Backspace/Delete key, toolbar icon — one shared transaction), scoped `applyForceSpacing` (selection-size-dependent scope per D-10), Select All availability/guarded-reason derivation; rejection reasons to status capsule + LOG per D-26. | 2 | [37-01, 37-02] | 37-GROUP-DRAG, 37-GROUP-DELETE, 37-GROUP-FORCE-SPACING, 37-ATOMIC-TRANSACTIONS, 37-SELECT-ALL |
| 37-04 | Workflow-strip UI integration: modifier-click/Shift-click/plain-click gesture handling (no navigation steal, no drag arming on modifiers), group drag session with complete-mapping preview and blocked-target preview (`conflictingAppFrames` → blocked cell class + cannot-drop cursor), Select All guarded icon at end of key-utilities pill after Delete (Pitfall 7 placement), `.selected` secondary cell treatment + `Selected key` tooltip copy, group-aware preview view model in `physicsPaintWorkflowPresentation.ts`, CSS classes in `physicsPaintStudio.css`, `cssEscape` on all new keyId selectors. | 3 | [37-03] | 37-UI-INTEGRATION, 37-GROUP-DRAG, 37-SELECT-ALL, 37-MULTI-SELECT-IDENTITY |
| 37-05 | Blocking native user-owned UAT (autonomous: false): UAT script anchored on locked mappings GD-1..GD-3, GDel-1..GDel-2, GFS-1..GFS-3 plus the 3 UI-SPEC backstops (blocked-target preview treatment, secondary-selected distinctness at 18px cells, fit-content non-wrapping action row in 28px band) and downstream parity checklist (save/reopen, live pixels, caches, dirty state, playback, onion/reference, preview, export, missing/background rendering, timeline extent; Basic/FX layers unchanged). Execution halts until explicit user approval. | 4 | [37-04] | 37-UAT-THEN-REGRESSION, 37-DOWNSTREAM-PARITY, 37-UI-INTEGRATION |
| 37-06 | Post-UAT regression coverage (type: tdd; only after explicit UAT approval): NEW `physicsPaintRotoPhysicalResolver.test.ts` covering group intents + locked GD/GDel/GFS mappings only (36.14 deferred single-key coverage is out of scope), selection-controller reducer tests (toggle/range/collapse/select-all, D-17 post-op rules), group presentation view-model tests (blocked conflicts, moved-set roles); then `pnpm --dir app vitest run` full suite, typecheck, build. | 5 | [37-05] | 37-UAT-THEN-REGRESSION, 37-GROUP-DRAG, 37-GROUP-DELETE, 37-GROUP-FORCE-SPACING, 37-ATOMIC-TRANSACTIONS, 37-MULTI-SELECT-IDENTITY |

## Coverage Audit

- **GOAL:** user story covered by 37-01..37-05 (production + UAT); 37-06 locks it with regressions.
- **REQ:** all 9 requirement IDs appear in at least one plan (see table).
- **RESEARCH:** Patterns 1-5 → 37-01/37-02/37-03; Pitfalls 1-3 (failure shape, preview view model, removed-set) → 37-01/37-04; Pitfalls 4-6 (Escape, Cmd/Ctrl+A, modifier-click) → 37-02/37-04; Pitfall 7 (Select All placement) → 37-04; Pitfall 8 (stale module names) → all plans use live modules; A3 (empty records acceptance) → 37-01 static check + 37-05 UAT anchor GDel-2.
- **CONTEXT:** D-01..D-17 mapped to plans 37-01..37-04; D-18 → sequencing above; D-19 → prohibition carried into every plan's must_haves.
- **UI-SPEC:** 3 backstops → 37-05 UAT; copy/visual contracts → 37-04.
- **Deferred ideas:** group Duplicate, group Copy/Paste, Shift+Arrow — NOT planned.
