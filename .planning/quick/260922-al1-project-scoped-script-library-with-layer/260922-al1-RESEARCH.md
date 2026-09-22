# Quick Task 260922-al1: project-scoped script library with layer-scope filtering - Research

**Researched:** 2026-09-22
**Domain:** Physic-paint Roto durable script library (Rust store + Preact child-realm Studio)
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### Cross-layer target gate
- Destination = the target layer's key at the CURRENT playhead frame, resolved fresh at apply time.
- An empty target frame falls through the EXISTING blank-key promotion path (no new resolution rules).
- The origin frame stays provenance/rail-source only; it must not constrain the destination.

#### Incompatibility definition
- Fail-closed set = the gates that already exist: generated-interpolation target, missing/unmounted target, busy/disposal state, generated-frame refusal (and the existing rail-structure validation).
- No new rail-kind compatibility rules and no new capacity/anchor rules in this task.
- New work here is: unblock cross-layer, and surface an explicit message where today the resolution fails silently (prepareTarget returning null currently produces no user-visible reason).

#### Unknown origin layer (orphan scripts)
- Provenance display falls back to the snapshotted layerName with a subtle "unavailable" marker; the row stays fully applicable under All.
- No filter entry exists for a dead layer (no live layer owns those scripts).
- A pre-provenance script (no origin layer id) behaves the same way: scope-unknown, All only.

#### Filter persistence
- Scope is ephemeral UI state: it holds while the Studio session lives (including layer switches) and returns to All on every project reopen.
- Provenance and the per-layer entries are rebuilt from disk on open, so UAT ④ ("reopen → provenance + filter intact") still passes with a reset to All.

### Claude's Discretion
- Exact filter control shape (native select vs custom listbox) and its precise placement inside the Scripts panel toolbar.
- Wording of the explicit refusal message (must stay in the existing apply-error surface / capsule style).
- Whether the "unavailable" provenance marker is a text suffix, muted styling, or both.

### Deferred Ideas (OUT OF SCOPE)
None recorded in CONTEXT.md.
</user_constraints>

## Summary

**Recon claim 3 is a misread, and it changes the shape of the work.** The durable store AND the whole read path are already project-scoped end to end: `scan_root` enumerates every `*.efx-roto-script.json` in `<project>/scripts` with no layer predicate (`[VERIFIED: app/src-tauri/src/services/script_library.rs:1939-2014]`), the main-realm bridge scans against the project authority (`app/src/lib/physicPaintBridge.ts:2433-2465`), and the panel renders `library.rows` unfiltered (`[VERIFIED: app/src/components/physic-paint/view/PhysicsPaintScriptsPanel.tsx:48]`). The apply path contains **no origin-layer gate**: the guard at the top of `prepareRotoScriptTargetRef` reads `source.layerId !== launch.layerId`, but `source` is the LIVE snapshot (built as `layerId: launchContext?.layerId`), so the term compares the launch against itself — a tautology, not a cross-layer block (`[VERIFIED: app/src/components/physic-paint/PhysicsPaintStudio.tsx:1639-1644]`).

What the codebase genuinely lacks today: (1) a scope filter; (2) live layer-name resolution for provenance — the panel shows the file's snapshotted `source.layerName` (`[VERIFIED: PhysicsPaintScriptsPanel.tsx:257]`); (3) an explicit user-visible reason when target resolution returns null — the clipboard sets `error` code `apply-empty-target-failed` (`[VERIFIED: app/src/components/physic-paint/roto/physicsPaintRotoScriptClipboard.ts:686-689]`), but the Studio's `setLastError` is a write-only `useState` whose value is never read (`[VERIFIED: PhysicsPaintStudio.tsx:789]`), so only the terse capsule text `Failed` reaches the artist.

