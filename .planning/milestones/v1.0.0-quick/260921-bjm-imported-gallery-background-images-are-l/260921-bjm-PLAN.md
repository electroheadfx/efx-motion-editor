---
phase: quick-260921-bjm
plan: 260921-bjm
type: execute
wave: 1
depends_on: []
files_modified:
  - app/src/types/physicPaint.ts
  - app/src/lib/physicPaintBridge.ts
  - app/src/stores/imageStore.ts
  - app/src/main.tsx
  - app/src/components/physic-paint/PhysicsPaintStudio.tsx
  - app/src/components/physic-paint/bridge/physicsPaintBridgeTransport.test.ts
  - app/src/components/physic-paint/PhysicsPaintStudio.test.ts
  - app/src/stores/projectStore.test.ts
  - app/src/stores/physicPaintStore.test.ts
  - .planning/quick/260921-bjm-imported-gallery-background-images-are-l/260921-bjm-SUMMARY.md
autonomous: true
requirements: []
estimate:
  tokens: 44000
  raw_tokens: 44000
  tasks: 3
  confidence: low
must_haves:
  truths:
    - "An image imported in the Studio picker (photo-reference gallery OR background) is registered in the MAIN realm's project library — the exact `images` record the project manifest is built from — so the Studio's next launch request returns it (gallery populated) and the main app sees it too."
    - "The imported image survives an app quit/reopen: the manifest `images` array carries the ref with project-relative paths, and a reopen hydrates the library from it."
    - "The destination project directory is chosen by the MAIN realm only: the import request carries the dialog-selected paths + operationId and NO directory; a malformed or oversized request is rejected at the bridge boundary with zero mutation."
    - "The existing launch hydration relinks the background clip / photo reference once the library record exists — refs resolve 'content' instead of 'asset-not-found' — with no change to the hydration code (it was downstream of the loss, never the cause)."
    - "A picker Import that cannot be performed (no project directory, IPC failure) surfaces an error in the picker and writes no library record — never a silent no-op."
    - "The picker controller and view are byte-unchanged: the grid, selection, the pre-flight 'No project directory is open.' guard, and the D-02 natural-sort confirm ordering behave exactly as before."
    - "Native UAT is left explicitly pending — never claimed."
  artifacts:
    - app/src/types/physicPaint.ts — PhysicPaintImageImportRequest/Result (+ message shapes and boundary guards, whitelist on operationId + paths only)
    - app/src/lib/physicPaintBridge.ts — the image-import event pair, the main-side handler applyPhysicPaintImageImportRequest, the child-side requestImageImport, the main-side installPhysicPaintImageImportListener
    - app/src/stores/imageStore.ts — importFiles returns the IPC outcome (ImportResult | null) so the main-side handler can report success and per-file errors
    - app/src/main.tsx — the main branch installs the image-import listener next to installPhysicPaintImageLibraryListener
    - app/src/components/physic-paint/PhysicsPaintStudio.tsx — the picker importFiles port routes through the bridge to the main realm; the child-realm library write is gone; mergeImageLibraries's doc comment states the new authority
    - app/src/components/physic-paint/bridge/physicsPaintBridgeTransport.test.ts — the import-pair contract legs and the end-to-end reopen seam against the REAL imageStore + mark-dirty trigger
    - app/src/components/physic-paint/PhysicsPaintStudio.test.ts — the wiring lock replacing the assertion that pinned the defect (line 1392)
    - app/src/stores/projectStore.test.ts — the manifest round-trip leg (buildMceProject().images → reopen → library identical)
    - app/src/stores/physicPaintStore.test.ts — the hydration leg (a persisted ref resolves 'content'; a ref absent from the library reports asset-not-found)
    - .planning/quick/260921-bjm-imported-gallery-background-images-are-l/260921-bjm-SUMMARY.md — the (a)/(b)/(c) verdicts with evidence, the 52.2 exoneration, RED/GREEN raw output, gates, guardrail audit, the four native UAT rows marked pending
  key_links:
    - "app/src/components/physic-paint/PhysicsPaintStudio.tsx:4101 — `importFiles: (paths: string[], projectDir: string) => imageStore.importFiles(paths, projectDir)`. THE DEFECT: the picker's Import runs in the STUDIO webview, so this writes the CHILD realm's imageStore module instance — a different module instance from the main webview's. It also feeds the same-session grid through the child term of mergeImageLibraries (:368), which is why the images look imported and then vanish."
    - "app/src/stores/projectStore.ts:393 — `images: imageStore.toMceImages(projectRoot)` inside buildMceProject. The MAIN realm's imageStore is the ONLY source of the persisted `images` array (the manifest record the 52.2 package writes), and :453 `imageStore.loadFromMceImages(project.images, projectRoot)` is the only source of the reopened library. Nothing else writes either."
    - "app/src/stores/imageStore.ts:65-94 — importFiles appends to the realm's own `images` signal and calls `_markDirty?.()`; :48/:90 the callback; app/src/stores/projectStore.ts:1071 binds it to THAT realm's projectStore instance (`_setImageMarkDirtyCallback(() => projectStore.markDirty())`). In the child webview that marks the child's inert projectStore — no save path, no autosave. app/src/lib/autoSave.ts:57-66 subscribes to imageStore.images in the MAIN realm only."
    - "app/src/lib/physicPaintBridge.ts:110-111 / :2531-2553 / :2555-2587 / :2568-2571 — the image-library pair this plan mirrors: the read-only request/result events, the child convenience (listen + 15s timeout + emitTo('main')), the main-side installer (Tauri emitTo + CustomEvent + postMessage arms), and the main state ports `getImages`/`getProjectDir` with the `dirPath ?? tempProjectDir` fallback pinned by the PROJECT-DIR FALLBACK leg at app/src/components/physic-paint/bridge/physicsPaintBridgeTransport.test.ts:150-158. There is NO child→main event carrying imported refs today — that absence is verdict (b)."
    - "app/src/stores/image_pool.rs (app/src-tauri/src/services/image_pool.rs:57-90) — `process_image` copies the file to `<projectDir>/images/<stem>_<uuid8>.<ext>`, writes the thumbnail and returns the metadata. Bytes are on disk (verdict (a) = false); only the library RECORD is missing."
    - "app/src/components/physic-paint/hooks/usePhysicsPaintLaunchIntegration.ts:145-170 — the launch path: requestImageLibrary → imageStore.loadFromMceImages → registerDocument → hydrateBackgroundSourceImagesFromLibrary / hydrateReferenceSourceImagesFromLibrary WITH the launch library fallback. app/src/stores/efxPaintStore.ts:1755-1765 runs the same two hydrations from hydrateRuntimeFromDocument. Both are already correct: they relink exactly the refs the main library knows (verdict (c) = downstream victim, not the cause)."
    - "app/src/types/physicPaint.ts:2127-2147 (the library pair shapes) / :2412 (isMceImageRef) / :2426-2444 (guard + message-guard idiom, `hasOnlyKeys` at :2514, `isBoundedOperationId` at :2519) — the templates for the new pair. `hasOnlyKeys(value, ['operationId','paths'])` is what structurally forbids a directory in the request."
    - "app/src/components/physic-paint/view/BackgroundAssetPickerView.tsx:27-53 (the ports), :93-115 (importImages: openDialog → importFiles → refreshLibrary), :139-146 (buildConfirmedImageIds, D-02) and its test app/src/components/physic-paint/view/BackgroundAssetPickerView.test.ts:142-188 — UNTOUCHED by this plan (guardrail): the controller's dir pre-flight, the refresh flow and the natural sort keep working verbatim; the port signature stays `(paths, projectDir)` so no controller or view change is needed."
    - "app/src/components/physic-paint/bridge/physicsPaintBridgeTransport.test.ts:66-159 — the `image-library bridge pair (49-04, Task 1)` describe where the new pair's legs belong (invoke/emitTo already hoisted-mocked); app/src/components/physic-paint/PhysicsPaintStudio.test.ts:1388-1402 — the source-shape block whose line **1392 currently ASSERTS the defect** (`importFiles: (paths: string[], projectDir: string) => imageStore.importFiles(paths, projectDir)`) and must be replaced; app/src/stores/projectStore.test.ts:14-22 — the partial ipc mock idiom (`vi.mock('../lib/ipc', importOriginal + spread)`) to extend with an `importImages` mock."
