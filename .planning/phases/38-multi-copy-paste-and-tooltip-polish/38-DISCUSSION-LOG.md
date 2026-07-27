# Phase 38: Multi-Copy/Paste and Tooltip Polish - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-27
**Phase:** 38-multi-copy-paste-and-tooltip-polish
**Areas discussed:** Group Copy semantics, Group Paste anchoring & collisions, Status capsule ambient policy, Tooltip placement notch & multiline

---

## Group Copy semantics

| Option | Description | Selected |
|--------|-------------|----------|
| Group copy on 2+ | 2+ keys selected copies the whole group; 1 selected keeps today's single-key copy unchanged | ✓ |
| Separate group-copy action | Copy stays current-key only; group copy gets a new action/icon | |
| Selection always, unify paths | Copy always copies the full selection; single = group of 1 | |

| Option | Description | Selected |
|--------|-------------|----------|
| One shared slot | Group Copy overwrites single-key clipboard and vice versa; immutable and reusable | ✓ |
| Two separate slots | Single and group clipboards side by side | |

| Option | Description | Selected |
|--------|-------------|----------|
| Payload + appFrame + keyId | Immutable payload snapshot + source appFrame + source keyId; offsets derived at paste | ✓ |
| Payload + relative offsets only | No source keyId provenance | |
| You decide | Planner picks record shape | |

**User's choice:** All recommended options.
**Notes:** Supersedes Phase 37 D-16 for the multi-selection case only.

---

## Group Paste anchoring & collisions

| Option | Description | Selected |
|--------|-------------|----------|
| Earliest key anchors | Earliest copied key maps to destination; others keep relative offsets | ✓ |
| Copy-time current key anchors | The current editing key at Copy time anchors | |
| You decide | Planner picks | |

| Option | Description | Selected |
|--------|-------------|----------|
| All-empty or reject | Any occupied destination rejects the whole paste atomically; never overwrites | ✓ |
| Replace-style like single paste | Overwrites occupied destinations | |
| Skip occupied, paste the rest | Partial mutation | |

| Option | Description | Selected |
|--------|-------------|----------|
| Exact frames, no ripple | Keys land at exact computed frames; generated cells valid; over-capacity rejects | ✓ |
| Insert with ripple | Ripples later keys right to make room | |

| Option | Description | Selected |
|--------|-------------|----------|
| Current cell, unchanged | Paste stays destination-based on the current editing cell; fresh keyIds; one transaction/Undo | ✓ |
| Other behavior | — | |

**User's choice:** All recommended options.
**Notes:** Group paste deliberately never overwrites, unlike single paste's replace-style.

---

## Status capsule ambient policy

| Option | Description | Selected |
|--------|-------------|----------|
| Only when gaps exist | Line appears only when timeline has missing frames | |
| Only on a missing frame | Line follows the current cell | |
| Only during playback | Line appears only in playback with missing frames | |
| Never show it | Remove the ambient line entirely | ✓ (via free text) |

| Option | Description | Selected |
|--------|-------------|----------|
| Empty when idle | Capsule blank until a real event | |
| Current-cell context line | e.g. 'Real Roto key · Frame 5' / 'Empty frame · Frame 7' | ✓ |
| New static baseline | Keep static baseline, new wording | |

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, LOG keeps detail | Detailed explanation stays in LOG/diagnostics | ✓ |
| Something more | — | |

**User's choice:** Free-text on Q1: "I dont know what is this fuck info and when to show it !" — then confirmed the synthesized proposal in plain text: remove the permanent baseline; idle capsule shows current-cell context; missing-frame info only when current state or active playback/export makes it relevant; detail in LOG.
**Notes:** The permanent baseline is deleted, not reworded — user's frustration showed it was meaningless as idle filler.

---

## Tooltip placement, notch & multiline

| Option | Description | Selected |
|--------|-------------|----------|
| All tooltips, top-first | Every styled tooltip tries top first, flips below when no room | ✓ (refined) |
| Bottom rows only | Header tooltips stay 'below' | |

| Option | Description | Selected |
|--------|-------------|----------|
| Viewport-positioned | Fixed/portal-style coordinates, flipped and clamped to viewport | ✓ |
| In-strip, relax overflow | Keep in-strip rendering, adjust strip overflow | |
| You decide | Planner picks mechanism | |

| Option | Description | Selected |
|--------|-------------|----------|
| Notch on control side | Triangle centered on the source control, flips with placement | ✓ |
| Notch centered on tooltip | Centered on tooltip body | |
| You decide | Planner picks geometry | |

| Option | Description | Selected |
|--------|-------------|----------|
| Wrap, clamp max height | Bounded max width (~260–320px), clamped max height, no scroll, no '...' | ✓ |
| Wrap + internal scroll | Overflow scrolls inside tooltip | |
| Wrap, unbounded height | Grows as tall as needed | |

**User's choice:** Recommended options, with a refinement on placement: "top-first when elements are bottom-first of UI (like tube log) and bottom when elements are top of the UI. Same for right and left UI — tooltip shows at the opposite of the element position." Confirmed correct via follow-up.
**Notes:** Placement is position-aware opposite-side, not blanket top-first. Header/capsule keep below-placement visually (they are top-of-UI) but via viewport positioning, superseding the 36.15 Gap B in-strip workaround.

---

## Claude's Discretion

- Exact type/intent names (group paste intent variant) and plan boundaries.
- Capsule context-line exact wording and reject-reason copy.
- Exact max width/height pixels (within 260–320px width band), notch dimensions, viewport clamp margins.
- Pasted-group selection aftermath (recommended: pasted group selected, earliest pasted key current — mirrors 37 D-06/D-17).
- Viewport-positioning mechanism (portal vs fixed).

## Deferred Ideas

- Group-aware Duplicate — deferred in Phase 37, still out of scope.
- Keyboard Copy/Paste shortcuts (Cmd/Ctrl+C/V) — possible later accessibility enhancement.
- Replace-style group paste — rejected for MVP; new phase if ever wanted.
