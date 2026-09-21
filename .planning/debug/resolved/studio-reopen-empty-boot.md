---
status: resolved
trigger: "After any photo-reference display change (hide/show) in Studio, closing Studio and reopening it boots an EMPTY Studio (Engine not ready, Tracks 0, black canvas); restarting the whole app is the only recovery. The user reported the same symptom BEFORE the current uncommitted display-persistence fix ('set the reference hidden → close Studio → can't open it') — so it likely pre-dates that fix; the fix made it reliably reachable."
created: 2026-09-21T14:35Z
updated: 2026-09-21T15:10Z
---

## Current Focus
<!-- OVERWRITE on each update - reflects NOW -->

hypothesis: RESOLVED — both fixes shipped and verified. Live ("work !"): after a photo-reference visibility toggle + Studio close, the Studio reopens READY (engine ready, tracks present, canvas content) and the display choice persists. Fix (A) display-persistence — the child push guard and the parent register guard compare `buildEfxPaintDocumentSyncFingerprint` (canonical revision + photo display term) instead of the bare revision; behavioural pins added (documentSyncPushGuard.test.ts display suite + launchPackBytes LEG 4), each RED at base. Fix (B) empty-boot — (Leg 1) `openPhysicPaintCanvas` awaits `physicPaintStore.materializeRuntimeRotoMediaBytes(layerId)` BEFORE `createPhysicPaintLaunchContext` — bridged bytes first (`_frameMediaBytes`, no IO), then `_packageDirProvider` + the digest-verified `resolveFrameMediaBytes`, installs through `mirrorRotoPhysicalDocument` (no revision bump, no dirty, lease-refusal logged per track), failures returned per key and logged loudly by the bridge — never thrown, never blocking a launch. (Leg 2) `recordsAsRuntimeFramesToleratingReferences` (same frame shape as the strict helper; skips reference-only records) seeds the Studio at all four seed sites (:518 initial ref, :527 launch replacement, :943 track-switch reseed, :1729 render-body realKeyFrames — the last via a skip-not-assert flatMap); `recordsAsRuntimeFrames` and `requirePhysicPaintRotoInlineBytes` keep their strict publish contracts untouched. The temporary bootErrorCapture instrumentation is deleted (module + main.tsx import); no trace instrumentation remains.
test: DONE — finalization gates all green: guard display pins 7/7 GREEN (2/2 RED at base, 5 pre-existing unaffected); chain test 5/5 GREEN (LEG 4 RED at base with the bare-revision register guard, LEG 1/1b/3 unchanged GREEN); full `vitest run` 218 files / 4079 passed / 1 skipped / 101 todo / 0 failed; `tsc --noEmit` clean; `grep documentSyncTrace|bootErrorCapture|traceDocumentSync` empty.
expecting: nothing further — archived as resolved.
next_action: "None. Session closed at commit d5437a15 (code) + the docs commit for this file and the knowledge-base entry."

## Eliminated
<!-- APPEND only - prevents re-investigating -->

- hypothesis: The throw is inside `hydrateRotoPhysicalLaunchContext` (an uncaught store install failure)
  evidence: rotoLaunchHydration.ts:75-122 returns `{ok:false}` with its OWN console.error on every failure path, and its only internal try wraps `prepareRotoPhysicalRealKeyFrames`; the failing console shows the coordinator's 'launch replacement handoff failed' message instead, i.e. an exception escaping `applySettledLaunchContext` after hydration returned ok (the per-key warning printed first).
  timestamp: 2026-09-21T15:10Z
