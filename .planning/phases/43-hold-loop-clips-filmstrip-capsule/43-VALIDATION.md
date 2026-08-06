---
phase: 43
slug: hold-loop-clips-filmstrip-capsule
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
# NOTE (2026-08-06, audit finding 1): this artifact is the FINALIZED validation map for the revised 43-01..43-10 plans.
# status remains `draft` by framework convention — it flips to `validated` only when /gsd-validate-phase runs after execution.
# Nothing below reports execution results; every Status cell is ⬜ pending because no plan has executed yet.
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-08-06
finalized: 2026-08-06
---

# Phase 43 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution. Finalized against the revised 43-01..43-10 plans (audit findings 1-12 applied 2026-08-06): lazy interval resolution + per-frame typed contract, placementStart identity model, declared 43-09 consumer list, Undo→Redo transaction proofs, valid-loop preview/export parity, unsigned packaged smoke step, bounded 43-04 deviation protocol.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest ^2.1.9 |
| **Config file** | `app/vitest.config.ts` |
| **Quick run command** | `pnpm --dir app exec vitest run <file>` |
| **Full suite command** | `pnpm --dir app exec vitest run` |
| **Typecheck** | `pnpm --dir app run typecheck` |
| **Build** | `pnpm build` |
| **Estimated runtime** | ~60 seconds |

---

## Sampling Rate

- **After every task commit:** Run `pnpm --dir app exec vitest run <changed-area spec>`
- **After every plan wave:** Run `pnpm --dir app exec vitest run`
- **Before `/gsd-verify-work`:** Full suite must be green + `pnpm --dir app run typecheck` + `pnpm build`; native visual UAT (user-run) is the final oracle
- **Max feedback latency:** 60 seconds

---

## Wave Model (revised — audit finding 5)

| Wave | Plans | Depends on |
|------|-------|-----------|
| 1 | 43-01 (persistence gauntlet + history), 43-04 (HOLD-01..04 hardening specs) | — |
| 2 | 43-02 (resolver: interval derivation + lazy typed per-frame query + exhaustiveness sweep) | 43-01 |
| 3 | 43-03 (store: typed linked branch, loop-aware end frame, atomic commit acceptance, unresolved query) | 43-02 |
| 4 | 43-05 (guards + materialization + preflight), 43-07 (capsule geometry + renderer), 43-09 (export preflight + parity + placeholder variant + consumers) | 43-05: 43-01/43-02/43-03 · 43-07: 43-02/43-03 · 43-09: 43-02/43-03 |
| 5 | 43-06 (dialog modes, loop ops, bridge message) | 43-05 |
| 6 | 43-08 (hit regions, tooltip host, keyboard, Studio badge) | 43-06, 43-07 |
| 7 | 43-10 (full gates + native UAT + unsigned packaged smoke) | 43-04, 43-08, 43-09 |

