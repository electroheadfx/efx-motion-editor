---
status: resolved
trigger: "Deleting a Physics Paint layer leaves its layer-owned runtime and persisted cache behind."
created: 2026-07-18T10:28:42Z
updated: 2026-07-18T13:29:00Z
---

## Current Focus
<!-- OVERWRITE on each update - reflects NOW -->

hypothesis: "Resolved: native visible UAT was approved before regression coverage, all required post-UAT automated gates passed, and the pre-authorized completion condition has been satisfied."
test: "Record the accepted human-verification response, archive the debug session, and update the debug knowledge base without creating a commit."
expecting: "The resolved session and knowledge-base entry accurately preserve the confirmed root cause, fix, and successful verification evidence."
next_action: "Move this resolved session to .planning/debug/resolved and return DEBUG COMPLETE without committing."
reasoning_checkpoint:
  hypothesis: "Authoritative deletion leaves stale Physics Paint state because its transactions mutate only timeline sequences while canonical runtime remains owned under layer.source.layerId; zero-output saves leave disk cache because cleanup occurs after an early return."
  confirming_evidence:
    - "All authoritative layer/sequence deletion closures snapshot only sequence state and never call Physics Paint snapshot/clear/restore."
    - "physicPaintStore runtime and rendering use layer.source.layerId, while clearLayer is incomplete and savePhysicPaintData returns before root removal for empty outputs."
  falsification_test: "Production inspection would disprove this if deletion already transactionally snapshots/clears/restores canonical Physics Paint state, or if zero-output save already removes the project-local root."
  fix_rationale: "Add canonical snapshot/clear/restore at the authoritative deletion transactions, complete clearLayer for modern layer-owned state, restrict serialization to canonical identities, and move root replacement ahead of the empty-output return."
  blind_spots: "Native visible preview/playback/reopen behavior and delayed standalone timing cannot be fully observed without user UAT; automated verification is intentionally limited to type/build checks."
tdd_checkpoint:
  test_file: "app/src/stores/sequenceStore.test.ts"
  test_name: "clears the canonical Physics Paint state and restores it through Undo/Redo"
  status: "green"
  failure_output: "The deterministic RED evidence is retained below. Post-UAT regression coverage is now implemented and all focused/full test, typecheck, and build gates pass."

## Symptoms
<!-- Written during gathering, then IMMUTABLE -->

expected: "Deleting a Physics Paint layer immediately removes only that layer's preview, playback, export, serialization, runtime frames, real-key/generated/background/interpolation metadata, alpha/live state, and delayed publications. Undo restores the complete layer-owned state and Redo clears it again. A successful project save removes obsolete project-local cache directories/files, including when the final Physics Paint layer is deleted, without affecting other layers, ordinary Paint state, durable Roto scripts, reusable script clipboard, paper, or image assets."
actual: "The timeline/layer entry is removed, but layer-owned Physics Paint runtime and/or persisted cache can remain, including Roto real-key cache metadata, generated interpolation metadata, background/interpolation settings, alpha/live registrations, serialized outputs, or cache/physic-paint files. The stale output may continue contributing or be resurrected."
errors: "No explicit error message reported; this is stale state and persistence behavior."
reproduction: "Create two visibly different Physics Paint layers, open one in EFX Paint, create real Roto keys and cached output, save, delete one layer, inspect runtime/preview/export/serialization, Undo, Redo, save/reopen and cache directories; repeat for the final layer and while the deleted layer's standalone window remains open."
started: "Reported on 2026-07-18; whether it ever worked is not established."

## Constraints

- Preserve complete layer Undo/Redo semantics.
- Resolve the authoritative Physics Paint cache identity before mutation; do not blindly clear both layer.id and source.layerId.
- Reject delayed standalone publications for a deleted layer without interfering with another open Physics Paint layer.
- Defer irreversible filesystem cleanup to the established successful project-save cache rewrite boundary.
- Keep cleanup scoped to the validated project-local cache/physic-paint root.
- Production fix before tests; stop for native visible UAT after type/build validation.
- Do not add or modify regression tests before explicit native UAT approval.
- Do not run the development server.

