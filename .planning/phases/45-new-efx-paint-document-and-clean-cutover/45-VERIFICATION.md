---
phase: 45-new-efx-paint-document-and-clean-cutover
verified: 2026-08-23T20:10:00Z
status: passed
score: 5/5 must-haves verified
behavior_unverified: 0
overrides_applied: 0
---

# Phase 45: New EFX Paint Document and Clean Cutover Verification Report

**Phase Goal:** Introduce the new parent-owned EFX Paint document as the only supported Paint runtime and persistence format, with explicit pre-v1.0 rejection.
**Verified:** 2026-08-23T20:10:00Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| #   | Truth (roadmap success criteria) | Status     | Evidence |
| --- | -------------------------------- | ---------- | -------- |
| 1   | Creating a new v1.0 parent Paint layer produces exactly one EFX Paint document with one default Paint track and one fixed Background track with the configured fallback | ✓ VERIFIED | `createEfxPaintDocument(parentLayerId)` (app/src/efx-paint/document/efxPaintDocument.ts) returns a deep-frozen version-1 document with exactly one default `Paint` track and one fixed `Background` track with `transparent` fallback; `AddFxMenu.tsx:158` calls `registerDocument(createEfxPaintDocument(layerId))` on both layer-creation branches; 17 factory/parser tests pass |
| 2   | Opening a pre-v1.0 Paint project fails explicitly as unsupported with no partial mutation or fallback rendering | ✓ VERIFIED | `findLegacyPhysicPaintRejection(project)` (app/src/efx-paint/document/efxPaintCleanBreak.ts) returns a rejection for any non-empty `physic_paint_outputs`, `cache/physic-paint` reference, or `physic-paint` layer without a document; `projectStore.ts:824` runs the gate immediately after the open result check and BEFORE `loadEfxPaintDocuments`/`closeProject`/`hydrateFromMce`/`startAutoSave`, showing the blocking no-recourse dialog via `showLegacyPhysicPaintRejectionDialog` with zero mutation; 9 gate tests pass; native UAT part 3 PASS (real v0.9 project copy, original byte-untouched) |
| 3   | No legacy one-track schema reader, converter, renderer, cache path, or compatibility branch remains reachable | ✓ VERIFIED | DOC-04 grep contract test (app/src/efx-paint/efxPaintCleanBreakContract.test.ts, 3/3 passing) walks app/src, app/src-tauri/src, packages/efx-physic-paint/src with a comment-stripping scanner and asserts zero matches for the 11 legacy tokens outside the explicit allowlist; `physic_paint_outputs` confined to its declared opaque-carrier locations; `app/src/lib/physicPaintPersistence.ts` + test deleted; `McePhysicPaint*` types removed; legacy cache dir never created and left untouched (`project_io.rs` test) |
| 4   | Save/reopen preserves new document, track, Loop Clip, source asset, and cache identity | ✓ VERIFIED | Rust round-trip (`test_save_and_open_roundtrip`, `test_save_skips_empty_document_keys`, `project_save_binds_cache_transaction_for_open_time_commit_recovery` — all pass); TS persistence round-trip (efxPaintPersistence.test.ts 7 tests pass); staging/commit/settle/recover transaction preserves the previous generation on rollback (`settle_commit_swaps_and_rollback_restores_previous_generation` passes); native UAT part 2 (human): stroke persisted across save/quit/reopen, on-disk `.mce` D-11 field-by-field match, Recent Projects entry |
| 5   | Main-editor sequence timing and outer layer composition remain unchanged | ✓ VERIFIED | Phase-cumulative diff contains none of the 5 protected main-editor files (previewRenderer.ts, paintStore.ts, paintRenderer.ts, PaintOverlay.tsx, paintPersistence.ts); full app suite (2710 tests), typecheck, cargo test, and build all green; native UAT part 4 (human) confirms inline EFX Paint layers behave exactly as before |

**Score:** 5/5 truths verified (0 present, behavior-unverified)

### Required Artifacts