Same-wave file-overlap check: Wave 1 (43-01 vs 43-04: no shared files — 43-04 is test-only), Wave 4 (43-05: resolver/controller; 43-07: timeline files; 43-09: export/preview/model/store/coordinator/Studio consumers — no pairwise overlap). 43-05's dependency on 43-03 (loop-resolved source payload/cache seam for materialize-on-paint) is explicit; no symbol is consumed before its producer plan completes.

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 43-01-T1 | 43-01 | 1 | HOLD-05 (D-29, D-30, D-31) | T-43-01-01/02/03 | Fail-closed parse; dangling refs verbatim; additive optional field; placementStart independent identity | unit (RED→GREEN tracer) | `pnpm --dir app exec vitest run physicsPaintRotoLoopClips` | ❌ created in task | ⬜ pending |
| 43-01-T2 | 43-01 | 1 | HOLD-05 (D-10) | T-43-01-02 | loopClips in revision fingerprint + snapshot; Undo AND Redo transaction proof | unit | `pnpm --dir app exec vitest run physicsPaintRotoLoopHistory useRotoPhysicalEditHistory` | ❌ created in task | ⬜ pending |
| 43-04-T1 | 43-04 | 1 | HOLD-01, HOLD-02 | T-43-04-01/02 | Byte-identical determinism; adjacent ranges; complete stroke set; bounded deviation on RED | unit | `pnpm --dir app exec vitest run physicsPaintRotoHoldDeterminism physicsPaintRotoPlayScriptRenderer` | ❌ created in task | ⬜ pending |
| 43-04-T2 | 43-04 | 1 | HOLD-03, HOLD-04 | T-43-04-02 | Cancel/failure atomicity; one Undo/Redo; one raster per frame; bounded deviation on RED | unit (store-level) | `pnpm --dir app exec vitest run physicsPaintRotoPlayScriptController physicPaintStore.rotoHoldComposite` | ❌ created in task | ⬜ pending |
| 43-02-T1 | 43-02 | 2 | HOLD-05 (D-32) | T-43-02-01 | RED spec: lazy interval derivation, typed contract, no duration-proportional collections (huge repeat + Infinity) | unit (RED) | `pnpm --dir app exec vitest run physicsPaintRotoLoopResolver` (must FAIL) | ❌ created in task | ⬜ pending |
| 43-02-T2 | 43-02 | 2 | HOLD-05 (D-14, D-24, D-25, D-26, D-32) | T-43-02-01/02/03/04 | O(1) modulo after honest-complexity interval lookup; self-exclusion; typed 'linked-unresolved' per-frame (no global failure) | unit (GREEN) | `pnpm --dir app exec vitest run physicsPaintRotoLoopResolver physicsPaintRotoPhysicalResolver` | ✅ extend | ⬜ pending |
| 43-02-T3 | 43-02 | 2 | HOLD-05 (D-11, D-23) | T-43-02-02 | Exhaustiveness switches; virtual occurrences never key-selectable/draggable; visible-window-bounded strip queries | unit + typecheck | `pnpm --dir app exec vitest run rotoTimelineSelectors rotoPhysicalTimelinePorts physicsPaintWorkflowPresentation useRotoTimelineModel PhysicsPaintWorkflowStrip && pnpm --dir app run typecheck` | ✅ extend | ⬜ pending |
| 43-03-T1 | 43-03 | 3 | HOLD-04, HOLD-05 (D-26, D-27, D-32) | T-43-03-02 | One source cache entry per source frame; one edit invalidates all occurrences; loop-aware end frame from intervals only | unit (store-level) | `pnpm --dir app exec vitest run physicPaintStore.rotoLoopClips physicPaintStore` | ❌ created in task | ⬜ pending |
| 43-03-T2 | 43-03 | 3 | HOLD-05 (D-06, D-10) | T-43-03-01 | Atomic records+loopClips acceptance; stale-revision rejection; Undo AND Redo replay | unit | `pnpm --dir app exec vitest run physicPaintStore.rotoLoopClips` | ❌ created in task | ⬜ pending |
| 43-05-T1 | 43-05 | 4 | HOLD-05 (D-04, D-07, D-09, D-11, D-12, D-13) | T-43-05-01/02 | Fail-closed guards with locked copy; original-vs-duplicated placementStart on rigid drag; materialize-on-paint/Clear with Undo AND Redo | unit | `pnpm --dir app exec vitest run physicsPaintRotoLoopGuards physicsPaintRotoLoopResolver physicsPaintRotoPhysicalResolver` | ❌ created in task | ⬜ pending |
| 43-05-T2 | 43-05 | 4 | HOLD-05 (D-06) | T-43-05-03 | Generation-overlap preflight from shared derivation; commit+shrink one command with Undo AND Redo | unit | `pnpm --dir app exec vitest run physicsPaintRotoPlayScriptController physicsPaintRotoLoopHistory` | ✅ extend | ⬜ pending |
| 43-07-T1 | 43-07 | 4 | HOLD-06 (D-15, D-16, D-19, D-21, D-22) | T-43-07-01/03 | Pure geometry: badge forms, zoom bands, diagonal landing, anchor flag, first-cycle real-key-backed classification; one interval model per loop | unit | `pnpm --dir app exec vitest run loopCapsuleGeometry frameMap` | ❌ created in task | ⬜ pending |
| 43-07-T2 | 43-07 | 4 | HOLD-06 (D-15, D-21, D-23) | T-43-07-01/02 | Canvas-only drawing; visible-window-only cells; duplicated first-cycle dashed/no-diamond branch | unit (geometry-driven + draw spy) | `pnpm --dir app exec vitest run TimelineRenderer loopCapsuleGeometry` | ✅ extend | ⬜ pending |
| 43-09-T1 | 43-09 | 4 | HOLD-04, HOLD-05 (D-27, D-28) | T-43-09-01/03/04 | Export preflight fail-fast (failure path) + valid-loop preview/export parity across six scenarios (success path) | unit | `pnpm --dir app exec vitest run exportEngine` | ❌ created in task | ⬜ pending |
| 43-09-T2 | 43-09 | 4 | HOLD-05 (D-28, D-31) | T-43-09-02 | Placeholder variant aligned with typed contract; marked preview placeholder; non-blocking; neighbors unaffected | unit | `pnpm --dir app exec vitest run previewRenderer physicPaintStore.rotoLoopClips` | ❌ created in task | ⬜ pending |
| 43-09-T3 | 43-09 | 4 | HOLD-05 (D-27, D-28) | T-43-09-02 | Placeholder never persisted; Studio non-blocking; exhaustive union handling in every declared consumer | unit + typecheck | `pnpm --dir app exec vitest run useRotoFramePersistenceCoordinator PhysicsPaintStudio rotoOnionPreview useRotoReferenceController useRotoPersistenceIntegration && pnpm --dir app run typecheck` | ✅ extend | ⬜ pending |
| 43-06-T1 | 43-06 | 5 | HOLD-05 (D-01, D-02, D-03, D-05, D-10, D-31) | T-43-06-02/03 | Atomic loop ops (Update/Unlink/Duplicate/Repair/Relink/Regenerate) with full initial→op→Undo→Redo proofs; referential ops leave source byte-identical; guard rejections preserve unresolved record | unit | `pnpm --dir app exec vitest run physicsPaintRotoPlayScriptController` | ✅ extend | ⬜ pending |
| 43-06-T2 | 43-06 | 5 | HOLD-05, HOLD-06 (D-20) | T-43-06-02 | Locked English copy; disabled locked fields; compact-fit; no prohibited terms | unit | `pnpm --dir app exec vitest run PhysicsPaintPlayScriptDialog physicsPaintRotoPlayScriptController` | ✅ extend | ⬜ pending |
| 43-06-T3 | 43-06 | 5 | HOLD-06 (D-01) | T-43-06-01 | Typed guarded bridge message; launch-or-focus; malformed payload rejected | unit | `pnpm --dir app exec vitest run physicsPaintBridgeTransport physicPaintBridge` | ✅ extend | ⬜ pending |
| 43-08-T1 | 43-08 | 6 | HOLD-06 (D-03, D-17, D-23) | T-43-08-01 | Six hit regions incl. real-key-backed vs duplicated first-cycle branching; keyboard focus unit; no ghost key leakage | unit | `pnpm --dir app exec vitest run TimelineInteraction` | ✅ extend | ⬜ pending |
| 43-08-T2 | 43-08 | 6 | HOLD-06 (D-17, D-19, D-21, D-22, D-31) | T-43-08-02/03 | Flat-multiline tooltip forms; pinned actions incl. error-state Repair/Relink; hover/focus/Escape discipline | unit | `pnpm --dir app exec vitest run TimelineCapsuleTooltip` | ❌ created in task | ⬜ pending |
| 43-08-T3 | 43-08 | 6 | HOLD-06 (D-18) | T-43-08-01 | Additive Studio badge: inset border + dot, zero geometry/palette change | unit | `pnpm --dir app exec vitest run PhysicsPaintWorkflowStrip` | ✅ extend | ⬜ pending |
| 43-10-T1 | 43-10 | 7 | HOLD-01..06 | T-43-10-01/02 | Full gates actually execute: vitest + typecheck + build + dependency diff | gate + UAT script | `pnpm --dir app exec vitest run && pnpm --dir app run typecheck && pnpm build && git diff --quiet <phase-base> HEAD -- app/package.json pnpm-lock.yaml` | n/a | ⬜ pending |
| 43-10-T2 | 43-10 | 7 | HOLD-01..06 | — | Blocking native UAT incl. Undo→Redo steps, valid-loop PNG export parity, unsigned packaged smoke (no signing material) | manual (user oracle) | see Manual-Only Verifications | n/a | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky — all pending: no plan has executed (status: draft by lifecycle convention).*

