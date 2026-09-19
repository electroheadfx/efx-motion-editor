# Phase 52: Shared Mask Compositor and Reveal - Research

**Researched:** 2026-09-02
**Domain:** Bake-into-keys Reveal (4th rail kind on the single internal Paint track type) — Preact + @preact/signals, Tauri desktop app
**Confidence:** HIGH

## Summary

Phase 52 delivers the **Reveal** as the **4th rail kind** (`reveal/motion` + `reveal/static`) on the single internal Paint track type. The user's hard re-orientation (CONTEXT.md D-01) **supersedes the spec's "one offscreen source-plus-mask compositor"**: a Reveal does NOT dynamically mask the photo at composite time. Instead, **Replay bakes** the photo reference (as placed on the canvas, Phase 50 transform) into **real track keys** over a rail span, using the existing pixel-cache/key machinery with interpolation. After generation the keys are ordinary track content — editable, interpolatable, undoable — rendered by the unchanged shared compositor path. Studio preview, flattened output, and export all read the same keys (D-02), so RVL-04 becomes trivial and the Pitfall-8 divergence risk is closed by construction.

The bake reuses the existing PlayScript render pipeline almost verbatim: `physicsPaintRotoPlayScriptRenderer.ts` already runs `buildProgressiveStrokeSchedule`/`buildStaticStrokeSchedule` → `getProgressiveFrameStrokes`/`getStaticFrameStrokes` → `engine.renderProgressiveAlphaFrame(frameStrokes)` to produce a **coverage alpha canvas** per frame. The only genuinely new work is the **bake-time mask step**: instead of merging the script alpha onto existing frames (PlayScript's additive behavior), the reveal bake draws the reference image (as placed, at full source opacity — D-18) and applies the coverage alpha as a `destination-in` mask, producing keys that carry reference pixels where coverage is and transparency elsewhere (D-17, RVL-02 semantics become generation-time). The result is committed as ordinary `PhysicPaintRotoRealKeyRecord`s through the existing acknowledged physical-edit transaction.

**Primary recommendation:** Model the reveal rail as a `FrameLoopClip`-shaped record (a new `sourceKind`/variant on the existing Loop Clip machinery, or a sibling record) that references the library script by ID and carries a `mode` (`progressive`/`static`) plus the Loop Clip lifecycle fields; implement the bake as a new render function that consumes the existing coverage-alpha path and applies a `destination-in` reference mask; route create/replay/delete/span-edit through the existing `BackgroundEditDescriptor`-style undo-by-reference ledger.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Reveal rail kind schema (4th kind, variant, script ref, lifecycle) | Database/Storage (pure model) | — | `efxPaintDocument.ts` + `physicsPaintRotoPhysicalModel.ts` own the closed field-level schema; parsers are fail-closed allowlists |
| Bake render (coverage alpha → reference mask → PNG keys) | API/Backend (render engine) | — | `physicsPaintRotoPlayScriptRenderer.ts` + `EfxPaintEngine.renderProgressiveAlphaFrame` own the per-frame render; the new mask step is a sibling render function |
| Create/Replay/Delete/Span-edit mutations + undo | API/Backend (reactive store) | — | `efxPaintStore.ts` owns document mutations + the `BackgroundEditDescriptor` undo ledger; `physicPaintStore.ts` owns the physical commit + `_resolveReferenceSourceImage` |
| Rail surface (color, status dot, tooltip freshness, Regenerate control) | Browser/Client (UI) | — | `PhysicsPaintLoopClipRail.tsx` + `physicsPaintLoopClipPresentation.ts` own the rail surface the reveal rail reuses |
| "Reveal with script…" modal entry | Browser/Client (UI) | — | `PhysicsPaintPhotoReferenceDialog.tsx` gains the entry; creation IS the bake (D-11) |
| Baked keys → flattened output | API/Backend (compositor) | — | `efxPaintCompositor.ts` unchanged; baked keys are ordinary track content (D-02) |

## Standard Stack

This phase installs **zero external packages**. It is a code-only phase that reuses existing internal machinery. The "stack" is the set of internal modules the reveal rail builds on:

### Core (internal modules — the reveal rail's reuse anchors)
| Module | Role | Why Standard |
|--------|------|--------------|
| `physicsPaintRotoPlayScriptRenderer.ts` | Per-frame progressive/static render + `renderProgressiveAlphaFrame` coverage path | The bake's reuse anchor (CONTEXT.md canonical ref) — already produces the coverage alpha the reveal consumes |
| `progressiveStrokeSchedule.ts` / `staticStrokeSchedule.ts` (`@efxlab/efx-physic-paint/animation`) | Coverage schedules | The bake reads these to know where to copy reference pixels |
| `physicsPaintRotoPhysicalModel.ts` | `PhysicPaintRotoLoopClip`, `PhysicPaintRotoRealKeyRecord`, `PhysicPaintRotoPhysicalDocument` | The durable key/loop schema the reveal rail mirrors |
| `efxPaintDocument.ts` / `efxPaintDocumentParsers.ts` | `InternalPaintTrack`, `FrameLoopClip`, `PhotoReferenceTrack` | The v1.0 document schema the 4th rail kind extends |
| `efxPaintStore.ts` | Document mutations + `BackgroundEditDescriptor` undo ledger | The undo-by-reference pattern (RVL-06) |
| `physicPaintStore.ts` | `_resolveReferenceSourceImage`, `getFlattenedFrame`, physical commit | The reference resolution + flattened seam the bake uses |
| `efxPaintCompositor.ts` | Shared composite path | Baked keys flow through unchanged (D-02) |
| `PhysicsPaintLoopClipRail.tsx` + `physicsPaintLoopClipPresentation.ts` | Rail surface, `overrideColor`, `regenerateDisabledReason`, lifecycle dot | The reveal rail reuses these verbatim (D-22/D-23/D-24) |
| `PhysicsPaintPhotoReferenceDialog.tsx` | Photo-reference modal | Gains the "Reveal with script…" entry (D-16/D-19) |

### Supporting
| Module | Role | When to Use |
|--------|------|-------------|
| `physicsPaintRotoScriptLibrary.ts` | Durable SCRIPTS library (referenced by ID) | Rail references the script by ID (D-10); `loadSnapshot(id)` for the bake |
| `physicsPaintRotoAlphaMerge.ts` | `mergeRotoAlphaCanvases` | The PlayScript merge the reveal bake REPLACES with a mask step |
| `PhysicsPaintReferenceGhost.ts` / `PhysicsPaintReferenceTransform.ts` | Reference "as placed" draw + transform geometry | The bake sources the reference transform (D-14); needs a full-opacity variant |
| `physicsPaintRotoGroupLifecycle.ts` | Group lifecycle (syncState/provenanceState) | The reveal rail's freshness state (D-23) mirrors it |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| New `reveal` rail record type | Reuse `FrameLoopClip` with a new `sourceKind` | A new record is cleaner but duplicates the loop lifecycle; a `FrameLoopClip`-shaped variant reuses repeat/span/lifecycle for free (Claude's discretion — CONTEXT.md) |
| Runtime mask compositor (spec §Phase 8) | Bake-into-keys (D-01) | Superseded — the runtime compositor is explicitly deferred; bake is the locked model |
| New custom Replay button | Loop Clip Regenerate control | D-24 locks reuse of the Regenerate placement/interaction/disabled-reason |

