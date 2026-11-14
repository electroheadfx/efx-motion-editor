# Quick Task 261101-o2m: Draft mode for the Move/Edit Stroke dialog — Research

**Researched:** 2026-11-01
**Domain:** Preact signals UI state + watercolor engine render gating
**Confidence:** HIGH — every claim below was read from source in this session

## Summary

Draft mode is a **script-vs-pixels split**, and the codebase already splits it cleanly. Each edit handler first mutates the recorded script and its undo snapshot via a `begin…Edit` builder, then runs a bake chain (`ensureDurableBase` → `resetSheet` → `applyAquarelleTimeline`). Draft ON keeps the first half and skips only the bake chain. The visible paint after a successful bake is the **cached base** (z-index 3), not the live sheet: the live sheet is empty, so its canvas is `opacity: 0`. Skipping reset+apply therefore freezes exactly the last rendered cache with no stale wet paint.

The recompute seam must be **new**: `handleRebakeScript` is unusable as-is because it mints a paint-seed re-roll undo entry. Undo/redo gating belongs in the Studio's `runScriptReplay` **port closures**, not in the pure orchestrator. The five exits are each a single existing seam; save and export share one (the flush hook), and the autosave path deliberately skips that flush — the one real hazard found.

**Primary recommendation:** add one session-only `draftMode` signal beside `strokeSizePreview` in `view/scriptStrokeEdition.ts`, add a narrow `settleDraftScript()` helper in the Studio, gate the six editors + replay ports on `draftMode.peek()`, and drive the strip/eyebrow leaf reads from `draftMode.value`.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### Draft cluster layout
- A **dedicated strip below the header**, above the filter row: `Draft  [switch]      cache [eye icon]`.
- The strip sits above the list/settings view gate so it is reachable from BOTH views.
- The existing header icon row (`[⌇ Preview] [⚙ view toggle] [× close]`) is unchanged.

#### Cache-visibility icon scope
- **Always available** — the icon toggles the committed/frozen sheet in both Draft and Live.
- It is display-only: it never gates a commit, a capture, a save or an export.
- Default: cache visible. The icon toggles both ways.

#### Overlay while Draft is ON
- **Selection only — today's overlay law.** `ScriptStrokeOverlay` keeps drawing only `scriptSelectedStrokeIds`.
- Unselected strokes are simply covered by the frozen cache; hiding the cache with the eye icon therefore leaves only the selection visible. That is accepted.
- The band/centerline law still composes with the Preview stroke size switch, unchanged.

#### Recompute exits
- Exactly these five exits force the SINGLE recompute first: **dialog close, frame change, play, export, save**.
- Leaving Select mode via the rail toggle does **not** itself recompute; the dialog close that accompanies it does.
- Exits do **not** recompute when Draft is OFF — the normal Live path is untouched.

### Claude's Discretion
- Exact signal names, module placement, strip CSS, and the icon glyph.
- Whether the recompute seam is one shared async helper or a per-exit call to the same function.
- How the frozen-cache hide is expressed in the layer tree (conditional render vs CSS opacity) as long as it is display-only.
- Test strategy details beyond the gates below.

### Deferred Ideas (OUT OF SCOPE)
None stated in CONTEXT.md. The strict non-goals are: redefining `aquarelleStrokeBand.ts`, any non-watercolor implementation, and any engine-math change.
</user_constraints>

## Findings

### F1 — Every edit handler: what commits, what Draft ON must skip

All six handlers share one anatomy: guards (peek-only) → prune ids to the current frame → `begin…Edit` (mutates the script **and** the before/after snapshot immediately) → async bake chain → `recordAquarelleScriptEdit` on success → rollback on failure. The script mutation therefore already happens at `begin…Edit` time, so Draft's "every edit still commits" requirement is satisfied by leaving everything up to and including `recordAquarelleScriptEdit` untouched.

