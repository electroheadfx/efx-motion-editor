# Phase 44 — Signed Packaged-App UAT Evidence Record (v0.9.0)

**Plan:** 44-02 — comprehensive signed packaged-app UAT (REL-02, D-01)
**Artifact under test:** `app/src-tauri/target/release/bundle/macos/EFX Motion Editor.app` (signed, notarized, stapled, v0.9.0)
**DMG:** `app/src-tauri/target/release/bundle/dmg/EFX Motion Editor_0.9.0_aarch64.dmg` (signed, notarized, stapled)
**Freshness (D-05, Pitfall 3):** inner binary `Contents/MacOS/efx-motion-editor` mtime **Aug 21 12:30:58 2026**; `.app` dir mtime **Aug 21 12:30:57 2026** — both postdate the release run. Exactly one `_0.9.0_` DMG present. Notarization evidence `Accepted` under `bundle/dmg/notarization-evidence/`.
**Oracle:** shipped English labels/values (D-01); the Phase 43 approved expectations are the reference for the signed-artifact boundary (D-02), not a fresh spec reading.
**Mode:** one comprehensive pass (D-01); a failing step is re-runnable in isolation (reversibility).
**Date:** 2026-08-21
**Result:** **ALL 17 STEPS PASS** (user-approved)

## Pass/Fail Matrix

| # | Spec step | Expected-outcome marker | Result |
|---|-----------|-------------------------|--------|
| 1 | Icon surfaces — Finder, Dock, Applications, application switcher, mounted DMG | legible, clean transparent corners, no placeholder artwork | **PASS** |
| 2 | Open a saved project with ≥1 project script; open one parent Paint layer in EFX Paint | project opens, Paint layer opens | **PASS** |
| 3 | Do NOT click Refresh | existing script rows appear automatically; Save Script is enabled | **PASS** |
| 4 | Close/reopen EFX Paint | hydration occurs exactly once, no duplicate rows/listeners; Copy/Apply remain functional | **PASS** |
| 5 | Hear main-editor audio at the correct Paint frame | audio at correct frame | **PASS** |
| 6 | Seek, play, pause, loop, stop | no drift, no doubled audio | **PASS** |
| 7 | Disable local audio preview | main-editor audio metadata unchanged | **PASS** |
| 8 | Apply a PlayScript progressively | progressive apply works | **PASS** |
| 9 | Create a five-frame static/hold source cycle with deterministic variation; Repeat = 5 | cycle created, Repeat 5 | **PASS** |
| 10 | Timeline shows `Cycle 5f × 5 = 25f` | resolves 25 frames, stores only five linked source images | **PASS** |
| 11 | Set Repeat to infinity | loop continues to the next clip or parent end | **PASS** |
| 12 | Position the next clip to interrupt a partial cycle | label reads the SHIPPED English `Loop shortened by next clip`; no overlap occurs | **PASS** (divergence recorded — see below) |
| 13 | Move and remove the next clip | loop re-expands without regenerating its source cycle | **PASS** |
| 14 | Apply a color override | source script remains unchanged | **PASS** |
| 15 | Manual Refresh remains available and coherent after automatic hydration | Refresh available and coherent | **PASS** |
| 16 | Save, close, reopen | loop references/duration intact; preview in main editor; export works | **PASS** |
| 17 | **PHASE 43 SIGNED-ARTIFACT BOUNDARY (D-02 — never dropped)** | (a) valid linked-loop preview/export parity AND (b) unresolved-loop export block — see below | **PASS** |

## Step 12 — Truncation-label divergence (recorded, NOT a regression — D-09, Pitfall 5)

- **Spec (Phase 5 step 12):** French label `Boucle raccourcie par le clip suivant`.
- **Shipped (43-approved):** English label `Loop shortened by next clip`.
- **UAT judgment:** the step asserts the **shipped English label** as the acceptance oracle and **PASSES**. The French/spec label is recorded as a known spec-vs-implementation divergence. **No code change made** (D-09 — release-only phase).
- **No overlap** at the half-open interval boundary confirmed visually (per 43-VALIDATION coverage).

## Step 17 — Phase 43 signed-artifact boundary (D-02)

### (a) Valid linked-loop preview/export parity (43-UAT.md §16)

- Export frame count/order matches the selected range and on-screen preview. **PASS**
- Progressive and Static/Hold source cycles repeat deterministically with the authoritative non-uniform source-key cadence, including generated interiors. **PASS**
- Infinity stops at parent end; truncation stops at the canonical next boundary. **PASS**
- No valid exported frame is blank or contains an unresolved placeholder. **PASS**
- Durable source assets remain proportional to source cycles, not repetitions. **PASS**

### (b) Unresolved-loop export block (43-UAT.md §11)

- Unresolved loop remains visible/selectable with `Loop source missing`; no raw UUID becomes product name. **PASS**
- `Loop source missing` marks preview; export fails before partial output with the carried-forward actionable copy. **PASS**
- Unrepaired save/reopen preserves the unresolved record verbatim. **PASS**

## Recorded spec-vs-implementation divergences (recorded, NOT fixed — D-09)

| # | Divergence | Spec | Shipped | UAT judgment |
|---|------------|------|---------|--------------|
| 1 | Truncation label (step 12) | French `Boucle raccourcie par le clip suivant` | English `Loop shortened by next clip` | Step PASSES against the shipped English label; French recorded as known divergence |
| 2 | Chunk budget (REL-01 encoding, carried from 44-01) | 1100 kB | 1120 kB (`viteBuild.test.ts:138`) | Gate PASSES against the shipped 1120 budget; spec-1100 recorded as known divergence |

## User approval

The user typed **"approved"** — all 17 steps of the signed packaged-app UAT passed in the packaged v0.9.0 app, including step 12 (English label `Loop shortened by next clip`) and step 17 (Phase 43 signed-artifact boundary: valid linked-loop preview/export parity AND unresolved-loop export block).

## Hard boundaries respected

- No functional source file changed (D-09 — release-only phase).
- No Apple credential file accessed, opened, or searched.
- No dev server started; no Vitest watch mode.
- No code change made for either recorded divergence.
