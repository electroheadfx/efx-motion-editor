# Phase 49: Fixed Background Track and Imported Loop Clips - Pattern Map

**Mapped:** 2026-08-31
**Files analyzed:** 12 (new + modified)
**Analogs found:** 10 / 12 (2 brand-new surfaces with extracted composition analogs)

All analog paths verified git-tracked via `git ls-files` (2026-08-31). Excerpts are verbatim from `49-RESEARCH.md` primary sources — every cited line range was re-read this session per the research log.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `app/src/efx-paint/document/efxPaintDocument.ts` (extend `BackgroundFallback` union) | model / types | request-response (parser I/O) | `app/src/efx-paint/document/efxPaintDocument.ts:20-22` (current union) | exact |
| `app/src/efx-paint/document/efxPaintDocumentParsers.ts` (extend fallback branch) | parser (fail-closed, exact-member) | request-response | same file lines 207-227 (existing fallback parser) | exact |
| `app/src/efx-paint/document/efxPaintDocumentRevision.ts` (extend canonical encoder) | encoder | transform | same file lines 30-33 + 92-107 (existing fallback encoder + clip encoder) | exact |
| `app/src/efx-paint/document/__tests__/<fallback>roundtrip.test.ts` (new) | test | request-response | `efxPaintDocument.test.ts` + parser round-trip tests in same dir | role-match |
| `app/src/efx-paint/utils/naturalFilenameSort.ts` (new util) | utility | transform | none in-repo (grep-verified absence) — pattern: ECMA-402 `Intl.Collator` per research | none (research-derived) |
| `app/src/stores/efxPaintStore.ts` (add Background clip CRUD ops) | store (pure document mutation) | request-response | `efxPaintStore.ts:169-222` (`addTrack`/`renameTrack` idiom) | exact |
| `app/src/stores/physicPaintStore.ts` (re-wire `_resolveDocumentFondInstruction` + register hydration + registerBackgroundSourceImage consumer) | store | request-response + event | `physicPaintStore.ts:845-852` (existing fond derivation), `:1552-1569` (idempotence lesson), `:428-433` (registry) | exact |
| `app/src/components/physic-paint/view/BackgroundAssetPickerView.tsx` (new — scoped variant) | component | request-response (IPC + bridge) | `app/src/components/import/ImportGrid.tsx:14-29` (props contract) + `app/src/stores/imageStore.ts` (lean signals + `importImages`/`assetUrl`) | role-match (composition) |
| `app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.tsx` (Bg-row rails + drag + Import button) | component (rail + drag) | event-driven | `PhysicsPaintWorkflowStrip.tsx:2056` (capsule port), `:3692-3742` (Bg row mount), plus existing Phase 43 track drag in same file | exact |
| `app/src/components/physic-paint/PhysicsPaintStudio.tsx` (monitor checkerboard + fond re-wire consumer) | component (canvas stack) | event-driven | `PhysicsPaintStudio.tsx:3050-3108` (`fondBackground` derivation in canvas-stack memo) | exact |
| `app/src/components/physic-paint/view/<RightPanel Bg clip properties section>` (new section) | component | request-response | `PhysicsPaintPlayScriptDialog.tsx:341,370` (numeric field + positive-integer hint); existing right-panel Track section | role-match |
| `app/src/lib/physicPaintBridge.ts` (new image-library request/result pair + projectDir delivery) | transport / bridge | event-driven (request-result pair) | `physicPaintBridge.ts:85-94` (`script-library-request/result`, `roto-authority-request/result`, `thumbnail-encode-request/result`) | exact |
| `app/src-tauri/capabilities/physics-paint.json` (extend with `dialog:allow-open`) | config | I/O gate | `app/src-tauri/capabilities/default.json` (main window's `dialog:allow-open`, `fs:allow-read-file`, lines 15-28) | exact |

## Pattern Assignments

### 1. `efxPaintDocument.ts` — `BackgroundFallback` union extension

**Analog:** `app/src/efx-paint/document/efxPaintDocument.ts:20-22`

**Current union (lines 20-22, verbatim):**
```typescript
export type BackgroundFallback =
  | { readonly mode: 'transparent' }
  | { readonly mode: 'solid'; readonly color: string };
```

**Pattern:** extend in lockstep with parser (exact-member fail-closed) and canonical encoder. Add a paper mode carrying `{ mode: 'paper'; texture: 'canvas1'|'canvas2'|'canvas3'; paperGrain; grainStrength }` per research Open Q2. Map `'white'` to existing `{ mode:'solid'; color:'#ffffff' }` only if encoder/parser round-trip cleanly; otherwise add a distinct `'white'` literal. Gate on round-trip tests for every new mode.

---

### 2. `efxPaintDocumentParsers.ts` — fallback branch extension

**Analog:** `app/src/efx-paint/document/efxPaintDocumentParsers.ts:207-227` (existing fallback parser)

**Pattern category:** fail-closed exact-member parsing — the current branch throws `"fallback.mode must be transparent or solid."` and validates members exhaustively. New modes MUST follow the same shape: type-narrow the discriminant, validate every member's type, throw on unknown/extra fields. Do NOT loosen to partial acceptance.

**Clip parser precedent (lines 118-133):** enforces finite-count validation for `FrameLoopClipRepeat`; reuse the same integer-coercion / positivity-check shape for any new numeric fallback fields (grainStrength).

---

### 3. `efxPaintDocumentRevision.ts` — canonical encoder extension

**Analog:** `app/src/efx-paint/document/efxPaintDocumentRevision.ts:30-33` + 92-107

**Pattern:** the canonical encoder switches on the union discriminant (`'transparent;'` / `solid:<color>`). Each new mode adds a stable string term; ordering must be deterministic; never include revision or volatile fields. Already carries `clips:` + `fallback:` terms at lines 92-107 — the extension site is the fallback switch, not the clips term.

---

### 4. Fallback round-trip tests (NEW)

**Analog:** `efxPaintDocument.test.ts` + existing parser round-trip tests under `app/src/efx-paint/document/`, fixtures in `app/src/efx-paint/document/__fixtures__/`.

**Pattern:** for each new fallback mode — parse(serialize(x)) === x; canonical encoder equality on identical documents; failure test asserting the parser throws on a `photo` mode (D-11 reservation).

---

### 5. `naturalFilenameSort.ts` (NEW util)

**Analog:** none in-repo (grep-verified absence of `naturalSort`, `Intl.Collator`, `numeric: true`).

**Pattern (research-derived, ECMA-402 built-in):**
```typescript
const naturalFilenameCollator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });
export function sortImagesByOriginalFilename(images: readonly ImportedImage[]): ImportedImage[] {
  return [...images].sort((a, b) =>
    naturalFilenameCollator.compare(
      a.original_path.split('/').pop() ?? a.original_path,
      b.original_path.split('/').pop() ?? b.original_path,
    ));
}
```
`imageStore.toMceImages` already derives `original_filename` with the same basename pattern at `imageStore.ts:199` — copy that exact basename extraction.

**Anti-pattern (hard-locked out by D-02):** `selectedIds.sort()` over UUID v4 IDs (`image_pool.rs:57`).

---

### 6. `efxPaintStore.ts` — Background clip CRUD ops

**Analog:** `app/src/stores/efxPaintStore.ts:169-222` (`addTrack`/`renameTrack`)

**Core mutation pattern (lines 217-220, verbatim):**
```typescript
// idempotence guard
if (buildEfxPaintDocumentRevision(candidate) === buildEfxPaintDocumentRevision(document)) return { ok: true, trackId };
const next: EfxPaintDocument = { ...candidate, documentRevision: document.documentRevision + 1 };
_documents.set(layerId, next);
_notifyChange();
return { ok: true, trackId };
```

**Apply the same shape to:** `addBackgroundClip`, `moveBackgroundClip`, `setBackgroundClipRepeat`, `deleteBackgroundClip`, `setBackgroundFallback`. Each must:
1. Build candidate via pure spread (frozen doc),
2. Run start-collision verdict for create/move (return rejected + English reason; nothing written),
3. Idempotence compare via canonical revision,
4. Single revision bump,
5. Single `_notifyChange()`,
6. Record by reference in the unified undo ledger (BKG-08 — see shared pattern below).

---

### 7. `physicPaintStore.ts` — fond re-wire + hydration registration

**Analogs:**
- `physicPaintStore.ts:845-852` (`_resolveDocumentFondInstruction` — currently walks tracks by order, reads `_rotoBackgroundMetadata`; to be re-wired to consume `document.background.fallback`)
- `physicPaintStore.ts:1552-1569` (`setRotoBackgroundMetadata` idempotence lesson — a no-op write must NOT bump revision; render-loop OOM is the documented opposite failure)
- `physicPaintStore.ts:422-433` (`registerBackgroundSourceImage` registry — exactly one definition, no production caller; Phase 49 becomes the writer)
- `physicPaintStore.ts:1420-1430` (resolver's `knownSources` fail-closed check)
- `efxPaintCompositeCache.ts:125` (cache key — must gain a fallback-content term; today only `bg:${background.revision}`)

**Re-wire pattern:** both fond derivation sites (`_resolveDocumentFondInstruction` AND the monitor-inline `fondBackground` at `PhysicsPaintStudio.tsx:3073-3083`) must consume the document fallback in lockstep. Idempotence guard: a same-mode write MUST be revision-stable (per Pitfall 1 lesson). Hydration: on document register/hydrate, decode each `sourceFrameRefs` asset via `efxasset://` → `registerBackgroundSourceImage` — batched memo clears are safe (T-48-07).

---

### 8. `BackgroundAssetPickerView.tsx` (NEW — scoped variant)

**Analogs:**
- `app/src/components/import/ImportGrid.tsx:14-29` (props contract)
- `app/src/stores/imageStore.ts` (`images` signal, `importFiles(paths, projectDir)`, `getDisplayUrl` / `assetUrl`)

**ImportGrid props contract (lines 14-29, verbatim):**
```tsx
interface ImportGridProps {
  onSelect?: (imageId: string) => void;
  multiSelect?: boolean;
  selectedIds?: string[];
  onToggleSelect?: (imageId: string) => void;
  assetFilter?: 'all' | 'images-only' | 'videos-only' | 'audio-only';
  onVideoSelect?: (videoId: string) => void;
  onAudioSelect?: (audioAssetId: string) => void;
}
```

**Composition rules (per Pitfall 4):**
- Do NOT port `ImportedView` — coupled to sequence/layer/audio intents (`ImportedView.tsx:415-435`).
- Either (a) extract a lean grid core (tile + multi-select + `onToggleSelect` + `assetFilter='images-only'`) with usage badge / cascade delete / context menu OFF, or (b) wrap `ImportGrid` with a Studio-safe adapter that never reaches `sequenceStore` / `audioStore` / `getAllAssetUsages` paths.
- Studio uses strict efx-preact-reactivity rules: NO `useState` in new code; `ImportGrid`'s internal `useState` must not propagate.
- Library refresh on open via new bridge request/result pair (Pattern 3 in research).
- Confirm → `sortImagesByOriginalFilename` → `addBackgroundClip(playhead, refs)`; Cancel → unmount only.
- Engine stays mounted underneath (paused); swap is paint/visibility only.

---

### 9. `PhysicsPaintWorkflowStrip.tsx` — Bg-row rails + drag + Import button

**Analogs:**
- `app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.tsx:2056` (capsule port — `setApplyStatus('error')` forwarding)
- `app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.tsx:3692-3742` (Bg row mount)
- `app/src/components/physic-paint/view/PhysicsPaintTrackRow.tsx:447-564` (locked Bg header — `kind="background"`, muted, no reorder grab)

**Pattern:** extend Phase 43 rail-drag machinery verbatim — live preview, release-time commit, rejection publication via `setApplyStatus('error')` + capsule. Reuse the T-47-04-03 infinite-repeat visible-window bound verbatim. Do NOT re-derive clip extents from `startFrame × repeat` in the UI — pull from resolver-furnished facts (`range.truncated`, `range.partialCycle`, effective end) per Phase 47's "capsule never math" contract.

---

### 10. `PhysicsPaintStudio.tsx` — monitor checkerboard + fond consumer

**Analog:** `app/src/components/physic-paint/PhysicsPaintStudio.tsx:3050-3108` (`fondBackground` in the canvas-stack memo, line-range verified)

**Pattern (D-12 / Pitfall 1):** the monitor-inline `fondBackground` derivation duplicates the store-side `_resolveDocumentFondInstruction`. Either consume the store's instruction directly, or rewrite both to consume `document.background.fallback` identically. When the resolved fond is fully transparent (mode `'transparent'`, no clip occupying frame, no paper texture), paint a transparency-checkerboard on a monitor-only layer beneath the composite — never written to the flattened raster or export.

---

### 11. Right-panel Bg clip-properties section (NEW)

**Analogs:**
- `app/src/components/physic-paint/view/PhysicsPaintPlayScriptDialog.tsx:341,370` (numeric field + `Enter a positive integer.` hint, commit-on-Enter/blur, invalid-input-keeps-prior-value behavior)
- Existing right-panel Track section in `PhysicsPaintStudio.tsx`

**Pattern:** reuse the PlayScript numeric-input idiom for the repeat field with an explicit ∞ toggle; the badge text is `×N` / `×∞`. Show start frame, repeat, source cycle, delete. English copy everywhere. Optimistic UI forbidden — badge/rail/repeat update from accepted state only.

**Repeat pattern copy (verbatim, from `PhysicsPaintPlayScriptDialog.tsx:341`):** `"Enter a positive integer."` — keep that exact hint shape.

---

### 12. `physicPaintBridge.ts` — new image-library request/result + projectDir delivery

**Analog:** `app/src/lib/physicPaintBridge.ts:85-94` (existing pairs: `physic-paint:script-library-request/result`, `roto-authority-request/result`, `thumbnail-encode-request/result`)

**Pattern (Pattern 3 in research):** operationId-correlated `*-request` / `*-result` event pair; reject unknown payloads at the bridge boundary (`physicPaintBridge.ts:641` comment). Recommended payload: `{ images: MceImageRef[], projectDir: string }` — the launch context (`PhysicPaintProjectContext`, `types/physicPaint.ts:1670-1676`) does NOT carry `projectDir` today; the picker needs it for `importImages(paths, projectDir)` (`imageStore.ts:65`).

---

### 13. `physics-paint.json` — capability extension

**Analog:** `app/src-tauri/capabilities/default.json` (main window — already carries `dialog:allow-open`, lines 15-28)

**Pattern:** add EXACTLY ONE permission — `dialog:allow-open`. Never copy main window's broad `fs:*` grants. Justification: `48 / 45-02` precedent (10da700a) for the same class of capability fix. The `efxasset://` protocol is app-wide; no `fs` scope is needed to display library images in the picker.

---

## Shared Patterns

### Authentication / capability
**Source:** `app/src-tauri/capabilities/physics-paint.json` + comparison to `default.json`
**Apply to:** any new IPC invoked from the Studio webview
**Rule:** least privilege — exactly the named permission, app-wide custom protocol already covered by CSP (`tauri.conf.json:38`).

### Error/rejection handling
**Source:** `PhysicsPaintWorkflowStrip.tsx:2056` (`setApplyStatus('error')` port)
**Apply to:** all start-collision rejections, missing-source reports, invalid repeat input, hydration misses
```typescript
// Rejection publication: nothing written, prior state preserved, capsule shows red warning triangle.
setApplyStatus('error');
// (English reason copy from the locked 49-UI-SPEC map — never dynamic / translated)
```

### Pure document mutation (idempotence + single revision bump)
**Source:** `efxPaintStore.ts:217-220`
**Apply to:** all clip CRUD, fallback setter, repeat setter
```typescript
if (buildEfxPaintDocumentRevision(candidate) === buildEfxPaintDocumentRevision(document)) return { ok: true, trackId };
const next: EfxPaintDocument = { ...candidate, documentRevision: document.documentRevision + 1 };
_documents.set(layerId, next);
_notifyChange();
```

### Undo ledger (unified by-reference)
**Source:** `app/src/components/physic-paint/hooks/useRotoPhysicalEditHistory.ts` (Phase 46 D-01..D-03)
**Apply to:** `addBackgroundClip`, `moveBackgroundClip`, `setBackgroundClipRepeat`, `deleteBackgroundClip`, `setBackgroundFallback`
**Rule:** record by reference; raster-byte maps emptied at record; 10-level depth; clip deletion is a single-step undo (D-08, no acknowledge dialog).

### Cross-window transport (request/result event pair)
**Source:** `physicPaintBridge.ts:85-94`
**Apply to:** image-library refresh on picker open, projectDir delivery
**Rule:** operationId correlation; reject unknown payloads; main webview is the authoritative publisher.

### Resolver as single authority (anti-re-computation)
**Source:** `efxPaintBackgroundResolution.ts:76-84` (`mapFrameLoopClipToResolverClip`), `physicsPaintRotoPhysicalResolver.ts:5338-5358`
```typescript
function mapFrameLoopClipToResolverClip(clip: FrameLoopClip): PhysicPaintRotoLoopClip {
  return {
    loopId: clip.id,
    placementStart: clip.startFrame,
    sourceKeyIds: [...clip.sourceFrameRefs],
    repeat: clip.repeat.mode === 'infinite' ? 'infinity' : clip.repeat.count,
    mode: 'progressive',
  };
}
```
**Apply to:** badges, rail widths, shortened-fact displays — never recompute `startFrame × repeat`; always pull from resolver-derived `range.truncated` / `range.partialCycle` / `effectiveEnd`.

### Preact reactivity rules (Studio)
**Source:** project CLAUDE.md + `efx-preact-reactivity` skill
**Apply to:** all new components/hooks/signal writes in the Studio webview
**Rules:** no `useState` (signal in `useRef` if harness forces one); idempotent store setters; identity-stable effect deps; narrow signal reads; no render-body signal writes; loop termination. `ImportGrid.tsx`'s existing internal `useState` must not propagate into Studio code (Pitfall 4).

---

## No Analog Found

| File | Role | Data Flow | Reason |
|---|---|---|---|
| `app/src/efx-paint/utils/naturalFilenameSort.ts` | utility | transform | No natural-sort util exists in-repo (grep-verified). Use the research-recommended ECMA-402 `Intl.Collator(undefined, { numeric: true, sensitivity: 'base' })` shape; basename extraction already precedented at `imageStore.ts:199`. |
| `app/src/components/physic-paint/view/BackgroundAssetPickerView.tsx` | component (full-area swap) | request-response | The full-area canvas-region swap is new to the Studio (the `ImportedView` analog is main-editor and explicitly excluded by D-01). Compose from `ImportGrid` props + `imageStore` signals; follow efx-preact-reactivity rules. |

Both have explicit research-derived composition contracts quoted in PATTERN ASSIGNMENTS above — the planner does not need RESEARCH.md snippets.

---

## Metadata

**Analog search scope:** `app/src/efx-paint/`, `app/src/stores/`, `app/src/components/physic-paint/`, `app/src/components/import/`, `app/src/lib/`, `app/src-tauri/capabilities/`, `app/src-tauri/src/services/`
**Files scanned:** 25+ (all cited in `49-RESEARCH.md` primary sources)
**Pattern extraction date:** 2026-08-31
**Tracked-source gate:** all analog paths verified via `git ls-files`; no `.gsd/capabilities/` mirror paths used.