- hypothesis: `_pruneUnreferencedRotoAlphaCanvases` / `_getTrackBytesTokens` (called inside replaceRotoPhysicalDocument's install door) assert inline bytes
  evidence: physicPaintStore.ts:1076/:1115 only collect byte tokens of existing payloads and prune alpha canvases; `replaceRotoPhysicalDocument` parses via `parsePhysicPaintRotoPhysicalDocument`, which admits media-only records (payload-mode guard `hasBytes === hasMedia`), and installs maps without any byte assertion.
  timestamp: 2026-09-21T15:10Z
- hypothesis: The child's `launchContext` state was non-null from the start (a URL `context` param), so `rotoPersistence.resetForLaunch`'s `publishCurrentDocument` threw
  evidence: the failing session's href (booterror-studio.json) and Rust `physics_paint_url` carry no `context` param — `parsePhysicsPaintLaunchContext(window.location)` is null and the first apply arrives via the bridge fetch; at that point `resetForLaunch` reads `inputRef.current.launchContext` = null and skips the publish (useRotoFramePersistenceCoordinator.ts:615-624).
  timestamp: 2026-09-21T15:25Z
- hypothesis: `keyUtilities.resetSession` / `rotoNavigation.resetForLaunch` throw on the byte-less record
  evidence: useRotoKeyUtilities.ts:78-83 only clears the clipboard ref and bumps a session version; useRotoNavigationCoordinator's resetForLaunch calls playback.resetForLaunch + keyUtilities.resetSession — no byte assertions anywhere in that chain.
  timestamp: 2026-09-21T15:30Z
- hypothesis: "The package file for b96927bb is missing/corrupt or digest-mismatched"
  evidence: (orchestrator disk check) the file exists and its sha256 equals the recorded digest — the failure is a runtime-shape violation, not a file problem. The hydration warning's "could not be read" phrasing describes the tolerated branch's origin story, not this session's cause.
  timestamp: 2026-09-21T14:35Z

## Symptoms
<!-- Written during gathering, then IMMUTABLE -->

expected: After any Studio-origin change, closing Studio and reopening it must boot the Studio normally (engine ready, tracks and content restored).
actual: Reopening boots an empty Studio — "Engine not ready" badge, Tracks 0, black canvas. Only an app restart recovers. Console: rotoLaunchHydration warning for key b96927bb (no inline bytes) + `launch replacement handoff failed – Error: Roto physical real-key payload carries no inline raster bytes (reference-only record on a runtime path).`
errors: "[PhysicsPaintStudio] launch replacement handoff failed – Error: Roto physical real-key payload carries no inline raster bytes (reference-only record on a runtime path)." (usePhysicsPaintLaunchIntegration.ts:31) and the per-key warning from rotoLaunchHydration.ts.
reproduction: Open project → Studio → make any photo-reference display change (hide/show) → close Studio → reopen Studio → empty/black Studio.
started: pre-dates the uncommitted display-persistence fix (user hit it earlier the same day); made reliably reproducible by that fix.

## Evidence
<!-- APPEND only - facts discovered -->

- timestamp: 2026-09-21T14:35Z
  checked: The failing key on disk
  found: `b96927bb-a085-4a63-a089-f9a5bd19838c` is a real-key record at appFrame 1 in layers/a605a976-3bf9-43ba-85f1-e9f6b4f0677c.json; its recorded media digest `c5258e2f49fb07b408df340b4772af24174f7e052f25b5fb33eb644da1e7ad9f` EQUALS the sha256 of `frames/a605a976-.../b96927bb-....webp` (208920 bytes, mtime 12:59 2026-09-21). Package file present and intact.
  implication: "could not be read" is NOT a missing/corrupt file — it is a read/materialization-path failure (or the bytes never entered the carried document in the first place)

- timestamp: 2026-09-21T14:35Z
  checked: Throw site + tolerance design
  found: `requirePhysicPaintRotoInlineBytes` (physicsPaintRotoPhysicalModel.ts:669) throws on a payload without `bytes` — documented as a deliberate contract violation ("a reference-only payload only ever exists behind the on-disk door"; "a runtime projection that meets one is a contract violation, so this refuses loudly"). `hydrateRotoPhysicalLaunchContext` (rotoLaunchHydration.ts:80-120) deliberately tolerates byte-less records (loud warning per key, structural install continues) — the throw comes LATER, from the launch replacement handoff (usePhysicsPaintLaunchIntegration.ts:31 → coordinator catch at :44-46).
  implication: the design expects reference-only records to be MATERIALIZED (bytes attached) before any runtime projection; the failure is that materialization did not happen for b96927bb

- timestamp: 2026-09-21T14:35Z
  checked: Frame-media resolution + package-root provider
  found: physicPaintStore.ts:1340-1410 resolves media via (1) a digest-keyed bridged-bytes map `_frameMediaBytes`, (2) the package root from `_packageDirProvider`, else (3) 'missing' with the loud "no package root is available in this window" warning. The provider is wired ONLY by projectStore.ts:1097 (`dirPath.value ?? null`); the child realm's projectStore has no project loaded (no dirPath assignment found on the launch path).
  implication: in the Studio child window, media resolution from the package is likely structurally unavailable; carried records must arrive with inline bytes (bridged or carrier-injected) — so the question is which upstream source should have supplied b96927bb's bytes

- timestamp: 2026-09-21T14:35Z
  checked: Working tree state (uncommitted, from the display-persistence fix session)
  found: Modified: `documentSyncPushGuard.ts` (fingerprint now `buildEfxPaintDocumentSyncFingerprint`), `efxPaintDocumentRevision.ts` (new sync fingerprint + photo-display term), `physicPaintBridge.ts` (parent register guard uses the sync fingerprint). New: `app/src/lib/bootErrorCapture.ts` + its first-import in `main.tsx`. The boot-error capture ran during the failing session and recorded ONLY the `hook-installed` entry — the failure is caught and console-logged, never uncaught.
  implication: the display change now PUSHES and REGISTERS a media-only document parent-side; whether that register drops/never-should-carry the parent's byte cache for a key is a primary suspect. Keep these changes; the boot-error capture stays until the session closes.

- timestamp: 2026-09-21T15:05Z
  checked: The child's docSync push projection (physicsPaintBridgeTransport.ts:232-328) + the sender-side delivery marking (:178-186)
  found: `projectRecordsForSync` builds a `FrameMediaReference` for EVERY record and returns `toPersistedRotoRecords(records, ...)` — the shipped document's real-key collections are STRUCTURALLY reference-only, always; pixels ride only the separate digest-keyed `changedBytes` map, and only for digests the receiver is not known to hold (`documentSyncSentDigests`, seeded by `markEfxPaintDocumentSyncFrameDelivered` after an apply-channel delivery). The shipped revision is recomputed over the projected (media-term) collections (the 9542ac14 law).
  implication: every docSync push ships media-referenced rotoPhysical — the receiver-side mirror (next entry) therefore installs media-referenced records into the parent runtime on every accepted push.

- timestamp: 2026-09-21T15:05Z
  checked: The parent receive handler's mirror loop (physicPaintBridge.ts:3300-3311)
  found: after the fingerprint guard + `registerEfxPaintDocument`, for EVERY track: `if (getRotoPhysicalContentRevision(layerId, trackId) === track.rotoPhysical.revision) continue;` then `physicPaintStore.mirrorRotoPhysicalDocument(layerId, track.id, track.rotoPhysical)` — the PUSHED (persisted-shape) document replaces the runtime record maps wholesale; `mirrorRotoPhysicalDocument` (store :3605-3649) parses it (media-only admitted) and installs. "Frame bytes stay owned by the bridge applies" (comment :3290) is NOT true after this replace: the applied bytes live in `_frameMediaBytes`/LRU, not on the records.
  implication: the parent runtime's "runtime real-key records carry inline bytes" invariant — the exact premise of `createPhysicPaintLaunchContext:3476` and of `getPhysicPaintRotoAuthority:733-740` ("a reference-only record never reaches this path") — is broken by every accepted docSync push. Guard mismatch is guaranteed post-materialization: parent revision = byte-terms (`d<token>;`), pushed = media-terms (`m<relativePath><digest>;`).

- timestamp: 2026-09-21T15:10Z
  checked: The launch carrier build + the D-13 declared consumers
  found: `createPhysicPaintLaunchContext` (:3476) reads `physicPaintStore.getRotoPhysicalDocument` (the runtime) and ships it verbatim (:3484-3519) with no byte materialization; non-active tracks ship `extractRuntimeStateForDocument(...).rotoPhysical ?? track.rotoPhysical`. `efxPaintMediaMaterialize.ts:1-24` declares exactly three byte-requiring consumers — the parent authority frames projection, THE LAUNCH-CONTEXT PACK, and the engine's real-key preparation — and the open leg materializes for them once, at project open. The launch leg has no equivalent step.
  implication: the launch pack's documented contract ("the packed document is built from runtime records; a reference-only record never reaches this path") is violated by design omission once the runtime can hold persisted-shape records — the fix belongs at this consumer seam.

- timestamp: 2026-09-21T15:15Z
  checked: Where the child actually throws after the hydration warning (usePhysicsPaintLaunchIntegration.ts:114-199 + PhysicsPaintStudio.tsx:521-545 + preact hooks source)
  found: `applyPhysicsPaintLaunchContext` (:177) calls the Studio's `setLaunchContext` wrapper, whose `setLaunchContextState((current) => {...})` updater contains `latestRotoFramesRef.current = carried ? recordsAsRuntimeFrames(carried) : [];` (:527) — and `recordsAsRuntimeFrames` (useRotoFramePersistenceCoordinator.ts:260-273) asserts `requirePhysicPaintRotoInlineBytes(record.payload)` on every carried record. Preact's `useState` setter invokes the reducer/updater SYNCHRONOUSLY inside the call (preact/hooks/src/index.js:190-200, `invokeOrReturn`), so the throw propagates out of `applySettledLaunchContext` into the coordinator's catch (usePhysicsPaintLaunchIntegration.ts:47-49) and the state update never commits.
  implication: mechanism fully explains the symptom set — coordinator-caught error (bootErrorCapture: no uncaught entry), launchContext stuck null (no engine setup, "Engine not ready"), shell frozen at the pre-launch render ("Tracks 0", black canvas), and recovery only by app restart (re-materialization at open). Render-body twins at :943 and :1722-1728 assert the same bytes and are the next reachable throwers if the state ever commits with a reference-only record.

- timestamp: 2026-09-21T15:30Z
  checked: Live captures from the failing day (app-written /tmp files) against the chain
  found: `/tmp/efx-stall-capture-docsync-main.json` (12:59, main realm): the launch-time push was SKIPPED by the revision guard (`main.skipEqualRevision`, docrev 57), then a SECOND push — the photo-reference display change, ~11s later — `main.received` → `main.parsed` → `main.registered` (docrev 57, same layer a605a976, same tracks 5897f7d0/d799c878 as the failing session). `/tmp/efx-stall-capture-booterror-studio.json` (14:22 reopen, operationId ...376301): ONLY the hook-installed entry — the failure was coordinator-caught. The 12:59 session's operationId (...383864) is ~83 min earlier than the failing reopen's — the same session chain, close+reopen; disk docrev 58 = one further push (the close flush).
  implication: live observation matches the traced chain: the register (hence the mirror loop) ran for the display-change push, and by the reopen the parent runtime's active-track record for b96927bb was reference-only (proven by the child's own warning, which can only be produced by the carried document built from that runtime).

