---
phase: 43
slug: hold-loop-clips-filmstrip-capsule
status: verified
# threats_open = count of OPEN threats at or above workflow.security_block_on severity (the blocking gate)
threats_open: 0
asvs_level: 1
created: 2026-08-20
---

# Phase 43 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| project file → parser | Untrusted `.mce` JSON crosses into the physical document authority at load | serialized document (untrusted) |
| child window → parent commit | Apply payload crosses the bridge into the document authority | loop clip / mutation payload |
| persisted document → derivation | Loop records parsed from disk drive the derivation; malformed structure already threw at parse | loop records |
| derivation/query → all read surfaces | Derived intervals and typed frame results feed store, dialog, capsule, export | derived intervals / typed frames |
| child commit → store | Apply payload crosses into the document authority; revision is the guard | commit payload |
| store → all render surfaces | One canonical read feeds preview, Studio, cache coordinator, export | canonical document state |
| user gesture → resolver intent | Delete/drag/paste intents may target linked keys; guards are the enforcement point | intent payload |
| controller → resolver derivation | Preflight trusts the canonical derivation, never local math | derived state |
| parent window → child window | New parent→child bridge message carries a loopId; child must not trust payload shape | bridge message |
| dialog input → commit path | Repeat/Infinity user input flows into an atomic commit | repeat / infinity input |
| persisted payload dataUrls → canvas | Source thumbnails come from parsed project data; rendering must not execute or fetch anything | thumbnail dataUrls |
| canvas pointer/keyboard → ops | Hit regions dispatch directly into atomic loop ops; mis-scoped regions would mutate the wrong object | pointer / keyboard intent |
| tooltip actions → controller | Pinned actions invoke commits from a floating surface | action intent |
| document state → deliverable | Export turns project data into user deliverables; unresolved references must halt it | exported frames |
| placeholder variant → durable cache | A placeholder mistaken for content would poison the cache | placeholder variant |
| canonical physical document → rail/sidebar | Accepted compact ranges and source metadata become visible product facts | compact ranges / metadata |
| rail/sidebar input → local controller | Pointer/keyboard intent may request an edit or mutation but has no authority itself | intent |
| physical row → overlapping rail target | The top 12px target must not spoof or trigger physical-cell navigation/drag | pointer intent |
| canonical physical output → Motion Editor | Main editor may consume resolved pixels and interval-only passive markers but must not acquire Loop Clip identity or authoring UI | resolved pixels / passive markers |
| timeline pointer/keyboard → commands | Removed coordinates and keys must not reach stale Loop Clip operations | pointer / keyboard intent |
| local EFX UI → physical controller | Local intent still requires exact accepted parent authority | local intent |
| generic child bridge hooks | Project context, authority/apply, save, launch/focus, and frame-sync remain security-sensitive | bridge messages |
| deleted legacy surfaces → retained UI | Cleanup must not remove canonical output consumers or physical-cell behavior | retained UI state |
| remaining generic bridge | Cross-window project/layer authority and apply messages remain security-sensitive | bridge messages |
| automated evidence → native handoff | Test/build success must not be represented as visual approval | evidence status |

