---
phase: quick-261012-c9a
plan: 261012-c9a
subsystem: persistence
tags: [efx-paint, persistence, save-fingerprint, change-token, display-preferences, tdd]

# Dependency graph
requires:
  - phase: 260922-rd4 (background transform) + 261008-ig1 (audios layer token)
    provides: "the `|bgT:` / `|audios:` token precedents and the display-preference encoders this quick grows"
provides:
  - all three change-detection carriers (layer change token, save fingerprint, sync fingerprint) rotate on every photo-reference and background display-class edit
  - "`encodeCanonicalPhotoReferenceDisplay` exported (single photo-display encoder)"
  - "`encodeCanonicalBackgroundDisplay` composer (background transform + lock, delegating to the bare transform encoder)"
  - save-twice on-disk regression suite for the six display fields (PKG-06 / BKG-09 proof)
affects: [261012-c9b, 261012-c9c, native UAT, v1.0.1]

# Actuals (#2632)
actuals:
  tokens: 9174
  tasks: 2
  commits: 2

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "display-carrier vs revision-carrier split: display prefs excluded from BOTH revision legs, carried instead by three dedicated fingerprint terms"
    - "single-encoder composer: encodeCanonicalBackgroundDisplay delegates to encodeCanonicalBackgroundTransform (bare encoder feeds ONLY bgtransform:)"
    - "save-twice regression idiom: save #1 settles the baseline fingerprints, clear recorders, save #2 asserts"
key-files:
  created:
    - app/src/efx-paint/document/efxPaintDisplaySaveToken.test.ts
  modified:
    - app/src/efx-paint/document/efxPaintDocumentRevision.ts
    - app/src/lib/efxPaintPersistence.ts
    - app/src/efx-paint/document/efxPaintDocumentRevision.test.ts
    - app/src/lib/efxPaintPackageRoundTrip.test.ts

key-decisions:
  - "One composer, three call sites: encodeCanonicalBackgroundDisplay (bare transform + '|' + lock boolean) is called by the sync fingerprint, the layer change token and the save fingerprint; encodeCanonicalBackgroundTransform stays byte-identical and feeds ONLY the flattened cache key bgtransform:, so a lock flip never rebakes the composite (T-261012-C9A-02)."
  - "The layer change token takes the PARSED DOCUMENT as its third parameter (audios array parameter retired) — one document argument carries audios + background display + photo display; term order pinned: |audios: then |bgT: then |photoDisplay:."
  - "documentRevision and compositeRevision were NOT widened (D-07 vs D-11/D-12/D-13 preserved); every new unit case asserts both legs byte-identical across each display edit, so a future widening fails loudly."
  - "Delimiter inside the composer is '|': the bare transform encoding is digits-only, so transform + '|' + boolean is injective; audios remains the LAST sync-fingerprint term (t2 pin holds)."

requirements-completed: [SAVE-01, SAVE-02, SAVE-03]

coverage:
  - id: D1
    description: "Display-class edits (photo visible/opacity/transform/lock, background transform/lock) rotate the layer change token, save fingerprint and sync fingerprint, so the second save rewrites layers/<layerId>.json and reopen holds the edit — six cases, unit + on-disk"
    requirement: SAVE-02
    verification:
      - kind: unit
        ref: "app/src/efx-paint/document/efxPaintDisplaySaveToken.test.ts — six `(case)` rotation legs + encoder pins"
        status: pass
      - kind: integration
        ref: "app/src/lib/efxPaintPackageRoundTrip.test.ts — describe('display-class edits survive save-close-reopen (261012-c9a)') six save-twice cases"
        status: pass
    human_judgment: false
  - id: D2
    description: "Background transform-only and background lock-only edits each rotate the authoritative token so the second save rewrites the layer sub-file and reopen holds it (PKG-06 / BKG-09 close)"
    requirement: SAVE-01
    verification:
      - kind: integration
        ref: "app/src/lib/efxPaintPackageRoundTrip.test.ts — background-transform + background-lock save-twice cases"
        status: pass
      - kind: unit
        ref: "app/src/efx-paint/document/efxPaintDisplaySaveToken.test.ts — (background-transform)/(background-transformLocked) legs"
        status: pass
    human_judgment: false
  - id: D3
    description: "Save-twice regression suite: every case saves twice (the first save masks the bug) and fails against the pre-fix builders"
    requirement: SAVE-03
    verification:
      - kind: unit
        ref: "RED commit ac276b21 — 14/15 new legs failed pre-fix, all six on-disk cases failed with EMPTY changedFiles; 17 pre-existing cases still passed"
        status: pass
    human_judgment: false
  - id: D4
    description: "Native save → close → reopen UAT: four rows (photo display, background transform, background lock, no-op save) on the real app before Quick 2 is dispatched"
    requirement: SAVE-01
    verification: []
    human_judgment: true
    rationale: "Live native WKWebView/Tauri surface — vitest is blind to it (DOM-fallback branch), no Chrome DevTools MCP per project rules; the user owns this UAT and this quick deliberately STOPS after it."