---

## Requirement Coverage Map

| Requirement | Covering tasks | Verification |
|-------------|----------------|--------------|
| HOLD-01 | 43-04-T1 | automated (complete stroke set, adjacent ranges, single-stroke cycle) |
| HOLD-02 | 43-04-T1 | automated (byte-identical dataUrls across regeneration + save/reopen simulation, zero and nonzero Motion) |
| HOLD-03 | 43-04-T2 | automated (cancel/failure atomicity, one Undo/Redo, commit-path reuse) |
| HOLD-04 | 43-04-T2, 43-03-T1, 43-09-T1 | automated (one raster per frame; cache identity; export/preview parity) |
| HOLD-05 | 43-01-T1/T2, 43-02-T1/T2/T3, 43-03-T1/T2, 43-05-T1/T2, 43-06-T1, 43-09-T1/T2/T3 | automated (persistence, lazy resolution, typed contract, guards, ops, export) |
| HOLD-06 | 43-07-T1/T2, 43-08-T1/T2/T3, 43-06-T2/T3 | automated (geometry, copy, hit dispatch, tooltip forms, badge) + native UAT (visuals) |

## Decision Coverage Map (D-01..D-32)

| Decision | Covering tasks | Verification |
|----------|----------------|--------------|
| D-01 (badge → loop-edit) | 43-06-T1/T3, 43-08-T1 | automated + native UAT (Studio open/closed) |
| D-02 (source-edit regeneration) | 43-06-T1, 43-04-T2 | automated (staged commit reuse, affected count, Undo+Redo) |
| D-03 (unlink-only delete) | 43-06-T1, 43-08-T1 | automated (source keys remain; Undo+Redo) |
| D-04 (rigid drag, original vs duplicated placement) | 43-05-T1 | automated (placementStart follows only for original loops) |
| D-05 (Link/Create + Duplicate identity) | 43-06-T1 | automated (matching key; placementStart=destination, shared sourceKeyIds, no regeneration, Undo+Redo) |
| D-06 (shrink policy + preflight) | 43-05-T2, 43-01-T2 | automated (locked preflight line; one command Undo+Redo) |
| D-07 (source-key deletion rejected) | 43-05-T1 | automated (verbatim copy) |
| D-08 (zero-effective survival) | 43-02-T1/T2 | automated (Effective 0f survives; re-expansion) |
| D-09 (paste never carries loop identity) | 43-05-T1 | automated |
| D-10 (atomic loop ops) | 43-01-T2, 43-06-T1 | automated (one command; Undo+Redo proofs) |
| D-11 (rigid linked keys) | 43-05-T1 | automated (verbatim copy; Force Spacing rejection) |
| D-12 (materialize-on-paint) | 43-05-T1, 43-03-T1 | automated (loop-resolved base; Undo+Redo) |
| D-13 (Clear vs Delete-key) | 43-05-T1 | automated (verbatim rejection; Clear materialization; Undo+Redo; later delete re-expands) |
| D-14 (loop-loop priority) | 43-02-T1/T2 | automated (not-pushed; effective end min; placementStart collision) |
| D-15 (source thumbnails; duplicated first-cycle) | 43-07-T1/T2 | automated (real-key-backed classification; dashed/no-diamond branch) + native UAT |
| D-16 (zoom-adaptive repetitions) | 43-07-T1/T2 | automated (band thresholds 16px/8px) + native UAT |
| D-17 (occurrence tooltip + seek) | 43-08-T1/T2 | automated (copy form, Edit source frame dispatch) |
| D-18 (Studio additive badge) | 43-08-T3, 43-02-T3 | automated (additive class; palette/geometry unchanged) |
| D-19 (badge math forms) | 43-07-T1 | automated (three exact forms; no `Infinityf`) |
| D-20 (English only; prohibited terms) | 43-06-T2, 43-07-T2, 43-08-T2 | automated (grep gates; locked strings) |
| D-21 (truncation diagonal) | 43-07-T1/T2 | automated (landing x partial vs complete) + native UAT |
| D-22 (zero-effective anchor flag) | 43-07-T1/T2, 43-08-T1 | automated (geometry; 24×24 hit target) + native UAT |
| D-23 (interaction states) | 43-07-T2, 43-08-T1 | automated (precedence; paint-only states) + native UAT |
| D-24 (self-exclusion boundary) | 43-02-T1/T2 | automated (own placementStart/occurrences/sourceKeyIds excluded; three valid boundary kinds) |
| D-25 (dynamic parent end) | 43-02-T1/T2, 43-03-T1 | automated (Infinity tracks parent end; capacity bound) |
| D-26 (resolver extension; shared source cache) | 43-02-T2, 43-03-T1 | automated (5×5 → 5 cache identities; one edit invalidates all) |
| D-27 (one canonical resolver) | 43-03-T1, 43-09-T1 | automated (preview/export parity per frame; six scenarios) |
| D-28 (placeholder vs export block) | 43-09-T1/T2/T3 | automated (fail-fast block; marked placeholder; non-blocking; never persisted) |
| D-29 (additive persistence; placementStart identity) | 43-01-T1 | automated (round-trip byte-identical; absent-field v0.8.1 load; duplicated-loop identity; no shim) |
| D-30 (derived state never persisted) | 43-01-T1, 43-02-T2 | automated (pure derivation; identical re-resolution) |
| D-31 (stale refs verbatim; repair/relink) | 43-01-T1, 43-02-T1/T2, 43-06-T1, 43-08-T2, 43-09-T2 | automated (verbatim preservation; unresolved interval survives; ops with Undo+Redo; error tooltip actions) + native UAT (fixture flow) |
| D-32 (lazy virtual resolution) | 43-02-T1/T2/T3, 43-07-T1/T2, 43-09-T1 | automated (no duration-proportional collections for huge repeat + Infinity; visible-window-only consumers; incremental export) |

