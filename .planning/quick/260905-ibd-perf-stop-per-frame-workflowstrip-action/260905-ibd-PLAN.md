---
phase: quick-260905-ibd
plan: 260905-ibd
type: execute
wave: 1
depends_on: []
files_modified:
  - app/src/components/physic-paint/PhysicsPaintStudio.tsx
  - app/src/components/physic-paint/hooks/usePhysicsPaintRulerScrub.ts
  - app/src/components/physic-paint/hooks/usePhysicsPaintLaunchIntegration.ts
  - app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.tsx
  - app/src/components/physic-paint/audio/efxPaintAudioMonitor.ts
  - app/src/lib/playbackEngine.ts
  - app/src/components/timeline/TimelineInteraction.ts
autonomous: true
requirements: [G-52-9]
estimate:
  tokens: 30000
  raw_tokens: 30000
  tasks: 4
  confidence: low
must_haves:
  truths:
    - "A paint ruler scrub drag moves ONLY the strip's playhead bar (a narrow leaf reading the Studio-owned rotoScrubFrame signal) plus the throttled audible scrub snippet. No flush, canvas repaint, startFrame propagation (Studio/strip re-render), selection reseed, or main-window frame sync runs mid-drag."
    - "Releasing the drag runs ONE full settle navigation at the exact pointer frame (the ruler hook flushes the queued rAF frame synchronously at release): flush, canvas repaint, startFrame propagation, selection, and a single main-window frame sync — so post-scrub actions (+Key / Delete / Scissor / Paste) land on frame N and the main studio seeks once."
    - "The playhead never jumps back to the drag origin on release: the scrub feed stays sticky at the final frame until the startFrame catch-up effect clears it after the settle propagation lands."
    - "The main studio timeline scrub is fully independent (no cross-window traffic exists in that direction) and now has an audible scrub: idle drag plays a 120ms-throttled 4-frame snippet through the main audioEngine (D-05 ownership-guarded); playing drag keeps the seek-restart; release stops the snippet."
    - "Paint idle scrub is audible in a fresh window WITHOUT pressing Play first: launch hydration routes the audioPreview section through handleEfxPaintAudioContextEvent, which runs the monitor's prepare() (fetch+decode). Previously prepare() ran only on Play or a live track push, so scrubAt's !context gate silenced scrub."
    - "Availability stays genuinely LIVE — nothing about button logic is frozen or gated; the buttons simply do not re-render during a drag because no state they read changes mid-drag. They re-derive on the release settle and on every real mutation."
    - "The whole app test suite stays green and tsc --noEmit is clean."
  artifacts:
    - app/src/components/physic-paint/PhysicsPaintStudio.tsx (rotoScrubFrameSignal, handleNavigateToSyncedFrame drag-gate, onScrubEnd settle navigation, startFrame catch-up effect, rotoScrubFrame strip prop)
    - app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.tsx (rotoScrubFrame prop, playhead bar reads the armed feed)
    - app/src/components/physic-paint/hooks/usePhysicsPaintRulerScrub.ts (release exactness: synchronous pending-frame flush before onScrubEnd)
    - app/src/components/physic-paint/hooks/usePhysicsPaintLaunchIntegration.ts (launch audio hydration through the monitor-prepare funnel)
    - app/src/components/physic-paint/audio/efxPaintAudioMonitor.ts (profile-gated [efx-paint-audio] gate diagnostics)
    - app/src/lib/playbackEngine.ts (scrubToFrame / scrubAudioEnd / startAudioSnippet)
    - app/src/components/timeline/TimelineInteraction.ts (playhead drag routes scrubToFrame; pointer-up scrubAudioEnd)
  key_links:
    - "Ruler hook onScrubStart/onScrubEnd lifecycle ↔ scrubActiveRef: the gate is armed ONLY between those two callbacks, so plain clicks (sub-threshold) keep the full seek path untouched."
    - "rotoScrubFrame feed ↔ startFrame catch-up effect: the feed is sticky after release and clears only when launchContext.startFrame === feed, so the playhead bar's source switch is always value-identical (no flicker)."
    - "Launch hydration ↔ monitor prepare: the store guard and the monitor prepare must travel together through handleEfxPaintAudioContextEvent, or the monitor context stays null until Play."
    - "Main scrub snippet ↔ D-05 ownership: startAudioSnippet checks isPhysicPaintChildAudioClaimed() so a main scrub never doubles audio over a playing paint window."
---

<objective>
G-52-9, re-scoped after three failed UAT rounds: during ANY scrub drag, the only UI update is the vertical playhead line in that window plus the audible scrub snippet; the two windows' scrubs are fully independent; all settle work runs once on release. Replaces the reverted memo-mitigation approach (commits 8a1b01f0..6bc3fcae, backed out in 269c2bd9).

Purpose: The user's law, verbatim: "all happen during the drag which should not update any ui except the vertical line in efx physic paint" — plus audible scrub in BOTH windows (the main studio scrub never had audio; the paint scrub's audio was silenced by a launch-hydration gap the churn exposed).

Output: Drag-gated paint scrub (playhead feed + snippet mid-drag, one settle navigation on release), audible main-studio scrub, launch-time monitor prepare, profile-gated audio diagnostics, and behavioral + contract tests.
</objective>