| Artifact | Expected | Status | Details |
| -------- | -------- | ------ | ------- |
| `app/src/efx-paint/document/efxPaintDocument.ts` | Pure v1.0 model: types, factory, version const | ✓ VERIFIED | `EFX_PAINT_DOCUMENT_VERSION = 1`, `createEfxPaintDocument` with 1 default Paint track + 1 fixed Background track (transparent fallback), deep-frozen, no external deps |
| `app/src/efx-paint/document/efxPaintDocumentParsers.ts` | Fail-closed parsers | ✓ VERIFIED | `hasOnlyKeys` allowed-key sets; throws on unknown members, duplicate track IDs, dangling activeTrackId, wrong version |
| `app/src/efx-paint/document/efxPaintCleanBreak.ts` | Pure rejection predicate | ✓ VERIFIED | `findLegacyPhysicPaintRejection` with 3 triggers and fixed precedence, returns null for clean projects; no fs/IPC/mutation |
| `app/src/efx-paint/efxPaintCleanBreakContract.test.ts` | DOC-04 grep contract | ✓ VERIFIED | 3/3 passing (11 tokens, carrier confinement, region-scoped launch-context check) |
| `app/src/stores/efxPaintStore.ts` | Non-reactive document registry + signal | ✓ VERIFIED | `registerDocument`/`getDocument`/`removeDocument`/`reset` + `efxPaintVersion` signal; projection seams `serializeRuntimeIntoDocument`/`hydrateRuntimeFromDocument` |
| `app/src/lib/efxPaintPersistence.ts` | Staging/commit save + fail-closed load | ✓ VERIFIED | `saveEfxPaintDocumentsWithProjectWrite` (stages PNGs, writes .mce, settle commit/rollback), `loadEfxPaintDocuments` (fail-closed, guarded paths), `isSafeEfxPaintCachePath` |
| `app/src/lib/efxPaintRejectionDialog.ts` | No-recourse blocking dialog | ✓ VERIFIED | `LEGACY_PHYSIC_PAINT_REJECTED_COPY` + `showLegacyPhysicPaintRejectionDialog` (message kind 'error', single OK) |
| `app/src/stores/projectStore.ts` | Open/save funnel cutover | ✓ VERIFIED | `version: 16` (line 290); gate at 824 before load (834)/closeProject/hydrate/autoSave; both save paths through `saveEfxPaintDocumentsWithProjectWrite`; `resetEfxPaintStore()` on close |
| `app/src/components/timeline/AddFxMenu.tsx` | Document registration on layer creation | ✓ VERIFIED | `handleAddPhysicPaintLayer` registers a created document (line 158) on both creation branches |
| `app/src-tauri/src/models/project.rs` | Rust serde carrier | ✓ VERIFIED | `efx_paint_documents: HashMap<String, Value>`, `physic_paint_outputs: Vec<Value>` opaque presence carrier; no legacy `McePhysicPaint*` structs |
| `app/src-tauri/src/services/physic_paint_cache.rs` | v1.0 cache service | ✓ VERIFIED | `CANONICAL_CACHE_BASENAME = "efx-paint"`, staging prefix `.efx-paint-staging-`, `validate_staging_basename` rejects traversal/absolute/NUL |
| `app/src-tauri/src/services/project_io.rs` | Create + round-trip IO | ✓ VERIFIED | Creates `cache/efx-paint`, leaves legacy `cache/physic-paint` dirs untouched |
| `app/src-tauri/capabilities/default.json` | fs scope for v1.0 cache | ✓ VERIFIED | `**/cache/efx-paint` + `**/cache/.efx-paint-staging-*` covered |
| `packages/efx-physic-paint/src/engine/EfxPaintEngine.ts` | v1.0 engine format | ✓ VERIFIED | `validateEfxPaintDocument`, v1.0 `save()`/`load(json)`, `LOAD_STATE_UNSUPPORTED_VERSION_COPY`, validates before mutating |

### Key Link Verification