**Primary recommendation:** Treat the "unblock cross-layer" item as verification-first (write tests 1–2, run them; they may already be green — do not manufacture a failing gate), and spend the implementation on: filter UI + scope entries from a live main-realm layer list, live provenance resolution with orphan fallback, and routing the existing `apply-empty-target-failed` error into the shared status capsule via `setApplyMessage` + `setApplyStatus('error')`.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Script enumeration / durable rows | Rust (`script_library.rs`) | — | Package-folder IO is Rust-only; renderer plugin-fs must not touch it |
| Scope entries (live layer id+name) | Main realm (sequenceStore) | Child realm (Studio) | Only the main realm has the project's layer list; the Studio's store singletons are realm-local |
| Filter state / filtered rows | Child realm (library controller + panel) | — | Presentation-only, ephemeral, session-lived |
| Target resolution + apply commit | Child realm (clipboard + Studio `prepareTarget`) | Rust (blank-key edit lands via physical edit coordinator) | Destination is the current launch layer's key at the playhead |
| Provenance metadata | Rust (validated, stored verbatim) | Child realm (display) | `source.layerId`/`layerName` already round-trip through the store |

## Recon Claim Verification

| # | Claim | Verdict | Evidence |
|---|-------|---------|----------|
| 1 | Durable store already project-scoped (`scan_root` reads all of `<project>/scripts/`) | **CONFIRMED** | `script_library.rs:1939-2014`; filter is only `ends_with(SCRIPT_EXTENSION)` (:1964); authority = the project path (`app/src/stores/projectStore.ts:112-116`) |
| 2 | Rows already carry `source.layerId` / `source.layerName`; panel renders them | **CONFIRMED** | `row_from_document` clones `object["source"]` verbatim (:2339); panel provenance line (:257) |
| 3 | Layer binding lives in `prepareRotoScriptTargetRef` returning null when `source.layerId !== launch.layerId` | **REFUTED as a gate** | `source` is the live snapshot (`getSource` builds `layerId: launch?.layerId`), so the term is a live-source consistency check — a tautology; no origin gate exists in the clipboard either |
| 4 | Controller resets rows per launch context via `contextIdentity = ${contextId}:${layerId}` | **CONFIRMED, but it does not layer-scope the list** | `contextIdentity` :299; `applyContextReset` clears rows/selection :335-348; the follow-up scan re-hydrates the whole project |
| 5 | Apply re-validates the target after preparation (`targetIsCurrent`) | **CONFIRMED** | `physicsPaintRotoScriptClipboard.ts:669-676` |

## Answer A — What actually scopes the experience today

- **Read path:** project-scoped at every layer of the stack (Rust scan, bridge request, controller `rows`, panel render). Nothing filters by layer.
- **Apply path:** already targets the CURRENT launch layer, resolved fresh: destination = the real-key record on `launch.layerId` + `studioActiveTrackId()` at `source.appFrame`, or the blank-key promotion path via `addEmptyKey` when the frame is empty (`[VERIFIED: PhysicsPaintStudio.tsx:1637-1683]`). `targetIsCurrent` re-reads the source after the await and rejects stale resolutions (`[VERIFIED: physicsPaintRotoScriptClipboard.ts:669-676]`).
- **Gate inventory, Library row → committed key** (in order):
  1. library availability / unsaved-project + busy gates (`physicsPaintRotoScriptLibrary.ts:291-297`, `:314`);
  2. clipboard replacement gate (`canApplyReplacement`, generated-interpolation excluded);
  3. `replaceClipboardFromPersisted` → `persistedRotoScriptToRuntime` (:144-156);
  4. one-slot preparation + identity validation (`prepareScriptLoadAndApply` / `isPreparedScriptLoadAndApplyValid`, clipboard :461-517);
  5. `applyScript` pre-conditions (disposed / no engine / no script / generated-interpolation) (:650-659);
  6. `ports.prepareTarget(source)` — no launch, `source.appFrame !== launch.startFrame`, generated-interpolation, real-key/blank resolution failures (:1639-1683);
  7. `targetIsCurrent` re-read + engine/launch generation guards (:677-692);
  8. operation guards + per-brush invalidation.
  **Every one of these is already layer-agnostic w.r.t. ORIGIN**; the only layer coupling is that the destination layer is the launch layer. If a cross-layer block exists anywhere in the product, it is outside this path (not found this session).

## Answers B/C — Provenance and schema