**Installation:** none — no external packages.

**Version verification:** N/A — no external packages. All modules are in-repo and were read this session.

## Package Legitimacy Audit

> Not applicable — this phase installs no external packages. All dependencies are in-repo modules verified by reading their source this session.

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

## Architecture Patterns

### System Architecture Diagram

```
                    ┌─────────────────────────────────────────────────────────┐
                    │  Authoring (D-16): place reference → paint strokes →    │
                    │  save as library script (ordinary paint, NOT a preview) │
                    └───────────────────────────┬─────────────────────────────┘
                                                │
                    ┌───────────────────────────▼─────────────────────────────┐
                    │  "Reveal with script…" (modal) OR track rail-creation   │
                    │  flow → create reveal rail (variant from script kind)   │
                    └───────────────────────────┬─────────────────────────────┘
                                                │  creation IS the first bake (D-11)
                    ┌───────────────────────────▼─────────────────────────────┐
                    │  BAKE (Replay) — one pass over the rail span            │
                    │  1. library.loadSnapshot(scriptId)                      │
                    │  2. buildProgressive/StaticStrokeSchedule(strokes, N)   │
                    │  3. per frame: getProgressive/StaticFrameStrokes →       │
                    │     engine.renderProgressiveAlphaFrame → coverage alpha │
                    │  4. NEW: draw reference (as placed, full opacity) then │
                    │     apply coverage alpha as destination-in mask         │
                    │  5. encodeRotoFrameFromCanvas → PhysicPaintRotoRealKey  │
                    └───────────────────────────┬─────────────────────────────┘
                                                │  commit via existing acknowledged
                                                │  physical-edit transaction
                    ┌───────────────────────────▼─────────────────────────────┐
                    │  Baked keys = ordinary track content (rotoPhysical)      │
                    │  → unchanged efxPaintCompositor → getFlattenedFrame      │
                    │  → Studio preview / flattened output / export (D-02)    │
                    └─────────────────────────────────────────────────────────┘

  Fail-closed guards (D-12/D-13): no placed reference OR deleted script →
    status-capsule red warning, NO keys written, existing keys untouched.
  Replay overwrite (D-05): span becomes exactly what the script now produces;
    one undo-ledger entry restores the prior keys (RVL-06).
```

