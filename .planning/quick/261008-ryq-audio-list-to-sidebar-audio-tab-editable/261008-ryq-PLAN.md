---
phase: quick-261008-ryq
plan: 261008-ryq
type: execute
wave: 1
depends_on: []
files_modified:
  - app/src/components/physic-paint/view/PhysicsPaintRightPanel.tsx
  - app/src/components/physic-paint/PhysicsPaintStudio.tsx
  - app/src/components/physic-paint/physicsPaintStudio.css
  - app/src/components/physic-paint/view/PhysicsPaintAudioListSection.tsx
  - app/src/components/physic-paint/view/PhysicsPaintAudioModalView.tsx
  - app/src/components/physic-paint/view/physicsPaintAudioController.ts
  - app/src/components/physic-paint/view/physicsPaintStudioKeyboard.ts
  - app/src/components/physic-paint/view/PhysicsPaintRightPanel.test.ts
  - app/src/components/physic-paint/view/PhysicsPaintRightSidebar.test.ts
  - app/src/components/physic-paint/view/PhysicsPaintScriptsPanel.test.ts
  - app/src/components/physic-paint/view/PhysicsPaintAudioModalView.test.ts
  - app/src/components/physic-paint/view/physicsPaintAudioController.test.ts
  - app/src/components/physic-paint/view/physicsPaintStudioKeyboard.test.ts
  - app/src/components/physic-paint/PhysicsPaintStudio.test.ts
autonomous: true
requirements: [QUICK-261008-RYQ]

estimate:
  tokens: 55000
  raw_tokens: 27500
  tasks: 2
  confidence: low

must_haves:
  truths:
    - "The Studio right sidebar tool pane shows three tabs labeled exactly Paint, Track, Audio (Background option stays conditional and last); the Audio tab lists every placed clip with filename, startFrame · inFrame..outFrame, On/Off and a selected-row highlight; the modal shows only the selected clip."
    - "Clicking a list row selects that clip, reveals it in the timeline (one-shot scroll to its band), and opens the modal — all three effects applied in the click handler, never a deferred effect."
    - "Deletion works from all three surfaces and each removes only the targeted clip: list-row Trash2 is two-step (first press selects + arms, second confirms), modal Remove keeps its two-step arm, Delete/Backspace is one-shot on both the modal-open and modal-closed paths; the Background-clip branch still wins when both are selected and the key never fires while typing in a stepper or select."
    - "Position (frames) is a NumericStepper (step 1, min 0, per-step commit through commitStartFrame) placed after the File row and before Remove + On/Off; integer >= 0 commits, negative/fractional/NaN never commits (prior value stays, no upper clamp); the clip moves on the timeline without dragging and the value survives closing and reopening the modal."
    - "No regression in the multi-audio core: both duplicated clips still sound at their own positions and both repeat under play loop (the dup-clip-plays-audios-0 fix untouched — this quick changes no transport or store code)."
    - "The quick lands as two atomic commits (one per feature); pnpm typecheck is clean and the full vitest run has no NEW failures versus the pre-quick baseline."
  artifacts:
    - app/src/components/physic-paint/view/PhysicsPaintAudioListSection.tsx
    - app/src/components/physic-paint/view/PhysicsPaintRightPanel.tsx
    - app/src/components/physic-paint/PhysicsPaintStudio.tsx
    - app/src/components/physic-paint/physicsPaintStudio.css
    - app/src/components/physic-paint/view/PhysicsPaintAudioModalView.tsx
    - app/src/components/physic-paint/view/physicsPaintAudioController.ts
    - app/src/components/physic-paint/view/physicsPaintStudioKeyboard.ts
    - app/src/components/physic-paint/view/PhysicsPaintRightPanel.test.ts
    - app/src/components/physic-paint/view/physicsPaintAudioController.test.ts
    - app/src/components/physic-paint/view/physicsPaintStudioKeyboard.test.ts
  key_links:
    - "rightPanel memo factory (PhysicsPaintStudio.tsx:3560, runs synchronously on first render) → audioSectionPortsRef created BEFORE it → getController()/handlers invoked only at child-render or click time (the backgroundClipSectionPortsRef:3512 precedent — the audioModalController binding at :4688 does not exist when the factory first runs)"
    - "list row click → ports.onSelectClip → selectedSoundId write + revealSoundClip → revealRequest nonce → PhysicsPaintWorkflowStrip consumes it once per nonce (260922-qad reveal machinery, unchanged)"
    - "dispatchPhysicsPaintStudioKeyDown Delete/Backspace branch order: Background clip → selected sound clip → roto key (Bg precedence when both are selected)"
    - "commitStartFrame → commitPatch → per-clip patchSound store door (the SAME persistence chain the band drag settles through)"
---

<objective>
Move the multi-audio clip list out of the Document sounds modal into a new Audio tab in the Studio right sidebar (with three-surface deletion), and add an editable Position (frames) field to the modal so a clip can be placed without dragging its band.