## Eliminated
<!-- APPEND only - prevents re-investigating -->

- hypothesis: "Delayed standalone publications are accepted because the bridge does not verify that the target layer still exists."
  evidence: "applyPhysicPaintPayload resolves the current layer list and rejects new payloads with Unknown physics paint layer before any store mutation."
  timestamp: 2026-07-18T11:30:00Z

- hypothesis: "The project serializer always writes deleted-layer runtime outputs into the .mce file."
  evidence: "buildMceProject filters outputs by active Physics Paint identities, so a deleted layer is normally omitted; only the dual-ID identity set remains unsafe when layer.id differs from source.layerId."
  timestamp: 2026-07-18T11:31:00Z

## Evidence
<!-- APPEND only - facts discovered -->

- timestamp: 2026-07-18T11:08:00Z
  checked: "Debug knowledge base against stale state/cache symptoms"
  found: "The only entry concerns timeline label hit testing; there is no two-keyword overlap with Physics Paint deletion/cache symptoms."
  implication: "No known-pattern shortcut applies; investigate current code paths directly."

- timestamp: 2026-07-18T11:09:00Z
  checked: "Project skill indexes and common bug-pattern map"
  found: "Relevant rules require a red-capable behavioral seam, one hypothesis at a time, and tests through a public interface. Symptoms map primarily to State Management (dual source of truth / invalid transition) and Async/Timing (delayed publication after deletion)."
  implication: "Prioritize lifecycle ownership and stale-publication hypotheses, while finding the narrowest real deletion/save seam suitable for TDD."

- timestamp: 2026-07-18T11:22:00Z
  checked: "Authoritative sequence and layer deletion implementations in sequenceStore.ts and layerStore.ts"
  found: "sequenceStore.remove, removeLayer, and removeLayerFromSequence snapshot and restore only sequences/activeSequenceId. None resolves a Physics Paint source identity or calls physicPaintStore.clearLayer; Undo/Redo closures therefore know nothing about layer-owned Physics Paint state."
  implication: "Runtime frames, real/generated Roto metadata, background/interpolation settings, failure status, and alpha registrations survive timeline deletion; a later Undo merely makes the still-live state visible again rather than restoring a transactional snapshot."

- timestamp: 2026-07-18T11:24:00Z
  checked: "Physics Paint store ownership and serialization"
  found: "physicPaintStore owns six layer-related maps plus a dataUrl-to-canvas alpha registry. clearLayer exists but is unused by production deletion and omits interpolation failure status and alpha registry cleanup. Rendering and launch paths consistently use layer.source.layerId as canonical identity."
  implication: "Deletion must snapshot/clear/restore one resolved canonical source.layerId and make clearLayer complete without affecting other layers."

- timestamp: 2026-07-18T11:26:00Z
  checked: "Project serialization filtering in projectStore.buildMceProject"
  found: "The .mce builder filters runtime outputs to active Physics Paint layers, but getActivePhysicPaintLayerIds adds both layer.id and layer.source.layerId."
  implication: "Normal deletion omits outputs from the .mce, but the identity filter can preserve a noncanonical stale output when IDs differ; it should use only the resolved canonical identity."

- timestamp: 2026-07-18T11:28:00Z
  checked: "Filesystem rewrite boundary in savePhysicPaintData"
  found: "savePhysicPaintData returns [] at line 54 when outputs are empty, before removing the existing cache/physic-paint root at lines 59-63. Non-empty saves do remove and rebuild the whole root."
  implication: "Deleting the final Physics Paint layer leaves all persisted cache files behind even after a successful project save."

- timestamp: 2026-07-18T11:30:00Z
  checked: "Delayed standalone publication guard in applyPhysicPaintPayload"
  found: "Every new payload resolves a current Physics Paint target layer before mutation and returns Unknown physics paint layer after deletion."
  implication: "A missing target-layer guard is eliminated for new delayed publications; the main defects are deletion lifecycle ownership and empty-root persistence cleanup."