### Recommended Project Structure (new/changed files)
```
app/src/
├── efx-paint/document/
│   ├── efxPaintDocument.ts            # + reveal rail kind (or FrameLoopClip sourceKind)
│   └── efxPaintDocumentParsers.ts     # + reveal rail parse (fail-closed allowlist)
├── components/physic-paint/roto/
│   ├── physicsPaintRotoPlayScriptRenderer.ts   # + reveal bake render fn (mask step)
│   └── physicsPaintRotoPhysicalModel.ts        # + reveal rail record (if new record)
├── components/physic-paint/view/
│   ├── PhysicsPaintPhotoReferenceDialog.tsx    # + "Reveal with script…" entry
│   ├── PhysicsPaintLoopClipRail.tsx            # + reveal rail variant (color/tooltip)
│   └── physicsPaintLoopClipPresentation.ts    # + reveal freshness tooltip line
└── stores/
    ├── efxPaintStore.ts                        # + create/replay/delete/span mutations + undo
    └── physicPaintStore.ts                     # + reveal bake commit + reference read
```

### Pattern 1: Bake-time mask (the one genuinely new render step)
**What:** The reveal bake reuses the PlayScript coverage path but replaces the `mergeRotoAlphaCanvases` step with a reference-mask composite. The engine already uses `globalCompositeOperation = 'destination-out'` for erase; the reveal mask is the inverse — `destination-in` keeps reference pixels only where the coverage alpha is non-zero.
**When to use:** Every reveal bake frame (both variants — D-09 bakes per-frame for both).
**Example (conceptual — the exact function is a new sibling of `renderRotoPlayScriptFrames`):**
```typescript
// Source: physicsPaintRotoPlayScriptRenderer.ts:84-90 (existing coverage path)
scriptAlpha = engine.renderProgressiveAlphaFrame(frameStrokes); // coverage alpha canvas
// NEW reveal step (replaces mergeRotoAlphaCanvases):
//   ctx.drawImage(referenceImage, /* as-placed transform, full opacity */);
//   ctx.globalCompositeOperation = 'destination-in';
//   ctx.drawImage(scriptAlpha, 0, 0);
//   → reference pixels where coverage is, transparent elsewhere (D-17)
```

### Pattern 2: Undo-by-reference via `BackgroundEditDescriptor`
**What:** Every committed reveal mutation (create/replay/delete/span-shrink) emits a `BackgroundEditDescriptor` (`operationId`, `operationKind`, `before`, `after` — exact document objects by reference). Undo restores `before`, redo re-applies `after`. No raster-byte snapshots (RVL-06).
**When to use:** Create rail (first bake), Replay (overwrite), delete rail, span shrink.
**Example:**
```typescript
// Source: efxPaintStore.ts:568-573 (BackgroundEditDescriptor shape)
export interface BackgroundEditDescriptor {
  readonly operationId: string;
  readonly operationKind: BackgroundEditOperationKind; // + new 'reveal-*' kinds
  readonly before: EfxPaintDocument;
  readonly after: EfxPaintDocument;
}
```

### Pattern 3: Fail-closed guards (D-12/D-13)
**What:** Replay is fail-closed when the reference was removed after creation or the library script was deleted. The status capsule (`setApplyStatus('error')`) surfaces a red warning; existing baked keys are untouched; no silent re-bake.
**When to use:** Replay preflight, before any key write.

