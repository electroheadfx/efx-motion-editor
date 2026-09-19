---
phase: quick-260919-azh
plan: 260919-azh
type: execute
wave: 1
depends_on: []
files_modified:
  - app/src/lib/exportEngine.paintEnumeration.test.ts
  - app/src/lib/frameMap.ts
autonomous: true
requirements: []
estimate:
  tokens: 42000
  raw_tokens: 32000
  tasks: 3
  confidence: low
must_haves:
  truths:
    - "Sub-discriminant control: a plain content project (key photos, no paint) still exports exactly its content frame count — the global export path is proven not broken before any fix is attempted."
    - "The enumeration chain for a paint-carrying project is traced end-to-end with citations, and the 52.2 hypothesis (registered document reference-only vs byte-carrying runtime projection) is explicitly confirmed or exonerated with in-test evidence (runtime record count, end frame, activeTrackId)."
    - "A project whose only timeline content is physic-paint keys either exports its N frames (broken-read repair landed) or is proven never-wired, in which case the two RED contracts are parked as vitest todo contracts pointing at Phase 53 and the diagnosis is written into the SUMMARY (binding escalation clause)."
    - "No from-scratch paint-to-export wiring is implemented in this quick: no paint-only FrameEntry semantics, no per-frame compositor enumeration design, no canvas-clear lifecycle change, no selectedSequenceOnly filter redesign — those are Phase 53 scope."
  artifacts:
    - app/src/lib/exportEngine.paintEnumeration.test.ts — the discriminating matrix: 2 green controls, 2 paint-only RED contracts (or todo-parked on escalation), 1 green characterization of the selectedSequenceOnly+fx-active gap
    - .planning/quick/260919-azh-paint-content-never-reaches-export-accep/260919-azh-SUMMARY.md — carries the trace verdict (BROKEN-READ or NEVER-WIRED) with file:line evidence
  key_links:
    - "frameMap computed (frameMap.ts:16-47) materializes entries ONLY from kind==='content' keyPhotos; the tail-padding loop (frameMap.ts:42-45) is guarded on tailEntry existing — zero content keyPhotos means zero entries no matter what getTimelineRequiredFrameCount returns."
    - "startExport (exportEngine.ts:142-156) reads frameMap.peek(), applies the selectedSequenceOnly filter (activeSequenceId can name an fx sequence whose id no FrameEntry ever carries), then hard-errors at total===0 with 'No frames to export (timeline is empty)'."
    - "The RENDER leg is already wired and frameMap-independent: renderGlobalFrame's overlay loop (exportRenderer.ts:300-362) draws fx/physic-paint layers via the CMP-01 getFlattenedFrame seam for any global frame inside the sequence span; 52.1-05 preload (exportRenderer.ts:438-516, collectExportPhysicPaintFrameSources :64-94) gates decodes. Only the ENUMERATION leg is suspect."
---

<objective>
Close the Phase 53 acceptance blocker "paint content never reaches export": export fails with 'No frames to export (timeline is empty)' (exportEngine.ts:152-156) while preview/canvas/timeline render the painted content fine.

Planning-time static trace (all citations verified in-repo 2026-09-19): frameMap entries are built exclusively from content-sequence keyPhotos; physic-paint real keys only extend the REQUIRED COUNT via getTimelineRequiredFrameCount → getPhysicPaintRotoDisplayEndFrame → runtime reads (physicPaintStore.getRotoRealKeyRecords :3599 / getRotoPhysicalEndFrame :3843 — runtime-map reads, carrier-agnostic). The tail padding that would materialize those extra frames cannot fire when no content entry exists. The overlay RENDER leg never consults frameMap entries. So the break is in the enumeration leg, and the open question the executor must answer empirically is the one the escalation clause hinges on: broken read (52.2-era divergence — repairable in-quick) vs never wired (paint-only enumeration + range semantics were never designed — STOP, Phase 53 scope).