Purpose: these are the two final UX changes the user locked after live-testing the 261008-ig1 multi-audio core and the dup-clip transport fix; the feature is considered done once both UAT-pass.
Output: a new PhysicsPaintAudioListSection component behind an explicit Audio tab arm, a single-clip modal, one-shot keyboard deletion through the existing controller, a commitStartFrame controller method plus the Position stepper — two atomic commits.
</objective>

<execution_context>
@/Users/lmarques/Dev/efx-motion-editor/.claude/gsd-core/workflows/execute-plan.md
@/Users/lmarques/Dev/efx-motion-editor/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.claude/skills/efx-preact-reactivity/SKILL.md
@.planning/quick/261008-ig1-multi-audio-concept-written-to-planning-/261008-ig1-SUMMARY.md
@.planning/quick/261008-ful-2-small-ux-features-one-atomic-commit-ea/261008-ful-SUMMARY.md

STATE.md carries the FULL approved spec for this quick (context, locked decisions, approach, verification) — treat it as the authoritative task definition; this plan operationalizes it. Locked decisions: vehicle = /gsd-quick in milestone 52.5; visible Remove controls keep the two-step arm, the Delete/Backspace key is one-shot; tab labels Paint | Track | Audio.

Key files (read before implementing; landmarks verified live 2026-10-08):
- app/src/components/physic-paint/view/PhysicsPaintRightPanel.tsx — the tab bar. Union sites: prop `toolTab?: Signal<'paint' | 'track' | 'background'>` :67, `setToolTab` :281, `selectToolTab(tab: 'paint' | 'track')` :286-289 (widens and keeps clearing the Bg-clip selection), `effectiveToolTab` :280 (Bg selection forces 'background'; stale 'background' falls back to 'track'). Buttons: Paint :624-632 (`physics-paint-tab-paint-option`), Track :633-641, conditional Background option :646-656 (stays LAST, selection-forced). Content ternary :661-701: paint arm :661, background arm :678, track FALLBACK :683 — an unknown tab silently falls through to Track today; the new `audio` arm must be explicit. `backgroundClipSection?: PhysicsPaintBackgroundClipSectionProps` :59 is the section-prop precedent.
- app/src/components/physic-paint/PhysicsPaintStudio.tsx — `rightPanelToolTab` signal :438; `launchContext` useState :451; `selectedBackgroundClipId` :425; keyboard hook call `usePhysicsPaintStudioKeyboard({ state: {...} , actions: {...} })` :3111-3175 (`hasSelectedBackgroundClip` :3120, `deleteBackgroundClip` :3158); rightPanel identity memo `rightPanelPropsMemo.resolve([deps…], factory)` :3560 (deps end `…, backgroundClipSectionPortsRef, rightPanelToolTab`; factory entry `backgroundClipSection` :3598-3600; `createIdentityMemo` runs build() SYNCHRONOUSLY whenever deps change — first call at :3560); `backgroundClipSectionPortsRef = useRef({...})` :3512 is the ports-ref precedent; audio signal block :4649-4676 (`selectedSoundId` :4668, `audioModalTarget: Signal<'list' | string | null>` :4669, `audioImportMode`, `revealRequest`, `knownAudioPaths`, `audioProjectDir` + refresh fn :4677); `usePhysicsPaintAudioController` :4688-4703; `audioPicker` :4709; `audioModal` object :4783-4810 (`onImportRequest` :4790-4793, `onSelectSoundClip` :4796-4804 = select + revealSoundClip, does NOT open the modal today); `handleDocumentSoundGestureSettle` :4878-4904 (band drag — unchanged); `resolveDocumentAudios` :4909; `revealSoundClip` :4917-4924 (nonce); header launcher `onOpenDocumentSound` :5004-5017 (today: single clip resolves onto it, stale selection clears, then writes `'list'`); band dblclick :5018-5021 (unchanged); viewModel entry `audioModal` :5189, picker title `AUDIO_IMPORT_CTA` :5187 (unchanged).
- app/src/components/physic-paint/physicsPaintStudio.css — tab flex rule :1067-1069 (`.physics-paint-tab-paint-option, .physics-paint-tab-track-option { flex: 1 1 0; }`); NO styles exist anywhere for `physics-paint-audio-clip-list` / `-clip-row` / `-clip-span` (grep across app/src/*.css is empty) — the sidebar list needs fresh CSS.
- app/src/components/physic-paint/view/PhysicsPaintAudioModalView.tsx — component doc + verbatim field-order contract :6-46 (order list :25-34, Copywriting Contract block :13-23); exported copy constants :52-74 (`AUDIO_IMPORT_CTA` :55 — reused by the new list's Import button); props :78-107 (`onSelectSoundClip` :95 to be removed with the list); controller destructure :179-185; `onKeyDown` :201-207 (stopPropagation, Escape only today); empty state `audios.length === 0` :254-275 (KEEP — the zero-clip case, with its own Import CTA); the clip-list block to delete :278-308 (rows + Import, `data-testid="audio-modal-list"`); File row + error copy :311-331; Remove + On/Off + confirm copy :333-369; Gain NumericStepper precedent :371-388; fades :390-436; In|Out :438-465. Numbered JSX comment anchors: `{/* 3.` Remove, `{/* 4.` Gain, `{/* 5-6.` fades, `{/* 7.` trims (the test file slices on them).
- app/src/components/physic-paint/view/physicsPaintAudioController.ts — interface :73-140 (`removeArmed` getter :96, commit methods :104-113, `requestRemove`/`confirmRemove` :113-114); `isValidFadeFrames` :162-164 = integer >= 0 (reuse for commitStartFrame); hook :241+; `removeArmedClipId` signal :270; `commitPatch` fail-closed per-clip door :271-278 (takes Partial<DocumentSoundClip> — `startFrame` routes through it, no new store door); `commitInFrame`/`commitOutFrame` :324-339 (the E8/E9 prior-value-stays pattern); `requestRemove` :347-352 (today gated on the render-time `sound`); `confirmRemove` :354-364 (fail-closed: armed id must equal LIVE selection); return object :414+.
- app/src/components/physic-paint/view/physicsPaintStudioKeyboard.ts — state interface :4-19 (`hasSelectedBackgroundClip?` :13), actions interface :21-70 (`deleteBackgroundClip?` :38); `isPhysicsPaintShortcutTarget` :67-73 (false for input/textarea/select/contentEditable); `dispatchPhysicsPaintStudioKeyDown` :110+ with the top shortcut-target guard :117; Delete/Backspace block :169-196 — Bg branch :182-190 (document-wide `[aria-modal="true"]` guard, preventDefault before the mutationLocked check), roto branch :191-195. The new sound branch goes BETWEEN them.
- TDZ law: the keyboard state object at :3111 reads `selectedSoundId` — but that signal is declared at :4668, AFTER :3111, so a direct read there throws on first render. The audio signal block (pure useSignal declarations) must move EARLIER (beside `selectedBackgroundClipId` :425); the controller (:4688) and handlers (:4783+) stay put and are only reached through lazy arrow functions created in the ports ref / actions object.
- Tests (vitest collects ONLY src/**/*.test.ts — never author .test.tsx; app/vitest.config.ts untouched; tsconfig noUnusedLocals/noUnusedParameters on): view/PhysicsPaintRightPanel.test.ts (HookRuntime render harness + label pins ~:252-253); view/PhysicsPaintRightSidebar.test.ts (source pins; :48 `expectInOrder(toolTabs, ['Paint option', 'Track option', 'Background option'])`); view/PhysicsPaintScriptsPanel.test.ts (:114 `expect(rightPanel.match(/role="tab"/g)).toHaveLength(6)` — becomes 7 with the Audio tab); view/PhysicsPaintAudioModalView.test.ts (source-string style; clip-list describe :45-76 asserts the list EXISTS in the modal — it must be rewritten; Gain describe slices `{/* 4.` → `{/* 5-6.`); view/physicsPaintAudioController.test.ts (`makeController` harness :155 with faked addSound/patchSound/removeSound ports); view/physicsPaintStudioKeyboard.test.ts (TestHTMLElement harness, Bg-clip describe :733-807 is the template for the sound-delete describe); PhysicsPaintStudio.test.ts audio describe :2346-2384 (pins `useSignal<'list' | string | null>` :2352 and `audioModalTarget.value = 'list'` :2358 — both change).
- Reuse, do not reimplement: NumericStepper (app/src/components/shared/NumericStepper.tsx), `revealSoundClip`/`revealRequest` (260922-qad one-shot reveal), the controller's `removeArmedClipId` two-step arm, `patchDocumentSound`/`removeDocumentSound` store doors, AUDIO_* copy constants.