---

<objective>
Fix the data loss: images imported in the Studio's asset picker (photo-reference gallery and background) disappear after closing the Studio and after quitting the app.

Diagnosis performed at plan time (the executor reproduces and records it before touching code — see Task 1):

- **(a) "the import never writes bytes" — FALSE.** The picker's Import opens the native dialog in the Studio, then calls `imageStore.importFiles` → IPC `import_images` → Rust `process_image`, which copies the file into `<projectDir>/images/` and writes a thumbnail (`image_pool.rs:57-90`). Bytes are on disk and the session renders them.
- **(b) "bytes are written but the gallery record is not persisted" — TRUE (root cause).** The persisted library is the MAIN realm's `imageStore` (`projectStore.ts:393` builds the manifest `images`; :453 rehydrates it). The picker's import ran in the STUDIO realm's own `imageStore` module instance — a separate webview, a separate module instance — and the realm-local `_markDirty` only marks the child's inert projectStore. No bridge event carries imported refs child→main (only the read-only image-library request/result pair exists). So the record never reaches the manifest, the next Studio launch requests an empty library, and every clip/reference naming the ref resolves `asset-not-found`. The 52.2 reference-only package rework is EXONERATED: the manifest already carries `images`, the document already carries `background.clips[].sourceFrameRefs` / `photoReference.sourceFrameRefs` — **no format change is needed, the root is not structural.**
- **(c) "both persisted but hydration fails to relink" — FALSE as a cause.** The launch hydration (launch integration :145-170, `hydrateRuntimeFromDocument` :1755-1765) is already correct; it can only relink what the main library holds. It is the downstream victim of (b).

