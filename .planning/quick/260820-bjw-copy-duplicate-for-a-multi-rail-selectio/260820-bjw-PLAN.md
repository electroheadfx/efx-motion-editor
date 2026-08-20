# 260820-bjw — Copy / Duplicate for a multi-rail selection set (43.6 extension)

**Type:** quick · **Status:** planned
**Source:** SPECS/milestone-v0.9.0-new-phases/quick-rail-set-copy-duplicate-prompt.md

Extends the 43.6 rail-set infrastructure with batch Copy and Duplicate. With an active rail set, the existing Copy / Paste / Duplicate toolbar controls operate on the whole set; without a set, single-key and key-group behavior stays byte-identical.

## Contract (locked, from the spec)

- **Scope routing:** active rail set → Copy/Paste/Duplicate take the set as their scope (same dynamic-scope pattern as Delete 43.4/43.6). No set → byte-identical to today. The set clipboard replaces the existing clipboard content (durable reusable clipboard contract unchanged; a new copy of any kind overwrites the slot).
- **Copy payload per rail type:** Key Rail → its real keys with full paint payloads, relative frames, and internal interpolation breaks. Motion/Static Rail → duplicated shared-source placement (new placement sharing the source cycle; copy-on-write before any later local edit; referenced Action never copied or modified; provenance follows the 43.2 duplicated-placement rules).
- **Paste:** the set's first rail starts at the current cursor frame; every other rail keeps its relative offset from the first. All internal gaps and breaks preserved exactly.
- **Duplicate:** same placement rule with destination = first valid position starting immediately after the set's last rail end.
- **Resolver authority:** destination-occupancy authority (paste-key-group precedent) — every computed destination frame must be empty and inside capacity. Collision → reject the WHOLE paste with the existing mapped family `Paste rejected — key in the way`; over-capacity/out-of-range → `Paste rejected — not enough room`. All-or-nothing, zero partial paste.
- **Identity:** new keys receive fresh stable identities (never reuse source keyIds).
- **Rail-boundary integrity:** a pasted rail's first key carries an incoming break whenever it had one in the source set; AND if any pasted rail lands immediately adjacent to non-set content on its left, its first key owns an incoming break — a pasted set never silently merges into a neighbor's segment.
- **Atomicity/selection:** one atomic physical-history command for the whole set paste; one Undo removes every pasted rail; one Redo re-applies. After commit the pasted set becomes the active selection (anchor = first pasted rail); the cursor stays on its current frame (43.4 stay-put). Save/reopen, playback, preview, export parity; failed/rejected paste changes nothing and creates no history entry.

## Design decisions (this plan locks where the spec leaves room)

