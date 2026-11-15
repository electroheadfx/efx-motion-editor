---
phase: "63"
slug: "brush-tip-pipeline"
status: secure
# threats_open = count of OPEN threats at or above workflow.security_block_on severity (the blocking gate)
threats_open: 0
asvs_level: 1
register_authored_at_plan_time: true
created: "2026-11-15"
---

# Phase 63 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| caller → mask registry | A mask array from an untrusted decode reaches module state | — |
| registry → brush mapping | A stale or wrong-sized mask could become the painted footprint | — |
| package → native reader | WebP bytes inside a user-supplied `.mce` are untrusted | — |
| renderer → package writer | A renderer-supplied relative path could escape the package | — |
| catalog entry → disk | A content-addressed name could disagree with its bytes | — |
| compile-time artifact → bundle | Committed base64 masks ship in the application chunk | — |
| source art → bake | Authoring inputs are read from the repository only | — |
| project entry → package path | An entry-supplied asset string could point outside the package | — |
| manifest → save transaction | A ref-only carrier could smuggle inline bytes or an external path | — |
| save → stored asset | Re-encoding would break byte identity | — |
| Studio webview → main webview | A child-originated event asks the project owner to mutate state | — |
| user file → decoder | Untrusted image bytes and declared dimensions | — |
| asset cache → package | Encoded bytes held in memory ahead of save | — |
| user file name → rendered label | An arbitrary file name reaches the DOM | — |
| catalog signal → card interaction | A degraded tip must not be selectable | — |
| package assets → engine registry | User-supplied WebP bytes become live paint state | — |
| project switch → catalog | A stale entry could paint with another project's mask | — |
| script file → parser | A third-party script can carry arbitrary base64 payloads | — |
| parsed script → engine registry | Session masks from a script become live paint state | — |
| package directory → copied directory | A filesystem copy must not become a re-encode or a path escape | — |
| project create → on-disk layout | Empty scaffolding would imply a carrier with no entries | — |
| package `brushPack` → main-realm catalog | A foreign or hand-edited project file supplies tip records | — |
| main realm → Studio realm | The catalog snapshot crosses a webview boundary into another JS context | — |
| catalog → `.mce` save | The store's tips become the persisted pack | — |
| Studio realm catalog → script file | The realm's remembered bytes become the persisted mask carrier | — |
| script data → registry | A loaded script supplies masks that must not become project data | — |
| project open → Studio realm | A payload may never arrive; absence must not read as "empty project" | — |
| Studio request → main realm | An untrusted request payload crosses the webview boundary | — |
| main realm mutation → Studio answer | The mutation has already landed; the answer must not misreport it | — |
| transport → listener | A publish or emit rejection must not kill the answer path | — |
| script data → registry | A loaded script supplies ids and masks that must not become installed textures | — |
| project package/payload → registry | A foreign `.mce` entry supplies ids and masks through the catalog appliers | — |
| registry → every later stroke | Whatever is installed here is what the engine paints with until the next reset | — |
| project package → native read | A foreign `.mce` supplies the asset leaves the app reads | — |
| native read → process memory | The size of the file the process allocates before validating it | — |
| per-entry failure → wire | The fixed reason vocabulary the app maps to an unavailable tip | — |
| snapshot bytes on disk → AQTL decoder | A per-track `.snap` written by an older build or altered on disk supplies the stroke ids | — |
| decoded event → mask registry | A texture id is only ever a registry map key; the codec resolves nothing and touches no IO | — |
| saved script JSON → play/bake | A script's stroke ids reach the brush bridge, which resolves the footprint | — |