Purpose: make the picker's Import take the ONE path the main app's own import takes, so the library record is written by the realm that owns the manifest and the existing save/open/hydration chain does the rest — no new format, no new IPC command, no change to the picker UI.

Output: a new image-import request/result bridge pair (child asks, main realm performs + answers with the post-import library), the Studio picker rewired to it, the child-realm library write gone, RED-then-green contract + end-to-end legs, persistence/hydration locks, and the pending native UAT rows.
</objective>

<execution_context>
@/Users/lmarques/Dev/efx-motion-editor/.claude/gsd-core/workflows/execute-plan.md
@/Users/lmarques/Dev/efx-motion-editor/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@app/src/components/physic-paint/PhysicsPaintStudio.tsx
@app/src/lib/physicPaintBridge.ts
@app/src/types/physicPaint.ts
@app/src/stores/imageStore.ts
@app/src/stores/projectStore.ts
@app/src/components/physic-paint/hooks/usePhysicsPaintLaunchIntegration.ts

Plan base: `d340c71b` (record `git rev-parse HEAD` at start — it is the scope-gate base; the working tree is clean).

Verified code facts (live reads, 2026-09-21) are in `must_haves.key_links` — read them before writing code; every line number below was verified, not recalled.

Rules that bind this plan:
- Commands (project rule, inherited verbatim): `pnpm --filter efx-motion-editor exec vitest run <paths>` — vitest run only, NEVER watch; types via `pnpm --filter efx-motion-editor exec tsc --noEmit`; full suite `pnpm --filter efx-motion-editor exec vitest run`. The full suite was 4037 pass / 0 failures at the 260920-kov plan base — any new failure must be attributed by name, never absorbed.
- Do NOT launch the app or the dev server (user runs it); native UAT is owed by the user, never claimed.
- `app/tsconfig.json` sets `noUnusedParameters` — an intentionally unused port param must be `_projectDir`.
- efx-preact-reactivity applies to the Studio edit: it is a port wiring only — no new signal, no new effect, no signal write in a render body, no useState. The child's `imageStore` is NOT written on the import path anymore.
- Guardrails (verbatim intent): the picker controller and view (`BackgroundAssetPickerView.tsx` + its test) are NOT touched; the save/package path and the launch hydration are NOT touched; no new IPC/Rust command; no change to the manifest or document format; the picker's user-visible behavior (grid, selection, D-02 confirm order, error copy) is unchanged.
</context>

