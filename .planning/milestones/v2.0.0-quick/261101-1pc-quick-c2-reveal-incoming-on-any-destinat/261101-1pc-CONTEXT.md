# Quick Task 261101-1pc: Quick C2 — Reveal incoming on any destination - Context

**Gathered:** 2026-11-01
**Status:** Ready for planning

<domain>
## Task Boundary

Quick C1 (`261031-vbo`, CLOSED on UAT approval 2026-11-01) shipped the Standard Rail merge for **Motion and Static incoming runs only**. Its scope explicitly deferred the remaining half to C2:

- A **Reveal incoming run** must be selectable for a stack on any destination rail (Motion, Static, Reveal, or already Standard).
- A Reveal incoming run on a non-Reveal/Standard destination needs a **reference source**. The user-locked proposal is the **document's placed photo reference**; when none is placed, the stack must **refuse with a clear reason and offer the existing "Place a reference…" path**.
- The stack dialog must show the **Reveal cards / reference** when Reveal is selected as the incoming type (`PhysicsPaintPlayScriptCards.tsx`; the dialog stays a shell).
- The merge result is still **ONE Standard Rail**: the destination's cached picture/animation, cycle and repeat survive; the Reveal run composites over them; provenance and reveal identity are dropped in the same atomic commit; Regenerate/Replay stay unavailable with the merged-rail reason; one undo restores the typed rail; save/reopen keeps Standard.
- **No persisted schema/format change.**
- Quick A/B collision, extend-only, repeat-unchanged, Keep, and atomic-undo laws still hold.

Out of scope: changing C1's Motion/Static merge law; Load+Apply; Save/Delete script; the script library format; any new persisted field.

</domain>

<decisions>
## Implementation Decisions

### Reference source for a Reveal incoming run (USER-LOCKED 2026-10-31, pre-authorized to proceed 2026-11-01)
- The Reveal incoming run renders against the **document's placed photo reference**.
- When no document photo reference is placed, the stack **refuses with a clear reason**, performs **zero writes**, and offers the existing **"Place a reference…"** entry point.
- The refusal must be visible before commit (dialog) and re-validated at confirm time; a refusal never stages pins, records scripts, or commits.

### Merge law
- Every destination + Reveal incoming run = **ONE Standard Rail**, exactly like C1's Motion/Static merge (whitelist projection; `scriptId`/`motion`/`overrideColor`/`railKind`/`colorize`/`colorizeMix`/`photoWiggle` absent; stored `mode` internal only).
- The Reveal run's own settings (mode/motion, colorize, photo wiggle, paint seed) shape **only that run's bake**, never the stored rail.
- Each touched key's published bytes = the destination key's **CURRENT cached picture** with the **run's own baked sheet** composited over it (C1 post-UAT law). Keep ON appends the run's slices and stages pre-run base pins; Keep OFF records nothing and never purges the destination.

### Dialog surface
- Incoming Rail Type gains **Reveal** for a stack.
- Selecting Reveal shows the Reveal cards and the read-only reference row (reuse the existing cards module; no fork of the dialog shell).
- The "result is one Standard Rail" helper stays accurate for every incoming type.

### Claude's Discretion
- Exact refusal copy wording (must name the missing document reference and point at "Place a reference…").
- Whether a Reveal incoming run on a Reveal destination also uses the document reference (C1 drops the destination's reveal identity, so the run should be self-contained): default decision — **yes, the document's placed reference is the reference for the incoming run on every destination**, for one consistent law.
- How the dialog surfaces the reference (read-only preview row vs. status line), matching Quick B's reveal reference presentation where possible.
- Whether Reveal-incoming lifecycle growth inherits C1's run-plan lifecycle exactly (extend-only, repeat unchanged): default — **yes, unchanged**.

</decisions>

<specifics>
## Specific Ideas

- The C1 post-UAT picture law is the base: run sheet over the destination's current payload; no event replay of the destination's scripts (a Motion rail's animation lives in baked pixels).
- Quick B's reveal-destination stack shows the Colorize / Photo wiggle / Paint seed cards and hides Rail Type / Motion wiggle / Color / Key Script with the reference read-only. C2 is the mirror case: a Reveal run incoming on a non-reveal destination.
- The user explicitly wants sequences like "3 static + 1 reveal + motion" to end as one Standard Rail; C2 is the step that makes the reveal leg possible on any destination.

</specifics>

<canonical_refs>
## Canonical References

- `.planning/quick/261031-i54-run-script-stack-a-script-onto-an-existi/261031-i54-CONTEXT.md` — Quick A stack law and UAT amendments (collision, extend-only, Keep 2x2).
- `.planning/quick/261031-qps-task-quick-b-follow-up-to-quick-261031-i/261031-qps-CONTEXT.md` and `261031-qps-SUMMARY.md` — Quick B durable-base authority, pixel-only Keep, reveal destination stacking and tail bake.
- `.planning/quick/261031-vbo-task-quick-c-run-script-merge-result-bec/261031-vbo-CONTEXT.md`, `261031-vbo-PLAN.md`, `261031-vbo-SUMMARY.md` — C1 Standard Rail merge law, presentation, refusal copy, and the post-UAT picture-merge fix `28411564c`.
- `.planning/quick/261031-vbo-task-quick-c-run-script-merge-result-bec/261031-vbo-VERIFICATION.md` — C1 verified truths and the live UAT list.

</canonical_refs>