- **Provenance already exists: reuse `source.layerId`.** It is required in the durable format since v1: Rust `validate_source` bounds `projectName`, `layerId`, `layerName` as non-empty text (`[VERIFIED: script_library.rs:2130-2136]`); TS `PersistedRotoScriptSourceV1` declares `layerId: string; layerName: string` (`[VERIFIED: app/src/components/physic-paint/roto/physicsPaintRotoScriptSchema.ts:29-38]`); the runtime mapping writes `provenance.layerId = document.source.layerId` (`[VERIFIED: physicsPaintRotoScriptSchema.ts:147]`). That provenance is inert — no gate reads it.
- **No additive field is needed.** If one were added it is tolerated at both validation layers (Rust validates over a raw `serde_json::Value` checking only known keys; TS checks are structural, not exact), and `saveActiveFrame` writes the TS-typed object (`[VERIFIED: physicsPaintRotoScriptLibrary.ts:419-428]`). Adding it would still require widening the TS type + row type for the panel to see it — strictly more work than reusing `layerId`.
- **Pre-provenance files cannot exist as rows.** `schemaVersion` is 1 on both sides (`[VERIFIED: script_library.rs:13, TS :6]`) and `layerId` was required from the start; a file lacking it is scanned as `invalid-managed-script` and counted in `skippedInvalidCount` (`[VERIFIED: script_library.rs:1995-2002]`). The reachable "scope-unknown" case is an **orphan** `layerId` (no live layer owns it) — that is the case the CONTEXT's unknown-origin decision actually exercises (see Open Questions 3).
- **No invalidation risk:** `revision` = `document_revision(value)` (`:2334`, definition `:2425`) and `integrity_sha256` = sha256 of the exact bytes (`:2335`), both recomputed on every scan; `MAX_FILE_BYTES` is untouched by metadata-only changes.

## Answer D — Live layer list for filter entries and live names

- The enumeration exists in the main realm: `getActivePhysicPaintLayerIds` walks `sequenceStore.sequences` for `layer.type === 'physic-paint' && layer.source.type === 'physic-paint'` and collects `layer.source.layerId` (`[VERIFIED: app/src/stores/projectStore.ts:126-135]`); `layer.name` is available on the same objects — extend this to build `{ id, name }[]`.
- The child Studio realm has **no** layer list. Hooks: extend the project-context payload (published at `physicPaintBridge.ts:2751-2767`) **and** the child `accept()` whitelist, which currently strips everything but `{ name, saved, contextId }` (`[VERIFIED: app/src/components/physic-paint/bridge/usePhysicsPaintParentBridge.ts:116-120]`). Alternative: a new request/result bridge kind in the script-library idiom (heavier; only worth it if the layer list must be pulled on demand).
- **Cheapest live-rename signal:** `sequenceStore.sequences` is a signal; publish the list whenever the existing project-context publish fires, plus a subscribe on the sequences signal if rename does not currently trigger a publish. **Verify during implementation** (not traced this session) — tracked in Open Questions 2.
- Orphans: no entry; provenance falls back to `row.source.layerName` with the unavailable marker. Filter logic needs only live ids from the payload plus each row's `source.layerId`.

## Answer E — The "armed script filtered out" risk, in this codebase's terms

- `library.select(id)` accepts any id present in the UNFILTERED `rows`; filtering must stay presentation-only, so a filter change must **not** run through `publishResult` — its fallback re-points `selectedId` to `rows[0]` when the selected id is missing (`[VERIFIED: physicsPaintRotoScriptLibrary.ts:304-312]`).
- The toolbar apply takes `library.selectedId.peek()` (`[VERIFIED: PhysicsPaintStudio.tsx:1148]`), so a hidden-but-armed script IS applicable. Required revalidation = exactly what `applyScript` already does (`prepareTarget` + `targetIsCurrent` against the CURRENT target); the new work is the explicit failure surface (Answer F).
- Filter state must survive `applyContextReset` — `contextIdentity` includes `layerId` (`[VERIFIED: :299]`), so a layer switch fires the reset (`[VERIFIED: :335-348]`) which zeroes rows/selection. Keep the filter scope signal OUTSIDE that reset surface (own module/signal, not reset by the controller).

## Answer F — Explicit refusal surface