| Handler | Entry | Begin (script+snapshot) | `ensureDurableBase` | `resetSheet` | `applyAquarelleTimeline` | Current success tail |
|---|---|---|---|---|---|---|
| `handleAquarelleDeleteStrokes` | 8089 | 8100 | 8110 | 8111 | 8112 | 8114 record, 8115-8119 clear/publish |
| `handleAquarelleMoveStrokes` | 8165 | 8196 | 8195 (before begin) | 8201 | 8202 | no `applyFrameModuleState` |
| `handleAquarelleAppearanceStrokes` | 8252 | 8269 | 8266 | 8274 | 8275 | 8310 commits via ref |
| `handleAquarelleTransformStrokes` | 8322 | 8351 | 8348 | 8365 | 8366 | — |
| `handleAquarelleStepStroke` | 8408 | 8413 | none | 8420 | 8421 | — |
| `handleAquarellePlaceStroke` | 8460 | 8465 | none | 8472 | 8473 | — |

`[VERIFIED: app/src/components/physic-paint/PhysicsPaintStudio.tsx:8089-8145, 8165-8230, 8252-8320, 8322-8406, 8408-8458, 8460-8510]`

- **Draft ON per handler:** keep guards, `begin…Edit`, and `recordAquarelleScriptEdit`; skip `ensureAquarelleDurableBaseRef` (deferrable — it can wait for the settle), skip `aquarelleResetSheetRef.current?.()`, skip `rotoScript.applyAquarelleTimeline`. The failure branch becomes unreachable; do not call `restoreAquarelleEditSnapshot(editId,'undo')` (nothing failed). Keep delete's `applyFrameModuleState(playFrame)` (owner lock, line 8119) since it reads the script, not pixels.
- **Delete in-flight flag is safe:** `setAquarelleDeleteInFlight(true)` at 8102 is cleared in a `finally` at 8138; an early return inside the `try` still clears it. `[VERIFIED: …tsx:8137-8139]`
- **Callers expect booleans:** the dialog advances its own drafts only on a true result (`…tsx:8250` comment); Draft's short-circuit must keep returning the same values the async path would.

### F2 — Undo/redo: gate in the ports, and gate the post-replay capture

- Orchestrator: `runAquarelleScriptReplay` returns `true` **only when the snapshot swap AND the re-bake succeeded**; it calls `restore` (97-104), `resetSheet` (110), `rebake` (121-124), rolls back on reset/bake failure, and `return true` at 150. `[VERIFIED: app/src/components/physic-paint/roto/aquarelleScriptReplay.ts:66, 93-150]`
- Studio ports: `runScriptReplay` 5380; in-flight gate 5412; ports 5418-5443 — `resetSheet` early-returns on the tile path (5427 `if (tileHistory) return;`), `rebake` uses `rotoFrameEditing.undo()/redo()` when tile, else `applyAquarelleTimeline` (5430-5437), `restore` 5424, `rollback` 5438, `notify` 5441, `publishOwner` 5442. `[VERIFIED: …PhysicsPaintStudio.tsx:5412-5443]`
- Post-replay capture: `if (replayed && tileHistory && !skipCapture)` at 5452 → captures the live canvas into the frame cache. `[VERIFIED: …tsx:5445-5457]`
- Recorded paint strokes always take the tile path: `replayStroke` sets `const tileHistory = true;` (5642), retries with a full script re-bake when tile fails (5665-5675). `[VERIFIED: …tsx:5606-5684]`
- Ledger routing: `undo` 997 — `aquarelle-script` → `route.replay(editId,'undo')` (1009-1011); `paint` recorded → `route.replayStroke` (1026-1029); unrecorded → `undoPaint()`. `[VERIFIED: app/src/components/physic-paint/hooks/useRotoPhysicalEditHistory.ts:997-1039]`