---

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-43-01-01 | Tampering | parsePhysicPaintRotoLoopClips | high | mitigate | Fail-closed allowlist parse mirroring hasOnlyAllowedKeys; unknown keys/wrong types throw; dangling keyIds preserved verbatim and marked unresolved downstream (D-31) | closed |
| T-43-01-02 | DoS | repeat field | medium | mitigate | Finite repeat must be a positive integer; parseRepeat safe-product bound (controller 340-353) + 600-frame capacity bound; parser rejects non-integer/zero/negative | closed |
| T-43-01-03 | Tampering | bridge apply payload | high | mitigate | loopClips added to both hasOnlyKeys allowlists; payload revalidated on acceptance in physicPaintBridge.ts | closed |
| T-43-01-SC | Tampering | npm/pip/cargo installs | high | mitigate | No installs this plan; any addition triggers slopcheck + blocking human checkpoint | closed |
| T-43-02-01 | DoS | infinity / huge-repeat loop resolution | medium | mitigate | Lazy per-frame query only — O(1) modulo after interval lookup; effective end capped at min(parent end, 600); no materialized frame lists (D-32) | closed |
| T-43-02-02 | Tampering | boundary query self-exclusion | medium | mitigate | D-24 exclusion set enforced in the derivation: own placementStart, own occurrences, own referenced keyIds never truncate the loop | closed |
| T-43-02-03 | DoS | re-derivation cost on boundary move | low | mitigate | O(keys + loops in range) re-resolution, no cache rebuild (D-32) | closed |
| T-43-02-04 | Tampering | global failure blanking unrelated frames | medium | mitigate | Typed per-frame 'linked-unresolved' result replaces any global projectionFailure; unrelated frames resolve normally | closed |
| T-43-02-SC | Tampering | npm/pip/cargo installs | high | mitigate | No installs this plan; any addition triggers slopcheck + blocking human checkpoint | closed |
| T-43-03-01 | Tampering | replace-roto-physical-map acceptance | high | mitigate | loopClips-aware expectedRevision check rejects stale or forged commits; allowlist validation from 43-01 rejects unknown keys | closed |
| T-43-03-02 | DoS | getRotoPhysicalEndFrame with infinity loops | medium | mitigate | Bounded by parent end and 600-frame capacity; no iteration over virtual frames | closed |
| T-43-03-03 | Tampering | _rotoCacheMetadata pollution | medium | mitigate | Linked occurrences never touch the legacy display model; code-review gate plus architectural note in SUMMARY | closed |
| T-43-03-SC | Tampering | npm/pip/cargo installs | high | mitigate | No installs this plan; any addition triggers slopcheck + blocking human checkpoint | closed |
| T-43-04-01 | DoS | adversarial Motion percent inputs | low | mitigate | clampPercent bounds inputs; extreme-value spec cases prove no hang/NaN | closed |
| T-43-04-02 | Tampering | weakened determinism assertions | medium | mitigate | Byte-exact JSON.stringify equality mandated in acceptance criteria; similarity-based assertions rejected at review | closed |
| T-43-04-SC | Tampering | npm/pip/cargo installs | high | mitigate | No installs this plan; any addition triggers slopcheck + blocking human checkpoint | closed |
| T-43-05-01 | Tampering | guarded intent handlers | medium | mitigate | Fail-closed typed rejections via the existing fail() idiom; spec pins the exact locked copy for D-07/D-11/D-13 | closed |
| T-43-05-02 | Tampering | materialize-local-key base payload | medium | mitigate | Base comes only from the canonical loop-resolved source record (43-03 seam); never from user-supplied payloads | closed |
| T-43-05-03 | DoS | preflight derivation on large ranges | low | mitigate | Derivation is O(keys + loops in range) per D-32; no frame-list materialization | closed |
| T-43-05-SC | Tampering | npm/pip/cargo installs | high | mitigate | No installs this plan; any addition triggers slopcheck + blocking human checkpoint | closed |
| T-43-06-01 | Tampering | open-loop-edit message payload | medium | mitigate | Typed payload + isPhysicPaintOpenLoopEditRequest guard; malformed messages rejected and ignored; loopId validated against the document before opening | closed |
| T-43-06-02 | DoS | Repeat input | medium | mitigate | parseRepeat safe-product bound (cycleLength × repeat ≤ Number.MAX_SAFE_INTEGER) reused verbatim; Update loop disabled while invalid | closed |
| T-43-06-03 | Tampering | regeneration commit | high | mitigate | Reuses the staged atomic commit with authority/revision checks (43-01 fingerprint covers loopClips); no new commit path | closed |
| T-43-06-SC | Tampering | npm/pip/cargo installs | high | mitigate | No installs this plan; any addition triggers slopcheck + blocking human checkpoint | closed |
| T-43-07-01 | DoS | many loops on a long timeline | low | mitigate | Canvas paint calls only for visible cells; zero DOM nodes (D-32); geometry is O(1) per capsule | closed |
| T-43-07-02 | Tampering | thumbnail dataUrls from project file | low | accept | drawImage of a data URL cannot execute script; existing ThumbnailCache discipline unchanged; no new fetch surface | closed |
| T-43-07-03 | Tampering | capsule copy strings | low | mitigate | Badge/tooltip forms are locked constants with numeric slots only — no user-controlled text is interpolated into canvas copy | closed |
| T-43-07-SC | Tampering | npm/pip/cargo installs | high | mitigate | No installs this plan (UI-SPEC Registry Safety: zero new dependencies); any addition triggers slopcheck + blocking human checkpoint | closed |
| T-43-08-01 | Tampering | hit-region dispatch | medium | mitigate | Region precedence and loop-object selection pinned by specs; Delete on capsule maps only to unlink-only loop deletion, never key deletion | closed |
| T-43-08-02 | DoS | tooltip host lifecycle | low | mitigate | Single host with idempotent cleanup (mountedRef pattern); window listeners only while visible | closed |
| T-43-08-03 | Tampering | tooltip copy interpolation | low | mitigate | Only numeric slots and locked constant strings are interpolated; no user-controlled free text reaches tooltip markup | closed |
| T-43-08-SC | Tampering | npm/pip/cargo installs | high | mitigate | No installs this plan; any addition triggers slopcheck + blocking human checkpoint | closed |
| T-43-08-FLAG | Tampering | cross-window-mutation-protocol | high | mitigate | New Tauri/postMessage mutation surface (execution-time flag): origin checks, exact-key guards, bounded identities, active project/layer validation, full result correlation, request fingerprinting, exactly-once replay | closed |
| T-43-09-01 | Tampering | export of unresolved loop | high | mitigate | Preflight fails fast with the locked error before any frame renders; spec asserts zero renderer invocations on block (D-28) | closed |
| T-43-09-02 | Tampering | placeholder persisted as content | medium | mitigate | Placeholder variant explicitly rejected from cache writes in the persistence coordinator; asserted by spec (audit finding 6) | closed |
| T-43-09-03 | DoS | preflight over long export ranges | low | mitigate | Query iterates loop interval records and boundary math only — O(loops + keys in range), no frame materialization (D-32) | closed |
| T-43-09-04 | Tampering | preview/export divergence for valid loops | high | mitigate | Parity spec asserts identical sourceKeyId/provenance per frame between the two surfaces across six scenarios, plus deterministic path-vs-path raster equality (D-27, audit finding 8) | closed |
| T-43-09-SC | Tampering | npm/pip/cargo installs | high | mitigate | No installs this plan; any addition triggers slopcheck + blocking human checkpoint | closed |
| T-43-10-01 | Tampering | dependency drift during phase | high | mitigate | git diff gate on package.json/pnpm-lock.yaml proves zero new dependencies | closed |
| T-43-10-02 | DoS | degraded full-suite signal | medium | mitigate | Full suite + typecheck + build must all pass; no watch mode, no test-count assertions against recalled baselines | closed |
| T-43-10-SC | Tampering | npm/pip/cargo installs | high | mitigate | No installs permitted in this plan; any install request triggers slopcheck + blocking human checkpoint | closed |
| T-43-11-01 | Tampering | shared loop selection and controller routing | high | mitigate | One Signal identity and narrow existing controller ports; no optimistic canonical facts | closed |
| T-43-11-02 | Elevation of Privilege | overlapping rail target | high | mitigate | Structural event isolation and tests proving no cell navigation, selection, or drag dispatch | closed |
| T-43-11-03 | Spoofing | identity-bearing or interactive Motion Editor surface | high | mitigate | Constrain projection to {startFrame, frameCount, mode}; paint only passive mode strips/cuts; remove all Loop Clip-specific input/tooltip routes; require native passive-marker-only proof | closed |
| T-43-11-04 | Denial of Service | Infinity/long ranges | high | mitigate | Visible-window geometry from compact intervals; no destination list or repeated assets | closed |
| T-43-11-05 | Information Disclosure | unresolved IDs/name fallback | medium | mitigate | Derived product name and escaped text only; no raw IDs in tooltip/sidebar/ARIA | closed |
| T-43-11-06 | Tampering | stale selection authorization, partial ripple, or split record/placement settlement | high | mitigate | Canonical rail/physical scope validation, final-order/capacity guards, source-attached placement follow, complete rollback, and one history command | closed |
| T-43-11-07 | Elevation of Privilege | linked occurrence treated as durable key | high | mitigate | Session-only selection identity only; generated/gap/unresolved rejection; no materialization, diamond, persistence, drag, Delete, Cut/Copy, unlink, or clone | closed |
| T-43-11-08 | Tampering | stale or missing parent background | high | mitigate | Strict Play Script-only background payload, same document transaction, ordinary-kind rejection, and preview/export parity tests | closed |
| T-43-11-SC | Tampering | package supply chain | high | mitigate | No package install or dependency change is permitted | closed |
| T-43-13-01 | Spoofing | passive marker expanding into duplicate authoring surface | high | mitigate | Retain only {startFrame, frameCount, mode} and pure mode-strip/endpoint paint; remove rich capsule types/drawing, tooltip mounts/imports/callers, identity, source/repeat metadata, and interaction ownership together | closed |
| T-43-13-02 | Elevation of Privilege | invisible hit/keyboard routes | high | mitigate | Behavioral absence tests prove removed coordinates/keys emit no Loop Clip intent | closed |
| T-43-13-03 | Tampering | generic timeline and physical cells | medium | mitigate | Retain focused non-Loop renderer/interaction/cell regressions | closed |
| T-43-13-04 | Information Disclosure | stale tooltip state | low | mitigate | Remove tooltip mount/state and every executable reference; physical component-file deletion remains exclusive to Plan 43-14 | closed |
| T-43-13-05 | Tampering | D-57/D-58 runtime removed as apparent capsule residue | high | mitigate | Run selection/action/resolver/coordinator/history/background regressions and keep all authoring identity EFX-local | closed |
| T-43-13-SC | Tampering | package supply chain | high | mitigate | No package install or dependency change is permitted | closed |
| T-43-14-01 | Spoofing | stale tooltip/lane surfaces | high | mitigate | Delete obsolete modules/selectors and replace positive tests with absence contracts | closed |
| T-43-14-02 | Elevation of Privilege | specialized child listeners | high | mitigate | Remove specialized listener mounts while retaining local controller authority and generic hooks | closed |
| T-43-14-03 | Tampering | physical cells and integrated rail | medium | mitigate | Exact geometry, linked-indicator, selection, and drag regressions remain green | closed |
| T-43-14-04 | Denial of Service | dead listeners and protocol state | medium | mitigate | Remove protocol-only child replay/dedup state after callers are gone | closed |
| T-43-14-SC | Tampering | package supply chain | high | mitigate | No package install or dependency change is permitted | closed |
| T-43-15-01 | Elevation of Privilege | generic bridge cleanup | high | mitigate | Remove only specialized protocol after no-caller proof; retain authority/apply/context guards | closed |
| T-43-15-02 | Tampering | local Loop Clip mutation | high | mitigate | Canonical controller/history tests prove revision, exact acknowledgement, atomic commit, and rejection | closed |
| T-43-15-03 | Repudiation | UAT status | medium | mitigate | Record automated outcomes separately and keep every native result pending | closed |
| T-43-15-04 | Tampering | stale gate evidence | high | mitigate | Execute focused/full/typecheck/build/dependency gates after final cleanup | closed |
| T-43-15-05 | Denial of Service | Infinity/repeated loops | high | mitigate | Lazy resolver and visible-window tests prove bounded behavior and no repeated assets | closed |
| T-43-15-06 | Tampering | stale selection, partial ripple, split placement history, interpolation drift, or background regression | high | mitigate | Final matrix pins mode-specific authorization, ordered cumulative mapping, source-attached placement follow, complete rollback/history, unchanged Interpolation, strict background publication, and Undo/Redo | closed |
| T-43-15-07 | Information Disclosure | signing material | high | mitigate | No certificate, Keychain, credential, notarization, or release-secret access | closed |
| T-43-15-SC | Tampering | package supply chain | high | mitigate | No package install or dependency change is permitted | closed |

*Status: open · closed · open — below {block_on} threshold (non-blocking)*
*Severity: critical > high > medium > low — only open threats at or above workflow.security_block_on count toward threats_open*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-43-01 | T-43-07-02 | Thumbnail dataUrls from project file: `drawImage` of a data URL cannot execute script; existing ThumbnailCache discipline unchanged; no new fetch surface. Moot in final state — the capsule that drew thumbnails was deleted in 43-14 and the rail draws no thumbnails. | Phase 43 | 2026-08-20 |

*Accepted risks do not resurface in future audit runs.*

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-08-20 | 68 | 68 | 0 | gsd-security-auditor (ASVS L1) |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-08-20