- **Current silent path:** `prepareTarget` → null → clipboard sets `error = operationError('apply', 'apply-empty-target-failed', 'Apply Script could not prepare the destination as an accepted physical Roto key.')` (`[VERIFIED: physicsPaintRotoScriptClipboard.ts:686-689]`); the Studio pushes `rotoScript.error.peek()?.message` into `setLastError`, which is `const [, setLastError] = useState<string | null>(null)` — the value is never rendered (`[VERIFIED: PhysicsPaintStudio.tsx:789, 1156-1159, 1171-1174]`). Only `rotoScript.status` (`'Failed'`) surfaces, via the capsule (`getRotoStatusCapsuleViewModel`).
- **Surface to use (Phase 46 capsule):** the established precedent at `:1882-1883` — `setLastError(message); if (message) setApplyMessage(message);` — plus `setApplyStatus('error')`. The capsule wiring is `statusMessage: … applyMessage, statusIsError: applyStatus === 'error'` (`[VERIFIED: PhysicsPaintStudio.tsx:4520]`) → `capsuleIsError={Boolean(props.statusIsError)}` (`[VERIFIED: app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.tsx:4183]`) → `PhysicsPaintWorkflowLiveStatus isError` (`[VERIFIED: :1214]`). The three script handlers (`handleScriptRowActivate` :1136-1146, `handleSelectedScriptLoadAndApply` :1147-1164, `handleApplyScript` :1168-1177) are the call sites to change.
- Recommendation: extract a pure `scriptApplyRefusalMessage(error, targetContext)` helper (testable without DOM) and call `setApplyMessage(message)` + `setApplyStatus('error')` in each failure branch; keep the clipboard's operation-error code unchanged.

## Answer G — Test seams for the five behavioural RED tests

Infrastructure: vitest, include `src/**/*.test.ts`, command `pnpm --filter efx-motion-editor exec vitest run` (config `workflow.test_command`; project rule: **never watch**). `nyquist_validation: true`.

| # | Required RED test | Test file / seam |
|---|-------------------|------------------|
| 1 | Layer-1 script visible in a layer-2 session | `physicsPaintRotoScriptLibrary.test.ts` — `harness()` (:13-24), `row()` with `layerId: 'layer-1'` (:10), `setLaunch(layer-2 context)` then assert `controller.rows` still contains the row |
| 2 | Apply on layer 2 commits to layer 2 | `physicsPaintRotoScriptClipboard.test.ts` — `harness()` (:31-72) with `setPrepareTarget` (:70); assert `submitted` groups + destination from the injected target |
| 3 | Incompatible target refuses explicitly, changes nothing | same clipboard harness with `setPrepareTarget(async () => null)`; assert `controller.error` code + `submitted` empty; the capsule message via the extracted helper's unit test |
| 4 | Filter narrows by origin layer; All restores | new pure module (e.g. `physicsPaintRotoScriptScope.ts`): `buildScopeEntries(rows, layers)` + `filterRows(rows, scope)` — unit-testable with the existing `row()` factory; avoids Preact DOM harness |
| 5 | Scope-unknown (orphan) script still loads | `physicsPaintRotoScriptLibrary.test.ts` — row with an orphan `layerId`, `activateAndLoad` succeeds and `replaceClipboard` spy received the runtime script |

Rust: no schema change ⇒ no Rust test change required; if any validation assertion is added, use `app/src-tauri/tests/script_library_schema.rs` (feature `script-library-test-support`, helpers in `src/script_library_test_support.rs`).

### Validation (Nyquist)

| Property | Value |
|----------|-------|
| Framework | vitest (v8 coverage) — `app/vitest.config.ts` |
| Quick run | `pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint/roto` |
| Full suite | `pnpm --filter efx-motion-editor exec vitest run` |
| Phase gate | Full suite green before UAT; then the 4 native UAT rows in CONTEXT |

Wave 0 gaps: `physicsPaintRotoScriptScope.ts` + its test; the refusal-message helper + its test. Existing harnesses cover everything else.

## Project Constraints (from CLAUDE.md)