**Recommended gating (all inside the port closures, Draft via `.peek()`):**
1. `resetSheet` → no-op when Draft ON.
2. `rebake` → `Promise.resolve(true)` when Draft ON (the script swap already happened in `restore`; no engine call).
3. **Also gate the 5452 capture** with `!draftMode.peek()`. The tile branch would otherwise run `aquarelleCaptureFrameRef` on an unchanged sheet. The ink gate in `handleAquarelleCaptureFrame` (8662-8672, `measureAquarelleCanvasInk`) usually rejects a blank sheet, but an engine that still held wet paint when Draft was toggled could pass it and write a stale cache.
4. Do **not** touch `restore`/`rollback`/`notify`/`publishOwner`: the ledger must still move its stacks, and the owner lock must still reconcile.

Note: returning `true` from `rebake` makes the orchestrator return `true`, which is exactly what makes the linked `aquarelle-script`/recorded `paint` command land in history while pixels stay frozen.

### F3 — The recompute seam: new helper, not `handleRebakeScript`

`handleRebakeScript` (5466-5496) does `invalidateLivePixels` → `ensureDurableBase` → **`beginAquarellePaintSeedRerollEdit(playFrame, true)`** → reset → apply → record on success. `[VERIFIED: …PhysicsPaintStudio.tsx:5477-5492]` That builder mints an undo entry **and re-rolls every ON stroke's paint texture** — two outcomes Draft must never produce on a mere exit.

**Use a new narrow async helper** (discretion says one helper called by all exits is fine): invalidate live pixels → `ensureAquarelleDurableBaseRef.current(playFrame)` → `aquarelleResetSheetRef.current?.()` → `rotoScript.applyAquarelleTimeline(getAquarelleEventsForFrame(playFrame))` → on success `rotoScript.notifySourceRevision()` + `applyFrameModuleState(playFrame)`; on failure surface the existing refusal message path (no snapshot to roll back — the script is already committed). It must take the same `isAquarelleScriptEditInFlight()` gate and set/clear it in `try/finally` exactly like 5471-5473/5493-5495, so a settle cannot race an edit.

### F4 — What supplies the cache, how to hide it, and what the LIVE layer shows

- Supply: `PhysicsPaintStudioView.tsx:259` → `aquarelleCachedBaseUrl={props.cachedRotoPlaybackActive ? null : props.cachedRotoReferenceUrl ?? null}` `[VERIFIED: app/src/components/physic-paint/view/PhysicsPaintStudioView.tsx:259]`
- Mount: `PhysicsPaintCanvasMount.tsx:179-181` renders `<AquarelleCachedBaseLayer url={props.aquarelleCachedBaseUrl} />` only when the url is non-null, directly under `AquarelleCanvasLayer`. `[VERIFIED: app/src/components/physic-paint/engine/PhysicsPaintCanvasMount.tsx:179-182]`
- Leaf: `AquarelleCachedBaseLayer(props: { url: string })` at 38; the canvas is `return <canvas ref={canvasRef} class="aquarelle-cached-base" aria-hidden="true" />;` at 193; decode/buffer swap keyed on `props.url` (182-186). `[VERIFIED: app/src/components/physic-paint/engine/AquarelleCachedBaseLayer.tsx:38, 182-186, 193]`
- CSS: `.demo-canvas-shell .aquarelle-cached-base { … z-index: 3; pointer-events: none; }` and `.demo-canvas-shell .aquarelle-live-canvas { z-index: 4 !important; … }` — both quoted verbatim at `physicsPaintStudio.css:8070-8089`. Existing display-only precedent: `visibility: hidden` for cached-roto-playback (8095-8097) and `active-track-hidden` (8107-8108). `[VERIFIED: app/src/components/physic-paint/physicsPaintStudio.css:8070-8097, 8107-8108]`
- **What the live layer shows under Draft:** nothing. The live canvas opacity is `opacity: aquarelleLivePaint.value ? 1 : 0` (line 896), and `aquarelleLivePaint` is a local leaf signal (112) set from `engine.hasPaint` (848, 881). After a successful bake the engine is empty → the sheet is transparent → the cached base underneath is the only visible paint. Skipping the reset keeps that state, so there is **no stale wet paint** to worry about. `[VERIFIED: app/src/components/physic-paint/engine/AquarelleCanvasLayer.tsx:112, 848, 881, 896]`
- **Hide the cache in the leaf with CSS `visibility`/`display`, not by unmounting.** Unmounting (or nulling the url at the mount seam) tears down the decode/buffer; a pure CSS hide leaves the decode cache warm and cannot influence capture, save or export. Do not reuse the `aquarelleCachedBaseUrl` seam — it is also nulled for cached playback and is a render-prop of the whole canvas stack.
- Since `engine/` already value-imports `../view/scriptStrokeEdition` (ScriptStrokeOverlay.tsx:36-49 imports `strokeSizePreview` among others), the leaf can read a `draftCacheVisible` signal directly — no new prop threading. `[VERIFIED: app/src/components/physic-paint/engine/ScriptStrokeOverlay.tsx:36-49]`

