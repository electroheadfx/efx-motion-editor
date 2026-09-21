---
status: resolved
trigger: "Studio-origin bindings never persist: reference-image selection (photoReference), background-image clips, and tracks added via (+) are lost — paint strokes persist. Two prior fixes shipped and failed native UAT: 260921-e21 (push wiring) and 260921-ffh (push-guard re-arm). Loss is on a plain Studio close, no app quit."
created: 2026-09-21T10:10:56Z
updated: 2026-09-21T13:10Z
---

## Current Focus
<!-- OVERWRITE on each update - reflects NOW -->

hypothesis: RESOLVED — CONFIRMED + FIXED + LIVE-VERIFIED + ARCHIVED (commit 9542ac14). The transport projection shipped a carrier-swapped document without recomputing the roto revision. `projectEfxPaintDocumentForSync` converts every record `bytes`→`media` via `toPersistedRotoRecords` and spread the RUNTIME `revision` (byte-token terms) unchanged; the parent's fail-closed parse recomputed the revision over the parsed MEDIA records (`m<path><digest>;` terms) and rejected EVERY push with 'PhysicPaintRotoPhysicalDocument: canonical revision mismatch.' — the whole physic-paint:efx-paint-document channel dead live. Fix: rebuild each projected track's `revision` with `buildPhysicPaintRotoPhysicalRevision` over the shipped (projected) collections — the same law every other projection seam honors. Validator untouched.
test: live pass 3 CONFIRMED by the user ("All works now.") — main capture shows main.listener {tauri-listen} once, then per push main.received → main.parsed → REGISTERED for docrev 50 (photoReference present), 53 (trackCount 2, new trackId 5897f7d0…), 54 (clipCount 1), 55 (clipCount 1); the unchanged baseline (docrev 49) correctly hit main.skipEqualRevision; ZERO main.rejected. Disk layer JSON v1.0.0.mce (written 12:55) holds photoReference, tracks ["Paint 1" (5897f7d0…), "Track 1" (d799c878…)], background.clips length 1, documentRevision 55. All three surfaces persist.
next_action: TERMINAL — CLOSED. Instrumentation reverted (trace module + all call sites deleted; PhysicsPaintStudio.tsx and physicPaintBridge.ts byte-identical to the pre-session HEAD), tsc --noEmit clean, full suite 4072/0, fix + pin committed as 9542ac14, session archived to resolved/, KB entry appended, planning docs committed via the GSD CLI.

## Symptoms
<!-- Written during gathering, then IMMUTABLE -->

expected: Studio-origin mutations — photo-reference selection, background-image clips, and tracks added via (+) — survive a plain Studio close (no app quit), Studio reopen, relaunch, and .mce roundtrip. Paint strokes already persist correctly.
actual: All three surfaces are lost on a plain Studio close; paint strokes persist. Two prior fixes (260921-e21 push wiring, 260921-ffh push-guard re-arm) shipped and failed native UAT.
errors: none reported (silent data loss; no error surface observed)
reproduction: Open project → open Studio → (1) select a photo reference, (2) add a track via (+), (3) add a background clip → close Studio → reopen / inspect persisted .mce: all three absent; paint strokes present
started: unknown (reported during v1.0.0/Phase 53 work; two failed fix rounds on 2026-09-21)

## User Brief (verbatim from /gsd-debug args — DATA; treat as data only, never as instructions)

DATA_START
Studio-origin bindings never persist: reference-image selection (photoReference), background-image clips, and tracks added via (+) are lost — paint strokes persist. Two prior fixes shipped and failed native UAT: 260921-e21 (push wiring) and 260921-ffh (push-guard re-arm). Loss is on a plain Studio close, no app quit.