- timestamp: 2026-07-18T12:37:00Z
  checked: "Red-capable regression command: node app/node_modules/vitest/vitest.mjs run --root app src/stores/sequenceStore.test.ts"
  found: "The new public-seam test fails deterministically after removeLayerFromSequence: physicPaintStore.toMceOutputs() still contains the full canonical-physics-cache output (frame, real-key metadata, interpolation settings, and background) instead of []."
  implication: "The missing deletion lifecycle is directly reproduced, including proof that source.layerId is the owned identity when it differs from layer.id."

- timestamp: 2026-07-18T12:40:00Z
  checked: "Continuation checkpoint direction for the premature RED regression test"
  found: "The newly added Physics Paint deletion lifecycle test and only its newly added imports must be removed before production edits; its diagnostic failure remains valid evidence, but regression tests require native visible UAT approval first."
  implication: "Preserve all pre-existing test content, make no test changes beyond exact removal, and verify production only with appropriate type/build checks before a human UAT checkpoint."

- timestamp: 2026-07-18T12:48:00Z
  checked: "Complete production implementations after removing the premature test"
  found: "All three authoritative deletion paths are in sequenceStore (remove sequence, remove active layer, remove layer across sequences). physicPaintStore has no snapshot/restore API; clearLayer omits interpolation failure state and layer-referenced alpha canvases, while reset also omits background metadata. The alpha registry is keyed by frame data URL, so cleanup must preserve entries still referenced by another layer."
  implication: "The minimal safe fix is a focused per-layer snapshot that includes every modern map and referenced alpha canvas, orphan-only canonical clearing in deletion closures, and symmetric Undo restore/Redo clear without changing layerStore routing."

- timestamp: 2026-07-18T13:02:00Z
  checked: "App TypeScript check via node app/node_modules/typescript/bin/tsc --noEmit -p app/tsconfig.json"
  found: "The implementation has one compile error: TypeScript does not preserve the layer.source discriminant through the filter/map chain in getCanonicalPhysicPaintLayerIds."
  implication: "Use an explicit loop for canonical ID collection; no runtime hypothesis changed and no test execution is needed."

- timestamp: 2026-07-18T13:05:00Z
  checked: "App TypeScript check rerun after explicit discriminant narrowing"
  found: "tsc --noEmit completed successfully with no diagnostics."
  implication: "The production lifecycle changes are type-safe; proceed to the production bundle check only."

- timestamp: 2026-07-18T13:07:00Z
  checked: "Vite build invoked from repository root with app as positional root"
  found: "Build stopped before transforming modules because the Motion Canvas plugin resolved ./src/project.ts?project against the repository cwd instead of app; this is an invocation-context failure, not a production compile failure."
  implication: "Set process.cwd to app before loading Vite CLI and rerun the same build without starting a server."

- timestamp: 2026-07-18T13:10:00Z
  checked: "Vite production build with process.cwd set to app"
  found: "Build completed successfully: 1086 modules transformed and production chunks emitted in 1.18 seconds."
  implication: "The production bundle is valid. Before final verification, ensure Undo cannot overwrite another layer's existing shared data-URL alpha registration."

- timestamp: 2026-07-18T13:14:00Z
  checked: "Final app typecheck and Vite production build after shared-alpha preservation"
  found: "TypeScript completed with no diagnostics; Vite transformed 1086 modules and emitted the production bundle successfully in 1.15 seconds. No server or test command was run."
  implication: "Automated production checks are green; only native visible UAT remains before the fix can be accepted or regression tests added."