### F5 — The five exits, their seams, and the stale-capture hazards

| Exit | Seam | What must happen |
|---|---|---|
| Dialog close | Dialog `closeSurface` (502-512) → `closeMoveMode` bundle (10371-10373 `if (aquarelleSelectMode.peek()) toggleAquarelleSelectMode();`) | Settle **here**, not in `setAquarelleSelectMode`/`toggleAquarelleSelectMode` — the locked decision says the rail toggle itself never recomputes. `[VERIFIED: app/src/components/physic-paint/view/PhysicsPaintStrokeSettingsDialog.tsx:502-512; …PhysicsPaintStudio.tsx:10371-10373]` |
| Frame change | `navigateToSyncedPhysicalFrame` 5061 | Settle and **await before 5109** (`aquarelleFlushCaptureRef.current?.()`) — that call captures the outgoing frame, and it runs before `setCachedRotoReferenceUrl(null)` 5117 and `loadCachedRotoReferenceFrame` 5123. Settling after the capture would persist the stale sheet. Respect the navigation generation begun at 5083. `[VERIFIED: …PhysicsPaintStudio.tsx:5061, 5083, 5106-5123]` |
| Play | `onToggleRotoPlayback: rotoCachedPlayback.toggle` wired at 10465 | Wrap the toggle: when Draft is ON and playback is about to start, await the settle, then toggle. `handleRotoPlaybackPlaying` (3644) is too late — it only flips `isPlaying`/`physicPaintVersion`. `[VERIFIED: …tsx:3644-3648, 10465]` |
| Export | `exportEngine.ts:144` `await requestPhysicPaintFlush();` | Covered by the flush hook (below). |
| Save | `projectStore.saveProject` 974 `if (!options?.skipPaintFlush) await requestPhysicPaintFlush();`; `saveProjectAs` 1021 | Covered by the flush hook, **except autosave**. `[VERIFIED: app/src/stores/projectStore.ts:968-979]` |

**Flush path (save + export):** `requestPhysicPaintFlush` (`physicPaintFlush.ts:36`) emits `physic-paint:flush-request` and gives up after `const timeout = setTimeout(() => finish(false), 5000);` (43); the Studio listener is installed at 9830-9836 and calls `flushStudioStateRef.current` (9793-9829), whose steps include `flushAquarellePixels()` at 9819. `[VERIFIED: app/src/lib/physicPaintFlush.ts:36-60; …PhysicsPaintStudio.tsx:9793-9836]` The settle must run **before** `flushAquarellePixels()` in that pipeline, and it must fit in the 5 s budget.

