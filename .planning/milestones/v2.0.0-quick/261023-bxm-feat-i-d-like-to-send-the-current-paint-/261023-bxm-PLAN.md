---
phase: quick-261023-bxm
plan: 261023-bxm
type: execute
wave: 1
depends_on: []
files_modified:
  - app/src/components/physic-paint/roto/physicsPaintRotoDuplicateSourcePaint.ts
  - app/src/components/physic-paint/roto/physicsPaintRotoDuplicateSourcePaint.test.ts
  - app/src/components/physic-paint/hooks/useRotoKeyUtilities.ts
  - app/src/components/physic-paint/hooks/useRotoKeyUtilities.test.ts
  - app/src/components/physic-paint/PhysicsPaintStudio.tsx
autonomous: true
requirements: []

estimate:
  tokens: 22000
  raw_tokens: 22000
  tasks: 2
  confidence: low

must_haves:
  truths:
    - "Duplicate settles the source first: when the source key's payload carries no inline raster but the frame displays paint (the dirty-frame preview, else the accepted physical render source), those exact bytes are published onto the source key through the live-pixel settlement seam, and only then is the key duplicated."
    - "The duplicated key at source.appFrame + 1 renders on canvas exactly like the source at the moment of duplication — same pixels, its own record identity, selected after the edit."
    - "A source record that already carries inline bytes is never rewritten: the existing duplicate path, its +1 ripple, and its rail membership are unchanged."
    - "When neither carrier resolves (no inline bytes and no displayed paint), Duplicate publishes an explicit error and stages no key — it never creates an empty duplicate."
    - "The duplicate is an independent per-key raster copy: painting, moving, or deleting the duplicate never mutates the source key."
    - "The Move tool, the duplicate-key resolver branch, the semantic-delta validator, the parent bridge, and the package format are byte-untouched."
  artifacts:
    - app/src/components/physic-paint/roto/physicsPaintRotoDuplicateSourcePaint.ts
    - app/src/components/physic-paint/roto/physicsPaintRotoDuplicateSourcePaint.test.ts
    - app/src/components/physic-paint/hooks/useRotoKeyUtilities.ts
    - app/src/components/physic-paint/hooks/useRotoKeyUtilities.test.ts
    - app/src/components/physic-paint/PhysicsPaintStudio.tsx
  key_links:
    - "PhysicsPaintStudio keyUtilities input → useRotoKeyUtilities.duplicateKey → resolveRotoDuplicateSourcePaint → bakeRotoKeyPaint → physicalKeyUtilities.duplicateKey(sourceKeyId)."
    - "rotoPersistence.reference.findCachedRotoDisplayFrame is THE display authority: for a dirty real-key frame it returns the preview frame (the composite currently on canvas), else the accepted physical render source — so the cooked bytes equal what the user sees."
    - "bakeRotoKeyPaint reuses rotoPersistence.upsertCachedFrame with an explicit expectedKeyId — the same seam the aquarelle Apply publish uses; it is a pixel settlement, not a history command."
---

<objective>
Make the bottom-timeline Duplicate action carry the source frame's paint, including paint that came from a script.

Concrete defect: `useRotoKeyUtilities.duplicateKey` asks the physical coordinator to duplicate the source key, and the coordinator stages the new key from the source record's payload. When the source frame's pixels live only in the display surface (a script's live result, an unfinished settle, a dirty preview) the record payload has no inline raster, so the new key is staged carrier-less and renders blank — the "duplicates into an empty key" report. The paint is not cooked into the key.

Fix shape (chosen, not open for reinterpretation): before duplicating, resolve the source key's DISPLAYED paint. If the record already carries usable inline bytes, do nothing extra (today's behavior stays). Otherwise publish the displayed bytes onto the source key through the existing live-pixel settlement seam (`upsertCachedFrame` with the source keyId), verify the record now carries bytes, then run the unchanged duplicate. If no raster resolves, fail closed with an explicit message and create no key. This is the same cached-first, fail-closed law `resolvePreviousRealKeyBase` already applies to + Key.

Semantics locked for this plan:

1. TARGET FRAME — "next frame if free". In the physical model the next frame is always free: Duplicate splices at `source.appFrame + 1`, and every key at or after that frame ripples +1 (`buildDuplicateCandidate`, unchanged). It never overwrites or deletes paint; at the last capacity frame the resolver rejects (`over-capacity`). No spare-slot scan, no silent skip.
2. KEY PLACEMENT — the new record is a `real-key` at `source.appFrame + 1` with no manufactured interpolation break, so it belongs to the source's own rail/segment (`finalizeProposal`, unchanged).
3. SCRIPT SEMANTICS — per-key raster copy, not a shared script reference. The duplicate receives the script's cooked pixels, which is the only way to guarantee "renders exactly like the source" independently: `PhysicPaintRotoRealKeyRecord` has no per-key script field (the only script carriers are Loop Clips with `scriptId`), a shared script handle would make editing one key mutate the other, and adding per-key script ownership would need a new persisted schema field plus a package change. The Living Script is intentionally not copied.
4. SCOPE — bottom-timeline Duplicate only (`aria-label="Duplicate key"` → `onDuplicateRotoKey` → `useRotoKeyUtilities.duplicateKey`). The Move tool, its script-target plumbing, and the resolver/validator/bridge stay untouched.

Purpose: the user can build motion by duplicating the current paint onto the next frame and then moving keys one by one, and the clone always starts from what they see.
Output: a pure resolution module with tests, the duplicate handler's settle-then-clone sequence, the Studio display/settle ports, and a gate report.

Scope: one atomic quick task. No new dependencies, no schema/package changes, no resolver or validator edits, no Move-tool changes.
</objective>

<execution_context>
@/Users/lmarques/Dev/efx-motion-editor/.claude/gsd-core/workflows/execute-plan.md
@/Users/lmarques/Dev/efx-motion-editor/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/STATE.md
@CLAUDE.md
@.claude/skills/efx-preact-reactivity/SKILL.md

WIRING CONTRACT (locked — already traced, do not re-derive):

1. Duplicate today — `app/src/components/physic-paint/hooks/useRotoKeyUtilities.ts`
   - `duplicateKey` (:158-174): `blocked = keyActionInFlight || input.flushInFlight || input.applyStatus === 'applying'`, `requireCurrentRealKey()`, then `input.physicalKeyUtilities.duplicateKey(sourceKeyId)`; failures publish `Could not duplicate the Roto key.` with the detail on `setLastError`.
   - Input already carries `getRotoKeyRecords()` (live store read) and `cachedRotoFrames`; `realKeyFrames` is record-derived and is NOT a display authority.
   - `addKey` (:313-346) is the precedent: `resolvePreviousRealKeyBase` is cached-first and `unavailable` fails closed. Mirror that posture.

2. Physical duplicate — resolver + coordinator (read-only for this plan)
   - `physicsPaintRotoPhysicalResolver.ts:1324-1368 buildDuplicateCandidate`: destination = `source.appFrame + 1`; every record at/after it ripples +1; the fresh record payload = `clonePayloadAtFrame(source.payload, destination)`; delta = `{ kind, sourceKeyId, newKeyId }`.
   - `validatePhysicPaintRotoPhysicalEditSemanticDelta` (:633-668) hard-requires the duplicate payload to equal `source.payload` retargeted, and `hasExactKeys(delta, ['kind','sourceKeyId','newKeyId'])` forbids extra delta fields. Any "pass a different payload through the intent" design would also touch `useRotoPhysicalEditCoordinator.ts:2455 buildStagedRecords`, the coordinator validator call (:2119), and `app/src/lib/physicPaintBridge.ts:1873`. That is why this plan settles the source first instead of threading a payload.
   - `useRotoPhysicalEditCoordinator.ts:1774-1838` flushes finalizations + `flushLivePixels(flushAppFrame)` BEFORE reading `currentRecords`, and `buildStagedRecords` reads that post-flush source record. So once the cook has landed, the staged clone carries the cooked bytes with no resolver change.

3. The display authority — `app/src/components/physic-paint/hooks/useRotoReferenceController.ts`
   - `findCachedRotoDisplayFrame(appFrame, input)` (:115-125) returns the accepted physical render source, but for a dirty real-key frame whose preview matches `keyId` + `contentRevision` it returns `previewFrames.get(appFrame)` — the composite currently on canvas.
   - The Studio already destructures `findCachedRotoDisplayFrame` from `rotoPersistence.reference` (`PhysicsPaintStudio.tsx:1263`) and passes preview frames via `getPreviewFrames` (`useRotoFramePersistenceCoordinator.ts:453`). Preview frames are the merged captured composite (`rotoEditBufferTransactions.ts:86-105`), not a transparent overlay.
   - Media-only records project a `renderedFrame` with no `bytes` (`physicPaintStore.ts:4589-4593` spreads `record.payload`), so the Studio wrapper must accept only a non-empty `Uint8Array`.