| From | To | Via | Status | Details |
| ---- | --- | --- | ------ | ------- |
| `AddFxMenu.tsx` | `efxPaintStore.registerDocument` | `createEfxPaintDocument(layerId)` at line 158 | ✓ WIRED | Layer creation registers the v1.0 document |
| `projectStore.openProject` | `efxPaintCleanBreak` gate | `findLegacyPhysicPaintRejection(result.data)` at line 824, before load/hydrate/autoSave | ✓ WIRED | Rejection blocks open with zero mutation |
| `projectStore.openProject` | rejection dialog | `showLegacyPhysicPaintRejectionDialog(rejection)` at line 826 | ✓ WIRED | Blocking no-recourse dialog surfaced |
| `projectStore` save paths | `efxPaintPersistence` | both `saveProject`/`saveProjectAs` call `saveEfxPaintDocumentsWithProjectWrite` with bound cache transaction | ✓ WIRED | `.mce` + PNG sidecars in one transaction |
| `efxPaintPersistence` | native cache service | Tauri `publish_cache_generation`/`settle_cache_transaction`/`recover_cache_transaction` | ✓ WIRED | Digest bind before rename (project_io.rs), staging/settle/rollback |
| `efxPaintStore` | `efxPaintVersion` signal | registration bumps, render subscribes | ✓ WIRED | Reactive runtime↔document seam |
| `project_io.rs` | `capabilities/default.json` | `fs:scope` covers `cache/efx-paint` + `.efx-paint-staging-*` | ✓ WIRED | allow-mkdir for new staging dir granted |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| -------- | ------------- | ------ | ------------------ | ------ |
| On-disk `.mce` `efx_paint_documents` | document JSON | `extractRuntimeStateForDocument` from efxPaintStore + serialized track/cache state | Yes — written by save funnel, read back by loader | ✓ FLOWING |
| Cache PNG sidecars | frame cache bytes | staged via `publish_cache_generation`, commit swaps generation | Yes — real writes to `cache/efx-paint/` | ✓ FLOWING |
| Runtime document in Studio | `EfxPaintDocument` | `loadEfxPaintDocuments` → `installRuntimeStateFromDocument` (hydration) | Yes, real round-trip | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| DOC-04 contract + gate | `vitest run src/efx-paint/efxPaintCleanBreakContract.test.ts src/efx-paint/document/efxPaintCleanBreak.test.ts` | 12 tests passed | ✓ PASS |
| Document factory/parsers | `vitest run efxPaintDocument.test.ts efxPaintDocumentParsers.test.ts efxPaintStore.test.ts efxPaintPersistence.test.ts` | 33 tests passed | ✓ PASS |
| Save/load funnel | `vitest run projectStore.efxPaintCutover.test.ts projectStore.test.ts` | 23 passed + 9 todo | ✓ PASS |
| Rust publish/settle | `cargo test publish_stages_and_publishes_into_efx_paint_cache` | 1 passed | ✓ PASS |
| Rust round-trip + opaque carrier | `cargo test test_save_and_open_roundtrip` and `test_legacy_physic_paint_outputs_open_as_opaque_presence` | 1 passed each | ✓ PASS |

Full-suite evidence from the phase's own gates (recorded in the plan summaries, not re-run here): 2710 vitest, cargo suites, app typecheck, and `pnpm build` all green; native 4-part D-10 UAT passed (document creation, save/reopen + D-11 on-disk evidence, legacy rejection with byte-untouched original, main-editor parity).

### Probe Execution