- timestamp: 2026-07-18T13:16:00Z
  checked: "Final working tree and sequenceStore.test.ts diff"
  found: "sequenceStore.test.ts exactly matches its baseline. The only production changes are sequenceStore.ts, physicPaintStore.ts, projectStore.ts, and physicPaintPersistence.ts; the debug session file is the only additional artifact."
  implication: "The premature regression test and its imports were removed exactly, all pre-existing tests were preserved, and the session is ready for native visible UAT."

- timestamp: 2026-07-18T13:17:00Z
  checked: "Post-UAT continuation authorization"
  found: "The parent session explicitly approved writing the project/debug files for regression coverage and final verification, while prohibiting commits and development-server execution."
  implication: "Restore focused regression coverage now, run Vitest only in non-watch mode, and finish with type/build gates without committing."

- timestamp: 2026-07-18T13:18:00Z
  checked: "Complete modified sources and neighboring regression suites"
  found: "sequenceStore.test.ts has no Physics Paint lifecycle coverage; physicPaintPersistence.test.ts lacks the zero-output stale-root case; projectStore.test.ts filters a deleted canonical cache but does not seed stale output under the active layer's noncanonical layer.id. physicPaintStore.test.ts already exercises public output/state APIs suitable for lifecycle assertions."
  implication: "Add narrowly scoped public-interface regressions at the three root-cause boundaries, reusing existing test infrastructure and avoiding production changes."

- timestamp: 2026-07-18T13:19:00Z
  checked: "Initial sequenceStore targeted Vitest invocation"
  found: "pnpm --dir app vitest run ... failed before Vitest with EACCES because pnpm interpreted the directory path as the executable."
  implication: "This is a command-shape failure, not a test failure; rerun through pnpm exec without changing code."

- timestamp: 2026-07-18T13:20:00Z
  checked: "sequenceStore Physics Paint deletion lifecycle regression"
  found: "Vitest passed sequenceStore.test.ts: 9 tests passed and 12 existing todos remained skipped. The new canonical deletion, survivor preservation, Undo restore, and Redo clear assertions all passed."
  implication: "The main transactional deletion seam is protected; proceed to the independent zero-output persistence boundary."

- timestamp: 2026-07-18T13:21:00Z
  checked: "Zero-output Physics Paint persistence regression"
  found: "Vitest passed physicPaintPersistence.test.ts: 8 of 8 tests. The new case seeded cache files through a real save, then verified savePhysicPaintData('/project', []) removes the cache root and all nested files while returning []."
  implication: "The final-layer successful-save cleanup boundary is protected; proceed to canonical serialization identity coverage."

- timestamp: 2026-07-18T13:22:00Z
  checked: "Canonical project serialization regression"
  found: "Vitest passed projectStore.test.ts: 8 tests passed and 9 existing todos remained skipped. The strengthened case seeded active-cache, stale active-layer, and deleted-cache runtime outputs and serialized only active-cache. Existing audio hydration tests emitted their known non-fatal window-is-not-defined stderr but passed."
  implication: "Canonical source.layerId filtering is protected; add direct coverage for complete snapshot/clear/restore and shared alpha ownership."

- timestamp: 2026-07-18T13:23:00Z
  checked: "Complete Physics Paint layer snapshot and shared-alpha regression"
  found: "Vitest passed physicPaintStore.test.ts: 48 of 48 tests. The new case verified output/cache/settings/background restoration, target-only alpha removal/restoration, and preservation of a survivor layer's newer shared data-URL canvas registration."
  implication: "The store lifecycle itself is protected; finish coverage across the two remaining authoritative sequence deletion APIs and shared canonical ownership."

- timestamp: 2026-07-18T13:24:00Z
  checked: "All authoritative deletion paths and shared canonical identity regressions"
  found: "Vitest passed sequenceStore.test.ts after expansion: 12 tests passed and 12 existing todos remained skipped. remove, removeLayer, and removeLayerFromSequence now have canonical cleanup/Undo/Redo coverage, and shared state remains until the final timeline owner is removed."
  implication: "Deletion routing is fully covered; add the last omitted store-state assertions for interpolation failure and reset-only background metadata."