---

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-63-01 | Tampering | `parse_brush_asset_relative_path` / bound guard | high | mitigate | Exactly two segments, fixed root, 64 lowercase hex stem, `.webp` only; `..`, absolute, nested and symlinked leaves refused; positive and negative rows added to both existing pins. | closed |
| T-63-02 | Denial of Service | `registerMask` / `deriveMask` | medium | mitigate | Exact `TIP_MASK_BYTES` length check before any registry write; `deriveMask` returns null on wrong input length instead of allocating. | closed |
| T-63-03 | Denial of Service | `decode_brush_mask` / batch read | high | mitigate | Bound the declared dimensions with `parse_webp_dimensions` BEFORE `decode_rgba`, so an oversize payload allocates nothing; then decode only through the existing codec, refuse any non-192×192 result, map every decode error to `unreadable`, and never abort the batch. | closed |
| T-63-04 | Spoofing | brush import request event / catalog payload | medium | mitigate | The main realm validates payload shape, requires an operationId, enforces the exact 36,864-byte mask length, and only ever answers the Studio window label; the child's catalog guard re-validates every entry, mask length and WebP dimension before anything reaches its registry; an origin-checked message fallback covers the non-Tauri path. | closed |
| T-63-05 | Tampering | `write_brush_asset` / `read_brush_asset` | medium | mitigate | Recompute SHA-256 and compare with the filename stem on both write and read; mismatch is refused. | closed |
| T-63-06 | Tampering | `pack.ts` entry shape | high | mitigate | Package mode refuses `mask` and `maskDataUrl`; the retired D-23 exception comment is rewritten on both models so no future reader re-introduces inline bytes. Pinned by a negative test. | closed |
| T-63-07 | Denial of Service | `parseRotoScript` / mask data URL | high | mitigate | Byte cap before decode, canonical base64 round trip, exact 192×192 dimension check via the existing RIFF walker, and per-entry isolation on load. | closed |
| T-63-08 | Tampering | tip label rendering | low | mitigate | The name is rendered as text through Preact (no innerHTML), truncated at import, and never used as a path or key beyond the catalog id. | closed |
| T-63-09 | Tampering | `maskRegistry` / `buildBrushForStroke` | medium | mitigate | Reset clears entries and bumps the generation; the mapping resolves before building, so a reset id falls back to the preset path. Pinned by the ghost-mask test. | closed |
| T-63-10 | Denial of Service | main JS chunk | medium | mitigate | Three 36,864-byte masks are ~147 KB of raw base64; the phase verification runs the production build against the pinned 2000 kB chunk budget. No incremental budget raise is permitted. | closed |
| T-63-11 | Tampering | single-flight import chain | low | mitigate | The queue serializes imports and contains rejections, so two concurrent imports cannot interleave catalog mutations. | closed |
| T-63-12 | Repudiation | `efxPaintPersistence` brush leg | medium | mitigate | Save stages remembered bytes and never calls an encoder; the untouched-reopen byte-identity test pins it. | closed |
| T-63-13 | Tampering | fresh-profile copy | medium | mitigate | The copy is a byte copy pinned by an equality assertion, and the copied asset is re-validated through `read_brush_asset` (bound-path guard + SHA-256 stem check) rather than trusted because it was copied. | closed |
| T-63-14 | Denial of Service | built-in mask decode | low | mitigate | Constants are generated in-repo and length-validated at module load; a malformed constant fails the unit test rather than reaching the registry. | closed |
| T-63-15 | Tampering | `buildBrushPackSnapshot` / `parseBrushPackSnapshot` | high | mitigate | Every `asset` is validated through `parseBrushAssetRelativePath`; inline carriers are refused; the Rust bound guard independently re-validates the path. | closed |
| T-63-16 | Denial of Service | `importTip` / request handler | high | mitigate | 64 MB and 64 MP caps before read/decode; fixed-length mask validation before encode; a corrupt header returns a named failure instead of throwing. | closed |
| T-63-17 | Denial of Service | import control | medium | mitigate | The control is disabled in flight and the caps live in `importTip` (plan 05), so the UI cannot bypass them. | closed |
| T-63-18 | Tampering | thumbnail, tinted-tip and footprint caches | medium | mitigate | Every cache — `brushFor`'s signature, the stroke thumb and `tipImage`'s tinted canvas — keys on `maskGeneration()`; reset and replacement invalidate; pinned by the stale-mask tests. | closed |
| T-63-19 | Denial of Service | open await | medium | mitigate | One batch read with fixed-length mask validation; failures are collected, not thrown. | closed |
| T-63-20 | Denial of Service | `loadProjectBrushSet` | high | mitigate | Decode happens only in Rust, behind plan 63-02's pre-decode `parse_webp_dimensions` guard; an undecodable or wrong-size asset maps to a named reason, never to a mask; the batch never aborts. | closed |
| T-63-21 | Tampering | apply/reset lifecycle | high | mitigate | `replaceMaskRegistry` and `replaceCustomBrushTips` replace wholesale; reset restores exactly the three built-ins; generation bumps invalidate every derived cache. | closed |
| T-63-22 | Denial of Service | mask decode on load | medium | mitigate | Native decode refuses any non-192×192 result and the renderer validates the 36,864-byte length before registering. | closed |
| T-63-23 | Tampering | session masks | medium | mitigate | Script masks are registry-only, never catalog rows; the next open or close resets the registry to the three built-ins. | closed |
| T-63-24 | Tampering | copied asset digest | medium | mitigate | The digest is recomputed from the copy and compared with the filename stem; a mismatch fails the test. | closed |
| T-63-25 | Tampering | `buildBrushCatalogPayload` / `tipFromRaw` | high | mitigate | Both producers project onto the wire member set and pin category `custom`; the strict wire guard stays in force, and a regression pin proves a stray-member tip reaches the Studio catalog instead of refusing the snapshot whole. | closed |
| T-63-26 | Denial of service | catalog and import wire guards | medium | mitigate | The base64 decode is wrapped to return null; pins feed non-canonical base64 and assert refusal without a throw, so a listener body cannot be killed by one malformed member. | closed |
| T-63-27 | Tampering | `buildProjectBrushPack` | medium | mitigate | A per-entry filter keeps every valid tip, logs each dropped id, and omits the pack only when nothing valid remains. | closed |
| T-63-28 | Repudiation | `saveActiveFrame` / `buildScriptBrushEntries` | high | mitigate | The capture's referenced custom engine brush ids are checked against the carried entries; any gap refuses with a named reason, and an unsynced realm is named as such instead of reporting a successful empty carrier. | closed |
| T-63-29 | Denial of service | `buildScriptBrushEntries` | medium | mitigate | Unavailable ids are skipped per entry and logged; only a tip this realm believes healthy may refuse the save, so one degraded tip no longer disables the Scripts feature. | closed |
| T-63-30 | Repudiation | `installPhysicPaintBrushImportListener` / `applyRequest` / `emitResult` | high | mitigate | The publish port catches and logs; a handler throw is answered with `encode-failed`; `emitResult` is total; and a landed mutation is never reported as a timeout. Tests cover the publish-failure, encode-rejection and window-transport paths. | closed |
| T-63-31 | Tampering | `registerMask` / `replaceMaskRegistry` | high | mitigate | Built-in ids are reserved at both write seams; a foreign mask under a built-in id is logged and skipped by identity comparison against the compile-time constants, so script or package data cannot alter a shipped texture for the session. | closed |
| T-63-32 | Denial of service | `read_brush_asset` | high | mitigate | A metadata length check refuses an over-cap asset before any allocation; the refusal maps to the existing `unreadable` per-entry reason, so a hostile package cannot exhaust memory and cannot abort the open. Tests pin the exact boundary and the batch degradation. | closed |
| T-63-33 | Tampering | AQTL `decodeStroke` / every reader of `engine.textureId` | medium | mitigate | The presence marker is validated as exactly 0 or 1 (`BinaryReader.presence`), the string is length-checked against the declared body before allocation, an empty value is refused, and the id is used only as a mask-registry map key — never a file path — so a crafted snapshot or script cannot reach package or cache IO. Pins cover the corrupt marker, the empty value and the truncated string. | closed |
| T-63-34 | Denial of service | AQTL version gate on a stale or crafted `.snap` | low | accept | An AQTL v1/v2 body is refused whole with `unsupported-version`; the controller reports one restore failure and leaves a known-empty timeline instead of a partial decode, so a stale cache degrades to one notice, never a crash or half-restored strokes. Accepted because the project law forbids migration readers. | accepted |
| T-63-SC | Tampering | npm/pip/cargo installs | high | mitigate | Package-legitimacy gate: this plan adds no dependency; a blocking human checkpoint is required for any [ASSUMED]/[SUS] package. | closed |

*Status: open · closed · open — below `high` threshold (non-blocking)*
*Severity: critical > high > medium > low — only open threats at or above workflow.security_block_on count toward threats_open*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-63-01 | T-63-34 | An AQTL v1/v2 `.snap` body is refused whole with `unsupported-version`; the controller reports one restore failure and leaves a known-empty timeline instead of a partial decode. A stale cache degrades to one notice, never a crash or half-restored strokes. Accepted because the project's clean-break law forbids migration readers. | user (project law: no backward compat) | 2026-11-15 |

---

## Security Audit 2026-11-15

| Metric | Count |
|---|---|
| Threats found | 35 |
| Closed | 34 |
| Open | 0 |
| Accepted | 1 |

Verified at ASVS L1 (grep-depth) because `register_authored_at_plan_time` is true and `asvs_level` is 1. Every <code>mitigate</code> row's control was implemented by its plan and covered by that plan's automated tests; the full suite (9,426 passed) is green after the 63-15 gap-closure wave. No dependency was added by any phase-63 plan (T-63-SC).