## Cross-Cutting Contract Coverage (audit finding 1 checklist)

| Contract | Covering tasks |
|----------|----------------|
| Persistence + absent-field compatibility | 43-01-T1 (+ UAT step 15) |
| Stale-reference preservation | 43-01-T1, 43-02-T1, 43-06-T1 (+ UAT step 18) |
| Source-cycle vs placement identity | 43-01-T1, 43-02-T1/T2, 43-05-T1, 43-06-T1, 43-07-T1/T2, 43-08-T1 (+ UAT step 9) |
| Lazy virtual loop resolution | 43-02-T1/T2/T3, 43-07-T1/T2 |
| D-24 self-exclusion | 43-02-T1/T2 |
| Unresolved-frame placeholder behavior | 43-09-T2/T3, 43-03-T1 |
| Export preflight | 43-09-T1 |
| Preview/export parity (valid loops) | 43-09-T1 (+ UAT step 19 native PNG sequence) |
| Materialize-on-paint and Clear | 43-05-T1 |
| Delete/Cut/drag/Force Spacing guards | 43-05-T1 |
| Generation-overlap preflight | 43-05-T2 |
| Update/Unlink/Duplicate/Repair/Relink Undo AND Redo | 43-06-T1, 43-01-T2, 43-03-T2 (+ UAT steps 6, 9, 18) |
| Capsule geometry and hit-testing | 43-07-T1/T2, 43-08-T1 |
| Keyboard interaction | 43-08-T1 (+ UAT step 17) |
| Studio strip additive marker | 43-08-T3, 43-02-T3 |
| Source-cache invalidation | 43-03-T1 |
| Full tests, typecheck, build | 43-10-T1 (automated gate actually executes all three) |
| Native UAT | 43-10-T2 (blocking checkpoint) |
| Packaged/export checks | 43-10-T1 UAT step 19 (native PNG export) + step 20 (unsigned packaged smoke; signed packaged UAT = Phase 44) |