Constraints honored: Preact + @preact/signals only (no useState for this state, no render-body signal writes, selection applied in the click handler — efx-preact-reactivity); one atomic commit per feature (Task 1 = commit 1, Task 2 = commit 2); no new state model, no new store door, no second delete arm; the Audio Preview header toggle stays; no new packages (zero install surface); PATH FORM (repo-root-relative paths in this plan body); pnpm, vitest run only (never watch), no dev server, no push, native visual UAT stays with the user (no Chrome DevTools MCP).
</context>

<!-- planner-discipline-allow: physics-paint-audio-clip-list -->
<!-- planner-discipline-allow: audio-modal-list -->
<!-- planner-discipline-allow: onSelectSoundClip -->
<!-- planner-discipline-allow: = 'list' -->

<tasks>

<task type="auto">
  <name>Task 1: Audio list moves to the sidebar Audio tab; modal becomes the single-clip editor; three delete surfaces</name>
  <files>app/src/components/physic-paint/view/PhysicsPaintRightPanel.tsx, app/src/components/physic-paint/PhysicsPaintStudio.tsx, app/src/components/physic-paint/physicsPaintStudio.css, app/src/components/physic-paint/view/PhysicsPaintAudioListSection.tsx, app/src/components/physic-paint/view/PhysicsPaintAudioModalView.tsx, app/src/components/physic-paint/view/physicsPaintAudioController.ts, app/src/components/physic-paint/view/physicsPaintStudioKeyboard.ts, app/src/components/physic-paint/view/PhysicsPaintRightPanel.test.ts, app/src/components/physic-paint/view/PhysicsPaintRightSidebar.test.ts, app/src/components/physic-paint/view/PhysicsPaintScriptsPanel.test.ts, app/src/components/physic-paint/view/PhysicsPaintAudioModalView.test.ts, app/src/components/physic-paint/view/physicsPaintAudioController.test.ts, app/src/components/physic-paint/view/physicsPaintStudioKeyboard.test.ts, app/src/components/physic-paint/PhysicsPaintStudio.test.ts</files>
  <reversibility rating="reversible">A UI relocation plus handler plumbing over existing signals/controller/store machinery — no model, persistence, or transport changes; a git revert restores the modal list and drops the tab.</reversibility>
  <action>Read .claude/skills/efx-preact-reactivity/SKILL.md first: no useState for this state, no render-body signal writes, selection applied IN the click handler (never a deferred effect), identity-stable handler deps. Six coordinated edits, then pins.