### Anti-Patterns to Avoid
- **Runtime mask compositor:** explicitly superseded (D-01) — do NOT implement an offscreen source-plus-mask compositor.
- **Live "photo-through-strokes" preview:** explicitly deferred — the reveal is only visible after the bake.
- **Per-key hand-modification/dirty-flag tracking:** D-05 forbids it — replay overwrites the whole span; recovery is via undo, not partial refresh.
- **`PhotoReferenceMode` flag:** D-15 removes it entirely (clean break) — do NOT keep it as a semantic marker.
- **A second compositor path:** D-02 — baked keys flow through the one shared `efxPaintCompositor`; never add a reveal-specific render path.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Per-frame stroke coverage | A new coverage scheduler | `buildProgressiveStrokeSchedule` / `buildStaticStrokeSchedule` + `getProgressiveFrameStrokes` / `getStaticFrameStrokes` | Already the canonical progressive/static coverage; the reveal bake consumes it verbatim |
| Coverage alpha render | A new alpha renderer | `EfxPaintEngine.renderProgressiveAlphaFrame` | Returns paint alpha without paper/preview background — exactly the mask the reveal needs |
| Reference "as placed" transform | A new transform math | `getReferenceBounds` + `drawReferenceGhost` (full-opacity variant) | The locked Phase 50 transform (position/scale/rotation) is already computed here |
| Undo/redo | Raster-byte snapshots | `BackgroundEditDescriptor` ledger (by reference) | RVL-06; the document carries sidecar refs, never raster bytes |
| Rail color system | A second color mechanism | Loop Clip `overrideColor` (43-06) | D-22 — one color system, not two |
| Replay affordance | A new custom button | Loop Clip Regenerate control + `regenerateDisabledReason` | D-24 — same placement/interaction/disabled-reason |
| Repeat/endless derivation | Durable duplication of repeated frames | Existing loop resolver (read-time derivation) | D-08 — repeats derived at read time, never written |

**Key insight:** The reveal is a *generation-time* operation, not a *composite-time* one. Every hard problem (mask evaluation, soft edges, eraser, progressive vs static) is already solved by the existing PlayScript render + key machinery; the only new code is the reference-mask composite and the rail record/surface.

## Common Pitfalls

### Pitfall 1: Premultiplied vs straight alpha at the bake boundary
**What goes wrong:** If the bake produces premultiplied alpha, the flattened raster (which carries STRAIGHT/unmultiplied alpha at the main-editor boundary, Phase 48 D-02) will double-darken edges.
**Why it happens:** `destination-in` masking can leave premultiplied RGB in semi-transparent edge pixels.
**How to avoid:** Encode baked keys as straight-alpha PNGs (the existing `encodeRotoFrameFromCanvas` path already does this); verify the mask step does not premultiply.
**Warning signs:** Dark halos on soft reveal edges in flattened output vs Studio preview.

### Pitfall 2: Reference leak into output (RVL-05)
**What goes wrong:** Photo pixels reach flattened output through a path other than reveal keys.
**Why it happens:** The Phase 50 ghost draw (`drawReferenceGhost`) is a monitor-paint-only surface; if the bake accidentally reads the composited preview instead of the reference-as-placed, preview overlays leak in.
**How to avoid:** The bake reads `_resolveReferenceSourceImage` (the frame-aligned reference verdict) + the reference transform, NEVER the composited preview. Keep the Phase 50 D-06 token allow-list scan (four raster surfaces must not contain reference-input tokens) extended to the new bake path.
**Warning signs:** Reference visible in export without a reveal rail.