- pnpm monorepo (`app/`); **vitest run only, never watch**.
- Preact + `@preact/signals` ONLY — no `useState` in new code; consult the `efx-preact-reactivity` skill (idempotent store setters, identity-stable effect deps, narrow signal reads, no render-body writes). Existing `useState` lapses in `PhysicsPaintStudio.tsx` are not to be copied.
- Do not run the dev server; leave live visual UAT to the user.
- Renderer plugin-fs must not touch package or cache paths — scripts-folder IO stays on its existing Rust path; package IO unchanged.
- GSD artifacts in English; small direct fixes preferred over speculative refactors.
- Tauri/cross-webview verdicts need live/disk evidence — vitest alone is blind to the child-realm branch.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | A layer switch reaches the Studio as a new/changed launch context (no in-Studio layer switcher exists) — based on grep negatives for a Studio layer switcher and the `setLaunchContext` layerId-branch idiom | Answer E | If a layer switch happens in-place, the filter-survives-switch requirement lands on `updateProjectContext` instead of `setLaunchContext` — same signal design, different wiring site |
| A2 | Layer rename will re-publish the project-context payload (or can be wired to via the sequences signal) | Answer D | Without it, filter entries and live names would go stale until the next publish; small extra wiring task |

## Open Questions — RESOLVED by the plan (kept as the research record)

The answers live in `260922-al1-PLAN.md`, not inline below: **Q1** → the evidence step in both code tasks (a green leg is recorded as a regression guard, never manufactured into a failure). **Q2** → the scope-ownership finding in the plan's `<objective>`: the child webview re-boots on every launch (`lib.rs:186`), so the scope is owned by the main realm and published/pulled over the existing project-context channel. **Q3** → the literal pre-provenance leg is recorded VACUOUS with its reason, and the reachable orphan case is the plan's L5. **Q4** → accepted as-is per the locked design and pinned by `buildScriptScopeEntries` cases in Task 2.

1. **Tests 1 and 2 may already be GREEN at HEAD** — no origin-layer gate was found anywhere on the read or apply path (git history shows the `source.layerId !== launch.layerId` term arrived with the 36.14 physical cutover as live-source consistency, and the pre-cutover clipboard had no origin gate). Run the two tests first; if green, record that evidence and keep them as regression guards rather than inventing a gate to fail them.
2. **How exactly does a layer switch reach the child window?** (fresh launch vs `setLaunchContext` reuse) — determines where the "filter holds during the session, including layer switches" state must live. The filter signal must NOT be inside `applyContextReset`'s cleared surface either way.
3. **Pre-provenance scripts are unreachable as valid rows** (schema v1 always required `layerId`). Test 5 should target the reachable case (orphan `layerId`), or the planner must explicitly note the literal case as vacuous — flag to the user in discuss if the distinction matters.
4. **Duplicate live layer names**: CONTEXT specifies live names with no disambiguation; two layers named "Ink" produce two identical filter labels. Recommendation: accept as-is (per locked design), optionally append nothing.

## Sources

### Primary (HIGH confidence) — in-repo source reads this session
- `app/src-tauri/src/services/script_library.rs:1-20, 1939-2014, 2095-2163, 2328-2343, 2425`
- `app/src/components/physic-paint/PhysicsPaintStudio.tsx:1130-1181, 1630-1683, 784-795, 4515-4525`
- `app/src/components/physic-paint/roto/physicsPaintRotoScriptClipboard.ts:640-736`
- `app/src/components/physic-paint/roto/physicsPaintRotoScriptLibrary.ts:290-478`
- `app/src/components/physic-paint/roto/physicsPaintRotoScriptSchema.ts:1-19, 29-38, 122-156`
- `app/src/components/physic-paint/view/PhysicsPaintScriptsPanel.tsx:40-69, 240-268`
- `app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.tsx:229, 1214, 4183`
- `app/src/components/physic-paint/bridge/usePhysicsPaintParentBridge.ts:112-131`
- `app/src/stores/projectStore.ts:112-135`
- Tests: `physicsPaintRotoScriptLibrary.test.ts:1-80`, `physicsPaintRotoScriptClipboard.test.ts:1-80`
- `.planning/config.json` (nyquist on; test_command)

### Secondary (MEDIUM confidence)
- `.planning/quick/260922-al1-.../260922-al1-CONTEXT.md` recon notes (verified/corrected above)

## Metadata

**Confidence breakdown:**
- Standard stack / architecture: HIGH — all claims read from source this session
- Gate inventory: HIGH — full path read on both TS sides
- Pitfalls/refusal surface: HIGH — wiring traced end to end (error → setLastError (discarded) → capsule)
- Layer-switch flow: MEDIUM — grep evidence only, tracked as Open Question 2

**Research date:** 2026-09-22
**Valid until:** stable — in-repo research, no external dependency drift