(1) Tab bar — app/src/components/physic-paint/view/PhysicsPaintRightPanel.tsx. Widen the tab union to `'paint' | 'track' | 'background' | 'audio'` at all four live sites: the Studio signal (PhysicsPaintStudio.tsx:438), the RightPanel prop (:67), setToolTab (:281), selectToolTab (:286 — widen its parameter to `'paint' | 'track' | 'audio'`, keep the Bg-selection clearing at :288). Insert a new tab button AFTER the Track button (:633-641) and BEFORE the conditional Background option button (:646-656, which stays last and selection-forced): class `physics-paint-tab-audio-option`, role="tab", aria-selected bound to `effectiveToolTab === 'audio'`, onClick={() => selectToolTab('audio')}, label text `Audio`. Relabel the existing buttons verbatim: `Paint option` → `Paint`, `Track option` → `Track` (Background option keeps its label). In the content ternary (:661-701) add an EXPLICIT `effectiveToolTab === 'audio'` arm rendering the new list section — place it between the background arm (:678) and the track fallback (:683) so the audio tab can never fall through to Track. The panel aria-labels (`Paint options`/`Track options` on the tabpanels) stay as they are.

(2) New file app/src/components/physic-paint/view/PhysicsPaintAudioListSection.tsx (beside the modal view). Export `AudioSectionPorts = { getController: () => PhysicsPaintAudioController; onSelectClip: (clipId: string) => void; onImportRequest: (mode: 'append' | 'replace') => void }` and a component taking `{ ports: AudioSectionPorts }`. Render body: `const controller = ports.getController();` then `controller.audios.map(...)` — one row per clip reusing the modal's row shape and copy: filename (basename of relativePath), `{clip.startFrame} · {clip.inFrame}..{clip.outFrame}`, `On`/`Off` (import AUDIO_ENABLE_ON/OFF/AUDIO_IMPORT_CTA/AUDIO_LOADING from the modal view), selected highlight via `controller.selectedSoundId.value === clip.id` (read in the render body — it subscribes the section). Row click: `ports.onSelectClip(clip.id)` directly in onClick. Row delete: a small Trash2 (lucide-preact) button whose handler is — if `controller.removeArmed` AND the row is the selected row → `controller.confirmRemove()`; else → write `controller.selectedSoundId.value = clip.id` then `controller.requestRemove()` (first press selects + arms, second confirms — the EXISTING `removeArmedClipId` arm, never a second one). Import button: `controller.disarmRemove()` then `ports.onImportRequest('append')`, disabled while `controller.busy`, label flips to AUDIO_LOADING while busy (mirror the modal). Container carries `data-testid="audio-list-section"`.