4. The settle seam — `app/src/components/physic-paint/hooks/useRotoFramePersistenceCoordinator.ts:461-526`
   - `upsertCachedFrame(renderedFrame, backgroundOnly=false, …, expectedLayerId, mutationId, expectedOperationId, background, expectedKeyId)` routes through `routeRotoPhysicalPaintFrame` → `updateRotoPhysicalRealKeyPayload`, updates `confirmedFramesRef`, calls `editBuffer.acceptPixelCache(appFrame)` (clears the dirty preview), and queues the parent payload. Returns `false` on a stale revision / rejected settlement; it is not a history command.
   - The aquarelle Apply port is the exact call shape to reuse (`PhysicsPaintStudio.tsx:1302-1313`): launch layerId + operationId, `buildRotoBackgroundMetadata(settings)`, trailing `frame.keyId`.
   - The keyUtilities input object is built at `PhysicsPaintStudio.tsx:2462-2491`; `launchContext`, `settings`, and `rotoPersistence` are in scope there.

GUARDRAILS (locked):
- Preact 11 + @preact/signals — never React patterns. No `useState`, no new `useEffect`, no signal writes in a render body; Studio handler reads are `.peek()` / live getters only.
- Tests are `.test.ts` only (vitest never collects `.test.tsx`).
- pnpm only. `vitest run` only — never watch.
- No new dependencies (2 MB bundle ceiling).
- Do not run the app or the dev server — the user performs live UAT.
- PATH FORM: every path in this body is repo-root-relative; every `<automated>` command assumes cwd at the checkout root.
- Line numbers were read at the 2026-10-23 revision; re-anchor with the quoted symbols if they drift.

SCOPE OUT:
- Changing the duplicate destination rule (always `source.appFrame + 1` with a +1 ripple), rail derivation, or the loop-source rejection.
- Any change to `physicsPaintRotoPhysicalResolver.ts`, `physicsPaintRotoPhysicalModel.ts`, `useRotoPhysicalEditCoordinator.ts`, `physicPaintBridge.ts`, the document schema, or the package format.
- Copying the Living Script, a persisted Roto Script, or a Loop Clip reference onto the new key.
- The Move tool and the script-target preparation seam.
- Fixing the adjacent hardcoded `flushInFlight: false` in the Studio keyUtilities input.
</context>

<tasks>