Purpose: restore (or correctly scope) the paint-to-export enumeration so Phase 53 acceptance is gated on facts, not suspicion.
Output: a discriminating test matrix committed RED, a written trace verdict, and either a bounded read repair (GREEN) or an escalation report with the design questions Phase 53 must answer.
</objective>

<execution_context>
@/Users/lmarques/Dev/efx-motion-editor/.claude/gsd-core/workflows/execute-plan.md
@/Users/lmarques/Dev/efx-motion-editor/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@app/src/lib/frameMap.ts
@app/src/lib/exportEngine.ts
@app/src/lib/exportRenderer.ts
@app/src/lib/exportEngine.test.ts
@app/src/lib/frameMap.test.ts
@app/src/lib/physicPaintFlush.ts

Mandatory skills for this zone (already loaded): efx-async-orchestration (export orchestration — do NOT introduce XState/Effect here; Rule 1 requires a named architectural problem and this quick is a minimal repair/diagnosis), efx-preact-reactivity (frameMap is a signals computed — keep signal reads exactly as they are; no new subscriptions).

Verified code facts (2026-09-19):
- frameMap.ts:16-47 — entries come only from `sequences.filter(s => s.kind === 'content')` keyPhotos; :41-45 pad the tail by replicating the last content entry up to `getTimelineRequiredFrameCount`, guarded by `tailEntry` being defined.
- frameMap.ts:244-259 — getTimelineRequiredFrameCount iterates ALL sequences (fx included), extends required by fx in/out range and by `seqStart + rotoEnd` for physic-paint layers.
- frameMap.ts:227-242 — getPhysicPaintRotoDisplayEndFrame reads runtime: no loopClips → `physicPaintStore.getRotoPhysicalEndFrame(layerId, trackId)`; trackId from `getEfxPaintDocument(layerId)?.activeTrackId ?? ''` (frameMap.ts:123-130, the user's cited line 124).
- physicPaintStore.ts:3599-3603 / :3843-3855 — getRotoRealKeyRecords and getRotoPhysicalEndFrame read the runtime maps (`_rotoRealKeyRecords`), never the document's frame carrier — a reference-only document does NOT empty these reads. This is why the 52.2 hypothesis must be proven empirically, not assumed.
- exportEngine.ts:145-150 — selectedSequenceOnly filters fm by `sequenceStore.activeSequenceId`; `selectedSequenceOnly` defaults false (exportStore.ts:29). createFxSequence does NOT set activeSequenceId (sequenceStore.ts:241-268), but sequenceStore.ts:1092 and :157 can leave an fx sequence active.
- exportRenderer.ts:138-140 — `hasContentEntry = !!seq && seq.kind !== 'fx'`; the content branch (:148-298) is the only caller passing clearCanvas=true to renderFrame; the fx overlay branch (:355-359) passes clearCanvas=false. Whether a no-content frame clears the export canvas between frames is unverified — Task 2 probe C records it as escalation evidence.
- exportEngine.test.ts harness (proven, reuse verbatim): vi.mock './ipc', './exportRenderer', './exportSidecar', './audioExportMixer', './audioEngine', '@tauri-apps/api/window', '../stores/projectStore', '../stores/soloStore', '../stores/paintStore'; vi.stubGlobal document/window/TestCanvas (:113-128, :255-258); `exportStore.outputFolder.value = '/tmp/...'` (:244); requestPhysicPaintFlush unmocked (returns false outside Tauri, physicPaintFlush.ts:26-28 + :36-37).
- frameMap.test.ts:111-131 — installRotoDocument pattern: registerDocument(makeTrackDocument(layerId)) + physicPaintStore.replaceRotoPhysicalDocument(layerId, 'track-1', {capacity, realKeyRecords, interpolation, scriptMotion, background, selectedKeyId, cursorAppFrame, loopClips, revision}) using testWebpBytes payloads.
- The DELIBERATE harness difference in the new file: do NOT mock './frameMap' or '../stores/sequenceStore' — the real computed reading the real stores is the subject under test.
- 260918-ovi UAT carve-out (pre-agreed 2026-09-18): "the 'No frames to export' enumeration defect reproduces on pre-ovi projects too (exonerates this quick; pre-existing 52.2-era read-path gap). It routes as its own quick BEFORE Phase 53 acceptance." Non-paint export at 1080×1920 passed in that UAT (row 1) — consistent with the control expectation.

Test discipline: `vitest run`, NEVER watch mode; pnpm, not npm; existing setup only, no one-off configs.
</context>

<tasks>

<task type="tracer" tdd="true">
  <name>Task 1: RED — paint-export enumeration discrimination matrix</name>
  <files>app/src/lib/exportEngine.paintEnumeration.test.ts</files>
  <behavior>
    One new test file, real `./frameMap` computed + real sequenceStore/physicPaintStore/efxPaintStore/exportStore, mocks and DOM stubs copied verbatim from exportEngine.test.ts (see context). beforeEach: sequenceStore.reset(), physicPaintStore.reset(), resetEfxPaintStore(), vi.clearAllMocks(), the stubGlobal block, exportStore.outputFolder.value = '/tmp/efx-export-paint-enum'. Sequence/layer fixtures reuse the frameMap.test.ts shapes (makeSequence keyPhotos, makeFxSequence with `source: { type: 'physic-paint', layerId }`, installRotoDocument with TEST_TRACK_ID 'track-1').
    - Control A (content-only, sub-discriminant baseline): one content sequence, 3 keyPhotos holdFrames 1 → startExport() ends status 'complete', renderGlobalFrame mock called exactly 3 times. PASSES today — proves global export is not broken (the description's "plain clip project" probe).
    - Control B (content + paint, wired-leg pin): content 3 keyPhotos + fx physic-paint sequence (inFrame 0, outFrame 3) with real keys at appFrames 0, 4, 8 → frameMap.value.length === 9 (tail padding over content) and startExport renders 9 frames. PASSES today (mirrors frameMap.test.ts:285-346 at the export level) — pins the leg that IS wired.
    - Case C (paint-only enumeration, RED contract): fx physic-paint sequence (inFrame 0, outFrame 5) with runtime real keys at appFrames 0..4 and NO content sequence anywhere → expect frameMap.value.length === 5. RED today (0): outFrame 5 and roto end 5 agree, so N=5 is unambiguous and no range-semantics design is smuggled into the expectation.
    - Case D (paint-only export, RED contract): same shape as C → await startExport(); expect status 'complete', renderGlobalFrame called exactly 5 times, and errorMessage never 'No frames to export (timeline is empty)'. RED today.
    - In-test probes inside Case C's arrange (PASS today, self-diagnosing): physicPaintStore.getRotoRealKeyRecords(LAYER, 'track-1').length === 5; physicPaintStore.getRotoPhysicalEndFrame(LAYER, 'track-1') === 5; getEfxPaintDocument(LAYER)?.activeTrackId === 'track-1'. If any probe fails, the 52.2 runtime-divergence hypothesis is CONFIRMED in-test and Task 2's verdict is BROKEN-READ with the failing probe as the named site.
    - Case E (selectedSequenceOnly + fx active, characterization — PASSES today): content 3 keyPhotos + fx paint (keys 0..4); sequenceStore.activeSequenceId.value = fx sequence id; exportStore.setSelectedSequenceOnly(true) → startExport errors with exactly 'No frames to export (timeline is empty)'. Characterizes the filter gap the description cites, without designing its fix (Phase 53).
  </behavior>
  <action>Write the test file RED-first per the behavior matrix (per the quick description's mandated order: RED before any trace/fix). Run it; confirm exactly Cases C and D fail and A, B, E pass with the in-test probes green. Commit: test(260919-azh): RED — paint-export enumeration discrimination matrix. If the RED/GREEN split differs from this expectation (e.g. a control fails, or a probe fails), STOP the task and record the actual split — it IS the diagnosis input for Task 2 and may flip the verdict to BROKEN-READ on the spot.</action>
  <verify>
    <automated>cd /Users/lmarques/Dev/efx-motion-editor/app && pnpm vitest run src/lib/exportEngine.paintEnumeration.test.ts</automated>
  </verify>
  <done>File committed; run output shows exactly 2 failing (C, D) and 3 passing (A, B, E) with all in-test probes passing — or the actual split recorded verbatim for Task 2.</done>
</task>

<task type="auto">
  <name>Task 2: Trace the enumeration read, render the verdict, apply the escalation gate</name>
  <files>app/src/lib/exportEngine.paintEnumeration.test.ts</files>
  <action>Diagnosis only — no production-code edits in this task. (1) Confirm Task 1's split and record it. (2) Static trace with file:line citations, verifying or correcting the planning-time read: frameMap.ts:16-47 construction and the tailEntry guard at :42-45; getTimelineRequiredFrameCount :244-259; getPhysicPaintRotoDisplayEndFrame :227-242; the runtime reads physicPaintStore.ts:3599-3603 and :3843-3855; startExport's gate exportEngine.ts:142-156. (3) Probe C: determine whether renderGlobalFrame ever clears the export canvas on a frame with no content entry (content branch exportRenderer.ts:148-298 passes clearCanvas=true; fx overlay branch :335-360 passes false; no top-level clear exists in :123-146) — record the finding as evidence; do NOT fix it here. (4) Probe D: grep ExportView/the export settings UI for how selectedSequenceOnly and the active sequence combine, to say whether the Case E shape is user-reachable. (5) VERDICT, recorded in the task output for the SUMMARY: BROKEN-READ iff a named existing read returned wrong data at runtime (the failing Task 1 probe or equivalent names the site; the repair is a read correction, not new enumeration semantics). Otherwise NEVER-WIRED: the paint-only enumeration branch and its FrameEntry/range semantics were never designed, and possibly the no-content canvas clear with them.
    ESCALATION GATE (binding, from the quick description): on NEVER-WIRED, convert exactly Cases C and D to vitest todo contracts whose titles carry the Phase 53 pointer (e.g. it.todo('Case C ... — Phase 53: paint-only export enumeration')), keep A, B, E green, STOP the quick: skip Task 3 entirely and write the SUMMARY with verdict NEVER-WIRED, the evidence list, and the design questions Phase 53 must answer (paint-only FrameEntry ownership/transparency; N derivation from fx span vs key extent; canvas clear lifecycle on no-content frames; selectedSequenceOnly semantics when the active sequence is an fx sequence). Do not implement any of that wiring here — the clause is explicit.</action>
  <verify>
    <automated>Escalation branch: cd /Users/lmarques/Dev/efx-motion-editor/app && pnpm vitest run src/lib/exportEngine.paintEnumeration.test.ts (exits 0) && grep -c 'it\.todo' src/lib/exportEngine.paintEnumeration.test.ts (equals 2). Broken-read branch: same vitest command still shows exactly C and D red with the named failing probe.</automated>
  </verify>
  <done>Verdict recorded with citations; escalation branch leaves the file green with exactly 2 parked todo contracts and the quick halts; broken-read branch hands Task 3 a named read site.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 3: (BROKEN-READ only) Minimal read repair, GREEN, full suite</name>
  <files>app/src/lib/frameMap.ts (or the single store read site Task 2 names — bounded to the enumeration read chain: frameMap.ts, physicPaintStore.ts, efxPaintStore.ts)</files>
  <precondition>Task 2 verdict is BROKEN-READ with a named site. If the verdict is NEVER-WIRED this task does not run — the escalation gate already ended the quick.</precondition>
  <behavior>
    - The repaired read makes the failing Task 1 cases pass WITHOUT introducing paint-only FrameEntry synthesis, per-frame compositor enumeration, canvas-clear lifecycle changes, or selectedSequenceOnly filter redesign (all Phase 53 design).
    - If the repair makes C and D pass as written: they stay as the permanent regression contracts.
    - If the repair is real but C/D still cannot pass without design work: convert C and D to vitest todo contracts pointing at Phase 53 and add one dedicated regression test that pins the repaired read itself (name it after the divergence, e.g. 'enumeration read resolves the document activeTrackId runtime records').
  </behavior>
  <action>Implement the minimal read repair at the named site (TDD: the failing tests already exist — go straight to GREEN). Keep the change surgical; frameMap stays a pure computed with its current signal reads (efx-preact-reactivity: no new subscriptions). No XState/Effect (efx-async-orchestration Rule 1 — no named architectural problem here). Then run the new file plus the neighboring suites, then the full app suite. Commit: fix(260919-azh): &lt;named read repair&gt;. If anything in the repair drifts toward designing enumeration semantics, STOP and fall back to the escalation path instead.</action>
  <verify>
    <automated>cd /Users/lmarques/Dev/efx-motion-editor/app && pnpm vitest run src/lib/exportEngine.paintEnumeration.test.ts src/lib/frameMap.test.ts src/lib/exportEngine.test.ts src/lib/exportEngine.loops.test.ts && pnpm vitest run</automated>
  </verify>
  <done>Targeted files green; full `vitest run` green (pre-existing failures, if any, must be byte-identical to the plan base — the 52.2-03 carry list in STATE.md Blockers); either the paint-only contracts pass or they are parked as todo with the read repair pinned by its own regression test.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| document ↔ runtime (efx-paint) | The audited seam: registered EfxPaintDocument (possibly reference-only carriers post-52.2) vs the runtime byte-carrying projection. Read-only in this quick; Task 2's verdict confirms or exonerates a divergence. |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-AZH-01 | Information Disclosure | export error messages ('No frames to export', loop-block copy) | low | accept | Existing copy is internal, path-free, and unchanged by this quick (test + read repair only); no new user-facing strings introduced. |
| T-AZH-02 | Tampering | frameMap computed / runtime read sites | low | mitigate | Any Task 3 repair is pinned by the Task 1 contract matrix run under `vitest run`; repair is forbidden from introducing new enumeration semantics (escalation gate), which also forbids new attack surface. |

No package-manager installs in scope; the package-legitimacy row is not applicable to this quick. ASVS L1, block on high: nothing at or above high identified.
</threat_model>

<verification>
- `cd /Users/lmarques/Dev/efx-motion-editor/app && pnpm vitest run src/lib/exportEngine.paintEnumeration.test.ts` — green either way (contracts pass, or C/D parked as it.todo ×2 on escalation).
- Full `pnpm vitest run` — no new failures vs the plan base (52.2-03 carried failures documented in STATE.md remain their owners').
- Escalation path additionally: `git diff --stat` shows NO production-code changes (test file + planning artifacts only) — proving the escalation clause was honored.
</verification>

<success_criteria>
- The sub-discriminant is answered with evidence: content-only export works (Control A green) — the break is paint-specific.
- The 52.2 divergence hypothesis is confirmed or exonerated by in-test probes, not by assumption.
- Either (a) BROKEN-READ: the named read is repaired, contracts green, full suite green; or (b) NEVER-WIRED: quick halts after RED + diagnosis, C/D parked as Phase 53 todo contracts, SUMMARY carries the verdict and the exact design questions — no partial wiring shipped.
- Phase 53 acceptance is unblocked either way: by the fix, or by a scoped, evidence-backed escalation report.
</success_criteria>

<output>
Create `.planning/quick/260919-azh-paint-content-never-reaches-export-accep/260919-azh-SUMMARY.md` when done. It MUST record: the Task 1 RED/GREEN split, the Task 2 verdict with file:line evidence, probe C's canvas-clear finding, and — on escalation — the Phase 53 design questions verbatim.
</output>