# Metrics
duration: 10min
completed: 2026-10-12
status: complete
audit_acknowledged:
  milestone: v1.0.1
  at: 2026-10-14
  status: complete
---

# Phase quick-261012-c9a: Display-class Save Token Summary

**Photo/background display prefs now rotate the layer change token, save fingerprint and sync fingerprint (one photo-display encoder + one background-display composer), so display-only edits survive save → close → reopen instead of silently reverting (PKG-06 / BKG-09).**

## Performance

- **Duration:** ~10 min
- **Started:** 2026-10-12T07:02:48Z
- **Completed:** 2026-10-12T07:12:49Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments

- Exported `encodeCanonicalPhotoReferenceDisplay` unchanged and added `encodeCanonicalBackgroundDisplay(background)` = bare transform encoding + `|` + lock boolean — the composer DELEGATES to `encodeCanonicalBackgroundTransform` (single-encoder law T-49-03-02); the bare encoder is byte-identical and now feeds ONLY the flattened cache key `bgtransform:`.
- Grew `buildEfxPaintLayerChangeTokenValue` to take the parsed document and appended `|bgT:` + `|photoDisplay:` after `|audios:` — the authoritative `layers/<layerId>.json` write gate (the PKG-06 loss point) sees every display-class field.
- Extended `buildEfxPaintSaveFingerprint` with the composer `|bgT:` + a new `|photoDisplay:` term (the derived-frame cache leg's dedupe no longer swallows display edits), and swapped the sync fingerprint's `|bgDisplay:` to the composer (audios stays LAST).
- Landed a save-TWICE unit + on-disk regression suite: six display fields × (three carriers rotate, both revision legs stay byte-identical) plus six real-temp-dir cases asserting save #2 rewrites the layer sub-file, publishes the cache leg, and reopen holds the edit.
- Neither revision carrier was widened: `buildEfxPaintDocumentRevision` and `buildEfxPaintCompositeRevision` are pinned byte-identical across every display edit (D-07 vs D-11/D-12/D-13 preserved).

## RED Evidence (SAVE-03)

Task 1 landed test-only first (`ac276b21`) and was captured failing against the pre-fix builders:

| Leg | Pre-fix outcome |
|---|---|
| `(encoders)` both new exports exist | FAIL — photo encoder module-private, background composer absent |
| `(single-encoder)` bare encoder byte-identical across a lock-only change | PASS by design (non-regression pin, holds pre- and post-fix) |
| `(single-encoder)` composer appends the lock | FAIL — composer absent |
| 4 photo cases + background-lock case (unit) | FAIL at the save-fingerprint leg (no `|photoDisplay:` / lock blind `|bgT:`) |
| background-transform case (unit) | FAIL at the token leg — `TypeError: audios.map is not a function` (document passed where the audios ARRAY was expected; the plan's expected hard red) |
| 6 on-disk save-twice cases | FAIL at layer-file containment: `expected [] to include 'layers/<rotoLayerId>.json'` — the EMPTY change set IS the bug |
| 17 pre-existing cases (11 roundtrip + 5 revision + 1 rd4-era pin) | PASS — no collateral damage at RED |

14 of 15 new legs failed at RED; the 15th is the deliberate pre-fix non-regression pin. Zero assertions were edited in Task 2 — every leg went green against the implementation as written.

## Task Commits

Each task was committed atomically (code changes only; docs committed by the orchestrator):

1. **Task 1 (RED): display-class rotation tests** - `ac276b21` (test)
2. **Task 2 (GREEN): export the photo encoder, add the background composer, grow both save gates** - `caa164c2` (feat)

**Plan metadata:** `f70f14b4` (docs: create display-class save token quick plan)

## Files Created/Modified

- "`app/src/efx-paint/document/efxPaintDisplaySaveToken.test.ts` (new) — six display-field unit cases: three carriers rotate, both revision legs stay put, encoder existence pins, bare-vs-composer single-encoder pins"
- `app/src/lib/efxPaintPackageRoundTrip.test.ts` — new save-twice describe block (six on-disk cases reusing the file's fixture/mocks/helpers; no existing case touched)
- `app/src/efx-paint/document/efxPaintDocumentRevision.ts` — photo-display encoder exported; new background-display composer; bare-encoder doc contract rewritten (lock excluded because it feeds `bgtransform:`); sync fingerprint uses the composer
- `app/src/lib/efxPaintPersistence.ts` — layer change token takes the document and appends `|bgT:`/`|photoDisplay:`; call site passes `layer.document`; save fingerprint gains the photo term and the composer `|bgT:`; `DocumentSoundClip` import dropped (`noUnusedLocals`)
- `app/src/efx-paint/document/efxPaintDocumentRevision.test.ts` — case (t4) rewritten against the document-taking signature (same assertion meaning, plus a gain-rotation leg), header bullet updated; t1-t3 untouched

## Verification

- "`pnpm --filter efx-motion-editor exec vitest run src/efx-paint/document/efxPaintDisplaySaveToken.test.ts src/lib/efxPaintPackageRoundTrip.test.ts src/efx-paint/document/efxPaintDocumentRevision.test.ts src/efx-paint/document/efxPaintBackgroundTransform.test.ts src/efx-paint/compositor` → **10 files, 114 tests, all pass** (Task 1 legs green with zero assertion edits; rd4 suite + compositor cache intact)"
- `pnpm --filter efx-motion-editor run typecheck` → **clean** (`noUnusedLocals`/`noUnusedParameters` satisfied)
- Full suite `pnpm --filter efx-motion-editor exec vitest run` → **261 files passed / 2 skipped, 4828 tests passed, 0 failed** (exit 0)
- Single-encoder audit: `grep encodeCanonicalBackgroundTransform app/src` → callers are the new composer, `efxPaintCompositeCache.ts:153` (`bgtransform:`), and the pin tests; **absent from `efxPaintPersistence.ts`** (count 0)
- Diff boundary: `git diff f70f14b4..HEAD --stat` touches **exactly the 5 files** in the plan's `files_modified`; `efxPaintCompositeCache.ts`, every parser, every store, `physicPaintBridge.ts` and `documentSyncPushGuard.ts` untouched

## Decisions Made

- One composer with delimiter `|`, delegating to the bare transform encoder — no second transform encoding anywhere (T-261012-C9A-01).
- Token term order `...|audios:|bgT:|photoDisplay:` — the t2 pin requires audios to remain last on the sync fingerprint, and appending keeps that contract.
- `as unknown as` casts on the dynamic imports in the new unit file (the t4 idiom's direct cast cannot compile where the RED signature takes an audios array and the duck-type takes a document — TS2352 would kill collection before any leg runs).
- No `.mce` format change, no new dependencies, no documentRevision widening — per plan scope.

## Deviations from Plan

None - plan executed exactly as written.

**Total deviations:** 0
**Impact on plan:** no scope creep; both tasks matched their planned file lists byte-for-byte.

## Issues Encountered

None. RED landed exactly where the plan predicted (empty `changedFiles` on all six on-disk cases; the token leg's hard TypeError on the background-transform case).

## Known Stubs

None.

## Next Phase Readiness

- **Native UAT (user-owned) is the stop gate for this quick** — do NOT dispatch Quick 2 until it passes. Rows:
  1. Photo display: change visibility/opacity/position/scale/rotation/lock → save → close → reopen → all four hold.
  2. Background transform: move/scale/rotate the background → save → close → reopen → holds.
  3. Background lock: toggle ONLY the transform lock → save → close → reopen → lock state holds.
  4. No-op save: no edits → save again → no files rewritten (D-11 intact — pinned by the untouched `writes nothing on an identical second save` case).
- Native UAT row 4 (no-op save) is additionally proven by the existing round-trip case, which still passes.

---
*Phase: quick-261012-c9a*
*Completed: 2026-10-12*

## Self-Check: PASSED

- FOUND: app/src/efx-paint/document/efxPaintDisplaySaveToken.test.ts
- FOUND: commit ac276b21 (Task 1 RED, test-only)
- FOUND: commit caa164c2 (Task 2 GREEN)
- FOUND: .planning/quick/261012-c9a-display-class-save-token-v1-0-1-quick-1/261012-c9a-SUMMARY.md
- Measured commits from plan base f70f14b4: 2 (matches frontmatter `actuals.commits`)