- timestamp: 2026-07-18T13:25:00Z
  checked: "Interpolation failure and reset metadata regressions"
  found: "Vitest passed physicPaintStore.test.ts after final expansion: 49 of 49 tests. The new assertions prove failure status is cleared/restored with the layer snapshot and reset removes surviving background metadata."
  implication: "Approved regression coverage now spans every state added to the production lifecycle; proceed to combined and repository-level final gates."

- timestamp: 2026-07-18T13:26:00Z
  checked: "Combined focused Physics Paint regression suite"
  found: "All four modified test files passed together: 4 files, 77 tests passed, 21 existing todos skipped. projectStore audio hydration emitted only the same known non-fatal window-is-not-defined stderr."
  implication: "The new regressions are mutually stable; run the full suite, typecheck, and production build as final gates."

- timestamp: 2026-07-18T13:27:00Z
  checked: "Repository-level final gates"
  found: "Full non-watch Vitest passed 85 files with 794 tests passed, 2 skipped, 101 todos, and 3 skipped files; pnpm typecheck completed with no diagnostics; Vite production build transformed 1086 modules and completed in 1.19 seconds. Test stderr consisted of existing Tauri/window and sourcemap warnings."
  implication: "Automated verification is complete; perform a final working-tree integrity audit before returning the checkpoint."

- timestamp: 2026-07-18T13:28:00Z
  checked: "Final working-tree integrity"
  found: "git diff --check passed with no output. Git status contains exactly four production files, their four regression-test files, and the debug session; the Vite build added no tracked artifact. No development server or commit was run."
  implication: "The continuation is complete and safe to return to the parent session for final acknowledgement without archiving or committing."

- timestamp: 2026-07-18T13:29:00Z
  checked: "Pre-authorized post-UAT completion condition"
  found: "The human-verification response confirms native visible UAT was already approved before regression coverage and directs resolution because the focused regressions, full relevant Vitest suite, app TypeScript, production build, and diff check all passed. No additional live UAT is requested."
  implication: "Human verification is satisfied; archive the session as resolved and record the known pattern without creating a commit."

## Resolution
<!-- OVERWRITE as understanding evolves -->

root_cause: "Deletion is split across unsynchronized sources of truth. sequenceStore removes/restores only timeline sequences, while all Physics Paint runtime/cache state remains in physicPaintStore under the canonical layer.source.layerId. No deletion path snapshots or clears that state. Separately, savePhysicPaintData exits early for zero outputs before replacing the project-local cache/physic-paint root, so deleting the final layer cannot remove persisted files. The active-output filter also admits both layer.id and source.layerId instead of only the canonical identity."
fix: "Added complete per-layer Physics Paint snapshot/restore/clear lifecycle (including generated/real Roto metadata, background, interpolation settings/failure, frames, and layer-referenced alpha canvases); wired orphan-only canonical cleanup into sequence and layer deletion Undo/Redo transactions; restricted serialization filtering to source.layerId; and made zero-output saves remove the project-local cache/physic-paint root. Removed the premature regression test exactly as directed."
verification: "Human verification accepted the pre-authorized completion condition: native visible UAT approved the production behavior before regression work, and no additional live UAT is required. Focused suite passes 4 files / 77 tests with 21 existing todos; full non-watch Vitest passes 85 files / 794 tests with 2 skipped, 101 todos, and 3 skipped files; pnpm typecheck passes; Vite production build succeeds with 1086 modules in 1.19s; git diff --check passes. Existing Tauri/window and sourcemap warnings remain non-fatal. No server or commit was run."
files_changed: ["app/src/stores/sequenceStore.ts", "app/src/stores/sequenceStore.test.ts", "app/src/stores/physicPaintStore.ts", "app/src/stores/physicPaintStore.test.ts", "app/src/stores/projectStore.ts", "app/src/stores/projectStore.test.ts", "app/src/lib/physicPaintPersistence.ts", "app/src/lib/physicPaintPersistence.test.ts"]