<task type="tracer" tdd="true">
  <name>Task 1: End-to-end "Duplicate settles the source paint, then clones it" — one path only</name>
  <files>app/src/components/physic-paint/roto/physicsPaintRotoDuplicateSourcePaint.ts, app/src/components/physic-paint/roto/physicsPaintRotoDuplicateSourcePaint.test.ts, app/src/components/physic-paint/hooks/useRotoKeyUtilities.ts, app/src/components/physic-paint/hooks/useRotoKeyUtilities.test.ts, app/src/components/physic-paint/PhysicsPaintStudio.tsx</files>
  <behavior>
    RED first (write these before the implementation; they fail against today's handler):
    - Pure resolver: a record whose payload carries non-empty inline bytes resolves `ready` and ignores the displayed paint entirely.
    - Pure resolver: a record whose payload carries no bytes (no `bytes`, or a zero-length `Uint8Array`) plus a displayed paint with a non-empty `Uint8Array` and a matching or absent `keyId` resolves `cook` carrying that exact bytes reference.
    - Pure resolver: no inline bytes and no displayed paint, or a displayed paint whose `keyId` names a different key, resolves `unavailable`.
    - Hook: source record without bytes + displayed paint → `bakeRotoKeyPaint` is called once with `{ keyId, appFrame, bytes, width, height }` from the displayed frame, and `physicalKeyUtilities.duplicateKey` is called with the source keyId only AFTER that promise settles.
    - Hook: source record without bytes + no displayed paint → no bake, no duplicate call, `setApplyStatus('error')`, and a message naming the unavailable source paint.
    - Hook: source record WITH bytes → no bake call, duplicate called immediately (fast path unchanged).
    GREEN: every expectation above passes with zero test edits after the implementation.
  </behavior>
  <action>
    Step 0 (once, before any edit): capture the typecheck baseline — `pnpm --filter efx-motion-editor run typecheck > /tmp/bxm-typecheck-baseline-full.txt; grep -c 'error TS' /tmp/bxm-typecheck-baseline-full.txt > /tmp/bxm-typecheck-baseline.txt`. The task is not done if the baseline file is missing or empty.

    RED: add `physicsPaintRotoDuplicateSourcePaint.test.ts` and a new `describe('useRotoKeyUtilities duplicateKey source paint')` block inside the existing `useRotoKeyUtilities.test.ts` (it already mocks `preact/hooks` and has `realKeyRecord`, `realKeyRecordWithoutBytes`, `createHarness`, `flushAsync` — extend `HarnessOptions`/`createHarness` with the two new optional ports; do not rewrite the harness). Run them and record the failures in the SUMMARY.

    Create `physicsPaintRotoDuplicateSourcePaint.ts` — pure, no store, no signal, no IPC:
    - Export `ROTO_DUPLICATE_SOURCE_PAINT_UNAVAILABLE_ERROR = 'source key paint unavailable'`.
    - Export `interface RotoDisplayedKeyPaint { keyId?: string; bytes: Uint8Array; width?: number; height?: number }`.
    - Export `type RotoDuplicateSourcePaintResolution = { kind: 'ready' } | { kind: 'cook'; paint: RotoDisplayedKeyPaint } | { kind: 'unavailable' }`.
    - Export `resolveRotoDuplicateSourcePaint(input: { record: PhysicPaintRotoRealKeyRecord; displayed: RotoDisplayedKeyPaint | null })`. Law, in this order: usable non-empty inline `record.payload.bytes` → `ready`; else a displayed paint whose `bytes` is a non-empty `Uint8Array` and whose `keyId` is absent or equals `record.keyId` → `cook` with that paint unchanged; else `unavailable`. Document that this is the + Key law (`resolvePreviousRealKeyBase`) applied to the duplicate's source, and that the display authority never invents bytes.

    `useRotoKeyUtilities.ts`: extend `RotoKeyUtilitiesInput` with two optional ports — `resolveDisplayedKeyPaint?: (appFrame: number) => RotoDisplayedKeyPaint | null` and `bakeRotoKeyPaint?: (paint: { keyId: string; appFrame: number; bytes: Uint8Array; width?: number; height?: number }) => Promise<boolean>`. Rewrite `duplicateKey` as: same guards (`blocked`, `requireCurrentRealKey`, `sourceKeyId`); read the source record from `input.getRotoKeyRecords()`; resolve with `resolveRotoDuplicateSourcePaint({ record, displayed: input.resolveDisplayedKeyPaint?.(record.appFrame) ?? null })`; on `unavailable` set the error status/message/lastError with `ROTO_DUPLICATE_SOURCE_PAINT_UNAVAILABLE_ERROR` and return without touching `physicalKeyUtilities`; on `ready` run the existing fire-and-forget duplicate exactly as today; on `cook` set `keyActionInFlight`, await `input.bakeRotoKeyPaint` with the source keyId/appFrame and the displayed bytes/width/height, then re-read the record and require `resolveRotoDuplicateSourcePaint({ record: afterCook, displayed: null }).kind === 'ready'` before calling `physicalKeyUtilities.duplicateKey(sourceKeyId)` — a `false` return that nevertheless settled the pixels still proceeds, a record still lacking bytes fails closed with `Could not duplicate the Roto key — source key paint unavailable.` Keep the existing catch/finally shape so `setKeyActionInFlight(false)` always runs.

    `PhysicsPaintStudio.tsx`: add the two ports to the keyUtilities literal (:2462-2491) — `resolveDisplayedKeyPaint` wraps `findCachedRotoDisplayFrame(appFrame)`, returning null unless `frame.bytes` is a non-empty `Uint8Array`, and passes `(frame as { keyId?: string }).keyId` plus width/height; `bakeRotoKeyPaint` calls `rotoPersistence.upsertCachedFrame({ frameIndex: 0, appFrame, bytes, width, height }, false, undefined, undefined, launchContext.layerId, undefined, launchContext.operationId, buildRotoBackgroundMetadata(settings), keyId)` and returns its boolean, or false when `launchContext` is null. No other Studio change; do not touch the move/script-target refs, the workflow strip, or any signal declaration.

    Do not edit the resolver, the model, the coordinator, or the bridge. After the cook, the coordinator's own post-flush read and `buildStagedRecords` stage the unchanged immutable retargeted clone.
  </action>
  <verify>
    <automated>pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint/roto/physicsPaintRotoDuplicateSourcePaint.test.ts src/components/physic-paint/hooks/useRotoKeyUtilities.test.ts</automated>
    <automated>pnpm --filter efx-motion-editor run typecheck > /tmp/bxm-typecheck-task1.txt; test -s /tmp/bxm-typecheck-baseline.txt && test "$(grep -c 'error TS' /tmp/bxm-typecheck-task1.txt)" -le "$(cat /tmp/bxm-typecheck-baseline.txt)"</automated>
  </verify>
  <done>Both suites green (including the pre-existing add/copy/cut/paste assertions in useRotoKeyUtilities.test.ts), typecheck no worse than the captured baseline, and the hook test proves the bake → verify → duplicate order plus the two fail-closed paths. The duplicate resolver, validator, coordinator, bridge, and package manifests show no diff.</done>
</task>

<task type="auto">
  <name>Task 2: Adjacent-suite gate, full-suite allowlist, and guardrail audit</name>
  <files>app/src/components/physic-paint/roto/physicsPaintRotoDuplicateSourcePaint.ts, app/src/components/physic-paint/hooks/useRotoKeyUtilities.ts, app/src/components/physic-paint/PhysicsPaintStudio.tsx</files>
  <action>
    No production edits in this task except fixes strictly required by a failing gate.

    1. Adjacent suites that constrain the untouched law: run the resolver suite, the physical-edit coordinator suite, the timeline-actions suite, and the previous-key-base suite. Any failure here means the change reached a fence — fix the change, never the test.
    2. Full app suite once, into `/tmp/bxm-full-suite.txt`. The ONLY tolerated failing files are the five known pre-existing ones: PhysicsPaintRightSidebar, PhysicsPaintWorkflowStrip.viewport, efxPaintCompositorMatrix, exportEngine, paperPass.frameGuard. Any other failing file — especially anything under physic-paint hooks/roto/view — fails this task.
    3. Typecheck again against the Task 1 baseline file.
    4. Guardrail audit: `git diff --stat` must show only the five files in this plan's frontmatter. Explicitly confirm empty diffs for `app/src/components/physic-paint/roto/physicsPaintRotoPhysicalResolver.ts`, `app/src/components/physic-paint/roto/physicsPaintRotoPhysicalModel.ts`, `app/src/lib/physicPaintBridge.ts`, `app/package.json`, and `pnpm-lock.yaml`; confirm no `.test.tsx` file was added and no `useState`/`useEffect` was introduced in the two touched source files.
    5. Write the SUMMARY with the RED/GREEN evidence, the gate counts, the five-file allowlist note, and the live UAT matrix below marked PENDING. Do not mark the quick complete before the user confirms the rows.
  </action>
  <verify>
    <automated>pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint/roto/physicsPaintRotoPhysicalResolver.test.ts src/components/physic-paint/hooks/useRotoPhysicalEditCoordinator.test.ts src/components/physic-paint/hooks/useRotoTimelineActions.test.ts src/components/physic-paint/roto/physicsPaintRotoPreviousKeyBase.test.ts</automated>
    <automated>pnpm --filter efx-motion-editor exec vitest run > /tmp/bxm-full-suite.txt 2>&1; grep -qE '^[[:space:]]*Test Files' /tmp/bxm-full-suite.txt && ! grep -E '^[[:space:]]*FAIL[[:space:]]' /tmp/bxm-full-suite.txt | grep -vE 'PhysicsPaintRightSidebar|PhysicsPaintWorkflowStrip\.viewport|efxPaintCompositorMatrix|exportEngine|paperPass\.frameGuard' | grep -q .</automated>
    <automated>pnpm --filter efx-motion-editor run typecheck > /tmp/bxm-typecheck-task2.txt; test -s /tmp/bxm-typecheck-baseline.txt && test "$(grep -c 'error TS' /tmp/bxm-typecheck-task2.txt)" -le "$(cat /tmp/bxm-typecheck-baseline.txt)"</automated>
    <automated>DIFF=$(git diff --stat -- app/src/components/physic-paint/roto/physicsPaintRotoPhysicalResolver.ts app/src/components/physic-paint/roto/physicsPaintRotoPhysicalModel.ts app/src/lib/physicPaintBridge.ts app/package.json pnpm-lock.yaml); STATUS=$?; test "$STATUS" = "0" && test -z "$DIFF"</automated>
  </verify>
  <done>Adjacent suites and every non-allowlisted file in the full suite pass; typecheck is within baseline; the untouched-law files show an empty diff; the SUMMARY records the pending live UAT matrix.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Studio display surface → store/persistence | Display bytes (preview/rendered frame) are published into a key's durable payload; the source key's pixels must be exactly what the canvas showed. |
| Child Studio realm → parent bridge | The settlement emits a live-pixel payload to the parent; it must not be able to move, add, or delete key identities. |
| Executor → package manager | No installs in this quick; the 2 MB bundle ceiling stays. |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-bxm-01 | Tampering | `bakeRotoKeyPaint` → `upsertCachedFrame` | high | mitigate | Reuse the existing settlement seam with an explicit `expectedKeyId`, expected layerId/operationId, and the store's payload validation; the port accepts only `{keyId, appFrame, bytes, width?, height?}` — no intent, identity, or frame arithmetic crosses it. |
| T-bxm-02 | Denial of Service | `useRotoKeyUtilities.duplicateKey` | high | mitigate | Fail closed on unresolved paint (error status + message + lastError) and verify the record carries bytes after the bake; a rejected settlement never falls through to the duplicate, so no carrier-less key is staged. |
| T-bxm-03 | Repudiation | displayed-paint resolution | medium | mitigate | Bytes come only from `findCachedRotoDisplayFrame` (dirty preview, else accepted render source); `keyId` must be absent or equal the source key; bytes are never synthesized, resized, or decoded. |
| T-bxm-04 | Elevation of Privilege | new keyUtilities ports | medium | accept | The cook is a paint settlement, not a structural edit: it cannot create, move, or delete a key, and the duplicate still runs through the resolver + coordinator lease + parent bridge validation. |
| T-bxm-SC | Tampering | npm/pip/cargo installs | low | accept | No dependency changes; manifests and lockfile must show an empty diff in Task 2. |
</threat_model>

<verification>
Automated gate (executor):
- Task 1 and Task 2 `<automated>` commands all pass; typecheck within the captured baseline.
- Untouched-law diff is empty for the resolver, model, bridge, and manifests.

Source audit (all four sources covered):
| Source item | Covered by |
|---|---|
| GOAL: Duplicate carries the current paint + script result to the next frame, inside its rail | Task 1 (settle-then-clone), semantics 1-3 |
| GOAL: duplicated key renders exactly like the source | Task 1 behavior: cook uses the display authority; hook test pins the exact bytes |
| Clarification: "next frame if free" and target selection | Semantics 1 — splice at source+1 with a +1 ripple; capacity rejection; unchanged |
| Clarification: key belongs to the source's own rail | Semantics 2 — no manufactured break; `finalizeProposal` unchanged |
| Clarification: script copy semantics / per-key independence | Semantics 3 — per-key raster copy; no script field exists; independence is pinned by the frozen per-record payload |
| Clarification: scope = bottom-timeline Duplicate only | Semantics 4 + scope fences; Move tool untouched |

Live UAT (user-run — pending; the SUMMARY must mark these PENDING):
| # | Step | Expected |
|---|------|----------|
| 1 | Apply a script to the current real key (brush/watercolor), then press the bottom-timeline Duplicate | New key appears at source+1, is selected, and renders the SAME paint as the source — not blank |
| 2 | Duplicate a key while its frame is dirty (draw a stroke, then Duplicate without waiting) | The duplicated key carries the stroke just drawn |
| 3 | Edit/erase the duplicated key | The source key's paint is unchanged |
| 4 | Duplicate an already-baked key | Unchanged behavior: identical clone at source+1, every key at/after it shifts +1, same rail |
| 5 | Move the source and the duplicate with the Move tool | Unchanged behavior; recorded only to prove the scope fence |
</verification>

<success_criteria>
- The bottom-timeline Duplicate produces a key that renders exactly like the source when the source's paint was not yet settled into the record; it never produces a blank duplicate.
- A source that already carries inline bytes takes today's path with no extra write.
- Unresolvable paint fails closed with an explicit message and no key.
- The resolver, semantic-delta validator, coordinator, bridge, package manifests, Move tool, and rail derivation are untouched.
- All automated gates pass; the quick stays automated-ready until the user's live UAT rows pass.
</success_criteria>

<output>
Create `.planning/quick/261023-bxm-feat-i-d-like-to-send-the-current-paint-/261023-bxm-SUMMARY.md` when done, with RED/GREEN evidence, gate counts, the guardrail audit, and the live UAT matrix marked PENDING.
</output>
