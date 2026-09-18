# Quick Task 260918-ovi: Canvas Size + Orientation Choice at Project Creation — Context

**Gathered:** 2026-09-18
**Status:** Ready for planning

<domain>
## Task Boundary

NewProjectDialog never asks for canvas size; projects default to 1920×1080
(projectStore.ts:54-55). The model already persists per-project width/height
(serialized projectStore.ts:388-389, hydrated :449-450) and physics sizing is
orientation-agnostic (WORKING_LONG_EDGE=1920 scales by max(w,h),
physicsPaintCanvasSizing.ts:7).

Deliver: a canvas-format choice at project creation — platform-verified presets
plus a custom entry — with every width/height read site in the app made
data-driven so ANY reachable ratio renders/exports correctly.

Lands in v1.0.0 scope; joins Phase 53's acceptance surface.

</domain>

<decisions>
## Implementation Decisions

### Preset set (labels English, word + dimensions + platform annotation)

- **HD — 1920×1080 (16:9)** — default, current behavior (YouTube classic)
- **HD Vertical — 1080×1920 (9:16) · Story / Reels / Shorts
  (Instagram / Facebook / YouTube / TikTok)** — one master file covers all
  (YouTube Stories discontinued 2023; vertical YouTube = Shorts, same
  1080×1920, covered by this preset)
- **Portrait — 1080×1350 (4:5) · Post (Instagram / Facebook)** — the
  2026-recommended feed format
- **Square — 1080×1080 (1:1) · Post fallback** — confirmed IN
- **Custom…** — two W×H fields using the 52.2 stepper component
  (− [field] +), integers, sane minimum per side, long edge clamped to 1920
  (52.1 HD cap; 2K stays v1.2.0), inline validation, steppers + keyboard

Labels are English to match the dialog chrome (user's spec was French; they
chose translation).

### Control shape

Segmented pill preferred — keep consistency with the FPS row where possible.
The pill MAY become a select/radio list if 4 presets + a custom row read
better that way; planner/executor has discretion on the exact control as long
as it stays visually consistent with the dialog.

### Audit clause (NON-NEGOTIABLE)

Custom entry means any ratio is reachable, so dims must be fully data-driven
EVERYWHERE: export engine, compositor buffers, thumbnails, Studio canvas
aspect. Sweep width/height read sites for hardcoded 16:9 / 1920×1080
assumptions and fix each to read the project dims.

ESCALATION CLAUSE: if the audit uncovers structural fixed-ratio surgery (not
point reads), STOP and report — that becomes an intermediate phase; do not
stretch the quick.

### SettingsView alignment (locked 2026-09-18)

SettingsView's post-creation resolution editor must not escape the cap either:
drop 4K from its presets, clamp to the 1920 long edge. Rides this quick.

**v1.2.0 roadmap policy (user-recorded):** 2K native authoring is sufficient
for stop motion; 4K delivery will be post-export upscaling, not in-app
authoring. No in-app 4K plan.

### Tests

- Preset persists through save/reopen (package manifest round-trip)
- Physics scale for both orientations
- No surviving 16:9 assumption in audited sites
- vitest run, never watch

### Native UAT (user-side)

Create vertical project → paint in Studio → save → reopen → export PNG —
both orientations. Phase 53 UAT covers the preset set + one custom size.

### Claude's Discretion

- Exact control component (pill vs select/radio) within dialog consistency
- "Sane minimum per side" value for custom entry
- createProject signature shape (params vs options object)
- Internal plumbing of dims from dialog → store

</decisions>

<specifics>
## Specific Ideas

- Stepper component from Phase 52.2 (− [field] +) is the mandated custom-entry
  control — locate and reuse it; do not invent a new numeric input.
- Platform annotations verified against 2026 guides; keep them in labels.
- Out of scope: platform safe-zone overlays.

</specifics>

<canonical_refs>
## Canonical References

No external specs — requirements fully captured in decisions above.

</canonical_refs>