### Pitfall 3: Script has no intrinsic "kind" (D-10/D-21 filter)
**What goes wrong:** The CONTEXT.md says the SCRIPTS picker is "filtered by kind (progressive for reveal/motion, static/hold for reveal/static)", but the script schema carries no kind.
**Why it happens:** `RotoScriptLibraryRow` and `PersistedRotoScriptV1` have no `mode`/`kind` field — the progressive/static mode is chosen at Play Script Apply time (the dialog's `mode` signal), not stored on the script.
**How to avoid:** Treat the rail's variant as the render mode (fixed at creation, D-21); the "kind filter" is effectively a no-op on the picker (scripts are kind-agnostic) — the variant constrains the bake's render mode, not the script selection. Flag for user confirmation (see Open Questions).
**Warning signs:** Attempting to filter the picker by a field that does not exist.

### Pitfall 4: Replay overwrite losing hand edits (D-05)
**What goes wrong:** Replay replaces hand edits (eraser/paint) within the span, surprising the user.
**Why it happens:** D-05 locks "replay overwrites every baked key in the span" — no per-key dirty tracking.
**How to avoid:** Recovery, not preservation: one undo restores the prior keys; to keep hand edits durably while replaying, drag the rail (with keys) to another track first. Surface this in the tooltip/status.
**Warning signs:** User reports "my eraser edits vanished after Replay".

### Pitfall 5: Span editing law (D-07)
**What goes wrong:** Shortening the rail leaves orphan keys outside the span, or stretching auto-fills frames.
**Why it happens:** Rail content must equal rail span always.
**How to avoid:** Shorten deletes outside keys (undo recovers); stretch leaves new frames empty until a voluntary Replay. No orphan content, no auto-fill.

## Code Examples

### Reveal bake frame (the new mask step)
```typescript
// Source: physicsPaintRotoPlayScriptRenderer.ts:84-90 (existing coverage path)
// The reveal bake reuses this loop but replaces mergeRotoAlphaCanvases:
scriptAlpha = engine.renderProgressiveAlphaFrame(frameStrokes); // coverage alpha
// NEW: reference-mask composite (destination-in) instead of additive merge
```

### Reference "as placed" transform (the bake's source geometry)
```typescript
// Source: PhysicsPaintReferenceTransform.ts:20-51 (getReferenceBounds)
// cx = canvasWidth/2 + transform.x * zoom; cy = canvasHeight/2 + transform.y * zoom
// hw = (w/2) * transform.scaleX; hh = (h/2) * transform.scaleY; rotate by rotation
// The bake draws the reference at FULL opacity (D-18) with this same transform.
```

### Frame-aligned reference resolution (the bake's source input)
```typescript
// Source: physicPaintStore.ts:1224-1232 (_resolveReferenceSourceImage)
// frame N → sourceFrameRefs[N], clamped at sequence end; missing ref → null (fail-closed)
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Offscreen source-plus-mask compositor (spec §Phase 8) | Bake-into-keys reveal (D-01) | This phase (2026-09-02) | No runtime mask evaluation; keys are ordinary track content |
| `PhotoReferenceMode` flag (`reference-only`/`reveal-source`/`masked-transform-source`) | Removed entirely (D-15) | This phase | v1.0 schema change; clean break (Phase 45 no-compat) |
| PlayScript additive merge (`mergeRotoAlphaCanvases`) | Reveal reference-mask (`destination-in`) | This phase | The reveal replaces the span with reference pixels, not additive paint |

**Deprecated/outdated:**
- The spec's "one offscreen source-plus-mask compositor" — superseded by D-01; do NOT implement.
- The Phase 50 `PhotoReferenceMode` flag — removed (D-15), not kept as a semantic marker.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The reveal bake applies the coverage alpha as a `globalCompositeOperation = 'destination-in'` mask over the reference image (the engine already uses `destination-out` for erase, so `destination-in` is the natural inverse) | Architecture Patterns / Code Examples | Low — the exact composite op needs a spike, but the approach is clear and the engine already demonstrates the pattern |
| A2 | The reveal rail maps onto a `FrameLoopClip`-shaped record (new `sourceKind`/variant) rather than a wholly new record type | Architecture Patterns | Medium — Claude's discretion; the exact store/document shape is open and affects the parser + compositor |
| A3 | Reveal baked keys share the per-track `paintVersion`/revision bump and flattened cache-key rules as ordinary track content | Architecture Patterns | Low — CONTEXT.md expects "yes, they are ordinary keys"; if wrong, cache invalidation breaks |
| A4 | The "kind-filtered picker" (D-10/D-21) cannot filter by an intrinsic script kind because scripts carry no `mode`/`kind` field; the variant is the render mode, fixed at creation | Common Pitfalls / Open Questions | Medium — if the user expects a real kind filter, the script schema must gain a kind field (a schema change) |

## Open Questions (RESOLVED)

1. **Script "kind" for the D-10/D-21 picker filter** — **RESOLVED** (D-26 in CONTEXT.md): the SCRIPTS picker is UNFILTERED; scripts carry no `mode`/`kind` field, so the variant is a creation-time rail property, not a script property. No script-schema change.
   - What we know: `RotoScriptLibraryRow` and `PersistedRotoScriptV1` carry no `mode`/`kind` field (verified this session); the progressive/static mode is chosen at Play Script Apply time, not stored on the script.
   - Resolution: D-26 locks the picker as unfiltered and the variant as a creation-time choice; "no mismatch states" (D-10) is amended because scripts have no kind.

2. **Exact rail record shape (Claude's discretion)** — **RESOLVED** (Plan 01 assumption_delta_decision): the reveal rail is a `PhysicPaintRotoLoopClip`-shaped record with an optional `railKind?: 'playscript' | 'reveal'` discriminator (defaulting to `'playscript'` for existing records — no migration, no new record type); the `mode` field is reused for the variant.
   - What we know: `FrameLoopClip` (document-level, `sourceKind: 'playscript-hold' | 'imported-background'`) and `PhysicPaintRotoLoopClip` (physical-level, `mode: 'progressive' | 'static'` + lifecycle) are the two candidate shapes.
   - Resolution: Plan 01 records the identity-model generalization — a new member of the existing `PhysicPaintRotoLoopClip` family, discriminated by `railKind`, not a separate record type or track type.

3. **Key density/deduplication for the reveal/motion per-frame bake (D-09, Claude's discretion)** — **RESOLVED** (Claude's discretion, CONTEXT.md): key density/deduplication is Claude's discretion; follow the existing PlayScript behavior (one key per frame, no dedup) unless the user specifies otherwise.
   - What we know: `reveal/motion` bakes a key per frame across the span; interpolation uses the existing Roto physical key machinery.
   - Resolution: one key per frame, no dedup; the interpolation machinery already handles the read side.

## Environment Availability

> Skipped — this phase has no external dependencies (code/config-only changes reusing in-repo modules). No new tools, services, runtimes, or packages are required.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest (project-local, `pnpm --filter efx-motion-editor exec vitest run`) |
| Config file | existing `vitest` config (no new config — per project rule "no test config hacks") |
| Quick run command | `pnpm --filter efx-motion-editor exec vitest run <file>` |
| Full suite command | `pnpm --filter efx-motion-editor exec vitest run` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| RVL-01 (superseded) | Bake-into-keys, no runtime compositor | unit | `vitest run <reveal-bake-test>` | ❌ Wave 0 |
| RVL-02 (generation-time) | Empty coverage → transparent; full → full reference; partial → soft edges; eraser removes | unit | `vitest run <reveal-mask-test>` | ❌ Wave 0 |
| RVL-03 | Progressive bakes progressively; static bakes full coverage per frame | unit | `vitest run <reveal-variant-test>` | ❌ Wave 0 |
| RVL-04 | Baked keys are ordinary track content in flattened output | integration | `vitest run <reveal-compositor-test>` | ❌ Wave 0 |
| RVL-05 | Reference never leaks into output except via reveal keys | unit (token allow-list) | `vitest run <reveal-leak-contract-test>` | ❌ Wave 0 |
| RVL-06 | Undo/redo by reference; save/reopen/export preserve | unit + round-trip | `vitest run <reveal-undo-roundtrip-test>` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `pnpm --filter efx-motion-editor exec vitest run <touched-test-file>`
- **Per wave merge:** `pnpm --filter efx-motion-editor exec vitest run`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `app/src/components/physic-paint/roto/physicsPaintRotoRevealBake.test.ts` — covers RVL-01/RVL-02/RVL-03 (bake mask + variant semantics)
- [ ] `app/src/stores/efxPaintStore.reveal.test.ts` — covers RVL-06 (create/replay/delete/span undo by reference)
- [ ] `app/src/efx-paint/document/efxPaintDocumentParsers.reveal.test.ts` — covers the reveal rail parse round-trip
- [ ] `app/src/efx-paint/compositor/efxPaintRevealLeakContract.test.ts` — covers RVL-05 (token allow-list over the four raster surfaces)

## Security Domain

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | — (desktop app, no auth surface) |
| V3 Session Management | no | — |
| V4 Access Control | yes | Fail-closed guards (D-12/D-13): replay refuses without a placed reference / with a deleted script; no partial write |
| V5 Input Validation | yes | Fail-closed parsers (`parseEfxPaintDocument`, `parsePhysicPaintRotoLoopClips`) — exact allowlists, no normalization, no ID allocation |
| V6 Cryptography | no | — (no crypto in this phase) |

### Known Threat Patterns for this stack
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Reference pixels leak into flattened output (RVL-05) | Information disclosure | Bake-time guarantee: photo pixels reach output ONLY through reveal keys; token allow-list scan over the four raster surfaces |
| Malformed reveal rail record in a saved document | Tampering | Fail-closed parser allowlist; unknown members rejected; no silent normalization |
| Replay writes keys on a stale document (async race) | Tampering | Existing acknowledged physical-edit transaction revalidates revision before commit (TRK-05) |
| Deleted script / removed reference → silent re-bake | Denial of service / integrity | Fail-closed: status-capsule red warning, existing keys untouched (D-12/D-13) |

## Sources

### Primary (HIGH confidence — read this session)
- `app/src/efx-paint/document/efxPaintDocument.ts` — `PhotoReferenceMode`, `PhotoReferenceTrack`, `InternalPaintTrack`, `FrameLoopClip`, `EfxPaintDocument`
- `app/src/efx-paint/document/efxPaintDocumentParsers.ts` — fail-closed parser, `PHOTO_REFERENCE_MODES` allowlist
- `app/src/components/physic-paint/roto/physicsPaintRotoPhysicalModel.ts` — `PhysicPaintRotoLoopClip`, `PhysicPaintRotoRealKeyRecord`, `PhysicPaintRotoPhysicalDocument`, lifecycle fields
- `app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.ts` — `RotoPlayScriptMode`, commit/authority flow
- `app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptRenderer.ts` — `renderRotoPlayScriptFrames`, `renderProgressiveAlphaFrame` coverage path
- `packages/efx-physic-paint/src/animation/progressiveStrokeSchedule.ts` + `staticStrokeSchedule.ts` — coverage schedules
- `packages/efx-physic-paint/src/engine/EfxPaintEngine.ts` — `renderProgressiveAlphaFrame` (returns paint alpha, no paper/preview)
- `app/src/components/physic-paint/roto/physicsPaintRotoAlphaMerge.ts` — the merge the reveal replaces
- `app/src/components/physic-paint/roto/physicsPaintRotoScriptSchema.ts` + `physicsPaintRotoScriptClipboard.ts` — script schema (no `mode`/`kind` field)
- `app/src/stores/efxPaintStore.ts` — photo-reference mutations, `BackgroundEditDescriptor` undo ledger
- `app/src/stores/physicPaintStore.ts` — `_resolveReferenceSourceImage`, `getFlattenedFrame`
- `app/src/components/physic-paint/view/PhysicsPaintLoopClipRail.tsx` + `physicsPaintLoopClipPresentation.ts` — rail surface, `overrideColor`, `regenerateDisabledReason`, lifecycle
- `app/src/components/physic-paint/view/PhysicsPaintPhotoReferenceDialog.tsx` — the modal entry point
- `app/src/components/physic-paint/view/PhysicsPaintReferenceGhost.ts` + `PhysicsPaintReferenceTransform.ts` — reference "as placed" draw + transform
- `app/src/efx-paint/compositor/efxPaintCompositor.ts` — straight-alpha boundary, shared composite path

### Secondary (MEDIUM confidence)
- `.planning/phases/52-shared-mask-compositor-and-reveal/52-CONTEXT.md` — D-01..D-25 locked decisions (the authoritative scope)
- `.planning/phases/52-shared-mask-compositor-and-reveal/52-UI-SPEC.md` — approved UI contract (colors, copy, state coverage)

### Tertiary (LOW confidence)
- `.planning/research/PITFALLS.md` — Pitfall 7 (premultiplied alpha), Pitfall 8 (divergence), Pitfall 14 (reference leak), Pitfall 16 (preview overlay isolation) — referenced, not re-read this session

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all modules are in-repo and were read this session; no external packages
- Architecture: HIGH — the bake model maps directly onto verified existing machinery
- Pitfalls: HIGH — verified against code (script schema absence, straight-alpha boundary, fail-closed parsers)

**Research date:** 2026-09-02
**Valid until:** 2026-09-16 (stable — in-repo machinery, no fast-moving external deps)