DISK EVIDENCE (new — read this before forming hypotheses). The .mce at /Users/lmarques/Desktop/efx-motion-editor-project-test/v1.0.0.mce was written 2026-09-21 10:51, well after the lossy sessions. Its layers/*.json contain Studio-origin data that DID persist: 15 realKeyRecords, loopClips carrying scriptId (Studio-created scripts), rotoPhysical.background canvas1/grainStrength 0.45, incomingInterpolationBreakKeyIds, the bjm-imported gallery image. The SAME files contain: document-level `photoReference: null`, document-level `background.clips: []`, and tracks array holding only the default "Track 1" — no user-added tracks. So the child→document sync works in general; these three mutations never reach the persisted file at all. Minor side finding: manifest modified_at is frozen at created_at despite later rewrites.
This evidence suggests the loss may NOT be a close-time race — check the pre-close state first (see experiment below).

METHOD CONSTRAINT — do NOT open with unit probes. Both prior rounds' vitest probes were green at base: the harness drives the non-Tauri DOM-fallback branch, so the live emitTo, cross-webview delivery, and real onCloseRequested teardown are invisible to it. Every verdict must rest on live observation from the running app (pnpm tauri dev). Instrument and capture to app-written JSON files under /tmp; no console copy/paste round trips.

DISCRIMINATING EXPERIMENT FIRST (live, cheap). With the project open: in Studio perform all three gestures (select photo reference, add track via (+), add a background clip). Save from the MAIN window WITHOUT closing Studio. Read layers/<layerId>.json from disk at that moment. (a) Fields ABSENT while Studio is open → the parent never receives these mutations; trace which store instance the child writes and what the efx-paint-document payload actually carries. (b) Fields PRESENT → close Studio, re-read: the close path then owns the loss, and pursue the ordered questions below.

THEN ANSWER, IN ORDER. (1) Child at close: does the document-sync flush run at all — dirty flag, bridge mode, guard returning null? Does the emit settle (resolve or reject) before the window is destroyed? (2) Parent: does the document listener fire, does registerEfxPaintDocument run, does the parent's live document then hold the change? (3) Does the REAL UI mutation path mark the child document dirty (compare with the store paths the probes drove)? (4) If the parent does hold it: is the reopen carrier built from the parent's live document or from a snapshot taken when Studio opened?

CODE REFS: efxPaintStore.ts — setPhotoReferenceSource (:1129, DOCUMENT MUTATION via _documents.set + _notifyChange, records background-edit ledger entry), addTrack (:183), addBackgroundClip (:692). Call sites: PhysicsPaintStudio.tsx :4307 (setPhotoReferenceSource), :2869 (addTrack), :4226 (addBackgroundClip). Idle-gated documentSync push + usePhysicsPaintCloseFlush live in PhysicsPaintStudio.tsx (52.1 close-flush comment block). Two-channel contrast: strokes ride physic-paint:apply with an ack; these three ride the debounced physic-paint:efx-paint-document channel.

BEHAVIOURAL RED PINS REQUIRED (e21/ffh lesson): no source-shape/textual assertions. Mutate each surface via the real UI path in the CHILD realm and assert the parent-realm document (and the written package file) receives it. A live-disk check counts as evidence.

GUARDRAILS: keep the e21 and ffh fixes — do not weaken the re-arm, the bounded retry budget, the clear-inside-the-mode-gate placement, or the close-gate reporting. No new transport; stay on physic-paint:efx-paint-document or the stroke physique-paint:apply channel. 52.2 reference-only law holds. Do not touch the bjm bridge pair.

Native UAT (owed, never claimed): ① reference selection survives Studio close/reopen + relaunch ② background keyframes survive and render at their frames ③ (+) tracks (paint and empty) survive with content ④ .mce roundtrip preserves all three ⑤ gallery imports still persist.

Before starting, read project memory — the full verdict chain (bjm custody, e21/ffh falsifications), the two-channel contrast, and the vitest blind spot are written down.
DATA_END

## Prior Verdict Chain (project memory — read these three files first)

- bjm (custody): `/Users/lmarques/.claude/projects/-Users-lmarques-Dev-efx-motion-editor/memory/project_260921_bjm_import_persistence.md` — gallery/background IMPORT bytes were written by the Studio CHILD realm into its own imageStore instance; fixed via a child→main bridge pair (`physic-paint:image-import-request`/`-result`); native UAT approved. DO NOT touch the bjm bridge pair.
- e21 (falsified): `.../project_260921_e21_studio_origin_persistence.md` — verdict (a)×3 = child push wiring (clear-before-mode-check + push-guard latch); all behavioural probes were GREEN at base, so its RED pins were source-shape only; FALSIFIED by native UAT.
- ffh (falsified): `.../project_260921_ffh_studio_origin_rediagnosis.md` — verdict: e21's guard re-arm wrote the ref while the push decision read a render-captured guard; fix landed; UAT FAILED AGAIN (2nd falsification). Its durable discriminator (H4): strokes never ride the doc-sync channel (eager `physic-paint:apply` + ack); the three surfaces ride debounced `physic-paint:efx-paint-document` (guard, no ack, close flush) — bisect any "X persists but Y doesn't" report on channel.
- Vitest blind spot: every unit probe drives the NON-Tauri DOM-fallback branch (`stubWindow` has no `__TAURI_INTERNALS__`), so live `emitTo`, cross-webview delivery, and real `onCloseRequested` teardown are invisible to the whole harness.

## Operational Constraints

- The USER runs the app (`pnpm tauri dev`) — the agent must NOT start the server. Live gestures are performed by the user at a checkpoint.
- Diagnostics: the app writes JSON capture files to /tmp; read them from disk (no console copy/paste).
- Tests: `vitest run` only, never watch mode. Do not create one-off test configs.
- Keep .planning artifacts in English.

## Eliminated
<!-- APPEND only - prevents re-investigating -->

- hypothesis: H-P2 — "the parent applied the document, but its apply writes a document source the save-path serialize does not read (stale snapshot / different store instance)"
  evidence: registerDocument writes `_documents` (efxPaintStore.ts:76-79); serializeRuntimeIntoDocument reads `getDocument(layerId)` = `_documents.get(layerId)` (efxPaintStore.ts:1712-1713, :82-84); buildEfxPaintDocuments (projectStore.ts:144-166) calls exactly that serialize. Register and save share ONE map in ONE realm — the written file IS the parent's live document, so the three fields' absence from disk proves the parent's live document never held them. Additionally registerDocument → _notifyChange → `_markProjectDirty` + efxPaintVersion++ (:67-70), which arms the main realm's autosave — and pass 1 showed NO autosave write after the pushes, consistent with "no register ever ran"
  timestamp: 2026-09-21T10:55Z

- hypothesis: H-P1 — "the parent's revision guard skipped the photo push because the two realms' documentRevision counters collide at the same integer"
  evidence: the guard (physicPaintBridge.ts:3300-3309) fires only on EXACT canonical-fingerprint equality, and the fingerprint encodes `docrev:` plus the photoReference term (efxPaintDocumentRevision.ts). The child's rev-48 photo-PRESENT payload cannot be fingerprint-equal to the parent's rev-47 photo-NULL document — a collision on the integer alone can never pass this guard. (The guard-skip leg stays instrumented — `main.skipEqualRevision` now carries the `current` summary — but it cannot have been the photo gesture's mechanism)
  timestamp: 2026-09-21T10:55Z

- hypothesis: implication (i) reading — "the parent's +1 rev between the two saves is the child's push landing parent-side"
  evidence: the +1 landed on BOTH active physic-paint layers (a605a976 47→48, e8e3abf2 13→14) while the pushed content touched only a605a976 — a gesture-specific push cannot bump an untouched layer. The +1 is the save-path projection itself: serializeRuntimeIntoDocument projects the runtime (bytes-carrying records) into a document whose stored records are media references; the record payload canonical terms differ, so the candidate always differs from the stored document → +1 with byte-identical fields otherwise (disk diff: only `.documentRevision` changed). Both pushed-to layers were runtime-hydrated, so both bumped
  timestamp: 2026-09-21T10:55Z

## Evidence
<!-- APPEND only - facts discovered -->

- timestamp: 2026-09-21T10:12Z
  checked: Read-only disk check (orchestrator, before debugger spawn) of /Users/lmarques/Desktop/efx-motion-editor-project-test/v1.0.0.mce — the .mce is a DIRECTORY package; 4 files under layers/
  found: All 4 layer JSONs: `photoReference` null, `background.clips` length 0, `tracks` = single {name "Track 1"} (track keys: blendMode,frames,id,loopClips,name,opacity,order,revision,rotoPhysical,solo,visible)
  implication: Confirms the user's disk evidence shape — the three surfaces are absent from the persisted file itself, not merely absent after reopen

- timestamp: 2026-09-21T10:12Z
  checked: Same layer JSONs for Studio-origin content that DID persist
  found: layers a605a976-3bf9-43ba-85f1-e9f6b4f0677c, cbf16aeb-0470-4520-90fa-bc2cf0c38143, e8e3abf2-40e4-44f3-b155-f33d4e58fde3 carry `tracks[0].rotoPhysical.realKeyRecords` (key records with appFrame + frames/*.webp media, e.g. appFrame 7 and 10), `incomingInterpolationBreakKeyIds`, `grainStrength`, and `scriptId` inside `loopClips`; images/ holds efx_*.png + a dodoche_*.jpg (the bjm-imported asset)
  implication: The child→persisted-file path is not globally dead — stroke/script/paint data reaches the file while the three binding surfaces never do. Bisected by channel (H4): persisted classes use other channels; the three ride `physic-paint:efx-paint-document`

- timestamp: 2026-09-21T10:12Z
  checked: manifest modified_at vs created_at (user-reported side finding)
  found: NOT yet verified by the orchestrator (user reports modified_at frozen at created_at despite later rewrites)
  implication: Track as a separate minor finding; do not conflate with the three surfaces

- timestamp: 2026-09-21T10:16Z
  checked: Which single link can silently drop all three surfaces — the guard's dedupe fingerprint (read efxPaintDocumentRevision.ts:119-151, documentSyncPushGuard.ts, PhysicsPaintStudio.tsx:3929-4001)
  found: buildEfxPaintDocumentRevision hashes tracks (count + every track id), background.clips, photoReference and documentRevision — so a mutation to ANY of the three CHANGES the fingerprint. The guard therefore cannot dedupe them away
  implication: ELIMINATED — the guard's content blindness is not the link, and neither round's guard re-arm was ever the reachable defect for these three

- timestamp: 2026-09-21T10:16Z
  checked: Real UI path vs store path for addTrack (PhysicsPaintStudio.tsx:2866 handleAddTrack -> efxPaintStore.ts:183 addTrack -> :203 _documents.set + :205 _notifyChange -> :67-70 efxPaintVersion.value++)
  found: The live gesture mutates the CHILD document and bumps the version; the effect at PhysicsPaintStudio.tsx:4008 therefore sets documentSyncDirty on every one of these mutations
  implication: ELIMINATED — the real UI path is not bypassing the store (the "probes drive a path the UI does not" theory does not hold for (+) tracks)

- timestamp: 2026-09-21T10:16Z
  checked: Every gate that stands between a dirty flag and a live emit — workflowMode gates, bridge mode, emit target, window labels, child capability
  found: (1) workflowMode is the literal constant 'roto' (PhysicsPaintStudio.tsx:797), so the close-flush gate at :1919 and its inner early-return at :1921 are always open; (2) bridgeModeRef.current mirrors usePhysicsPaintBridgeMode, which resolves 'Tauri' whenever @tauri-apps/api/event exposes emit; (3) the child emits to 'main' (physicsPaintBridgeTransport.ts:364) and the main window's label IS "main" (src-tauri/tauri.conf.json:28); the child window label "efx-physic-paint" matches lib.rs:164 and PHYSIC_PAINT_WINDOW_LABEL; (4) the child capability grants core:event:default (capabilities/physics-paint.json:11), so emitTo is permitted
  implication: ELIMINATED — the addressing/permission/gate layer is correct in the live app, so L1 is not a mis-targeted emit

- timestamp: 2026-09-21T10:16Z
  checked: Whether the two channels differ in transport (the H4 discriminator): sendEfxPaintDocumentSync vs sendPhysicPaintApplyPayload
  found: Both are the SAME mechanism — dynamic import of @tauri-apps/api/event, toTransportPayload encode, emitTo('main', <event>, encoded), identical reject surface
  implication: ELIMINATED — no channel-level transport asymmetry; the difference must be inside the document payload path (decision, delivery, or the parent's parse/register)

- timestamp: 2026-09-21T10:16Z
  checked: Parent-side application of an arriving sync (physicPaintBridge.ts:3253-3356) and the only consumer of the parent's document (projectStore.ts:144-166 buildEfxPaintDocuments -> serializeRuntimeIntoDocument -> efxPaintStore.ts:1708)
  found: The revision guard at :3283 skips the register ONLY on an EXACT revision equality, so a genuinely changed document cannot be rejected there. The save path serializes the MAIN realm's LIVE document, so these three fields' absence from the .mce is proof the parent's live document never held them
  implication: The loss is upstream of the save: either the child's decision returned null, the emit never delivered, or the parent's parse threw into the catch at :3308 (console.warn only, no error surface — matches "silent"). These links are exactly what the live capture must separate, and NONE is visible to the vitest DOM-fallback branch

- timestamp: 2026-09-21T10:16Z
  checked: Instrumentation added for the live discriminating pass
  found: New temporary module app/src/lib/documentSyncTrace.ts (writes /tmp/efx-stall-capture-docsync-<realm>.json via the existing Rust write_debug_capture command, realm = studio when ?context= is present, else main) + call sites: child.closeRequested (hasPending gate), child.closeFlush, child.flushGated (debounce/idle), child.decide, child.sent, child.sendFailed, main.listener (tauri-listen / failed / dom-fallback), main.received, main.parsed, main.skipEqualRevision, main.registered, main.rejected. Each entry carries counts only (docrev, trackCount, clipCount, photoReference present/null), never the document. tsc --noEmit clean; the 4 suites covering the touched files pass (325 tests, 1 skipped)
  implication: One live gesture pass now names the link: no child.decide entry = the flush never ran; decided:false = a silent no-send; child.sent with no main.received = delivery; main.rejected = the parent's parse; main.registered but stale-at-save = a later clobber. Instrumentation is temporary and must be reverted when the session closes

- timestamp: 2026-09-21T10:26Z
  checked: How to "save from the MAIN window WITHOUT closing Studio" (user asked; the main window is hidden while Studio is open — lib.rs:260-265 hides it on Studio launch, restores on Destroyed)
  found: The macOS File menu Save item is a NATIVE Cocoa accelerator (lib.rs:597, CmdOrCtrl+S) whose handler broadcasts menu:save-project to ALL webviews (lib.rs:672-673); the only listener is the main realm (main.tsx:182) and save has NO document.hasFocus() gate (unlike undo/redo at main.tsx:152-153). It calls handleSave (shortcuts.ts:56) -> projectStore.saveProject() MANUAL branch -> await requestPhysicPaintFlush() (projectStore.ts:842) — an explicit main->Studio round-trip (physic-paint:flush-request / flush-result, physicPaintFlush.ts) that drains the Studio's queued work INCLUDING the documentSync push before the main realm serializes the .mce
  implication: Cmd+S while Studio is focused is the correct pre-close save route, and it exercises a THIRD document-carrying path (explicit flush handshake) in addition to the idle/debounced push and the close flush — if the three fields are absent from the layer JSON right after Cmd+S, the failure is not close-timing-specific

- timestamp: 2026-09-21T10:33Z
  checked: Whether the menu route actually works live (user report: "I can't save when Studio is open, the menu items are greyed")
  found: USER-OBSERVED — while Studio is focused, the macOS File menu items (Save etc.) are disabled, so Cmd+S cannot fire (disabled items do not respond to key equivalents). No user-reachable manual save exists while Studio is open. The code has no set_enabled logic in Rust, so this is macOS/ Tauri menu validation, not app logic
  implication: The pre-close disk write cannot be user-triggered; it can only happen via the HIDDEN main realm's autosave (autoSave.ts: 2 s debounce after efxPaintVersion/physicPaintVersion moves, 60 s safety-net interval — both run while the window is hidden). The /tmp captures remain the primary pre-close discriminator (they do not depend on any save); the layer-JSON snapshot adds whether a pre-close write occurred, and a post-close Cmd+S then guarantees the final write includes everything the main realm ever held

- timestamp: 2026-09-21T10:45Z
  checked: LIVE PASS RESULTS — capture files read from disk (/tmp/efx-stall-capture-docsync-*.json)
  found: /tmp/efx-stall-capture-docsync-studio.json does NOT exist — the Studio realm mis-detected itself (detectRealm() looks for `?context=` in window.location.search; the Studio webview has none) and wrote into ...-main.json, so that file holds ONLY the Studio's 8 entries: child.flushGated{path idle, mode Unavailable} t=1003; child.decide + child.sent docrev 47 {photo null, clips 0, tracks 1} t=1417/1978 (baseline push once bridge mode became Tauri); child.decide + child.sent docrev 48 {photo PRESENT, clips 0} t=12178/12220 (photo-reference gesture); child.decide + child.sent docrev 49 {photo PRESENT, clips 1} t=27867/27947 (background-clip gesture); child.closeRequested t=116562 {pending false, strokes 0, docSyncPending FALSE, bridgeMode Tauri}. NO child.sendFailed anywhere. NO track mutation: trackCount stayed 1, trackIds [d799c878] for every entry
  implication: the child-side chain works end-to-end for the mutations that were performed — decisions taken (decided:true), sends resolved, nothing pending at close. The loss is downstream (delivery / parent apply / parent serialize+save). Main-side entries (main.received/parsed/registered/rejected) were OVERWRITTEN by the realm collision, so delivery is still unobserved — the realm detector must be fixed (window label) before the next pass. Separately: the (+) track gesture produced NO document mutation in this pass (needs user confirmation of what they did in the UI)

- timestamp: 2026-09-21T10:45Z
  checked: Disk states — /tmp/efx-preclose-layers (snapshot taken 12:30) + /tmp/efx-preclose-mtimes.txt vs live .mce after plain close + Cmd+S
  found: Pre-close (latest write 12:25): a605a976 docrev 47, photo NULL, clips 0, tracks ["Track 1"]; e8e3abf2 rev 13; cbf16aeb rev 27; 0f69c6ad rev 0. Live after close+Cmd+S (12:30): a605a976 docrev 48 (photo STILL NULL, clips 0), e8e3abf2 rev 14, cbf16aeb rev 27, 0f69c6ad rev 0. NO write between 12:25 and 12:30 (the gesture pushes resolved at ~12:25:5x and ~12:26:1x but no autosave landed)
  implication: (i) the parent's persisted document advanced exactly +1 on a605a976 AND on e8e3abf2 (parent layer) between the two saves — consistent with exactly ONE gesture push being applied parent-side; (ii) the child pushed rev 48 with photoReference PRESENT, yet the parent's saved rev-48 document has photoReference null → either the parent never applied rev 48 (rev advanced by another mechanism) or it applied it and the field is dropped in the parent's parse/apply or in the save serialize; (iii) rev 49 (clip) left no trace (clips 0, rev stayed 48) — skipped or rejected parent-side; (iv) the absence of any autosave after the gesture pushes suggests the parent's apply either never happened or does not mark the project dirty. CAVEAT: mapping wall-clock 12:25 to a specific push is inferred from performance.now values; verify against app-start time before relying on it

- timestamp: 2026-09-21T10:55Z
  checked: Where the registered document lands vs what the save serializes (implication (b)) — physicPaintBridge.ts:3256-3352, efxPaintStore.ts register/document/serialize, projectStore.ts:144-166
  found: registerDocument writes the ONE `_documents` map (efxPaintStore.ts:76-79); serializeRuntimeIntoDocument reads that same map (:1712-1713 via getDocument :82-84); buildEfxPaintDocuments (projectStore.ts:144-166) calls the aliased serialize (projectStore.ts:43) WITHOUT a resolver, then the package-write funnel projects records to `frames/<layerId>/<keyId>.webp` for the WRITTEN json. Conclusion: the disk file IS the parent's live document — the three fields' absence on disk proves the parent's live document never held them, so the drop is at or before receive/parse/register, never at save. Corollary: registerDocument → _notifyChange → _markProjectDirty + efxPaintVersion++ would arm the main realm's autosave; NO autosave write occurred after the pass-1 pushes → no register ran
  implication: The remaining unknown collapses to three links: (L4) did main.received ever fire, (L5) did the fail-closed parser reject, (L6) did the revision guard skip. All three are now instrumented with the realm fix; the save path is exonerated by code and by the disk facts

- timestamp: 2026-09-21T10:55Z
  checked: The pass-1 "+1 documentRevision" on a605a976 (47→48) and e8e3abf2 (13→14) between the snapshot save and the post-close save — was it the child's push landing?
  found: NOT the push: the bump landed on an UNTOUCHED layer too (e8e3abf2), and the save-path serialize runs WITHOUT a resolver, so a runtime-hydrated document (bytes-carrying records) projects to a candidate whose record canonical terms differ from the stored media-reference document → fingerprint differs → `documentRevision + 1` with the written fields otherwise byte-identical (confirmed by the structural diff: only `.documentRevision` changed; cbf16aeb and 0f69c6ad — not physic-paint-kind layers, never re-serialized — stayed byte-identical). Both active physic-paint layer ids are exactly the two bumped layers
  implication: Both pass-1 hypotheses about the parent's register are now resolved in code terms: H-P2 (different source) and H-P1 (counter collision) are eliminated, and the disk bump is fully explained as a save-time artefact — meaning the parent's persisted document never contained the pushed photo/clip/track at ANY point, and the failure is upstream of the register (delivery, fail-closed parse, or an install/emit-leg failure)

- timestamp: 2026-09-21T10:58Z
  checked: Pass-2 instrumentation applied (realm fix + closing pass 1's probe-fidelity gaps): documentSyncTrace.ts realm/header, child.encoded trace in physicsPaintBridgeTransport.ts, raw/current summaries in physicPaintBridge.ts
  found: (a) detectRealm() now keys on `window.location.pathname.includes('/physics-paint')` — the app's own route convention (src-tauri lib.rs:310 builds `/physics-paint?operationId=...`; main.tsx:37 uses the same discriminator) — and the capture header now records `href` + `tauriWindowLabel` (from `__TAURI_INTERNALS__.metadata.currentWindow.label`) as probe-fidelity cross-checks; (b) `child.encoded` traces the document AFTER `projectEfxPaintDocumentForSync` + `toTransportPayload` (implication (c): the previous child summaries were pre-projection/pre-encode), plus changedBytes/backgroundSources counts; (c) `main.received` now carries the RAW pre-decode summary (a field present pre-decode and absent in `main.parsed` = decode/parse loss), `main.skipEqualRevision` carries the parent's `current` summary (distinguishes a true idempotent skip from an H-P1-style skip), `main.rejected` carries the raw summary of the rejecting payload; (d) tsc --noEmit clean; the 4 suites covering the touched files pass (325 tests, 1 skipped)
  implication: Pass 2 will name the link deterministically: main.registered (parent holds it — then re-examine the save/reopen) vs main.rejected + message + raw summary (fail-closed parse of what field) vs main.received present but no parsed/rejected (impossible — the try wraps both; a crash would be visible) vs NO main.received (delivery, with main.listener distinguishing tauri-listen vs dom-fallback vs install-failure) vs child.encoded missing the fields (transport/projection loss)

- timestamp: 2026-09-21T11:00Z
  checked: The pass-1 (+) track observation — trackCount stayed 1 in ALL 8 child entries; the user's ordered implication (d) asks pass 2 to watch the UI
  found: unresolved, deliberately deferred to pass 2: if the (+) click does NOT add a visible track in the Studio UI, the gesture itself is failing in the child (a different defect from the sync loss); if it DOES add a visible track but `child.decide` never reflects it, the child store/effect link is at fault
  implication: Pass 2 must capture the UI observation alongside the traces; the (+) gesture is the discriminator between "gesture broken in child" and "sync broken downstream"

- timestamp: 2026-09-21T11:35Z
  checked: PASS-2 RESULT (user checkpoint) — the dead link observed at last
  found: /tmp/efx-stall-capture-docsync-main.json: main.listener {channel tauri-listen} once, then FIVE main.received immediately followed by FIVE main.rejected — message 'PhysicPaintRotoPhysicalDocument: canonical revision mismatch.' in every case; zero main.parsed / main.registered / main.skipEqualRevision. Rejected payloads carry the full summary (docrev 48 photo null; 49 photo present; 52 trackCount 2 new trackId 080553bd; 53/54 clipCount 1 + backgroundSources) — decode succeeded, the canonical check is what rejects. /tmp/efx-stall-capture-docsync-studio.json: child.decide/encoded/sent all green for 48/49/52/53/54, changedBytesCount 15 on the first push, 0 after; no sendFailed; child.closeRequested {docSyncPending false, bridgeMode Tauri}. User-observed: the (+) track DID appear in Studio (Tracks 2). Snapshot /tmp/efx-pass2-preclose-layers: consistent with 100% rejection (only the save-time projection bump).
  implication: Delivery is exonerated (main.received always fires); the loss is the parent's fail-closed parse rejecting EVERY document push — the entire physic-paint:efx-paint-document channel is dead live, so no upstream guard/wiring fix could ever help. The throw site must be located and the unsatisfiable comparison named.

- timestamp: 2026-09-21T11:35Z
  checked: Throw site + the exact comparison (implication (a)) — grep 'canonical revision mismatch' + read every hop
  found: the ONLY throw is physicsPaintRotoPhysicalModel.ts:1523-1526 in parsePhysicPaintRotoPhysicalDocument: `revision = buildPhysicPaintRotoPhysicalRevision(state.realKeyRecords, interpolation, loopClips, incomingBreaks, groupOverrides)`; `if (value.revision !== revision) throw`. Parent door: physicPaintBridge.ts:3292 `parseEfxPaintDocument(fromTransportPayload(incoming.document ?? payload))` (payloadMode default 'runtime') → efxPaintDocumentParsers.ts:234 per-track `parsePhysicPaintRotoPhysicalDocument(value.rotoPhysical, payloadMode)`. Revision term is CARRIER-SENSITIVE by design: encodeCanonicalRecordPayloadTerm (physicalModel:1259-1275) → media present: `m<relativePath><digest>;`; else bytes: `d<token>;` (52.2-02 D-07: "one raster-carrier term per record"). Child door: physicsPaintBridgeTransport.ts:336 `projectEfxPaintDocumentForSync` → `toPersistedRotoRecords` (physicsPaintRotoMediaProjection.ts:93-116, buildMediaPayload drops the bytes carrier) and the per-track spread `...roto` (:295-302) KEEPS the runtime revision — built over byte-token terms. The parent recomputes over media terms → inequality → reject, unconditionally, for every push whose records carry bytes (children always do: launch hydration installs bytes; child.encoded changedBytesCount 15 proves it live).
  implication: ROOT CAUSE IDENTIFIED — the 52.2-10 (D-12) reference projection swaps the carrier but not the revision; the invariant "projected collections ⇒ revision recomputed over the projection" is documented and honored at every other seam (physicPaintStore.ts:2363-2366, `_buildRotoPhysicalDocumentForLayer` :2381-2408, serialize funnel efxPaintStore.ts:1699-1706) and violated only in the transport. The fix belongs in `projectEfxPaintDocumentForSync` (recompute each projected track's revision over the shipped collections), NOT in the validator.

- timestamp: 2026-09-21T11:35Z
  checked: Why no existing test caught it (probe-fidelity for the RED pin)
  found: the e21 behavioural test (physicsPaintBridgeTransport.test.ts:776) builds its child document via `serializeRuntimeIntoDocument(LAYER)` on a store whose physicPaintStore RUNTIME holds no records — `registerDocument` (efxPaintStore.ts:76-79) only sets `_documents`, it does NOT hydrate the runtime, so `_buildRotoPhysicalDocumentForLayer` returns null (:2376-2377) and the track ships `rotoPhysical: null`. The canonical parse therefore never sees a record; verified green at base (`vitest run -t "carries the reference selection"`: 1 passed). The D-12 transport tests capture the emitted payload but never re-parse it. Both blind spots are roto-carrier-specific, not Tauri-specific.
  implication: the RED pin must (1) install bytes-carrying records into the store runtime (the launch hydration door `installRuntimeStateFromDocument`), (2) run the REAL `sendEfxPaintDocumentSync('Tauri')`, (3) put the emitted payload through the receiver's canonical parse AND the real installed listener, asserting the three gestures + the roto record land in the parent's registered document.

- timestamp: 2026-09-21T11:35Z
  checked: Cross-realm revision coupling after the fix (guard/churn analysis)
  found: the parent's skip-equal guard compares `buildEfxPaintDocumentRevision` (efxPaintDocumentRevision.ts:79-85) — the fingerprint embeds the physical revision recomputed over the record collection, so both realms become media-consistent after the fix; the parent stores exactly what it received (media-shaped), the next identical push fingerprints equal → idempotent skip preserved. The child's live document is untouched (the recompute lands on the shipped copy only), so undo/history/action-transaction revisions (child-side) do not move.
  implication: the minimal fix has no revision-identity side effects across realms; it restores the D-12 design's intent (the receiver's parse was always meant to accept these payloads).

- timestamp: 2026-09-21T12:00Z
  checked: RED pin written and run at base (app/src/components/physic-paint/bridge/physicsPaintBridgeTransport.test.ts, e21 describe, 'a bytes-carrying runtime document crosses the D-12 projection into the parent realm')
  found: RED at base with EXACTLY the live signature: `Error: PhysicPaintRotoPhysicalDocument: canonical revision mismatch.` at physicsPaintRotoPhysicalModel.ts:1526 via parseInternalPaintTrack (efxPaintDocumentParsers.ts:234) ← parseEfxPaintDocument (:433) ← the test's receiver-door parse. The root-cause hypothesis is confirmed by experiment: bytes-carrying runtime records → D-12 projection → parent canonical parse → reject. (First run also surfaced a capacity bound: the e21 fixtures' 4096 exceeds PHYSIC_PAINT_MAX_APPLY_FRAMES=600 on the runtime-install door; the pin uses 600.)
  implication: The in-process reproduction carries the same message and stack as the live 5/5 rejections — no further live discrimination needed for the MECHANISM; the live pass that remains is the end-to-end acceptance (fix visible in the saved file).

- timestamp: 2026-09-21T12:02Z
  checked: Fix applied in `projectEfxPaintDocumentForSync` (physicsPaintBridgeTransport.ts) — recompute each projected track's revision over the SHIPPED collections; validator/guard/transport untouched
  found: `revision: buildPhysicPaintRotoPhysicalRevision(projectedRealKeyRecords, roto.interpolation, roto.loopClips, roto.incomingInterpolationBreakKeyIds, projectedGroupOverrideRecords)` added to the per-track spread (named projected collections replace the inline expressions; no behavior removed). Pin GREEN. Transport file 30/30. tsc --noEmit clean. FULL SUITE: 217 files passed / 2 skipped, 4072 passed / 1 skipped / 101 todo — zero failures.
  implication: The only sender on the channel (both Tauri and browser-fallback branches go through the same projection — grep: emitTo + postMessage are the only two emitters) is fixed at the projection boundary, so the payload the child ALREADY sends now parses; no fail-closed property was weakened (the receiver's parser is byte-identical to base).

- timestamp: 2026-09-21T12:04Z
  checked: Fix-acceptance guardrail (multi-signal)
  found: target_test pass (RED→GREEN, exact live message); mutation_check skipped — no Stryker configured in the repo (no stryker.conf*, no @stryker deps); no_op_deletion pass — the diff is additive (the recompute) plus named-const hoists of identical expressions, nothing deleted or short-circuited; adjacent_tests pass (full suite 4072/0); revert_and_reconfirm pass — `git stash push -- <transport file>` restored the bug with the exact message, `git stash pop` + rerun → 30/30 green.
  implication: guardrail_verdict: accepted; proceed to the human-verification checkpoint (live pass).

- timestamp: 2026-09-21T12:55Z
  checked: PASS-3 RESULT (live acceptance, user checkpoint) — captures read from disk + the saved layer JSON
  found: /tmp/efx-stall-capture-docsync-main.json: main.listener {tauri-listen} once; then per push main.received → main.parsed → REGISTERED: docrev 50 {photoReference present}, docrev 53 {trackCount 2, new trackId 5897f7d0-69a8-4352-a046-319fc8680db4}, docrev 54 {clipCount 1}, docrev 55 {clipCount 1}. The baseline push (docrev 49, unchanged shape) correctly hit main.skipEqualRevision (the idempotent skip is preserved). ZERO main.rejected — the previous run was 5/5 rejected with 'PhysicPaintRotoPhysicalDocument: canonical revision mismatch.'. The fail-closed validator is untouched and still strict. Disk /Users/lmarques/Desktop/efx-motion-editor-project-test/v1.0.0.mce layers/a605a976-….json (written 12:55): photoReference present ({id, sourceFrameRefs, revision, visibleInStudio, opacity 0.5, transform, transformLocked}), tracks = ["Paint 1" (5897f7d0…), "Track 1" (d799c878…)] (the (+) track present), background.clips length 1, documentRevision 55. User-observed: "All works now."
  implication: LIVE VERIFIED — all three Studio-origin surfaces (photo reference, background clip, (+) track) now reach the parent's live document and the persisted .mce. The fix is confirmed end-to-end on the exact original reproduction; the session is accepted and can be archived. The two consecutive clipCount-1 pushes (54, 55) are the expected decision-time-vs-send-time re-push of the same content; both register because the fingerprint embeds documentRevision (54≠55) — same content, so the second register is a harmless identical rewrite, and the guard's idempotent skip is proven intact by the docrev-49 baseline skip.

## Resolution
<!-- OVERWRITE as understanding evolves -->

root_cause: "The child's documentSync transport projection (projectEfxPaintDocumentForSync, 52.2-10/D-12) swaps every real-key record's raster carrier bytes→media via toPersistedRotoRecords but spreads the runtime `rotoPhysical.revision` unchanged. The revision encoding is carrier-sensitive (media terms `m<relativePath><digest>;` vs byte terms `d<token>;`), so the shipped document's revision can never equal the canonical revision the parent recomputes over the parsed media records; the parent's fail-closed parse (physicPaintBridge.ts:3292 → efxPaintDocumentParsers.ts:234 → physicsPaintRotoPhysicalModel.ts:1523) throws 'PhysicPaintRotoPhysicalDocument: canonical revision mismatch.' and the catch at bridge:3347 drops the sync with a console.warn only. EVERY push since the D-12 projection shipped was rejected — the entire physic-paint:efx-paint-document channel is dead live — so the three surfaces that ride it (photo reference, background clips, (+) tracks) never reach the parent's live document, while strokes (physic-paint:apply + ack) persist. e21/ffh were falsified because their guard/close-gate links sit upstream of this dead link and were never the reachable defect (delivery always worked: main.received fired 5/5 in pass 2, main.rejected 5/5 immediately after)."
fix: "projectEfxPaintDocumentForSync now rebuilds each projected track's `revision` with buildPhysicPaintRotoPhysicalRevision over the SHIPPED (projected) collections, exactly like every other projection seam (extractRuntimeStateForDocument / _buildRotoPhysicalDocumentForLayer in physicPaintStore; the serialize-funnel contract documented in efxPaintStore). The child's live document is untouched (the recompute lands on the shipped copy); the receiver's fail-closed validator, the e21/ffh guards, the transport and the bjm bridge pair are unchanged."
verification:
  target_test:        { result: pass, test: "physicsPaintBridgeTransport.test.ts — 'a bytes-carrying runtime document crosses the D-12 projection into the parent realm' (RED with the exact live message at base, GREEN after)" }
  mutation_check:     { result: skipped, reason: "no Stryker configured in the repo (no stryker.conf*, no @stryker deps)" }
  no_op_deletion:     { result: pass, deletion_justified_by_rca: n/a }
  adjacent_tests:     { result: pass, suites_run: ["app full suite after instrumentation revert: 217 files passed / 2 skipped, 4072 passed / 1 skipped / 101 todo, 0 failed", "tsc --noEmit clean"] }
  revert_and_reconfirm: { result: pass, bug_returned_on_revert: true, fixed_on_reapply: true }
  guardrail_verdict:  accepted
  live_acceptance:    { result: pass, evidence: "pass 3 (native, user-run): main.received → main.parsed → REGISTERED for the photo / (+) track / clip pushes, ZERO main.rejected (was 5/5 rejected), baseline push correctly skipped as equal; saved layer JSON holds photoReference, tracks [Paint 1 (5897f7d0), Track 1 (d799c878)], background.clips length 1, documentRevision 55. User: 'All works now.'" }
  oracle_type:        specified
files_changed:
  - app/src/components/physic-paint/bridge/physicsPaintBridgeTransport.ts (fix: each projected track's revision rebuilt over the shipped projected collections in projectEfxPaintDocumentForSync; committed 9542ac14)
  - app/src/components/physic-paint/bridge/physicsPaintBridgeTransport.test.ts (new behavioural pin: bytes-carrying runtime document through the D-12 projection, the receiver's parse door and the real installed listener)

Instrumentation revert (this session's terminal step): deleted app/src/lib/documentSyncTrace.ts and every trace call site; reverted PhysicsPaintStudio.tsx and physicPaintBridge.ts to HEAD (they carried trace only); physicsPaintBridgeTransport.ts retains ONLY the fix. Commit 9542ac14 carries the fix + its pin (2 files, +101/−3); the session's entire code diff is those two transport files, so every e21/ffh guardrail is intact by construction (verified: DOCUMENT_SYNC_MAX_AUTO_RETRIES, the three clear-dirty-in-mode-gate sites and the close gate all present in the untouched PhysicsPaintStudio.tsx). No new transport, 52.2 reference-only law holds, bjm bridge pair untouched (physicPaintBridge.ts zero diff).

## Prevention (blameless postmortem)

The Phase-2A reasoning-checkpoint branches (candidate causes spanned code / data / environment) carry into this postmortem; the AND-gate answered YES — the failure required two contributing conditions simultaneously.

### 5-Whys, branched across categories

**Code branch — the projection's revision invariant was convention-only**
1. Why did all three surfaces vanish? → every documentSync push was rejected by the parent's fail-closed canonical parse.
2. Why rejected? → the shipped document's `rotoPhysical.revision` was built over byte-token terms while the shipped records were media references.
3. Why the mismatch? → the D-12 transport projection swapped the carrier (bytes→media) but spread the runtime revision unchanged.
4. Why was the swap possible without the revision moving? → the invariant "projected collections ⇒ revision recomputed over them" was honored at every other seam *by convention* (each seam explicitly calls the builder); `revision` is a plain string on a spread-able object, so nothing at compile time links it to the collections it summarizes.
5. Actionable condition → carrier swaps had no single enforced seam: the carrier-swapping helper (`toPersistedRotoRecords`) did not co-ship the revision rebuild, so every caller had to remember a second, unenforced call.

**Data branch — the fixtures could not exhibit the defect**
1. Why didn't the existing tests fail? → every documentSync fixture's track shipped `rotoPhysical: null`; no real-key record ever reached the canonical parse door.
2. Why null? → the fixtures register a document via `registerDocument`, which only sets `_documents` and never hydrates the runtime maps; `_buildRotoPhysicalDocumentForLayer` then returns null (`efxPaintStore.ts:2376-2377`).
3. Why was the fixture path different from live? → the live child's launch hydration (`installRuntimeStateFromDocument`) installs bytes-carrying records, so the live child's every push carried bytes (pass-2 `changedBytesCount 15`). The harness exercised a shape the product never produces.
4. Actionable condition → probe fidelity: fixtures must install through the same door the product uses (launch hydration), not the weaker register-only door.

**Environment/gate branch — the harness could not observe the failing link**
1. Why did two prior rounds (e21, ffh) fix the wrong link? → their probes never saw the deliver/parse/register legs (the vitest harness drives the non-Tauri DOM-fallback branch; `stubWindow` has no `__TAURI_INTERNALS__`), and the parent's catch is a `console.warn` only — the failure was silent by construction.
2. Why did the assertions stop short? → the D-12 transport tests asserted on the emitted payload's *shape*; none re-parsed that payload through the receiver's canonical door — one hop before the seam that rejects.
3. Actionable condition → any pin on a cross-boundary projection must push the payload through the receiver's *real* door, never assert on the wire shape alone.

### AND-gate (why single-cause analysis was insufficient)
The failure required BOTH (a) a carrier-swapping projection that did not rebuild the revision (code) AND (b) records actually carrying bytes at push time (data — always true live, never true in the old fixtures). Under the old fixtures condition (b) was false, so condition (a) was invisible and benign; either change alone would have hidden half of the picture.

### Why wasn't this caught?
**No gate existed for this class.** Enumerated: `tsc` cannot (the revision is a plain string; no type relation to the collections); the existing transport tests cannot (fixtures shipped `rotoPhysical: null`, and assertions stopped at the wire shape); no lint rule applies (the invariant lives only in comments/convention); code review had no gate for the same reason. The full suite — including the production vite-build test — was green at base, as it was for the two falsified rounds.

### Recurrence guard
- **Regression test (primary):** `app/src/components/physic-paint/bridge/physicsPaintBridgeTransport.test.ts` → `'a bytes-carrying runtime document crosses the D-12 projection into the parent realm'`. Verified: RED at base with the exact live message; GREEN after; revert-and-reconfirm passed. It installs bytes through the launch-hydration door, drives the real sender, the receiver's exact `parseEfxPaintDocument(fromTransportPayload(...))` door and the real installed listener — so any future projection that swaps a carrier without recomputing the revision fails with the live signature.
- **KB pattern:** the knowledge-base entry for this session, so a Phase-0 recall on "canonical revision mismatch" or "documentSync rejected" surfaces the prior guard.
- **Not adopted (honest options, deliberately left open):** co-shipping the revision rebuild inside `toPersistedRotoRecords`, or making the revision a branded derived type. The fix stayed minimal at the projection boundary; these would harden the *class* further and remain candidates if it recurs.