- **One new operation kind `paste-rails`** serves BOTH Paste and Duplicate. `placementMode: 'paste' | 'duplicate'` rides the execute input; for `'duplicate'` the shared proposer computes the destination from document facts only (deterministic on child AND parent sides), for `'paste'` the input carries the destination (= cursor frame). One history command family, one replay path.
- **Set clipboard = a third session-clipboard variant** `RotoSessionCopiedRailSet` added to `RotoSessionCopiedKeyValue` (beside single key and key group). This is the faithful reading of "the set clipboard replaces the existing clipboard content" — one clipboard slot, `copiedKey` stays non-null, `hasCopiedRotoKey` and the reusable-clipboard contract keep working unchanged.
- **The set copy payload is built at Copy time** by a pure function (`buildRotoRailSetCopyPayload`) freezing the real-key paint payloads + loop placement facts; Paste reads the frozen payload (copy-on-write from the copy moment), matching the durable reusable clipboard contract.
- **`'paste'` routing lives at the Studio binding layer** (like Cut's composition), not inside `session.pasteKey`; the session's single/group paste path stays untouched. `useRotoKeyUtilities.pasteKey` gains a defensive rail-variant guard (fail closed, never falls into the single-key payload cast).

## Where / why (file anchors)

- `app/src/components/physic-paint/roto/physicsPaintRotoRailSetSelection.ts` — `RailSetIdentity` (line 20), `deriveRailSetOrder` (line 103), `resolveRailSetPostAcceptance` (line 320, explicit branches), `recordRailSetSnapshot` (line 288). NEW `'paste-rails'` aftermath branch: pasted set becomes the selection (anchor = first pasted rail).
- `app/src/components/physic-paint/roto/physicsPaintRotoGroupLifecycle.ts` — `proposePhysicPaintRotoDeleteRails` (line 897) is the ONE-shared-set-proposer precedent (child coordinator AND parent bridge recompute call the same pure function; proposal = full next document + impact + revision). The new `paste` proposer must live next to it and reuse its member-resolution/ordering (placementStart asc, then loopId/firstKeyId tie-break).
- `app/src/components/physic-paint/roto/physicsPaintRotoPhysicalResolver.ts` — `createPhysicPaintRotoPasteKeyGroupIntent` (line 551) is the fresh-keyId intent factory precedent; `buildPasteKeyGroupCandidate` (line 1447) is the destination-occupancy authority (out-of-range / over-capacity / duplicate-destination-frame, lines 1459-1482); `PhysicPaintRotoPhysicalEditProposal` (line 293) carries `nextRecords`/`nextLoopClips`/`nextIncomingInterpolationBreakKeyIds`; `getPhysicsPaintRotoSourceCycleId` (exported from `physicsPaintRotoSpacingSelection.ts:42`) is the source-cycle authority; `createPhysicPaintRotoKeyId` (model line 340) allocates fresh identities.
- `app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.ts` — `duplicateLinkedLoop` (line 1025-1057) constructs the duplicated shared-source placement: `{ ...loop, loopId: createPhysicPaintRotoKeyId(), placementStart: destination, sourceKeyIds: Object.freeze([...]) }`. This is the EXACT record shape a pasted Motion/Static rail must produce (plus the phase-relative `visibleRanges`/`phaseOrigin`/`originalEndExclusive` relocation to destination per the duplicated-placement move algebra — see `buildMoveGroupNextLoopClips` in the resolver lines 2019/4976).
- `app/src/components/physic-paint/hooks/useRotoPhysicalEditCoordinator.ts` — `RotoRailSetDeleteExecuteInput` (line 308), the specialized-input union (line 332), the barrier guards (lines 1382-1392: no child intent, no proposal, non-empty members), and the child-side shared-proposer invocation (lines 1587-1611). Mirror ALL of it for `paste`.
- `app/src/lib/physicPaintBridge.ts` — parent-side recompute of `delete-rails` via the same proposer (lines 1267-1268) + complete-state equality (lines 775-784). Add the `paste` recompute branch there.
- `app/src/components/physic-paint/hooks/useRotoPhysicalEditHistory.ts` — ordinary allowlist (lines 202-226); add `paste` beside `delete-rails`/`paste-key-group`. Replay already carries loopClips + breaks through snapshots (`snapshotRecordsEqual`, lines 248-269) and re-submits the stored proposal (lines 605-692) — no replay shape change.
- `app/src/components/physic-paint/hooks/useRotoTimelineActions.ts` — `pasteKeyGroup` (line 2033) with the rejection family literals (lines 2061-2065); `executeRailSetDelete` port (interface line 1389, dispatch lines 1914-1936); `getRailSetMembers` port (line 1365); `physicalActions` bundle + `useMemo` deps (lines 3099-3131); the mapper family `buildRailSetCopy`/`buildRailSetSoloCopy` (lines 1002-1046). The new set Copy/Paste/Delete avail signals + set actions + product-copy mapper live here.
- `app/src/components/physic-paint/PhysicsPaintStudio.tsx` — `railSetSelection` signal (line 168); `railSetDeleteExecuteRef` (line 1024); `executeRailSetDelete` port wiring (line 1101); Copy/Paste/Duplicate bindings (lines 1224-1239); strip props wiring (lines 2459-2463); post-acceptance set aftermath via `resolveRailSetPostAcceptance` (lines 1910-1935). The set-routing wrappers + `executeRailSetPaste` port + post-paste selection seeding live here.
- `app/src/components/physic-paint/hooks/useRotoKeyUtilities.ts` — `resolveCopySelection` (line 176), `copyKey` (line 200), `pasteKey` (line 243), `duplicateKey` (line 155). Add `copyRailSet(payload)` storing the rail clipboard, and the defensive rail guard in `pasteKey`.
- `app/src/components/physic-paint/roto/physicsPaintRotoSession.ts` — clipboard union (line 30), `copyKeyGroup` (line 173), `normalizeCopiedKey` (line 244). Add the `RotoSessionCopiedRailSet` variant + `copyRailSet` + normalize branch.
- `app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.tsx` — Copy/Paste/Duplicate buttons (lines 3096-3230) and availability from `rotoKeyState` (lines 1197-1251). The Studio passes a set-aware `rotoKeyState` overlay when a rail set is active; the strip otherwise unchanged.

## Tests (RED first, per the spec)

Targets: NEW `app/src/components/physic-paint/roto/physicsPaintRotoRailSetCopy.test.ts` (pure builder/proposer), `useRotoTimelineActions.test.ts`, `useRotoPhysicalEditCoordinator.test.ts`, `useRotoPhysicalEditHistory.test.ts`, `physicPaintBridge.test.ts`, `physicsPaintRotoRailSetSelection.test.ts`, `useRotoKeyUtilities.test.ts`, `physicsPaintRotoSession.test.ts`.

Run: `pnpm vitest run app/src/components/physic-paint/roto/physicsPaintRotoRailSetCopy.test.ts app/src/components/physic-paint/hooks/useRotoTimelineActions.test.ts app/src/components/physic-paint/hooks/useRotoPhysicalEditCoordinator.test.ts app/src/components/physic-paint/hooks/useRotoPhysicalEditHistory.test.ts app/src/lib/physicPaintBridge.test.ts app/src/components/physic-paint/roto/physicsPaintRotoRailSetSelection.test.ts app/src/components/physic-paint/hooks/useRotoKeyUtilities.test.ts`

The coordinator/bridge assertions are REAL proposal output — the coordinator child propose and parent recompute both run the pure `proposeRailsPaste` export (mirror `proposePhysicPaintRotoDeleteRails`), so structural assertions on the accepted proposal are meaningful.

### RED 1 — spec test 1: 2 Key Rails with an internal gap → Paste at cursor
- Source records `[k0@0, k2@2, k6@6, k8@8]` with `incomingInterpolationBreakKeyIds: ['k6']` (rail A = k0/k2, rail B = k6/k8; internal gap 3-5). Set members ordered `[key-rail{firstKeyId k0}, key-rail{firstKeyId k6}]`. `buildRotoRailSetCopyPayload` → payload with `anchorAppFrame: 0`, key-rail members each carrying `entries` (payload + sourceAppFrame + sourceKeyId) + `firstKeyOwnsIncomingBreak` (k0 false, k6 true).
- Paste at cursor 10 → proposal: fresh keyIds (assert `newKeyId` NOT in source set), records land `10/12` (A) and `16/18` (B) — relative offset preserved, frames 13-15 empty (internal gap preserved); `nextIncomingInterpolationBreakKeyIds` contains the fresh B-first key (source-owned break relocated) and NOT the fresh A-first key; deriveKeyRailSegments over the proposal yields A `[10-12]` and B `[16-18]`.
- Assert `executePhysicalEdit` called exactly once with `operationKind: 'paste'`; one history entry; `undo` restores the exact pre-paste document, `redo` re-applies.

### RED 2 — spec test 2: Set containing a Motion Rail → duplicated shared-source placement
- Source: real key k0@0; Group `{ loopId 'g1', placementStart 0, sourceKeyIds ['k0'], repeat 3, mode 'progressive', phaseOrigin 0, originalEndExclusive 6, visibleRanges [{start 0, endExclusive 6}], syncState 'synchronized' }`. Set `[group g1]`. Paste at cursor 8 → proposal `nextLoopClips` has a NEW clip with fresh loopId, same `sourceKeyIds ['k0']`, `placementStart 8`, `mode 'progressive'`, `repeat 3`, and `phaseOrigin/visibleRanges/originalEndExclusive` relocated to the 8-based phase; `getPhysicsPaintRotoSourceCycleId` of the new clip equals the source's; `sourceCycleId` NOT equal to any pre-existing clip (fresh placement); original group record unchanged.
- Copy-on-write proof (pure level): `buildRotoRailSetCopyPayload` reads the real-key `payload.dataUrl` at copy time; a later paste uses the frozen payload bytes even if the source record changes.

### RED 3 — spec test 3: partially occupied destination → whole paste rejected, zero mutation, zero history
- Same 2-Key-Rail payload; a real record at destination frame 10 (or any computed destination) → `proposeRails` returns `{ ok:false, code:'duplicate-destination-frame', ... }`; mapped copy `'Paste rejected — key in the way'`. `executePhysicalEdit` NOT called; no history entry; document byte-identical (records, loopClips, breaks all unchanged). Over-capacity case (destination near capacity) → `'Paste rejected — not enough room'`.

### RED 4 — spec test 4: Duplicate places the set after the last rail end; pasted set becomes selection
- Source as RED 1 (last rail B ends at 9 → lastEnd 10). `duplicate` → proposal anchored at the FIRST frame ≥ 10 where the WHOLE set fits (10/12/16/18 if empty; scan forward if occupied). After accept: `resolveRailSetPostAcceptance('paste', ...)` returns a set whose members = the pasted rails (fresh firstKeyIds / new loopIds), anchor = first pasted rail; cursor stays on its current frame.
- Coordinator acceptance carries the impact (`kind:'paste'`, ordered pasted identities) consumed by the Studio to seed the set + by the mapper for the accepted copy.

RED 1-4 must fail against the current code (no `paste` kind exists anywhere — history allowlist, coordinator union, resolver, bundle).

## Task 1 — RED tests (must fail before the implementation)

Write the failing tests above first, in dependency order so the pure module tests (builder + proposer + duplicate-destination scan) land before the coordinator/bridge/history characterization tests. RED tests compile against the NEW pure module exports (`buildRotoRailSetCopyPayload`, `proposeRails`) — create the module and its type/type stubs, then write the tests against the real intended signatures so Task 2 only fills bodies. Commit: `test(quick-260820-bjw): RED — rail-set copy/duplicate contract`.

## Task 2 — Implementation (tests green)

**2a. Pure module** `app/src/components/physic-paint/roto/physicsPaintRotoRailSetCopy.ts` (mirror `physicsPaintRotoRailSetSelection.ts`: pure, no Preact/store):
- Types `RotoRailSetCopyMember` (key-rail | loop), `RotoRailSetCopyPayload { anchorAppFrame, members }`.
- `buildRotoRailSetCopyPayload({ document, members })` — fail-closed on stale/malformed/duplicate members (exact-match against derived segments + loopClips, `proposeDeleteRails`-style ordering); freezes per-key paint payloads + the first-key-break flags + loop placement facts.
- `proposeRails({ document, payload, placementMode, destinationAppFrame? })`:
  - `'paste'` → anchor = `destinationAppFrame`; `'duplicate'` → anchor = first frame ≥ the set's last rail end where the whole set fits (scan; each candidate validates every destination empty + in capacity).
  - All-or-nothing occupancy validation reusing the `buildPasteKeyGroupCandidate` family (`out-of-range-frame`, `over-capacity`, `duplicate-destination-frame` + `conflictingAppFrames`).
  - Key members: fresh `createPhysicPaintRotoKeyId()` per key, relative frames from the anchor, paint payload cloned at the destination, `nextIncomingInterpolationBreakKeyIds` = source-owned internal breaks relocated onto the fresh keyIds + the rail-boundary rule (first key keeps source break OR owns a new break when it lands adjacent to non-set content on its left).
  - Loop members: duplicated shared-source placement record (the `duplicateLinkedLoop` construction + phase-relative relocation to destination).
  - Returns the complete next document (`records` + `loopClips` + `incomingInterpolationBreakKeyIds`) + impact (`kind:'paste'`, ordered pasted identities: fresh firstKeyIds for key rails / fresh loopIds for loops, `cursorAppFrame` stay-put) — consumed by child, parent, history, mapper, and selection seeding.
- The pure module exports the same names the coordinator and bridge import (single shared law).

**2b. Session clipboard** — `physicsPaintRotoSession.ts`: add `RotoSessionCopiedRailSet { kind:'rail-set', payload: RotoRailSetCopyPayload }` to `RotoSessionCopiedKeyValue`, add `isRotoSessionCopiedRailSet`, add `copyRailSet(payload)` (writes `copiedKey`, returns the copy action result), extend `normalizeCopiedKey` with a rail branch (per-key-entry canvas normalization mirroring the group branch; loop members pass through). `useRotoKeyUtilities.ts`: add `copyRailSet(payload)` (writes `session.copiedKey` + `copiedKeyRef.current` + message), add the defensive `isRotoSessionCopiedRailSet` guard in `pasteKey` (fail-closed message, never the single-key cast).

**2c. Resolver/coordinator/bridge/history** — add `'paste'` to the ordinary-kind allowlist (`useRotoPhysicalEditHistory.ts` lines 202-226). In `useRotoPhysicalEditCoordinator.ts`: `RotoRailSetPasteExecuteInput { operationKind:'paste', expectedLaunch, payload, placementMode }` (+ `destinationAppFrame` required for `'paste'`, absent for `'duplicate'`) in the specialized-input union; barrier branch mirroring `delete-rails` (lines 1382-1392: no child intent, no proposal, valid payload, valid placementMode); child-side `paste` invocation calling the shared pure module (mirror lines 1587-1611) and computing the impact; accepted output carries the impact. In `physicPaintBridge.ts`: the parent-side recompute branch (mirror lines 1267-1268) calling the SAME pure module + complete-state equality; persistence/parse of `'paste'` proposals is additive through the existing document fields (records + loopClips + breaks) — no new persisted fields.
- `resolveRailSetPostAcceptance` (`physicsPaintRotoRailSetSelection.ts`): `'paste'` branch returns the pasted set (fresh identities from the impact, anchor = first pasted rail); `recordRailSetSnapshot` records before = pre-paste set, after = pasted set so undo/redo restore it.

**2d. Actions hook** — `useRotoTimelineActions.ts`:
- New input ports: `getRailSetClipboard?: () => RotoRailSetCopyPayload | null`, `setRailSetClipboard?: (payload: RotoRailSetCopyPayload | null) => void`, `executeRailSetPaste?: (input: RotoRailSetPasteExecuteInput) => Promise<boolean>`.
- `copyRailSet()` — build via the pure builder from `getRailSetMembers` + document ports (fail-closed `'The selected Rails are no longer available.'` on stale), `setRailSetClipboard(payload)`, publish the copy status.
- `pasteRailSet(mode: 'paste')` and `duplicateRailSet()` — read `getRailSetClipboard()`, reject with the mapped `'Paste rejected — ...'` family on any rejection, dispatch through `executeRailSetPaste` (port absence → fail-closed), publish accepted copy via the one mapper.
- Availability signals `canCopyRailSet` / `canPasteRailSet` / `canDuplicateRailSet` + tooltips (mapper owns all copy, 43-03 D-27 precedent).
- Bundle: `copyRailSet`, `pasteRailSet`, `duplicateRailSet`, the three signals, and the new ports in `RotoTimelineActionsInput` + `useMemo` deps.

**2f. Studio + strip** — `PhysicsPaintStudio.tsx`:
- Wire `setRailSetClipboard`/`getRailSetClipboard` to the session slot; `executeRailSetPaste` to a `railSetPasteExecuteRef` that submits `RotoRailSetPasteExecuteInput` via `dispatchAndWaitForAcceptedRotoPhysicalEdit` (mirror `railSetDeleteExecuteRef`, line 1024).
- Routing wrappers on the three bindings (lines 1224-1239): Copy → active set ? `rotoPhysicalActions.copyRailSet()` : `rotoKeyUtilities.copyKey()`; Paste → clipboard rail variant ? `rotoPhysicalActions.pasteRailSet('paste')` : `rotoKeyUtilities.pasteKey()`; Duplicate → active set ? `rotoPhysicalActions.duplicateRailSet()` : `rotoKeyUtilities.duplicateKey()`.
- Post-acceptance: when accepted opkind is `'paste'`, build the pasted set from the impact and `resolveRailSetSelectionPostAcceptance`, then `railSetSelection.value = pastedSet` (anchor = first pasted rail); cursor stays on its current frame.
- Pass a set-aware `rotoKeyState` overlay to the strip when a rail set is active (Copy/Duplicate enable on set validity, Paste on a rail clipboard) so the buttons/tooltips reflect set scope.
- `PhysicsPaintWorkflowStrip.tsx` — no button changes; only consume the overlay (and reuse the existing tooltip wiring for the set scope copy if the actions hook exposes them).

## Verification / acceptance

- All RED + existing suite green for the seven target files (run command above).
- Rail-set paste contract assertions: one `executePhysicalEdit` call per whole-set paste; single history entry; Undo removes every pasted rail and restores the pre-paste document; Redo re-applies.
- Mapped family verbatim: `'Paste rejected — key in the way'` and `'Paste rejected — not enough room'` come from the ONE mapper (no new literal sources); rejected paste = zero mutation + zero history.
- The Dispatch `operationKind` is `'paste'` with `placementMode`; single/key-group Copy/Paste/Duplicate paths stay byte-identical (no shared regression).
- Native UAT deferred to user: mixed set → Copy → move cursor → Paste (relative layout + internal gaps + breaks); Duplicate places the set immediately after the last selected rail end; collision case rejects with the mapped status and nothing changes; Motion Rail copy behaves as a 43.3 shared-source duplicate (both synchronized until a local edit triggers copy-on-write); Undo/Redo atomic; save/reopen, playback, preview, export parity.

## Out of scope

- Resolver/history/bridge/persistence changes beyond the single additive `'paste'` kind; Cut (Scissors) tool; spacing/insert/delete group operations; the durable script library; any change to single-key or key-group Copy/Paste/Duplicate.