**Hazards:**
1. **Autosave persists stale cache bytes.** `saveProject` skips the flush when `skipPaintFlush` is set, and the in-repo comment says the debounced autosave uses exactly that (`projectStore.ts:968-974`: "The debounced auto-save skips it (skipPaintFlush)"). If an autosave fires mid-Draft, the document (new script) is serialized while the frame's cached pixel sidecar still reflects the frozen old render. Either accept the drift (the next Live settle rewrites it) or settle in the autosave path too — this is a product call beyond the locked five exits; surface it to the user rather than silently extending the exit list.
2. **5 s flush timeout vs a slow settle.** A settle inside `flushStudioStateRef` runs under the flush request's 5000 ms timeout. A heavy frame can exceed it, and the caller then treats the flush as `unavailable`. Sequence the settle as the first awaited step, and do not add a second `ensureDurableBase` afterwards.
3. **Browser fallback never flushes.** `requestPhysicPaintFlush` returns `false` immediately when `!isTauriRuntime()` (line 38). Save/export settles via the hook therefore only work in Tauri. Note it; do not build a second channel for dev.
4. **Close-path double entry.** `closeSurface` → `closeMoveMode` toggles Select off; `usePhysicsPaintCloseFlush` (3959-4007, `flushAquarellePixels(currentFrame)` at 3986) is the Studio **window** close path, a different surface. Do not wire the Draft settle into the window-close hook.

### F6 — Signal shape and the two switches

`scriptStrokeEdition.ts:110-123` is the exact precedent, verbatim:

```ts
/** Rail Move/Select toggle. Compare-then-write. */
export const scriptSelectMode = signal(false);
…
export const strokeSizePreview = signal(false);
/** Compare-then-write — 1000 identical calls notify zero times (rule 3). */
export function setStrokeSizePreview(on: boolean): void {
  if (strokeSizePreview.value === on) return;
  strokeSizePreview.value = on;
}
```

`[VERIFIED: app/src/components/physic-paint/view/scriptStrokeEdition.ts:107-123]` Its own doc says: "Read by the Stroke settings header leaf and the overlay leaf; NEVER the Studio render body (rule 5)." — the same contract must apply to `draftMode`. `[VERIFIED: …scriptStrokeEdition.ts:110-116]`

- Add `export const draftMode = signal(false)` + `setDraftMode` compare-then-write in the same module (with `draftCacheVisible = signal(true)` + setter for the eye).
- **Read sites:** dialog leaf (`draftMode.value` in the strip), cache leaf (`AquarelleCachedBaseLayer`, `draftCacheVisible.value`), overlay leaf only if it needs to react (it does not — it already reads `strokeSizePreview.value` at 137 and `scriptSelectedStrokeIds.value` at 145). `[VERIFIED: …engine/ScriptStrokeOverlay.tsx:137, 145]`
- **Write sites / peek sites:** the strip writes via the setter; the Studio handlers and replay ports read `.peek()` only, exactly like the existing guards ("Guards are peek-only: the handler must not subscribe the Studio body", 8087-8088). `[VERIFIED: …PhysicsPaintStudio.tsx:8086-8088]`
- **Composition with Preview stroke size:** proven by construction — both are independent booleans in the same module; `strokeSizePreview` is never read by the Studio (grep shows only scriptStrokeEdition, the dialog at 443/814/821, and the overlay at 137/378). Neither setter touches the other, so no reset coupling is possible. `[VERIFIED: app/src/components/physic-paint/view/scriptStrokeEdition.ts:117-123; …view/PhysicsPaintStrokeSettingsDialog.tsx:443, 814, 821; …engine/ScriptStrokeOverlay.tsx:137, 378]`
- **Reset to Live on every dialog open:** the established "only reset site" precedent is the genuine off→on edge in `setAquarelleSelectMode` (324-342, `if (on && !was && aquarelleStrokeSettingsDismissed.peek())` at 339) — the dialog's dismissal flag resets there, with the comment "EVENT-handler write (never a render body). The ONLY reset site is the setAquarelleSelectMode off -> on choke point." (508-509). `[VERIFIED: …view/aquarelleStrokeSelection.ts:324-342; …view/PhysicsPaintStrokeSettingsDialog.tsx:502-512]` Use that edge (`if (on && !was) setDraftMode(false)`), or the dialog's own open-transition effect (517-525, already the sheet-raise seam). Prefer the off→on edge: on watercolor the fallback dismissal path is dead because `closeMoveMode` is always supplied, so every real open is an off→on entry.

