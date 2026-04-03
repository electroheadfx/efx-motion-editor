# Phase 06: Audit Gap Closure — Cleanup & Docs - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-02
**Phase:** 06-audit-gap-closure
**Areas discussed:** Dead code strategy, onEngineReady fix, Spec wording style

---

## Dead code strategy

### Brush types (brush/water.ts)

| Option | Description | Selected |
|--------|-------------|----------|
| Delete entirely | Remove brush/water.ts completely. Re-extract from v3.html or git history if needed later. | ✓ |
| Keep but mark internal | Remove from public exports, keep file with 'shelved' comment. | |
| You decide | Claude picks the cleanest approach. | |

**User's choice:** Delete entirely
**Notes:** None — straightforward decision.

### Other dead code (diffusion, paper, math)

| Option | Description | Selected |
|--------|-------------|----------|
| Delete all dead code | Remove all 9 unused functions. Delete file if ALL functions dead, prune if mixed. | ✓ |
| Keep diffusion.ts, delete rest | Diffusion functions might be useful for debugging physics. | |
| You decide | Claude audits each function's callers and removes only truly dead code. | |

**User's choice:** Delete all dead code
**Notes:** None.

---

## onEngineReady fix

| Option | Description | Selected |
|--------|-------------|----------|
| Delay callback | Fire onEngineReady only AFTER paper textures loaded. Await loadPaperTextures() before callback. | ✓ |
| Promise-based ready() API | Add async ready() method returning Promise. Changes API pattern. | |
| Keep callback + add paperReady event | Fire onEngineReady immediately + separate paperReady event. | |

**User's choice:** Delay callback
**Notes:** None.

---

## Spec wording style

| Option | Description | Selected |
|--------|-------------|----------|
| Silently rewrite | Update requirement text to match current reality. Design decisions documented elsewhere. | ✓ |
| Annotate with decision refs | Rewrite text + add '(per D-07)' inline markers. | |
| You decide | Claude picks the approach that keeps REQUIREMENTS.md clean. | |

**User's choice:** Silently rewrite
**Notes:** None.

---

## Claude's Discretion

- Verify which functions in core/diffusion.ts are truly dead vs still called
- Clean up re-exports in index.ts that reference deleted modules
- Exact implementation pattern for onEngineReady delay

## Deferred Ideas

None — discussion stayed within phase scope.