---

## Wave 0 Requirements

Wave 0 obligations are satisfied IN-PLAN by RED-first tasks (no separate scaffold wave needed); `wave_0_complete: false` remains honest until those tasks execute:

- [ ] 43-02-T1 creates the loop resolver spec: lazy interval derivation, per-frame typed contract (real / linked / linked-unresolved / empty), real-wins precedence, next-clip boundary (3 valid kinds per D-24), loop-loop priority (D-14), zero-effective, re-expansion, half-open intervals, no-duration-proportional-collections for huge repeat + Infinity — covers HOLD-05 / D-32
- [ ] 43-01-T1 creates the persistence spec: loopClips round-trip save/reopen, duplicated-loop placement identity, absent-field v0.8.1 load, stale keyId verbatim preservation (D-31), Save As atomic copy, fail-closed parse with no compatibility alias — covers HOLD-05 / D-29..D-31
- [ ] 43-04-T1 creates the determinism spec: byte-identical dataUrls across regeneration for zero and nonzero Motion — covers HOLD-02
- [ ] 43-01-T2 creates the history spec: loop-only op snapshot with Undo AND Redo, generation+shrink one-command coherence in both directions (D-06/D-10) — covers HOLD-03
- [ ] 43-06-T1 extends the controller spec: repairLoop (regenerate + sourceKeyIds retarget as one commit; destination-overlap rejection preserves the unresolved record verbatim; Undo restores byte-identically, Redo re-applies) and relinkLoop (guard rejections on empty/dangling/cross-authority targets; post-relink re-derivation; Undo+Redo) — covers D-31 / HOLD-05
- [ ] No framework install needed — infrastructure exists

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Filmstrip capsule visual states (badges, bands, truncation diagonal, zoom levels, duplicated-loop first-cycle dashed cells without diamonds) | HOLD-06 | Native visual rendering is the user's oracle; MCP Chrome DevTools not allowed | User runs app, opens a loop clip project and a duplicated-loop project, inspects capsules at multiple zoom levels and truncation states (UAT steps 3, 5, 9) |
| Badge click → loop-edit dialog flow (incl. Studio closed) | HOLD-06 | Cross-window parent→child bridge behavior needs live app | User clicks capsule badge with Studio open and closed; verifies dialog reopens in loop-edit mode (UAT step 6) |
| Undo AND Redo outcomes for Update loop, Unlink loop, Duplicate linked loop (audit finding 7) | HOLD-05 | Live history UX is the user's oracle | UAT steps 6, 9: after each op, Undo restores the exact prior state and Redo restores the exact operation result |
| Unresolved-loop repair/relink recovery flow (D-31) | HOLD-05/HOLD-06 | End-to-end recovery UX (fixture project with dangling refs, dialog prefill, atomicity) needs live app | UAT step 18: fixture with dangling loop record; red error outline + tooltip remedy line; `Repair loop…` → `Regenerate source cycle` (loop re-resolves, export unblocks, Undo restores the unresolved record verbatim, Redo re-applies); `Relink loop…` on a second fixture; unrepaired record survives save/reopen verbatim |
| Valid-loop native PNG sequence export parity (audit finding 8) | HOLD-04/HOLD-05 | Real export artifact inspection needs the live app | UAT step 19: export finite Progressive, finite Static/Hold, Infinity-bounded, and truncated loops; verify frame count, source-cycle repetition order, no placeholder/blank frames, preview/export visual parity, no duplicated durable source assets |
| Unsigned packaged-app smoke (audit finding 9 decision: smoke in this phase; signed/notarized packaged UAT remains Phase 44 scope) | HOLD-05/HOLD-06 | Packaged boundary differs from dev (CSP enforcement); no signing material may be accessed | UAT step 20: executor builds the unsigned packaged app via `pnpm build`; user launches the .app and smoke-verifies capsule rendering, loop-edit dialog, valid linked-loop preview, unresolved placeholder, valid PNG export, unresolved export block |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or a justified manual-only row above
- [x] Sampling continuity: no 3 consecutive tasks without automated verify (only 43-10-T2 is manual, and it is the final blocking UAT checkpoint by design)
- [x] Wave 0 covers all MISSING references (new specs are created RED-first inside their own plans — mapped above)
- [x] No watch-mode flags anywhere (`vitest run` only)
- [x] Feedback latency < 60s
- [x] `nyquist_compliant: true` set in frontmatter — every requirement (HOLD-01..06) and every decision (D-01..D-32) has an explicit automated verification or a justified manual row

**Status honesty note (audit finding 1):** `status: draft` remains set by framework convention until `/gsd-validate-phase` runs after execution; this artifact is the finalized validation MAP, not an execution record — every Status cell is ⬜ pending and no test is reported green. Frontmatter, this map, and the sign-off agree.

**Approval:** pending (user native UAT — 43-10-T2 blocking checkpoint)