(3) Studio wiring — app/src/components/physic-paint/PhysicsPaintStudio.tsx. (a) MOVE the audio signal block (selectedSoundId, audioModalTarget, audioImportMode, revealRequest, knownAudioPaths, audioProjectDir — the pure useSignal declarations and their doc comment, :4668-4676) up beside `selectedBackgroundClipId` (:425); the refresh function and everything from `usePhysicsPaintAudioController` (:4688) down stay where they are. This is REQUIRED: the keyboard state object at :3111 reads `selectedSoundId` and would hit the TDZ otherwise. Retype `audioModalTarget` to `Signal<string | null>` (the `'list'` mode is gone — the list is always on screen) and update its doc comment. (b) Beside `backgroundClipSectionPortsRef` (:3512), before the rightPanel memo, create `audioSectionPortsRef = useRef<AudioSectionPorts>({...})` whose members are LAZY arrows: `getController: () => audioModalController`; `onSelectClip: (clipId) => { const clip = resolveDocumentAudios().find(c => c.id === clipId); if (!clip) return; audioModalController.disarmRemove(); selectedSoundId.value = clip.id; revealSoundClip(clip); audioModalTarget.value = clip.id; }` (select + reveal + OPEN — the three row-click effects in the handler); `onImportRequest: (mode) => { audioImportMode.value = mode; void audioPicker.openPicker(); }`. Arrow bodies referencing bindings declared later (audioModalController :4688, audioPicker :4709, revealSoundClip :4917, resolveDocumentAudios :4909) are safe — they only run at child-render/click time; NEVER call getController() inside the memo factory itself. (c) In the memo factory (:3560) add `audioSectionPorts: launchContext?.layerId ? audioSectionPortsRef.current : undefined` and add `audioSectionPortsRef` to the deps array (symmetry with backgroundClipSectionPortsRef; `efxPaintVersion.value` is already a dep so the rows refresh on document edits). (d) Rewrite `onOpenDocumentSound` (:5004-5017): `const audios = resolveDocumentAudios(); if (audios.length === 0) { audioModalTarget.value = ''; } else { const current = selectedSoundId.peek(); if (current === null || !audios.some(c => c.id === current)) selectedSoundId.value = audios[0].id; audioModalTarget.value = selectedSoundId.peek() ?? ''; }` — auto-selects the first clip when none is selected, opens on the selected clip, and the empty-string target keeps the zero-clip empty state reachable (open test is `!== null`). Band dblclick (:5018-5021) unchanged. (e) Remove `onSelectSoundClip` from the `audioModal` object (:4796-4804) — the ports ref now owns that behavior; keep every other audioModal member.

(4) RightPanel prop + CSS. In PhysicsPaintRightPanel.tsx add the optional prop `audioSectionPorts?: AudioSectionPorts` (type imported from the new component) and pass it to the `audio` arm: `<PhysicsPaintAudioListSection ports={audioSectionPorts!} />` behind the explicit arm. In app/src/components/physic-paint/physicsPaintStudio.css add `.physics-paint-tab-audio-option` to the flex rule at :1067-1069, and add compact styles for the list (container spacing, row layout with filename left / span + On-Off right, a distinct selected-row highlight, a small icon-only trash button) — these classes have no styles anywhere today. Do not touch any other rule.

(5) Modal becomes single-clip — app/src/components/physic-paint/view/PhysicsPaintAudioModalView.tsx. Delete the clip-list block (:278-308) entirely (rows + its Import button). Remove the `onSelectSoundClip` prop from the interface (:95) and the destructure (:116) — noUnusedLocals/typecheck enforce this. Keep the empty state (:254-275) gated on `audios.length === 0` with its Import CTA, the File row/error copy, Remove + On/Off, Gain, fades, In|Out, and the header Audio Preview toggle byte-untouched. In `onKeyDown` (:201-207), after the existing stopPropagation, handle one-shot deletion: when `event.key` is Backspace or Delete with NO meta/ctrl/alt/shift modifiers and `!event.repeat`, and `isPhysicsPaintShortcutTarget(event.target)` passes (import it from './physicsPaintStudioKeyboard' — no import cycle), then `event.preventDefault(); controller.removeSelected();`. Update the field-order contract comment (:25-34): step 2 no longer mentions the clip list (file row / empty state / error copy only); note in the component doc that the list now lives in the sidebar Audio tab. The Copywriting Contract strings themselves stay verbatim.