No probe scripts (`scripts/*/tests/probe-*.sh`) are declared by the phase plans; the phase's runnable proof surfaces are the vitest/cargo suites exercised above. N/A.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| ----------- | ---------- | ----------- | ------ | -------- |
| DOC-01 | 45-01/45-05 | New v1.0 parent Paint layer owns exactly one versioned document with stable track IDs, revision, active track ID | ✓ SATISFIED | factory + `AddFxMenu` registration + revision builders (17 tests) |
| DOC-02 | 45-01 | Every new document starts with one default Paint track and one fixed Background track with configured fallback | ✓ SATISFIED | `createEfxPaintDocument` deep-frozen document structure |
| DOC-03 | 45-03/45-05 | Pre-v1.0 data fails explicitly as unsupported without partial mutation or fallback rendering | ✓ SATISFIED | gate predicate + dialog + funnel placement + UAT part 3 |
| DOC-04 | 45-07 | No legacy one-track schema reader, converter, renderer, cache path, or compatibility branch remains reachable | ✓ SATISFIED | contract test 3/3 + legacy files deleted + zero token matches |
| DOC-05 | 45-04/45-06 | Save/reopen preserves document, track, Loop Clip, source asset, cache identity | ✓ SATISFIED | Rust round-trip + TS round-trip + cache transaction + UAT part 2 |
| DOC-06 | 45-06/45-07 | Main-editor sequence timing and outer layer composition remain unchanged | ✓ SATISFIED | diff gate (zero protected-file matches) + full suite green + UAT part 4 |

No orphaned requirements: every ID mapped to Phase 45 in REQUIREMENTS.md (DOC-01..DOC-06) is claimed by at least one plan and satisfied here.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| `app/src/lib/efxPaintPersistence.ts` | ~229 | Save-path sidecar guard applied on load only (WR-01) | ⚠️ Warning | Guarded-path ASVS V12 contract asymmetric; not reachable today (internally generated paths) |
| `app/src/lib/efxPaintPersistence.ts` | 263 | Commit settlement errors swallowed while rollback errors thrown (WR-02) | ⚠️ Warning | A failing commit is silently ignored; next save may fail with active-transaction error |
| `app/src/stores/projectStore.ts` | 790-810 | `saveProjectAs` rolls back store pointers after a successful disk write (WR-03) | ⚠️ Warning | State/disk divergence if Recents/bind throws after commit |
| `app/src-tauri/src/commands/project.rs` 143 + `physic_paint_cache.rs` 512-525 | Stale pre-45 marker fails open before gate runs (WR-04) | ⚠️ Warning | A project with a crashed pre-45 mid-save marker may be unopenable rather than routed to the rejection dialog |
| `app/src/stores/projectStore.ts` 834 (callers Toolbar/WelcomeScreen/shortcuts) | EFX Paint sidecar load failures silent to user (WR-05) | ⚠️ Warning | Fail-closed open with no user feedback |
| `app/src/lib/autoSave.ts` | Auto-save unhandled promise rejections (WR-06) | ⚠️ Warning | Repeated silent save failures on persistent errors |
| `app/src/stores/projectStore.ts` | `saveProjectAs` lacks `isSaving` guard, races auto-save (WR-07) | ⚠️ Warning | Concurrent publishes may surface spurious failure |
| `app/src/lib/efxPaintPersistence.ts` 322-347 | Loader never verifies `parentLayerId` matches map key (WR-08) | ⚠️ Warning | Hand-crafted inconsistent files reach a state where every save aborts |

No `TBD`/`FIXME`/`XXX` debt markers found in phase-modified files. The 8 items above are the review-flagged robustness/security hardening items (0 critical) — they are warnings, not blockers: each concerns an error path or an internally-unreachable input today, and none violates a roadmap success criterion.

### Human Verification Required

None — the phase's native 4-part D-10 UAT (document creation, save/reopen + D-11 evidence, legacy rejection, main-editor parity) was already confirmed by the user as PASS (plan 45-08, status: pass, human_judgment: true). All behavior-dependent truths are additionally exercised by passing automated tests (gate placement, round-trip identity, contract scan).

### Gaps Summary

No blocking gaps. All 5 roadmap success criteria verified, all 6 requirements satisfied, every artifact present/substantive/wired with real data flow, all key links wired, and all automated gates green. The 8 code-review warnings (WR-01..WR-08) are documented for follow-up hardening but do not block goal achievement.

---

_Verified: 2026-08-23T20:10:00Z_
_Verifier: Claude (gsd-verifier)_