<tasks>

<task type="tracer" tdd="true">
  <name>Task 1: Diagnose the loss, then land the one import path — picker → MAIN-realm library (RED then GREEN)</name>
  <files>app/src/components/physic-paint/bridge/physicsPaintBridgeTransport.test.ts, app/src/components/physic-paint/PhysicsPaintStudio.test.ts, app/src/types/physicPaint.ts, app/src/lib/physicPaintBridge.ts, app/src/stores/imageStore.ts, app/src/main.tsx, app/src/components/physic-paint/PhysicsPaintStudio.tsx</files>
  <behavior>
    DIAGNOSE FIRST (no code changes yet) — confirm the (a)/(b)/(c) verdicts above with fresh reads and record the raw evidence for the SUMMARY:
    - (a) FALSE: `app/src-tauri/src/services/image_pool.rs:57-90` copies the file into `<projectDir>/images/` and writes a thumbnail; the dialog import does produce usable bytes.
    - (b) TRUE: grep `app/src` for any bridge event carrying imported image refs child→main — there is none (only `physic-paint:image-library-request/result`, which is main→child read-only). `projectStore.ts:393` is the sole manifest writer of `images`; `PhysicsPaintStudio.tsx:4101` routes the import into the child realm; `imageStore.ts:90` + `projectStore.ts:1071` show the mark-dirty lands on the CHILD's projectStore instance. The manifest never gains the ref → the next Studio launch (launch integration :145-170) requests a library without it → the clip/ref hydration reports `asset-not-found`.
    - (c) FALSE as a cause: the launch hydration and `hydrateRuntimeFromDocument` are correct for refs the main library holds.
    - If any probe contradicts (b) — in particular if anything else writes the manifest `images`, or if a Studio→main event already carries refs — STOP and report instead of implementing (and if the root ever requires a format change, STOP and report; it does not).

    RED legs (run them and capture the raw failing output verbatim):
    - In `physicsPaintBridgeTransport.test.ts`, add a sibling describe to the library pair (`image-import bridge pair (quick-260921-bjm)`) using the file's existing hoisted `invoke` mock:
      * REQUEST GUARD: `isPhysicPaintImageImportRequest` accepts `{ operationId, paths }` only — a payload carrying `projectDir`, a non-array `paths`, an empty paths array, a non-string entry, an over-long path, or an over-long/absent operationId is rejected (mirror the library guard legs at :110-126 style).
      * HANDLER: a valid request calls the injected `importImages(paths, <the MAIN realm's own resolved dir>)` exactly once with the dialog paths — never a directory taken from the payload — and resolves `{ operationId, ok: true, images: <post-import library snapshot>, errors: [] }`; per-file failures arrive as `errors` strings; `importImages` resolving `null` (IPC failure) or throwing, and an empty project dir, give terminal `{ ok: false, images: [], errors: [], error: … }` results with the copy `'No project directory is open.'` for the empty-dir case (today's child pre-flight copy, preserved end to end).
      * MALFORMED REQUEST: a bad payload resolves `{ ok: false, error: 'Invalid image import request', images: [], errors: [] }` with ZERO import attempts.
    - The end-to-end reopen seam against the REAL `imageStore` (the file's mocked `invoke` already drives the real `imageStore.importFiles` → `ipcImportImages('import_images')`): with ports bound to the real store (`getImages: () => imageStore.toMceImages(dir)`, `getProjectDir`, `importImages: (paths, dir) => imageStore.importFiles(paths, dir)`), after a successful `applyPhysicPaintImageImportRequest`: (1) the subsequent `applyPhysicPaintImageLibraryRequest` with the same ports returns a library that CONTAINS the imported ref with project-relative paths — the "close Studio → reopen → gallery present" seam; (2) the mark-dirty callback registered through `_setImageMarkDirtyCallback` fired once — the trigger `autoSave` subscribes to (`autoSave.ts:57-66`) for the manifest write; (3) the failed case leaves the library unchanged. RED at base: the symbols do not exist.
    - In `PhysicsPaintStudio.test.ts` (the source-shape block at :1388-1402): REPLACE line 1392's assertion (it pins the defect) with the new contract — the picker's `importFiles` port routes through `requestImageImport(` and the file no longer contains `imageStore.importFiles` — keeping every other assertion in the block (requestLibrary, openDialog filters, refreshLibrary merge, D-02 sort, no-USEState-in-view) intact. Add a one-line comment naming what the replaced assertion pinned (the child-realm library write).

    THEN GREEN (production, five files — nothing else):
    - `types/physicPaint.ts`: `PhysicPaintImageImportRequest { operationId; paths }`, `PhysicPaintImageImportResult { operationId; ok; images; errors; error? }` (+ the two message shapes), `isPhysicPaintImageImportRequest` with `hasOnlyKeys(value, ['operationId','paths'])` and bounded entries (non-empty strings, bounded count and length), `isPhysicPaintImageImportResult`, `isPhysicPaintImageImportResultMessage`. Mirror :2127-2147 / :2412 / :2426-2444 exactly.
    - `lib/physicPaintBridge.ts`: constants `PHYSIC_PAINT_IMAGE_IMPORT_REQUEST_EVENT = 'physic-paint:image-import-request'` and `PHYSIC_PAINT_IMAGE_IMPORT_RESULT_EVENT = 'physic-paint:image-import-result'` next to :110-111; `applyPhysicPaintImageImportRequest(value, ports)` (async) where the ports EXTEND the library state ports with `importImages: (paths, projectDir) => Promise<readonly string[] | null>` (null = the import could not be performed; the resolved array is the ready-to-ship per-file error list in the store's existing `${path}: ${error}` shape — do not refactor `imageStore` for it); `requestImageImport(paths)` mirroring `requestImageLibrary` :2531-2553 verbatim in structure (listen, 15s timeout, `emitTo('main', …)`, result validated by the new guard AND correlated on operationId, listeners cleaned up); `installPhysicPaintImageImportListener()` mirroring :2555-2587 (Tauri `emitTo(PHYSIC_PAINT_WINDOW_LABEL, …)` + CustomEvent + postMessage/opener arms; the main state ports reuse the `dirPath ?? tempProjectDir` fallback so the temp-dir parity pinned at transport-test :150-158 holds).
    - `stores/imageStore.ts`: `importFiles` returns the IPC outcome (`ImportResult | null`, null when `result.ok` is false) — additive; the two main-app callers (`EditorShell.tsx:35`, `ImportedView.tsx:428`) ignore the value; the `importErrors` signal behavior for the main app stays exactly as today.
    - `main.tsx`: install the new listener in the main branch next to `installPhysicPaintImageLibraryListener()` (:123) with the same awaited app-lifetime idiom.
    - `PhysicsPaintStudio.tsx`: rewire the port in `sharedPickerPorts` (:4101) to an inline async arrow calling `requestImageImport(paths)` and throwing `new Error(result.error ?? 'Image import failed')` when `!result.ok` (the controller already surfaces a thrown error as the picker status; the dir pre-flight never reaches it); keep the `(paths: string[], _projectDir: string)` signature so the controller/view stay untouched; update the `mergeImageLibraries` doc comment (:360-367) to state that imports now land in the MAIN realm and the child copy is a launch-snapshot fallback only.
  </behavior>
  <action>
    Produce the diagnosis evidence first, then the RED legs, then the fix. Capture the raw RED output verbatim (the exact failing assertions — the missing symbols and the replaced wiring assertion) for the SUMMARY. Run the targeted files green after the fix, then `tsc --noEmit`. Keep the picker's user-visible behavior identical: no controller, view, copy or ordering change. Commit: `test(260921-bjm): RED — the picker's import never reaches the main-realm library`, then `fix(260921-bjm): picker imports register in the main-realm project library`.
  </action>
  <verify>
    <automated>cd /Users/lmarques/Dev/efx-motion-editor &amp;&amp; pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint/bridge/physicsPaintBridgeTransport.test.ts src/components/physic-paint/PhysicsPaintStudio.test.ts src/components/physic-paint/view/BackgroundAssetPickerView.test.ts &amp;&amp; pnpm --filter efx-motion-editor exec tsc --noEmit</automated>
  </verify>
  <done>The (a)/(b)/(c) verdicts are recorded with raw evidence; the new legs are green with the raw RED output captured; a picker import reaches the main realm's imageStore (library read contains the ref with relative paths) and fires the mark-dirty trigger; the request carries no directory and malformed payloads are terminal with zero mutation; the picker view/controller tests are green untouched; `tsc --noEmit` clean.</done>
</task>

<task type="auto">
  <name>Task 2: Lock the persistence half — the record survives save/open and the launch hydration relinks it</name>
  <files>app/src/stores/projectStore.test.ts, app/src/stores/physicPaintStore.test.ts</files>
  <behavior>
    Test-only locks at the two seams the user's UAT rows ②/③/④ exercise; no production change (any red leg here means Task 1's fix is incomplete — fix Task 1, do not patch the test).

    - In `projectStore.test.ts` (extend the existing partial ipc mock at :14-22 with an `importImages` mock in the same `vi.mock('../lib/ipc', importOriginal + spread)` factory):
      * MANIFEST LEG: drive `applyPhysicPaintImageImportRequest` with production-shaped ports bound to the real `imageStore` (importImages → the real `imageStore.importFiles`, whose mocked IPC returns one imported image with absolute project paths); then `projectStore.buildMceProject().images` must contain that image's ref with PROJECT-RELATIVE `relative_path` / `thumbnail_relative_path` (the manifest record the 52.2 package writes).
      * REOPEN LEG: simulate quit/reopen — `imageStore.reset()` then `imageStore.loadFromMceImages(project.images, projectRoot)` — and assert `imageStore.toMceImages(projectRoot)` reproduces the pre-close library (same ids, same relative paths). This is the "gallery still populated after relaunch" proof at the manifest level.
    - In `physicPaintStore.test.ts` (reuse the existing `hydrateBackgroundSourceImages` harness at :2510-2623 — injectable ports, real store):
      * RELINK LEG: load the reopened snapshot into the real `imageStore` (`loadFromMceImages`), build a document whose background clip (and, in a second leg, `photoReference.sourceFrameRefs`) names the persisted ref, and run the hydration with ports whose `resolveAssetUrls` mirrors the production shape (`imageStore.getById(ref)` → `assetUrl(image.project_path)` + the picker list fallback) — the ref must register (verdict (c): the existing hydration relinks as soon as the record exists).
      * MISS LEG (unchanged law, control): a ref absent from the reopened library reports `asset-not-found` and registers nothing — the fail-closed path the defect surfaced, never a throw and never invented content.
  </behavior>
  <action>
    Write both files' legs against the real stores and the existing harnesses (no new test config, no new harness). Run them green; if any leg is red, treat it as Task 1 incomplete. Commit: `test(260921-bjm): lock the import record through the manifest round-trip and the launch hydration`.
  </action>
  <verify>
    <automated>cd /Users/lmarques/Dev/efx-motion-editor &amp;&amp; pnpm --filter efx-motion-editor exec vitest run src/stores/projectStore.test.ts src/stores/physicPaintStore.test.ts &amp;&amp; pnpm --filter efx-motion-editor exec tsc --noEmit</automated>
  </verify>
  <done>The manifest leg shows `buildMceProject().images` carrying the imported ref with relative paths; the reopen leg reproduces the library after reset+reload; the hydration leg registers the persisted ref and the absent ref still reports asset-not-found; both suites + `tsc --noEmit` green.</done>
</task>

<task type="auto">
  <name>Task 3: Gates, scope/guardrail audit, and the SUMMARY (native UAT left pending)</name>
  <files>.planning/quick/260921-bjm-imported-gallery-background-images-are-l/260921-bjm-SUMMARY.md</files>
  <behavior>
    Gates in order: the five touched test files; then `pnpm --filter efx-motion-editor exec tsc --noEmit`; then the full suite `pnpm --filter efx-motion-editor exec vitest run` (background it if the runtime allows; resume only on completion). Attribute any failure by name — the suite was 4037 pass / 0 failures at the 260920-kov base; a new failure is this plan's.

    Scope gate: `git diff --name-only &lt;plan-base d340c71b&gt;..HEAD` lists ONLY this plan's five production files, its four test files, and `.planning/` artifacts.

    Guardrail audit by READING the diff:
    1. `BackgroundAssetPickerView.tsx` and its test are NOT in the diff (controller, view, pre-flight dir guard, D-02 ordering untouched).
    2. The launch hydration files (`usePhysicsPaintLaunchIntegration.ts`, `efxPaintStore.ts`) and the save/package path (`projectStore.ts` production code, `efx-paint/` package writers) are NOT in the diff.
    3. Exactly one new event pair exists; no new IPC/Rust command; no capability file change.
    4. `imageStore.importFiles`'s behavior for its two main-app callers is unchanged apart from the additive return value.
    5. The picker's user-visible strings are unchanged (`No project directory is open.` reachable end to end; 'Import'/'Confirm'/'Cancel' untouched).

    SUMMARY at `.planning/quick/260921-bjm-imported-gallery-background-images-are-l/260921-bjm-SUMMARY.md`: the (a)/(b)/(c) verdicts with their raw evidence (file:line reads, the child→main event absence, the Rust copy leg); the explicit 52.2 exoneration and the "not structural — no format change" statement; before/after of the import path (child-realm write vs main-realm request/result); the raw RED output and the green runs; the Task 2 lock legs' outcomes; the scope + guardrail audit; the gate results; the four native UAT rows marked PENDING — never claimed.
  </behavior>
  <action>
    Run the gates, read the diff for the guardrail audit, write the SUMMARY. Commit: `docs(260921-bjm): verdict (b) root cause, main-realm import path, gates — native UAT pending`.
  </action>
  <verify>
    <automated>cd /Users/lmarques/Dev/efx-motion-editor &amp;&amp; pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint/bridge/physicsPaintBridgeTransport.test.ts src/components/physic-paint/PhysicsPaintStudio.test.ts src/components/physic-paint/view/BackgroundAssetPickerView.test.ts src/stores/projectStore.test.ts src/stores/physicPaintStore.test.ts &amp;&amp; pnpm --filter efx-motion-editor exec tsc --noEmit</automated>
  </verify>
  <done>The full suite is green with any failure attributed by name; the scope gate lists only the plan's files; the guardrail audit is recorded; the SUMMARY carries the verdicts with evidence, the RED/GREEN output, the audits and the four UAT rows marked pending.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Studio child realm → main realm (import request) | A payload built in the child webview crosses the event bridge into the realm that owns the project library and the filesystem import. |
| Dialog-selected paths → project library import | Caller-supplied file paths reach the Rust `import_images` command, which copies into the project directory. |
| Library record → project manifest | The main realm's imageStore is the only source of the persisted `images` array. |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-260921-bjm-01 | Tampering | `isPhysicPaintImageImportRequest` | medium | mitigate | The request guard whitelists `operationId` + `paths` only (`hasOnlyKeys`) — a payload naming a destination directory is REJECTED at the bridge boundary; the main realm resolves its own dir (`dirPath ?? tempProjectDir`) and the Rust `process_image` copies into `<projectDir>/images/` under a uuid-suffixed filename (no caller-chosen destination). Asserted by the guard + handler legs. |
| T-260921-bjm-02 | Spoofing | `requestImageImport` result correlation | medium | mitigate | The child validates the result payload with `isPhysicPaintImageImportResult` AND correlates on `operationId` before settling (the image-library pair's established discipline); a forged/foreign result is dropped. |
| T-260921-bjm-03 | Denial of service | import request bounds | low | mitigate | `paths` entries are bounded (non-empty, length-capped) and the entry count is capped; a malformed or oversized request resolves a terminal `{ ok: false }` with zero import attempts and zero mutation. |
| T-260921-bjm-04 | Information disclosure | local desktop app | low | accept | No new I/O surface: the same project directory, the same existing `import_images` command; no network, no new capability, no format change. |
| T-260921-bjm-SC | Tampering | pnpm installs | low | accept | No dependency changes in this plan — no package-legitimacy gate required. |
</threat_model>

<verification>
- Verdict gate: the SUMMARY states the (a)/(b)/(c) verdicts with raw evidence (file:line), the child→main event absence that proves (b), the 52.2 exoneration, and "not structural — no format change". If the executor's probes contradicted (b), the run stops and reports instead of implementing.
- Import path: a picker import reaches the MAIN realm's imageStore — the library read after the request contains the imported ref with project-relative paths, and the mark-dirty trigger fires (the autosave/manifest path).
- Boundary: the request carries `operationId` + `paths` only; malformed/oversized/directory-carrying payloads are terminal with zero mutation; the empty-dir copy is preserved.
- Persistence: `buildMceProject().images` carries the ref; a reset+`loadFromMceImages` reopen reproduces the library.
- Relink: the existing hydration registers a persisted ref and still reports `asset-not-found` for an absent one.
- Guardrails held by reading the diff: picker view/controller untouched; launch hydration and the save/package path untouched; one new event pair; no new IPC/Rust command; no capability change; no format change.
- Regression: five touched files + `tsc --noEmit` + the full suite green (any failure attributed by name; the 4037-pass baseline is the reference).
- Scope gate: `git diff --name-only d340c71b..HEAD` lists only this plan's files plus `.planning/` artifacts.
- Native UAT: the four rows are listed in the SUMMARY as pending, never claimed (the executor does not launch the app).
</verification>

<human_verification>
Native UAT — OWED BY THE USER after execution; the executor leaves these pending and never claims them (the executor does not launch the app; the user runs the dev server).

1. Import a photo into the Studio photo-reference gallery with the picker's Import button → close the Studio → reopen it → the photo is still in the gallery and usable.
2. Import a background image → quit the app entirely → relaunch (saving when the unsaved-changes guard asks) → the background image is still there and the clip renders.
3. Use a reopened gallery image as a reveal/reference source → it resolves and works.
4. Save/load roundtrip of the `.mce` package preserves all imports (gallery entries + background clips + photo reference).
</human_verification>

<success_criteria>
- The diagnosis is on record: verdict (b) — bytes written, library record never persisted; the 52.2 reference-only rework exonerated; no format change.
- The picker's Import (both galleries, one shared port) is performed by the main realm and answered with the post-import library; the child-realm library write is gone; the request never names a directory.
- The record survives save/open and the untouched launch hydration relinks it; the picker's user-visible behavior (grid, selection, error copy, D-02 ordering) is byte-unchanged.
- Five touched files' suites, `tsc --noEmit` and the full suite green; scope gate clean; guardrail audit recorded; the four native UAT rows left explicitly pending.
</success_criteria>

<output>
Create `.planning/quick/260921-bjm-imported-gallery-background-images-are-l/260921-bjm-SUMMARY.md` when done — carrying the (a)/(b)/(c) verdicts with raw evidence, the 52.2 exoneration, the import-path before/after, the raw RED output and the green runs, the lock legs' outcomes, the scope + guardrail audit, the gate results, and the four native UAT rows marked pending.
</output>