- timestamp: 2026-09-21T15:35Z
  checked: Remaining child-side runtime projections that could assert bytes after a boot
  found: `_preResolveTrackContent` (store :1654-1662) has the D-13 media tolerance (media-carrying records resolve through `_resolveMediaRasterResolution`, never the assertion). `_toRenderedPayloadFrame` (:2176-2184, called from interpolation derivation :2301-2302) asserts bytes on neighbor REAL payloads — reachable only if a reference-only record survives in a runtime while an interpolation segment spanning it renders (residual case, not this bug's path).
  implication: with the launch carrier carrying bytes again, the child's store is byte-carrying and every one of these seams holds; the residual (genuinely unreadable file) class is the only remaining reference-only-in-runtime source and is handled by the tolerance hardening at the launch seed.

- timestamp: 2026-09-21T16:05Z
  checked: The RED regression pin `app/src/lib/physicPaintBridge.launchPackBytes.test.ts` (4 legs) run at base with `vitest run`
  found: LEG 1 drives the FULL real chain — child realm's real transport (delivered-digest withheld via `markEfxPaintDocumentSyncFrameDelivered`, exactly the in-session apply-delivery case) → captured `emitTo` wire payload (reference-only, `changedBytes` absent) → parent realm's REAL installed listener (precondition asserted: the runtime's byte record becomes reference-only after the mirror) → `openPhysicPaintCanvas` → carrier active-track record has NO bytes and `recordsAsRuntimeFrames(carried)` throws the production message verbatim. LEG 1b (bridged bytes already held): carrier stays reference-only, 0 file reads, tolerant seed missing. LEG 3 (no package root, no bridged bytes): carrier stays reference-only, no loud warn (none exists yet), tolerant seed missing. LEG 2: strict seed keeps throwing (already true at base), tolerant helper absent.
  implication: the RCA is now executable and falsifiable at the production seams; the fix must (a) materialize at the launch door (bridged bytes → digest-verified package read → mirror-door install), (b) add the tolerant launch seed helper the component boots through, (c) log per-key failures loudly at the door. The door must never refuse a launch for frame media.

- timestamp: 2026-09-21T16:05Z
  checked: The receiver's missing-digest request channel (bonus evidence for the live scenario)
  found: `applyDocumentSyncFrameMedia` (physicPaintBridge.ts:3199-3244) does not only read `changedBytes`: for every digest the receiver does NOT hold (`hasFrameMediaBytes` = LRU or `_frameMediaBytes`) and has not already asked for, it emits `physic-paint:frame-media-request` to the Studio (one request per digest, ever), and the Studio re-ships those bytes through the install port into `_frameMediaBytes` (undecoded until a decode needs them). In the live session the display push therefore likely ASKED for b96927bb's digest and the Studio re-shipped its bytes — so at reopen `_frameMediaBytes` very possibly held them; the fix's source (a) (in-memory bridged bytes, no IO) may well be the branch that resolves in production, with the package read as the durable fallback.
  implication: the fix's two resolution sources together cover both the live shape (bridged bytes in memory) and the cold shape (package read) — and never re-issue what the receiver already holds.

- timestamp: 2026-09-21T14:47Z
  checked: The fix applied and the regression file re-run (GREEN)
  found: Leg 1 = `physicPaintStore.materializeRuntimeRotoMediaBytes(layerId)` (physicPaintStore.ts, after `getRotoPhysicalDocument`) + the awaited call in `openPhysicPaintCanvas` (physicPaintBridge.ts:3554-3572) with per-failure `console.warn` naming `failure.relativePath`. Leg 2 = `recordsAsRuntimeFramesToleratingReferences` in useRotoFramePersistenceCoordinator.ts (same frame shape as the strict helper, built via the same filter-less literal path that skips reference-only records) + its four Studio seed sites (PhysicsPaintStudio.tsx:518/:527/:943 swapped; :1722 `realKeyFrames` now a skip-not-assert `flatMap`). `buildBytesPayload` exported and `FrameMediaMaterializeFailureReason` widened with `'no-package-root'` in efxPaintMediaMaterialize.ts. Run: 4/4 GREEN; related suites 11 files / 257 tests GREEN; `tsc --noEmit` clean.
  implication: the production throw site is closed at both seams — the carrier now carries bytes whenever any source can produce them, and the boot can no longer be bricked by a reference-only record even when none can.

- timestamp: 2026-09-21T15:00Z
  checked: Human-verify checkpoint and finalization
  found: The user ran the live pass and confirmed "work !" — after a photo-reference visibility toggle + Studio close, the Studio reopens READY (engine ready, tracks present, canvas content), the display choice persists, no console failures. Finalization: fix-A behavioural pins added (`documentSyncPushGuard.test.ts` display suite 2/2 RED at base → GREEN; `launchPackBytes.test.ts` LEG 4 — the parent register for a display-only push — RED at base with the bare-revision register guard → GREEN), both verified by reverting the fix in place and restoring; temporary `bootErrorCapture.ts` + its `main.tsx` first-import deleted, `grep -rn "documentSyncTrace\|bootErrorCapture\|traceDocumentSync" app/src` empty; full `vitest run` 218 files / 4079 passed / 1 skipped / 101 todo / 0 failed; `tsc --noEmit` clean; ONE commit on main (a clean two-commit split is impossible by file: `physicPaintBridge.ts` carries hunks of BOTH fixes).
  implication: the fix is confirmed end-to-end in the real window, the tree carries both fixes with no instrumentation residue, and each fix has a RED-at-base behavioural pin (guard-level for A; the real child→parent chain for A and B).

## Resolution
<!-- OVERWRITE as understanding evolves -->

root_cause: Two root causes, one chain (the display fix made the empty boot reliably reachable; the empty boot made the display fix dangerous). (A) The display choice was never synced: the docSync change detection on BOTH sides — the child's push guard and the parent's register guard — compared `buildEfxPaintDocumentRevision`, which deliberately excludes the photo-reference display fields (visibleInStudio / opacity / transform / transformLocked; D-07 vs D-11/D-12/D-13). A display-only change therefore compared "equal" and was deduped child-side (never pushed) and skipped parent-side (never registered), so the visibility/opacity/transform choice never reached the saved document. (B) The empty boot, a four-link chain: (1) the child's docSync push is structurally reference-only (bytes withheld to the digest-keyed `changedBytes` channel / already-delivered digests). (2) The parent's receive handler mirrors that persisted-shape document into the PARENT RUNTIME (`mirrorRotoPhysicalDocument`, physicPaintBridge.ts:3300-3311) — replacing the byte-carrying runtime records with media-only ones; the revision guard always mismatches (byte-terms vs media-terms), so this fires on the first accepted push (made deterministic for a display-only change by fix A). (3) `createPhysicPaintLaunchContext` builds the launch carrier from that runtime WITHOUT materializing bytes — the launch-context pack is a declared byte-requiring consumer (efxPaintMediaMaterialize.ts) that has no launch-leg materialization. (4) The child's launch hydration tolerates the reference-only record (by design, loud warning), but the very next step — the synchronous preact state-updater at PhysicsPaintStudio.tsx:527 running `recordsAsRuntimeFrames(carried)` → `requirePhysicPaintRotoInlineBytes` — throws, aborting the whole launch replacement handoff; the launch state never commits, so the Studio never leaves its pre-launch shell. App restart recovers only because openProject re-materializes runtime bytes from the package.
fix: "(A) Display persistence: `buildEfxPaintDocumentSyncFingerprint` (efxPaintDocumentRevision.ts) = the canonical revision PLUS the photo-reference display term; BOTH dedupe points — the child's push guard and the parent's register guard — compare it, so a display-only change ships and registers while a genuine duplicate still dedupes. The canonical revision keeps its deliberate display exclusion. (B) Empty boot — Launch door (Leg 1): `physicPaintStore.materializeRuntimeRotoMediaBytes(layerId)` re-attaches bytes to every reference-only runtime record before any launch projection reads it — bridged bytes (`_frameMediaBytes`) first (no IO, non-destructive), then `_packageDirProvider()` + digest-verified `resolveFrameMediaBytes`; installs through `mirrorRotoPhysicalDocument` (no revision bump, no dirty) with the revision recomputed over the healed collections; failures returned per key (widened reason union with 'no-package-root'), never thrown. `openPhysicPaintCanvas` awaits it before `createPhysicPaintLaunchContext` and logs each failure loudly (path + track + key + reason). Boot tolerance (Leg 2): `recordsAsRuntimeFramesToleratingReferences` seeds the Studio at the four seed sites (initial ref, launch replacement, track-switch reseed, render-body realKeyFrames) — a reference-only record renders as missing content instead of aborting the handoff; the STRICT `recordsAsRuntimeFrames` and `requirePhysicPaintRotoInlineBytes` keep their publish-path contracts unchanged."
verification: |
  target_test:          { result: pass }   # src/lib/physicPaintBridge.launchPackBytes.test.ts — 5/5 GREEN (LEG 1/1b/3 RED 4/4-legs-worth at base observed 16:05Z; LEG 4 added and RED at base against the bare-revision register guard)
  mutation_check:       { result: pass, mutant_killed: 3/3, reason_if_skipped: "Stryker absent from the workspace (no config, no dependency) — replaced by three manual mutants, one per fix leg, each run against the driving test" }
                        # M1 remove the launch-door materialize call -> LEG 1/1b/3 RED (carriedRecordCarriesBytes false, loudWarn false)
                        # M2 make the tolerant helper strict (filter -> true)   -> LEG 3/2 RED (tolerantSeedThrew = the production error)
                        # M3 drop the bridge failure warn loop                  -> LEG 3 RED (loudWarnMentionedTheKey false)
                        # each mutant reverted in place; 4/4 GREEN after every reapply
  no_op_deletion:       { result: pass, deletion_justified_by_rca: true }
                        # diff is net-additive (+230/-16); the two replacements swap a strict projection for the tolerant one at BOOT SEED sites only —
                        # the RCA (root_cause item 4) justifies loosening the seed: one unresolvable frame must never abort the launch handoff
                        # (quick-260913-52r G doctrine). The strict helper + requirePhysicPaintRotoInlineBytes are untouched for the publish path.
  adjacent_tests:       { result: pass, suites_run: ["npx vitest run (full) — 218 files / 4079 passed / 1 skipped / 101 todo / 0 failed", "npx tsc --noEmit — clean", "11 focused suites / 257 tests (transport, documentSyncPushGuard, coordinator, launch integration, launch context, media materialize/read, bridge + authority, package round-trip)"] }
  revert_and_reconfirm: { result: pass, bug_returned_on_revert: true, fixed_on_reapply: true }
                        # scoped in-place reverts (M1..M3 above) each made the driving test reproduce the bug; reapply restored GREEN.
                        # Full-tree git stash NOT used: the tree carries the user's uncommitted display-persistence fix + the temp bootErrorCapture
                        # instrumentation — a stash would revert unrelated user work (scoping constraint, logged).
                        # NOTE: PhysicsPaintStudio.test.ts:235 was RED before this fix (a stale static pin the uncommitted display fix invalidated:
                        # the guard moved from buildEfxPaintDocumentRevision to buildEfxPaintDocumentSyncFingerprint); updated to the new law.
  fix_a_pins:           { result: pass, RED_at_base: true }
                        # documentSyncPushGuard.test.ts display suite (visibility + opacity/transform, with a duplicate control): 2/2 RED with the HEAD guard (evaluate -> null), GREEN with the fingerprint guard.
                        # launchPackBytes.test.ts LEG 4 (the parent register for a display-only push through the real chain; the harness now drives TWO pushes so the display toggle is the only difference): RED with the bare-revision register guard (parent keeps visible=true), GREEN with the sync fingerprint.
  guardrail_verdict:    accepted
  live_acceptance:      { result: pass, evidence: "user-run native pass: photo-reference visibility toggle -> Studio close -> reopen = READY (engine ready, tracks present, canvas content), display choice persisted, no console failures. User: 'work !'." }
  oracle_type:          specified
commit: d5437a15
files_changed:
  - app/src/components/physic-paint/bridge/documentSyncPushGuard.ts (fix A: the push guard compares buildEfxPaintDocumentSyncFingerprint, not the bare revision)
  - app/src/efx-paint/document/efxPaintDocumentRevision.ts (fix A: new buildEfxPaintDocumentSyncFingerprint = canonical revision + the photo display term encodeCanonicalPhotoReferenceDisplay; the canonical revision keeps its deliberate exclusion)
  - app/src/components/physic-paint/bridge/documentSyncPushGuard.test.ts (fix A pin: the display-change suite, RED at base)
  - app/src/lib/physicPaintBridge.ts (fix A: the parent register guard compares the sync fingerprint; fix B: openPhysicPaintCanvas awaits materializeRuntimeRotoMediaBytes before createPhysicPaintLaunchContext and logs each per-key failure loudly)
  - app/src/stores/physicPaintStore.ts (fix B: materializeRuntimeRotoMediaBytes — bridged bytes, then the digest-verified package read, install through the mirror door with the revision recomputed over the healed collections)
  - app/src/lib/efxPaintMediaMaterialize.ts (fix B: buildBytesPayload exported for the launch-leg re-carrier; failure reason union widened with 'no-package-root')
  - app/src/components/physic-paint/hooks/useRotoFramePersistenceCoordinator.ts (fix B: recordsAsRuntimeFramesToleratingReferences; the strict recordsAsRuntimeFrames untouched)
  - app/src/components/physic-paint/PhysicsPaintStudio.tsx (fix B: the four boot SEED sites use the tolerant projection — initial ref, launch replacement, track-switch reseed, render-body realKeyFrames)
  - app/src/lib/physicPaintBridge.launchPackBytes.test.ts (new: the real child→parent chain test — LEG 1/1b/3 for fix B, LEG 4 for fix A)
  - app/src/components/physic-paint/PhysicsPaintStudio.test.ts (the stale static pin updated to the fingerprint guard law)
  - deleted: app/src/lib/bootErrorCapture.ts + its import in app/src/main.tsx (temporary session instrumentation)

## Prevention (blameless postmortem)

The Phase-2A reasoning-checkpoint branches (candidate causes spanned code / environment / data) carry into this postmortem; the AND-gate answered YES — the failure required two contributing conditions simultaneously (a display change that never bumps the revision, AND a runtime mirror that had already converted the parent's records to the persisted shape).

### 5-Whys, branched across categories

**Code branch — the change-detection value did not cover the change class**
1. Why was the display choice lost on close? → the docSync push never carried it: the child's push guard deduped "same document" and the parent's register guard skipped "equal revision".
2. Why did both compare equal? → both compared `buildEfxPaintDocumentRevision`, which by design excludes the photo display fields (D-07 vs D-11/D-12/D-13).
3. Why was the exclusion not compensated? → the sync channel is the only path that must ship those fields, and it had no term for them: the guard's contract was "content unchanged ⇒ skip", but the value it compared summarized a SUBSET of the content it claimed to measure.
4. Why was the subset invisible? → the revision's doc comment states the exclusion clearly, yet nothing linked the revision to the channel's needs — a reader of `documentSyncPushGuard.ts` saw a generic "content fingerprint", not "everything persisted".
5. Actionable condition → a change-detection value must be defined at its consumer's granularity; the fix introduces `buildEfxPaintDocumentSyncFingerprint` AT the revision module so the two laws sit side by side and cannot drift silently.

**Code branch — the boot seed asserted where it should have degraded**
1. Why was the Studio bricked rather than showing missing content? → `recordsAsRuntimeFrames` asserts inline bytes, and it ran inside the synchronous preact state updater of the launch-context setter.
2. Why did a reference-only record reach it? → the parent's docSync receive mirror replaces the runtime records with the pushed (persisted-shape) ones — by design — and `createPhysicPaintLaunchContext` then packed that runtime without materializing.
3. Why was the launch pack not materialized? → `efxPaintMediaMaterialize.ts` names three byte-requiring consumers; the open leg materializes for all three at project open, but the LAUNCH leg (a second, later entry point into a child that needs bytes) had no equivalent step — the third consumer's contract was honored on one path only.
4. Why did the miss not surface earlier? → the assertion threw inside a setter, so the failure looked like a dead window, not a named missing-bytes error; and the harness (vitest) cannot mount the Studio, so the seed site had no test.
5. Actionable condition → every declared byte-requiring consumer needs its own materialization step at ITS door (done: the launch door), and a runtime projection used as a BOOT SEED must degrade (missing content) rather than assert (done: the tolerant seed).

**Environment/gate branch — the harness cannot see the live launch path**
1. Why were the previous rounds (display fix, e21, ffh) unable to catch it? → the vitest harness drives the non-Tauri DOM fallback and cannot mount the Studio component (Tauri window + engine deps), so neither the parent's receive mirror nor the child's synchronous launch seed executed in any test.
2. Why did that not block the fix? → the chain test drives the REAL sender, the REAL installed listener and the REAL launch door across two module instances, stopping exactly at the component boundary — the closest reachable seam.
3. Actionable condition → when a component cannot be mounted, pin the exported helper its code path calls, and drive the cross-realm chain with real modules (the pattern `launchPackBytes.test.ts` now establishes).

### AND-gate (why single-cause analysis was insufficient)
The bug required BOTH (a) a display change that registered parent-side (the fix that made it deterministic) AND (b) the parent runtime already holding the mirrored persisted-shape records at launch time. Either condition alone is benign: without (a) no display push reaches the parent; without (b) the launch pack carries bytes. The two defects also mask each other — before fix A the display change never pushed, so the empty boot was rare/intermittent; fixing A made B reliably reachable.

### Why wasn't this caught?
- **Fix A:** no gate existed. The guard's tests exercised content changes that DID bump the revision (background fallback), so the display-only class had no assertion; tsc cannot (both values are strings); review would need to notice that one revision deliberately excludes fields the guard must observe.
- **Fix B:** no gate existed for the launch path. The vitest harness cannot mount the Studio (Tauri deps), the parent's rejection paths are console-warn-only, and the child's throw happened inside a synchronous preact setter whose abort is swallowed by the coordinator's catch. Two prior rounds were falsified for the same harness reason.
- The stale static pin (`PhysicsPaintStudio.test.ts:235`) was the ONE gate that noticed fix A: it went RED the moment the guard law changed — updated to the new fingerprint law with provenance recorded.

### Recurrence guard
- **Regression test (primary, fix B):** `app/src/lib/physicPaintBridge.launchPackBytes.test.ts` — LEG 1/1b/3 drive the real child→parent chain (real transport, real installed listener, real launch door) and are RED at base with the production throw; LEG 3 pins the honest-failure path (loud per-key warning, never blocking).
- **Regression test (fix A):** the display suite in `app/src/components/physic-paint/bridge/documentSyncPushGuard.test.ts` (RED at base) and LEG 4 of the chain test (the parent register for a display-only push; RED at base with the bare-revision guard). Together they pin both sides of the dedupe.
- **Assertion / contract split:** `buildEfxPaintDocumentSyncFingerprint` lives next to `buildEfxPaintDocumentRevision` with both doc comments stating the split, so the next reader sees the two laws together.
- **KB pattern:** the knowledge-base entry for this session, so a Phase-0 recall on "empty Studio reopen" / "Engine not ready after close" surfaces this chain before re-deriving it.
