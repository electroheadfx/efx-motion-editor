# Quick Task 261008-ig1: Multi-audio concept — Context

**Gathered:** 2026-10-08
**Status:** Ready for planning
**Milestone:** 52.5 — physic-paint-document-sound-track (this quick lives inside it)

<domain>
## Task Boundary

Implement the multi-audio concept already written at
`.planning/phases/52.5-physic-paint-document-sound-track/52.5-MULTI-AUDIO-CONCEPT.md`.
The concept is the design authority — this quick turns it into code. The locked
decision the user restated: **two identities, don't overload them** —
`DocumentSoundClip.id` is the placed clip (list key, timeline selection,
transport key, buffer key), `sourceId` is the imported file (peaks cache key,
gallery dedupe key). Per-clip settings. `audios[]` replaces the singleton
`sound`. Modal list with click-to-reveal.

</domain>

<decisions>
## Implementation Decisions

### Quick scope cut — CORE SLICE
- **In scope for this quick:**
  - `audios: readonly DocumentSoundClip[]` replacing the top-level `sound`
    singleton (DocumentSoundClip shape unchanged).
  - Fail-closed parse: `SOUND_KEYS` per entry + `AUDIO_LIST_KEYS` on the
    container. Unknown members throw.
  - Modal (`PhysicsPaintAudioModalView`) becomes list + per-selection editor:
    row per clip (filename, enabled, in..out, selected marker), click row →
    select + reveal on timeline, `Import sound` ADDS (does not replace),
    `Replace…` swaps the selected clip's source preserving position/in-out,
    `Remove` + `On`/`Off`, per-clip Volume / Fade in / Fade out / In / Out.
  - Timeline multi-clip render: one stain + trim handles + fade/volume overlay
    per clip; `selectedSoundId` drives `is-selected`; click clip → select
    (never scrubs); click band outside every clip → deselect; double-click
    clip → open modal on **that** clip.
  - Two ways in: timeline double-click lands on that clip's editor (list
    pre-selected); the `Document sound` header launcher lands on the **list**
    (chooser). Single clip: both land on the same place.
  - Alt+drag duplication (see below).
  - Rust `PhysicsPaintLaunchContext` grows to carry the clip list (the Studio
    child needs `audios[]` to draw the timeline at all) — pinned by a
    round-trip test (see below).
- **Out of scope (follow-up quick):** transport/`documentAudio` channel
  reshaping, `preparedTrackIds` changes, `.mce` `audios/` package-reference
  expansion for the list, export-mixer / playback-mix changes, master lane.
  The 52.5-02 mixer already sums whatever clips it is handed; this quick does
  not retarget it.
- **Implication to pin in the plan:** save/reopen of the *document JSON* keeps
  `audios[]` (that is the model change). The `.mce` package multi-file
  reference law is the deferred part. The plan must state which of the two it
  wires so a reviewer cannot mistake one for the other.

### Alt+drag duplication — INCLUDE in this quick
- Alt+drag a clip creates a second placed clip: fresh `DocumentSoundClip.id`,
  **same** `sourceId`. One imported file, several uses.
- The duplicate starts as a copy of geometry + settings (start/in/out, gain,
  fades, enabled) so the user can slide/trim it to another portion.
- Peaks stay source-keyed (`audioPeaksCache.get(sourceId)`) — both clips share
  one cached decode. Never clip-key the peaks cache.
- No second bytes copy, no second gallery entry, no second `audio/` path.

### Native round-trip pin — HARD GATE
- The concept flags the Rust serde silent-drop as a PITFALL: members the
  `PhysicsPaintLaunchContext` struct does not declare are silently dropped on
  the native launch path, so a JS-only section vanishes and the Studio child
  never runs `prepareClip`.
- **Done-gate:** a Rust round-trip test that serializes a launch context
  carrying the full `audios[]` list and asserts every member survives
  deserialize. This test is required for the quick to be considered complete.
  No "grow the struct and hope".

### Claude's Discretion
- Concrete React/Preact component shape for the modal list rows and the
  selected marker (subject to `efx-preact-reactivity` + `developing-preact`
  skills and the project's no-useState / signals-only rule).
- Exact reveal-scroll behavior for click-to-reveal (the 260922-qad one-shot
  viewport scroll to the opened frame is the existing analog — ride it).
- How the timeline band deselect interacts with the existing single-rail drag
  routing split (gate drag on move-membership flags).
- Test file layout and the exact vitest launcher (the project collects only
  `.test.ts` — a `.test.tsx` target exits 0 while running nothing).

</decisions>

<specifics>
## Specific Ideas

- Concept file is the spec: `.planning/phases/52.5-physic-paint-document-sound-track/52.5-MULTI-AUDIO-CONCEPT.md`.
  Read it in full — the "Overlaps MIX", "Two ways in", "Identity", and
  "PITFALL" sections are load-bearing.
- Reuse existing 52.5 machinery: `buildReplacedSoundClip` clamp law,
  `audioPeaksCache`, `isSafePackageRelativePath` + `audio/`-prefix guards,
  the 260922-qad timeline auto-position scroll.
- No backward compatibility: the singular `sound` member is gone. Old projects
  fail to parse and are rebuilt fresh (project law — never add migration code).

</specifics>

<canonical_refs>
## Canonical References

- `.planning/phases/52.5-physic-paint-document-sound-track/52.5-MULTI-AUDIO-CONCEPT.md` — the design authority for this quick
- `.planning/phases/52.5-physic-paint-document-sound-track/52.5-RESEARCH.md` — 52.5 technical research (existing singleton implementation)
- `.planning/phases/52.5-physic-paint-document-sound-track/52.5-PATTERNS.md` — closest analogs in the codebase
- `efx-preact-reactivity` + `efx-async-orchestration` project skills — mandatory discipline

</canonical_refs>