### F7 — Overlay freshness under Draft (no extra work needed)

The overlay/dialog leaves re-render on script mutation without a bake: `listSelectableAquarelleStrokes` starts with `void aquarelleStrokesRevision.value;` (454) and the listing walks the current events. So Draft edits update the band/centerline overlay from the current script automatically. `[VERIFIED: app/src/components/physic-paint/view/aquarelleStrokeSelection.ts:449-474]`

The band module stays untouched: `buildStrokeBand` / `buildStrokeBandCached` in `view/aquarelleStrokeBand.ts` are pure and signal-free (per `261101-mvg-SUMMARY.md` and CONTEXT canonical refs). The overlay already chooses band vs centerline at 378 via `previewStrokeSize && props.port.bandFor !== undefined`. `[VERIFIED: …engine/ScriptStrokeOverlay.tsx:378]`

## Project Constraints (from CLAUDE.md)

- **Preact + @preact/signals only.** Consult `efx-preact-reactivity` before touching any component, effect, store setter or signal subscription. Relevant rules here: rule 3 (idempotent compare-then-write setters), rule 5 (no signal reads in the Studio render body), rule 6 (lifecycle effects, never render bodies), narrow leaf subscriptions, no render-body writes.
- **Never `useEffect` for selection.** The selection stays in the click/handler path.
- Tests: `vitest run` only; **never watch mode**. Do not run the dev server.
- No test-config hacks — use the existing setup.
- Do not add backward-compat shims for document formats.

## Pitfalls

1. **Do not put the settle in `toggleAquarelleSelectMode`.** The locked decision explicitly separates the rail toggle from the dialog-close exit; putting it in the shared setter recomputes on both and violates the "exactly five exits" law.
2. **Do not call `handleRebakeScript` as the settle.** It re-rolls the paint seed and mints an undo entry (5481).
3. **Do not skip `restore`/`rollback`.** Draft must still consume/return ledger entries; only the pixel side is gated.
4. **Do not unmount the cache to hide it.** Re-decoding on every eye toggle is a visible stall; the existing `visibility: hidden` precedent is display-only.
5. **Do not gate the eye icon behind Draft.** It must work in both modes and must never touch capture/save/export.
6. **Do not read `draftMode.value` in the Studio body or in a memo dependency array.** That subscribes the whole Studio, exactly the rule-5 failure the `strokeSizePreview` comment warns about. Use `.peek()` in handlers and let the leaves subscribe.
7. **Do not forget the in-flight gate on the settle.** A settle racing `runScriptReplay`'s in-flight flag can interleave a reset with a replay.
8. **Frame-change ordering is load-bearing.** Settle before `aquarelleFlushCaptureRef` (5109), or the outgoing frame persists the pre-Draft sheet.
9. **The strip must sit above the view gate** (between the header that ends at 879 and the filter row that starts at 881), so it renders in both `list` and `settings` views. The existing filter row is `engineModule === 'watercolor' && view === 'list'` only (881) — do not nest the strip inside that condition. `[VERIFIED: …view/PhysicsPaintStrokeSettingsDialog.tsx:865-906]`
10. **Switch markup precedent:** copy the watercolor switch at 1112-1131 — `type="button"`, `` class={`physics-paint-script-switch${…' is-on'}`} `` (1114), `role="switch"` (1115), `aria-checked` (1116), track/knob/label spans (1127-1130). Reuse the existing CSS classes so the strip matches the dialog. `[VERIFIED: …view/PhysicsPaintStrokeSettingsDialog.tsx:1112-1131]`

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The autosave path (`skipPaintFlush`) must be left alone, and stale cache bytes in an autosave are acceptable until the next Live settle | F5 | If stale bytes are not acceptable, the exit list must grow to include autosave — a product decision |
| A2 | A settle will fit inside the 5000 ms flush timeout on the target frames | F5 | Save/export reports `unavailable`; the planner may need a pre-settle at the exit rather than inside the flush |
| A3 | Draft's editor short-circuits keep the same boolean return values callers already rely on | F1 | The dialog's own draft state could advance without a commit |
| A4 | `handleAquarelleStepStroke`/`PlaceStroke` have no durable-base step, so Draft needs no special case for them | F1 | A missing base recovery surfaces only at the next Live bake |