(6) Controller + keyboard module. app/src/components/physic-paint/view/physicsPaintAudioController.ts: (a) re-gate `requestRemove` (:347-352) on the LIVE selection instead of the render-time `sound`: return when `selectedSoundId.value === null` or that id is not in `audios`; otherwise stamp `removeArmedClipId.value = selectedSoundId.value` — this keeps the exact old fail-closed semantics while letting a list-row handler select + arm in one click (the render-time `sound` snapshot predates the handler's selection write). `confirmRemove` (:354-364) and the armed-clip law stay untouched. (b) Add `removeSelected()` to the interface and implementation: one-shot removal for the keyboard paths — return when the live selection is null or unknown; `removeSound(layerId, id)`; on `result.ok` clear BOTH `selectedSoundId` and `removeArmedClipId`. Doc-comment it as the keyboard one-shot; visible buttons keep requestRemove/confirmRemove. app/src/components/physic-paint/view/physicsPaintStudioKeyboard.ts: add `hasSelectedSoundClip?: boolean` to the state interface and `removeSelectedSound?: () => void` to the actions interface (doc comments); in the Delete/Backspace block insert a branch BETWEEN the Bg branch (:182-190) and the roto branch (:191) with the Bg branch's exact shape: when `state.hasSelectedSoundClip && actions.removeSelectedSound` — document-wide `[aria-modal="true"]` guard, then `event.preventDefault()`, then `if (state.mutationLocked) return;`, then `actions.removeSelectedSound(); return;`. Bg first means Bg wins when both are selected; the roto branch is untouched. Back in PhysicsPaintStudio.tsx at the hook call: state gains `hasSelectedSoundClip: selectedSoundId.value !== null` (safe now — the signal moved to :425), actions gains `removeSelectedSound: () => audioModalController.removeSelected()` (MUST stay an arrow — audioModalController is declared later and is only touched at keydown time).

(7) Pins — update these known breaking assertions and any sibling the grep surfaces (`grep -rn "Paint option\|Track option\|role=\\"tab\\"" app/src --include="*.test.ts"`):
- PhysicsPaintAudioModalView.test.ts: rewrite the clip-list describe → a single-clip describe: file-wide negatives that the modal no longer renders the rows container or the onSelectSoundClip prop; positives that the empty state is still gated on `audios.length === 0`, that the onKeyDown slice contains the Backspace/Delete branch with the isPhysicsPaintShortcutTarget guard and removeSelected, and that the contract comment no longer lists the clip list. Keep the Gain describe's `{/* 4.` / `{/* 5-6.` anchors working (Task 1 must not renumber JSX comments).
- PhysicsPaintRightPanel.test.ts: update the label pins (~:252-253) to Paint/Track/Audio; add render cases with a fake `audioSectionPorts` (hand-rolled controller object with vi.fn()s + a real `signal()` selection, mirroring the file's existing fake-port style): the audio arm renders rows with the selected highlight, a row click calls `onSelectClip` with that clip id, the trash button calls requestRemove then confirmRemove across two presses, Import calls `onImportRequest('append')`.
- PhysicsPaintRightSidebar.test.ts:48 → `expectInOrder(toolTabs, ['Paint', 'Track', 'Audio', 'Background option'])`.
- PhysicsPaintScriptsPanel.test.ts:114 → tab count 6 → 7 (and the describe title/comment wording if it names the labels).
- PhysicsPaintStudio.test.ts :2346-2384: the signal-type pin becomes `Signal<string | null>`; the launcher case is retargeted to the new body (`audios.length === 0`, `selectedSoundId.value = audios[0].id`, the empty-string target) instead of the `'list'` write; dblclick/`!== null`/`= null` pins stay. Add pins for `hasSelectedSoundClip: selectedSoundId.value !== null` and `removeSelectedSound: () => audioModalController.removeSelected()`.
- physicsPaintAudioController.test.ts: add cases — `removeSelected` calls removeSound once with the selected clip and clears selection with no arm involved; `removeSelected` no-ops with null/unknown selection; the requestRemove gate fix (fresh controller with null selection → write the signal → requestRemove → confirmRemove removes THAT clip).
- physicsPaintStudioKeyboard.test.ts: a describe mirroring the Bg-clip one (:733-807) — Delete fires removeSelectedSound for a selected sound; Bg branch wins when both flags set (removeSelectedSound NOT called); falls through to roto when no sound selected; suppressed while the target is an input; suppressed with modifiers/repeat; mutationLocked prevents the action.
One atomic commit with all Task 1 files.</action>
  <verify>
    <automated>pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint/view/PhysicsPaintRightPanel.test.ts src/components/physic-paint/view/PhysicsPaintRightSidebar.test.ts src/components/physic-paint/view/PhysicsPaintScriptsPanel.test.ts src/components/physic-paint/view/PhysicsPaintAudioModalView.test.ts src/components/physic-paint/view/physicsPaintAudioController.test.ts src/components/physic-paint/view/physicsPaintStudioKeyboard.test.ts src/components/physic-paint/PhysicsPaintStudio.test.ts && pnpm --filter efx-motion-editor run typecheck</automated>
  </verify>
  <done>Sidebar tool pane shows Paint | Track | Audio (Background option still conditional and last) with an explicit audio arm rendering PhysicsPaintAudioListSection; row click selects + reveals + opens the modal from the handler; Import lives on the list; list-trash/Modal-Remove are two-step on the one shared arm, Delete/Backspace is one-shot on both paths with Bg precedence and the stepper-focus guard; the modal renders only the selected clip (empty state only at zero clips) with its contract comment updated; typecheck clean; the seven test files above green; exactly one atomic commit.</done>
</task>

<task type="auto">
  <name>Task 2: Editable Position (frames) stepper commits startFrame in the modal</name>
  <files>app/src/components/physic-paint/view/physicsPaintAudioController.ts, app/src/components/physic-paint/view/PhysicsPaintAudioModalView.tsx, app/src/components/physic-paint/view/physicsPaintAudioController.test.ts, app/src/components/physic-paint/view/PhysicsPaintAudioModalView.test.ts</files>
  <reversibility rating="reversible">An additive controller method plus one modal field over the existing per-clip patch door; reverting drops the stepper with no model or persistence changes.</reversibility>
  <action>Placement/contract (locked): new contract step 3, AFTER the File row / error copy and BEFORE Remove + On/Off. Final order: header → File row → `Position (frames)` → Remove + On/Off → `Gain` → `Fade in`|`Fade out` → `In`|`Out`.

(1) Controller — app/src/components/physic-paint/view/physicsPaintAudioController.ts. Add `commitStartFrame(frames: number): void` to the interface beside commitInFrame/commitOutFrame (:108-109) with a doc comment, and implement it beside them (:324-339): `disarmRemove(); if (!isValidFadeFrames(frames)) return; if (!sound) return; commitPatch({ startFrame: frames });` — integer >= 0 only (isValidFadeFrames is exactly that law), invalid never commits so the prior accepted value stays (the E8/E9 pattern), NO upper clamp (the band drag is already free), routed through the existing commitPatch per-clip door (no new store door). Add it to the returned object.

(2) Modal field — app/src/components/physic-paint/view/PhysicsPaintAudioModalView.tsx. Export `AUDIO_POSITION_LABEL = 'Position'` with the other constants. Destructure `commitStartFrame` from the controller (:179-185). Insert a new field block after the File row + error copy (:311-331) and BEFORE the Remove + On/Off comment block (`{/* 3.`): label row reading `Position (frames)` (constant + `(frames)` in the markup, the fades-label pattern) wrapping `<NumericStepper class="physics-paint-audio-field-stepper" value={sound.startFrame} step={1} min={0} onChange={(value) => commitStartFrame(value)} ariaLabel={AUDIO_POSITION_LABEL} disabled={controlsDisabled} ariaDisabled={controlsDisabled} />` — exactly the Gain usage shape (:377-387), per-step commit. Then renumber the numbered JSX step comments and the field-order contract comment to the locked order: `{/* 3. Position (frames) */}` (new), `{/* 4. Remove + On/Off ... */}`, `{/* 5. Gain ... */}`, `{/* 6-7. Fade in | Fade out ... */}`, `{/* 8. In | Out ... */}` — and step 3 in the header contract list (:25-34).

(3) Pins. app/src/components/physic-paint/view/physicsPaintAudioController.test.ts: extend the makeController describe — commitStartFrame(42) patches `{ startFrame: 42 }` on the SELECTED clip only (patchSound called once with layerId + clip id); -1, 2.5, NaN → no patchSound call (prior value stays); null/unknown selection → no patch; 1000000 commits (no upper clamp). PhysicsPaintAudioModalView.test.ts: retarget the Gain describe's slice anchors to the renumbered comments (`{/* 5.` → `{/* 6-7.`) and add a Position describe slicing `{/* 3.` → `{/* 4.` pinning the NumericStepper with step={1}, min={0}, value={sound.startFrame}, commitStartFrame in onChange, the AUDIO_POSITION_LABEL constant, and the header contract listing Position as step 3 — plus a placement pin that the `{/* 4. Remove` comment still follows the Position block. One atomic commit with all Task 2 files.</action>
  <verify>
    <automated>pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint/view/physicsPaintAudioController.test.ts src/components/physic-paint/view/PhysicsPaintAudioModalView.test.ts && pnpm --filter efx-motion-editor run typecheck</automated>
  </verify>
  <done>`Position (frames)` renders between the File row and Remove + On/Off as a NumericStepper (step 1, min 0) committing through commitStartFrame; integer >= 0 lands in the per-clip store door, invalid input never commits, no upper clamp; contract comment and JSX step comments renumbered to the locked order; modal/controller tests + typecheck green; exactly one atomic commit.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| sidebar list-row gesture → documentAudio mutation | an untrusted click (row select / trash / import) crosses into the controller that removes or patches persisted clips |
| Delete/Backspace keystroke → clip removal | a global shortcut targets document content from anywhere in the Studio — wrong focus or wrong branch order destroys the wrong clip |
| modal stepper input → startFrame persistence | a typed value crosses into the persisted geometry — an unvalidated write corrupts placement |

## STRIDE Threat Register

Threat IDs are unique within this quick; no prior PLAN files exist in this quick directory.

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|----------|-----------------|
| T-261008-RYQ-01 | Tampering | list-row trash or a second invented arm removing the wrong clip (removeSound has no undo) | high | mitigate | the row reuses the controller's `removeArmedClipId` two-step arm (confirmRemove's armed-id-must-equal-live-selection law untouched); requestRemove is re-gated on the LIVE selection, preserving fail-closed semantics; controller tests pin armed-clip and one-shot semantics |
| T-261008-RYQ-02 | Tampering | Delete/Backspace firing while typing in a stepper/select, or stealing the Background-clip or roto delete | high | mitigate | top-of-dispatch `isPhysicsPaintShortcutTarget` guard + the same guard inside the modal's own onKeyDown; branch order Bg → sound → roto (Bg wins when both selected); modifier/repeat/aria-modal/mutationLocked gates mirror the Bg branch; keyboard tests cover each gate |
| T-261008-RYQ-03 | Tampering | commitStartFrame writing negative/fractional/NaN startFrame into the document | medium | mitigate | isValidFadeFrames (integer >= 0) rejects before commitPatch; invalid keeps the prior accepted value (E8/E9 law); controller tests assert no-patch on each invalid input |
| T-261008-RYQ-04 | Tampering | widening the tab union lets the Audio tab silently fall through to the Track panel (or Bg-forced tab misbehaves) | medium | mitigate | explicit `effectiveToolTab === 'audio'` arm before the track fallback; selectToolTab keeps clearing the Bg selection; RightPanel/RightSidebar/ScriptsPanel pins updated (tab order + count) and typecheck enforces the union |
| T-261008-RYQ-05 | Denial of Service | the rightPanel memo factory or keyboard state touches the audio controller/signals before they are declared (TDZ crash on first Studio render) | medium | mitigate | signals move above :3111; controller/handlers reach the memo only through the audioSectionPortsRef lazy-arrow precedent (:3512); the removeSelectedSound action stays an arrow; typecheck + full suite gate both commits |
| T-261008-RYQ-SC | Tampering | npm installs | high | mitigate | no new package installs in this plan — zero install surface (NumericStepper, lucide-preact, signals all already in use) |

</threat_model>

<verification>
- Per-task automated gates (vitest run only — NEVER watch, per CLAUDE.md):
  - Task 1: pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint/view/PhysicsPaintRightPanel.test.ts src/components/physic-paint/view/PhysicsPaintRightSidebar.test.ts src/components/physic-paint/view/PhysicsPaintScriptsPanel.test.ts src/components/physic-paint/view/PhysicsPaintAudioModalView.test.ts src/components/physic-paint/view/physicsPaintAudioController.test.ts src/components/physic-paint/view/physicsPaintStudioKeyboard.test.ts src/components/physic-paint/PhysicsPaintStudio.test.ts
  - Task 2: pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint/view/physicsPaintAudioController.test.ts src/components/physic-paint/view/PhysicsPaintAudioModalView.test.ts
  - pnpm --filter efx-motion-editor run typecheck after each task (clean)
- Full suite: pnpm --filter efx-motion-editor exec vitest run — no NEW failures versus the pre-quick baseline (any pre-existing failure is out of scope: note it, don't fix it)
- Diff boundaries: commit 1 = the Task 1 file set; commit 2 = the four Task 2 files; the documentAudio model, store doors, transport, and PhysicsPaintWorkflowStrip are untouched across both commits (git diff --stat audit)
- Native visual UAT by the user (no Chrome DevTools MCP) — the spec's live rows, the definition of "all UAT is ok":

  | # | Row | Pass condition |
  |---|-----|----------------|
  | 1 | Sidebar Audio tab | Sidebar shows `Paint \| Track \| Audio`; the Audio tab lists every placed clip; the modal shows only the selected one |
  | 2 | List row click | Clicking a list row opens the modal on that clip AND scrolls the timeline to it |
  | 3 | Three delete surfaces | List-row trash (two-step), modal `Remove` (two-step), `Delete`/`Backspace` (one-shot) each remove only the targeted clip |
  | 4 | Position field | `Position (frames)` moves the clip on the timeline without dragging; the value survives closing and reopening the modal |
  | 5 | No regression | Both duplicated clips still sound at their own positions and both repeat under play loop (dup-clip-plays-audios-0 fix) |

- Nothing claimed done before the user's native UAT rows pass (automated-ready ≠ done).
</verification>

<success_criteria>
- Live (user UAT): all five rows pass natively in the Studio
- Automated: tab-bar/list/modal/keyboard/controller/Studio pins green across the seven touched test files, typecheck clean, full suite has no NEW failures
- Guardrails held: one shared two-step arm (no second arm invented), one-shot keyboard delete with Bg precedence, explicit audio arm (no Track fallthrough), no new state model / store door / package / copy changes beyond the `Audio` tab label and `Position` label, Audio Preview toggle untouched
- Two atomic commits landed, one per feature; nothing claimed done before live UAT passes
</success_criteria>

<output>
Create .planning/quick/261008-ryq-audio-list-to-sidebar-audio-tab-editable/261008-ryq-SUMMARY.md when done
</output>
