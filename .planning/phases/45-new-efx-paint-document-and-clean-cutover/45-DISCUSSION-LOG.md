# Phase 45: New EFX Paint Document and Clean Cutover - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-08-23
**Phase:** 45-new-efx-paint-document-and-clean-cutover
**Areas discussed:** Cutover blast radius, Pre-v1.0 rejection UX, Background fallback config, UAT evidence bar

---

## Cutover Blast Radius

### Q1: Which paint runtimes does the v1.0 clean cutover replace?

| Option | Description | Selected |
|--------|-------------|----------|
| Replace both runtimes | Single EFX Paint entry point; 'paint' and 'physic-paint' both unsupported; Basic/FX capabilities return later inside the new document | |
| Only physic-paint | Only physic-paint gets the v1.0 document; inline Basic/FX 'paint' layer keeps working unchanged | ✓ |
| Replace both, keep inline UX bridged | Remove 'paint' persistence/renderer but keep PaintOverlay UX wired to the new document | |

**User's choice:** Only physic-paint — with a locked naming contract (free-text): "EFX Paint" (inline main-editor Basic/FX paint: paintStore/PaintOverlay/paintRenderer) and "EFX Physic Paint" (independent external module packages/efx-physic-paint + Studio window, usable standalone or with other hosts) are two completely different layers. v1.0.0 works ONLY on EFX Physic Paint. The spec's "one runtime, one renderer" invariant applies INSIDE the Physic Paint document, not across the whole app.
**Notes:** User had been bitten by this naming confusion twice before; the contract is now locked and recorded in project memory.

### Q2: How should the legacy one-track Physic Paint code be removed?

| Option | Description | Selected |
|--------|-------------|----------|
| Hard-delete legacy code | Physically remove legacy reader/parser/renderer/cache code; git history preserves it; DOC-04 audit = code doesn't exist | ✓ |
| Keep files, disconnect call sites | Lower diff risk, but "unreachable" is hard to prove and can silently revive | |

**User's choice:** Hard-delete legacy code.

### Q3: Does the standalone efx-physic-paint package adopt the v1.0 document format in Phase 45 too?

| Option | Description | Selected |
|--------|-------------|----------|
| Standalone adopts v1.0 doc too | One document format everywhere; standalone stays the reference oracle; its old session files rejected the same way | ✓ |
| Host-only for now | Smaller blast radius, but oracle and shipped runtime disagree on persistence format | |

**User's choice:** Standalone adopts v1.0 doc too.

### Q4: What happens to legacy Physic Paint data on disk?

| Option | Description | Selected |
|--------|-------------|----------|
| Never read, never delete | v1.0 uses new persistence keys and cache directory; old files untouched; rejection = refusal to LOAD, not deletion | ✓ |
| Offer optional cleanup | Explicit "remove old paint data" action; destructive path needing its own care | |

**User's choice:** Never read, never delete.

---

## Pre-v1.0 Rejection UX

### Q1: When a .mce project containing legacy Physic Paint data is opened, what fails?

| Option | Description | Selected |
|--------|-------------|----------|
| Hard-fail the whole open | Explicit blocking dialog; nothing renders/mutates; auto-save never touches the file | ✓ |
| Open project, fail the layers | Rest of project works; risks silent data loss or compat branch on later save | |

**User's choice:** Hard-fail the whole open.

### Q2: Where does legacy detection fire?

| Option | Description | Selected |
|--------|-------------|----------|
| Gate at project parse | Before UI/store hydration; triggers: non-empty physic_paint_outputs, 'physic-paint' layer, legacy cache refs; contract-testable | ✓ |
| Detect at layer use | Delayed failure with partial app state; weaker guarantee | |

**User's choice:** Gate at project parse.
**Notes:** Old projects WITHOUT Physic Paint data (including ones with inline EFX Paint layers) open normally.

### Q3: What does the rejection dialog offer the user?

| Option | Description | Selected |
|--------|-------------|----------|
| Explicit unsupported, no recourse | Plain statement; no partial open, no converter, no stripped copy | ✓ |
| Hard-fail + offer stripped copy | Opens a NEW copy with physic-paint layers stripped; extra strip-and-copy path | |

**User's choice:** Explicit unsupported, no recourse.

---

## Background Fallback Config

### Q1: What is the default Background fallback for a new v1.0 document?

| Option | Description | Selected |
|--------|-------------|----------|
| Always transparent | Unconditional; matches main-editor compositing expectation and current paintBgColor transparent default | ✓ |
| Inherit paintBgColor if set | Preserves "paint layer background color" mental model; couples v1.0 doc to a legacy field | |

**User's choice:** Always transparent.

### Q2: When does the user get UI to configure the fallback?

| Option | Description | Selected |
|--------|-------------|----------|
| Persist now, UI in Phase 49 | Fallback persisted in schema (mode: 'transparent'); picker arrives with Background track work; no speculative UI | ✓ |
| Minimal Studio control now | Toggle + color field in Phase 45; UI for a track with no clips or visible row yet | |

**User's choice:** Persist now, UI in Phase 49.

---

## UAT Evidence Bar

### Q1: What must native UAT visibly demonstrate for Phase 45?

| Option | Description | Selected |
|--------|-------------|----------|
| Full 4-part UAT | (1) create/open Studio on v1.0 doc + paint stroke; (2) save/quit/reopen identity; (3) pre-v1.0 rejection dialog; (4) main editor unchanged | ✓ |
| Happy-path UAT only | Rejection and regression checks left to automated tests and Phase 53 | |

**User's choice:** Full 4-part UAT.

### Q2: How should UAT verify document structure before the Phase 47 timeline exists?

| Option | Description | Selected |
|--------|-------------|----------|
| On-disk doc + behavior | Inspect saved project file JSON (version, parentLayerId, documentRevision, activeTrackId, tracks, fallback) + observable behavior; no throwaway UI | ✓ |
| Temporary Studio indicator | Read-only status line in Studio; extra UI to build and later remove | |

**User's choice:** On-disk doc + behavior.

### Q3: What pre-v1.0 project data is used for the rejection UAT?

| Option | Description | Selected |
|--------|-------------|----------|
| Real pre-v1.0 project copy | Real v0.9-era project with Physic Paint work (copy; original never mutated) | ✓ |
| Synthetic fixture | Controlled, commit-able fixture; may miss real-world quirks | |

**User's choice:** Real pre-v1.0 project copy.

---

## Claude's Discretion

- Exact v1.0 document field-level schema (spec sketch is illustrative, not locked)
- New persistence keys and v1.0 cache directory layout
- Location of the new document model code (research recommends `app/src/efx-paint/`)
- Exact rejection dialog wording (plain and explicit per D-07)

## Deferred Ideas

- Background fallback configuration UI (transparent | solid picker) — Phase 49
- Optional legacy on-disk cleanup action — rejected for Phase 45; revisit only if disk hygiene becomes a user concern
- "Open a stripped copy" salvage path for rejected projects — rejected; possible standalone tool outside the milestone