## Validation

Existing framework: **Vitest** (`vitest run`, never watch). Likely targets, all in `app/src`:
- `PhysicsPaintStudio.test.ts` — the Studio harness used for handler-level tests; add Draft handler tests here (edits commit, no `applyAquarelleTimeline` call).
- `aquarelleScriptReplay` is pure with injectable ports — the cheapest place to pin "Draft returns true without rebaking", though the gating lives in the Studio's closures, so a Studio-level test is the honest one.
- Overlay/dialog leaf render: `ScriptStrokeOverlay` and the settings dialog are already covered by existing component tests; extend rather than create new config.
- Manual UAT rows (user-driven, live): Draft ON → edit → cache frozen, overlay updated; Draft OFF → single recompute; each of the five exits; eye icon in both modes; two switches compose.

## Security Domain

Not applicable in the ASVS sense: the feature adds no authentication, session, access-control, network or persistence surface. It is a session-only UI boolean plus a display-only CSS toggle. The one persistence-adjacent concern is the autosave stale-cache item in F5/Pitfalls, which is a correctness issue, not a security one.

## Sources

### Primary (HIGH confidence — read in this session)
- `app/src/components/physic-paint/PhysicsPaintStudio.tsx` — handlers 8089-8510, replay ports 5412-5457, recompute 5466-5496, replayStroke 5606-5684, capture 8642-8672, navigation 5061-5123, flush 9793-9836, dialog bundle 10335-10378, play wiring 10465
- `app/src/components/physic-paint/roto/aquarelleScriptReplay.ts` — orchestrator contract 66-150
- `app/src/components/physic-paint/view/scriptStrokeEdition.ts` — signal precedent 107-123
- `app/src/components/physic-paint/view/aquarelleStrokeSelection.ts` — select-mode edge 324-342, listing 449-474
- `app/src/components/physic-paint/view/PhysicsPaintStrokeSettingsDialog.tsx` — header/filter 865-906, close 502-512, open effect 517-525, switch 1112-1131
- `app/src/components/physic-paint/engine/AquarelleCachedBaseLayer.tsx` — 38, 182-186, 193
- `app/src/components/physic-paint/engine/AquarelleCanvasLayer.tsx` — 112, 674-686, 786-797, 848, 881, 896
- `app/src/components/physic-paint/engine/PhysicsPaintCanvasMount.tsx` — 179-182
- `app/src/components/physic-paint/engine/ScriptStrokeOverlay.tsx` — 36-49, 137, 145, 378
- `app/src/components/physic-paint/view/PhysicsPaintStudioView.tsx` — 259
- `app/src/components/physic-paint/physicsPaintStudio.css` — 8070-8097, 8107-8108
- `app/src/components/physic-paint/hooks/useRotoPhysicalEditHistory.ts` — 942-947, 997-1039
- `app/src/lib/physicPaintFlush.ts` — 36-60
- `app/src/stores/projectStore.ts` — 968-979, 1021
- `app/src/lib/exportEngine.ts` — 144

### Secondary (MEDIUM confidence)
- `261101-mvg-SUMMARY.md` — the band module's "next quick's Draft mode" note and the session-switch precedent

## Metadata

**Confidence breakdown:**
- Standard stack: n/a — no new packages (nothing to audit)
- Architecture: HIGH — all seams read with line-level evidence
- Pitfalls: HIGH for the in-repo hazards; MEDIUM for the autosave policy item (A1)

**Research date:** 2026-11-01
**Valid until:** 30 days (stable in-repo surface; re-verify line numbers if `PhysicsPaintStudio.tsx` changes)
